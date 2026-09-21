import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const rows = db.prepare("SELECT id, value FROM records WHERE collection = 'questions'").all();
const entries = rows.map(row => ({ row, value: JSON.parse(row.value) }));
const put = db.prepare("UPDATE records SET value = ? WHERE collection = 'questions' AND id = ?");

const repairs = new Map([
  ['0fa5f361-2ca8-41b2-8a25-3ff790784b83', { offlineVariant: 'dice-sum', topic: 'Probability', title: 'Probability of a Sum from Two Dice', quality: 'worked', steps: [
    { text: 'There are 36 equally likely ordered outcomes when two fair dice are rolled.', latex: String.raw`6\times6=36` },
    { text: 'Six outcomes have a sum of 10, 11, or 12, so the remaining 30 have a sum below 10.', latex: String.raw`P(S<10)=\frac{36-6}{36}=\frac56=0.833333` },
  ] }],
  ['1e04a61d-9651-4a85-8401-1778432612ed', { offlineVariant: 'direct-proportion', topic: 'Direct Variation', title: 'Building Height from Shadow Length', quality: 'worked', unit: 'stories', steps: [
    { text: 'At the same time of day, building height and shadow length are directly proportional.', latex: String.raw`\frac{5}{20}=\frac{n}{32}` },
    { text: 'Solve the proportion for the unknown number of stories.', latex: String.raw`n=32\left(\frac5{20}\right)=8\ \text{stories}` },
  ] }],
  ['e84be50a-58a2-4dda-9679-8b6bea9991e9', { offlineVariant: 'similar-polygon', topic: 'Similar Figures', title: 'Perimeter of a Similar Polygon', quality: 'worked', steps: [
    { text: 'The ratio of corresponding sides is the smaller longest side divided by the larger longest side.', latex: String.raw`k=\frac{12}{18}=\frac23` },
    { text: 'Multiply the larger perimeter by the linear scale factor.', latex: String.raw`P_s=\frac23(4+6+7+13+18)=32\ \mathrm{m}` },
  ] }],
  ['221eaa01-b444-4590-8b47-e128036f3d2d', { offlineVariant: 'circular-seating', topic: 'Permutations', title: 'Circular Arrangements with a Couple Together', quality: 'worked', unit: 'arrangements', steps: [
    { text: 'Treat the couple as one block, giving nine units around the circular table.', latex: String.raw`(9-1)!=8!` },
    { text: 'The two people in the couple can exchange places.', latex: String.raw`N=2(8!)=80{,}640` },
  ] }],
  ['fa31fbef-5826-4a8a-a80e-96f03baa3740', { offlineVariant: 'buoyant-volume', topic: 'Buoyancy', title: 'Stone Volume from Apparent Weight', quality: 'worked', unit: 'm³', steps: [
    { text: 'The apparent loss of weight in water is the buoyant force.', latex: String.raw`F_B=400-240=160\ \mathrm{N}` },
    { text: 'Divide by the unit weight of water.', latex: String.raw`V=\frac{F_B}{\gamma_w}=\frac{160}{9810}=0.01631\ \mathrm{m^3}` },
  ] }],
  ['1a72e0b0-d28e-485a-8eb3-6a4a9b82de14', { offlineVariant: 'vector-resultant' }],
  ['ea1f349e-5010-41cc-8e02-db4f64bbeebb', { offlineVariant: 'vehicle-catchup' }],
  ['f48b5a59-0e2e-4609-b024-a3a876ef2b2d', { offlineVariant: 'shaft-polar-moment' }],
]);

let repaired = 0;
db.exec('BEGIN');
try {
  for (const entry of entries.filter(entry => entry.value.pool)) {
    const repair = repairs.get(entry.row.id);
    if (!repair) continue;
    entry.value.offlineVariant = repair.offlineVariant;
    if (repair.steps) {
      entry.value.topic = repair.topic;
      entry.value.title = repair.title;
      entry.value.steps = repair.steps;
      entry.value.solutionQuality = repair.quality;
      if (repair.unit !== undefined) entry.value.unit = repair.unit;
      repaired++;
    }
    put.run(JSON.stringify(entry.value), entry.row.id);
  }
  const byId = new Map(entries.map(entry => [entry.row.id, entry.value]));
  for (const entry of entries.filter(entry => !entry.value.pool && entry.value.sourceBankQuestionId)) {
    const source = byId.get(entry.value.sourceBankQuestionId);
    if (!source || !repairs.has(source.id)) continue;
    for (const key of ['topic', 'title', 'unit', 'steps', 'solutionQuality']) entry.value[key] = source[key];
    put.run(JSON.stringify(entry.value), entry.row.id);
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
console.log(`Repaired ${repaired} source solutions and enabled ${repairs.size} offline variation templates.`);
