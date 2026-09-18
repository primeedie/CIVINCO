import { useEffect, useId, useRef, type ReactNode } from 'react';
import katex from 'katex';
import { X, Check, ChevronRight, FileText, AlertCircle } from 'lucide-react';
import { SPEX, type Source, type Spex } from './types';

export async function api<T = { ok: boolean }>(url: string, body?: unknown, method?: string): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch(`/api${url}`, { method: method || (body ? 'POST' : 'GET'), headers: form || !body ? {} : { 'Content-Type': 'application/json' }, body: body ? form ? body : JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Try again.');
  return result;
}
export function MathText({ latex, block = false }: { latex: string; block?: boolean }) {
  const marker = `component-${useId().replace(/:/g, '')}`;
  let html;
  try { html = katex.renderToString(latex, { displayMode: block, throwOnError: true, trust: false, strict: 'error', output: 'htmlAndMathml' }); }
  catch { return <span className="math-error"><AlertCircle size={15} /> Notation needs correction: <code>{latex}</code></span>; }
  const needsVectorContext = block && /(?:\\vec\s*\{?F|\\mathbf\s*F|F_x.*F_y.*F_z|R_x.*R_y.*R_z)/s.test(latex);
  return <><span className={block ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }} />{needsVectorContext && <figure className="formula-context-diagram"><svg viewBox="0 0 420 260" role="img" aria-label="Three-dimensional force and Cartesian component reference"><defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker></defs><g className="context-axes"><line x1="115" y1="205" x2="365" y2="205" markerEnd={`url(#${marker})`} /><line x1="115" y1="205" x2="115" y2="25" markerEnd={`url(#${marker})`} /><line x1="115" y1="205" x2="35" y2="245" markerEnd={`url(#${marker})`} /></g><g className="context-guides"><polyline points="115,205 285,205 285,75" /><polyline points="115,205 70,228 240,228 285,205" /><polyline points="240,228 240,98 285,75" /><line x1="285" y1="75" x2="240" y2="98" /></g><g className="context-components"><line x1="115" y1="205" x2="70" y2="228" /><line x1="70" y1="228" x2="240" y2="228" /><line x1="240" y1="228" x2="240" y2="98" /></g><line className="context-vector" x1="115" y1="205" x2="285" y2="75" markerEnd={`url(#${marker})`} /><circle cx="115" cy="205" r="4" className="context-joint" /><text x="374" y="211">y</text><text x="106" y="18">z</text><text x="20" y="253">x</text><text className="vector-label" x="210" y="124">F</text><text className="component-label" x="145" y="244">Fᵧ</text><text className="component-label" x="44" y="220">Fₓ</text><text className="component-label" x="247" y="158">F_z</text></svg><figcaption>A force in 3D is the vector sum of its x, y, and z projections. This reference explains the component directions; use the source figure for a problem’s exact geometry.</figcaption></figure>}</>;
}
export function normalizeEngineeringText(text: string) {
  return text
    .replace(/(\d)\s*(mm|cm|km|m)\s*\^?\s*2\b/g, '$1 $2²')
    .replace(/(\d)\s*(mm|cm|km|m)\s*\^?\s*3\b/g, '$1 $2³')
    .replace(/(\d)\s*(mm|cm|km|m)\s*\^?\s*4\b/g, '$1 $2⁴')
    .replace(/\b(mm|cm|km|m)\s*\^?\s*2\b/g, '$1²')
    .replace(/\b(mm|cm|km|m)\s*\^?\s*3\b/g, '$1³')
    .replace(/\b(mm|cm|km|m)\s*\^?\s*4\b/g, '$1⁴')
    .replace(/\b(m|ft)\s*\/\s*s\s*\^?\s*2\b/g, '$1/s²')
    .replace(/\b(kN|N)\s*\/\s*(mm|cm|m)\s*\^?\s*3\b/g, '$1/$2³')
    .replace(/\b(kN|N)\s*-\s*m\b/g, '$1·m')
    .replace(/(\d),\s+(\d{3})\b/g, '$1,$2')
    .replace(/(\d)\s*(kN|MN|N|kPa|MPa|GPa|Pa|mm|cm|km|m|L\/s)\b/g, '$1 $2')
    .replace(/\bx\s*10\s*\^\s*([+-]?\d+)/gi, '×10^$1');
}
// Render only explicitly delimited mathematics; surrounding source text stays escaped.
export function RichText({ text }: { text: string }) {
  const parts = normalizeEngineeringText(text).split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g);
  return <>{parts.map((part, n) => part.startsWith('$$') || part.startsWith('\\[') ? <MathText key={n} latex={part.slice(2, -2)} block /> : part.startsWith('$') ? <MathText key={n} latex={part.slice(1, -1)} /> : part.startsWith('\\(') ? <MathText key={n} latex={part.slice(2, -2)} /> : <span key={n}>{part}</span>)}</>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''}`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }} aria-label={title}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}
  </dialog>;
}
export function Badge({ spex, set }: { spex: Spex; set?: number }) { return <span className={`badge ${SPEX[spex].color}`}>SPEX {spex} · {SPEX[spex].code}{set ? ` · Set ${set}` : ''}</span>; }
export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
export function SourceLink({ doc, page }: { doc?: Source; page: number }) {
  if (!doc) return <span className="source-line">Source unavailable</span>;
  const label = doc.extension === '.json' ? 'entry' : ['.txt', '.md'].includes(doc.extension || '') ? 'section' : 'p.';
  return doc.sample ? <span className="source-line"><FileText size={13} /> Starter reference · illustrative content</span> : <a className="source-line" href={`/api/documents/${doc.id}/source${doc.extension === '.pdf' ? `#page=${page}` : ''}`} target="_blank" rel="noreferrer"><FileText size={13} /><span>{doc.name} · {label} {page}</span><ChevronRight size={13} /></a>;
}
export function Status({ children, success = false }: { children: ReactNode; success?: boolean }) { return <div role="status" className={`notice ${success ? 'success' : ''}`}>{success ? <Check size={17} /> : <AlertCircle size={17} />}<span>{children}</span></div>; }
