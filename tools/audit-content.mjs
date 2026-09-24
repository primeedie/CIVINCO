import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { createCloudPersistence } from '../server/cloud.mjs';
import { validLatex } from '../server/domain.mjs';

let db = null, records = null;
if (existsSync('data/civinco.sqlite')) db = new DatabaseSync('data/civinco.sqlite');
else {
  const cloud = createCloudPersistence({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, bucket: process.env.SUPABASE_BUCKET || 'civinco-private' });
  records = await cloud.loadRecords();
  if (!records) throw new Error('No local database or Supabase snapshot is available.');
}
const read = collection => db ? db.prepare('SELECT value FROM records WHERE collection = ?').all(collection).map(row => JSON.parse(row.value)) : records.filter(record => record.collection === collection).map(record => typeof record.value === 'string' ? JSON.parse(record.value) : record.value);
const questions = read('questions'), items = read('items'), reports = read('reports'), documents = new Map(read('documents').map(doc => [doc.id, doc]));
const requestedId = process.argv.slice(2).find(argument => !argument.startsWith('--'));
if (requestedId) {
  console.log(JSON.stringify(questions.find(question => question.id === requestedId) || items.find(item => item.id === requestedId) || null, null, 2));
  db?.close();
  process.exit(0);
}
const figureWords = /\b(?:figure|diagram|shown|sketch|truss|frame|dam|cross[- ]section|graph|table below|illustration)\b/i;
const visualCount = question => (question.diagram?.lines?.length || 0) + (question.diagram?.arrows?.length || 0) + (question.diagram?.circles?.length || 0) + (question.diagram?.rectangles?.length || 0);
const missingFigures = questions.filter(question => figureWords.test(question.prompt || '') && !question.diagramImage?.visualAid && !visualCount(question));
const numericFormulas = items.filter(item => item.kind === 'formula' && /=/.test(item.latex || '') && /\d/.test(item.latex || ''));
const formulas = items.filter(item => item.kind === 'formula');
const invalidFormulas = formulas.filter(item => !validLatex(item.latex || ''));
const invalidSolutionSteps = questions.flatMap(question => (question.steps || []).filter(step => step.latex && !validLatex(step.latex)).map(step => ({ question, latex: step.latex })));
const unresolvedSolutions = questions.filter(question => question.pool && question.solutionQuality !== 'worked');
const componentFormulas = items.filter(item => item.kind === 'formula' && /(?:component|x-axis|y-axis|z-axis|3d|equilibrium)/i.test(`${item.title} ${item.topic} ${item.conditions}`));
const figureGroups = [...new Set(questions.filter(question => question.pool && question.sourceDocId).map(question => question.sourceDocId))].map(docId => {
  const entries = questions.filter(question => question.pool && question.sourceDocId === docId).sort((a, b) => a.sourcePage - b.sourcePage);
  return { document: documents.get(docId)?.name, withImages: entries.filter(question => question.diagramImage?.visualAid).length, withoutImages: entries.filter(question => !question.diagramImage?.visualAid).length, questions: entries.map(question => ({ page: question.sourcePage, title: question.title, hasImage: Boolean(question.diagramImage?.visualAid), prompt: question.prompt })) };
}).filter(group => group.withImages && group.withoutImages);
const audit = {
  totals: { questions: questions.length, items: items.length, formulas: formulas.length, missingFigures: missingFigures.length, invalidFormulas: invalidFormulas.length, invalidSolutionSteps: invalidSolutionSteps.length, uncertainFormulas: formulas.filter(item => item.uncertain).length, unreviewedFormulas: formulas.filter(item => !item.reviewed).length, numericFormulas: numericFormulas.length, componentFormulas: componentFormulas.length, unresolvedSolutions: unresolvedSolutions.length, openReports: reports.filter(report => report.status === 'open').length },
  missingFigures: missingFigures.map(question => ({ id: question.id, title: question.title, prompt: question.prompt, document: documents.get(question.sourceDocId)?.name, page: question.sourcePage, pool: question.pool })),
  mixedFigureGroups: figureGroups,
  componentFormulas: componentFormulas.map(item => ({ id: item.id, title: item.title, latex: item.latex, document: documents.get(item.docId)?.name, page: item.page })),
  numericFormulas: numericFormulas.slice(0, 100).map(item => ({ id: item.id, title: item.title, latex: item.latex, document: documents.get(item.docId)?.name, page: item.page })),
  unresolvedSolutions: unresolvedSolutions.map(question => ({ id: question.id, title: question.title, topic: question.topic, quality: question.solutionQuality || 'unspecified', document: documents.get(question.sourceDocId)?.name, page: question.sourcePage })),
  invalidSolutionSteps: invalidSolutionSteps.map(({ question, latex }) => ({ id: question.id, title: question.title, latex })),
};
const unresolvedSummary = Object.values(unresolvedSolutions.reduce((groups, question) => {
  const document = documents.get(question.sourceDocId)?.name || 'Unknown source';
  const quality = question.solutionQuality || 'unspecified';
  const key = `${document}\u0000${quality}`;
  groups[key] ||= { document, quality, count: 0 };
  groups[key].count += 1;
  return groups;
}, {})).sort((a, b) => b.count - a.count || a.document.localeCompare(b.document));
console.log(JSON.stringify(process.argv.includes('--summary') ? audit.totals : process.argv.includes('--unresolved-summary') ? unresolvedSummary : process.argv.includes('--unresolved') ? audit.unresolvedSolutions : audit, null, 2));
db?.close();
