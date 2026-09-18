import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const rows = collection => db.prepare('SELECT id, value FROM records WHERE collection = ?').all(collection);
const put = db.prepare('UPDATE records SET value = ? WHERE collection = ? AND id = ?');
const emptyDiagram = { title: '', caption: '', lines: [], arrows: [], circles: [], rectangles: [], labels: [] };
let changed = 0;

const normalizeUnit = unit => String(unit || '')
  .replace(/^S$/, 's')
  .replace(/\b(mm|cm|km|m)\s*\^?\s*2\b/g, '$1²')
  .replace(/\b(mm|cm|km|m)\s*\^?\s*3\b/g, '$1³')
  .replace(/\b(mm|cm|km|m)\s*\^?\s*4\b/g, '$1⁴')
  .replace(/^x\s*10\^([+-]?\d+)\s*/i, '×10^$1 ');

db.exec('BEGIN');
try {
  for (const row of rows('questions')) {
    const question = JSON.parse(row.value);
    let dirty = false;
    const unit = normalizeUnit(question.unit);
    if (unit !== question.unit) { question.unit = unit; dirty = true; }

    if (question.id === '41751e48-05ac-464b-b490-14bae14a7742') {
      question.diagram = {
        ...emptyDiagram,
        title: 'Plane truss and applied load',
        caption: 'Geometry used by the supplied solution: a 15 m span, with the 20 kN load 5 m from support D. Diagram is reconstructed from the stored problem data.',
        lines: [
          { x1: 10, y1: 78, x2: 88, y2: 78, dashed: false },
          { x1: 10, y1: 78, x2: 36, y2: 28, dashed: false },
          { x1: 36, y1: 28, x2: 62, y2: 78, dashed: false },
          { x1: 62, y1: 78, x2: 88, y2: 28, dashed: false },
          { x1: 88, y1: 28, x2: 88, y2: 78, dashed: false },
          { x1: 36, y1: 28, x2: 88, y2: 28, dashed: false },
        ],
        arrows: [{ x1: 62, y1: 8, x2: 62, y2: 25, dashed: false }],
        circles: [[10, 78], [36, 28], [62, 78], [88, 28], [88, 78]].map(([cx, cy]) => ({ cx, cy, r: 1.8, filled: true })),
        labels: [
          { x: 8, y: 88, text: 'A', align: 'middle' }, { x: 34, y: 23, text: 'B', align: 'middle' },
          { x: 62, y: 88, text: 'C', align: 'middle' }, { x: 90, y: 88, text: 'D', align: 'middle' },
          { x: 90, y: 23, text: 'F', align: 'middle' }, { x: 65, y: 10, text: '20 kN', align: 'start' },
        ],
      };
      dirty = true;
    }

    if (/Calculate the angle between F1 and F3/i.test(question.prompt)) {
      question.steps = [
        { text: 'Write the two direction vectors and calculate their magnitudes.', latex: '\\mathbf r_1=\\langle5,-2,7\\rangle,\\quad |\\mathbf r_1|=\\sqrt{5^2+(-2)^2+7^2}=\\sqrt{78}' },
        { text: 'Use the corresponding vector for the third force.', latex: '\\mathbf r_3=\\langle2,1,-6\\rangle,\\quad |\\mathbf r_3|=\\sqrt{2^2+1^2+(-6)^2}=\\sqrt{41}' },
        { text: 'Apply the dot-product relation for the angle between the vectors.', latex: '\\cos\\theta=\\frac{\\mathbf r_1\\cdot\\mathbf r_3}{|\\mathbf r_1||\\mathbf r_3|}=\\frac{5(2)+(-2)(1)+7(-6)}{\\sqrt{78}\\sqrt{41}}' },
        { text: 'Solve for the angle.', latex: '\\theta=\\cos^{-1}\\!\\left(\\frac{-34}{\\sqrt{78}\\sqrt{41}}\\right)=126.957^\\circ' },
      ];
      dirty = true;
    }
    if (dirty) { put.run(JSON.stringify(question), 'questions', row.id); changed++; }
  }

  for (const row of rows('items')) {
    const item = JSON.parse(row.value);
    if (item.kind !== 'formula') continue;
    const caseSpecific = /=\s*[-+]?\d+(?:\.\d+)?(?:\\?\s|$)/.test(item.latex || '') && /(?:total|applied|given|example|calculated|substitut|component|x-axis|y-axis|z-axis)/i.test(`${item.conditions} ${item.title} ${item.topic}`);
    if (item.equationScope !== (caseSpecific ? 'case-specific' : 'general') || (caseSpecific && !/case-specific representation/i.test(item.note || ''))) {
      item.equationScope = caseSpecific ? 'case-specific' : 'general';
      if (caseSpecific) item.note = `Case-specific representation: the numerical values or coefficients shown come from this worked example. Apply the same governing principle using the loads, geometry, and units of the problem being solved.${item.note ? ` ${item.note}` : ''}`;
      put.run(JSON.stringify(item), 'items', row.id); changed++;
    }
  }
  db.exec('COMMIT');
  console.log(`Updated ${changed} stored records.`);
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally { db.close(); }
