import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const STATE_FILE = path.join(__dirname, '.server-state.json');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_SECRET =
  (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) ||
  crypto.randomBytes(32).toString('hex');

interface ServerState {
  online: boolean;
  adminPasswordHash?: string;
  updatedAt?: string;
}

function readServerState(): ServerState {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return { online: true };
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ServerState>;
    return {
      online: typeof parsed.online === 'boolean' ? parsed.online : true,
      adminPasswordHash:
        typeof parsed.adminPasswordHash === 'string' && parsed.adminPasswordHash.includes(':')
          ? parsed.adminPasswordHash
          : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return { online: true };
  }
}

function writeServerState(next: ServerState): void {
  const payload = JSON.stringify(next, null, 2);
  const tmpFile = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, payload, { mode: 0o600 });
  fs.renameSync(tmpFile, STATE_FILE);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyScryptHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const expected = Buffer.from(keyHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function getEnvAdminPassword(): string | null {
  const raw = process.env.SERVER_ADMIN_PASSWORD;
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isAuthConfigured(state: ServerState): boolean {
  return Boolean(getEnvAdminPassword() || state.adminPasswordHash);
}

function verifyAdminPassword(password: string, state: ServerState): boolean {
  const envPass = getEnvAdminPassword();
  if (envPass) {
    const a = crypto.createHash('sha256').update(password).digest();
    const b = crypto.createHash('sha256').update(envPass).digest();
    return crypto.timingSafeEqual(a, b);
  }
  if (state.adminPasswordHash) {
    return verifyScryptHash(password, state.adminPasswordHash);
  }
  return false;
}

function signAdminToken(): string {
  const payload = {
    role: 'server_admin',
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(12).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return false;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'server_admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function extractBearerToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return undefined;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    return false;
  }
  return entry.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

const SERVER_DOWN_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Server Unavailable</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #020617;
        color: #f8fafc;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 24px;
      }
      .card {
        width: 100%;
        max-width: 420px;
        border: 1px solid #1e293b;
        background: #0f172a;
        border-radius: 20px;
        padding: 36px 28px;
        text-align: center;
      }
      .dot {
        width: 12px;
        height: 12px;
        border-radius: 9999px;
        background: #f43f5e;
        margin: 0 auto 18px;
        box-shadow: 0 0 18px rgba(244, 63, 94, 0.55);
      }
      h1 {
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="dot" aria-hidden="true"></div>
      <h1>The server is down</h1>
    </main>
  </body>
</html>`;

function isAllowedWhenOffline(reqPath: string): boolean {
  if (reqPath === '/server' || reqPath === '/server/') return true;
  if (reqPath.startsWith('/api/')) return true;
  if (
    reqPath.startsWith('/assets/') ||
    reqPath.startsWith('/src/') ||
    reqPath.startsWith('/node_modules/') ||
    reqPath.startsWith('/@')
  ) {
    return true;
  }
  const allowedStaticFiles = new Set([
    '/icon.svg',
    '/apple-touch-icon.png',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/pwa-maskable-512x512.png',
    '/manifest.webmanifest',
    '/dev-sw.js',
    '/sw.js',
  ]);
  if (allowedStaticFiles.has(reqPath) || reqPath.startsWith('/workbox-')) {
    return true;
  }
  return false;
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  // Deny direct access to sensitive hidden files
  app.use((req: Request, res: Response, next: NextFunction) => {
    const cleanPath = req.path.toLowerCase();
    if (cleanPath.includes('.server-state') || cleanPath.includes('/.env') || cleanPath === '/server.ts') {
      res.status(404).end();
      return;
    }
    next();
  });

  // Public lightweight server status check (read-only)
  app.get('/api/server/status', (_req: Request, res: Response) => {
    const state = readServerState();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ online: state.online });
  });

  // Auth status for /server console (does not reveal server toggle state when unauthenticated)
  app.get('/api/server/auth/status', (req: Request, res: Response) => {
    const state = readServerState();
    const token = extractBearerToken(req);
    const authenticated = verifyAdminToken(token);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      authenticated,
      setupRequired: !isAuthConfigured(state),
    });
  });

  // One-time first-run admin setup when no env password or stored hash exists
  app.post('/api/server/auth/claim', (req: Request, res: Response) => {
    const state = readServerState();
    if (isAuthConfigured(state)) {
      res.status(409).json({ error: 'Admin password is already configured.' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      return;
    }

    const nextState: ServerState = {
      ...state,
      adminPasswordHash: hashPassword(password),
      updatedAt: new Date().toISOString(),
    };
    writeServerState(nextState);
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ token: signAdminToken() });
  });

  // Admin sign-in
  app.post('/api/server/auth/login', (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (isRateLimited(ip)) {
      res.status(429).json({ error: 'Too many failed attempts. Please wait a few minutes.' });
      return;
    }

    const state = readServerState();
    if (!isAuthConfigured(state)) {
      res.status(409).json({ error: 'Admin setup required first.' });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password || password.length > 128 || !verifyAdminPassword(password, state)) {
      recordFailedAttempt(ip);
      res.status(401).json({ error: 'Invalid admin password.' });
      return;
    }

    clearFailedAttempts(ip);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ token: signAdminToken() });
  });

  // Protected admin endpoints
  app.get('/api/server/admin-state', requireAdminAuth, (_req: Request, res: Response) => {
    const state = readServerState();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      online: state.online,
      updatedAt: state.updatedAt ?? null,
    });
  });

  app.post('/api/server/toggle', requireAdminAuth, (req: Request, res: Response) => {
    if (typeof req.body?.online !== 'boolean') {
      res.status(400).json({ error: 'Invalid online flag.' });
      return;
    }
    const current = readServerState();
    const nextState: ServerState = {
      ...current,
      online: req.body.online,
      updatedAt: new Date().toISOString(),
    };
    writeServerState(nextState);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      online: nextState.online,
      updatedAt: nextState.updatedAt,
    });
  });

  // Server offline gate for main site URL and non-admin navigation routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    const state = readServerState();
    if (!state.online && !isAllowedWhenOffline(req.path)) {
      res.status(503);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.type('html').send(SERVER_DOWN_HTML);
      return;
    }
    next();
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    app.get(['/server', '/server/'], async (req: Request, res: Response, next: NextFunction) => {
      try {
        const template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.type('html').send(html);
      } catch (err) {
        next(err);
      }
    });

    app.get('/@vite/client', async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result) {
          next();
          return;
        }
        const cleanCode = result.code
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled */'
          )
          .replace(
            'throw new SendBeforeConnectError("send was called before connect");',
            'return;'
          )
          .replace(
            'throw new SendBeforeConnectError("invoke was called before connect");',
            'return;'
          );
        res.status(200).type('application/javascript').send(cleanCode);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));

    app.get('*', (req: Request, res: Response) => {
      const state = readServerState();
      if (!state.online && req.path !== '/server' && req.path !== '/server/') {
        res.status(503);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.type('html').send(SERVER_DOWN_HTML);
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
