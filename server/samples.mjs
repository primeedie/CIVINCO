import { randomUUID } from 'node:crypto';

const v = (symbol, meaning, unit = '') => ({ symbol, meaning, unit });
const formulas = [
  ['A', 'Angle of friction', 'Friction', String.raw`\tan\theta = \frac{f}{N}`, [v(String.raw`\theta`, 'Angle of friction', '°'), v('f', 'Limiting friction force', 'N'), v('N', 'Normal reaction force', 'N')], 'At impending sliding, f = μₛN; θ is the limiting friction angle.'],
  ['A', 'Limiting static friction', 'Friction', String.raw`f_{\max} = \mu_s N`, [v(String.raw`f_{\max}`, 'Maximum static friction force', 'N'), v(String.raw`\mu_s`, 'Coefficient of static friction'), v('N', 'Normal reaction force', 'N')], 'Before slipping, actual static friction satisfies 0 ≤ f ≤ μₛN.'],
  ['A', 'Planar force equilibrium', 'Statics', String.raw`\sum F_x = 0, \qquad \sum F_y = 0`, [v('F_x', 'Horizontal component of each external force', 'N'), v('F_y', 'Vertical component of each external force', 'N')], 'For a body in planar static equilibrium; use a consistent sign convention.'],
  ['A', 'Moment equilibrium', 'Statics', String.raw`\sum M_O = 0`, [v('M_O', 'Moment of each external force or couple about O', 'N·m')], 'For a body in static equilibrium; choose clockwise or counterclockwise positive.'],
  ['A', 'Average normal stress', 'Mechanics of materials', String.raw`\sigma = \frac{P}{A}`, [v(String.raw`\sigma`, 'Average normal stress', 'Pa'), v('P', 'Axial load', 'N'), v('A', 'Cross-sectional area', 'm²')], 'Centric axial loading; average stress over the section.'],
  ['B', 'Quadratic formula', 'Algebra', String.raw`x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}`, [v('x', 'Root of the quadratic'), v('a,b,c', 'Coefficients of ax² + bx + c = 0')], 'a ≠ 0. Real roots require b² − 4ac ≥ 0.'],
  ['B', 'Compound amount', 'Engineering economy', String.raw`F = P(1+i)^n`, [v('F', 'Future amount', '₱'), v('P', 'Present amount', '₱'), v('i', 'Interest rate per period, as a decimal'), v('n', 'Number of compounding periods')], 'Fixed rate; no intermediate deposits or withdrawals.'],
  ['B', 'Distance from coordinates', 'Surveying', String.raw`d = \sqrt{(x_2-x_1)^2+(y_2-y_1)^2}`, [v('d', 'Horizontal distance', 'm'), v('x_1,y_1', 'Coordinates of the first point', 'm'), v('x_2,y_2', 'Coordinates of the second point', 'm')], 'Planar Cartesian coordinates in a common unit.'],
  ['C', 'Hydrostatic gauge pressure', 'Hydrostatics', String.raw`p = \rho g h`, [v('p', 'Gauge pressure', 'Pa'), v(String.raw`\rho`, 'Fluid density', 'kg/m³'), v('g', 'Gravitational acceleration', 'm/s²'), v('h', 'Depth below the free surface', 'm')], 'Constant-density fluid at rest; free surface open to atmospheric pressure.'],
  ['C', 'Discharge continuity', 'Fluid flow', String.raw`Q = Av`, [v('Q', 'Volumetric discharge', 'm³/s'), v('A', 'Flow cross-sectional area', 'm²'), v('v', 'Mean velocity normal to the section', 'm/s')], 'Mean velocity across the section. For steady incompressible flow, A₁v₁ = A₂v₂.'],
  ['C', 'Effective stress', 'Soil mechanics', String.raw`\sigma^{\prime} = \sigma - u`, [v(String.raw`\sigma^{\prime}`, 'Effective normal stress', 'kPa'), v(String.raw`\sigma`, 'Total normal stress', 'kPa'), v('u', 'Pore-water pressure', 'kPa')], 'Terzaghi effective stress principle for saturated soil.'],
  ['C', 'Void ratio', 'Soil mechanics', String.raw`e = \frac{V_v}{V_s}`, [v('e', 'Void ratio'), v('V_v', 'Volume of voids', 'm³'), v('V_s', 'Volume of solids', 'm³')], 'Void volume includes air and water; Vₛ > 0.'],
];
const concepts = [
  ['A', 'Static friction adjusts', 'Friction', 'Static friction balances the required tangential force up to its limiting value. Use f = μₛN only when sliding is impending; otherwise use f ≤ μₛN.'],
  ['A', 'Start with a free-body diagram', 'Statics', 'Isolate the body. Replace every support and contact with its external forces and couples, then choose axes and a sign convention before writing equilibrium equations.'],
  ['A', 'Stress is force per area', 'Mechanics of materials', 'Normal stress acts perpendicular to a section; shear stress acts parallel. Average axial stress assumes a centric load and is not a local stress concentration.'],
  ['B', 'Match the interest period', 'Engineering economy', 'The interest rate and number of periods must use the same time basis. For an annual effective rate, count years; for a monthly effective rate, count months.'],
  ['B', 'Coordinate distance', 'Surveying', 'Horizontal distance comes from the two perpendicular coordinate differences. Keep all coordinates in the same reference system and units.'],
  ['C', 'Gauge versus absolute pressure', 'Hydrostatics', 'Gauge pressure is measured relative to local atmospheric pressure. Add atmospheric pressure to gauge pressure to obtain absolute pressure.'],
  ['C', 'Effective stress governs the soil skeleton', 'Soil mechanics', 'The mineral skeleton carries effective stress. For saturated soil, subtract pore-water pressure from total normal stress to find effective normal stress.'],
];
export function addSamples(store) {
  if (store.all('documents').some(d => d.sample)) return;
  store.transaction(() => {
    for (const spex of ['A', 'B', 'C']) {
      store.put('documents', { id: `sample-${spex}`, name: `${{ A: 'PSAD', B: 'MSTE', C: 'HGE' }[spex]} · Starter reference`, spex, set: 1, kind: 'Reference', sample: true, size: 0, totalPages: 1, createdAt: new Date().toISOString(), status: 'sample', error: '' });
    }
    for (const [spex, title, topic, latex, variables, conditions] of formulas) {
      store.put('items', { id: randomUUID(), docId: `sample-${spex}`, spex, set: 1, page: 1, kind: 'formula', title, topic, latex, variables, conditions, uncertain: false, note: '', reviewed: true, sample: true });
    }
    for (const [spex, title, topic, explanation] of concepts) {
      store.put('items', { id: randomUUID(), docId: `sample-${spex}`, spex, set: 1, page: 1, kind: 'concept', title, topic, explanation, reviewed: true, sample: true });
    }
  });
}
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const blankDiagram = () => ({ title: '', caption: '', lines: [], arrows: [], circles: [], rectangles: [], labels: [] });
export function sampleQuestions(items, count = 5) {
  const eligible = items.filter(i => i.sample && ['Angle of friction', 'Average normal stress', 'Compound amount', 'Distance from coordinates', 'Hydrostatic gauge pressure', 'Effective stress'].includes(i.title));
  if (!eligible.length) return [];
  return Array.from({ length: count }, (_, n) => {
    const item = eligible[n % eligible.length];
    let prompt, answer, unit, steps, diagram = blankDiagram();
    if (item.title === 'Angle of friction') {
      const normal = rand(4, 16) * 100, force = rand(2, 6) * 50;
      prompt = `A block is on the verge of sliding. Its limiting friction force is ${force} N and its normal reaction is ${normal} N. Find the angle of friction in degrees.`;
      answer = Math.atan(force / normal) * 180 / Math.PI; unit = '°';
      steps = [{ text: 'At impending sliding, use the ratio of limiting friction to normal reaction.', latex: String.raw`\tan\theta = \frac{f}{N}` }, { text: 'Take the inverse tangent in degree mode.', latex: String.raw`\theta = \tan^{-1}\left(\frac{${force}}{${normal}}\right) = ${answer.toFixed(3)}^\circ` }];
      diagram = { title: 'Free-body diagram', caption: 'Block at impending motion on a horizontal surface.', lines: [{ x1: 10, y1: 80, x2: 90, y2: 80, dashed: false }], arrows: [{ x1: 50, y1: 48, x2: 50, y2: 20, dashed: false }, { x1: 50, y1: 62, x2: 20, y2: 62, dashed: false }], circles: [], rectangles: [{ x: 38, y: 48, width: 24, height: 24, filled: true }], labels: [{ x: 53, y: 20, text: `N = ${normal} N`, align: 'start' }, { x: 18, y: 58, text: `f = ${force} N`, align: 'start' }] };
    } else if (item.title === 'Average normal stress') {
      const load = rand(10, 60), area = rand(2, 10) * 100;
      prompt = `A straight bar carries a centric axial load of ${load} kN. Its cross-sectional area is ${area} mm². Find the average normal stress in MPa.`;
      answer = load * 1000 / area; unit = 'MPa';
      steps = [{ text: 'Convert kN to N; N/mm² is equivalent to MPa.', latex: String.raw`P = ${load}\times 1000\ \mathrm{N}` }, { text: 'Divide the axial load by the area.', latex: String.raw`\sigma = \frac{${load * 1000}}{${area}} = ${answer.toFixed(3)}\ \mathrm{MPa}` }];
      diagram = { title: 'Axially loaded bar', caption: 'Centric tensile load acting through the bar axis.', lines: [{ x1: 18, y1: 50, x2: 82, y2: 50, dashed: true }], arrows: [{ x1: 30, y1: 50, x2: 10, y2: 50, dashed: false }, { x1: 70, y1: 50, x2: 90, y2: 50, dashed: false }], circles: [], rectangles: [{ x: 30, y: 38, width: 40, height: 24, filled: true }], labels: [{ x: 8, y: 45, text: `P = ${load} kN`, align: 'start' }, { x: 92, y: 45, text: `P = ${load} kN`, align: 'end' }, { x: 50, y: 72, text: `A = ${area} mm²`, align: 'middle' }] };
    } else if (item.title === 'Compound amount') {
      const principal = rand(5, 20) * 1000, rate = rand(3, 9), years = rand(2, 6);
      prompt = `An amount of ₱${principal.toLocaleString('en-US')} earns ${rate}% effective annual interest for ${years} years, with no additional cash flows. Find its future value in pesos.`;
      answer = principal * (1 + rate / 100) ** years; unit = '₱';
      steps = [{ text: 'Use the annual rate as a decimal and years as periods.', latex: String.raw`F = P(1+i)^n` }, { text: 'Substitute and compound.', latex: String.raw`F = ${principal}(1+${rate / 100})^{${years}} = ${answer.toFixed(2)}` }];
    } else if (item.title === 'Distance from coordinates') {
      const x = rand(3, 16), y = rand(3, 16);
      prompt = `Two survey stations have coordinates (0, 0) m and (${x}, ${y}) m. Find their horizontal separation in metres.`;
      answer = Math.hypot(x, y); unit = 'm';
      steps = [{ text: 'Apply the planar distance formula.', latex: String.raw`d = \sqrt{(x_2-x_1)^2+(y_2-y_1)^2}` }, { text: 'Substitute the coordinate differences.', latex: String.raw`d = \sqrt{${x}^2+${y}^2} = ${answer.toFixed(3)}\ \mathrm{m}` }];
      diagram = { title: 'Survey station layout', caption: 'Coordinate differences form a right triangle.', lines: [{ x1: 18, y1: 78, x2: 78, y2: 78, dashed: true }, { x1: 78, y1: 78, x2: 78, y2: 22, dashed: true }, { x1: 18, y1: 78, x2: 78, y2: 22, dashed: false }], arrows: [], circles: [{ cx: 18, cy: 78, r: 2, filled: true }, { cx: 78, cy: 22, r: 2, filled: true }], rectangles: [], labels: [{ x: 15, y: 87, text: 'A (0, 0)', align: 'start' }, { x: 82, y: 20, text: `B (${x}, ${y})`, align: 'start' }, { x: 48, y: 88, text: `${x} m`, align: 'middle' }, { x: 82, y: 53, text: `${y} m`, align: 'start' }] };
    } else if (item.title === 'Hydrostatic gauge pressure') {
      const depth = rand(2, 15);
      prompt = `Find the gauge pressure ${depth} m below the free surface of a tank of water open to the atmosphere. Use ρ = 1000 kg/m³ and g = 9.81 m/s². Answer in kPa.`;
      answer = 9.81 * depth; unit = 'kPa';
      steps = [{ text: 'Pressure increases with depth in a fluid at rest.', latex: String.raw`p = \rho gh` }, { text: 'Divide Pa by 1000 to obtain kPa.', latex: String.raw`p = \frac{1000(9.81)(${depth})}{1000} = ${answer.toFixed(3)}\ \mathrm{kPa}` }];
    } else {
      const total = rand(12, 30) * 10, water = rand(3, 10) * 10;
      prompt = `At a point in saturated soil, the total vertical stress is ${total} kPa and the pore-water pressure is ${water} kPa. Find the effective vertical stress.`;
      answer = total - water; unit = 'kPa';
      steps = [{ text: 'Subtract pore-water pressure from total stress.', latex: String.raw`\sigma' = \sigma-u` }, { text: 'Calculate effective stress.', latex: String.raw`\sigma' = ${total}-${water} = ${answer}\ \mathrm{kPa}` }];
    }
    return { id: randomUUID(), title: item.title, topic: item.topic, spex: item.spex, set: item.set, prompt, answer, unit, steps, tolerance: unit === '₱' ? 0.02 : 0.01, sourceIds: [item.id], diagram, mode: 'sample', createdAt: new Date().toISOString() };
  });
}
