import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseAsync, openDatabaseSync } from 'expo-sqlite';

import migrations from './migrations/migrations';
import * as schema from './schema';

const DATABASE_NAME = 'open-loops.db';

function connect() {
  // enableChangeListener lets useLiveQuery re-render screens when rows change.
  const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
  if (process.env.EXPO_OS !== 'web') {
    sqlite.execSync('PRAGMA journal_mode = WAL');
  }
  return drizzle(sqlite, { schema });
}

export type Database = ReturnType<typeof connect>;

/** Anything that can run a select: the database itself or a transaction. */
export type Reader = Pick<Database, 'select'>;

let database: Database | null = null;
let opening: Promise<void> | null = null;

/** Opens the database and applies pending migrations. Call once at startup, before rendering screens. */
export function openDatabase(): Promise<void> {
  opening ??= (async () => {
    if (process.env.EXPO_OS === 'web') {
      // On web, SQLite runs in a shared worker that loads WebAssembly first, and a
      // synchronous open before it is ready times out. An async open waits for it.
      const warmup = await openDatabaseAsync(':memory:');
      await warmup.closeAsync();
    }
    const db = connect();
    await migrate(db, migrations);
    database = db;
  })();
  return opening;
}

export function getDb(): Database {
  if (!database) throw new Error('openDatabase() must finish before the database is used');
  return database;
}
