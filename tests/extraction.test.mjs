import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

test('PDF extraction splits every page, preserves completed results on retry, gates page approval, and generates audited questions', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'civinco-extraction-'));
  let failSecondPage = true;
  const pageRequests = [];
  const mock = http.createServer(async (req, res) => {
    try {
      let body = ''; for await (const chunk of req) body += chunk;
      const request = JSON.parse(body), raw = JSON.stringify(request);
      const name = raw.includes('independent completeness audit') ? 'page_audit' : raw.includes('document extraction engine') ? 'page_extraction' : raw.includes('Independently solve each proposed') ? 'answer_audit' : raw.includes('Create exactly') ? 'practice_questions' : 'unknown';
      const findPart = (value, predicate) => {
        if (predicate(value)) return value;
        if (!value || typeof value !== 'object') return null;
        for (const child of Object.values(value)) { const match = findPart(child, predicate); if (match) return match; }
        return null;
      };
      let result;
      if (name.startsWith('page_')) {
        const source = findPart(request, value => value?.inlineData?.mimeType === 'application/pdf');
        const pdf = await PDFDocument.load(Buffer.from(source.inlineData.data, 'base64'));
        assert.equal(pdf.getPageCount(), 1, 'Every request must contain exactly one source page');
        const context = findPart(request, value => typeof value?.text === 'string' && value.text.includes('original page / text section'))?.text || '';
        const original = Number(context.match(/original page \/ text section (\d+)/)[1]);
        pageRequests.push({ page: original, pass: name });
        if (original === 2 && failSecondPage) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Test-only simulated page failure', status: 'INVALID_ARGUMENT' } })); return; }
        result = { formulas: [{ title: `Equation on page ${original}`, topic: 'Friction', latex: String.raw`\tan\theta = \frac{f}{N}`, variables: [{ symbol: String.raw`\theta`, meaning: 'Angle of friction', unit: '°' }, { symbol: 'f', meaning: 'Limiting friction force', unit: 'N' }, { symbol: 'N', meaning: 'Normal force', unit: 'N' }], conditions: 'Impending sliding', uncertain: false, note: '' }], concepts: [], warnings: [] };
      } else if (name === 'practice_questions') {
        const materialText = findPart(request, value => typeof value?.text === 'string' && value.text.startsWith('[{'))?.text;
        const materials = JSON.parse(materialText);
        const diagram = { title: 'Block free-body diagram', caption: 'Forces acting on the block.', lines: [{ x1: 10, y1: 80, x2: 90, y2: 80, dashed: false }], arrows: [{ x1: 50, y1: 55, x2: 50, y2: 20, dashed: false }], circles: [], rectangles: [{ x: 40, y: 50, width: 20, height: 20, filled: true }], labels: [{ x: 53, y: 20, text: 'N = 100 N', align: 'start' }] };
        result = { questions: Array.from({ length: 3 }, (_, n) => ({ title: `Force ${n}`, topic: 'Friction', prompt: 'At impending sliding, tan θ = 0.5. If N = 100 N, find f in N.', answer: 50, unit: 'N', tolerance: .01, sourceIds: [materials[0].id], diagram, steps: [{ text: 'Multiply the normal force by the tangent.', latex: String.raw`f=100(0.5)=50\ \mathrm{N}` }] })) };
      } else if (name === 'answer_audit') result = { checks: [0, 1, 2].map(index => ({ index, valid: true, reason: 'Verified in test fixture' })) };
      else throw new Error(`Unexpected request ${name}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(result) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }, modelVersion: 'gemini-test' }));
    } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: error.message } })); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const mockPort = mock.address().port;
  const port = 14175;
  const child = spawn(process.execPath, ['server/index.mjs', '--production'], { env: { ...process.env, PORT: String(port), CIVINCO_DATA_DIR: directory, GEMINI_API_KEY: 'test-fixture-only', GEMINI_MODEL: 'gemini-test', GEMINI_BASE_URL: `http://127.0.0.1:${mockPort}` }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const call = async (url, body, method) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${url}`, { method: method || (body ? 'POST' : 'GET'), headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' }, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  };
  async function waitFor(predicate) {
    for (let n = 0; n < 200; n++) { const state = (await call('/state')).data; if (predicate(state)) return state; await new Promise(resolve => setTimeout(resolve, 25)); }
    throw new Error('Job did not reach its expected state');
  }
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Startup timed out')), 10000); child.once('error', reject); child.stdout.on('data', chunk => { if (chunk.toString().includes('is ready')) { clearTimeout(timer); resolve(); } }); });
    const pdf = await PDFDocument.create(); pdf.addPage(); pdf.addPage();
    const form = new FormData(); form.append('spex', 'A'); form.append('set', '2'); form.append('files', new Blob([await pdf.save()], { type: 'application/pdf' }), 'source.pdf');
    const doc = (await call('/documents', form)).data.accepted[0];
    assert.equal((await call(`/documents/${doc.id}/extract`, {})).status, 202);
    let state = await waitFor(s => s.documents[0].status === 'partial');
    assert.equal(state.items.length, 1);
    const firstId = state.items[0].id;
    assert.deepEqual(state.pages.map(p => p.status), ['extracted', 'failed']);
    assert.equal((await call(`/documents/${doc.id}/pages/1/review`, {})).status, 400);
    failSecondPage = false;
    await call(`/documents/${doc.id}/extract`, {});
    state = await waitFor(s => s.documents[0].status === 'extracted');
    assert.equal(state.items.length, 2); assert.ok(state.items.some(i => i.id === firstId));
    assert.equal(pageRequests.filter(r => r.page === 1).length, 1, 'Successful pages must not be billed/extracted again on resume');
    assert.equal(pageRequests.filter(r => r.page === 2).length, 2, 'Failed page gets one fresh extraction request');
    for (const item of state.items) assert.equal((await call(`/items/${item.id}`, { ...item, reviewed: true }, 'PUT')).status, 200);
    assert.equal((await call(`/documents/${doc.id}/pages/1/review`, {})).status, 200);
    assert.equal((await call(`/documents/${doc.id}/pages/2/review`, {})).status, 200);
    const generation = await call('/questions/generate', { spex: 'A', set: 2, mode: 'ai', count: 3, difficulty: 'Foundation' });
    assert.equal(generation.status, 200, JSON.stringify(generation.data));
    assert.equal(generation.data.questions.length, 3);
    assert.equal(generation.data.questions[0].spex, 'A'); assert.equal(generation.data.questions[0].set, 2);
    assert.equal(generation.data.questions[0].diagram.title, 'Block free-body diagram');
    const answer = await call(`/questions/${generation.data.questions[0].id}/answer`, { answer: '50' });
    assert.equal(answer.data.correct, true);
    assert.equal((await call(`/items/${firstId}`, { ...state.items.find(i => i.id === firstId), reviewed: true, latex: 'f=N' }, 'PUT')).status, 200);
    state = (await call('/state')).data;
    assert.equal(state.pages.find(p => p.page === 1).reviewed, false, 'Edits require renewed page review');
  } finally {
    if (child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    await new Promise(resolve => mock.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
