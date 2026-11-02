import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function renderIconPng(size, maskable = false) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2;
  const cy = size / 2;
  const scale = maskable ? 0.78 : 0.92;
  const outerR = (size * 0.36) * scale;
  const ringW = Math.max(2, size * 0.022 * scale);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1);
    raw[rowOffset] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);

      // Base background: deep emerald #064E3B (6, 78, 59)
      let r = 6, g = 78, b = 59, a = 255;

      // Rounded rect clipping for non-maskable
      if (!maskable) {
        const rad = size * 0.2;
        const qx = Math.abs(dx) - (size / 2 - rad);
        const qy = Math.abs(dy) - (size / 2 - rad);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
        if (outside > 0.5) {
          a = 0;
        }
      }

      if (a > 0) {
        // Spotlight circle #047857 (4, 120, 87)
        if (dist <= outerR) {
          r = 4; g = 120; b = 87;
        }
        // Golden ring #F59E0B (245, 158, 11)
        if (Math.abs(dist - outerR) <= ringW) {
          r = 245; g = 158; b = 11;
        }
        // Theatrical mask silhouette #FFFBEB (255, 251, 235)
        const mx = dx / (outerR * 0.52);
        const my = (dy - outerR * 0.04) / (outerR * 0.62);
        if (mx * mx + my * my <= 1.0) {
          r = 255; g = 251; b = 235;
          // Eyes
          const ex1 = (dx + outerR * 0.2) / (outerR * 0.09);
          const ey1 = (dy + outerR * 0.12) / (outerR * 0.09);
          const ex2 = (dx - outerR * 0.2) / (outerR * 0.09);
          const ey2 = (dy + outerR * 0.12) / (outerR * 0.09);
          if (ex1 * ex1 + ey1 * ey1 <= 1 || ex2 * ex2 + ey2 * ey2 <= 1) {
            r = 6; g = 78; b = 59;
          }
          // Smile arc
          const sd = Math.hypot(dx, dy - outerR * 0.04);
          if (dy > outerR * 0.12 && Math.abs(sd - outerR * 0.24) < outerR * 0.045 && Math.abs(dx) < outerR * 0.22) {
            r = 6; g = 78; b = 59;
          }
        }
        // Top crown jewel #F59E0B
        const jx = Math.abs(dx) / (outerR * 0.14);
        const jy = Math.abs(dy + outerR * 0.72) / (outerR * 0.14);
        if (jx + jy <= 1.0) {
          r = 245; g = 158; b = 11;
        }
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const pubDir = path.resolve('public');
fs.mkdirSync(pubDir, { recursive: true });
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), renderIconPng(192, false));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), renderIconPng(512, false));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), renderIconPng(512, true));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), renderIconPng(180, true));
console.log('Generated PWA PNG icons successfully.');
