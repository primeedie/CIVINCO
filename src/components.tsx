import { useEffect, useRef, type ReactNode } from 'react';
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
  let html;
  try { html = katex.renderToString(latex, { displayMode: block, throwOnError: true, trust: false, strict: 'error', output: 'htmlAndMathml' }); }
  catch { return <span className="math-error"><AlertCircle size={15} /> Notation needs correction: <code>{latex}</code></span>; }
  const needsVectorContext = block && /(?:T_|F_).*(?:T_|F_).*=/.test(latex) && /(?:0\.|\\vec|\\mathbf)/.test(latex);
  return <><span className={block ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }} />{needsVectorContext && <figure className="formula-context-diagram"><svg viewBox="0 0 260 150" role="img" aria-label="Three-dimensional vector-component reference"><defs><marker id="component-axis" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" /></marker></defs><line x1="72" y1="112" x2="222" y2="112" markerEnd="url(#component-axis)" /><line x1="72" y1="112" x2="72" y2="20" markerEnd="url(#component-axis)" /><line x1="72" y1="112" x2="20" y2="140" markerEnd="url(#component-axis)" /><line className="context-vector" x1="72" y1="112" x2="180" y2="42" markerEnd="url(#component-axis)" /><line className="context-guide" x1="180" y1="42" x2="180" y2="112" /><text x="230" y="118">x</text><text x="64" y="16">z</text><text x="8" y="146">y</text><text x="184" y="38">F</text></svg><figcaption>Component reference only. Use the linked source figure for the exact cable or force geometry.</figcaption></figure>}</>;
}
export function normalizeEngineeringText(text: string) {
  return text
    .replace(/\b(mm|cm|km|m)\s*\^?\s*2\b/g, '$1²')
    .replace(/\b(mm|cm|km|m)\s*\^?\s*3\b/g, '$1³')
    .replace(/\b(mm|cm|km|m)\s*\^?\s*4\b/g, '$1⁴')
    .replace(/\b(m|ft)\s*\/\s*s\s*\^?\s*2\b/g, '$1/s²')
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
