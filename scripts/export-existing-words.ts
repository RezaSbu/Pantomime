import { WORD_DB } from '../src/data/wordDB';
import { normalizePersianText } from '../src/utils/format';
import * as fs from 'fs';

const existing = new Set<string>();

for (const [cat, diffs] of Object.entries(WORD_DB)) {
  if (cat === 'golden') {
    for (const item of diffs as any[]) {
      const text = typeof item === 'string' ? item : item.text;
      existing.add(normalizePersianText(text));
    }
  } else {
    for (const [diff, list] of Object.entries(diffs as any)) {
      for (const item of list as any[]) {
        const text = typeof item === 'string' ? item : item.text;
        existing.add(normalizePersianText(text));
      }
    }
  }
}

console.log(`Loaded ${existing.size} existing unique normalized words.`);
fs.writeFileSync('/tmp/existing_words.json', JSON.stringify(Array.from(existing)));
