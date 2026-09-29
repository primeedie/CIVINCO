import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../server/store.mjs';
import { validLatex, gradeAnswer } from '../server/domain.mjs';
import { reviewedPsadQuestion, repairPsadQuestions, PSAD_REVISION } from '../server/psad-repairs.mjs';
import { repairPsadFormulas } from '../server/psad-formulas.mjs';
const source=JSON.parse(readFileSync(new URL('./fixtures/psad-source.json',import.meta.url)));
const reviewed=source.map(reviewedPsadQuestion);
const q=(set,entry)=>reviewed.find(q=>q.set===set&&q.sourcePage===entry);

test('every public PSAD entry has a complete, renderable worked solution',()=>{
 assert.equal(reviewed.length,72);
 assert.deepEqual([1,2,3,4,5,6].map(set=>reviewed.filter(q=>q.set===set).length),[25,5,17,4,9,12]);
 for(const question of reviewed){
  assert.equal(question.contentRevision,PSAD_REVISION);
  assert.ok(Number.isFinite(question.answer),question.title);
  assert.ok(question.steps.length>=1,question.title);
  for(const step of question.steps)if(step.latex)assert.ok(validLatex(step.latex),question.title+': '+step.latex);
  assert.doesNotMatch(question.prompt,/\b(?:mm|cm|m)[234]\b/);
 }
});
test('checked mechanics answers follow equilibrium, motion and consistent units',()=>{
 const wire=q(1,12),Tac=150*200/1000,Tab=Tac*Math.cos(Math.PI/4)/Math.cos(Math.PI/6);
 assert.ok(Math.abs(wire.answer-(Tac*Math.sin(Math.PI/4)+Tab*.5))<.005);
 assert.equal(q(1,15).unit,'m/s²');
 assert.equal(q(1,15).answer,-24);
 assert.ok(Math.abs(q(1,25).answer-1.8*Math.sqrt(2*45/1.2))<.005);
 const J=34e6*2510/(83000*3*Math.PI/180);
 assert.ok(Math.abs(q(1,21).answer-J/1e6)<.0005);
 assert.ok(Math.abs(q(1,20).answer-2*110*J/34e6)<.005);
});
test('bar counts round in the safe direction and reject fractional counts',()=>{
 assert.equal(q(3,2).answer,6);
 assert.equal(q(3,4).answer,6);
 assert.equal(q(3,17).answer,5);
 const minArea=Math.max(1.4/414,Math.sqrt(35)/(4*414))*3000*400;
 assert.equal(q(6,2).answer,Math.ceil(minArea/(Math.PI*20**2/4)));
 assert.equal(gradeAnswer('13.9',q(6,2).answer,q(6,2).tolerance).correct,false);
});
test('footing demand, nominal resistance and design resistance remain distinct',()=>{
 const pressure=(1.2*1000+1.6*1500)/(3*4);
 assert.ok(Math.abs(q(6,3).answer-pressure*3*((4-.4)/2-.4))<.005);
 assert.ok(Math.abs(q(6,4).answer-.75*.17*Math.sqrt(35)*3000*400/1000)<.005);
 assert.equal(q(6,8).answer,pressure*(12-.8**2));
 assert.equal(q(6,10).answer,q(6,8).answer*1000/(.75*3200*400));
 assert.match(q(6,9).steps.at(-1).text,/fails/);
});
test('shared visuals exist, while text-only excerpts are not displayed as figures',()=>{
 for(const [set,entry] of [[3,9],[4,4],[5,1],[5,2],[5,3]]){
  const name=q(set,entry).diagramImage.storageName;
  assert.ok(readFileSync(new URL('../server/assets/'+name,import.meta.url)).length>1000);
 }
 assert.equal(q(5,9).diagramImage,undefined);
 assert.ok(q(1,1).diagram.labels.some(label=>label.text.includes('λ')));
});
test('repair is idempotent and leaves private records and other SPEX unchanged',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'psad-review-')),store=createStore(dir);
 try{
  source.forEach(q=>store.put('questions',q));
  const privateQ={...source[0],id:'private',ownerId:'device'},other={...source[0],id:'other',spex:'B'};
  store.put('questions',privateQ);store.put('questions',other);
  assert.equal(repairPsadQuestions(store),72);
  assert.equal(repairPsadQuestions(store),0);
  assert.deepEqual(store.get('questions','private'),privateQ);
  assert.deepEqual(store.get('questions','other'),other);
  const f={id:'0d3701e5-6b31-48eb-a8d2-443c77b8674a',kind:'formula',spex:'A',set:3,title:'Beta',topic:'Concrete',latex:'β_1=0.85',variables:[]};
  store.put('items',f);store.put('items',{...f,id:'personal',ownerId:'device'});
  repairPsadFormulas(store);
  assert.match(store.get('items',f.id).latex,/max/);
  assert.ok(validLatex(store.get('items',f.id).latex));
  assert.equal(repairPsadFormulas(store).changed,0);
  assert.deepEqual(store.get('items','personal'),{...f,id:'personal',ownerId:'device'});
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
