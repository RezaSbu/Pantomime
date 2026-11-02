import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { INITIAL_CATEGORIES } from '../data/categories';
import { INITIAL_WORDS } from '../data/initialWordBank';
import {
  ActiveMatchState,
  CategoryItem,
  CompletedMatch,
  WordItem,
} from '../types/game';

interface AdabaziDB extends DBSchema {
  words: {
    key: string;
    value: WordItem;
    indexes: { 'by-category': string };
  };
  categories: {
    key: string;
    value: CategoryItem;
  };
  history: {
    key: string;
    value: CompletedMatch;
  };
  kv: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'adabazi_offline_db';
const DB_VERSION = 1;
const SEED_VERSION = '2026.11.1';

let dbPromise: Promise<IDBPDatabase<AdabaziDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AdabaziDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AdabaziDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('words')) {
          const wordStore = db.createObjectStore('words', { keyPath: 'id' });
          wordStore.createIndex('by-category', 'categoryId');
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('history')) {
          db.createObjectStore('history', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }
      },
    });
  }
  return dbPromise;
}

export async function initializeStorage(): Promise<{
  words: WordItem[];
  categories: CategoryItem[];
  activeMatch: ActiveMatchState | null;
  history: CompletedMatch[];
}> {
  const db = await getDB();
  const seededVersion = await db.get('kv', 'seed_version');
  const existingWordsCount = await db.count('words');

  if (existingWordsCount === 0 || seededVersion !== SEED_VERSION) {
    // Preserve custom user words/categories and reported flags if upgrading
    const oldWords = await db.getAll('words');
    const oldCategories = await db.getAll('categories');
    const customWords = oldWords.filter((w) => w.isCustom);
    const reportedIds = new Map(
      oldWords.filter((w) => w.status !== 'valid').map((w) => [w.id, w.status])
    );
    const customCategories = oldCategories.filter((c) => c.isCustom);

    const tx = db.transaction(['words', 'categories', 'kv'], 'readwrite');
    await tx.objectStore('words').clear();
    await tx.objectStore('categories').clear();

    for (const cat of INITIAL_CATEGORIES) {
      await tx.objectStore('categories').put(cat);
    }
    for (const customCat of customCategories) {
      await tx.objectStore('categories').put(customCat);
    }

    for (const word of INITIAL_WORDS) {
      const savedStatus = reportedIds.get(word.id);
      await tx.objectStore('words').put(
        savedStatus ? { ...word, status: savedStatus } : word
      );
    }
    for (const cw of customWords) {
      await tx.objectStore('words').put(cw);
    }

    await tx.objectStore('kv').put(SEED_VERSION, 'seed_version');
    await tx.done;
  }

  const [words, categories, activeRaw, history] = await Promise.all([
    db.getAll('words'),
    db.getAll('categories'),
    db.get('kv', 'active_match'),
    db.getAll('history'),
  ]);

  history.sort((a, b) => b.finishedAt - a.finishedAt);

  return {
    words,
    categories,
    activeMatch: (activeRaw as ActiveMatchState | undefined) ?? null,
    history,
  };
}

export async function persistWord(word: WordItem): Promise<void> {
  const db = await getDB();
  await db.put('words', word);
}

export async function persistWordsBulk(words: WordItem[], replaceAll = false): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('words', 'readwrite');
  if (replaceAll) {
    await tx.store.clear();
  }
  for (const w of words) {
    await tx.store.put(w);
  }
  await tx.done;
}

export async function removeWordFromDB(wordId: string): Promise<void> {
  const db = await getDB();
  await db.delete('words', wordId);
}

export async function persistCategory(category: CategoryItem): Promise<void> {
  const db = await getDB();
  await db.put('categories', category);
}

export async function removeCategoryFromDB(categoryId: string): Promise<void> {
  const db = await getDB();
  await db.delete('categories', categoryId);
}

export async function persistActiveMatch(match: ActiveMatchState | null): Promise<void> {
  const db = await getDB();
  if (match === null) {
    await db.delete('kv', 'active_match');
  } else {
    await db.put('kv', match, 'active_match');
  }
}

export async function persistCompletedMatch(record: CompletedMatch): Promise<void> {
  const db = await getDB();
  await db.put('history', record);
}

export async function removeHistoryRecord(matchId: string): Promise<void> {
  const db = await getDB();
  await db.delete('history', matchId);
}

export async function clearAllHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('history');
}

export async function resetWordBankToFactory(): Promise<{
  words: WordItem[];
  categories: CategoryItem[];
}> {
  const db = await getDB();
  const tx = db.transaction(['words', 'categories', 'kv'], 'readwrite');
  await tx.objectStore('words').clear();
  await tx.objectStore('categories').clear();

  for (const cat of INITIAL_CATEGORIES) {
    await tx.objectStore('categories').put(cat);
  }
  for (const word of INITIAL_WORDS) {
    await tx.objectStore('words').put(word);
  }
  await tx.objectStore('kv').put(SEED_VERSION, 'seed_version');
  await tx.done;

  return {
    words: [...INITIAL_WORDS],
    categories: [...INITIAL_CATEGORIES],
  };
}
