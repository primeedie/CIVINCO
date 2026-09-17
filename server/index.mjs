import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createStore } from './store.mjs';
import { createAI } from './ai.mjs';
import { categorySchema, formulaSchema, gradeAnswer, reviewSchedule, publicQuestion, validLatex } from './domain.mjs';
import { addSamples, sampleQuestions } from './samples.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.CIVINCO_DATA_DIR || path.join(root, 'data'));
const uploadDir = path.join(dataDir, 'uploads');
mkdirSync(uploadDir, { recursive: true });
const store = createStore(dataDir);
const settings = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
};
const ai = createAI(settings);
const app = express();
const port = Number(process.env.PORT || 4173);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  // This is a local personal app. Reject cross-origin writes and DNS rebinding.
  const hostname = req.hostname;
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname)) return res.status(403).json({ error: 'Local access only.' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return res.status(403).json({ error: 'Cross-origin writes are not allowed.' });
  next();
});
app.use(express.json({ limit: '2mb' }));
const upload = multer({ dest: uploadDir, limits: { fileSize: 100 * 1024 * 1024, files: 20 } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const getDoc = id => { const doc = store.get('documents', id); if (!doc) throw fail('File not found.', 404); return doc; };
const getItem = id => { const item = store.get('items', id); if (!item) throw fail('Entry not found.', 404); return item; };
const getQuestion = id => { const q = store.get('questions', id); if (!q) throw fail('Question not found.', 404); return q; };
const sanitizedDoc = ({ storageName, ...doc }) => doc;
const publicSettings = () => ({ connected: Boolean(settings.geminiApiKey), model: settings.model });
const safeError = error => error?.status === 401 || error?.status === 403 ? 'The Gemini API key was rejected or lacks access to this model. Update it in AI settings.' : error?.status === 429 ? 'Gemini is rate-limited or out of quota. Check billing, then retry.' : error?.status === 503 ? 'Gemini is temporarily busy. Wait a moment, then retry.' : String(error?.message || 'Request failed.').replace(/(?:AIza[\w-]+|AQ\.[\w-]+)/g, '[redacted]').slice(0, 700);
const updateDoc = (id, changes) => store.put('documents', { ...getDoc(id), ...changes });

// Interrupted work is resumable; completed page results remain intact.
for (const doc of store.all('documents')) if (['extracting', 'queued'].includes(doc.status)) updateDoc(doc.id, { status: 'paused', error: 'Extraction was interrupted. Resume to continue.' });
for (const page of store.all('pages')) if (page.status === 'extracting') store.put('pages', { ...page, status: 'pending' });

app.get('/api/state', (_req, res) => {
  res.json({
    documents: store.all('documents').map(sanitizedDoc),
    pages: store.all('pages').map(({ text, ...p }) => p), items: store.all('items'),
    questions: store.all('questions').map(publicQuestion), attempts: store.all('attempts'), reviews: store.all('reviews'),
    settings: publicSettings(),
  });
});
app.post('/api/samples', (_req, res) => { addSamples(store); res.json({ ok: true }); });
app.put('/api/settings', async (req, res) => {
  const input = z.object({ apiKey: z.string().max(500).optional(), model: z.string().min(1).max(100) }).parse(req.body);
  if (input.apiKey !== undefined && input.apiKey.trim()) settings.geminiApiKey = input.apiKey.trim();
  settings.model = input.model.trim();
  res.json(publicSettings());
});
app.post('/api/settings/test', async (_req, res) => { await ai.test(); res.json({ ok: true }); });

app.post('/api/documents', upload.array('files', 20), async (req, res) => {
  const files = req.files || [];
  const accepted = [], errors = [];
  const autoCategorize = req.body.autoCategorize === 'true';
  let category;
  try { category = autoCategorize ? { spex: 'A', set: 1 } : categorySchema.parse(req.body); }
  catch (error) { await Promise.all(files.map(f => unlink(f.path).catch(() => {}))); throw error; }
  if (!files.length) throw fail('Choose at least one file.');
  const kind = ['Module', 'Book', 'Notes', 'Exam'].includes(req.body.kind) ? req.body.kind : 'Module';
  for (const file of files) {
    try {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.md'].includes(ext)) throw fail('Supported formats: PDF, PNG, JPG, TXT, MD. Export other documents as PDF to preserve equations.');
      const bytes = await readFile(file.path);
      let totalPages = 1, chunks = [];
      if (ext === '.pdf') {
        if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw fail('This file is not a valid PDF.');
        const pdf = await PDFDocument.load(bytes);
        totalPages = pdf.getPageCount();
        if (!totalPages) throw fail('The PDF has no pages.');
      } else if (ext === '.png') {
        if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw fail('Invalid PNG file.');
      } else if (['.jpg', '.jpeg'].includes(ext)) {
        if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw fail('Invalid JPEG file.');
      } else {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (!text.trim()) throw fail('The text file is empty.');
        // Every character is included. Boundaries prefer newlines; no silent truncation.
        for (let offset = 0; offset < text.length;) {
          let end = Math.min(offset + 12000, text.length);
          if (end < text.length) { const newline = text.lastIndexOf('\n', end); if (newline > offset + 6000) end = newline + 1; }
          chunks.push(text.slice(offset, end)); offset = end;
        }
        totalPages = chunks.length;
      }
      const id = randomUUID();
      const doc = { id, name: file.originalname, ...category, autoCategorize, categoryDetected: !autoCategorize, kind, sample: false, size: file.size, totalPages, extension: ext, storageName: file.filename, status: 'stored', createdAt: new Date().toISOString(), error: '' };
      store.transaction(() => {
        store.put('documents', doc);
        for (let page = 1; page <= totalPages; page++) store.put('pages', { id: `${id}:${page}`, docId: id, page, status: 'pending', reviewed: false, warnings: [], error: '', ...(chunks.length ? { text: chunks[page - 1] } : {}) });
      });
      accepted.push(sanitizedDoc(doc));
    } catch (error) { errors.push({ name: file.originalname, error: safeError(error) }); await unlink(file.path).catch(() => {}); }
  }
  res.status(accepted.length ? 201 : 400).json({ accepted, errors, ...(!accepted.length ? { error: errors.map(e => `${e.name}: ${e.error}`).join('\n') } : {}) });
});

app.get('/api/documents/:id/source', async (req, res) => {
  const doc = getDoc(req.params.id);
  if (doc.sample) throw fail('Starter references have no uploaded source.', 404);
  const mime = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain', '.md': 'text/plain' }[doc.extension];
  res.type(mime).sendFile(path.join(uploadDir, doc.storageName));
});
app.patch('/api/documents/:id', (req, res) => {
  const doc = getDoc(req.params.id), category = categorySchema.parse(req.body);
  if (activeDoc === doc.id || ['extracting', 'queued'].includes(doc.status)) throw fail('Pause extraction and let the current page finish before changing the category.', 409);
  store.transaction(() => {
    updateDoc(doc.id, { ...category, autoCategorize: false, categoryDetected: true, categoryConfidence: 'manual', categoryReason: 'Set manually.' });
    for (const item of store.all('items').filter(i => i.docId === doc.id)) store.put('items', { ...item, ...category });
    // Keep existing questions and historical attempts in their original study scope.
  });
  res.json({ ok: true });
});
app.delete('/api/documents/:id', async (req, res) => {
  const doc = getDoc(req.params.id);
  if (['extracting', 'queued'].includes(doc.status)) throw fail('Pause extraction and wait for the current page before removing this file.', 409);
  if (activeDoc === doc.id) throw fail('The current page is finishing. Try removing this file shortly.', 409);
  store.transaction(() => {
    const itemIds = new Set(store.all('items').filter(i => i.docId === doc.id).map(i => i.id));
    const qIds = new Set(store.all('questions').filter(q => q.sourceIds.some(id => itemIds.has(id))).map(q => q.id));
    for (const [collection, predicate] of [['pages', p => p.docId === doc.id], ['items', i => itemIds.has(i.id)], ['questions', q => qIds.has(q.id)], ['attempts', a => qIds.has(a.questionId)], ['reviews', r => itemIds.has(r.itemId)]]) {
      for (const record of store.all(collection).filter(predicate)) store.remove(collection, record.id);
    }
    store.remove('documents', doc.id);
  });
  if (doc.storageName) await unlink(path.join(uploadDir, doc.storageName)).catch(() => {});
  res.json({ ok: true });
});

const queue = [];
let running = false, activeDoc = null;
const unfinished = id => store.all('pages').some(p => p.docId === id && p.status !== 'extracted');
function enqueueDocument(id) {
  const doc = getDoc(id);
  if (doc.sample || activeDoc === id || ['extracting', 'queued'].includes(doc.status) || queue.includes(id) || !unfinished(id)) return false;
  updateDoc(id, { status: 'queued', error: '' });
  queue.push(id);
  return true;
}
async function processQueue() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const id = queue.shift();
      const pendingDoc = store.get('documents', id);
      if (!pendingDoc || pendingDoc.status === 'paused') continue;
      activeDoc = id;
      updateDoc(id, { status: 'extracting', error: '' });
      try {
        let doc = getDoc(id);
        const bytes = await readFile(path.join(uploadDir, doc.storageName));
        const pdf = doc.extension === '.pdf' ? await PDFDocument.load(bytes) : null;
        const pages = store.all('pages').filter(p => p.docId === id && p.status !== 'extracted').sort((a, b) => a.page - b.page);
        for (const page of pages) {
          if (getDoc(id).status === 'paused') break;
          store.put('pages', { ...page, status: 'extracting', error: '' });
          try {
            let content;
            if (pdf) {
              const single = await PDFDocument.create();
              const [copy] = await single.copyPages(pdf, [page.page - 1]); single.addPage(copy);
              const encoded = Buffer.from(await single.save()).toString('base64');
              content = [{ type: 'input_file', filename: `page-${page.page}.pdf`, file_data: `data:application/pdf;base64,${encoded}` }];
            } else if (page.text !== undefined) content = [{ type: 'input_text', text: page.text }];
            else content = [{ type: 'input_image', image_url: `data:${doc.extension === '.png' ? 'image/png' : 'image/jpeg'};base64,${bytes.toString('base64')}`, detail: 'high' }];
            const shouldClassify = Boolean(doc.autoCategorize && !doc.categoryDetected && page.page === 1);
            const result = await ai.extract(content, `Source: ${doc.name}; current category SPEX ${doc.spex}, Set ${doc.set}; original page / text section ${page.page} of ${doc.totalPages}.`, shouldClassify);
            if (result.classification) {
              const category = { spex: result.classification.spex, set: result.classification.set };
              updateDoc(id, { ...category, categoryDetected: true, categoryConfidence: result.classification.confidence, categoryReason: result.classification.reason });
              doc = getDoc(id);
            }
            store.transaction(() => {
              for (const kind of ['formula', 'concept']) for (const entry of result[kind === 'formula' ? 'formulas' : 'concepts']) {
                store.put('items', { ...entry, id: randomUUID(), docId: id, page: page.page, spex: doc.spex, set: doc.set, kind, reviewed: false, sample: false });
              }
              store.put('pages', { ...page, status: 'extracted', reviewed: false, warnings: result.warnings, error: '' });
            });
          } catch (error) {
            store.put('pages', { ...page, status: 'failed', error: safeError(error) });
            if ([429, 503].includes(error?.status)) { updateDoc(id, { status: 'paused', error: safeError(error) }); break; }
          }
        }
        if (getDoc(id).status !== 'paused') {
          const failed = store.all('pages').filter(p => p.docId === id && p.status === 'failed').length;
          updateDoc(id, { status: failed ? 'partial' : 'extracted', error: failed ? `${failed} page(s) failed. Retry to process only unfinished pages.` : '' });
        }
      } catch (error) { updateDoc(id, { status: 'error', error: safeError(error) }); }
      activeDoc = null;
    }
  } finally { activeDoc = null; running = false; }
}
app.post('/api/documents/:id/extract', (req, res) => {
  const doc = getDoc(req.params.id);
  if (doc.sample) throw fail('Starter references do not need extraction.');
  if (!settings.geminiApiKey) throw fail('Add a Gemini API key in AI settings to extract your files.', 409);
  if (activeDoc === doc.id || ['extracting', 'queued'].includes(doc.status)) throw fail('This file is already in the extraction queue.', 409);
  if (!store.all('pages').some(p => p.docId === doc.id && p.status !== 'extracted')) throw fail('Every page has already been extracted. Review the page inventory.');
  enqueueDocument(doc.id); void processQueue(); res.status(202).json({ ok: true });
});
app.post('/api/documents/extract-all', (_req, res) => {
  if (!settings.geminiApiKey) throw fail('Add a Gemini API key in AI settings to extract your files.', 409);
  const documents = store.all('documents').filter(doc => !doc.sample);
  const queued = documents.filter(doc => enqueueDocument(doc.id)).length;
  void processQueue();
  res.status(202).json({ queued, skipped: documents.length - queued });
});
app.post('/api/documents/:id/pause', (req, res) => {
  updateDoc(req.params.id, { status: 'paused' });
  for (let index = queue.length - 1; index >= 0; index--) if (queue[index] === req.params.id) queue.splice(index, 1);
  res.json({ ok: true });
});
app.post('/api/documents/:id/pages/:page/review', (req, res) => {
  const page = store.get('pages', `${req.params.id}:${req.params.page}`);
  if (!page || page.status !== 'extracted') throw fail('Extract this page before marking it reviewed.');
  if (store.all('items').some(i => i.docId === page.docId && i.page === page.page && i.kind === 'formula' && (!i.reviewed || i.uncertain))) throw fail('Check and approve every formula on this page first.');
  store.put('pages', { ...page, reviewed: true }); res.json({ ok: true });
});
app.put('/api/items/:id', (req, res) => {
  const item = getItem(req.params.id);
  if (item.kind !== 'formula') throw fail('Only formulas can be edited here.');
  const input = formulaSchema.extend({ reviewed: z.boolean() }).parse(req.body);
  if (!validLatex(input.latex) || input.variables.some(v => !validLatex(v.symbol))) throw fail('Correct the LaTeX notation before saving.');
  if (input.reviewed && input.uncertain) throw fail('Resolve the uncertainty before approving this formula.');
  store.transaction(() => {
    store.put('items', { ...item, ...input });
    const page = store.get('pages', `${item.docId}:${item.page}`);
    if (page) store.put('pages', { ...page, reviewed: false });
  });
  res.json({ ok: true });
});
app.post('/api/items', (req, res) => {
  const input = formulaSchema.extend({ docId: z.string(), page: z.number().int().min(1), reviewed: z.boolean() }).parse(req.body);
  const doc = getDoc(input.docId);
  if (input.page > doc.totalPages) throw fail('Choose a page within this source.');
  if (!validLatex(input.latex) || input.variables.some(v => !validLatex(v.symbol))) throw fail('Correct the LaTeX notation before saving.');
  if (input.reviewed && input.uncertain) throw fail('Resolve the uncertainty before approving this formula.');
  store.put('items', { ...input, id: randomUUID(), spex: doc.spex, set: doc.set, kind: 'formula', sample: doc.sample });
  const page = store.get('pages', `${doc.id}:${input.page}`);
  if (page) store.put('pages', { ...page, reviewed: false });
  res.status(201).json({ ok: true });
});

let generating = false;
app.post('/api/questions/generate', async (req, res) => {
  const input = categorySchema.extend({ mode: z.enum(['ai', 'sample']), count: z.number().int().min(1).max(10), difficulty: z.enum(['Foundation', 'Board-level', 'Challenge']) }).parse(req.body);
  if (generating) throw fail('A question set is already being generated. Please wait.', 409);
  const candidates = store.all('items').filter(i => i.spex === input.spex && i.set === input.set && (input.mode === 'sample' ? i.sample : !i.sample) && (i.kind !== 'formula' || (i.reviewed && !i.uncertain && validLatex(i.latex))));
  if (!candidates.length) throw fail(input.mode === 'sample' ? 'Add starter references from Home first, and choose Set 1.' : 'Extract files and approve formulas in this SPEX and Set first.');
  generating = true;
  try {
    let questions;
    if (input.mode === 'sample') questions = sampleQuestions(candidates, input.count);
    else {
      // Rotate a bounded source selection for generation; extraction itself is never truncated.
      const selected = [...candidates].sort(() => Math.random() - 0.5).slice(0, 30);
      const result = await ai.generate(selected, input.count, input.difficulty);
      questions = result.map(q => ({ ...q, id: randomUUID(), spex: input.spex, set: input.set, mode: 'ai', createdAt: new Date().toISOString() }));
    }
    if (!questions.length) throw fail('No suitable numerical practice templates were found.');
    if (questions.some(q => q.sourceIds.some(id => { const item = store.get('items', id); return !item || item.spex !== input.spex || item.set !== input.set; }))) throw fail('A source was removed or recategorized while generating. Generate a fresh set from the current materials.', 409);
    store.transaction(() => questions.forEach(q => store.put('questions', q)));
    res.json({ questions: questions.map(publicQuestion) });
  } finally { generating = false; }
});
app.post('/api/questions/:id/answer', (req, res) => {
  const q = getQuestion(req.params.id);
  const { answer } = z.object({ answer: z.string().max(100) }).parse(req.body);
  const graded = gradeAnswer(answer, q.answer, q.tolerance);
  const existing = store.all('attempts').find(a => a.questionId === q.id);
  if (!existing) store.put('attempts', { id: randomUUID(), questionId: q.id, spex: q.spex, set: q.set, topic: q.topic, correct: graded.correct, answer: graded.numeric, revealed: false, createdAt: new Date().toISOString() });
  res.json({ ...graded, expected: q.answer, tolerance: q.tolerance, unit: q.unit, steps: q.steps, firstAttempt: !existing });
});
app.post('/api/questions/:id/solution', (req, res) => {
  const q = getQuestion(req.params.id);
  if (!store.all('attempts').some(a => a.questionId === q.id)) store.put('attempts', { id: randomUUID(), questionId: q.id, spex: q.spex, set: q.set, topic: q.topic, correct: false, answer: null, revealed: true, createdAt: new Date().toISOString() });
  res.json({ expected: q.answer, tolerance: q.tolerance, unit: q.unit, steps: q.steps, revealed: true });
});
app.post('/api/reviews', (req, res) => {
  const { itemId, rating } = z.object({ itemId: z.string(), rating: z.enum(['again', 'hard', 'good', 'easy']) }).parse(req.body);
  const item = getItem(itemId), previous = store.get('reviews', itemId);
  store.put('reviews', { id: itemId, itemId, spex: item.spex, set: item.set, topic: item.topic, ...reviewSchedule(previous, rating), count: (previous?.count || 0) + 1, lastReviewedAt: new Date().toISOString() });
  res.json({ ok: true });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 100 MB or smaller.' : error.message });
  res.status(error.status && error.status >= 400 && error.status < 600 ? error.status : 500).json({ error: safeError(error) });
});
if (process.argv.includes('--production')) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const server = app.listen(port, '127.0.0.1', () => console.log(`CIVINCO for Milch is ready at http://localhost:${port}`));
server.requestTimeout = 600_000;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); store.close(); process.exit(0); });
