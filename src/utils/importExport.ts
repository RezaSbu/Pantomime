import {
  ActiveMatchState,
  AppSettings,
  CategoryItem,
  CompletedMatch,
  Difficulty,
  WordItem,
  WordKind,
  WordOrigin,
  WordStatus,
} from '../types/game';

function escapeCsvCell(val: string | number | undefined): string {
  const s = val === undefined || val === null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  cells.push(cur.trim());
  return cells;
}

export function exportWordsToCsv(words: WordItem[]): string {
  const header = [
    'id',
    'text',
    'categoryId',
    'difficulty',
    'kind',
    'basePoints',
    'defaultTimeSec',
    'speedBonusThresholdSec',
    'speedBonusPoints',
    'status',
    'origin',
    'footballSubType',
    'tags',
    'alternatives',
  ].join(',');

  const rows = words.map((w) =>
    [
      escapeCsvCell(w.id),
      escapeCsvCell(w.text),
      escapeCsvCell(w.categoryId),
      escapeCsvCell(w.difficulty),
      escapeCsvCell(w.kind),
      escapeCsvCell(w.basePoints),
      escapeCsvCell(w.defaultTimeSec),
      escapeCsvCell(w.speedBonusThresholdSec),
      escapeCsvCell(w.speedBonusPoints),
      escapeCsvCell(w.status),
      escapeCsvCell(w.origin ?? 'neutral'),
      escapeCsvCell(w.footballSubType ?? ''),
      escapeCsvCell(w.tags.join('|')),
      escapeCsvCell(w.alternatives.join('|')),
    ].join(',')
  );

  // Prepend UTF-8 BOM for proper Persian rendering in Excel / spreadsheet software
  return '\uFEFF' + [header, ...rows].join('\n');
}

export function parseWordsFromCsv(csvContent: string): WordItem[] {
  const cleaned = csvContent.replace(/^\uFEFF/, '').trim();
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  const colIndex = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const idxId = colIndex('id');
  const idxText = colIndex('text');
  const idxCat = colIndex('categoryId');
  const idxDiff = colIndex('difficulty');
  const idxKind = colIndex('kind');
  const idxBase = colIndex('basePoints');
  const idxTime = colIndex('defaultTimeSec');
  const idxSpeedThr = colIndex('speedBonusThresholdSec');
  const idxSpeedPts = colIndex('speedBonusPoints');
  const idxStatus = colIndex('status');
  const idxOrigin = colIndex('origin');
  const idxFbSub = colIndex('footballSubType');
  const idxTags = colIndex('tags');
  const idxAlt = colIndex('alternatives');

  const results: WordItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const text = (idxText >= 0 ? cells[idxText] : cells[0])?.trim();
    if (!text) continue;

    const categoryId = (idxCat >= 0 ? cells[idxCat] : 'objects') || 'objects';
    const rawDiff = (idxDiff >= 0 ? cells[idxDiff] : 'medium') as Difficulty;
    const difficulty: Difficulty = ['easy', 'medium', 'hard'].includes(rawDiff)
      ? rawDiff
      : 'medium';

    const rawKind = (idxKind >= 0 ? cells[idxKind] : '') as WordKind;
    const kind: WordKind = ['regular', 'proverb', 'golden'].includes(rawKind)
      ? rawKind
      : categoryId === 'golden'
      ? 'golden'
      : categoryId === 'proverbs'
      ? 'proverb'
      : 'regular';

    const defaultPts =
      kind === 'golden'
        ? 30
        : kind === 'proverb'
        ? { easy: 5, medium: 8, hard: 10 }[difficulty]
        : { easy: 2, medium: 4, hard: 6 }[difficulty];

    const defaultTime =
      kind === 'golden'
        ? 240
        : kind === 'proverb'
        ? { easy: 90, medium: 120, hard: 150 }[difficulty]
        : { easy: 45, medium: 75, hard: 120 }[difficulty];

    const defaultThr =
      kind === 'golden'
        ? 60
        : kind === 'proverb'
        ? { easy: 20, medium: 40, hard: 60 }[difficulty]
        : { easy: 15, medium: 30, hard: 45 }[difficulty];

    const defaultBonus =
      kind === 'golden'
        ? 10
        : kind === 'proverb'
        ? { easy: 2, medium: 3, hard: 5 }[difficulty]
        : { easy: 2, medium: 3, hard: 4 }[difficulty];

    const rawStatus = (idxStatus >= 0 ? cells[idxStatus] : 'valid') as WordStatus;
    const status: WordStatus = ['valid', 'reported', 'invalid'].includes(rawStatus)
      ? rawStatus
      : 'valid';

    const rawOrigin = (idxOrigin >= 0 ? cells[idxOrigin] : 'neutral') as WordOrigin;
    const origin: WordOrigin = ['iranian', 'foreign', 'neutral'].includes(rawOrigin)
      ? rawOrigin
      : 'neutral';

    const fbSubRaw = idxFbSub >= 0 ? cells[idxFbSub] : '';
    const footballSubType =
      fbSubRaw === 'player' || fbSubRaw === 'other' ? fbSubRaw : undefined;

    results.push({
      id:
        (idxId >= 0 && cells[idxId]) ||
        `csv_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      categoryId,
      difficulty,
      kind,
      basePoints: Number(idxBase >= 0 ? cells[idxBase] : defaultPts) || defaultPts,
      defaultTimeSec: Number(idxTime >= 0 ? cells[idxTime] : defaultTime) || defaultTime,
      speedBonusThresholdSec:
        Number(idxSpeedThr >= 0 ? cells[idxSpeedThr] : defaultThr) || defaultThr,
      speedBonusPoints:
        Number(idxSpeedPts >= 0 ? cells[idxSpeedPts] : defaultBonus) || defaultBonus,
      status,
      origin,
      footballSubType,
      tags: idxTags >= 0 && cells[idxTags] ? cells[idxTags].split('|').filter(Boolean) : [],
      alternatives:
        idxAlt >= 0 && cells[idxAlt] ? cells[idxAlt].split('|').filter(Boolean) : [],
      isCustom: true,
    });
  }

  return results;
}

export interface FullBackupPayload {
  app: 'adabazi';
  version: number;
  exportedAt: number;
  settings: AppSettings;
  categories: CategoryItem[];
  words: WordItem[];
  history: CompletedMatch[];
  activeMatch: ActiveMatchState | null;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
