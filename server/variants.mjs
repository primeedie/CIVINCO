import { randomUUID } from 'node:crypto';

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const blankDiagram = () => ({ title: '', caption: '', lines: [], arrows: [], circles: [], rectangles: [], labels: [] });
const tidy = value => Number(value.toFixed(6));
const factorial = n => Array.from({ length: n }, (_, index) => index + 1).reduce((product, value) => product * value, 1);

function build(source) {
  let title = source.title, topic = source.topic, prompt, answer, unit, tolerance = 0.01, steps;
  if (source.offlineVariant === 'vector-resultant') {
    const magnitudes = [rand(4, 9) * 40, rand(3, 8) * 40, rand(4, 10) * 40];
    const directions = [[5, -2, 7], [-3, 0, -4], [2, 1, -6]];
    const components = directions.map((direction, index) => direction.map(value => magnitudes[index] * value / Math.hypot(...direction)));
    const resultant = [0, 1, 2].map(axis => components.reduce((sum, component) => sum + component[axis], 0));
    answer = Math.hypot(...resultant); unit = 'kN';
    title = 'Resultant of Three Concurrent Forces'; topic = '3D Force Resultants';
    prompt = `Three concurrent forces pass through the origin: F1 = ${magnitudes[0]} kN toward (5, -2, 7), F2 = ${magnitudes[1]} kN toward (-3, 0, -4), and F3 = ${magnitudes[2]} kN toward (2, 1, -6). Determine the magnitude of their resultant.`;
    steps = [
      { text: 'Convert each force into Cartesian components using its coordinate direction vector.', latex: String.raw`\mathbf F_i=F_i\frac{\langle x_i,y_i,z_i\rangle}{\sqrt{x_i^2+y_i^2+z_i^2}}` },
      { text: 'Add corresponding components.', latex: String.raw`\mathbf R=\langle ${tidy(resultant[0])},${tidy(resultant[1])},${tidy(resultant[2])}\rangle\ \mathrm{kN}` },
      { text: 'Take the magnitude of the resultant vector.', latex: String.raw`R=\sqrt{R_x^2+R_y^2+R_z^2}=${tidy(answer)}\ \mathrm{kN}` },
    ];
  } else if (source.offlineVariant === 'vehicle-catchup') {
    const truckAcceleration = rand(8, 16) / 10, carAcceleration = truckAcceleration + rand(4, 10) / 10, truckDistance = rand(6, 16) * 5;
    answer = truckDistance * (carAcceleration / truckAcceleration - 1); unit = 'm';
    title = 'Initial Separation in Constant-Acceleration Motion'; topic = 'Rectilinear Motion';
    prompt = `A car and a truck start from rest at the same instant, with the car initially behind the truck. The truck accelerates at ${truckAcceleration.toFixed(1)} m/s² and the car at ${carAcceleration.toFixed(1)} m/s². The car overtakes the truck after the truck has traveled ${truckDistance} m. Determine their initial separation.`;
    steps = [
      { text: 'Use the truck motion to obtain the common elapsed time.', latex: String.raw`t^2=\frac{2s_T}{a_T}=\frac{2(${truckDistance})}{${truckAcceleration}}` },
      { text: 'The initial separation is the difference between the distances traveled.', latex: String.raw`d=s_C-s_T=\frac12(a_C-a_T)t^2=${tidy(answer)}\ \mathrm{m}` },
    ];
  } else if (source.offlineVariant === 'shaft-polar-moment') {
    const torque = rand(18, 50), length = rand(15, 35) / 10, modulus = rand(75, 85), angle = rand(2, 5);
    answer = torque * 1e6 * length * 1000 / (modulus * 1000 * angle * Math.PI / 180) / 1e6; unit = '×10^6 mm⁴'; tolerance = 0.001;
    title = 'Required Polar Moment from Angle of Twist'; topic = 'Torsion of Shafts';
    prompt = `A steel shaft ${length.toFixed(1)} m long transmits ${torque} kN·m of torque. Limit its angle of twist to ${angle}° and use G = ${modulus} GPa. Determine the required polar moment of inertia in ×10^6 mm⁴.`;
    steps = [
      { text: 'Convert torque, length, modulus, and angle to compatible N-mm units and radians.', latex: String.raw`T=${torque}\times10^6\ \mathrm{N\,mm},\quad L=${length * 1000}\ \mathrm{mm},\quad G=${modulus * 1000}\ \mathrm{MPa},\quad\theta=${angle}\frac{\pi}{180}` },
      { text: 'Rearrange the angle-of-twist equation.', latex: String.raw`J=\frac{TL}{G\theta}=${tidy(answer)}\times10^6\ \mathrm{mm^4}` },
    ];
  } else if (source.offlineVariant === 'dice-sum') {
    const limit = rand(5, 11), favorable = Array.from({ length: 6 }, (_, a) => Array.from({ length: 6 }, (_, b) => a + b + 2 < limit ? 1 : 0)).flat().reduce((a, b) => a + b, 0);
    answer = favorable / 36; unit = ''; tolerance = 0.001;
    title = 'Probability of a Sum from Two Dice'; topic = 'Probability';
    prompt = `A pair of fair six-sided dice is rolled. Find the probability that the sum is less than ${limit}. Give the answer as a decimal.`;
    steps = [{ text: 'Count the ordered outcomes whose sum is below the limit, out of 36 equally likely outcomes.', latex: String.raw`P=\frac{${favorable}}{36}=${tidy(answer)}` }];
  } else if (source.offlineVariant === 'direct-proportion') {
    const stories = rand(3, 8), shadow = stories * rand(3, 6), targetStories = rand(5, 12), targetShadow = shadow * targetStories / stories;
    answer = targetStories; unit = 'stories';
    title = 'Building Height by Direct Proportion'; topic = 'Direct Variation';
    prompt = `At the same time of day, a ${stories}-story building casts a ${shadow} m shadow. How many stories high is a similar building that casts a ${targetShadow} m shadow?`;
    steps = [{ text: 'At the same sun angle, height and shadow length are directly proportional.', latex: String.raw`\frac{${stories}}{${shadow}}=\frac{n}{${targetShadow}}\quad\Longrightarrow\quad n=${answer}\ \text{stories}` }];
  } else if (source.offlineVariant === 'similar-polygon') {
    const sides = [rand(3, 6), rand(6, 9), rand(9, 12), rand(13, 16), rand(18, 22)], scaleNumerator = rand(2, 4), scaleDenominator = rand(5, 8), scale = scaleNumerator / scaleDenominator;
    const longest = sides.at(-1), smallerLongest = tidy(longest * scale); answer = sides.reduce((sum, side) => sum + side, 0) * scale; unit = 'm';
    title = 'Perimeter of a Similar Polygon'; topic = 'Similar Figures';
    prompt = `A polygon has side lengths ${sides.join(', ')} m. A similar smaller polygon has a longest side of ${smallerLongest} m. Find the perimeter of the smaller polygon.`;
    steps = [{ text: 'Use the ratio of corresponding longest sides as the linear scale factor.', latex: String.raw`k=\frac{${smallerLongest}}{${longest}}=${tidy(scale)}` }, { text: 'Scale the original perimeter.', latex: String.raw`P_s=k(${sides.join('+')})=${tidy(answer)}\ \mathrm{m}` }];
  } else if (source.offlineVariant === 'circular-seating') {
    const friends = rand(4, 8); answer = 2 * factorial(friends); unit = 'arrangements'; tolerance = 0;
    title = 'Circular Arrangements with a Couple Together'; topic = 'Permutations';
    prompt = `A couple invites ${friends} friends to dinner. Everyone sits around a round table. How many arrangements are possible if the couple must sit beside each other?`;
    steps = [{ text: 'Treat the couple as one block. There are friends + 1 units around the circle, and the couple can switch places.', latex: String.raw`N=2(${friends}!)=${answer.toLocaleString('en-US')}` }];
  } else if (source.offlineVariant === 'buoyant-volume') {
    const airWeight = rand(30, 60) * 10, loss = rand(8, 20) * 10, waterWeight = airWeight - loss;
    answer = loss / 9810; unit = 'm³'; tolerance = 0.00001;
    title = 'Volume from Apparent Loss of Weight'; topic = 'Buoyancy';
    prompt = `A stone weighs ${airWeight} N in air and ${waterWeight} N when fully submerged in water. Using γw = 9.81 kN/m³, determine its volume in m³.`;
    steps = [{ text: 'The apparent loss of weight equals the buoyant force.', latex: String.raw`F_B=${airWeight}-${waterWeight}=${loss}\ \mathrm{N}` }, { text: 'Divide the buoyant force by the unit weight of water.', latex: String.raw`V=\frac{F_B}{\gamma_w}=\frac{${loss}}{9810}=${tidy(answer)}\ \mathrm{m^3}` }];
  } else return null;
  return { ...source, id: randomUUID(), sourceBankQuestionId: source.id, pool: false, mode: 'variant', title, topic, prompt, answer, unit, tolerance, steps, solutionQuality: 'worked', diagram: blankDiagram(), diagramImage: undefined, createdAt: new Date().toISOString() };
}

export function offlineVariants(pool, count) {
  const eligible = pool.filter(question => question.offlineVariant);
  if (!eligible.length) return [];
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, index) => build(shuffled[index % shuffled.length])).filter(Boolean);
}
