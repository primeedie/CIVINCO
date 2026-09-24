import { randomUUID } from 'node:crypto';

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const blankDiagram = () => ({ title: '', caption: '', lines: [], arrows: [], circles: [], rectangles: [], labels: [] });
const tidy = value => Number(value.toFixed(6));
const factorial = n => Array.from({ length: n }, (_, index) => index + 1).reduce((product, value) => product * value, 1);
const choose = (n, r) => factorial(n) / (factorial(r) * factorial(n - r));

export function buildOfflineVariant(source) {
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
  } else if (source.offlineVariant === 'hydraulic-jack') {
    const force = rand(2, 8) * 100, load = rand(6, 18) * 1000, plunger = rand(2, 5) * 5;
    answer = plunger * Math.sqrt(load / force); unit = 'mm';
    title = 'Hydraulic Jack Piston Diameter'; topic = 'Fluid Pressure';
    prompt = `A hydraulic jack must lift a ${load / 1000} kN load. A ${force} N force acts on a ${plunger} mm diameter plunger. Determine the required piston diameter.`;
    steps = [{ text: 'Pascal’s law gives equal pressure in the plunger and piston.', latex: String.raw`\frac{F_1}{\pi d_1^2/4}=\frac{F_2}{\pi d_2^2/4}` }, { text: 'Solve for the piston diameter.', latex: String.raw`d_2=${plunger}\sqrt{\frac{${load}}{${force}}}=${tidy(answer)}\ \mathrm{mm}` }];
  } else if (source.offlineVariant === 'barometer-height') {
    const difference = rand(6, 14) * 10, mercurySg = 13.6, airWeight = rand(10, 14);
    answer = difference / 1000 * mercurySg * 9810 / airWeight; unit = 'm';
    title = 'Elevation Difference from Barometer Readings'; topic = 'Fluid Pressure';
    prompt = `Two simultaneous mercury-barometer readings differ by ${difference} mmHg. Use SG = ${mercurySg} for mercury and an air unit weight of ${airWeight} N/m³. Estimate the elevation difference.`;
    steps = [{ text: 'Equate the mercury pressure difference to the air-column pressure.', latex: String.raw`\gamma_{Hg}\Delta h_{Hg}=\gamma_{air}H` }, { text: 'Substitute consistent SI units.', latex: String.raw`H=\frac{(${mercurySg})(9810)(${difference}/1000)}{${airWeight}}=${tidy(answer)}\ \mathrm{m}` }];
  } else if (source.offlineVariant === 'iceberg-volume') {
    const exposed = rand(2, 8) * 100, iceSg = rand(88, 94) / 100, waterSg = rand(101, 104) / 100;
    answer = exposed * waterSg / (waterSg - iceSg); unit = 'm³';
    title = 'Total Volume of a Floating Iceberg'; topic = 'Buoyancy';
    prompt = `An iceberg floats with ${exposed} m³ above seawater. The specific gravities of ice and seawater are ${iceSg.toFixed(2)} and ${waterSg.toFixed(2)}. Determine the iceberg’s total volume.`;
    steps = [{ text: 'Equate iceberg weight and buoyancy.', latex: String.raw`SG_iV=SG_w(V-V_a)` }, { text: 'Solve for total volume.', latex: String.raw`V=\frac{SG_wV_a}{SG_w-SG_i}=\frac{${waterSg}(${exposed})}{${waterSg}-${iceSg}}=${tidy(answer)}\ \mathrm{m^3}` }];
  } else if (source.offlineVariant === 'barge-draft') {
    const width = rand(8, 15), length = rand(20, 40), load = rand(30, 70) * 100, sg = rand(100, 103) / 100;
    answer = load / (sg * 9.81 * width * length); unit = 'm';
    title = 'Draft of a Loaded Rectangular Barge'; topic = 'Buoyancy';
    prompt = `A rectangular barge ${width} m wide and ${length} m long carries ${load} kN. It floats in water with SG = ${sg.toFixed(2)}. Neglecting the barge weight, determine its draft.`;
    steps = [{ text: 'Set the carried load equal to the buoyant force.', latex: String.raw`W=\gamma_w SG\,(BLh)` }, { text: 'Solve for draft.', latex: String.raw`h=\frac{${load}}{9.81(${sg})(${width})(${length})}=${tidy(answer)}\ \mathrm{m}` }];
  } else if (source.offlineVariant === 'soil-zero-void') {
    const gs = rand(230, 290) / 100;
    answer = gs * 9.81; unit = 'kN/m³';
    title = 'Maximum Soil Unit Weight'; topic = 'Soil Properties';
    prompt = `A soil has a specific gravity of solids Gs = ${gs.toFixed(2)}. Determine its maximum theoretical unit weight at zero voids.`;
    steps = [{ text: 'At zero voids, the total volume equals the volume of solids.', latex: String.raw`\gamma_{max}=G_s\gamma_w` }, { text: 'Use the unit weight of water.', latex: String.raw`\gamma_{max}=(${gs})(9.81)=${tidy(answer)}\ \mathrm{kN/m^3}` }];
  } else if (source.offlineVariant === 'moist-unit-weight') {
    const dry = rand(90, 180) / 10, moisture = rand(5, 22) / 100;
    answer = dry * (1 + moisture); unit = 'kN/m³';
    title = 'Moist Unit Weight of Soil'; topic = 'Soil Properties';
    prompt = `A soil has dry unit weight ${dry.toFixed(1)} kN/m³ and moisture content ${(moisture * 100).toFixed(0)}%. Determine its moist unit weight.`;
    steps = [{ text: 'Relate moist and dry unit weights through water content.', latex: String.raw`\gamma=\gamma_d(1+w)` }, { text: 'Substitute the given values.', latex: String.raw`\gamma=${dry}(1+${moisture})=${tidy(answer)}\ \mathrm{kN/m^3}` }];
  } else if (source.offlineVariant === 'bus-speed') {
    const busDistance = rand(5, 10) * 50, difference = rand(3, 8) * 10, busSpeed = rand(5, 10) * 10, carDistance = busDistance * (busSpeed + difference) / busSpeed;
    answer = busSpeed; unit = 'km/h';
    title = 'Speed from Equal Travel Times'; topic = 'Rate Problems';
    prompt = `A bus travels ${busDistance} km in the same time that a car travels ${tidy(carDistance)} km. The car is ${difference} km/h faster. Determine the bus speed.`;
    steps = [{ text: 'Equal travel times give one rational equation.', latex: String.raw`\frac{${busDistance}}{v}=\frac{${tidy(carDistance)}}{v+${difference}}` }, { text: 'Solve for the bus speed.', latex: String.raw`v=${answer}\ \mathrm{km/h}` }];
  } else if (source.offlineVariant === 'polygon-diagonals') {
    const sides = [8, 10, 12, 15, 18, 20, 24][rand(0, 6)], angle = 180 * (sides - 2) / sides;
    answer = sides * (sides - 3) / 2; unit = 'diagonals'; tolerance = 0;
    title = 'Diagonals of a Regular Polygon'; topic = 'Plane Geometry';
    prompt = `Each interior angle of a regular polygon is ${tidy(angle)}°. Determine the number of diagonals.`;
    steps = [{ text: 'Use the interior-angle relation to determine the number of sides.', latex: String.raw`${angle}=\frac{180(n-2)}n\quad\Longrightarrow\quad n=${sides}` }, { text: 'Count the diagonals.', latex: String.raw`D=\frac{n(n-3)}2=\frac{${sides}(${sides - 3})}2=${answer}` }];
  } else if (source.offlineVariant === 'work-rate') {
    const workers1 = rand(3, 8), days1 = rand(4, 8), rate = rand(5, 12) * 100, workers2 = rand(8, 16), days2 = rand(7, 14), earned1 = workers1 * days1 * rate;
    answer = workers2 * days2 * rate; unit = '₱'; tolerance = 0.01;
    title = 'Earnings by Direct Work Proportion'; topic = 'Direct Variation';
    prompt = `${workers1} workers earn ₱${earned1.toLocaleString('en-US')} in ${days1} days. At the same rate, how much will ${workers2} workers earn in ${days2} days?`;
    steps = [{ text: 'Find the earnings per worker-day.', latex: String.raw`r=\frac{${earned1}}{${workers1}(${days1})}=${rate}` }, { text: 'Multiply by the new number of worker-days.', latex: String.raw`A=${workers2}(${days2})(${rate})=${answer.toLocaleString('en-US')}\ \mathrm{PHP}` }];
  } else if (source.offlineVariant === 'father-son') {
    const boy = rand(10, 20), years = rand(5, 15), difference = boy + years;
    answer = boy; unit = 'years';
    title = 'Present Age from a Future Relation'; topic = 'Age Problems';
    prompt = `A child is ${difference} years younger than a parent. In ${years} years, the parent will be twice the child’s age. Find the child’s present age.`;
    steps = [{ text: 'Let b be the child’s present age, so the parent is b plus the age difference.', latex: String.raw`p=b+${difference}` }, { text: 'Apply the future-age condition and solve.', latex: String.raw`b+${difference}+${years}=2(b+${years})\quad\Longrightarrow\quad b=${answer}\ \text{years}` }];
  } else if (source.offlineVariant === 'exponential-wait') {
    const mean = rand(15, 35), threshold = rand(15, 45);
    answer = Math.exp(-threshold / mean); unit = ''; tolerance = 0.0005;
    title = 'Exponential Waiting-Time Probability'; topic = 'Probability';
    prompt = `Service time is exponentially distributed with mean ${mean} seconds. Find the probability that service takes at least ${threshold} seconds.`;
    steps = [{ text: 'Use the exponential survival function.', latex: String.raw`P(T\ge t)=e^{-t/\mu}` }, { text: 'Substitute the threshold and mean.', latex: String.raw`P(T\ge ${threshold})=e^{-${threshold}/${mean}}=${tidy(answer)}` }];
  } else if (source.offlineVariant === 'binomial-exact') {
    const n = rand(8, 20), p = rand(10, 40) / 100, x = rand(0, Math.min(5, n));
    answer = choose(n, x) * p ** x * (1 - p) ** (n - x); unit = ''; tolerance = 0.0005;
    title = 'Exact Binomial Probability'; topic = 'Probability';
    prompt = `Each item has probability ${p.toFixed(2)} of being defective. For ${n} independent items, find the probability that exactly ${x} are defective.`;
    steps = [{ text: 'Use the binomial probability mass function.', latex: String.raw`P(X=x)=\binom nxp^x(1-p)^{n-x}` }, { text: 'Substitute the given values.', latex: String.raw`P(X=${x})=\binom{${n}}{${x}}(${p})^{${x}}(${1 - p})^{${n - x}}=${tidy(answer)}` }];
  } else if (source.offlineVariant === 'hooke-spring') {
    const force1 = rand(2, 8) * 10, stretch1 = rand(2, 8), multiplier = rand(2, 5), force2 = force1 * multiplier;
    answer = stretch1 * multiplier; unit = 'mm';
    title = 'Spring Stretch from Hooke’s Law'; topic = 'Direct Variation';
    prompt = `A force of ${force1} kN stretches a spring ${stretch1} mm. Within the elastic range, determine the stretch caused by ${force2} kN.`;
    steps = [{ text: 'Hooke’s law makes force directly proportional to extension.', latex: String.raw`\frac{F_1}{x_1}=\frac{F_2}{x_2}` }, { text: 'Solve for the new extension.', latex: String.raw`x_2=${stretch1}\frac{${force2}}{${force1}}=${answer}\ \mathrm{mm}` }];
  } else if (source.offlineVariant === 'rectangle-semicircle') {
    const radius = rand(5, 18);
    answer = radius ** 2; unit = 'cm²';
    title = 'Largest Rectangle in a Semicircle'; topic = 'Optimization';
    prompt = `Find the maximum area of a rectangle inscribed in a semicircle of radius ${radius} cm, with its base on the diameter.`;
    steps = [{ text: 'Let half the rectangle width be x and its height be y.', latex: String.raw`x^2+y^2=${radius}^2,\qquad A=2xy` }, { text: 'The product is maximized when x equals y.', latex: String.raw`x=y=\frac{${radius}}{\sqrt2},\qquad A_{max}=2\left(\frac{${radius}}{\sqrt2}\right)^2=${answer}\ \mathrm{cm^2}` }];
  } else if (source.offlineVariant === 'rectangle-ellipse') {
    const a = rand(3, 9), b = rand(3, 8);
    answer = 2 * a * b; unit = 'square units';
    title = 'Largest Rectangle in an Ellipse'; topic = 'Optimization';
    prompt = `Find the maximum area of an axis-aligned rectangle inscribed in the ellipse x²/${a ** 2} + y²/${b ** 2} = 1.`;
    steps = [{ text: 'At the optimum, the corner coordinates are a over root two and b over root two.', latex: String.raw`x=\frac{${a}}{\sqrt2},\qquad y=\frac{${b}}{\sqrt2}` }, { text: 'The full rectangle has area 4xy.', latex: String.raw`A_{max}=4xy=2(${a})(${b})=${answer}` }];
  } else if (source.offlineVariant === 'stopping-friction') {
    const speed = rand(5, 11) * 10, friction = rand(25, 55) / 100, distance = (speed / 3.6) ** 2 / (2 * 9.81 * friction);
    answer = friction; unit = ''; tolerance = 0.005;
    title = 'Average Friction from Stopping Distance'; topic = 'Highway Engineering';
    prompt = `A car traveling ${speed} km/h stops in ${tidy(distance)} m on a level road after braking. Determine the average tire–pavement friction coefficient.`;
    steps = [{ text: 'Use constant-deceleration stopping distance on a level road.', latex: String.raw`s=\frac{v^2}{2gf}` }, { text: 'Convert speed and solve for friction.', latex: String.raw`f=\frac{(${speed}/3.6)^2}{2(9.81)(${tidy(distance)})}=${tidy(answer)}` }];
  } else if (source.offlineVariant === 'superelevation') {
    const speed = rand(6, 12) * 10, friction = rand(8, 14) / 100, target = rand(4, 12) / 100, radius = Math.round((speed / 3.6) ** 2 / (9.81 * (friction + target)));
    answer = (speed / 3.6) ** 2 / (9.81 * radius) - friction; unit = ''; tolerance = 0.005;
    title = 'Required Highway Superelevation'; topic = 'Highway Engineering';
    prompt = `A horizontal curve has radius ${radius} m and design speed ${speed} km/h. If side-friction factor is ${friction.toFixed(2)}, determine the required superelevation rate.`;
    steps = [{ text: 'Use the horizontal-curve equilibrium relation.', latex: String.raw`e+f=\frac{v^2}{gR}` }, { text: 'Convert speed to m/s and solve.', latex: String.raw`e=\frac{(${speed}/3.6)^2}{9.81(${radius})}-${friction}=${tidy(answer)}` }];
  } else if (source.offlineVariant === 'centripetal-force') {
    const mass = rand(7, 16) * 100, speed = rand(4, 10) * 10, radius = rand(6, 18) * 10;
    answer = mass * (speed / 3.6) ** 2 / radius; unit = 'N';
    title = 'Friction Required on an Unbanked Curve'; topic = 'Highway Engineering';
    prompt = `A ${mass} kg vehicle travels at ${speed} km/h around an unbanked curve of radius ${radius} m. Determine the lateral friction force required.`;
    steps = [{ text: 'Friction supplies the required centripetal force.', latex: String.raw`F=\frac{mv^2}{R}` }, { text: 'Convert speed to m/s and evaluate.', latex: String.raw`F=\frac{${mass}(${speed}/3.6)^2}{${radius}}=${tidy(answer)}\ \mathrm{N}` }];
  } else if (source.offlineVariant === 'accident-rate') {
    const adt = rand(4, 12) * 100, years = rand(2, 6), accidents = rand(20, 80) * 10, rate = accidents * 1e6 / (adt * years * 365);
    answer = accidents; unit = 'accidents'; tolerance = 0;
    title = 'Accidents from an Intersection Rate'; topic = 'Transportation Engineering';
    prompt = `An intersection has an accident rate of ${tidy(rate)} per million entering vehicles and ADT of ${adt}. Estimate the total accidents during ${years} years.`;
    steps = [{ text: 'Rearrange the accident-rate expression.', latex: String.raw`R=\frac{A(10^6)}{ADT(365)Y}` }, { text: 'Solve for the accident count.', latex: String.raw`A=\frac{${tidy(rate)}(${adt})(365)(${years})}{10^6}=${answer}` }];
  } else if (source.offlineVariant === 'footing-base-pressure') {
    const diameter = rand(3, 7), load = rand(10, 30) * 100;
    answer = load / (Math.PI * diameter ** 2 / 4); unit = 'kPa';
    title = 'Pressure beneath a Circular Footing'; topic = 'Foundation Engineering';
    prompt = `A circular footing ${diameter} m in diameter carries a total load of ${load} kN. Determine the average pressure at its base.`;
    steps = [{ text: 'Divide the load by the circular footing area.', latex: String.raw`q=\frac{Q}{\pi D^2/4}` }, { text: 'Substitute the load and diameter.', latex: String.raw`q=\frac{${load}}{\pi(${diameter})^2/4}=${tidy(answer)}\ \mathrm{kPa}` }];
  } else if (source.offlineVariant === 'two-to-one-spread') {
    const side = rand(2, 6), load = rand(20, 70) * 100, depth = rand(4, 14);
    answer = load / ((side + depth) ** 2); unit = 'kPa';
    title = 'Stress Increase by the 2:1 Method'; topic = 'Foundation Engineering';
    prompt = `A ${side} m square footing carries ${load} kN. Using the 2V:1H load-spread method, determine the stress increase ${depth} m below the footing base.`;
    steps = [{ text: 'At depth z, the load spreads to dimensions B + z and L + z.', latex: String.raw`\Delta\sigma_z=\frac{Q}{(B+z)(L+z)}` }, { text: 'Substitute the square-footing dimensions.', latex: String.raw`\Delta\sigma_z=\frac{${load}}{(${side}+${depth})^2}=${tidy(answer)}\ \mathrm{kPa}` }];
  } else return null;
  return { ...source, id: randomUUID(), sourceBankQuestionId: source.id, pool: false, mode: 'variant', title, topic, prompt, answer, unit, tolerance, steps, solutionQuality: 'worked', diagram: blankDiagram(), diagramImage: undefined, createdAt: new Date().toISOString() };
}

export function offlineVariants(pool, count) {
  const eligible = pool.filter(question => question.offlineVariant);
  if (!eligible.length) return [];
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, index) => buildOfflineVariant(shuffled[index % shuffled.length])).filter(Boolean);
}
