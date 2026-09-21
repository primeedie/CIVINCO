import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const rows = db.prepare("SELECT id, value FROM records WHERE collection = 'questions'").all();
const entries = rows.map(row => ({ row, value: JSON.parse(row.value) }));
const put = db.prepare("UPDATE records SET value = ? WHERE collection = 'questions' AND id = ?");
const repairs = new Map([
  ['2204c429-2c31-4542-9e4f-c58a718c4f5e', {
    topic: 'Allowable Stress in Supporting Wires',
    title: 'Maximum Allowable Tension in Wire AC',
    quality: 'worked',
    steps: [
      { text: 'Use the allowable normal-stress relation for wire AC.', latex: String.raw`F_{AC,\max}=\sigma_{AC,\mathrm{allow}}A_{AC}` },
      { text: 'Since 1 MPa equals 1 N/mm², the units are already compatible.', latex: String.raw`F_{AC,\max}=(150\ \mathrm{N/mm^2})(200\ \mathrm{mm^2})=30{,}000\ \mathrm{N}=30\ \mathrm{kN}` },
    ],
  }],
  ['b3f0d095-2f2f-4cf7-8401-3e37c32ca7ef', {
    topic: 'Allowable Stress in Supporting Wires',
    title: 'Maximum Allowable Tension in Wire AB',
    quality: 'worked',
    steps: [
      { text: 'Use the allowable normal-stress relation for wire AB.', latex: String.raw`F_{AB,\max}=\sigma_{AB,\mathrm{allow}}A_{AB}` },
      { text: 'Since 1 MPa equals 1 N/mm², the units are already compatible.', latex: String.raw`F_{AB,\max}=(100\ \mathrm{N/mm^2})(400\ \mathrm{mm^2})=40{,}000\ \mathrm{N}=40\ \mathrm{kN}` },
    ],
  }],
  ['07917508-4e5e-4c6d-af57-bc5e5c6c0d6e', {
    topic: 'Equilibrium of Supporting Wires',
    title: 'Maximum Weight Supported by Two Wires',
    quality: 'source',
    steps: [{ text: 'The source result of 41.21 kN applies both allowable cable tensions at once, but those tensions do not satisfy horizontal equilibrium for the shown 30° and 45° cable angles. This item needs source correction before it can be graded reliably.', latex: '' }],
  }],
]);
repairs.set('8758ca92-2305-46a1-9c27-5b1d6d8d6eab', {
  topic: 'Torsion of Hollow Shafts',
  title: 'Minimum Outside Diameter from Twist and Stress Limits',
  quality: 'worked',
  promptReplacement: ['G=83 MPa', 'G=83 GPa'],
  steps: [
    { text: 'Correct the source unit for steel and convert all quantities consistently. The handwritten work confirms that G is 83 GPa, not 83 MPa.', latex: String.raw`T=34\times10^6\ \mathrm{N\,mm},\quad L=2510\ \mathrm{mm},\quad G=83{,}000\ \mathrm{MPa},\quad \theta=3^\circ\left(\frac{\pi}{180^\circ}\right)` },
    { text: 'Assuming the source intends the twist and stress limits to govern simultaneously, first obtain the required polar moment from the twist limit.', latex: String.raw`J=\frac{TL}{G\theta}=\frac{(34\times10^6)(2510)}{(83{,}000)(3\pi/180)}=19.637\times10^6\ \mathrm{mm^4}` },
    { text: 'Apply the allowable shear-stress equation with the outside radius c = dₒ/2.', latex: String.raw`\tau_{\max}=\frac{Tc}{J}=\frac{T(d_o/2)}{J}\quad\Longrightarrow\quad d_o=\frac{2\tau_{\max}J}{T}` },
    { text: 'Substitute the allowable stress and round the required diameter upward.', latex: String.raw`d_o=\frac{2(110)(19.637\times10^6)}{34\times10^6}=127.06\ \mathrm{mm}\quad\Longrightarrow\quad \boxed{d_o=128\ \mathrm{mm}}` },
  ],
});
repairs.set('f48b5a59-0e2e-4609-b024-a3a876ef2b2d', {
  topic: 'Torsion of Hollow Shafts',
  title: 'Required Polar Moment of Inertia from Angle of Twist',
  quality: 'worked',
  promptReplacement: ['G=83 MPa', 'G=83 GPa'],
  steps: [
    { text: 'Correct the source unit for the shear modulus and convert the angle to radians.', latex: String.raw`G=83\ \mathrm{GPa}=83{,}000\ \mathrm{MPa},\qquad \theta=3^\circ\left(\frac{\pi}{180^\circ}\right)=0.05236\ \mathrm{rad}` },
    { text: 'Rearrange the angle-of-twist equation for the polar moment.', latex: String.raw`\theta=\frac{TL}{JG}\quad\Longrightarrow\quad J=\frac{TL}{G\theta}` },
    { text: 'Substitute the torque and length using N and mm.', latex: String.raw`J=\frac{(34\times10^6)(2510)}{(83{,}000)(0.05236)}=19.637\times10^6\ \mathrm{mm^4}` },
  ],
});

let repaired = 0;
db.exec('BEGIN');
try {
  for (const entry of entries.filter(entry => entry.value.pool)) {
    const repair = repairs.get(entry.row.id);
    if (!repair) continue;
    entry.value.topic = repair.topic;
    entry.value.title = repair.title;
    entry.value.steps = repair.steps;
    entry.value.solutionQuality = repair.quality;
    if (repair.promptReplacement) entry.value.prompt = entry.value.prompt.replace(...repair.promptReplacement);
    put.run(JSON.stringify(entry.value), entry.row.id);
    repaired++;
  }
  const byId = new Map(entries.map(entry => [entry.row.id, entry.value]));
  for (const entry of entries.filter(entry => !entry.value.pool && entry.value.sourceBankQuestionId)) {
    const source = byId.get(entry.value.sourceBankQuestionId);
    if (!source || !repairs.has(source.id)) continue;
    for (const key of ['topic', 'title', 'prompt', 'steps', 'solutionQuality']) entry.value[key] = source[key];
    put.run(JSON.stringify(entry.value), entry.row.id);
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
console.log(`Repaired ${repaired} linked source problems: ${[...repairs.keys()].join(', ')}.`);
