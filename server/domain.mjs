import { z } from 'zod';
import katex from 'katex';

export const categorySchema = z.object({ spex: z.enum(['A', 'B', 'C']), set: z.coerce.number().int().min(1).max(999) });
export const variableSchema = z.object({ symbol: z.string(), meaning: z.string(), unit: z.string() });
export const formulaSchema = z.object({
  title: z.string().min(1), topic: z.string().min(1), latex: z.string().min(1),
  variables: z.array(variableSchema), conditions: z.string(), uncertain: z.boolean(), note: z.string(),
});
export const conceptSchema = z.object({ title: z.string().min(1), topic: z.string().min(1), explanation: z.string().min(1) });
export const extractionSchema = z.object({
  formulas: z.array(formulaSchema), concepts: z.array(conceptSchema), warnings: z.array(z.string()),
});
export const classifiedExtractionSchema = extractionSchema.extend({
  classification: z.object({ spex: z.enum(['A', 'B', 'C']), set: z.number().int().min(1).max(999), confidence: z.enum(['high', 'medium', 'low']), reason: z.string() }),
});
const coordinate = z.number().min(0).max(100);
const lineSchema = z.object({ x1: coordinate, y1: coordinate, x2: coordinate, y2: coordinate, dashed: z.boolean() });
export const diagramSchema = z.object({
  title: z.string(), caption: z.string(),
  lines: z.array(lineSchema).max(60),
  arrows: z.array(lineSchema).max(40),
  circles: z.array(z.object({ cx: coordinate, cy: coordinate, r: z.number().min(0).max(50), filled: z.boolean() })).max(30),
  rectangles: z.array(z.object({ x: coordinate, y: coordinate, width: z.number().min(0).max(100), height: z.number().min(0).max(100), filled: z.boolean() })).max(30),
  labels: z.array(z.object({ x: coordinate, y: coordinate, text: z.string().max(80), align: z.enum(['start', 'middle', 'end']) })).max(50),
});
export const questionSchema = z.object({
  title: z.string(), topic: z.string(), prompt: z.string(), answer: z.number(), unit: z.string(),
  tolerance: z.number().nonnegative(), steps: z.array(z.object({ text: z.string(), latex: z.string() })).min(1),
  sourceIds: z.array(z.string()).min(1), diagram: diagramSchema,
});
export const generatedSchema = z.object({ questions: z.array(questionSchema).min(1).max(10) });
export function validLatex(latex) {
  try { katex.renderToString(latex, { throwOnError: true, trust: false, strict: 'error' }); return true; }
  catch { return false; }
}
// Input is a number in the explicitly displayed unit, never evaluated as code.
export function gradeAnswer(input, expected, tolerance) {
  const value = String(input).trim().replace(/−/g, '-');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
    throw Object.assign(new Error('Enter a number in the unit shown, such as 12.5 or 1.25e2.'), { status: 400 });
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw Object.assign(new Error('Enter a finite number.'), { status: 400 });
  return { numeric, correct: Math.abs(numeric - expected) <= tolerance + Number.EPSILON * Math.max(1, Math.abs(expected)) * 8 };
}
export function reviewSchedule(previous, rating, now = Date.now()) {
  const prior = previous?.interval || 0;
  const interval = rating === 'again' ? 0 : rating === 'hard' ? 1 : rating === 'good' ? Math.max(1, Math.round(prior * 2.5)) : Math.max(4, Math.round(prior * 4));
  return { interval, due: new Date(now + (rating === 'again' ? 600_000 : interval * 86_400_000)).toISOString(), rating };
}
export function publicQuestion(q) {
  const { answer, tolerance, steps, ...publicPart } = q;
  return publicPart;
}
