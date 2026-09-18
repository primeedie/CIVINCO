import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/civinco.sqlite');
const put = db.prepare("UPDATE records SET value = ? WHERE collection = 'questions' AND id = ?");
const rows = db.prepare("SELECT id, value FROM records WHERE collection = 'questions'").all();
const entries = rows.map(row => ({ row, value: JSON.parse(row.value) }));
const solutions = new Map([
  ['02e5d137-e048-40c7-a363-6fa4101558f7', [
    { text: 'Resolve the 200 N weight normal and parallel to the 10° incline shown in the source figure.', latex: String.raw`N=W\cos 10^\circ=200\cos 10^\circ=196.96\ \mathrm{N},\qquad W_\parallel=W\sin 10^\circ=34.73\ \mathrm{N}` },
    { text: 'At impending upward sliding, friction acts down the incline with magnitude μN.', latex: String.raw`f=\mu N=0.30(196.96)=59.09\ \mathrm{N}` },
    { text: 'Apply equilibrium along the incline.', latex: String.raw`P-W_\parallel-f=0\quad\Longrightarrow\quad P=34.73+59.09=93.82\ \mathrm{N}` },
  ]],
  ['6f4db0e4-0e1c-435b-94e4-d702d14dca2d', [
    { text: 'Use vertical-force equilibrium to determine the uniform upward pressure over the 7 m beam.', latex: String.raw`7q-2(112)(1.5)=0\quad\Longrightarrow\quad q=48\ \mathrm{kN/m}` },
    { text: 'The largest shear occurs beside either loaded region.', latex: String.raw`V_{\max}=q(1.0)=48(1.0)=48\ \mathrm{kN}` },
  ]],
  ['df1bdc05-6e97-43fb-b0ac-04258cc4b5ed', [
    { text: 'Vertical-force equilibrium gives the upward pressure.', latex: String.raw`q=\frac{2(112)(1.5)}{7}=48\ \mathrm{kN/m}` },
    { text: 'Within the first 112 kN/m downward-load region, the net load is 64 kN/m downward. Set shear to zero to locate maximum moment.', latex: String.raw`V=48-64(x-1)=0\quad\Longrightarrow\quad x=1.75\ \mathrm{m}` },
    { text: 'Evaluate the bending moment at that location.', latex: String.raw`M_{\max}=24+48(0.75)-\frac{64(0.75)^2}{2}=42\ \mathrm{kN\cdot m}` },
  ]],
  ['0d2defbc-49e2-4b5e-b5f4-6dceea81bb4e', [
    { text: 'From equilibrium, the uniform upward pressure is 48 kN/m. At the end of the first loaded region, x = 2.5 m, the bending moment and shear are 24 kN·m and −48 kN.', latex: String.raw`q=48\ \mathrm{kN/m},\qquad M(2.5)=24\ \mathrm{kN\cdot m},\qquad V(2.5)=-48\ \mathrm{kN}` },
    { text: 'Across the unloaded middle region, integrate the linearly increasing shear.', latex: String.raw`M(x)=24-48(x-2.5)+24(x-2.5)^2` },
    { text: 'Set the moment to zero and take the first interior root.', latex: String.raw`24-48a+24a^2=0\quad\Longrightarrow\quad a=1.0\ \mathrm{m},\qquad x=2.5+1.0=3.5\ \mathrm{m}` },
  ]],
  ['8010368b-db2f-4050-a9c7-792843d30d73', [
    { text: 'Measure each level height from the base: 3, 6, 9, 12, and 15 m for the roof deck.', latex: String.raw`\sum w_i h_i=2500(3)+1800(6)+1500(9)+1100(12)+900(15)=58{,}500\ \mathrm{kN\cdot m}` },
    { text: 'Distribute the 3,000 kN base shear in proportion to wₓhₓ.', latex: String.raw`F_{\mathrm{roof}}=V\frac{w_{\mathrm{roof}}h_{\mathrm{roof}}}{\sum w_i h_i}=3000\frac{900(15)}{58{,}500}=692.3\ \mathrm{kN}` },
  ]],
  ['38b10367-2cc4-42fc-a721-678db526474e', [
    { text: 'Compute the fourth-floor lateral force from the vertical distribution of base shear.', latex: String.raw`F_4=3000\frac{1500(9)}{58{,}500}=692.31\ \mathrm{kN}` },
    { text: 'Convert the force-to-weight ratio into effective spectral acceleration.', latex: String.raw`a_4=\frac{F_4}{W_4}g=\frac{692.31}{1500}(9.81)=4.53\ \mathrm{m/s^2}` },
  ]],
  ['ef0ae7b6-bd0b-4ecb-87f0-fa8cf5f7d52f', [
    { text: 'The particle reverses direction when its velocity becomes zero.', latex: String.raw`12-3t^2=0\quad\Longrightarrow\quad t=2\ \mathrm{s}` },
    { text: 'For the source interval from 0 to 10 s, add the absolute displacement on each side of the reversal.', latex: String.raw`s=\int_0^2(12-3t^2)\,dt+\int_2^{10}(3t^2-12)\,dt` },
    { text: 'Evaluate both integrals.', latex: String.raw`s=16+896=912\ \mathrm{m}` },
  ]],
]);
let repaired = 0;
db.exec('BEGIN');
try {
  for (const entry of entries) {
    const steps = solutions.get(entry.row.id);
    if (!steps) continue;
    entry.value.steps = steps;
    entry.value.solutionQuality = 'worked';
    put.run(JSON.stringify(entry.value), entry.row.id);
    repaired++;
  }
  const byId = new Map(entries.map(entry => [entry.row.id, entry.value]));
  for (const entry of entries.filter(entry => !entry.value.pool && entry.value.sourceBankQuestionId)) {
    const source = byId.get(entry.value.sourceBankQuestionId);
    if (!source || !solutions.has(source.id)) continue;
    entry.value.steps = source.steps;
    entry.value.solutionQuality = 'worked';
    put.run(JSON.stringify(entry.value), entry.row.id);
  }
  db.exec('COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
console.log(`Repaired ${repaired} context-dependent solutions offline.`);
