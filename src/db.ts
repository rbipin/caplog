import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function initDB(): Promise<void> {
  db = await Database.load('sqlite:daylog.db');
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!db) throw new Error('DB not initialized');
  return db.select(sql, params) as Promise<T[]>;
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  if (!db) throw new Error('DB not initialized');
  await db.execute(sql, params);
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await query<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}
