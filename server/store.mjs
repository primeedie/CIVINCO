import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function createStore(directory, { initialRecords = null, onChange = () => {} } = {}) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, 'civinco.sqlite'));
  db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(collection, id));');
  const all = db.prepare('SELECT value FROM records WHERE collection = ?');
  const one = db.prepare('SELECT value FROM records WHERE collection = ? AND id = ?');
  const put = db.prepare('INSERT INTO records(collection,id,value) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET value=excluded.value');
  const remove = db.prepare('DELETE FROM records WHERE collection = ? AND id = ?');
  const snapshot = db.prepare('SELECT collection, value FROM records ORDER BY collection, id');
  if (initialRecords) {
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM records');
      for (const record of initialRecords) put.run(record.collection, record.id || JSON.parse(record.value).id, typeof record.value === 'string' ? record.value : JSON.stringify(record.value));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  let transactionDepth = 0, changed = false;
  const notify = () => { if (transactionDepth) changed = true; else onChange(); };
  return {
    all: (collection) => all.all(collection).map(x => JSON.parse(x.value)),
    get: (collection, id) => { const row = one.get(collection, id); return row ? JSON.parse(row.value) : null; },
    put: (collection, value) => { put.run(collection, value.id, JSON.stringify(value)); notify(); return value; },
    remove: (collection, id) => { const result = remove.run(collection, id); if (result.changes) notify(); return result; },
    transaction(fn) { db.exec('BEGIN'); transactionDepth++; try { const result = fn(); db.exec('COMMIT'); transactionDepth--; if (!transactionDepth && changed) { changed = false; onChange(); } return result; } catch (error) { db.exec('ROLLBACK'); transactionDepth--; changed = false; throw error; } },
    snapshot: () => snapshot.all().map(row => ({ collection: row.collection, value: row.value })),
    close: () => db.close(),
  };
}
