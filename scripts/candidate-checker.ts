import { normalizePersianText } from '../src/utils/format';
import * as fs from 'fs';

const existing = new Set<string>(JSON.parse(fs.readFileSync('/tmp/existing_words.json', 'utf8')));

export function filterUnique(candidates: Array<string | { text: string; [k: string]: any }>) {
  const result: any[] = [];
  const rejected: string[] = [];
  const seenInBatch = new Set<string>();

  for (const item of candidates) {
    const text = typeof item === 'string' ? item : item.text;
    const norm = normalizePersianText(text);
    if (existing.has(norm)) {
      rejected.push(`${text} (already exists)`);
    } else if (seenInBatch.has(norm)) {
      rejected.push(`${text} (duplicate in batch)`);
    } else {
      seenInBatch.add(norm);
      result.push(item);
    }
  }

  return { accepted: result, rejected, count: result.length };
}
