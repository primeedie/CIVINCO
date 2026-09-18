import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const read = collection => db.prepare('SELECT value FROM records WHERE collection = ?').all(collection).map(row => JSON.parse(row.value));
const questions = read('questions'), items = read('items'), documents = new Map(read('documents').map(doc => [doc.id, doc]));
const requestedId = process.argv[2];
if (requestedId) {
  console.log(JSON.stringify(questions.find(question => question.id === requestedId) || items.find(item => item.id === requestedId) || null, null, 2));
  db.close();
  process.exit(0);
}
const figureWords = /\b(?:figure|diagram|shown|sketch|truss|frame|dam|cross[- ]section|graph|table below|illustration)\b/i;
const visualCount = question => (question.diagram?.lines?.length || 0) + (question.diagram?.arrows?.length || 0) + (question.diagram?.circles?.length || 0) + (question.diagram?.rectangles?.length || 0);
const missingFigures = questions.filter(question => figureWords.test(question.prompt || '') && !question.diagramImage && !visualCount(question));
const numericFormulas = items.filter(item => item.kind === 'formula' && /=/.test(item.latex || '') && /\d/.test(item.latex || ''));
const componentFormulas = items.filter(item => item.kind === 'formula' && /(?:component|x-axis|y-axis|z-axis|3d|equilibrium)/i.test(`${item.title} ${item.topic} ${item.conditions}`));
const figureGroups = [...new Set(questions.filter(question => question.pool && question.sourceDocId).map(question => question.sourceDocId))].map(docId => {
  const entries = questions.filter(question => question.pool && question.sourceDocId === docId).sort((a, b) => a.sourcePage - b.sourcePage);
  return { document: documents.get(docId)?.name, withImages: entries.filter(question => question.diagramImage).length, withoutImages: entries.filter(question => !question.diagramImage).length, questions: entries.map(question => ({ page: question.sourcePage, title: question.title, hasImage: Boolean(question.diagramImage), prompt: question.prompt })) };
}).filter(group => group.withImages && group.withoutImages);
console.log(JSON.stringify({
  totals: { questions: questions.length, items: items.length, missingFigures: missingFigures.length, numericFormulas: numericFormulas.length, componentFormulas: componentFormulas.length },
  missingFigures: missingFigures.map(question => ({ id: question.id, title: question.title, prompt: question.prompt, document: documents.get(question.sourceDocId)?.name, page: question.sourcePage, pool: question.pool })),
  mixedFigureGroups: figureGroups,
  componentFormulas: componentFormulas.map(item => ({ id: item.id, title: item.title, latex: item.latex, document: documents.get(item.docId)?.name, page: item.page })),
  numericFormulas: numericFormulas.slice(0, 100).map(item => ({ id: item.id, title: item.title, latex: item.latex, document: documents.get(item.docId)?.name, page: item.page })),
}, null, 2));
db.close();
