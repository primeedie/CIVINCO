import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const read = collection => db.prepare('SELECT id, value FROM records WHERE collection = ?').all(collection).map(row => ({ row, value: JSON.parse(row.value) }));
const questions = read('questions');
const items = read('items');
const documents = read('documents');
const putQuestion = db.prepare("UPDATE records SET value = ? WHERE collection = 'questions' AND id = ?");
const putItem = db.prepare("UPDATE records SET value = ? WHERE collection = 'items' AND id = ?");
const remove = db.prepare('DELETE FROM records WHERE collection = ? AND id = ?');

const S = (text, latex) => ({ text, latex });
const exactSolutions = new Map([
  ['07917508-4e5e-4c6d-af57-bc5e5c6c0d6e', [
    S('Convert the allowable stresses into allowable cable tensions.', String.raw`T_{AB,allow}=(100)(400)=40\ \mathrm{kN},\qquad T_{AC,allow}=(150)(200)=30\ \mathrm{kN}`),
    S('Horizontal equilibrium relates the two cable tensions. If AC reaches 30 kN, AB remains below its 40 kN limit.', String.raw`T_{AB}\cos30^\circ=T_{AC}\cos45^\circ\quad\Longrightarrow\quad T_{AB}=30\frac{\cos45^\circ}{\cos30^\circ}=24.495\ \mathrm{kN}`),
    S('Vertical equilibrium gives the largest supported weight.', String.raw`W=T_{AB}\sin30^\circ+T_{AC}\sin45^\circ=24.495\sin30^\circ+30\sin45^\circ=\boxed{33.46\ \mathrm{kN}}`),
  ]],
  ['0d38bef9-9311-4583-8d08-9b28eb3c99e1', [
    S('Resolve the 200 N weight on the 10° incline shown in the source figure.', String.raw`N=W\cos10^\circ=196.96\ \mathrm N,\qquad W_{\parallel}=W\sin10^\circ=34.73\ \mathrm N`),
    S('Check that the available static friction is large enough to maintain equilibrium.', String.raw`f_{max}=\mu_sN=0.30(196.96)=59.09\ \mathrm N>34.73\ \mathrm N`),
    S('The actual static-friction force equals the component that it must resist.', String.raw`f=W\sin10^\circ=\boxed{34.73\ \mathrm N}`),
  ]],
  ['38256156-92e2-4156-b82d-2f1ab2efb63a', [
    S('Differentiate the velocity function.', String.raw`v=12-3t^2\quad\Longrightarrow\quad a=\frac{dv}{dt}=-6t`),
    S('Evaluate the acceleration at 4 seconds.', String.raw`a(4)=-6(4)=\boxed{-24\ \mathrm{m/s^2}}`),
  ]],
  ['6bea872a-b208-478c-b9b0-064e7c29168b', [
    S('Use the required tension-steel area obtained from the factored-moment design.', String.raw`A_s=2613\ \mathrm{mm^2}`),
    S('Compute the area of one 25 mm bar.', String.raw`A_b=\frac{\pi}{4}(25)^2=490.87\ \mathrm{mm^2}`),
    S('Round the required number of bars upward.', String.raw`n=\frac{A_s}{A_b}=\frac{2613}{490.87}=5.32\quad\Longrightarrow\quad\boxed{6\ \text{bars}}`),
  ]],
  ['41163ddc-75a9-49cb-8617-b044973dd5af', [
    S('Compute the steel yield strain.', String.raw`\varepsilon_y=\frac{f_y}{E_s}=\frac{415}{200000}=0.002075`),
    S('Use strain compatibility to obtain the balanced neutral-axis ratio.', String.raw`\frac{c_b}{d}=\frac{0.003}{0.003+0.002075}=0.59113`),
    S('Apply force equilibrium with β₁ = 0.85.', String.raw`\rho_b=0.85\beta_1\frac{f'_c}{f_y}\frac{c_b}{d}=0.85(0.85)\frac{25}{415}(0.59113)=\boxed{0.02573}`),
  ]],
  ['1de8a9c3-7332-4fab-b710-33664e6016a8', [
    S('At balanced strain, use d = h - d′ = 400 - 65 = 335 mm and compute the neutral-axis depth.', String.raw`c_b=335\frac{0.003}{0.003+415/200000}=198.03\ \mathrm{mm}`),
    S('For f′c = 27 MPa, β₁ = 0.85 and a = β₁c.', String.raw`a=0.85(198.03)=168.33\ \mathrm{mm}`),
    S('The nominal concrete compression force is the rectangular stress-block resultant.', String.raw`C_c=0.85f'_cab=0.85(27)(168.33)(250)=965800\ \mathrm N=\boxed{965.8\ \mathrm{kN}}`),
  ]],
  ['2346a84a-16bc-41a6-ae54-2a785e49d1cd', [
    S('The five 3 m stories give a total structural height of 15 m.', String.raw`h_n=5(3)=15\ \mathrm m`),
    S('Use the NSCP approximate-period equation and Ct = 0.0853 for a steel moment-resisting frame.', String.raw`T=C_th_n^{3/4}=0.0853(15)^{3/4}=\boxed{0.65\ \mathrm s}`),
  ]],
  ['7e2f64f5-f018-4eb8-a907-18885ad65daf', [
    S('Interpolate the near-source factor for Source Type A at 8 km.', String.raw`N_a=1.08`),
    S('For Soil Profile SD, calculate the seismic coefficient.', String.raw`C_a=0.40N_a=0.40(1.08)=0.432`),
    S('Apply the simplified static-force equation to the 2700 kN seismic weight.', String.raw`V=\frac{3C_a}{R}W=\frac{3(0.432)}{8.5}(2700)=\boxed{452.84\ \mathrm{kN}}`),
  ]],
  ['6a18e1b7-31e9-4ced-9ed2-50a4cf4a7e0a', [
    S('Calculate the factored load and uniform factored soil pressure.', String.raw`P_u=1.2(1000)+1.6(1500)=3600\ \mathrm{kN},\qquad q_u=\frac{3600}{3(4)}=300\ \mathrm{kPa}`),
    S('The critical section is 0.40 m from the column face; the loaded projection beyond it is 1.40 m.', String.raw`\ell_v=\frac{4-0.4}{2}-0.4=1.40\ \mathrm m`),
    S('Multiply the soil pressure by the footing area outside the critical section.', String.raw`V_u=q_uB\ell_v=300(3)(1.40)=\boxed{1260\ \mathrm{kN}}`),
  ]],
  ['ce9f33ed-7579-444c-8406-9b1996085701', [
    S('The source key uses a 300 mm shear-resisting depth for the strength check.', String.raw`d_v=300\ \mathrm{mm}`),
    S('Use the NSCP concrete one-way shear stress 0.17√f′c.', String.raw`v_c=0.17\sqrt{35}=1.006\ \mathrm{MPa}`),
    S('Convert the stress to the design wide-beam shear force over the 3 m footing width.', String.raw`V_c=v_cBd_v=1.006(3000)(300)=\boxed{905\ \mathrm{kN}}`),
  ]],
  ['5430ec54-743c-4c25-8b8d-90e1a9eaa606', [
    S('Use the 1260 kN critical shear demand and the source key’s 300 mm shear-resisting depth.', String.raw`B=3000\ \mathrm{mm},\qquad d_v=300\ \mathrm{mm}`),
    S('Divide the critical shear by the resisting section.', String.raw`v_u=\frac{V_u}{Bd_v}=\frac{1260\times10^3}{3000(300)}=\boxed{1.40\ \mathrm{MPa}}`),
  ]],
  ['fc547203-2b32-41af-8512-79d068ef7284', [
    S('Use the NSCP one-way concrete shear-stress expression.', String.raw`v_c=0.17\sqrt{f'_c}`),
    S('Substitute f′c = 35 MPa.', String.raw`v_c=0.17\sqrt{35}=\boxed{1.01\ \mathrm{MPa}}`),
  ]],
  ['77558289-144c-4ae4-8546-16592417fcad', [
    S('Use the factored soil pressure qᵤ = 300 kPa.', String.raw`q_u=\frac{1.2(1000)+1.6(1500)}{3(4)}=300\ \mathrm{kPa}`),
    S('The footing projection beyond the column face is 1.80 m.', String.raw`\ell=\frac{4-0.4}{2}=1.80\ \mathrm m`),
    S('Treat the projection as a uniformly loaded cantilever across the 3 m footing width.', String.raw`M_u=q_uB\frac{\ell^2}{2}=300(3)\frac{1.8^2}{2}=\boxed{1458\ \mathrm{kN\cdot m}}`),
  ]],
  ['28441a39-ac19-4fbe-b42f-2db19816e758', [
    S('Use the factored load and factored soil pressure.', String.raw`P_u=3600\ \mathrm{kN},\qquad q_u=300\ \mathrm{kPa}`),
    S('At an offset of 0.40 m from each column face, the enclosed area is 0.8 m × 0.8 m.', String.raw`A_{in}=(0.4+0.4)^2=0.64\ \mathrm{m^2}`),
    S('Subtract the upward soil reaction inside the critical perimeter.', String.raw`V_u=P_u-q_uA_{in}=3600-300(0.64)=\boxed{3408\ \mathrm{kN}}`),
  ]],
  ['8079fb46-5a9b-4bb9-b413-d4b30030e3f1', [
    S('The source key uses a 3.20 m critical perimeter and a 300 mm shear-resisting depth.', String.raw`b_o=4(0.4+0.4)=3.20\ \mathrm m,\qquad d_v=0.30\ \mathrm m`),
    S('For an interior square column, use the governing two-way concrete shear stress.', String.raw`v_c=\frac13\sqrt{f'_c}=\frac13\sqrt{35}=1.972\ \mathrm{MPa}`),
    S('Multiply the stress by the critical shear area.', String.raw`V_c=v_cb_od_v=1.972(3200)(300)=\boxed{1893\ \mathrm{kN}}`),
  ]],
  ['8996409f-9668-460f-8efa-7f149b3fc8cf', [
    S('Use the critical punching force Vᵤ = 3408 kN, perimeter bₒ = 3.20 m, and source-key shear depth dᵥ = 0.30 m.', String.raw`b_od_v=(3200)(300)=960000\ \mathrm{mm^2}`),
    S('Divide the punching demand by the critical shear area.', String.raw`v_u=\frac{3408\times10^3}{3200(300)}=\boxed{3.55\ \mathrm{MPa}}`),
  ]],
  ['f64c73ff-6dfc-4ae5-b755-cbc7337f89a2', [
    S('For an interior square column, evaluate the three NSCP two-way shear limits; the governing expression here is ⅓√f′c.', String.raw`v_c=\min\left[\frac16\left(1+\frac2\beta\right)\sqrt{f'_c},\ \frac1{12}\left(\frac{\alpha_sd}{b_o}+2\right)\sqrt{f'_c},\ \frac13\sqrt{f'_c}\right]`),
    S('With β = 1 and the stated interior-column geometry, substitute f′c = 35 MPa.', String.raw`v_c=\frac13\sqrt{35}=\boxed{1.97\ \mathrm{MPa}}`),
  ]],
  ['78eb8adc-f2f1-4b3c-91da-754493578400', [
    S('Use the 34 required 20 mm bars distributed across the 3 m footing width.', String.raw`n=34,\qquad B=3000\ \mathrm{mm}`),
    S('Compute the uniform center-to-center spacing and use the practical rounded spacing.', String.raw`s=\frac{B}{n}=\frac{3000}{34}=88.24\ \mathrm{mm}\approx\boxed{90\ \mathrm{mm}}`),
  ]],
]);

const titleGroups = {
  1: ['Direction-Cosine Product of a 3D Resultant','X-Component of a 3D Resultant','X-Component of Concurrent Forces','Magnitude of a 3D Force Resultant','Y-Component of Concurrent Forces','Angle between Two 3D Forces','Zero-Moment Location under Balanced Loading','Maximum Moment under Balanced Loading','Maximum Shear under Balanced Loading','Allowable Tension in Wire AC','Allowable Tension in Wire AB','Maximum Weight Supported by Two Wires','Friction Force on an Inclined Block','Force Required to Start Motion up an Incline','Acceleration from a Velocity Function','Distance Traveled from a Velocity Function','Launch Angle of the Second Projectile','Initial Speed of the Second Projectile','Circumferential Stress in a Thin-Walled Tank','Minimum Outside Diameter of a Hollow Shaft','Required Polar Moment of Inertia','Required Diameter of a Suspended Steel Rod','Truck Travel Time before Overtaking','Initial Car-to-Truck Separation','Car Speed at Overtaking'],
  2: ['Shear Stress at a Point in a Rectangular Beam','Maximum Shear Stress in a Rectangular Beam','Beam Shear One Meter from the Support','Maximum Shear in a Loaded Simple Beam','Maximum Flexural Stress in a Loaded Beam'],
  3: ['Required Tension-Steel Area','Required Number of 25 mm Tension Bars','Balanced Steel Ratio','Minimum Number of 25 mm Tension Bars','Governing Steel Ratio','Maximum Concrete Stress in a Cracked Beam','Neutral-Axis Depth by the Transformed-Section Method','Concrete Compression Resultant','Balanced Concrete Compression Force','Tension-Steel Strain in a T-Beam','Design Flexural Strength of a T-Beam','Allowable Midspan Service Live Load','T-Beam Compression-Block Depth','T-Beam Design Flexural Strength','Tension Bars for 135 kN·m','Tension Bars for 80 kN·m','Maximum Tension-Controlled Reinforcement'],
  4: ['Required Square Tied-Column Dimension','Smallest Tied-Column Dimension','Required Circular Spiral-Column Diameter','Balanced Eccentricity of a Reinforced Concrete Column'],
  5: ['Roof-Deck Lateral Force','Approximate Structural Period','Fourth-Floor Effective Spectral Acceleration','Design Compressive Strength of a Steel Column','Concrete Stress at Prestressing Tendon Level','Centroidal Prestress in a Rectangular Beam','Maximum Prestress Compression with Eccentricity','Maximum Shear Stress in a Wooden Joist','Simplified Design Base Shear'],
  6: ['Required 20 mm Footing Bars','Minimum 20 mm Footing Bars','Critical Factored One-Way Shear','Design Wide-Beam Shear Force','Critical Wide-Beam Shear Stress','Design One-Way Shear Stress','Critical Factored Footing Moment','Critical Factored Punching Shear','Design Punching Shear Force','Critical Punching Shear Stress','Design Two-Way Shear Stress','Spacing of 20 mm Footing Bars'],
};

const unitFixes = new Map([
  ['38256156-92e2-4156-b82d-2f1ab2efb63a','m/s²'], ['5a4a1ca2-041c-457b-bbb9-90cb7f2bde49','°'], ['be30978e-5233-4b4d-b912-a4dfaf0cdc1c','m/s'], ['f48b5a59-0e2e-4609-b024-a3a876ef2b2d','×10^6 mm⁴'], ['95231491-0512-4d41-9ec4-f50de7c68d00','m/s'], ['b05aeea3-8691-48e6-8088-288c3be06a82','MPa'], ['9dd53e08-eb55-48da-9c2e-945c4965f39d','mm²'], ['6bea872a-b208-478c-b9b0-064e7c29168b','bars'], ['ee4066e0-01d7-4041-8f6e-cbb5669f624a','bars'], ['7624a89a-694c-446c-8c44-4e57c15d63e6',''], ['83f8f564-953d-4e91-883b-4a36e60f1ced','kN·m'], ['91edfed6-bf69-4f0d-bce3-0cdb28963bef','kN'], ['1501f9f7-e5a0-4646-919c-e69bb61d987f','kN·m'], ['427a894d-c725-4336-9fe9-9cb4a46ed3a3','bars'], ['1eba6c36-563c-4394-ab52-b7b89ca161a2','bars'], ['e3a62e37-e388-460c-bf0b-e9d951a16927','bars'], ['fda1b75e-ae3c-49d9-b656-aaaed95fa0aa','mm'], ['e0d23864-bda6-4e20-b7be-f8cdff52e982','mm'], ['38b10367-2cc4-42fc-a721-678db526474e','m/s²'], ['a7f243f4-c4ac-43a1-9c28-0567ddd98936','kN'], ['e566bc1b-95e0-4a33-be3d-34281cb825bb','MPa'], ['73ba66a9-707b-477c-b066-787008e919bd','MPa'],
]);

const variantKinds = new Map([
  ['07917508-4e5e-4c6d-af57-bc5e5c6c0d6e','wire-supported-weight'], ['0d38bef9-9311-4583-8d08-9b28eb3c99e1','incline-friction'], ['38256156-92e2-4156-b82d-2f1ab2efb63a','particle-acceleration'], ['4e02eb58-3cc3-4f76-8192-38c3e93d03c4','thin-wall-hoop'], ['9b91f437-6b34-46d8-a271-fc12b6fcd730','beam-max-shear'], ['41163ddc-75a9-49cb-8617-b044973dd5af','rc-steel-ratio'], ['fda1b75e-ae3c-49d9-b656-aaaed95fa0aa','tied-column-size'], ['2346a84a-16bc-41a6-ae54-2a785e49d1cd','frame-period'], ['77558289-144c-4ae4-8546-16592417fcad','footing-moment'], ['6a18e1b7-31e9-4ced-9ed2-50a4cf4a7e0a','footing-one-way-shear'],
]);

const vectorDiagram = {
  title: 'Cartesian force components', caption: 'Generic 3D reference showing the force vector and its x, y, and z component directions. Use each problem’s coordinate triplets for the exact direction.',
  lines: [{x1:45,y1:70,x2:88,y2:70,dashed:false},{x1:45,y1:70,x2:20,y2:90,dashed:false},{x1:45,y1:70,x2:45,y2:12,dashed:false},{x1:45,y1:70,x2:72,y2:84,dashed:true},{x1:72,y1:84,x2:79,y2:39,dashed:true}],
  arrows: [{x1:45,y1:70,x2:79,y2:39,dashed:false},{x1:45,y1:70,x2:72,y2:84,dashed:false},{x1:72,y1:84,x2:79,y2:39,dashed:false}], circles:[{cx:45,cy:70,r:1.6,filled:true}], rectangles:[],
  labels:[{x:91,y:74,text:'+y, j',align:'end'},{x:16,y:94,text:'+x, i',align:'start'},{x:48,y:11,text:'+z, k',align:'start'},{x:67,y:45,text:'F',align:'middle'},{x:59,y:88,text:'Fx i + Fy j',align:'middle'},{x:82,y:60,text:'Fz k',align:'start'}],
};

function normalizePrompt(text) {
  return String(text || '').normalize('NFKC')
    .replace(/\bF(?:²|2)\b/g, 'F₂').replace(/\bF1\b/g, 'F₁').replace(/\bF3\b/g, 'F₃')
    .replace(/\bt2\b/g, 't²').replace(/\bf[;']?c\b|\bfc[’′]\b|\bF[’′]c\b/g, 'f′c')
    .replace(/\ba²%/g, 'a 2%').replace(/\bMpa\b/g, 'MPa')
    .replace(/(\d)\s*(mm|cm|m)\s*[xX]\s*(?=\d)/g, '$1 $2 × ')
    .replace(/(\d)(mm|MPa|GPa|kN|m)\b/g, '$1 $2').replace(/\s+/g, ' ').trim();
}

let repaired = 0, renamed = 0, variants = 0, duplicatesRemoved = 0;
db.exec('BEGIN');
try {
  const sourceById = new Map();
  for (const entry of questions.filter(entry => entry.value.pool && entry.value.spex === 'A')) {
    const q = entry.value;
    const title = titleGroups[q.set]?.[q.sourcePage - 1];
    if (title && q.title !== title) { q.title = title; renamed++; }
    q.prompt = normalizePrompt(q.prompt);
    if (q.set === 3 && q.sourcePage === 2) q.prompt = q.prompt.replace('Determine the maximum number', 'Determine the required number');
    if (q.set === 3 && q.sourcePage === 9) q.prompt = 'For the 250 mm × 400 mm reinforced-concrete column shown in the source, use d′ = 65 mm, six 25 mm bars, fy = 415 MPa, f′c = 27 MPa, Es = 200,000 MPa, and εcu = 0.003. Determine the nominal concrete compression force at balanced strain.';
    if (q.set === 5 && q.sourcePage === 2) q.prompt = 'A five-story steel moment-resisting frame has five 3 m stories, for a total height of 15 m. Using the NSCP approximate-period coefficient Ct = 0.0853, determine the structural period T.';
    if (q.set === 5 && q.sourcePage === 9) q.prompt = 'A two-story reinforced-concrete moment-resisting frame with roof deck is located in Sampaloc, Manila, 8 km from the nearest Seismic Source Type A. Use Soil Profile SD, R = 8.5, and seismic weight W = 2700 kN. Using the simplified static-force procedure, determine the design base shear.';
    if (q.set === 6 && q.sourcePage >= 3 && q.sourcePage <= 11) q.prompt = normalizePrompt(q.prompt.replace('and effective depth d = 400 mm.', 'Use a 400 mm offset to locate the critical section and the source key’s 300 mm shear-resisting depth where a shear stress or strength is required.'));
    if (unitFixes.has(q.id)) q.unit = unitFixes.get(q.id);
    if (exactSolutions.has(q.id)) { q.steps = exactSolutions.get(q.id); q.solutionQuality = 'worked'; repaired++; }
    if (variantKinds.has(q.id)) { q.offlineVariant = variantKinds.get(q.id); variants++; }
    if (q.set === 1 && q.sourcePage <= 6) q.diagram = vectorDiagram;
    putQuestion.run(JSON.stringify(q), q.id);
    sourceById.set(q.id, q);
  }
  for (const entry of questions.filter(entry => !entry.value.pool && entry.value.sourceBankQuestionId && sourceById.has(entry.value.sourceBankQuestionId))) {
    const source = sourceById.get(entry.value.sourceBankQuestionId), q = entry.value;
    for (const key of ['title','topic','prompt','answer','unit','tolerance','steps','solutionQuality','offlineVariant','diagram','diagramImage']) q[key] = source[key];
    putQuestion.run(JSON.stringify(q), q.id);
  }

  const psadItems = items.filter(entry => entry.value.spex === 'A').sort((a,b) => a.value.set-b.value.set || a.value.page-b.value.page || a.value.id.localeCompare(b.value.id));
  const key = item => `${String(item.title||'').toLowerCase().replace(/\s+/g,'')}|${String(item.latex||'').toLowerCase().replace(/\s+/g,'').replace(/[{}]/g,'')}`;
  const seen = new Set();
  for (const entry of psadItems) {
    const item = entry.value;
    item.title = normalizePrompt(item.title); item.topic = normalizePrompt(item.topic); item.conditions = normalizePrompt(item.conditions);
    if (item.kind === 'formula') {
      const signature = key(item);
      if (seen.has(signature)) { remove.run('items', item.id); duplicatesRemoved++; continue; }
      seen.add(signature);
    }
    putItem.run(JSON.stringify(item), item.id);
  }

  const stray = documents.find(entry => entry.value.spex === 'A' && entry.value.name === 'source.pdf');
  if (stray) {
    for (const collection of ['items','pages','questions']) for (const row of read(collection).filter(entry => entry.value.docId === stray.value.id || entry.value.sourceDocId === stray.value.id)) remove.run(collection, row.value.id);
    remove.run('documents', stray.value.id);
  }
  db.exec('COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }

console.log(`PSAD cleanup complete: ${repaired} detailed solutions, ${renamed} concise titles, ${variants} new variation templates, ${duplicatesRemoved} exact duplicate formulas removed.`);
