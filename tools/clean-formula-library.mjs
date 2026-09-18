import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const all = collection => db.prepare('SELECT id, value FROM records WHERE collection = ?').all(collection);
const put = db.prepare('UPDATE records SET value = ? WHERE collection = ? AND id = ?');
const remove = db.prepare('DELETE FROM records WHERE collection = ? AND id = ?');
const deleted = new Set();
let trimmed = 0;

const meaningfulVariables = expression => {
  const withoutUnits = expression
    .replace(/\\text\s*\{[^}]*\}/g, '')
    .replace(/\\mathrm\s*\{[^}]*\}/g, '')
    .replace(/\\(?:frac|sqrt|times|cdot|left|right|quad|le|ge|approx|circ|sum|implies)\b/g, '');
  return /[A-Za-z](?:_[{A-Za-z]|\b)/.test(withoutUnits);
};

db.exec('BEGIN');
try {
  for (const row of all('items')) {
    const item = JSON.parse(row.value);
    if (item.kind !== 'formula') continue;
    const parts = String(item.latex || '').split(/\s*(?:=|\\implies)\s*/);
    const numericalResult = parts.length > 2 || (parts.length === 2 && !meaningfulVariables(parts[1]) && /\d/.test(parts[1]));
    const workedTitle = /(?:properties|given|calculated|solved|evaluation|substitut|total .*load|component equation|equilibrium equation along)/i.test(item.title);
    if (item.equationScope !== 'case-specific' && !numericalResult && !workedTitle) continue;
    const reusable = parts.length >= 2 && meaningfulVariables(parts[1]) && !workedTitle;
    if (!reusable) { remove.run('items', row.id); deleted.add(row.id); continue; }
    item.latex = `${parts[0].trim()} = ${parts[1].trim()}`;
    item.equationScope = 'general';
    item.note = String(item.note || '').replace(/Case-specific representation:[\s\S]*?(?=(?:\s[A-Z][a-z]+:)|$)/i, '').trim();
    item.title = item.title.replace(/\s+(?:Calculation|Evaluation|Substitution)(?:\s+.*)?$/i, '').trim();
    put.run(JSON.stringify(item), 'items', row.id); trimmed++;
  }
  for (const row of all('reviews')) {
    const review = JSON.parse(row.value);
    if (deleted.has(review.itemId)) remove.run('reviews', row.id);
  }
  db.exec('COMMIT');
  console.log(`Removed ${deleted.size} worked-example entries and reduced ${trimmed} entries to reusable symbolic formulas.`);
} catch (error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
