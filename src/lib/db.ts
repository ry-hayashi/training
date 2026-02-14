import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  BodyPart,
  Exercise,
  WorkoutLog,
  WorkoutSet,
  Template,
  Meta,
  BackupData,
  ImportResult,
} from '@/types';

// ===== Schema =====

interface TrainingDB extends DBSchema {
  bodyParts: {
    key: string;
    value: BodyPart;
  };
  exercises: {
    key: string;
    value: Exercise;
    indexes: { 'by-bodyPart': string };
  };
  workoutLogs: {
    key: string;
    value: WorkoutLog;
    indexes: {
      'by-exercise': string;
      'by-date': string;
    };
  };
  sets: {
    key: string;
    value: WorkoutSet;
    indexes: { 'by-log': string };
  };
  templates: {
    key: number;
    value: Template;
  };
  meta: {
    key: string;
    value: Meta;
  };
}

const DB_NAME = 'training-log';
const DB_VERSION = 1;
const SCHEMA_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TrainingDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TrainingDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TrainingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // bodyParts
        if (!db.objectStoreNames.contains('bodyParts')) {
          db.createObjectStore('bodyParts', { keyPath: 'id' });
        }
        // exercises
        if (!db.objectStoreNames.contains('exercises')) {
          const store = db.createObjectStore('exercises', { keyPath: 'id' });
          store.createIndex('by-bodyPart', 'bodyPartId');
        }
        // workoutLogs
        if (!db.objectStoreNames.contains('workoutLogs')) {
          const store = db.createObjectStore('workoutLogs', { keyPath: 'id' });
          store.createIndex('by-exercise', 'exerciseId');
          store.createIndex('by-date', 'performedAtISO');
        }
        // sets
        if (!db.objectStoreNames.contains('sets')) {
          const store = db.createObjectStore('sets', { keyPath: 'id' });
          store.createIndex('by-log', 'logId');
        }
        // templates (slot 1..6)
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'slot' });
        }
        // meta
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ===== Generic CRUD =====

type StoreName = 'bodyParts' | 'exercises' | 'workoutLogs' | 'sets' | 'templates' | 'meta';

export async function getAll(store: 'bodyParts'): Promise<BodyPart[]>;
export async function getAll(store: 'exercises'): Promise<Exercise[]>;
export async function getAll(store: 'workoutLogs'): Promise<WorkoutLog[]>;
export async function getAll(store: 'sets'): Promise<WorkoutSet[]>;
export async function getAll(store: 'templates'): Promise<Template[]>;
export async function getAll(store: 'meta'): Promise<Meta[]>;
export async function getAll(store: StoreName): Promise<unknown[]> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.getAll(store as any);
}

export async function getById(store: 'bodyParts', key: string): Promise<BodyPart | undefined>;
export async function getById(store: 'exercises', key: string): Promise<Exercise | undefined>;
export async function getById(store: 'workoutLogs', key: string): Promise<WorkoutLog | undefined>;
export async function getById(store: 'sets', key: string): Promise<WorkoutSet | undefined>;
export async function getById(store: 'templates', key: number): Promise<Template | undefined>;
export async function getById(store: 'meta', key: string): Promise<Meta | undefined>;
export async function getById(store: StoreName, key: string | number): Promise<unknown | undefined> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.get(store as any, key as any);
}

export async function put(store: 'bodyParts', value: BodyPart): Promise<string>;
export async function put(store: 'exercises', value: Exercise): Promise<string>;
export async function put(store: 'workoutLogs', value: WorkoutLog): Promise<string>;
export async function put(store: 'sets', value: WorkoutSet): Promise<string>;
export async function put(store: 'templates', value: Template): Promise<number>;
export async function put(store: 'meta', value: Meta): Promise<string>;
export async function put(store: StoreName, value: unknown): Promise<unknown> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.put(store as any, value as any);
}

export async function deleteRecord(store: StoreName, key: string | number): Promise<void> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.delete(store as any, key as any);
}

// ===== Index queries =====

export async function getExercisesByBodyPart(bodyPartId: string): Promise<Exercise[]> {
  const db = await getDB();
  return db.getAllFromIndex('exercises', 'by-bodyPart', bodyPartId);
}

export async function getLogsByExercise(exerciseId: string): Promise<WorkoutLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('workoutLogs', 'by-exercise', exerciseId);
}

export async function getSetsByLog(logId: string): Promise<WorkoutSet[]> {
  const db = await getDB();
  return db.getAllFromIndex('sets', 'by-log', logId);
}

// ===== Meta helpers =====

export async function getMeta(key: string): Promise<unknown | undefined> {
  const db = await getDB();
  const m = await db.get('meta', key);
  return m?.value;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, value });
}

// ===== Seed default data =====

export async function seedDefaults(): Promise<void> {
  const db = await getDB();
  const existing = await db.count('bodyParts');
  if (existing > 0) return;

  const { v4 } = await import('uuid');

  const parts: BodyPart[] = [
    { id: v4(), name: '胸' },
    { id: v4(), name: '背中' },
    { id: v4(), name: '肩' },
    { id: v4(), name: '腕' },
    { id: v4(), name: '脚' },
    { id: v4(), name: '腹' },
  ];

  const tx = db.transaction(['bodyParts', 'templates', 'meta'], 'readwrite');
  for (const p of parts) {
    await tx.objectStore('bodyParts').put(p);
  }
  // Initialize 6 template slots
  for (let i = 1; i <= 6; i++) {
    await tx.objectStore('templates').put({ slot: i, name: '', exerciseIds: [] });
  }
  await tx.objectStore('meta').put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  await tx.done;
}

// ===== Export =====

export async function exportAll(): Promise<BackupData> {
  const [bodyParts, exercises, workoutLogs, sets, templates, meta] = await Promise.all([
    getAll('bodyParts'),
    getAll('exercises'),
    getAll('workoutLogs'),
    getAll('sets'),
    getAll('templates'),
    getAll('meta'),
  ]);

  const now = new Date().toISOString();
  await setMeta('lastBackupAt', now);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    data: { bodyParts, exercises, workoutLogs, sets, templates, meta },
  };
}

// ===== Import (MERGE-ONLY) =====

export async function importMerge(backup: BackupData): Promise<ImportResult> {
  const db = await getDB();
  const result: ImportResult = {
    added: { bodyParts: 0, exercises: 0, workoutLogs: 0, sets: 0, templates: 0, meta: 0 },
    skipped: { bodyParts: 0, exercises: 0, workoutLogs: 0, sets: 0, templates: 0, meta: 0 },
  };

  const tx = db.transaction(
    ['bodyParts', 'exercises', 'workoutLogs', 'sets', 'templates', 'meta'],
    'readwrite'
  );

  // Helper: add if not exists
  async function mergeStore<T extends 'bodyParts' | 'exercises' | 'workoutLogs' | 'sets'>(
    storeName: T,
    items: TrainingDB[T]['value'][]
  ) {
    const store = tx.objectStore(storeName);
    for (const item of items) {
      const key = (item as Record<string, unknown>).id as TrainingDB[T]['key'];
      const existing = await store.get(key);
      if (!existing) {
        await store.put(item);
        result.added[storeName]++;
      } else {
        result.skipped[storeName]++;
      }
    }
  }

  await mergeStore('bodyParts', backup.data.bodyParts || []);
  await mergeStore('exercises', backup.data.exercises || []);
  await mergeStore('workoutLogs', backup.data.workoutLogs || []);
  await mergeStore('sets', backup.data.sets || []);

  // Templates: merge by slot
  const tplStore = tx.objectStore('templates');
  for (const tpl of backup.data.templates || []) {
    const existing = await tplStore.get(tpl.slot);
    if (!existing || (!existing.name && existing.exerciseIds.length === 0)) {
      await tplStore.put(tpl);
      result.added.templates++;
    } else {
      result.skipped.templates++;
    }
  }

  // Meta: merge by key
  const metaStore = tx.objectStore('meta');
  for (const m of backup.data.meta || []) {
    const existing = await metaStore.get(m.key);
    if (!existing) {
      await metaStore.put(m);
      result.added.meta++;
    } else {
      result.skipped.meta++;
    }
  }

  await tx.done;
  return result;
}
