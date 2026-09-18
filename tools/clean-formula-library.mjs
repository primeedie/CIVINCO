import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/civinco.sqlite');
const all = collection => db.prepare('SELECT id, value FROM records WHERE collection = ?').all(collection);
const put = db.prepare('UPDATE records SET value = ? WHERE collection = ? AND id = ?');
const remove = db.prepare('DELETE FROM records WHERE collection = ? AND id = ?');
const deleted = new Set();
let trimmed = 0;

const exactWorkedTitles = /^(?:required area of steel|safe uniform load determination|normal force|t-beam compression-tension force equilibrium|intermediate moment equation at b|whitney stress block depth equation|ultimate moment capacity \(part [ab]\)|calculation of moving concentrated service live load|calculation of maximum nominal axial strength|maximum deflection|location of neutral axis from bottom reference|column side dimension geometry equation|compatibility relation in terms of unknown reaction|moment capacity based on|safe axial load capacity|cosine law equation for component|maximum height above launch point|location condition for maximum deflection|spacing for equal strength|service live load moment|minimum tensile stress|maximum tensile stress|quadratic equation for depth of stress block|distance to zero shear point|design flexural strength|number of long direction rebars|stress block depth equation|equating moment equations|expanded compatibility equation|weight vector expression|vector force in cable|initial vertical velocity component|total weight of contained liquid|coasting time equation|segmental internal torques|long column classification condition|long column condition|neutral axis depth relation|short column condition comparison|factored actions for|required stress block depth solution|cut-off distance and length of cover plates|plastic neutral axis position formula|influence line equation for reaction at a|support reaction r_a for unit load|equilibrium equation for reaction at a|minimum and maximum longitudinal steel limits)/i;
const calculationTitle = /(?:\bcalculation\b|\bevaluation\b|\bsubstitution\b|\bsolved\b|\bproperties\b|\bpart [ab]\b|\bfrom statics\b|\busing point coordinates\b)/i;
const preserveTitle = /(?:code|NSCP|limit|ratio|factor|criterion|condition|formula|capacity direct equation|strength equations|allowable|minimum factored|maximum reinforcement|reinforcement ratio|transition|buckling|three-moment equation factor|fixed-end moment|slope at|deflection for|principal stress|Mohr|kinematic|work-energy|mechanical energy|velocity-displacement|angular velocity|polar moment|bi-axial bending soil pressure|effective overhanging|spiral spacing)/i;
const numericTokens = latex => (String(latex).match(/(?<![_A-Za-z])\d+(?:\.\d+)?/g) || []).length;
const symbolicTokens = latex => (String(latex).replace(/\\(?:text|mathrm)\s*\{[^}]*\}/g, '').match(/[A-Za-z](?:_[{A-Za-z]|\b)/g) || []).length;

const meaningfulVariables = expression => {
  const withoutUnits = expression
    .replace(/\\text\s*\{[^}]*\}/g, '')
    .replace(/\\mathrm\s*\{[^}]*\}/g, '')
    .replace(/\\(?:frac|sqrt|times|cdot|left|right|quad|le|ge|approx|circ|sum|implies|pi)\b/g, '');
  return /[A-Za-z](?:_[{A-Za-z]|\b)/.test(withoutUnits);
};

db.exec('BEGIN');
try {
  for (const row of all('items')) {
    const item = JSON.parse(row.value);
    if (item.kind !== 'formula') continue;
    if (/^Angle of Twist between A and C$/i.test(item.title)) {
      item.title = 'Angle of Twist for a Stepped Shaft';
      item.latex = '\\theta = \\sum_i \\frac{T_i L_i}{G_i J_i}';
      item.variables = [
        { symbol: '\\theta', meaning: 'Total angle of twist', unit: 'rad' },
        { symbol: 'T_i', meaning: 'Internal torque in shaft segment i', unit: 'N·mm' },
        { symbol: 'L_i', meaning: 'Length of shaft segment i', unit: 'mm' },
        { symbol: 'G_i', meaning: 'Shear modulus of shaft segment i', unit: 'MPa' },
        { symbol: 'J_i', meaning: 'Polar moment of inertia of shaft segment i', unit: 'mm⁴' },
      ];
      item.conditions = 'Sum the signed twist of every shaft segment. Keep units consistent; multiply radians by 180/π only when degrees are requested.';
      item.note = 'General stepped-shaft relation. Numerical substitutions and conversion factors belong in a worked solution, not in the formula library.';
      item.equationScope = 'general';
      put.run(JSON.stringify(item), 'items', row.id); trimmed++;
      continue;
    }
    const parts = String(item.latex || '').split(/\s*(?:=|\\implies)\s*/);
    const numericalResult = parts.length > 2 || (parts.length === 2 && !meaningfulVariables(parts[1]) && /\d/.test(parts[1]));
    const workedTitle = /(?:properties|given|calculated|solved|evaluation|substitut|total .*load|component equation|equilibrium equation along)/i.test(item.title);
    const caseCalculation = exactWorkedTitles.test(item.title) || calculationTitle.test(item.title) || (!preserveTitle.test(item.title) && numericTokens(item.latex) >= 4 && symbolicTokens(item.latex) <= 4);
    if (item.equationScope !== 'case-specific' && !numericalResult && !workedTitle && !caseCalculation) continue;
    const reusable = parts.length >= 2 && meaningfulVariables(parts[1]) && !workedTitle;
    if (!reusable || caseCalculation) { remove.run('items', row.id); deleted.add(row.id); continue; }
    item.latex = `${parts[0].trim()} = ${parts[1].trim()}`;
    item.equationScope = 'general';
    item.note = String(item.note || '').replace(/Case-specific representation:[\s\S]*?(?=(?:\s[A-Z][a-z]+:)|$)/i, '').trim();
    item.title = item.title.replace(/\s+(?:Calculation|Evaluation|Substitution)(?:\s+.*)?$/i, '').trim();
    put.run(JSON.stringify(item), 'items', row.id); trimmed++;
  }
  for (const row of all('reviews')) {
    const review = JSON.parse(row.value);
    if (deleted.has(review.itemId)) remove.run('reviews', row.id);
  }
  db.exec('COMMIT');
  console.log(`Removed ${deleted.size} worked-example entries and reduced ${trimmed} entries to reusable symbolic formulas.`);
} catch (error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
