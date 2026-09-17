import { useRef, useState } from 'react';
import { Check, CheckCircle2, ExternalLink, FileText, KeyRound, LoaderCircle, Pause, Play, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { api, Badge, Modal, Status } from './components';
import { SPEX, type Source, type Spex, type State } from './types';

export function UploadDialog({ initialSpex, initialSet, onClose, onSaved }: { initialSpex: Spex; initialSet: number; onClose: () => void; onSaved: () => Promise<void> }) {
  const [spex, setSpex] = useState(initialSpex), [set, setSet] = useState(initialSet), [kind, setKind] = useState('Module');
  const [autoCategorize, setAutoCategorize] = useState(true);
  const [files, setFiles] = useState<File[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function add(incoming: File[]) {
    const valid = incoming.filter(f => /\.(pdf|png|jpe?g|txt|md)$/i.test(f.name) && f.size <= 100 * 1024 * 1024);
    setFiles(current => [...current, ...valid.filter(f => !current.some(c => c.name === f.name && c.size === f.size))].slice(0, 20));
    if (valid.length !== incoming.length) setError('Some files were skipped. Use PDF, PNG, JPG, TXT, or MD, up to 100 MB each.');
    else if (incoming.length + files.length > 20) setError('Upload up to 20 files at a time.'); else setError('');
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('spex', spex); body.append('set', String(set)); body.append('kind', kind); body.append('autoCategorize', String(autoCategorize)); files.forEach(f => body.append('files', f));
      const result = await api<{ accepted: Source[]; errors: { name: string; error: string }[] }>('/documents', body);
      await onSaved();
      if (result.errors.length) { setError(result.errors.map(e => `${e.name}: ${e.error}`).join('\n')); setFiles(files.filter(f => result.errors.some(e => e.name === f.name))); }
      else onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="Upload materials" onClose={() => { if (!busy) onClose(); }}><p className="modal-intro">Add up to 20 course files.</p><form onSubmit={submit}>
    <div className={`dropzone ${drag ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); if (!busy) add(Array.from(e.dataTransfer.files)); }}><Upload size={30} /><strong>Drop your study materials here</strong><span>or <button type="button" className="text-button" disabled={busy} onClick={() => input.current?.click()}>browse files</button></span><small>PDF, PNG, JPG, TXT, MD · 100 MB each · Up to 20 files</small><input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.md" multiple hidden onChange={e => { add(Array.from(e.target.files || [])); e.target.value = ''; }} /></div>
    {!!files.length && <div className="selected-files">{files.map((file, n) => <div key={`${file.name}-${n}`}><FileText size={17} /><span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span><button disabled={busy} type="button" className="icon-button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, i) => i !== n))}><X size={16} /></button></div>)}</div>}
    <label className="check-label"><input type="checkbox" checked={autoCategorize} onChange={e => setAutoCategorize(e.target.checked)} /> Detect SPEX and Set from each file’s first page</label>
    <div className="form-grid">{!autoCategorize && <><label>Examination<select value={spex} onChange={e => setSpex(e.target.value as Spex)}>{(Object.keys(SPEX) as Spex[]).map(s => <option key={s} value={s}>SPEX {s} · {SPEX[s].code}</option>)}</select></label><label>Set number<input type="number" required min={1} max={999} value={set} onChange={e => setSet(Number(e.target.value))} /></label></>}<label>Material type<select value={kind} onChange={e => setKind(e.target.value)}>{['Module', 'Book', 'Notes', 'Exam'].map(k => <option key={k}>{k}</option>)}</select></label></div>
    <Status>Uploading and storing a file uses no Gemini credits. Extracting or automatically classifying new material requires your own Gemini API key, which you can add in AI Settings.</Status>
    <p className="fine-print"><ShieldCheck size={15} /> Auto-detection is included in the first extraction request—no extra API call.</p>{error && <Status>{error}</Status>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={!files.length || busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}{busy ? 'Uploading…' : `Upload ${files.length || ''} ${files.length === 1 ? 'file' : 'files'}`}</button></div>
  </form></Modal>;
}

export function SourceDialog({ doc, state, refresh, onClose, onLibrary }: { doc: Source; state: State; refresh: () => Promise<void>; onClose: () => void; onLibrary: () => void }) {
  const [spex, setSpex] = useState(doc.spex), [set, setSet] = useState(doc.set), [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmDelete, setConfirmDelete] = useState(false);
  const pages = state.pages.filter(p => p.docId === doc.id).sort((a, b) => a.page - b.page);
  const items = state.items.filter(i => i.docId === doc.id), done = pages.filter(p => p.status === 'extracted').length;
  const isBank = doc.kind === 'Problem Bank', bankProblems = doc.totalPages;
  const working = ['queued', 'extracting'].includes(doc.status);
  async function run(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action(); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Modal title="Source details" onClose={onClose} wide><div className="source-heading"><span className="file-icon"><FileText size={27} /></span><div><h3>{doc.name}</h3>{doc.autoCategorize && !doc.categoryDetected ? <span className="badge">AUTO · DETECTS FROM PAGE 1</span> : <Badge spex={doc.spex} set={doc.set} />}{doc.categoryReason && <small className="category-reason">{doc.categoryReason}</small>}</div></div>
    {doc.sample ? <Status>These are included examples, not extracted from your course files. Upload your own materials to build a course-specific library.</Status> : <>
      <div className="source-stats"><div><strong>{isBank ? bankProblems : `${done} / ${doc.totalPages}`}</strong><span>{isBank ? 'Problems stored locally' : `${['.txt', '.md'].includes(doc.extension || '') ? 'Text sections' : 'Pages'} extracted`}</span></div><div><strong>{isBank ? '0' : items.filter(i => i.kind === 'formula').length}</strong><span>{isBank ? 'Gemini requests required' : 'Equations found'}</span></div><div><strong>{isBank ? doc.set : pages.filter(p => p.reviewed).length}</strong><span>{isBank ? 'Assigned Set' : 'Pages reviewed by you'}</span></div></div>
      <div className="progress-track"><span style={{ width: `${done / doc.totalPages * 100}%` }} /></div>
      <p className="fine-print">{isBank ? 'This bank is stored locally. Opening, shuffling, answering, and reviewing its problems use no Gemini credits.' : 'Gemini processes one page per request. Verify symbols before approval.'}</p>
      <div className="button-row"><a className="button secondary" href={`/api/documents/${doc.id}/source`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open original</a>{doc.editable !== false && (working ? <button className="button secondary" disabled={busy} onClick={() => run(() => api(`/documents/${doc.id}/pause`, {}))}><Pause size={16} /> Pause after this page</button> : done < doc.totalPages && <button className="button primary" disabled={busy} onClick={() => run(() => api(`/documents/${doc.id}/extract`, {}))}><Sparkles size={16} />{doc.status === 'stored' ? 'Extract with Gemini' : 'Resume unfinished pages'}</button>)}</div>
      {working && <div className="processing-note"><LoaderCircle className="spin" size={16} /> Reading your pages and validating equation notation. You can keep studying while this runs.</div>}
      {doc.status === 'paused' && <p className="fine-print">Paused. A page already in progress will finish and be saved.</p>}
      {doc.error && <Status>{doc.error}</Status>}
      <div className="page-inventory"><h3>{isBank ? 'Problem inventory' : 'Page inventory'}</h3>{pages.map(page => {
        const formulas = items.filter(i => i.page === page.page && i.kind === 'formula');
        return <div className="page-inventory-row" key={page.id}><div><strong>{isBank ? 'Problem' : ['.txt', '.md'].includes(doc.extension || '') ? 'Section' : 'Page'} {page.page}</strong><span>{isBank ? 'Ready for practice · stored locally' : `${formulas.length} equations · ${page.status}${page.reviewed ? ' · Reviewed' : ''}`}</span>{page.error && <small className="error-text">{page.error}</small>}{page.warnings.map((w, i) => <small className="error-text" key={i}>{w}</small>)}</div><div className="page-actions"><a href={`/api/documents/${doc.id}/source${isBank ? '' : `#page=${page.page}`}`} target="_blank" rel="noreferrer" aria-label={`Open original ${isBank ? 'problem bank' : `page ${page.page}`}`}><ExternalLink size={15} /></a>{doc.editable !== false && !isBank && page.status === 'extracted' && <button className="button tiny secondary" disabled={busy || page.reviewed} onClick={() => run(() => api(`/documents/${doc.id}/pages/${page.page}/review`, {}))}>{page.reviewed ? <Check size={14} /> : <ShieldCheck size={14} />}{page.reviewed ? 'Reviewed' : 'Mark reviewed'}</button>}</div></div>;
      })}</div>
    </>}
    <div className="source-bottom">{!isBank && <button className="button secondary" onClick={onLibrary}>Review concepts & formulas <ExternalLink size={15} /></button>}{doc.editable !== false && <div className="form-grid"><label>Examination<select value={spex} onChange={e => setSpex(e.target.value as Spex)}>{(Object.keys(SPEX) as Spex[]).map(s => <option key={s} value={s}>SPEX {s} · {SPEX[s].code}</option>)}</select></label><label>Set<input type="number" min={1} max={999} value={set} onChange={e => setSet(Number(e.target.value))} /></label><button className="button secondary align-end" disabled={busy || working || (spex === doc.spex && set === doc.set)} onClick={() => run(() => api(`/documents/${doc.id}`, { spex, set }, 'PATCH'))}>Save category</button></div>}</div>
    {error && <Status>{error}</Status>}
    {doc.editable !== false && (confirmDelete ? <div className="delete-confirm"><p>Remove this file and its concepts, formulas, questions, and associated progress? This cannot be undone.</p><button className="button danger" disabled={busy} onClick={() => run(async () => { await api(`/documents/${doc.id}`, undefined, 'DELETE'); onClose(); })}>Remove permanently</button><button className="button secondary" onClick={() => setConfirmDelete(false)}>Keep file</button></div> : <button className="text-button danger-text" disabled={working || busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Remove from library</button>)}
  </Modal>;
}

export function SettingsDialog({ settings, onClose, refresh }: { settings: State['settings']; onClose: () => void; refresh: () => Promise<void> }) {
  const [key, setKey] = useState('');
  const [model, setModel] = useState(settings.model);
  const [busy, setBusy] = useState(false), [tutorial, setTutorial] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function save(test = false) {
    setBusy(true); setError(''); setMessage('');
    try {
      await api('/settings', { ...(key ? { apiKey: key } : {}), model }, 'PUT');
      setKey(''); await refresh();
      if (test) await api('/settings/test', {});
      setMessage(test ? 'Connection verified. Your AI study tools are ready.' : 'Settings saved for this device session.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function removeKey() {
    setBusy(true); setError(''); setMessage('');
    try { await api('/settings/key', undefined, 'DELETE'); setKey(''); await refresh(); setMessage('Gemini key removed from this device session.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="Gemini settings" onClose={onClose}><div className="settings-illustration"><Sparkles size={29} /></div><p className="modal-intro">Gemini powers classification, extraction, online formula repair, and AI practice. Permanent problem banks and existing flashcards do not use Gemini.</p><div className="settings-status"><span className={`connection-dot ${settings.connected ? 'connected' : ''}`} />{settings.connected ? 'Gemini connected for this device' : 'No Gemini key connected on this device'}</div>
    <label className="field-label">Gemini API key<input autoComplete="off" type="password" placeholder={settings.connected ? 'Enter a new key to replace the current one' : 'Paste your Gemini API key'} value={key} onChange={e => setKey(e.target.value)} /></label><label className="field-label">Model<input value={model} onChange={e => setModel(e.target.value)} placeholder="gemini-3.6-flash" /></label>
    <button className="button secondary tutorial-button" type="button" onClick={() => setTutorial(!tutorial)}><KeyRound size={15} /> How to get a Gemini API key</button>
    {tutorial && <div className="key-tutorial"><ol><li>Open Google AI Studio and sign in.</li><li>Create a separate API key for CIVINCO.</li><li>Restrict it to the Gemini API.</li><li>Paste it above, then choose Save &amp; test connection.</li></ol><a className="text-button" href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noreferrer">Open Google’s official instructions <ExternalLink size={14} /></a></div>}
    <p className="fine-print"><KeyRound size={15} /> Your key is used only for requests from this device session. It is never included in the public course library or GitHub repository.</p>
    <Status>Extraction uses one Gemini request per page. First-page classification is included in that request.</Status>
    {message && <Status success>{message}</Status>}{error && <Status>{error}</Status>}<div className="modal-actions">{settings.connected && <button className="text-button danger-text" disabled={busy} onClick={removeKey}>Remove key</button>}<button className="button secondary" disabled={busy || !model.trim()} onClick={() => save()}>Save settings</button><button className="button primary" disabled={busy || !model.trim() || (!key && !settings.connected)} onClick={() => save(true)}>{busy ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}Save & test connection</button></div>
  </Modal>;
}
