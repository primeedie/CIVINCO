import type { Item, Question, Source } from './types';

const clean = (value?: string) => String(value || '').trim();

export type GuideRecord = Pick<Item, 'topic' | 'docId' | 'page' | 'spex' | 'set'> | Pick<Question, 'topic' | 'sourceDocId' | 'sourcePage' | 'spex' | 'set'>;

export const PDF_CATEGORY_ORDER = [
  'Statics of Rigid Bodies', 'Dynamics of Rigid Bodies', 'Strength of Materials',
  'Determinacy and Stability of Structures', 'Methods of Structural Analysis', 'Influence Lines',
  'Introduction to Reinforced Concrete Design', 'Singly-Reinforced Rectangular Beams', 'T-Beams', 'Shear in Beams',
  'Axially-Loaded Columns', 'Long (Slender) Columns', 'Steel Beams', 'Axial and Moment Loads',
  'Foundations', 'Construction Engineering',
];

export const categoryPosition = (category: string) => {
  const index = PDF_CATEGORY_ORDER.indexOf(category);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
};

export function sourceCategory(record: GuideRecord, documents: Source[]) {
  const topic = clean(record.topic), name = topic.toLowerCase();
  const docId = 'docId' in record ? record.docId : record.sourceDocId;
  const page = ('page' in record ? record.page : record.sourcePage) || 0;
  const documentName = clean(documents.find(document => document.id === docId)?.name).toLowerCase();

  if (/engineering mechanics and strength of materials/.test(documentName) || (record.spex === 'A' && record.set === 1)) {
    if (page >= 2 && page <= 10) return 'Statics of Rigid Bodies';
    if (page >= 11 && page <= 16) return 'Dynamics of Rigid Bodies';
    if (page >= 17 && page <= 25) return 'Strength of Materials';
    if (/projectile|kinematic|rectilinear|curvilinear|rotational|dynamics|work and energy|momentum|impulse|conservation of energy|force and acceleration|types of motion/.test(name)) return 'Dynamics of Rigid Bodies';
    if (/statics|friction|truss|equilibrium|force system|force vector|force decomposition|resultant|moment of a force|3d/.test(name)) return 'Statics of Rigid Bodies';
    return 'Strength of Materials';
  }
  if (/theory of structures/.test(documentName) || (record.spex === 'A' && record.set === 2)) {
    if (/influence|moving load/.test(name)) return 'Influence Lines';
    if (/determinacy|stability/.test(name)) return 'Determinacy and Stability of Structures';
    return 'Methods of Structural Analysis';
  }
  if (/reinforced\s+concrete\s+-?\s*beams/.test(documentName) || (record.spex === 'A' && record.set === 3)) {
    if (/t-?beam/.test(name)) return 'T-Beams';
    if (/shear|web reinforcement/.test(name)) return 'Shear in Beams';
    if (/introduction|material|cover|load combination|code|strength design/.test(name)) return 'Introduction to Reinforced Concrete Design';
    return 'Singly-Reinforced Rectangular Beams';
  }
  if (/reinforced\s+concrete\s+-?\s*columns/.test(documentName) || (record.spex === 'A' && record.set === 4)) {
    return /slender|magnification|effective length/.test(name) ? 'Long (Slender) Columns' : 'Axially-Loaded Columns';
  }
  if (/structural steel/.test(documentName) || (record.spex === 'A' && record.set === 5)) {
    if (/combined|interaction|axial and moment/.test(name)) return 'Axial and Moment Loads';
    if (/column|compression|buckling/.test(name)) return 'Axially-Loaded Columns';
    return 'Steel Beams';
  }
  if (/foundation engineering and construction/.test(documentName) || (record.spex === 'A' && record.set === 6)) {
    return /construction|scheduling|project|cost|mix design/.test(name) ? 'Construction Engineering' : 'Foundations';
  }
  return topic;
}

export function compareByPdfOrder(a: Item, b: Item, documentOrder: Map<string, number>) {
  return a.spex.localeCompare(b.spex) || a.set - b.set || (documentOrder.get(a.docId) ?? 9999) - (documentOrder.get(b.docId) ?? 9999) || a.page - b.page;
}
