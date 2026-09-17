import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, ChartNoAxesCombined, ChevronRight, CircleHelp, GraduationCap, Home as HomeIcon, Layers, Menu, Palette, Search, Settings2, Sparkles, Target, X } from 'lucide-react';
import { api, Badge, Modal, Status } from './components';
import { SPEX, type State, type Spex, type View, type Source } from './types';
import { Home } from './Home';
import { Library, FormulaEditor } from './Library';
import { Practice, Flashcards, Progress } from './Study';
import { UploadDialog, SourceDialog, SettingsDialog } from './Dialogs';

const navigation = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'library', label: 'Concepts & Formulas', icon: BookOpen },
  { id: 'practice', label: 'Practice', icon: Target },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'progress', label: 'Progress', icon: ChartNoAxesCombined },
] as const;

const themes = [
  { id: 'sage', label: 'Sage' },
  { id: 'blue', label: 'Soft Blue' },
  { id: 'dark', label: 'Forest Night' },
  { id: 'midnight', label: 'Midnight' },
] as const;
type Theme = typeof themes[number]['id'];

function savedTheme(): Theme {
  const stored = localStorage.getItem('civinco-theme');
  if (stored === 'light') return 'sage';
  if (themes.some(theme => theme.id === stored)) return stored as Theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'sage';
}

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [view, setView] = useState<View>('home');
  const [spex, setSpex] = useState<Spex | 'all'>('all');
  const [set, setSet] = useState('all');
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const [upload, setUpload] = useState(false), [settings, setSettings] = useState(false), [help, setHelp] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null), [addFormula, setAddFormula] = useState(false);
  const [mobile, setMobile] = useState(false), [error, setError] = useState(''), [toast, setToast] = useState('');
  const refresh = useCallback(async () => { const next = await api<State>('/state'); setState(next); setError(''); }, []);
  useEffect(() => { refresh().catch(e => setError(e.message)); const interval = window.setInterval(() => refresh().catch(e => setError(e.message)), 4000); return () => clearInterval(interval); }, [refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('civinco-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ({ sage: '#f4f1e8', blue: '#f4f8fc', dark: '#141d1a', midnight: '#080d1a' })[theme]);
  }, [theme]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [view]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  const navigate = (next: View) => { setView(next); setSearch(''); setMobile(false); };
  const filter = <T extends { spex: Spex; set: number }>(entries: T[]) => entries.filter(e => (spex === 'all' || e.spex === spex) && (set === 'all' || e.set === Number(set)));
  const changeSpex = (next: Spex | 'all') => { setSpex(next); setSet('all'); };
  const sets = state ? [...new Set([...state.documents, ...state.questions].filter(d => spex === 'all' || d.spex === spex).map(d => d.set))].sort((a, b) => a - b) : [];
  const source = state?.documents.find(d => d.id === sourceId);
  const shared = state ? { state, refresh, notify: setToast, spex, set, filter } : null;

  return <div className="app-shell">
    {mobile && <button className="sidebar-shade" onClick={() => setMobile(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobile ? 'open' : ''}`}>
      <a className="brand" href="#home" onClick={e => { e.preventDefault(); navigate('home'); }}><span className="brand-mark"><GraduationCap size={25} strokeWidth={1.6} /></span><span><strong>CIVINCO<span className="brand-dot">.</span></strong><small>for Milch</small></span></a>
      <div className="sidebar-caption">YOUR REVIEW SPACE</div>
      <nav aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigate(id)} aria-current={view === id ? 'page' : undefined}><Icon size={19} /><span>{label}</span>{id === 'home' && !!state?.documents.length && <span className="nav-count">{state.documents.length}</span>}</button>)}</nav>
      <div className="sidebar-divider" /><div className="sidebar-caption">SPECIALIZED EXAMINATIONS</div>
      <div className="spex-nav">{(Object.keys(SPEX) as Spex[]).map(key => <button key={key} className={spex === key ? 'selected' : ''} onClick={() => changeSpex(spex === key ? 'all' : key)}><span className={`subject-dot ${SPEX[key].color}`} /><span>SPEX {key}<small>{SPEX[key].code}</small></span><ChevronRight size={14} /></button>)}</div>
      <div className="sidebar-bottom"><div className="study-note"><span className="little-star">✧</span><p>One concept at a time.<br /><strong>One step closer, engineer.</strong></p></div>
        <button className="nav-item" onClick={() => setSettings(true)}><Settings2 size={18} /><span>AI settings</span><span className={`connection-dot ${state?.settings.connected ? 'connected' : ''}`} /></button>
        <label className="theme-row"><Palette size={18} /><span>Theme</span><select value={theme} onChange={event => setTheme(event.target.value as Theme)} aria-label="Color theme">{themes.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <div className="profile"><span className="avatar">M</span><span><strong>Milch</strong><small>Future civil engineer</small></span></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu size={20} /></button><span>My workspace</span><ChevronRight size={14} /><strong>{navigation.find(n => n.id === view)?.label}</strong></div><div className="topbar-actions"><span className="local-label"><span /> Saved on this device</span><button className="icon-button" aria-label="How CIVINCO works" onClick={() => setHelp(true)}><CircleHelp size={19} /></button><span className="avatar small">M</span></div></header>
      <main>
        {error && <Status>{error} <button className="text-button" onClick={() => refresh().catch(e => setError(e.message))}>Reconnect</button></Status>}
        {!state ? <div className="loading-state"><GraduationCap size={34} /><h2>Opening your review space…</h2></div> : <>
          <div className="page-heading"><div className="eyebrow">CIVINCO FOR MILCH</div><div className="title-row"><h1>{({ home: 'Your next chapter starts here.', library: 'Concepts & formulas', practice: 'Practice', flashcards: 'Flashcards', progress: 'Progress' })[view]}</h1>{view === 'home' && <button className="button primary" onClick={() => setUpload(true)}><span className="plus" aria-hidden="true">+</span> Upload files</button>}{view === 'library' && <button className="button secondary" onClick={() => setAddFormula(true)}>+ Add a formula</button>}</div></div>
          <div className="scope-bar"><div className="scope-tabs" aria-label="Filter by examination"><button className={spex === 'all' ? 'active' : ''} onClick={() => changeSpex('all')}>All SPEX</button>{(Object.keys(SPEX) as Spex[]).map(key => <button key={key} className={spex === key ? 'active' : ''} onClick={() => changeSpex(key)}><span className={`subject-dot ${SPEX[key].color}`} /> SPEX {key}<span className="scope-code">{SPEX[key].code}</span></button>)}</div><select aria-label="Filter by set" value={set} onChange={e => setSet(e.target.value)}><option value="all">All sets</option>{sets.map(n => <option key={n} value={n}>Set {n}</option>)}</select></div>
          {shared && view === 'home' && <Home {...shared} search={search} setSearch={setSearch} onUpload={() => setUpload(true)} onSource={(doc: Source) => setSourceId(doc.id)} navigate={navigate} onSpex={changeSpex} onSettings={() => setSettings(true)} />}
          {shared && view === 'library' && <Library {...shared} search={search} setSearch={setSearch} />}
          {shared && view === 'practice' && <Practice {...shared} />}
          {shared && view === 'flashcards' && <Flashcards {...shared} />}
          {shared && view === 'progress' && <Progress {...shared} navigate={navigate} />}
          <footer><span>CIVINCO for Milch</span><span>Small steps. Strong foundations. <ArrowUpRight size={13} /></span></footer>
        </>}
      </main>
    </div>
    {toast && <div className="toast" role="status"><Sparkles size={17} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}
    {upload && <UploadDialog initialSpex={spex === 'all' ? 'A' : spex} initialSet={set === 'all' ? 1 : Number(set)} onClose={() => setUpload(false)} onSaved={async () => { await refresh(); setToast('Your files are safely stored in your library.'); }} />}
    {settings && state && <SettingsDialog settings={state.settings} onClose={() => setSettings(false)} refresh={refresh} />}
    {source && state && <SourceDialog doc={source} state={state} refresh={refresh} onClose={() => setSourceId(null)} onLibrary={() => { changeSpex(source.spex); setSet(String(source.set)); navigate('library'); setSourceId(null); }} />}
    {addFormula && state && <FormulaEditor documents={state.documents} onClose={() => setAddFormula(false)} onSaved={async () => { await refresh(); setAddFormula(false); setToast('Formula added to your library.'); }} />}
    {help && <Modal title="How CIVINCO works" onClose={() => setHelp(false)}><div className="help-steps">{[['01', 'Upload', 'Add your files. Gemini can detect SPEX and Set from page 1.'], ['02', 'Extract', 'One request reads one page and captures equations, symbols, variables, and concepts.'], ['03', 'Practice', 'Generate checked problems, solutions, and useful engineering diagrams.']].map(([n, title, text]) => <div key={n}><span>{n}</span><section><h3>{title}</h3><p>{text}</p></section></div>)}</div><Status>Completed pages are saved. Resume skips them.</Status></Modal>}
  </div>;
}

export type SharedProps = { state: State; refresh: () => Promise<void>; notify: (text: string) => void; spex: Spex | 'all'; set: string; filter: <T extends { spex: Spex; set: number }>(entries: T[]) => T[] };
