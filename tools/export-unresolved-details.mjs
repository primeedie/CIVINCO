import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite', { readOnly: true });
const read = collection => db.prepare('SELECT value FROM records WHERE collection = ?').all(collection).map(row => JSON.parse(row.value));
const documents = new Map(read('documents').map(document => [document.id, document]));
const questions = read('questions')
  .filter(question => question.pool && question.solutionQuality !== 'worked')
  .sort((a, b) => (documents.get(a.sourceDocId)?.name || '').localeCompare(documents.get(b.sourceDocId)?.name || '') || (a.sourcePage || 0) - (b.sourcePage || 0));

for (const question of questions) {
  console.log(JSON.stringify({
    id: question.id,
    document: documents.get(question.sourceDocId)?.name || 'Unknown source',
    storageName: documents.get(question.sourceDocId)?.storageName,
    page: question.sourcePage,
    title: question.title,
    topic: question.topic,
    prompt: question.prompt,
    answer: question.answer,
    unit: question.unit,
    tolerance: question.tolerance,
    steps: question.steps,
    hasFigure: Boolean(question.diagramImage?.visualAid),
  }));
}
db.close();
