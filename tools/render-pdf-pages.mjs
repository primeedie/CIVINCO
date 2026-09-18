import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

globalThis.DOMMatrix ||= DOMMatrix;
globalThis.ImageData ||= ImageData;
globalThis.Path2D ||= Path2D;
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const [input, output, firstRaw = '1', lastRaw = firstRaw] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node tools/render-pdf-pages.mjs input.pdf output-dir first-page last-page');
await mkdir(output, { recursive: true });
const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(input)), disableWorker: true }).promise;
const first = Math.max(1, Number(firstRaw)), last = Math.min(pdf.numPages, Number(lastRaw));
for (let pageNumber = first; pageNumber <= last; pageNumber++) {
  const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  await writeFile(path.join(output, `page-${pageNumber}.png`), canvas.toBuffer('image/png'));
}
console.log(`Rendered pages ${first}-${last} of ${pdf.numPages}.`);
