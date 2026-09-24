import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BookCheck, BookOpen, CheckCircle2, ClipboardCheck, Lightbulb, ListChecks, Target } from 'lucide-react';
import { api, Badge, Empty, EngineeringDiagram, MathText, Modal, normalizeEngineeringText, normalizeMathSymbol, RichText, SourceLink, Status } from './components';
import type { SharedProps } from './App';
import { categoryPosition, compareByPdfOrder, sourceCategory, type GuideRecord } from './studyCategories';
import type { Question, View } from './types';

const unique = <T,>(values: T[]) => [...new Set(values)];
const clean = (value?: string) => String(value || '').trim();

function remindersFor(topic: string) {
  const name = topic.toLowerCase();
  if (/3d|vector|cartesian|resultant/.test(name)) return ['Draw and label the positive x, y, and z axes before resolving a vector.', 'Normalize a direction vector before multiplying it by the force magnitude.', 'Carry the signs of every component through the summation, then check the resultant magnitude.'];
  if (/truss|frame|equilibrium|statics|force/.test(name)) return ['Begin with a complete free-body diagram.', 'Choose one sign convention and keep it through every equilibrium equation.', 'Check whether the requested member force is tension or compression.'];
  if (/torsion|shaft/.test(name)) return ['Use radians in the angle-of-twist equation.', 'Convert torque, length, and modulus into one consistent unit system.', 'For a hollow shaft, use both outside and inside diameters in the polar moment.'];
  if (/stress|strain|axial|beam|concrete|steel/.test(name)) return ['Separate the governing symbolic equation from substituted numerical work.', 'Use the correct cross-sectional property and keep area or inertia units explicit.', 'Check every applicable strength, serviceability, and geometry limit before choosing the controlling result.'];
  if (/fluid|hydraulic|buoy|flow|pressure/.test(name)) return ['Mark the datum and pressure reference before writing the energy or pressure equation.', 'Keep density, unit weight, and gravitational acceleration distinct.', 'Check that the final dimensions match the requested hydraulic quantity.'];
  if (/soil|geotech|foundation/.test(name)) return ['State whether stresses are total or effective.', 'Record drainage and groundwater assumptions before selecting a relationship.', 'Keep soil parameters and their units tied to the layer where they apply.'];
  if (/probability|permutation|combination|statistics/.test(name)) return ['Define the sample space before counting favorable outcomes.', 'Decide whether order matters and whether repetition is allowed.', 'Check that a probability remains between 0 and 1.'];
  if (/survey|bearing|azimuth/.test(name)) return ['Sketch the direction convention before converting angles.', 'Keep degrees, minutes, and seconds separate during arithmetic.', 'Perform a closure or reasonableness check when the data allow it.'];
  return ['List the givens, the required quantity, and the assumptions before choosing an equation.', 'Use one consistent unit system and write units beside intermediate results.', 'Check the answer against the expected sign, scale, and physical behavior.'];
}

export function Guide({ state, filter, refresh, navigate }: SharedProps & { navigate: (view: View) => void }) {
  const [bankExamples, setBankExamples] = useState<Question[]>([]), [pendingExample, setPendingExample] = useState<Question | null>(null), [openingExample, setOpeningExample] = useState(''), [exampleError, setExampleError] = useState('');
  const scopedItems = filter(state.items);
  const scopedQuestions = filter(state.questions);
  const scopedAttempts = filter(state.attempts).filter(attempt => !attempt.revealed);
  const records: GuideRecord[] = [...scopedItems, ...scopedQuestions];
  const categories = useMemo(() => unique(records.filter(record => clean(record.topic)).map(record => sourceCategory(record, state.documents))).sort((a, b) => categoryPosition(a) - categoryPosition(b) || a.localeCompare(b)), [scopedItems, scopedQuestions, state.documents]);
  const [selected, setSelected] = useState('');
  useEffect(() => { if (!categories.includes(selected)) setSelected(categories[0] || ''); }, [categories.join('|'), selected]);

  const documentOrder = new Map(state.documents.map((document, index) => [document.id, index]));
  const entries = scopedItems.filter(item => sourceCategory(item, state.documents) === selected).sort((a, b) => compareByPdfOrder(a, b, documentOrder));
  const concepts = entries.filter(item => item.kind === 'concept');
  const formulas = entries.filter(item => item.kind === 'formula');
  const uncheckedCount = formulas.filter(item => !item.reviewed || item.uncertain).length;
  const applications = unique(formulas.map(item => clean(item.conditions)).filter(Boolean));
  const categoryQuestions = scopedQuestions.filter(question => sourceCategory(question, state.documents) === selected).sort((a, b) => a.spex.localeCompare(b.spex) || a.set - b.set || (documentOrder.get(a.sourceDocId || '') ?? 9999) - (documentOrder.get(b.sourceDocId || '') ?? 9999) || (a.sourcePage || 0) - (b.sourcePage || 0));
  const categoryTopics = unique([...entries.map(item => clean(item.topic)), ...categoryQuestions.map(question => clean(question.topic))].filter(Boolean));
  const topicCategories = new Map(records.map(record => [clean(record.topic), sourceCategory(record, state.documents)]));
  const attempts = scopedAttempts.filter(attempt => topicCategories.get(clean(attempt.topic)) === selected);
  const correct = attempts.filter(attempt => attempt.correct).length;
  const first = entries[0] || categoryQuestions[0];
  useEffect(() => {
    let cancelled = false;
    if (!first) { setBankExamples([]); return; }
    setBankExamples([]);
    setExampleError('');
    api<{ questions: Question[] }>(`/guide/problems?spex=${first.spex}&set=${first.set}`).then(result => { if (!cancelled) setBankExamples(result.questions); }).catch(error => { if (!cancelled) { setBankExamples([]); setExampleError((error as Error).message); } });
    return () => { cancelled = true; };
  }, [selected, first?.spex, first?.set]);
  const sampleProblems = bankExamples.filter(question => sourceCategory(question, state.documents) === selected).slice(0, 3);
  async function openExample(question: Question, replace = false) {
    setOpeningExample(question.id); setExampleError('');
    try {
      const result = await api<{ question: Question }>(`/guide/problems/${question.id}/open`, { replace });
      localStorage.setItem('civinco-active-problem', result.question.id);
      await refresh();
      setPendingExample(null);
      navigate('practice');
    } catch (error) { setExampleError((error as Error).message); }
    finally { setOpeningExample(''); }
  }

  if (!categories.length) return <Empty icon={<BookOpen size={30} />} title="Your study guide will grow from your materials" text="Add starter references or extract an uploaded file. CIVINCO will organize its concepts and formulas into topic lessons without another Gemini request." />;

  return <div className="guide-layout">
    <aside className="guide-index" aria-label="Study guide categories">
      <div className="guide-index-heading"><span className="section-kicker"><BookOpen size={15} /> SLIDE CATEGORIES</span><strong>{categories.length} {categories.length === 1 ? 'category' : 'categories'}</strong></div>
      {categories.map(category => {
        const categoryItems = scopedItems.filter(item => sourceCategory(item, state.documents) === category);
        const categoryAttempts = scopedAttempts.filter(attempt => topicCategories.get(clean(attempt.topic)) === category);
        const percent = categoryAttempts.length ? Math.round(categoryAttempts.filter(attempt => attempt.correct).length / categoryAttempts.length * 100) : null;
        return <button key={category} className={selected === category ? 'active' : ''} onClick={() => setSelected(category)}><span><strong>{category}</strong><small>{categoryItems.length} study {categoryItems.length === 1 ? 'entry' : 'entries'}</small></span><span className={percent === null ? '' : percent >= 80 ? 'strong' : percent < 60 ? 'focus' : ''}>{percent === null ? 'NEW' : `${percent}%`}</span></button>;
      })}
    </aside>

    <article className="guide-article">
      <header className="guide-hero">
        <div>{first && <Badge spex={first.spex} set={first.set} />}<span className="topic-label">STUDY GUIDE · SOURCE SLIDE CATEGORY</span><h2>{selected}</h2><p>The material and equations below follow their order in the source PDF.</p></div>
        <div className="guide-score"><span>{attempts.length ? `${correct}/${attempts.length}` : '—'}</span><small>{attempts.length ? 'correct first attempts' : 'no scored attempts yet'}</small></div>
      </header>

      <section className="guide-route" aria-label="Recommended study order">
        {[['01', 'Understand', 'Read the core ideas and identify the physical model.'], ['02', 'Recall', 'Write the governing equations and define every symbol.'], ['03', 'Apply', 'Match each equation to its conditions and solve practice problems.']].map(([number, title, text]) => <div key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}
      </section>

      <section className="guide-section">
        <div className="guide-section-title"><BookCheck size={19} /><div><span>CORE IDEAS</span><h3>Understand before memorizing</h3></div></div>
        {concepts.length ? <div className="guide-concepts">{concepts.map(concept => <div key={concept.id}><h4>{concept.title}</h4><p><RichText text={concept.explanation || 'Review the connected source for the complete explanation.'} /></p><SourceLink doc={state.documents.find(document => document.id === concept.docId)} page={concept.page} /></div>)}</div> : <p className="guide-empty-note">No separate concept notes were extracted for this topic yet. Use the equations and their applicability conditions as the starting outline, then consult the connected source pages.</p>}
      </section>

      <section className="guide-section">
        <div className="guide-section-title"><Lightbulb size={19} /><div><span>WHAT TO REMEMBER</span><h3>Equations from your materials</h3></div></div>
        {formulas.length ? <div className="guide-formulas">{formulas.map(formula => <div key={formula.id} className={`guide-formula ${formula.uncertain ? 'uncertain' : ''}`}><div><div><h4>{formula.title}</h4><span className={`guide-formula-status ${formula.reviewed && !formula.uncertain ? 'checked' : ''}`}>{formula.uncertain ? 'Notation uncertain' : formula.reviewed ? 'Source checked' : 'Not reviewed'}</span></div><MathText latex={formula.latex || ''} block /></div>{formula.variables?.length ? <dl>{formula.variables.map((variable, index) => <div key={`${variable.symbol}-${index}`}><dt><MathText latex={normalizeMathSymbol(variable.symbol)} /></dt><dd>{variable.meaning}{variable.unit && <small>{normalizeEngineeringText(variable.unit)}</small>}</dd></div>)}</dl> : null}{formula.conditions && <p className="guide-formula-condition"><strong>Use when</strong> <RichText text={formula.conditions} /></p>}<SourceLink doc={state.documents.find(document => document.id === formula.docId)} page={formula.page} /></div>)}</div> : <p className="guide-empty-note">No equations were extracted for this topic yet. Check the connected concept sources or add a formula manually.</p>}
        {!!uncheckedCount && <div className="guide-caution"><AlertTriangle size={17} /><span>{uncheckedCount} equation{uncheckedCount === 1 ? ' is' : 's are'} shown with a review warning. Compare {uncheckedCount === 1 ? 'it' : 'them'} with the connected source before relying on the notation.</span></div>}
      </section>

      <section className="guide-section">
        <div className="guide-section-title"><Target size={19} /><div><span>APPLICATIONS</span><h3>Know when to use it</h3></div></div>
        {applications.length ? <div className="guide-applications">{applications.map(application => <div key={application}><CheckCircle2 size={15} /><span><RichText text={application} /></span></div>)}</div> : <p className="guide-empty-note">Application notes will appear when formulas are available for this PDF section.</p>}
      </section>

      <section className="guide-section">
        <div className="guide-section-title"><ClipboardCheck size={19} /><div><span>SAMPLE PROBLEMS</span><h3>Apply the section</h3></div></div>
        {exampleError && <Status>{exampleError}</Status>}
        {sampleProblems.length ? <div className="guide-examples">{sampleProblems.map((question, index) => <article key={question.id} className="guide-example"><div className="guide-example-heading"><span>{String(index + 1).padStart(2, '0')}</span><div><h4>{question.title}</h4><small>From the permanent problem bank · no Gemini usage</small></div></div><div className="guide-example-prompt"><RichText text={question.prompt} /></div><EngineeringDiagram diagram={question.diagram} /><SourceLink doc={state.documents.find(document => document.id === question.sourceDocId)} page={question.sourcePage || 1} /><button className="button secondary" disabled={openingExample === question.id} onClick={() => state.questions.length ? setPendingExample(question) : openExample(question)}>{openingExample === question.id ? 'Opening…' : 'Open in Practice'} <ArrowRight size={15} /></button></article>)}</div> : <p className="guide-empty-note">No permanent-bank sample problem is available for this PDF section yet.</p>}
      </section>

      <section className="guide-section guide-checklist">
        <div className="guide-section-title"><ListChecks size={19} /><div><span>BEFORE YOU SOLVE</span><h3>Quick checks</h3></div></div>
        <ol>{remindersFor(`${selected} ${categoryTopics.join(' ')}`).map(reminder => <li key={reminder}>{reminder}</li>)}</ol>
      </section>

      <nav className="guide-actions" aria-label="Continue studying"><button className="button secondary" onClick={() => navigate('library')}>Open formulas <ArrowRight size={15} /></button><button className="button secondary" onClick={() => navigate('flashcards')}>Review flashcards <ArrowRight size={15} /></button><button className="button primary" onClick={() => navigate('practice')}>Practice this material <ArrowRight size={15} /></button></nav>
    </article>
    {pendingExample && <Modal title="Open this sample in Practice?" onClose={() => setPendingExample(null)}><p className="modal-intro">Your current {state.questions.length}-question practice set will be replaced by this sample problem. Completed results remain in Progress.</p><div className="modal-actions"><button className="button secondary" onClick={() => setPendingExample(null)}>Keep current set</button><button className="button primary" disabled={Boolean(openingExample)} onClick={() => openExample(pendingExample, true)}>{openingExample ? 'Opening…' : 'Open sample problem'}</button></div></Modal>}
  </div>;
}
