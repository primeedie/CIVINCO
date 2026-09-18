import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const rows = db.prepare("SELECT id, value FROM records WHERE collection = 'questions'").all();
const put = db.prepare("UPDATE records SET value = ? WHERE collection = 'questions' AND id = ?");
const questions = rows.map(row => ({ row, value: JSON.parse(row.value) }));
const byId = new Map(questions.map(entry => [entry.row.id, entry.value]));

const format = value => Number(value.toFixed(5)).toString();
const forcePattern = /F(\d+)\s*=\s*([\d.]+)\s*kN\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/gi;

function vectorSolution(question) {
  const forces = [];
  for (const match of question.prompt.matchAll(forcePattern)) {
    forces.push({ name: `F_${match[1]}`, magnitude: Number(match[2]), vector: match.slice(3, 6).map(Number) });
  }
  if (forces.length < 2) return null;
  const components = forces.map(force => {
    const length = Math.hypot(...force.vector);
    return force.vector.map(value => force.magnitude * value / length);
  });
  const resultant = [0, 1, 2].map(axis => components.reduce((sum, component) => sum + component[axis], 0));
  const magnitude = Math.hypot(...resultant);
  const directionStep = {
    text: 'Resolve each force along the Cartesian axes using its coordinate direction vector.',
    latex: forces.map((force, index) => {
      const [x, y, z] = force.vector;
      return `\\mathbf ${force.name}=${format(force.magnitude)}\\frac{\\langle${x},${y},${z}\\rangle}{\\sqrt{(${x})^2+(${y})^2+(${z})^2}}`;
    }).join('\\qquad '),
  };
  const sumStep = {
    text: 'Add corresponding components to obtain the resultant vector.',
    latex: `\\mathbf R=\\sum\\mathbf F=\\langle${format(resultant[0])},${format(resultant[1])},${format(resultant[2])}\\rangle\\ \\text{kN}`,
  };
  const prompt = question.prompt.toLowerCase();
  if (/x-component/.test(prompt)) return [directionStep, { text: 'Read the x-component of the resultant.', latex: `R_x=${format(resultant[0])}\\ \\text{kN}` }];
  if (/y-component/.test(prompt)) return [directionStep, { text: 'Read the y-component of the resultant.', latex: `R_y=${format(resultant[1])}\\ \\text{kN}` }];
  if (/z-component/.test(prompt)) return [directionStep, { text: 'Read the z-component of the resultant.', latex: `R_z=${format(resultant[2])}\\ \\text{kN}` }];
  if (/product of the direction cosines/.test(prompt)) return [directionStep, sumStep, {
    text: 'Divide each component by the resultant magnitude, then multiply the three direction cosines.',
    latex: `lmn=\\frac{R_xR_yR_z}{R^3}=\\frac{(${format(resultant[0])})(${format(resultant[1])})(${format(resultant[2])})}{(${format(magnitude)})^3}=${format(resultant.reduce((product, value) => product * value, 1) / magnitude ** 3)}`,
  }];
  if (/magnitude of the resultant/.test(prompt)) return [directionStep, sumStep, {
    text: 'Compute the magnitude of the resultant.',
    latex: `R=\\sqrt{R_x^2+R_y^2+R_z^2}=\\sqrt{(${format(resultant[0])})^2+(${format(resultant[1])})^2+(${format(resultant[2])})^2}=${format(magnitude)}\\ \\text{kN}`,
  }];
  return null;
}

function tankSolution(question) {
  if (!/8-mm thick steel tank.*outside diameter of 600 mm/i.test(question.prompt)) return null;
  if (!/circumferential stress/i.test(question.prompt)) return null;
  return [
    { text: 'Use the inside diameter because the given 600 mm dimension is the outside diameter.', latex: `d_i=D_o-2t=600-2(8)=584\\ \\text{mm}` },
    { text: 'Apply the thin-walled cylinder hoop-stress equation.', latex: `\\sigma_h=\\frac{p d_i}{2t}=\\frac{(2.40)(584)}{2(8)}=87.6\\ \\text{MPa}` },
  ];
}

function isContaminated(question) {
  const text = (question.steps || []).map(step => step.text || '').join(' ');
  if (text.length > 850) return true;
  return /\bANS:\s*[-\d]|\bFor items?\s+\d|\b\d+(?:\.\d+)?\s+(?:An?|The)\s+[^.]{15,}\b(?:solve|determine|compute|calculate|find)\b/i.test(text);
}

let repaired = 0;
db.exec('BEGIN');
try {
  for (const entry of questions.filter(entry => entry.value.pool)) {
    const question = entry.value;
    const steps = vectorSolution(question) || tankSolution(question);
    if (steps) {
      question.steps = steps;
      question.solutionQuality = 'worked';
      repaired++;
    } else if (isContaminated(question)) {
      const answer = `${Number(question.answer).toLocaleString('en-US', { maximumFractionDigits: 8 })}${question.unit ? ` ${question.unit}` : ''}`;
      question.steps = [{ text: `The imported answer key gives ${answer}. Its OCR text included parts of neighboring questions, so the unreliable merged derivation was removed.`, latex: '' }];
      question.solutionQuality = 'answer-key';
      repaired++;
    } else if (!question.solutionQuality) {
      question.solutionQuality = question.steps?.some(step => step.latex) ? 'worked' : 'source';
    }
  }

  let propagated = 0;
  for (const entry of questions.filter(entry => !entry.value.pool && entry.value.sourceBankQuestionId)) {
    const source = byId.get(entry.value.sourceBankQuestionId);
    if (!source) continue;
    entry.value.steps = source.steps;
    entry.value.solutionQuality = source.solutionQuality;
    propagated++;
  }
  for (const entry of questions) put.run(JSON.stringify(entry.value), entry.row.id);
  db.exec('COMMIT');
  console.log(`Repaired ${repaired} permanent-bank solutions and refreshed ${propagated} existing practice copies.`);
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
