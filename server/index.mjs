import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createStore } from './store.mjs';
import { createAI } from './ai.mjs';
import { createAccess } from './access.mjs';
import { createCloudPersistence } from './cloud.mjs';
import { categorySchema, formulaSchema, gradeAnswer, hasRequiredVisual, problemBankSchema, reviewSchedule, publicQuestion, validLatex, webSourceSchema } from './domain.mjs';
import { addSamples, sampleQuestions } from './samples.mjs';
import { offlineVariants } from './variants.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.CIVINCO_DATA_DIR || path.join(root, 'data'));
const uploadDir = path.join(dataDir, 'uploads');
mkdirSync(uploadDir, { recursive: true });
const cloud = createCloudPersistence({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, bucket: process.env.SUPABASE_BUCKET || 'civinco-private' });
const cloudRecords = await cloud.loadRecords();
let store;
store = createStore(dataDir, { initialRecords: cloudRecords, onChange: () => cloud.schedule() });
cloud.connect(() => store.snapshot());
const localSettings = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
};
const app = express();
const port = Number(process.env.PORT || 4173);
const access = createAccess({ password: process.env.CIVINCO_ACCESS_PASSWORD || '', secret: process.env.CIVINCO_SESSION_SECRET || '', production: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) });
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  // Local mode rejects DNS rebinding; hosted platforms provide their own public hostname.
  if (!process.env.VERCEL && !process.env.RENDER && !process.env.CIVINCO_PUBLIC_HOST && !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(req.hostname)) return res.status(403).json({ error: 'Local access only.' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin writes are not allowed.' }); }
    catch { return res.status(403).json({ error: 'Cross-origin writes are not allowed.' }); }
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
app.get('/api/access/status', (req, res) => res.json({ locked: access.enabled && !access.status(req) }));
app.get('/api/health', (_req, res) => res.json({ ok: true, persistence: cloud.enabled ? 'supabase' : 'local' }));
app.post('/api/access/unlock', (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
  const session = access.unlock(req, password);
  if (session.cookie) res.setHeader('Set-Cookie', session.cookie);
  res.json({ ok: true });
});
app.post('/api/access/logout', (req, res) => { res.setHeader('Set-Cookie', [access.clearCookie(req), access.clearPrivateCookie(req, 'civinco_ai')]); res.json({ ok: true }); });
app.use('/api', (req, res, next) => access.middleware(req, res, next));
const upload = multer({ dest: uploadDir, limits: { fileSize: 50 * 1024 * 1024, files: 20 } });
async function readAsset(storageName) {
  try { return await readFile(path.join(uploadDir, storageName)); }
  catch (error) {
    if (error.code !== 'ENOENT' || !cloud.enabled) throw error;
    const bytes = await cloud.getAsset(storageName);
    if (!bytes) throw fail('Stored file not found.', 404);
    await writeFile(path.join(uploadDir, storageName), bytes);
    return bytes;
  }
}
async function saveAsset(storageName, bytes, mime = 'application/octet-stream') {
  await writeFile(path.join(uploadDir, storageName), bytes);
  await cloud.putAsset(storageName, bytes, mime);
}
async function removeAssets(names) {
  await Promise.all(names.filter(Boolean).map(name => unlink(path.join(uploadDir, name)).catch(() => {})));
  await cloud.removeAssets(names.filter(Boolean));
}
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const getDoc = id => { const doc = store.get('documents', id); if (!doc) throw fail('File not found.', 404); return doc; };
const getItem = id => { const item = store.get('items', id); if (!item) throw fail('Entry not found.', 404); return item; };
const getQuestion = id => { const q = store.get('questions', id); if (!q) throw fail('Question not found.', 404); return q; };
const visibleDoc = (doc, req) => !doc.ownerId || doc.ownerId === req.deviceId;
const editableDoc = (doc, req) => !access.enabled || doc.ownerId === req.deviceId;
const requireVisibleDoc = (id, req) => { const doc = getDoc(id); if (!visibleDoc(doc, req)) throw fail('File not found.', 404); return doc; };
const requireEditableDoc = (id, req) => { const doc = requireVisibleDoc(id, req); if (!editableDoc(doc, req)) throw fail('Shared course materials are read-only.', 403); return doc; };
const requireVisibleItem = (id, req) => { const item = getItem(id); requireVisibleDoc(item.docId, req); return item; };
const requireEditableItem = (id, req) => { const item = requireVisibleItem(id, req); requireEditableDoc(item.docId, req); return item; };
const requireVisibleQuestion = (id, req) => { const question = getQuestion(id); if (question.ownerId && question.ownerId !== req.deviceId) throw fail('Question not found.', 404); return question; };
const sanitizedDoc = ({ storageName, ...doc }, req) => ({ ...doc, editable: editableDoc(doc, req) });
const settingsFor = req => access.privateValue(req, 'civinco_ai') || (req.deviceId === 'local-owner' ? localSettings : { geminiApiKey: '', model: process.env.GEMINI_MODEL || 'gemini-3.6-flash' });
const publicSettings = req => { const settings = settingsFor(req); return { connected: Boolean(settings.geminiApiKey), model: settings.model }; };
const aiFor = req => createAI(settingsFor(req));
const safeError = error => error?.status === 401 || error?.status === 403 ? 'The Gemini API key was rejected or lacks access to this model. Update it in AI settings.' : error?.status === 429 ? 'Gemini is rate-limited or out of quota. Check billing, then retry.' : error?.status === 503 ? 'Gemini is temporarily busy. Wait a moment, then retry.' : String(error?.message || 'Request failed.').replace(/(?:AIza[\w-]+|AQ\.[\w-]+)/g, '[redacted]').slice(0, 700);
const updateDoc = (id, changes) => store.put('documents', { ...getDoc(id), ...changes });
const activePractice = deviceId => store.get('meta', `active-practice:${deviceId}`) || { id: `active-practice:${deviceId}`, questionIds: [] };
const setActivePractice = (questions, deviceId) => store.put('meta', { id: `active-practice:${deviceId}`, questionIds: questions.map(question => question.id), updatedAt: new Date().toISOString() });

// Interrupted work is resumable; completed page results remain intact.
for (const doc of store.all('documents')) if (['extracting', 'queued'].includes(doc.status)) updateDoc(doc.id, { status: 'paused', error: 'Extraction was interrupted. Resume to continue.' });
for (const page of store.all('pages')) if (page.status === 'extracting') store.put('pages', { ...page, status: 'pending' });
for (const question of store.all('questions')) if (question.mode === 'bank' && question.pool === undefined) store.put('questions', { ...question, pool: true });

app.get('/api/state', (_req, res) => {
  const activeQuestionIds = new Set(activePractice(_req.deviceId).questionIds);
  const documents = store.all('documents').filter(doc => visibleDoc(doc, _req));
  const documentIds = new Set(documents.map(doc => doc.id));
  res.json({
    documents: documents.map(doc => sanitizedDoc(doc, _req)),
    pages: store.all('pages').filter(page => documentIds.has(page.docId)).map(({ text, ...p }) => p), items: store.all('items').filter(item => documentIds.has(item.docId)).map(item => ({ ...item, editable: editableDoc(getDoc(item.docId), _req) })),
    questions: store.all('questions').filter(question => !question.pool && activeQuestionIds.has(question.id) && (!question.ownerId || question.ownerId === _req.deviceId)).map(publicQuestion), attempts: store.all('attempts').filter(attempt => attempt.ownerId === _req.deviceId || (!access.enabled && !attempt.ownerId)), reviews: store.all('reviews').filter(review => review.ownerId === _req.deviceId || (!access.enabled && !review.ownerId)),
    settings: publicSettings(_req),
  });
});
app.post('/api/samples', (_req, res) => { addSamples(store); res.json({ ok: true }); });
app.put('/api/settings', async (req, res) => {
  const input = z.object({ apiKey: z.string().max(500).optional(), model: z.string().min(1).max(100) }).parse(req.body);
  const current = settingsFor(req), next = { geminiApiKey: input.apiKey?.trim() || current.geminiApiKey, model: input.model.trim() };
  res.setHeader('Set-Cookie', access.privateCookie(req, 'civinco_ai', next, 7 * 24 * 60 * 60));
  res.json({ connected: Boolean(next.geminiApiKey), model: next.model });
});
app.delete('/api/settings/key', (req, res) => { res.setHeader('Set-Cookie', access.clearPrivateCookie(req, 'civinco_ai')); res.json({ ok: true }); });
app.post('/api/settings/test', async (req, res) => { await aiFor(req).test(); res.json({ ok: true }); });

const emptyDiagram = { title: '', caption: '', lines: [], arrows: [], circles: [], rectangles: [], labels: [] };
const problemBankTemplate = {
  version: 1,
  name: 'PSAD Set 1 Problem Bank',
  spex: 'A',
  set: 1,
  questions: [{
    title: 'Cantilever beam deflection', topic: 'Beam deflections',
    prompt: 'A cantilever beam of length 2 m carries a 5 kN point load at its free end. Given E = 200 GPa and I = 8.33 × 10⁻⁶ m⁴, determine the maximum deflection.',
    answer: 0.0080032, unit: 'm', tolerance: 0.00001,
    steps: [
      { text: 'Use the free-end deflection equation for a cantilever with a concentrated end load.', latex: '\\delta=\\frac{PL^3}{3EI}' },
      { text: 'Substitute the values using consistent SI units and evaluate.', latex: '\\delta=\\frac{(5000)(2^3)}{3(200\\times10^9)(8.33\\times10^{-6})}=0.0080032\\ \\mathrm{m}' },
    ],
  }],
};
app.get('/api/problem-banks/template', (_req, res) => {
  res.attachment('civinco-problem-bank-template.json').type('application/json').send(`${JSON.stringify(problemBankTemplate, null, 2)}\n`);
});
app.post('/api/problem-banks', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) throw fail('Choose a JSON problem-bank file.');
  const writtenAssets = [];
  try {
    if (path.extname(file.originalname).toLowerCase() !== '.json') throw fail('Problem banks must use the .json template.');
    const bytes = await readFile(file.path);
    if (bytes.length > 50 * 1024 * 1024) throw fail('Problem-bank files must be 50 MB or smaller.');
    let raw;
    try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw fail('The problem bank is not valid UTF-8 JSON.'); }
    const bank = problemBankSchema.parse(raw);
    for (const [questionIndex, question] of bank.questions.entries()) {
      for (const [stepIndex, step] of question.steps.entries()) if (step.latex && !validLatex(step.latex)) throw fail(`Question ${questionIndex + 1}, solution step ${stepIndex + 1} contains invalid LaTeX.`);
      if (!hasRequiredVisual(question)) throw fail(`Question ${questionIndex + 1} refers to a figure but does not include one.`);
    }
    const normalize = value => String(value).trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = new Set(store.all('questions').filter(q => (!q.ownerId || q.ownerId === req.deviceId) && q.spex === bank.spex && q.set === bank.set).map(q => `${normalize(q.prompt)}|${q.answer}|${normalize(q.unit)}`));
    const unique = [];
    let skipped = 0;
    for (const question of bank.questions) {
      const signature = `${normalize(question.prompt)}|${question.answer}|${normalize(question.unit)}`;
      if (existing.has(signature)) { skipped++; continue; }
      existing.add(signature); unique.push(question);
    }
    if (!unique.length) throw fail('Every problem in this file is already in the selected SPEX and Set.');
    const id = randomUUID(), createdAt = new Date().toISOString();
    const doc = { id, ownerId: req.deviceId, name: bank.name || file.originalname, spex: bank.spex, set: bank.set, autoCategorize: false, categoryDetected: true, categoryConfidence: 'imported', categoryReason: 'Defined by the problem-bank file.', kind: 'Problem Bank', sample: false, size: file.size, totalPages: unique.length, extension: '.json', storageName: file.filename, status: 'imported', createdAt, error: '' };
    const questions = await Promise.all(unique.map(async (question, index) => {
      const { diagramImage, ...content } = question;
      const questionId = randomUUID();
      let storedImage;
      if (diagramImage) {
        const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(diagramImage.data);
        const imageBytes = Buffer.from(match[2], 'base64');
        const isPng = match[1] === 'png' && imageBytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
        const isJpeg = match[1] === 'jpeg' && imageBytes[0] === 255 && imageBytes[1] === 216 && imageBytes[2] === 255;
        if (!isPng && !isJpeg) throw fail(`Question ${index + 1} has an invalid diagram image.`);
        if (imageBytes.length > 5 * 1024 * 1024) throw fail(`Question ${index + 1} has a diagram larger than 5 MB.`);
        const storageName = `${id}-${questionId}.${isPng ? 'png' : 'jpg'}`;
        await saveAsset(storageName, imageBytes, isPng ? 'image/png' : 'image/jpeg');
        writtenAssets.push(storageName);
        storedImage = { storageName, mime: isPng ? 'image/png' : 'image/jpeg', alt: diagramImage.alt, caption: diagramImage.caption, visualAid: diagramImage.visualAid };
      }
      return { ...content, diagram: question.diagram || emptyDiagram, ...(storedImage ? { diagramImage: storedImage } : {}), id: questionId, ownerId: req.deviceId, spex: bank.spex, set: bank.set, sourceIds: [], sourceDocId: id, sourcePage: index + 1, mode: 'bank', pool: true, createdAt };
    }));
    await cloud.putAsset(file.filename, bytes, 'application/json');
    store.transaction(() => {
      store.put('documents', doc);
      questions.forEach((question, index) => {
        store.put('questions', question);
        store.put('pages', { id: `${id}:${index + 1}`, docId: id, page: index + 1, status: 'extracted', reviewed: true, warnings: [], error: '', text: question.prompt });
      });
    });
    res.status(201).json({ imported: questions.length, skipped, document: sanitizedDoc(doc, req), questions: questions.map(publicQuestion) });
  } catch (error) {
    await removeAssets([file.filename, ...writtenAssets]);
    throw error;
  }
});

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
      const doc = { id, ownerId: req.deviceId, name: file.originalname, ...category, autoCategorize, categoryDetected: !autoCategorize, kind, sample: false, size: file.size, totalPages, extension: ext, storageName: file.filename, status: 'stored', createdAt: new Date().toISOString(), error: '' };
      const mime = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain', '.md': 'text/markdown' }[ext];
      await cloud.putAsset(file.filename, bytes, mime);
      store.transaction(() => {
        store.put('documents', doc);
        for (let page = 1; page <= totalPages; page++) store.put('pages', { id: `${id}:${page}`, docId: id, page, status: 'pending', reviewed: false, warnings: [], error: '', ...(chunks.length ? { text: chunks[page - 1] } : {}) });
      });
      accepted.push(sanitizedDoc(doc, req));
    } catch (error) { errors.push({ name: file.originalname, error: safeError(error) }); await removeAssets([file.filename]); }
  }
  res.status(accepted.length ? 201 : 400).json({ accepted, errors, ...(!accepted.length ? { error: errors.map(e => `${e.name}: ${e.error}`).join('\n') } : {}) });
});

app.get('/api/documents/:id/source', async (req, res) => {
  const doc = requireVisibleDoc(req.params.id, req);
  if (doc.sample) throw fail('Starter references have no uploaded source.', 404);
  const mime = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain', '.md': 'text/plain', '.json': 'application/json' }[doc.extension];
  res.type(mime).send(await readAsset(doc.storageName));
});
app.get('/api/questions/:id/diagram', async (req, res) => {
  const question = requireVisibleQuestion(req.params.id, req);
  if (!question.diagramImage) throw fail('This problem has no source diagram.', 404);
  res.type(question.diagramImage.mime).send(await readAsset(question.diagramImage.storageName));
});
app.patch('/api/documents/:id', (req, res) => {
  const doc = requireEditableDoc(req.params.id, req), category = categorySchema.parse(req.body);
  if (activeDoc === doc.id || ['extracting', 'queued'].includes(doc.status)) throw fail('Pause extraction and let the current page finish before changing the category.', 409);
  store.transaction(() => {
    updateDoc(doc.id, { ...category, autoCategorize: false, categoryDetected: true, categoryConfidence: 'manual', categoryReason: 'Set manually.' });
    for (const item of store.all('items').filter(i => i.docId === doc.id)) store.put('items', { ...item, ...category });
    for (const question of store.all('questions').filter(q => q.sourceDocId === doc.id)) store.put('questions', { ...question, ...category });
    // Generated questions and historical attempts remain in their original study scope.
  });
  res.json({ ok: true });
});
app.delete('/api/documents/:id', async (req, res) => {
  const doc = requireEditableDoc(req.params.id, req);
  if (['extracting', 'queued'].includes(doc.status)) throw fail('Pause extraction and wait for the current page before removing this file.', 409);
  if (activeDoc === doc.id) throw fail('The current page is finishing. Try removing this file shortly.', 409);
  const diagramAssets = store.all('questions').filter(q => q.sourceDocId === doc.id && q.diagramImage?.storageName).map(q => q.diagramImage.storageName);
  store.transaction(() => {
    const itemIds = new Set(store.all('items').filter(i => i.docId === doc.id).map(i => i.id));
    const qIds = new Set(store.all('questions').filter(q => q.sourceDocId === doc.id || q.sourceIds.some(id => itemIds.has(id))).map(q => q.id));
    for (const [collection, predicate] of [['pages', p => p.docId === doc.id], ['items', i => itemIds.has(i.id)], ['questions', q => qIds.has(q.id)], ['attempts', a => qIds.has(a.questionId)], ['reviews', r => itemIds.has(r.itemId)]]) {
      for (const record of store.all(collection).filter(predicate)) store.remove(collection, record.id);
    }
    const active = activePractice(req.deviceId);
    store.put('meta', { ...active, questionIds: active.questionIds.filter(id => !qIds.has(id)) });
    store.remove('documents', doc.id);
  });
  await removeAssets([doc.storageName, ...diagramAssets]);
  res.json({ ok: true });
});

const queue = [];
let running = false, activeDoc = null;
const unfinished = id => store.all('pages').some(p => p.docId === id && p.status !== 'extracted');
async function sourcePageContent(doc, pageNumber, suppliedBytes, suppliedPdf) {
  const bytes = suppliedBytes || await readAsset(doc.storageName);
  const page = store.get('pages', `${doc.id}:${pageNumber}`);
  if (!page) throw fail('Source page not found.', 404);
  const pdf = suppliedPdf || (doc.extension === '.pdf' ? await PDFDocument.load(bytes) : null);
  if (pdf) {
    const single = await PDFDocument.create();
    const [copy] = await single.copyPages(pdf, [pageNumber - 1]); single.addPage(copy);
    const encoded = Buffer.from(await single.save()).toString('base64');
    return [{ type: 'input_file', filename: `page-${pageNumber}.pdf`, file_data: `data:application/pdf;base64,${encoded}` }];
  }
  if (page.text !== undefined) return [{ type: 'input_text', text: page.text }];
  return [{ type: 'input_image', image_url: `data:${doc.extension === '.png' ? 'image/png' : 'image/jpeg'};base64,${bytes.toString('base64')}`, detail: 'high' }];
}
function enqueueDocument(id, aiSettings) {
  const doc = getDoc(id);
  if (doc.sample || activeDoc === id || ['extracting', 'queued'].includes(doc.status) || queue.some(task => task.id === id) || !unfinished(id)) return false;
  updateDoc(id, { status: 'queued', error: '' });
  queue.push({ id, aiSettings });
  return true;
}
async function processQueue() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const task = queue.shift(), id = task.id, taskAI = createAI(task.aiSettings);
      const pendingDoc = store.get('documents', id);
      if (!pendingDoc || pendingDoc.status === 'paused') continue;
      activeDoc = id;
      updateDoc(id, { status: 'extracting', error: '' });
      try {
        let doc = getDoc(id);
        const bytes = await readAsset(doc.storageName);
        const pdf = doc.extension === '.pdf' ? await PDFDocument.load(bytes) : null;
        const pages = store.all('pages').filter(p => p.docId === id && p.status !== 'extracted').sort((a, b) => a.page - b.page);
        for (const page of pages) {
          if (getDoc(id).status === 'paused') break;
          store.put('pages', { ...page, status: 'extracting', error: '' });
          try {
            const content = await sourcePageContent(doc, page.page, bytes, pdf);
            const shouldClassify = Boolean(doc.autoCategorize && !doc.categoryDetected && page.page === 1);
            const result = await taskAI.extract(content, `Source: ${doc.name}; current category SPEX ${doc.spex}, Set ${doc.set}; original page / text section ${page.page} of ${doc.totalPages}.`, shouldClassify);
            if (result.classification) {
              const category = { spex: result.classification.spex, set: result.classification.set };
              updateDoc(id, { ...category, categoryDetected: true, categoryConfidence: result.classification.confidence, categoryReason: result.classification.reason });
              doc = getDoc(id);
            }
            store.transaction(() => {
              for (const kind of ['formula', 'concept']) for (const entry of result[kind === 'formula' ? 'formulas' : 'concepts']) {
                store.put('items', { ...entry, id: randomUUID(), ownerId: doc.ownerId, docId: id, page: page.page, spex: doc.spex, set: doc.set, kind, reviewed: false, sample: false });
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
  const doc = requireEditableDoc(req.params.id, req);
  if (doc.sample) throw fail('Starter references do not need extraction.');
  const aiSettings = settingsFor(req);
  if (!aiSettings.geminiApiKey) throw fail('Add a Gemini API key in AI settings to extract your files.', 409);
  if (activeDoc === doc.id || ['extracting', 'queued'].includes(doc.status)) throw fail('This file is already in the extraction queue.', 409);
  if (!store.all('pages').some(p => p.docId === doc.id && p.status !== 'extracted')) throw fail('Every page has already been extracted. Review the page inventory.');
  enqueueDocument(doc.id, aiSettings); void processQueue(); res.status(202).json({ ok: true });
});
app.post('/api/documents/extract-all', (req, res) => {
  const aiSettings = settingsFor(req);
  if (!aiSettings.geminiApiKey) throw fail('Add a Gemini API key in AI settings to extract your files.', 409);
  const documents = store.all('documents').filter(doc => !doc.sample && doc.ownerId === req.deviceId);
  const queued = documents.filter(doc => enqueueDocument(doc.id, aiSettings)).length;
  void processQueue();
  res.status(202).json({ queued, skipped: documents.length - queued });
});
app.post('/api/documents/:id/pause', (req, res) => {
  requireEditableDoc(req.params.id, req);
  updateDoc(req.params.id, { status: 'paused' });
  for (let index = queue.length - 1; index >= 0; index--) if (queue[index].id === req.params.id) queue.splice(index, 1);
  res.json({ ok: true });
});
app.post('/api/documents/:id/pages/:page/review', (req, res) => {
  const page = store.get('pages', `${req.params.id}:${req.params.page}`);
  if (!page || page.status !== 'extracted') throw fail('Extract this page before marking it reviewed.');
  requireEditableDoc(page.docId, req);
  if (store.all('items').some(i => i.docId === page.docId && i.page === page.page && i.kind === 'formula' && (!i.reviewed || i.uncertain))) throw fail('Check and approve every formula on this page first.');
  store.put('pages', { ...page, reviewed: true }); res.json({ ok: true });
});
app.put('/api/items/:id', (req, res) => {
  const item = requireEditableItem(req.params.id, req);
  if (item.kind !== 'formula') throw fail('Only formulas can be edited here.');
  const input = formulaSchema.extend({
    reviewed: z.boolean(),
    webSources: z.array(webSourceSchema).max(12).optional(),
    repairConfidence: z.enum(['high', 'medium', 'low']).optional(),
    repairReason: z.string().max(1000).optional(),
  }).parse(req.body);
  if (!validLatex(input.latex) || input.variables.some(v => !validLatex(v.symbol))) throw fail('Correct the LaTeX notation before saving.');
  if (input.reviewed && input.uncertain) throw fail('Resolve the uncertainty before approving this formula.');
  store.transaction(() => {
    store.put('items', { ...item, ...input });
    const page = store.get('pages', `${item.docId}:${item.page}`);
    if (page) store.put('pages', { ...page, reviewed: false });
  });
  res.json({ ok: true });
});
async function repairItem(item, req) {
  if (item.kind !== 'formula') throw fail('Only formulas can be checked this way.');
  if (item.sample) throw fail('Starter formulas do not need online repair.');
  if (!settingsFor(req).geminiApiKey) throw fail('Add a Gemini API key in AI settings before checking online.', 409);
  const doc = getDoc(item.docId);
  if (activeDoc === doc.id || ['extracting', 'queued'].includes(doc.status)) throw fail('Wait for the current extraction page to finish before checking this formula.', 409);
  const content = await sourcePageContent(doc, item.page);
  const neighbors = store.all('items').filter(candidate => candidate.docId === item.docId && candidate.page === item.page && candidate.id !== item.id).map(candidate => ({
    kind: candidate.kind, title: candidate.title, topic: candidate.topic, latex: candidate.latex, variables: candidate.variables, explanation: candidate.explanation,
  }));
  const result = await aiFor(req).repair(item, neighbors, content, `Source: ${doc.name}; SPEX ${doc.spex}, Set ${doc.set}; original page / text section ${item.page} of ${doc.totalPages}.`);
  return {
    suggestion: { title: result.title, topic: result.topic, latex: result.latex, variables: result.variables, conditions: result.conditions, uncertain: result.uncertain, note: result.note },
    confidence: result.confidence, reason: result.reason, sources: result.sources, searchQueries: result.searchQueries, searchEntryPoint: result.searchEntryPoint,
  };
}
app.post('/api/items/:id/repair', async (req, res) => {
  res.json(await repairItem(requireEditableItem(req.params.id, req), req));
});
app.post('/api/items/repair-missing', async (req, res) => {
  const { itemIds } = z.object({ itemIds: z.array(z.string()).min(1).max(2000) }).parse(req.body);
  const requested = new Set(itemIds), results = [], errors = [];
  for (const item of store.all('items').filter(candidate => requested.has(candidate.id) && getDoc(candidate.docId).ownerId === req.deviceId)) {
    try {
      const result = await repairItem(item, req);
      store.put('items', { ...item, ...result.suggestion, reviewed: false, webSources: result.sources, repairConfidence: result.confidence, repairReason: result.reason, searchEntryPoint: result.searchEntryPoint });
      results.push(item.id);
    } catch (error) {
      errors.push({ id: item.id, title: item.title, error: safeError(error) });
      if ([429, 503].includes(error?.status)) break;
    }
  }
  res.json({ repaired: results.length, failed: errors.length, errors });
});
app.post('/api/items', (req, res) => {
  const input = formulaSchema.extend({ docId: z.string(), page: z.number().int().min(1), reviewed: z.boolean() }).parse(req.body);
  const doc = requireEditableDoc(input.docId, req);
  if (input.page > doc.totalPages) throw fail('Choose a page within this source.');
  if (!validLatex(input.latex) || input.variables.some(v => !validLatex(v.symbol))) throw fail('Correct the LaTeX notation before saving.');
  if (input.reviewed && input.uncertain) throw fail('Resolve the uncertainty before approving this formula.');
  store.put('items', { ...input, id: randomUUID(), ownerId: req.deviceId, spex: doc.spex, set: doc.set, kind: 'formula', sample: doc.sample });
  const page = store.get('pages', `${doc.id}:${input.page}`);
  if (page) store.put('pages', { ...page, reviewed: false });
  res.status(201).json({ ok: true });
});

let generating = false;
app.post('/api/questions/generate', async (req, res) => {
  const input = categorySchema.extend({ mode: z.enum(['ai', 'sample', 'bank', 'variant']), style: z.enum(['generated', 'source']).default('generated'), count: z.number().int().min(1).max(10), difficulty: z.enum(['Foundation', 'Board-level', 'Challenge']), replace: z.boolean().default(false) }).parse(req.body);
  if (generating) throw fail('A question set is already being generated. Please wait.', 409);
  if (activePractice(req.deviceId).questionIds.length && !input.replace) throw fail('Confirm that you want to replace the current practice set.', 409);
  const sourceStyle = input.mode === 'ai' && input.style === 'source';
  if (input.mode === 'bank') {
    const pool = store.all('questions').filter(question => question.pool && (!question.ownerId || question.ownerId === req.deviceId) && question.spex === input.spex && question.set === input.set);
    if (pool.length < input.count) throw fail(`This permanent bank has ${pool.length} available problem${pool.length === 1 ? '' : 's'} for the selected SPEX and Set. Choose a smaller set.`);
    const shuffled = [...pool];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    const selected = shuffled.slice(0, input.count).sort((a, b) => (a.sourcePage || 0) - (b.sourcePage || 0));
    const createdAt = new Date().toISOString();
    const questions = selected.map(({ id: sourceBankQuestionId, pool: _pool, createdAt: _createdAt, ownerId: _ownerId, ...question }) => ({ ...question, id: randomUUID(), ownerId: req.deviceId, sourceBankQuestionId, pool: false, mode: 'bank', createdAt }));
    store.transaction(() => { questions.forEach(question => store.put('questions', question)); setActivePractice(questions, req.deviceId); });
    return res.json({ questions: questions.map(publicQuestion) });
  }
  if (input.mode === 'variant') {
    const pool = store.all('questions').filter(question => question.pool && question.offlineVariant && (!question.ownerId || question.ownerId === req.deviceId) && question.spex === input.spex && question.set === input.set);
    const questions = offlineVariants(pool, input.count).map(question => ({ ...question, ownerId: req.deviceId }));
    if (questions.length !== input.count) throw fail('No offline variation templates are available for this SPEX and Set yet. Choose permanent-bank questions instead.');
    store.transaction(() => { questions.forEach(question => store.put('questions', question)); setActivePractice(questions, req.deviceId); });
    return res.json({ questions: questions.map(publicQuestion) });
  }
  const candidates = store.all('items').filter(i => visibleDoc(getDoc(i.docId), req) && i.spex === input.spex && i.set === input.set && (input.mode === 'sample' ? i.sample : !i.sample) && (sourceStyle || i.kind !== 'formula' || (i.reviewed && !i.uncertain && validLatex(i.latex))));
  if (!candidates.length) throw fail(input.mode === 'sample' ? 'Add starter references from Home first, and choose Set 1.' : sourceStyle ? 'No extracted source pages are available in this SPEX and Set.' : 'Extract files and approve formulas in this SPEX and Set first.');
  generating = true;
  try {
    let questions;
    if (input.mode === 'sample') questions = sampleQuestions(candidates, input.count).map(question => ({ ...question, ownerId: req.deviceId }));
    else if (sourceStyle) {
      const grouped = new Map();
      for (const item of candidates) {
        const key = `${item.docId}:${item.page}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(item);
      }
      const selectedPages = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, Math.min(18, Math.max(8, input.count * 2)));
      const content = [], pageIndex = [];
      for (const [, entries] of selectedPages) {
        const doc = getDoc(entries[0].docId), page = entries[0].page;
        content.push({ type: 'input_text', text: `SOURCE PAGE: ${doc.name}, original page / section ${page} of ${doc.totalPages}.` });
        content.push(...await sourcePageContent(doc, page));
        pageIndex.push({ document: doc.name, page, entries: entries.map(item => ({ id: item.id, kind: item.kind, title: item.title, topic: item.topic, latex: item.latex })) });
      }
      const result = await aiFor(req).sourceQuestions(pageIndex, content, input.count);
      questions = result.map(q => ({ ...q, id: randomUUID(), ownerId: req.deviceId, spex: input.spex, set: input.set, mode: 'source', createdAt: new Date().toISOString() }));
    } else {
      // Rotate a bounded source selection for generation; extraction itself is never truncated.
      const selected = [...candidates].sort(() => Math.random() - 0.5).slice(0, 30);
      const result = await aiFor(req).generate(selected, input.count, input.difficulty);
      questions = result.map(q => ({ ...q, id: randomUUID(), ownerId: req.deviceId, spex: input.spex, set: input.set, mode: 'ai', createdAt: new Date().toISOString() }));
    }
    if (!questions.length) throw fail('No suitable numerical practice templates were found.');
    if (questions.length !== input.count) throw fail(`Only ${questions.length} complete questions were produced. Your current practice set was kept; try again.`);
    if (questions.some(q => q.sourceIds.some(id => { const item = store.get('items', id); return !item || item.spex !== input.spex || item.set !== input.set; }))) throw fail('A source was removed or recategorized while generating. Generate a fresh set from the current materials.', 409);
    store.transaction(() => { questions.forEach(q => store.put('questions', q)); setActivePractice(questions, req.deviceId); });
    res.json({ questions: questions.map(publicQuestion) });
  } finally { generating = false; }
});
app.post('/api/questions/:id/answer', (req, res) => {
  const q = requireVisibleQuestion(req.params.id, req);
  const existing = store.all('attempts').find(a => a.questionId === q.id && a.ownerId === req.deviceId);
  if (existing) throw fail('This problem has already been answered. Its saved result and solution are shown.', 409);
  const { answer } = z.object({ answer: z.string().max(100) }).parse(req.body);
  const graded = gradeAnswer(answer, q.answer, q.tolerance);
  store.put('attempts', { id: randomUUID(), ownerId: req.deviceId, questionId: q.id, spex: q.spex, set: q.set, topic: q.topic, correct: graded.correct, answer: graded.numeric, revealed: false, createdAt: new Date().toISOString() });
  res.json({ ...graded, expected: q.answer, tolerance: q.tolerance, unit: q.unit, steps: q.steps, solutionQuality: q.solutionQuality, firstAttempt: true });
});
app.post('/api/questions/:id/solution', (req, res) => {
  const q = requireVisibleQuestion(req.params.id, req);
  let attempt = store.all('attempts').find(a => a.questionId === q.id && a.ownerId === req.deviceId);
  if (!attempt) {
    attempt = { id: randomUUID(), ownerId: req.deviceId, questionId: q.id, spex: q.spex, set: q.set, topic: q.topic, correct: false, answer: null, revealed: true, createdAt: new Date().toISOString() };
    store.put('attempts', attempt);
  }
  res.json({ correct: attempt.correct, numeric: attempt.answer, expected: q.answer, tolerance: q.tolerance, unit: q.unit, steps: q.steps, solutionQuality: q.solutionQuality, revealed: attempt.revealed });
});
app.post('/api/reviews', (req, res) => {
  const { itemId, rating } = z.object({ itemId: z.string(), rating: z.enum(['again', 'hard', 'good', 'easy']) }).parse(req.body);
  const item = requireVisibleItem(itemId, req), reviewId = `${req.deviceId}:${itemId}`, previous = store.get('reviews', reviewId);
  store.put('reviews', { id: reviewId, ownerId: req.deviceId, itemId, spex: item.spex, set: item.set, topic: item.topic, ...reviewSchedule(previous, rating), count: (previous?.count || 0) + 1, lastReviewedAt: new Date().toISOString() });
  res.json({ ok: true });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 50 MB or smaller.' : error.message });
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
const host = process.env.RENDER || process.env.CIVINCO_PUBLIC_HOST ? '0.0.0.0' : '127.0.0.1';
const server = app.listen(port, host, () => console.log(`CIVINCO for Milch is ready on ${host}:${port}`));
server.requestTimeout = 600_000;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(async () => { await cloud.flush().catch(() => {}); store.close(); process.exit(0); }); });
