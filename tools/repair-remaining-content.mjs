import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const read = collection => db.prepare('SELECT id, value FROM records WHERE collection = ?').all(collection).map(row => ({ row, value: JSON.parse(row.value) }));
const put = db.prepare('UPDATE records SET value = ? WHERE collection = ? AND id = ?');
const powers = { 2: '²', 3: '³', 4: '⁴' };
const normalize = value => String(value || '')
  .replace(/\b(?:sq\.?|square)\s*(mm|cm|m|km|ft|in)\b/gi, '$1²')
  .replace(/\b(?:cu\.?|cubic)\s*(mm|cm|m|km|ft|in)\b/gi, '$1³')
  .replace(/(\d)(mm|cm|km|m|ft|in)\s*\^?\s*([234])\b/gi, (_, number, unit, power) => `${number} ${unit}${powers[power]}`)
  .replace(/\b(mm|cm|km|m|ft|in)\s*\^?\s*([234])\b/gi, (_, unit, power) => `${unit}${powers[power]}`)
  .replace(/\b(m|ft)\s*\/\s*s\s*\^?\s*2\b/gi, '$1/s²')
  .replace(/\b(kg|kN|N)\s*\/\s*(mm|cm|m|ft)\s*\^?\s*([23])\b/gi, (_, force, unit, power) => `${force}/${unit}${powers[power]}`)
  .replace(/\b(kN|N)\s*-\s*m\b/g, '$1·m')
  .replace(/(\d),\s+(\d{3})\b/g, '$1,$2');

const repairs = new Map([
  ['21e6faf3-7b44-4b01-a3e0-42e9f0feda82', { topic: 'Normal Distribution', title: 'Scores Within One Standard Deviation', quality: 'worked', steps: [
    { text: 'Convert the two bounds to standard scores.', latex: String.raw`z_1=\frac{40-48}{8}=-1,\qquad z_2=\frac{56-48}{8}=1` },
    { text: 'The standard normal area from z = -1 to z = 1 is approximately 0.6827.', latex: String.raw`P(40<X<56)=P(-1<Z<1)\approx0.6827\approx68\%` },
  ] }],
  ['fc2a10e3-92ec-4e27-b696-2dfc56cb1205', { topic: 'Centroids by Integration', title: 'Centroid of a Parabolic Area', quality: 'worked', answer: 7.2, steps: [
    { text: 'Write the upper boundary as y = √(3x) and integrate from x = 0 to 12.', latex: String.raw`A=\int_0^{12}\sqrt{3x}\,dx=48` },
    { text: 'Divide the first moment about the y-axis by the area.', latex: String.raw`\bar x=\frac{\int_0^{12}x\sqrt{3x}\,dx}{A}=\frac{345.6}{48}=7.2` },
  ] }],
  ['f26c43f2-aaf7-481e-867e-fe144a076af5', { topic: 'Centroids by Integration', title: 'Centroid of the Area Under a Sine Curve', quality: 'worked', answer: Math.PI / 8, unit: '', tolerance: 0.0005, steps: [
    { text: 'Find the area under y = sin x from 0 to π.', latex: String.raw`A=\int_0^\pi\sin x\,dx=2` },
    { text: 'For an area beneath a curve, the first moment about the x-axis is one half the integral of y².', latex: String.raw`\bar y=\frac{\frac12\int_0^\pi\sin^2x\,dx}{A}=\frac{\frac12(\pi/2)}{2}=\frac\pi8\approx0.3927` },
  ] }],
  ['ffac60b1-ce57-4f97-93c1-b65da08b6779', { topic: 'Analytic Geometry', title: 'Slope from the Standard Form of a Line', quality: 'worked', steps: [
    { text: 'Rearrange the line into slope-intercept form.', latex: String.raw`8x-15y=0\quad\Longrightarrow\quad y=\frac8{15}x` },
    { text: 'The coefficient of x is the slope.', latex: String.raw`m=\frac8{15}=0.533333` },
  ] }],
  ['ff1f6a7c-45a4-4fa1-936f-38c12922a537', { topic: 'Logarithms', title: 'Numbers from Product and Quotient Logarithms', quality: 'worked', answer: 7, steps: [
    { text: 'Let A be the logarithm of the product and B the logarithm of the quotient.', latex: String.raw`\log(xy)=A=1.62324929,\qquad\log(x/y)=B=0.066946789` },
    { text: 'Add the equations to isolate the logarithm of the first number.', latex: String.raw`2\log x=A+B\quad\Longrightarrow\quad x=10^{(A+B)/2}=7` },
  ] }],
  ['20b78b72-1c65-4991-a46c-bb739161388c', { topic: 'Rate Problems', title: 'Number of Steps on a Moving Escalator', quality: 'worked', unit: 'steps', steps: [
    { text: 'Let N be the escalator length in steps and e its upward speed in steps per second. The first trip takes 20 seconds.', latex: String.raw`N=20+20e` },
    { text: 'At two steps per second, 32 walking steps take 16 seconds.', latex: String.raw`N=32+16e` },
    { text: 'Equate the two expressions and solve.', latex: String.raw`20+20e=32+16e\Rightarrow e=3,\qquad N=80\ \text{steps}` },
  ] }],
]);

const questions = read('questions');
let normalized = 0, repaired = 0;
db.exec('BEGIN');
try {
  for (const entry of questions) {
    const question = entry.value;
    for (const key of ['title', 'topic', 'prompt', 'unit']) question[key] = normalize(question[key]);
    question.steps = question.steps?.map(step => ({ ...step, text: normalize(step.text) })) || question.steps;
    const repair = question.pool ? repairs.get(entry.row.id) : null;
    if (repair) {
      const { quality, ...changes } = repair;
      Object.assign(question, changes);
      question.solutionQuality = repair.quality;
      repaired++;
    }
    put.run(JSON.stringify(question), 'questions', entry.row.id); normalized++;
  }
  const current = new Map(questions.map(entry => [entry.row.id, entry.value]));
  for (const entry of questions.filter(entry => !entry.value.pool && entry.value.sourceBankQuestionId)) {
    const source = current.get(entry.value.sourceBankQuestionId);
    if (!source || !repairs.has(source.id)) continue;
    for (const key of ['topic', 'title', 'answer', 'unit', 'tolerance', 'steps', 'solutionQuality']) entry.value[key] = source[key];
    put.run(JSON.stringify(entry.value), 'questions', entry.row.id);
  }
  for (const entry of read('items')) {
    const item = entry.value;
    if (item.variables) item.variables = item.variables.map(variable => ({ ...variable, unit: normalize(variable.unit) }));
    for (const key of ['conditions', 'note', 'explanation']) if (item[key]) item[key] = normalize(item[key]);
    put.run(JSON.stringify(item), 'items', entry.row.id);
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
console.log(`Normalized ${normalized} questions and repaired ${repaired} additional source solutions.`);
