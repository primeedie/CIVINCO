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
  return <span className={block ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }} />;
}
// Render only explicitly delimited mathematics; surrounding source text stays escaped.
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g);
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
