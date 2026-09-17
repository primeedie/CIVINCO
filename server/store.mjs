import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function createStore(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, 'civinco.sqlite'));
  db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(collection, id));');
  const all = db.prepare('SELECT value FROM records WHERE collection = ?');
  const one = db.prepare('SELECT value FROM records WHERE collection = ? AND id = ?');
  const put = db.prepare('INSERT INTO records(collection,id,value) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET value=excluded.value');
  const remove = db.prepare('DELETE FROM records WHERE collection = ? AND id = ?');
  return {
    all: (collection) => all.all(collection).map(x => JSON.parse(x.value)),
    get: (collection, id) => { const row = one.get(collection, id); return row ? JSON.parse(row.value) : null; },
    put: (collection, value) => { put.run(collection, value.id, JSON.stringify(value)); return value; },
    remove: (collection, id) => remove.run(collection, id),
    transaction(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } },
    close: () => db.close(),
  };
}
