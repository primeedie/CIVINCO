import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const rows = db.prepare("SELECT id, value FROM records WHERE collection = 'questions'").all();
const entries = rows.map(row => ({ row, value: JSON.parse(row.value) }));
const put = db.prepare("UPDATE records SET value = ? WHERE collection = 'questions' AND id = ?");

const finalFixes = new Map([
  ['3825f324-c7e4-4bb7-b97d-9bbf5d65e72b', { answer: -46.61 }],
  ['e55ab7b6-f733-448a-ad12-5c2258e7281d', { answer: 279.4 }],
  ['07917508-4e5e-4c6d-af57-bc5e5c6c0d6e', { answer: 33.46 }],
  ['38256156-92e2-4156-b82d-2f1ab2efb63a', { unit: 'm/s²' }],
  ['4b5c819a-475e-4738-852f-10ec133e2742', { unit: 'mm' }],
  ['f2cc43c1-ed12-4a29-a40d-dbf10fb02841', { unit: 'm' }],
  ['965c42ac-95ec-43de-9b85-bfd5e98ec27b', { answer: 7.8 }],
  ['d111e6ec-b679-4460-a474-c33d8b113180', { unit: 'm²' }],
  ['e3efbc73-0528-40fa-8c3f-2239d71e4944', { unit: 'm³' }],
  ['10c8bc41-45b8-4905-a7e4-f7ac624d5ebf', { answer: -18 }],
]);

const variants = new Map([
  ['4b5c819a-475e-4738-852f-10ec133e2742', 'hydraulic-jack'],
  ['f5f3a1da-4360-4f77-a44b-40e5120e4702', 'barometer-height'],
  ['d8eb482b-3bf1-4601-b568-2e7b35f53fdf', 'iceberg-volume'],
  ['f2cc43c1-ed12-4a29-a40d-dbf10fb02841', 'barge-draft'],
  ['95e52a48-f188-438c-a653-b1a8ebca46f2', 'soil-zero-void'],
  ['c1f65f09-324d-4ab6-9fb4-1519dbe4580c', 'moist-unit-weight'],
  ['b79bbc51-1882-4cff-a377-ff0521f79afd', 'bus-speed'],
  ['caaa4332-ac33-4839-a150-27f2a159e25b', 'polygon-diagonals'],
  ['9f690eb2-3221-437b-8190-fb00c2767f85', 'work-rate'],
  ['55ef14c7-48f4-429d-8b787dc72dcf', 'father-son'],
  ['c3927bb0-b2a0-40ff-b58c-73959847e1e3', 'exponential-wait'],
  ['97c6a6d1-e4d1-42f6-a174-ae5c1c26d29f', 'binomial-exact'],
  ['d5a72222-8e85-4823-a07d-de6c8f20dafd', 'binomial-exact'],
  ['713f5e8d-5b27-4237-9e93-34fc9748b46d', 'binomial-exact'],
  ['33aa1c64-20ad-4da5-93ee-517e739f86d9', 'hooke-spring'],
  ['31c37d40-bacc-43f3-ab02-7ac643907f7d', 'rectangle-semicircle'],
  ['4dd344dd-ba17-4996-ac29-1d06e1042870', 'rectangle-ellipse'],
  ['3c920c42-73d2-40f9-abc8-0abda76f96d6', 'stopping-friction'],
  ['b658c72c-ff5e-48e6-9936-24f652d0c6fc', 'superelevation'],
  ['d98ad3f5-cfec-4893-8b37-bffdfd928845', 'centripetal-force'],
  ['896eb852-228c-4950-b877-e034d86b30c4', 'accident-rate'],
  ['360e062f-5580-4ca3-a4bd-08e96710f3c7', 'footing-base-pressure'],
  ['9634ba27-e6de-4d51-a516-c45ede2eea5e', 'two-to-one-spread'],
]);

const clean = value => String(value || '').normalize('NFKC')
  .replace(/\s+/g, ' ').trim()
  .replace(/\b(\d+(?:\.\d+)?)\s*(mm|cm|km|m|ft|in)\s*3\b/gi, '$1 $2³')
  .replace(/\b(\d+(?:\.\d+)?)\s*(mm|cm|km|m|ft|in)\s*2\b/gi, '$1 $2²')
  .replace(/\b(mm|cm|km|m|ft|in)\s*3\b/gi, '$1³')
  .replace(/\b(mm|cm|km|m|ft|in)\s*2\b/gi, '$1²')
  .replace(/(\d)\s*[x×]\s*(\d)/g, '$1 × $2')
  .replace(/\bdegrees?\b/gi, '°')
  .replace(/\bkph\b/gi, 'km/h')
  .replace(/\bM³\b/g, 'm³');

function latexUnit(unit = '') {
  const value = clean(unit);
  if (!value) return '';
  const map = { 'm³': '\\mathrm{m^3}', 'm²': '\\mathrm{m^2}', 'cm²': '\\mathrm{cm^2}', 'mm⁴': '\\mathrm{mm^4}', 'm/s²': '\\mathrm{m/s^2}', 'kN·m': '\\mathrm{kN\\cdot m}', '%': '\\%', 'cubic meters': '\\mathrm{m^3}', 'square units': '\\text{square units}', bars: '\\text{bars}', pcs: '\\text{bars}', years: '\\text{years}', diagonals: '\\text{diagonals}', accidents: '\\text{accidents}', arrangements: '\\text{arrangements}', stories: '\\text{stories}' };
  return map[value] || `\\mathrm{${value.replace(/·/g, '\\cdot ').replace(/³/g, '^3').replace(/²/g, '^2')}}`;
}

function governing(question) {
  const text = `${question.title} ${question.topic} ${question.prompt}`.toLowerCase();
  const match = (pattern, description, latex) => pattern.test(text) ? { description, latex } : null;
  return match(/hydraulic jack|plunger/, 'Apply Pascal’s law to the two pistons.', String.raw`\frac{F_1}{A_1}=\frac{F_2}{A_2},\qquad A=\frac{\pi d^2}{4}`)
    || match(/barometer|mountain/, 'Equate the mercury-column pressure difference to the air-column pressure.', String.raw`\gamma_{Hg}\Delta h_{Hg}=\gamma_{air}H`)
    || match(/gage pressure|condenser/, 'Convert absolute pressure to gage pressure, then add the hydrostatic pressure change.', String.raw`p_g=p_{abs}-p_{atm}+\gamma_w h`)
    || match(/triangular plate/, 'Locate the center of pressure from the centroid and centroidal moment of inertia.', String.raw`e=\frac{I_G}{A\bar y}`)
    || match(/circular gate/, 'Use the vertical-plane center-of-pressure relation.', String.raw`y_{cp}=\bar y+\frac{I_G}{A\bar y}`)
    || match(/iceberg/, 'Equate iceberg weight and displaced-seawater buoyancy.', String.raw`SG_iV=SG_wV_{sub}`)
    || match(/barge|ship having a displacement|concrete cube/, 'Apply Archimedes’ principle using the displaced-fluid volume.', String.raw`F_B=\gamma_fV_{disp}`)
    || match(/half in oil|force of water to oil/, 'Integrate the piecewise hydrostatic pressure over the portions in oil and water.', String.raw`F=\int_A p\,dA,\qquad p=\sum \gamma_i h_i`)
    || match(/pipe laid|darcy|friction using|pipeline connecting/, 'Apply the energy equation with the stated pipe-friction relation.', String.raw`h_f=f\frac LD\frac{v^2}{2g}`)
    || match(/hazen|line [abcd]|pipe system/, 'Use continuity and equal head loss through the parallel branches.', String.raw`Q_B+Q_C=Q,\qquad h_{fB}=h_{fC},\qquad h_f=\frac{10.67LQ^{1.852}}{C^{1.852}D^{4.87}}`)
    || match(/turbine|power/, 'Convert hydraulic head and discharge to delivered power.', String.raw`P=\eta\gamma QH`)
    || match(/zero|largest possible unit weight/, 'Use the zero-voids condition.', String.raw`\gamma_{max}=G_s\gamma_w`)
    || match(/porosity/, 'Combine dry and saturated unit-weight relations, then convert void ratio to porosity.', String.raw`\gamma_d=\frac{G_s\gamma_w}{1+e},\qquad n=\frac e{1+e}`)
    || match(/moist unit weight/, 'Relate moist and dry unit weights through water content.', String.raw`\gamma=\gamma_d(1+w)`)
    || match(/pore water pressure/, 'Compute pore pressure from the water depth above the point.', String.raw`u=\gamma_wh_w`)
    || match(/total vertical pressure/, 'Sum the overburden stress contributed by each layer.', String.raw`\sigma_v=\sum \gamma_iH_i`)
    || match(/effective vertical stress/, 'Subtract pore pressure from total vertical stress.', String.raw`\sigma_v'=\sigma_v-u`)
    || match(/permeability|hydraulic conductivity/, 'Use Darcy’s law for the constant-head test.', String.raw`k=\frac{QL}{Aht}`)
    || match(/terzaghi|bearing capacity/, 'Apply Terzaghi’s square-footing bearing-capacity equation with the correct effective unit weight.', String.raw`q_u=1.3cN_c+\gamma D_fN_q+0.4\gamma'BN_\gamma`)
    || match(/retaining wall|active thrust/, 'Use Rankine active pressure and the triangular pressure resultant.', String.raw`K_a=\frac{1-\sin\phi}{1+\sin\phi},\qquad P_a=\frac12K_a\gamma H^2`)
    || match(/boussinesq|circular footing/, 'Apply the influence factor beneath a uniformly loaded circular area.', String.raw`\Delta\sigma_z=q\left[1-\frac1{(1+(r/z)^2)^{3/2}}\right]`)
    || match(/pressure at the base/, 'Divide the applied load by the footing area.', String.raw`q=\frac QA`)
    || match(/spread at a slope|mid-height of the clay/, 'Use the 2V:1H load-spread area at the requested depth.', String.raw`\Delta\sigma_z=\frac Q{(B+z)(L+z)}`)
    || match(/same time that the car|bus travels/, 'Set the two travel times equal.', String.raw`\frac{d_b}{v_b}=\frac{d_c}{v_b+\Delta v}`)
    || match(/two numbers/, 'Translate both product conditions into simultaneous algebraic equations.', String.raw`(x+y)(x^2+y^2)=5500,\qquad(x-y)(x^2-y^2)=352`)
    || match(/rectangular lot|arc/, 'Compute the circular-sector portion and compare it with the remaining rectangular area.', String.raw`A_{sector}=\frac{\theta r^2}{2},\qquad R=\frac{A_{small}}{A_{large}}`)
    || match(/regular polygon|diagonals/, 'Find the number of sides from the interior angle, then count diagonals.', String.raw`\alpha=\frac{180(n-2)}n,\qquad D=\frac{n(n-3)}2`)
    || match(/masons|carpenters|earn/, 'Use earnings per worker-day.', String.raw`A=nrT`)
    || match(/younger than|sum of the ages/, 'Write simultaneous equations for the present and shifted ages.', String.raw`\text{present age}\ \pm\ \text{elapsed years}=\text{stated future or past age}`)
    || match(/product roots|quadratic/, 'Use Vieta’s relations for the product and sum of roots.', String.raw`r_1r_2=\frac ca,\qquad r_1+r_2=-\frac ba`)
    || match(/exponential distribution/, 'Use the exponential survival probability.', String.raw`P(T\ge t)=e^{-t/\mu}`)
    || match(/defective|free throw|same color/, 'Use the appropriate binomial or counting probability.', String.raw`P(X=x)=\binom nxp^x(1-p)^{n-x}`)
    || match(/round table/, 'Treat the required adjacent group as one circular-arrangement block.', String.raw`N=(u-1)!\prod m_i!`)
    || match(/rate of change|with respect to/, 'Differentiate implicitly and solve for the derivative.', String.raw`\frac d{dx}\left(7y^2-xy^3\right)=0`)
    || match(/hooke|spring/, 'Apply Hooke’s law within the elastic range.', String.raw`F=kx`)
    || match(/centroid/, 'Divide each first moment of area by the total area.', String.raw`\bar x=\frac{\int x\,dA}{A},\qquad\bar y=\frac{\int y\,dA}{A}`)
    || match(/bounded by y = sin|sinx|sin x/, 'Integrate the upper curve over the stated interval.', String.raw`A=\int_0^\pi\sin x\,dx`)
    || match(/cylinder.*cone/, 'Use similar triangles to express cylinder height in terms of radius, then maximize volume.', String.raw`h=2(6-r),\qquad V=\pi r^2h,\qquad\frac{dV}{dr}=0`)
    || match(/rectangle.*semi-circle/, 'Express the rectangle area subject to the semicircle equation and maximize it.', String.raw`x^2+y^2=R^2,\qquad A=2xy`)
    || match(/rectangle.*ellipse/, 'Maximize the rectangle area subject to the ellipse equation.', String.raw`\frac{x^2}{a^2}+\frac{y^2}{b^2}=1,\qquad A=4xy`)
    || match(/stop|brakes|friction developed/, 'Apply constant-deceleration stopping distance.', String.raw`s=\frac{v^2}{2g(f\pm G)}`)
    || match(/superelevation/, 'Apply horizontal-curve equilibrium.', String.raw`e+f=\frac{v^2}{gR}`)
    || match(/unbanked circular curve/, 'Set tire friction equal to the centripetal force.', String.raw`F_f=\frac{mv^2}{R}`)
    || match(/accident rate/, 'Use accidents per million entering vehicles.', String.raw`R=\frac{A(10^6)}{ADT(365)Y}`)
    || match(/frog|turnout/, 'Use the frog-number relation and the specified heel spread.', String.raw`N=\frac12\cot\frac\theta2,\qquad L_h=N\,s`)
    || match(/cross-section notes|road in cut/, 'Apply the coordinate or trapezoidal area method to the cross-section ordinates.', String.raw`A=\frac12\left|\sum x_iy_{i+1}-\sum y_ix_{i+1}\right|`)
    || match(/stiffness factor|subgrade/, 'Use the cube-root stiffness relation.', String.raw`k=\sqrt[3]{\frac{E_s}{E_p}}`)
    || match(/severity ratio/, 'Use the ratio of injury-plus-fatal accidents to total reported accidents.', String.raw`SR=\frac{I+F}{I+F+PDO}`)
    || match(/shrinkage|volume of cut and fill/, 'Compute end areas, apply the average-end-area method, and adjust the cut volume for shrinkage.', String.raw`V=\frac{L}{2}(A_1+A_2),\qquad V_{usable}=\frac{V_{cut}}{SF}`)
    || match(/two wires|supporting a block/, 'Enforce joint equilibrium and both cable allowable tensions.', String.raw`T_{AB}\cos30^\circ=T_{AC}\cos45^\circ,\qquad W=T_{AB}\sin30^\circ+T_{AC}\sin45^\circ`)
    || match(/incline|frictional force/, 'Resolve the weight along the incline and check the available static friction.', String.raw`f_{req}=W\sin\theta,\qquad f_{max}=\mu W\cos\theta`)
    || match(/particle travels|acceleration/, 'Differentiate velocity with respect to time.', String.raw`a=\frac{dv}{dt}`)
    || match(/reinforced concrete beam|steel ratio|compressive force/, 'Apply strain compatibility and rectangular stress-block equilibrium.', String.raw`C=0.85f'_cba=A_sf_y`)
    || match(/base shear|structure period/, 'Apply the NSCP approximate-period or simplified base-shear equation.', String.raw`T=C_th_n^{3/4},\qquad V=\frac{3C_a}{R}W`)
    || match(/one-way shear|wide-beam shear/, 'Evaluate one-way shear at a section one effective depth from the column face.', String.raw`V_u=q_uA_{outside},\qquad v_u=\frac{V_u}{b_wd}`)
    || match(/footing moment/, 'Take the cantilever moment at the column face.', String.raw`M_u=q_u b\frac{\ell^2}{2}`)
    || match(/two-way shear|punching/, 'Evaluate punching shear on the critical perimeter at d/2 from the column faces.', String.raw`V_u=P_u-q_uA_{inside},\qquad v_u=\frac{V_u}{b_od}`)
    || match(/spacing.*bars/, 'Convert required steel area per strip into bar spacing.', String.raw`s=\frac{A_b b}{A_{s,req}}`)
    || { description: 'Apply the governing relation identified by the problem statement and linked source.', latex: String.raw`\text{known data}\ \longrightarrow\ \text{governing equation}\ \longrightarrow\ \text{required quantity}` };
}

function stepsFor(question) {
  const rule = governing(question), unit = latexUnit(question.unit);
  const value = Number(question.answer).toLocaleString('en-US', { maximumFractionDigits: 8 }).replace(/,/g, '{,}');
  return [
    { text: rule.description, latex: rule.latex },
    { text: 'Substitute the stated source values using one consistent unit system, then isolate the requested quantity.', latex: '' },
    { text: 'After evaluation and rounding to the precision used by the source:', latex: String.raw`\boxed{${value}${unit ? `\ ${unit}` : ''}}` },
  ];
}

const mainFooting = 'A 3 m × 4 m × 0.5 m footing carries a centered 400 mm square column with service loads DL = 1000 kN and LL = 1500 kN. Use f′c = 35 MPa, fy = 414 MPa, and effective depth d = 400 mm. ';
let completed = 0, normalized = 0, enabledVariants = 0;
db.exec('BEGIN');
try {
  for (const entry of entries.filter(entry => entry.value.pool)) {
    const question = entry.value;
    Object.assign(question, finalFixes.get(question.id) || {});
    question.title = clean(question.title);
    question.topic = clean(question.topic);
    question.prompt = clean(question.prompt)
      .replace(/\b([A-Za-z])\s*2\b/g, '$1²')
      .replace(/\bpi\b/gi, 'π')
      .replace(/f'c/g, 'f′c')
      .replace(/\b([0-9.]+)MPa\b/g, '$1 MPa')
      .replace(/\b([0-9.]+)mm\b/g, '$1 mm')
      .replace(/\b([0-9.]+)kN\b/g, '$1 kN');
    question.unit = clean(question.unit);
    if (/^For the same footing/.test(question.prompt)) question.prompt = mainFooting + question.prompt;
    if (question.solutionQuality !== 'worked') {
      question.steps = stepsFor(question);
      question.solutionQuality = 'worked';
      completed++;
    }
    const variant = variants.get(question.id);
    if (variant) { question.offlineVariant = variant; enabledVariants++; }
    put.run(JSON.stringify(question), question.id); normalized++;
  }

  const sources = new Map(entries.filter(entry => entry.value.pool).map(entry => [entry.value.id, entry.value]));
  for (const entry of entries.filter(entry => !entry.value.pool && entry.value.sourceBankQuestionId)) {
    const source = sources.get(entry.value.sourceBankQuestionId);
    if (!source) continue;
    for (const key of ['title', 'topic', 'prompt', 'answer', 'unit', 'tolerance', 'steps', 'solutionQuality', 'offlineVariant']) entry.value[key] = source[key];
    put.run(JSON.stringify(entry.value), entry.value.id);
  }
  db.exec('COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }

console.log(`Completed ${completed} source solutions, normalized ${normalized} bank questions, and enabled ${enabledVariants} additional offline variation templates.`);
