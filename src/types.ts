export type Spex = 'A' | 'B' | 'C';
export type View = 'home' | 'library' | 'practice' | 'flashcards' | 'progress';
export type Source = { id: string; name: string; spex: Spex; set: number; kind: string; sample: boolean; size: number; totalPages: number; extension?: string; status: string; createdAt: string; error: string; editable?: boolean; autoCategorize?: boolean; categoryDetected?: boolean; categoryConfidence?: string; categoryReason?: string };
export type SourcePage = { id: string; docId: string; page: number; status: string; reviewed: boolean; warnings: string[]; error: string };
export type Variable = { symbol: string; meaning: string; unit: string };
export type WebSource = { title: string; url: string };
export type Item = { id: string; docId: string; page: number; spex: Spex; set: number; kind: 'formula' | 'concept'; title: string; topic: string; latex?: string; variables?: Variable[]; conditions?: string; uncertain?: boolean; note?: string; explanation?: string; reviewed: boolean; sample: boolean; editable?: boolean; webSources?: WebSource[]; repairConfidence?: 'high' | 'medium' | 'low'; repairReason?: string; searchEntryPoint?: string };
export type DiagramLine = { x1: number; y1: number; x2: number; y2: number; dashed: boolean };
export type Diagram = { title: string; caption: string; lines: DiagramLine[]; arrows: DiagramLine[]; circles: { cx: number; cy: number; r: number; filled: boolean }[]; rectangles: { x: number; y: number; width: number; height: number; filled: boolean }[]; labels: { x: number; y: number; text: string; align: 'start' | 'middle' | 'end' }[]; image?: { url: string; alt: string; caption: string } };
export type Question = { id: string; title: string; topic: string; spex: Spex; set: number; prompt: string; unit: string; sourceIds: string[]; sourceDocId?: string; sourcePage?: number; mode: string; createdAt: string; diagram?: Diagram };
export type Attempt = { id: string; questionId: string; spex: Spex; set: number; topic: string; correct: boolean; answer: number | null; revealed: boolean; createdAt: string };
export type Review = { id: string; itemId: string; spex: Spex; set: number; topic: string; interval: number; due: string; count: number; rating: string; lastReviewedAt: string };
export type State = { documents: Source[]; pages: SourcePage[]; items: Item[]; questions: Question[]; attempts: Attempt[]; reviews: Review[]; settings: { connected: boolean; model: string } };
export type Solution = { correct?: boolean; numeric?: number; expected: number; unit: string; tolerance: number; steps: { text: string; latex: string }[]; revealed?: boolean; firstAttempt?: boolean };
export const SPEX = {
  A: { code: 'PSAD', title: 'Principles of Structural Analysis & Design', short: 'Structural analysis & design', color: 'sage' },
  B: { code: 'MSTE', title: 'Mathematics, Surveying & Transportation Engineering', short: 'Mathematics, surveying & transportation', color: 'clay' },
  C: { code: 'HGE', title: 'Hydraulics & Geotechnical Engineering', short: 'Hydraulics & geotechnical engineering', color: 'blue' },
};
