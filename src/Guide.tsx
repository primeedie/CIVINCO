import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BookCheck, BookOpen, CheckCircle2, ClipboardCheck, Lightbulb, ListChecks, Target } from 'lucide-react';
import { Badge, Empty, MathText, normalizeEngineeringText, RichText, SourceLink } from './components';
import type { SharedProps } from './App';
import type { Item, View } from './types';

const unique = <T,>(values: T[]) => [...new Set(values)];
const clean = (value?: string) => String(value || '').trim();
const formulaKey = (item: Item) => clean(item.latex).replace(/\s+/g, '');
const meaningfulVariables = (expression: string) => /[A-Za-z](?:_[{A-Za-z]|\b)/.test(expression.replace(/\\(?:text|mathrm)\s*\{[^}]*\}/g, '').replace(/\\(?:frac|sqrt|times|cdot|left|right|quad|le|ge|approx|circ|sum|implies|pi)\b/g, ''));
function looksLikeWorkedCalculation(item: Item) {
  const latex = clean(item.latex), parts = latex.split(/\s*(?:=|\\implies)\s*/);
  const numericTokens = (latex.match(/(?<![_A-Za-z])\d+(?:\.\d+)?/g) || []).length;
  const symbolicTokens = (latex.replace(/\\(?:text|mathrm)\s*\{[^}]*\}/g, '').match(/[A-Za-z](?:_[{A-Za-z]|\b)/g) || []).length;
  return parts.length > 2 || (parts.length === 2 && !meaningfulVariables(parts[1]) && /\d/.test(parts[1])) || /(?:calculation|evaluation|substitution|solved|given|from statics|component equation)/i.test(item.title) || (numericTokens >= 4 && symbolicTokens <= 4);
}

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

export function Guide({ state, filter, navigate }: SharedProps & { navigate: (view: View) => void }) {
  const scopedItems = filter(state.items);
  const scopedQuestions = filter(state.questions);
  const scopedAttempts = filter(state.attempts).filter(attempt => !attempt.revealed);
  const topics = useMemo(() => unique([...scopedItems.map(item => clean(item.topic)), ...scopedQuestions.map(question => clean(question.topic))].filter(Boolean)).sort((a, b) => a.localeCompare(b)), [scopedItems, scopedQuestions]);
  const [selected, setSelected] = useState('');
  useEffect(() => { if (!topics.includes(selected)) setSelected(topics[0] || ''); }, [topics.join('|'), selected]);

  const entries = scopedItems.filter(item => clean(item.topic) === selected);
  const concepts = entries.filter(item => item.kind === 'concept');
  const trustedFormulas = entries.filter(item => item.kind === 'formula' && item.reviewed && !item.uncertain && item.equationScope !== 'case-specific' && !looksLikeWorkedCalculation(item)).filter((item, index, list) => list.findIndex(candidate => formulaKey(candidate) === formulaKey(item)) === index);
  const pendingFormulas = entries.filter(item => item.kind === 'formula' && (!item.reviewed || item.uncertain || item.equationScope === 'case-specific' || looksLikeWorkedCalculation(item)));
  const applications = unique(trustedFormulas.map(item => clean(item.conditions)).filter(Boolean));
  const examples = unique(scopedQuestions.filter(question => clean(question.topic) === selected).map(question => question.title)).slice(0, 6);
  const attempts = scopedAttempts.filter(attempt => clean(attempt.topic) === selected);
  const correct = attempts.filter(attempt => attempt.correct).length;
  const first = entries[0] || scopedQuestions.find(question => clean(question.topic) === selected);

  if (!topics.length) return <Empty icon={<BookOpen size={30} />} title="Your study guide will grow from your materials" text="Add starter references or extract an uploaded file. CIVINCO will organize its concepts and reviewed formulas into topic lessons without another Gemini request." />;

  return <div className="guide-layout">
    <aside className="guide-index" aria-label="Study guide topics">
      <div className="guide-index-heading"><span className="section-kicker"><BookOpen size={15} /> TOPIC INDEX</span><strong>{topics.length} {topics.length === 1 ? 'topic' : 'topics'}</strong></div>
      {topics.map(topic => {
        const topicItems = scopedItems.filter(item => clean(item.topic) === topic);
        const topicAttempts = scopedAttempts.filter(attempt => clean(attempt.topic) === topic);
        const percent = topicAttempts.length ? Math.round(topicAttempts.filter(attempt => attempt.correct).length / topicAttempts.length * 100) : null;
        return <button key={topic} className={selected === topic ? 'active' : ''} onClick={() => setSelected(topic)}><span><strong>{topic}</strong><small>{topicItems.length} study {topicItems.length === 1 ? 'entry' : 'entries'}</small></span><span className={percent === null ? '' : percent >= 80 ? 'strong' : percent < 60 ? 'focus' : ''}>{percent === null ? 'NEW' : `${percent}%`}</span></button>;
      })}
    </aside>

    <article className="guide-article">
      <header className="guide-hero">
        <div>{first && <Badge spex={first.spex} set={first.set} />}<span className="topic-label">STUDY GUIDE</span><h2>{selected}</h2><p>This page gathers the ideas, equations, and applications already supported by your selected materials. Learn the meaning first, recall the governing relationships, then apply them in practice.</p></div>
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
        <div className="guide-section-title"><Lightbulb size={19} /><div><span>WHAT TO REMEMBER</span><h3>Governing relationships</h3></div></div>
        {trustedFormulas.length ? <div className="guide-formulas">{trustedFormulas.map(formula => <div key={formula.id} className="guide-formula"><div><h4>{formula.title}</h4><MathText latex={formula.latex || ''} block /></div>{formula.variables?.length ? <dl>{formula.variables.map((variable, index) => <div key={`${variable.symbol}-${index}`}><dt><MathText latex={variable.symbol} /></dt><dd>{variable.meaning}{variable.unit && <small>{normalizeEngineeringText(variable.unit)}</small>}</dd></div>)}</dl> : null}<SourceLink doc={state.documents.find(document => document.id === formula.docId)} page={formula.page} /></div>)}</div> : <p className="guide-empty-note">There are no source-checked general equations for this topic yet. Pending or case-specific calculations stay out of this memory list until they are reviewed.</p>}
        {!!pendingFormulas.length && <div className="guide-caution"><AlertTriangle size={17} /><span>{pendingFormulas.length} equation{pendingFormulas.length === 1 ? '' : 's'} omitted because {pendingFormulas.length === 1 ? 'it is' : 'they are'} awaiting review, uncertain, or specific to one worked problem.</span></div>}
      </section>

      <section className="guide-section">
        <div className="guide-section-title"><Target size={19} /><div><span>APPLICATIONS</span><h3>Know when to use it</h3></div></div>
        {applications.length || examples.length ? <div className="guide-applications">{applications.map(application => <div key={application}><CheckCircle2 size={15} /><span>{application}</span></div>)}{examples.map(example => <div key={example}><ClipboardCheck size={15} /><span>Practice example: {example}</span></div>)}</div> : <p className="guide-empty-note">Application notes will appear when reviewed formulas or practice problems are available for this topic.</p>}
      </section>

      <section className="guide-section guide-checklist">
        <div className="guide-section-title"><ListChecks size={19} /><div><span>BEFORE YOU SOLVE</span><h3>Quick checks</h3></div></div>
        <ol>{remindersFor(selected).map(reminder => <li key={reminder}>{reminder}</li>)}</ol>
      </section>

      <nav className="guide-actions" aria-label="Continue studying"><button className="button secondary" onClick={() => navigate('library')}>Open formulas <ArrowRight size={15} /></button><button className="button secondary" onClick={() => navigate('flashcards')}>Review flashcards <ArrowRight size={15} /></button><button className="button primary" onClick={() => navigate('practice')}>Practice this material <ArrowRight size={15} /></button></nav>
    </article>
  </div>;
}
