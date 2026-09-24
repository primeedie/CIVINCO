import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../server/store.mjs';
import { gradeAnswer, reviewSchedule, validLatex, publicQuestion } from '../server/domain.mjs';
import { addSamples, sampleQuestions } from '../server/samples.mjs';
import { createAI } from '../server/ai.mjs';
import { buildOfflineVariant, offlineVariants } from '../server/variants.mjs';

test('numeric grading accepts scientific notation, rounding boundaries and Unicode minus', () => {
  assert.equal(gradeAnswer('1.25e2', 125, 0.01).correct, true);
  assert.equal(gradeAnswer('−10', -10, 0.01).correct, true);
  assert.equal(gradeAnswer('10.01', 10, .01).correct, true);
  assert.equal(gradeAnswer('10.02', 10, .01).correct, false);
  for (const input of ['', ' ', '12 MPa', '1/2', 'NaN', 'Infinity', '1e999', '1;process.exit()']) assert.throws(() => gradeAnswer(input, 12, .01));
});
test('recall intervals preserve failed recall and expand successful recall', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(reviewSchedule(null, 'again', now).due, '2026-01-01T00:10:00.000Z');
  assert.equal(reviewSchedule(null, 'good', now).interval, 1);
  assert.equal(reviewSchedule({ interval: 4 }, 'good', now).interval, 10);
  assert.equal(reviewSchedule({ interval: 4 }, 'hard', now).interval, 1);
  assert.equal(reviewSchedule(null, 'easy', now).interval, 4);
});
test('LaTeX preserves Greek, primes and summations and rejects malformed expressions', () => {
  for (const latex of [String.raw`\tan\theta = \frac{f}{N}`, String.raw`\sum_{i=1}^{n} F_i=0`, String.raw`\sigma' = \sigma-u`, String.raw`\mu_s`, String.raw`\rho`]) assert.equal(validLatex(latex), true);
  assert.equal(validLatex(String.raw`\frac{x}{`), false);
  assert.equal(validLatex(String.raw`\notarealcommand`), false);
});
test('public questions do not expose answers or worked solutions', () => {
  assert.deepEqual(publicQuestion({ id: 'q', answer: 12, tolerance: .01, steps: [], offlineVariant: 'dice-sum', prompt: 'Compute.' }), { id: 'q', prompt: 'Compute.' });
});
test('offline variations recalculate supported figure-free problems without AI', () => {
  const kinds = ['vector-resultant', 'vehicle-catchup', 'shaft-polar-moment', 'dice-sum', 'direct-proportion', 'similar-polygon', 'circular-seating', 'buoyant-volume'];
  const factorial = value => Array.from({ length: value }, (_, index) => index + 1).reduce((product, entry) => product * entry, 1);
  const independentlySolve = question => {
    const numbers = pattern => question.prompt.match(pattern)?.slice(1).map(Number) || [];
    if (question.offlineVariant === 'vector-resultant') {
      const [first, second, third] = numbers(/F1 = (\d+).*F2 = (\d+).*F3 = (\d+)/);
      const directions = [[5, -2, 7], [-3, 0, -4], [2, 1, -6]];
      const scales = directions.map((direction, index) => [first, second, third][index] / Math.hypot(...direction));
      return Math.hypot(...[0, 1, 2].map(axis => directions.reduce((sum, direction, index) => sum + direction[axis] * scales[index], 0)));
    }
    if (question.offlineVariant === 'vehicle-catchup') {
      const [truck, car, distance] = numbers(/truck accelerates at ([\d.]+).*car at ([\d.]+).*traveled (\d+)/);
      return distance * (car / truck - 1);
    }
    if (question.offlineVariant === 'shaft-polar-moment') {
      const [length, torque, angle, modulus] = numbers(/shaft ([\d.]+) m long transmits (\d+).*twist to (\d+).*G = (\d+)/);
      return torque * length / (modulus * angle * Math.PI / 180);
    }
    if (question.offlineVariant === 'dice-sum') {
      const [limit] = numbers(/sum is less than (\d+)/);
      return Array.from({ length: 6 }, (_, first) => Array.from({ length: 6 }, (_, second) => first + second + 2 < limit ? 1 : 0)).flat().reduce((sum, entry) => sum + entry, 0) / 36;
    }
    if (question.offlineVariant === 'direct-proportion') {
      const [stories, shadow, targetShadow] = numbers(/a (\d+)-story building casts a ([\d.]+).*casts a ([\d.]+)/);
      return stories * targetShadow / shadow;
    }
    if (question.offlineVariant === 'similar-polygon') {
      const match = question.prompt.match(/side lengths ([\d, ]+) m.*longest side of ([\d.]+) m/);
      const sides = match[1].split(',').map(Number), smallerLongest = Number(match[2]);
      return sides.reduce((sum, side) => sum + side, 0) * smallerLongest / Math.max(...sides);
    }
    if (question.offlineVariant === 'circular-seating') {
      const [friends] = numbers(/invites (\d+) friends/);
      return 2 * factorial(friends);
    }
    const [airWeight, waterWeight] = numbers(/weighs (\d+) N in air and (\d+) N/);
    return (airWeight - waterWeight) / 9810;
  };
  for (const offlineVariant of kinds) {
    const questions = offlineVariants([{ id: offlineVariant, offlineVariant, title: 'Source', topic: 'Topic', spex: 'A', set: 1, sourceIds: [], sourceDocId: 'doc', sourcePage: 1 }], 3);
    assert.equal(questions.length, 3, offlineVariant);
    for (const question of questions) {
      assert.equal(Number.isFinite(question.answer), true, offlineVariant);
      assert.equal(question.mode, 'variant');
      assert.equal(question.sourceBankQuestionId, offlineVariant);
      assert.equal(question.diagram.labels.length, 0);
      assert.equal(question.steps.every(step => !step.latex || validLatex(step.latex)), true, offlineVariant);
      assert.ok(Math.abs(question.answer - independentlySolve(question)) <= question.tolerance, `${offlineVariant}: recalculated answer must match changed givens`);
    }
  }
});
test('expanded offline variation families produce finite answers and valid worked notation', () => {
  const kinds = ['hydraulic-jack', 'barometer-height', 'iceberg-volume', 'barge-draft', 'soil-zero-void', 'moist-unit-weight', 'bus-speed', 'polygon-diagonals', 'work-rate', 'father-son', 'exponential-wait', 'binomial-exact', 'hooke-spring', 'rectangle-semicircle', 'rectangle-ellipse', 'stopping-friction', 'superelevation', 'centripetal-force', 'accident-rate', 'footing-base-pressure', 'two-to-one-spread'];
  for (const offlineVariant of kinds) for (let iteration = 0; iteration < 25; iteration++) {
    const question = buildOfflineVariant({ id: offlineVariant, offlineVariant, title: 'Source', topic: 'Topic', spex: 'A', set: 1, sourceIds: [], sourceDocId: 'doc', sourcePage: 1 });
    assert.ok(question, offlineVariant);
    assert.equal(Number.isFinite(question.answer), true, offlineVariant);
    assert.equal(question.answer >= 0, true, offlineVariant);
    assert.equal(question.steps.every(step => !step.latex || validLatex(step.latex)), true, offlineVariant);
    assert.match(question.prompt, /\d/);
  }
});
test('durable store, sample symbol fidelity, all sample question families and rollback', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'civinco-unit-'));
  let store = createStore(directory);
  try {
    addSamples(store); addSamples(store);
    assert.equal(store.all('documents').length, 3);
    assert.equal(store.all('items').filter(i => i.kind === 'formula').length, 12);
    for (const item of store.all('items').filter(i => i.kind === 'formula')) {
      assert.equal(validLatex(item.latex), true, item.title);
      for (const variable of item.variables) assert.equal(validLatex(variable.symbol), true, variable.symbol);
    }
    assert.equal(store.all('items').find(i => i.title === 'Limiting static friction').variables[1].symbol, String.raw`\mu_s`);
    assert.equal(store.all('items').find(i => i.title === 'Average normal stress').variables[0].symbol, String.raw`\sigma`);
    assert.equal(store.all('items').find(i => i.title === 'Hydrostatic gauge pressure').variables[1].symbol, String.raw`\rho`);
    for (const spex of ['A', 'B', 'C']) for (const q of sampleQuestions(store.all('items').filter(i => i.spex === spex), 10)) {
      assert.equal(q.spex, spex); assert.ok(Number.isFinite(q.answer));
      assert.equal(gradeAnswer(q.answer.toFixed(2), q.answer, q.tolerance).correct, true);
      for (const step of q.steps) assert.equal(validLatex(step.latex), true);
    }
    assert.throws(() => store.transaction(() => { store.put('test', { id: 'rollback' }); throw new Error('test'); }));
    assert.equal(store.get('test', 'rollback'), null);
    store.close(); store = createStore(directory);
    assert.equal(store.all('items').length, 19);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
const formula = (latex, title = 'Equation') => ({ title, topic: 'Statics', latex, variables: [], conditions: '', uncertain: false, note: '' });
const diagram = { title: '', caption: '', lines: [], arrows: [], circles: [], rectangles: [], labels: [] };
test('single-pass free extraction validates notation locally and preserves warnings', async () => {
  const replies = [{ formulas: [formula('F=ma'), formula(String.raw`\frac{x}{`)], concepts: [{ title: 'Balance', topic: 'Statics', explanation: 'Balance forces.' }], warnings: ['Faint caption'] }];
  const calls = [];
  const ai = createAI({ geminiApiKey: 'test-key', model: 'test-model' }, { geminiClient: () => ({ models: { generateContent: async input => { calls.push(input); return { text: JSON.stringify(replies.shift()) }; } } }) });
  const result = await ai.extract([{ type: 'input_text', text: 'Test source page' }], 'Page 7');
  assert.equal(calls.length, 1); assert.equal(calls[0].model, 'test-model');
  assert.equal(result.formulas.length, 2);
  assert.equal(result.formulas.find(f => f.latex === String.raw`\frac{x}{`).uncertain, true);
  assert.equal(result.concepts.length, 1);
  assert.deepEqual(result.warnings, ['Faint caption']);
});
test('first-page classification shares the extraction request', async () => {
  const reply = { formulas: [formula('F=ma')], concepts: [], warnings: [], classification: { spex: 'A', set: 2, confidence: 'high', reason: 'The cover identifies PSAD Set 2.' } };
  const calls = [];
  const ai = createAI({ geminiApiKey: 'test-key', model: 'test-model' }, { geminiClient: () => ({ models: { generateContent: async input => { calls.push(input); return { text: JSON.stringify(reply) }; } } }) });
  const result = await ai.extract([{ type: 'input_text', text: 'PSAD SET 2' }], 'First page', true);
  assert.equal(calls.length, 1);
  assert.deepEqual(result.classification, reply.classification);
  assert.match(calls[0].config.systemInstruction, /SPEX A is PSAD/);
});
test('incomplete AI responses cannot mark a page complete', async () => {
  const ai = createAI({ geminiApiKey: 'test-key', model: 'test-model' }, { geminiClient: () => ({ models: { generateContent: async () => ({ text: '' }) } }) });
  await assert.rejects(ai.extract([], 'Page 1'), /complete result/);
});
test('Gemini receives native PDF data and returns locally validated structured output', async () => {
  const calls = [];
  let gets = 0;
  const replies = [{ formulas: [formula(String.raw`\tan\theta=\frac{f}{N}`)], concepts: [], warnings: [] }];
  const ai = createAI(
    { geminiApiKey: 'test-key', model: 'gemini-test' },
    { geminiClient: () => ({ models: {
      generateContent: async input => { calls.push(input); return { text: JSON.stringify(replies.shift()) }; },
      get: async ({ model }) => { gets++; return { name: model }; },
    } }) },
  );
  const result = await ai.extract([
    { type: 'input_file', filename: 'page-1.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' },
  ], 'Source page 1');
  assert.equal(result.formulas.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'gemini-test');
  assert.equal(calls[0].contents[0].inlineData.mimeType, 'application/pdf');
  assert.equal(calls[0].contents[0].inlineData.data, 'JVBERi0=');
  assert.equal(calls[0].contents[1].text, 'Source page 1');
  assert.equal(calls[0].config.responseMimeType, 'application/json');
  assert.equal(calls[0].config.responseJsonSchema.type, 'object');
  assert.ok(!JSON.stringify(calls[0].config.responseJsonSchema).includes('minLength'));
  await ai.test(); assert.equal(gets, 1);
});
test('Gemini rejects malformed structured data after generation', async () => {
  const ai = createAI(
    { geminiApiKey: 'test-key', model: 'gemini-test' },
    { geminiClient: () => ({ models: { generateContent: async () => ({ text: '{"formulas":"wrong"}' }) } }) },
  );
  await assert.rejects(ai.extract([{ type: 'input_text', text: 'Source' }], 'Page 1'), /invalid page_extraction result/);
});
test('online formula repair uses page context, Google Search grounding, citations, and notation validation', async () => {
  const calls = [];
  const suggestion = {
    title: 'Maximum deflection of a cantilever beam', topic: 'Beam deflections', latex: String.raw`\delta=\frac{PL^3}{3EI}`,
    variables: [
      { symbol: String.raw`\delta`, meaning: 'Maximum vertical deflection at the free end', unit: 'm' },
      { symbol: 'P', meaning: 'Concentrated load at the free end', unit: 'N' },
      { symbol: 'L', meaning: 'Cantilever length', unit: 'm' },
      { symbol: 'E', meaning: 'Modulus of elasticity', unit: 'Pa' },
      { symbol: 'I', meaning: 'Second moment of area', unit: String.raw`m^4` },
    ], conditions: 'Prismatic Euler-Bernoulli cantilever with a point load at the free end', uncertain: false, note: '', confidence: 'high', reason: 'The page geometry and standard reference agree.',
  };
  const ai = createAI({ geminiApiKey: 'test-key', model: 'test-model' }, { geminiClient: () => ({ models: { generateContent: async input => {
    calls.push(input);
    return { text: JSON.stringify(suggestion), candidates: [{ groundingMetadata: { webSearchQueries: ['cantilever point load deflection variables'], searchEntryPoint: { renderedContent: '<div>Search suggestions</div>' }, groundingChunks: [{ web: { uri: 'https://example.edu/beams', title: 'University beam tables' } }] } }] };
  } } }) });
  const result = await ai.repair({ title: suggestion.title, latex: suggestion.latex, variables: [] }, [], [{ type: 'input_text', text: 'Original source page' }], 'Page 6');
  assert.deepEqual(calls[0].config.tools, [{ googleSearch: {} }]);
  assert.equal(calls[0].contents[0].text, 'Original source page');
  assert.equal(result.variables.length, 5);
  assert.deepEqual(result.sources, [{ title: 'University beam tables', url: 'https://example.edu/beams' }]);
  assert.deepEqual(result.searchQueries, ['cantilever point load deflection variables']);
  assert.equal(result.searchEntryPoint, '<div>Search suggestions</div>');
});
test('AI generation rejects invented source IDs and failed independent solution checks', async () => {
  const q = { title: 'Force', topic: 'Statics', prompt: 'Find force.', answer: 2, unit: 'N', tolerance: .01, sourceIds: ['fake'], steps: [{ text: 'Compute.', latex: 'F=2' }], diagram };
  const fake = replies => createAI({ geminiApiKey: 'test', model: 'test' }, { geminiClient: () => ({ models: { generateContent: async () => ({ text: JSON.stringify(replies.shift()) }) } }) });
  await assert.rejects(fake([{ questions: [q] }]).generate([{ id: 'real' }], 1, 'Foundation'), /source or notation/);
  await assert.rejects(fake([{ questions: [{ ...q, sourceIds: ['real'] }] }, { checks: [{ index: 0, valid: false, reason: 'Wrong result' }] }]).generate([{ id: 'real' }], 1, 'Foundation'), /independent solution check/);
});
test('source problem mode preserves uploaded problems in a single model pass', async () => {
  const calls = [];
  const question = { title: 'Cantilever deflection', topic: 'Beam deflections', prompt: 'A cantilever of length 2 m carries a 5 kN end load. Find the free-end deflection.', answer: 0.004, unit: 'm', tolerance: 0.0001, sourceIds: ['source-formula'], steps: [{ text: 'Apply the stated cantilever equation.', latex: String.raw`\delta=\frac{PL^3}{3EI}` }], diagram };
  const ai = createAI({ geminiApiKey: 'test', model: 'test' }, { geminiClient: () => ({ models: { generateContent: async input => { calls.push(input); return { text: JSON.stringify({ questions: [question] }) }; } } }) });
  const result = await ai.sourceQuestions([{ document: 'module.pdf', page: 6, entries: [{ id: 'source-formula' }] }], [{ type: 'input_text', text: 'Visible source problem' }], 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].config.systemInstruction, /preserve its wording, given values, units/);
  assert.equal(result[0].prompt, question.prompt);
});
