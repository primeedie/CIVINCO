import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/civinco.sqlite');
const rows = db.prepare("SELECT id, value FROM records WHERE collection = 'questions'").all();
const put = db.prepare("UPDATE records SET value = ? WHERE collection = 'questions' AND id = ?");
const missingFigure = /as shown|in the figure|same footing|same beam|same column/i;
let changed = 0;
db.exec('BEGIN');
try {
  for (const row of rows) {
    const question = JSON.parse(row.value);
    if (!question.pool || (question.solutionQuality !== 'answer-key' && !question.steps?.some(step => /supplied answer key|imported answer key/i.test(step.text || '')))) continue;
    const issue = missingFigure.test(question.prompt)
      ? 'This item depends on geometry or givens from a figure or preceding question that are incomplete in the imported record.'
      : 'The imported wording and expected result are internally inconsistent, so a reliable derivation cannot be shown without inventing an assumption.';
    question.steps = [{ text: `${issue} Open the connected source and verify the missing context before treating the expected result as authoritative.`, latex: '' }];
    question.solutionQuality = 'source';
    put.run(JSON.stringify(question), row.id); changed++;
  }
  const current = new Map(db.prepare("SELECT id, value FROM records WHERE collection = 'questions'").all().map(row => [row.id, JSON.parse(row.value)]));
  for (const row of rows) {
    const question = JSON.parse(row.value);
    if (question.pool || !question.sourceBankQuestionId) continue;
    const source = current.get(question.sourceBankQuestionId);
    if (!source) continue;
    question.steps = source.steps;
    question.solutionQuality = source.solutionQuality;
    put.run(JSON.stringify(question), row.id);
  }
  db.exec('COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
console.log(`Marked ${changed} unresolved source items for review.`);
