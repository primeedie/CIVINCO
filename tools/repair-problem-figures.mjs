import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = process.cwd(), pages = path.join(root, 'tmp', 'pdf-pages'), uploads = path.join(root, 'data', 'uploads');
await mkdir(uploads, { recursive: true });
const figures = {
  wires: { page: 65, crop: [385, 115, 450, 350], caption: 'Wire layout from the source: AB at 30°, AC at 45°, supporting weight W.' },
  beam: { page: 63, crop: [345, 125, 540, 255], caption: 'Original source loading diagram with two 112 kN/m loads, upward pressure q, and span dimensions.' },
  incline: { page: 69, crop: [390, 590, 450, 255], caption: 'Original source incline diagram: 200 N block on a 10° slope.' },
  pipe: { page: 44, crop: [160, 515, 940, 440], caption: 'Original source parallel-pipe system showing Lines A, B, C, and D with lengths and diameters.' },
  dam: { page: 35, crop: [165, 400, 270, 270], caption: 'Original source dam section showing water depth, dam geometry, weight components, and uplift.' },
  road: { page: 24, crop: [335, 495, 555, 225], caption: 'Original source road-cut cross-section used with the cross-section notes.' },
  culvert: { page: 22, crop: [140, 315, 255, 285], caption: 'Original source culvert cross-section: rectangle surmounted by a semicircle.' },
};
for (const [name, spec] of Object.entries(figures)) {
  const image = await loadImage(await readFile(path.join(pages, `page-${spec.page}.png`)));
  const [x, y, width, height] = spec.crop, canvas = createCanvas(width, height);
  canvas.getContext('2d').drawImage(image, x, y, width, height, 0, 0, width, height);
  spec.storageName = `repaired-source-figure-${name}.png`;
  await writeFile(path.join(uploads, spec.storageName), canvas.toBuffer('image/png'));
}

const db = new DatabaseSync(path.join(root, 'data', 'civinco.sqlite'));
const rows = db.prepare('SELECT id, value FROM records WHERE collection = ?').all('questions');
const put = db.prepare('UPDATE records SET value = ? WHERE collection = ? AND id = ?');
const unitText = text => String(text || '')
  .replace(/(\d)\s*(mm|cm|km|m)\s*\^?\s*2\b/g, '$1 $2²')
  .replace(/(\d)\s*(mm|cm|km|m)\s*\^?\s*3\b/g, '$1 $2³')
  .replace(/(\d)\s*(mm|cm|km|m)\s*\^?\s*4\b/g, '$1 $2⁴')
  .replace(/\b(kN|N)\s*-\s*m\b/g, '$1·m')
  .replace(/\b(kN|N)\s*\/\s*(mm|cm|m)\s*\^?\s*2\b/g, '$1/$2²')
  .replace(/\b(kN|N)\s*\/\s*(mm|cm|m)\s*\^?\s*3\b/g, '$1/$2³')
  .replace(/(\d),\s+(\d{3})\b/g, '$1,$2')
  .replace(/\b(m|ft)\s*\/\s*s\s*\^?\s*2\b/g, '$1/s²');
const family = question => {
  const value = `${question.title} ${question.prompt}`;
  if (/two wires are supporting a block/i.test(value)) return 'wires';
  if (/two uniform downward loads/i.test(value)) return 'beam';
  if (/block weighing 200 N.*incline/i.test(value)) return 'incline';
  if (/flow rate of water through the pipe system/i.test(value)) return 'pipe';
  if (/masonry dam of a trapezoidal section/i.test(value)) return 'dam';
  if (/cross-section notes for a road in cut/i.test(value)) return 'road';
  if (/concrete culvert.*rectangle surmounted by a semi-circle/i.test(value)) return 'culvert';
  return null;
};
let changed = 0;
db.exec('BEGIN');
try {
  for (const row of rows) {
    const question = JSON.parse(row.value), name = family(question);
    question.title = unitText(question.title);
    question.prompt = unitText(question.prompt);
    question.unit = unitText(question.unit);
    question.steps = question.steps?.map(step => ({ ...step, text: unitText(step.text) })) || question.steps;
    if (name) {
      const spec = figures[name];
      question.diagramImage = { storageName: spec.storageName, mime: 'image/png', alt: spec.caption, caption: spec.caption, visualAid: true };
    }
    put.run(JSON.stringify(question), 'questions', row.id); changed++;
  }
  db.exec('COMMIT');
  console.log(`Updated ${changed} questions and created ${Object.keys(figures).length} source-figure crops.`);
} catch (error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
