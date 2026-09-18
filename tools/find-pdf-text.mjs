import { readFile } from 'node:fs/promises';
import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
globalThis.DOMMatrix ||= DOMMatrix; globalThis.ImageData ||= ImageData; globalThis.Path2D ||= Path2D;
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const [input, ...terms] = process.argv.slice(2);
const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(input)), disableWorker: true }).promise;
for (let n = 1; n <= pdf.numPages; n++) {
  const content = await (await pdf.getPage(n)).getTextContent();
  const text = content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ');
  const matches = terms.filter(term => text.toLowerCase().includes(term.toLowerCase()));
  if (matches.length) console.log(JSON.stringify({ page: n, matches, text: text.slice(0, 300) }));
}
