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
function VectorContextDiagram({ latex }: { latex: string }) {
  const id = useId().replace(/:/g, '');
  const marker = `vector-${id}`;
  const angleMarker = `angle-${id}`;
  const isMoment = /(?:\\times|\\begin\{vmatrix\}|\\vec\s*\{?M|\\mathbf\s*\{?M)/.test(latex);
  const isPosition = /\\vec\s*\{?r|\\mathbf\s*\{?r/.test(latex) && !isMoment;
  const isLambda = /\\lambda/.test(latex);
  const hasAngles = /theta_[xyz]|theta\s*_\s*\{[xyz]\}/.test(latex);
  const description = isMoment ? 'Moment of a force about the origin' : isPosition ? 'Position vector in Cartesian coordinates' : isLambda ? 'Force magnitude and its unit direction vector' : hasAngles ? 'Force direction angles and Cartesian components' : 'Force in Cartesian component form';
  return <figure className="formula-context-diagram">
    <svg viewBox="0 0 560 350" role="img" aria-label={`${description}. All variables shown in the equation are labeled.`}>
      <defs>
        <marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker>
        <marker id={angleMarker} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" /></marker>
      </defs>
      <g className="context-axes">
        <line x1="160" y1="275" x2="500" y2="275" markerEnd={`url(#${marker})`} />
        <line x1="160" y1="275" x2="160" y2="30" markerEnd={`url(#${marker})`} />
        <line x1="160" y1="275" x2="42" y2="326" markerEnd={`url(#${marker})`} />
      </g>
      <g className="axis-labels">
        <text x="492" y="296">+y, j</text><text x="172" y="27">+z, k</text><text x="20" y="340">+x, i</text>
      </g>
      <g className="context-guides">
        <polyline points="160,275 397,275 397,92" />
        <polyline points="160,275 93,304 330,304 397,275" />
        <polyline points="330,304 330,121 397,92" />
      </g>
      {!isMoment && <g className="context-components">
        <line x1="160" y1="275" x2="93" y2="304" /><line x1="93" y1="304" x2="330" y2="304" /><line x1="330" y1="304" x2="330" y2="121" />
        <text x="70" y="286">{isPosition ? 'x i' : 'Fₓ i'}</text><text x="205" y="329">{isPosition ? 'y j' : 'Fᵧ j'}</text><text x="340" y="211">{isPosition ? 'z k' : 'F_z k'}</text>
      </g>}
      {isMoment && <>
        <line className="position-vector" x1="160" y1="275" x2="302" y2="176" markerEnd={`url(#${marker})`} />
        <line className="context-vector" x1="302" y1="176" x2="421" y2="78" markerEnd={`url(#${marker})`} />
        <path className="moment-arc" d="M225 263 C245 229 245 210 222 191" markerEnd={`url(#${angleMarker})`} />
        <text className="position-label" x="220" y="220">r</text><text className="vector-label" x="365" y="118">F</text><text className="moment-label" x="241" y="229">M = r × F</text>
      </>}
      {!isMoment && <>
        <line className={isPosition ? 'position-vector' : 'context-vector'} x1="160" y1="275" x2="397" y2="92" markerEnd={`url(#${marker})`} />
        <text className={isPosition ? 'position-label' : 'vector-label'} x="284" y="163">{isPosition ? 'r' : 'F'}</text>
        {isLambda && <><line className="lambda-vector" x1="160" y1="275" x2="279" y2="183" markerEnd={`url(#${marker})`} /><text className="lambda-label" x="205" y="209">λ (unit direction)</text><text className="lambda-label" x="365" y="55">F = Fλ</text></>}
        {hasAngles && <g className="angle-labels"><path d="M205 275 A45 45 0 0 0 192 246" /><text x="205" y="257">θᵧ</text><path d="M160 223 A52 52 0 0 1 191 234" /><text x="171" y="213">θ_z</text><path d="M128 289 A36 36 0 0 1 142 250" /><text x="112" y="258">θₓ</text></g>}
      </>}
      <circle cx="160" cy="275" r="5" className="context-joint" />
    </svg>
    <figcaption><strong>{description}.</strong> Generic visual reference; use the source figure for a problem’s exact geometry. Adapted from <a href="https://engineeringstatics.org/coordinates-3d.html" target="_blank" rel="noreferrer">Engineering Statics</a> by Daniel W. Baker and William Haynes, <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>.</figcaption>
  </figure>;
}

export function MathText({ latex, block = false, contextDiagram = false }: { latex: string; block?: boolean; contextDiagram?: boolean }) {
  let html;
  try { html = katex.renderToString(latex, { displayMode: block, throwOnError: true, trust: false, strict: 'error', output: 'htmlAndMathml' }); }
  catch { return <span className="math-error"><AlertCircle size={15} /> Notation needs correction: <code>{latex}</code></span>; }
  const needsVectorContext = contextDiagram && block && /(?:\\vec|\\mathbf|F_[xyz]|R_[xyz]|theta_[xyz]|\\lambda|\\times|\\begin\{vmatrix\})/s.test(latex);
  return <><span className={block ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }} />{needsVectorContext && <VectorContextDiagram latex={latex} />}</>;
}
export function normalizeEngineeringText(text: string) {
  return String(text || '')
    .replace(/\b(?:sq\.?|square)\s*(mm|cm|m|km|ft|in)\b/gi, '$1²')
    .replace(/\b(?:cu\.?|cubic)\s*(mm|cm|m|km|ft|in)\b/gi, '$1³')
    .replace(/(\d)(mm|cm|km|m|ft|in)\s*\^?\s*([234])\b/gi, (_, number, unit, power) => `${number} ${unit}${({ 2: '²', 3: '³', 4: '⁴' } as Record<string, string>)[power]}`)
    .replace(/\b(mm|cm|km|m|ft|in)\s*\^?\s*([234])\b/gi, (_, unit, power) => `${unit}${({ 2: '²', 3: '³', 4: '⁴' } as Record<string, string>)[power]}`)
    .replace(/\b(m|ft)\s*\/\s*s\s*\^?\s*2\b/gi, '$1/s²')
    .replace(/\b(kg|kN|N)\s*\/\s*(mm|cm|m|ft)\s*\^?\s*([23])\b/gi, (_, force, unit, power) => `${force}/${unit}${power === '2' ? '²' : '³'}`)
    .replace(/\b(kN|N)\s*-\s*m\b/g, '$1·m')
    .replace(/(\d),\s+(\d{3})\b/g, '$1,$2')
    .replace(/(\d)\s*(kN|MN|N|kPa|MPa|GPa|Pa|mm|cm|km|m|L\/s)\b/g, '$1 $2')
    .replace(/\bx\s*10\s*\^\s*([+-]?\d+)/gi, '×10^$1');
}
export function normalizeMathSymbol(symbol: string) {
  if (String(symbol || '').includes('\\')) return String(symbol || '').trim();
  const greek: Record<string, string> = { α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\varepsilon', θ: '\\theta', λ: '\\lambda', μ: '\\mu', ν: '\\nu', ξ: '\\xi', π: '\\pi', ρ: '\\rho', σ: '\\sigma', τ: '\\tau', φ: '\\phi', ω: '\\omega', Δ: '\\Delta', Σ: '\\Sigma', Ω: '\\Omega' };
  const subscripts: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₓ': 'x', 'ᵧ': 'y', 'ᵢ': 'i', 'ⱼ': 'j', 'ₙ': 'n', 'ₛ': 's' };
  let result = '', subscript = '';
  const flush = () => { if (subscript) { result += `_{${subscript}}`; subscript = ''; } };
  for (const character of String(symbol || '').trim()) {
    if (subscripts[character]) { subscript += subscripts[character]; continue; }
    flush();
    if (character === '²' || character === '³' || character === '⁴') result += `^{${({ '²': '2', '³': '3', '⁴': '4' } as Record<string, string>)[character]}}`;
    else result += greek[character] || character;
  }
  flush();
  return result;
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
