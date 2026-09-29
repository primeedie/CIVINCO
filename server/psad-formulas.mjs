import { PSAD_REVISION, cleanPsadText } from './psad-repairs.mjs';

// Explicitly identified worked-example results. Their governing symbolic laws
// remain in the library; the examples remain accessible in the source PDF.
const exampleIds = new Set([
 '13f5db87-f3b3-49db-b457-d549d95366f6','1b78d99d-68ae-4672-8872-2223ad7e5275',
 '577a5392-9f5b-4a9c-a42b-bf3c92c34735','79f9c2f3-d689-4fca-a018-793f1c8605e2',
 '8f26f4ff-1807-4786-a108-fbd852691368','a6caa1c6-9c84-4ef4-8c27-2d2e0f08887a',
 'a783677a-cbc3-479a-b90d-ab3a409cb5af','d5f6728f-5ef7-434f-b25d-05af652a3e74',
 '887dfa04-522b-4ce3-8872-2f91f2eb76c5','bd02f974-e686-417b-88a7-e15bfbc35ad1',
 '1034bff9-a63c-4a87-8c8b-cd47cfb40c2b','5e778698-7086-432c-b65c-180e430bedf8',
 '957766fe-1cd5-4993-99cd-9f8083077a33','a8859a50-8465-4fd7-b951-08dbbeff9b0b',
 'd9c322c3-3746-4bf3-b612-617fdb03fc6a','e58cd3c4-2461-4da4-95d5-f22a7cd14e71',
 'eea1ebbb-caa7-41bb-9828-999cd320d6ef','3dd12d51-767b-49a4-bfe6-427a5940338b',
 '9f50b7c1-0078-47ea-869d-5f2d0df44495','bf990677-e98f-4240-aa5d-cce27ca57f4a',
 'af9038ea-87db-48d5-9d7d-590a16f58cb0','52ffda3a-25db-4a32-9e96-ba2703d9a7da',
]);
const R=String.raw;
const overrides = new Map([
 ['19e077f0-921b-4830-8736-45a860bfa531',[R`I=I_0+2\left(\frac{bt^3}{12}+bt d_p^2\right)`,'Symmetric Cover-Plate Moment of Inertia','Two identical plates, width b and thickness t, each with centroid distance dp from the composite neutral axis. I₀ is the original section inertia.']],
 ['9196b097-19f0-4a1e-9298-9bf176adb96a',[R`\frac{F_1}{\sin\alpha}=\frac{F_2}{\sin\beta}=\frac{F_3}{\sin\gamma}`,'Force-Triangle Sine Rule','Each angle is the interior angle opposite its corresponding force side in a closed triangle.']],
 ['d631575c-a0ca-4f9c-9351-b7c18ba1e824',[R`A_{st}=\rho_g A_g`,'Longitudinal Steel Area','ρg is the specified gross longitudinal reinforcement ratio; it is not a fixed 3%.']],
 ['41ac086e-9997-4317-b487-b6ad990d324a',[R`R_A=\frac{L-x}{L}`,'Left-Reaction Influence Line','Unit downward load at x from the left support of a simple span L.']],
 ['a93be3a3-e045-421d-8d3c-03b2fed29e01',[R`R_B=\frac{x}{L}`,'Right-Reaction Influence Line','Unit downward load at x from the left support of a simple span L.']],
 ['0eef5cfe-1496-4915-b709-53235dc36dac',[R`V_C=1-\frac{x}{L}`,'Shear Influence Line: Load Right of Section','Simple span L; unit load at x, to the right of section C. Positive shear convention follows the source.']],
 ['2d8034dc-3679-4b75-93ea-bc4261209039',[R`V_C=-\frac{x}{L}`,'Shear Influence Line: Load Left of Section','Simple span L; unit load at x, to the left of section C.']],
 ['b515ea94-b1ab-41c6-bfc4-75984fdc0c4e',[R`M_C=a\frac{L-x}{L}-(a-x)`,'Moment Influence Line: Load Left of Section','Section C is at a from the left support. A unit load lies at 0 ≤ x ≤ a.']],
 ['bbfe87b5-b8f9-4f5e-99fc-0e53a625bb6c',[R`M_C=a\frac{L-x}{L}`,'Moment Influence Line: Load Right of Section','Section C is at a from the left support. A unit load lies at a ≤ x ≤ L.']],
 ['de54ea89-d026-428a-a358-47c0692401bf',[R`x=x_2-x_1,\quad y=y_2-y_1,\quad z=z_2-z_1`]],
 ['0fde96d1-accc-45a4-8fe0-c0a5bf0e70ee',[R`\theta(x)=\frac{dy}{dx},\quad y(x)=\text{transverse deflection}`]],
 ['315f93c0-9dc5-41ea-8e66-dd3490c492a8',[R`w=w_0\langle x-a\rangle^0,\quad V=w_0\langle x-a\rangle^1,\quad M=\frac{w_0}{2}\langle x-a\rangle^2`]],
 ['746bbea8-2f15-4577-8d20-d75cc9868217',[R`w=m\langle x-a\rangle^1,\quad V=\frac m2\langle x-a\rangle^2,\quad M=\frac m6\langle x-a\rangle^3`]],
 ['82d6c076-8178-4d8c-bdbf-bd2b2de903de',[R`w=P\langle x-a\rangle^{-1},\quad V=P\langle x-a\rangle^0,\quad M=P\langle x-a\rangle^1`]],
 ['7f4984f9-9b3a-4731-9b89-d05f0bed9fe0',[R`w=M_0\langle x-a\rangle^{-2},\quad V=M_0\langle x-a\rangle^{-1},\quad M=M_0\langle x-a\rangle^0`]],
 ['2a7c5509-295b-481f-8be5-5bd72fb05ac1',[R`V_{max}=\frac P2,\quad M_{max}=\frac{PL}{4}`]],
 ['ca13e9c7-c14b-4933-9ab9-de4c79cdd418',[R`V_{max}=\frac{wL}{2},\quad M_{max}=\frac{wL^2}{8}`]],
 ['ebe818eb-2007-41a9-bfea-a3fec9384cc7',[R`V_{max}=P,\quad M_{max}=\frac{PL}{3}`]],
 ['ee58ce6d-e98a-4441-a001-de19abb159ab',[R`V_{max}=\frac{3P}{2},\quad M_{max}=\frac{PL}{2}`]],
 ['09177e95-8c71-49c2-9566-367e5b69323d',[R`|\theta_L|=|\theta_R|=\frac{5w_0L^3}{192EI}`]],
 ['3cb428aa-6d63-4ffa-8ff0-bbc14d6cf563',[R`\frac{6A\bar a}{L}=\frac{Pa}{L}(L^2-a^2),\quad\frac{6A\bar b}{L}=\frac{Pb}{L}(L^2-b^2)`]],
 ['e6fb98a1-0145-4148-9e9f-eeb3986ed81d',[R`\frac{6A\bar a}{L}=\frac{6A\bar b}{L}=\frac{3PL^2}{8}`]],
 ['cd92562a-d569-4a4d-82d3-4eea191b8f52',[R`\frac{6A\bar a}{L}=\frac{6A\bar b}{L}=\frac{w_0L^3}{4}`]],
 ['3d918f9d-0a25-468e-bd2f-bd9b1a12d2e8',[R`\frac{6A\bar a}{L}=\frac{8w_0L^3}{60},\quad\frac{6A\bar b}{L}=\frac{7w_0L^3}{60}`]],
 ['395c8019-9ee5-4bf6-b64d-b603051d81db',[R`\frac{6A\bar a}{L}=\frac{7w_0L^3}{60},\quad\frac{6A\bar b}{L}=\frac{8w_0L^3}{60}`]],
 ['44fb83ad-aaa9-42e3-90bd-c9b314090c5a',[R`\frac{6A\bar a}{L}=\frac{6A\bar b}{L}=\frac{5w_0L^3}{32}`]],
 ['5ccadc6e-4150-4116-aa2f-ca6a525ab865',[R`\frac{6A\bar a}{L}=-\frac{M}{L}(3a^2-L^2),\quad\frac{6A\bar b}{L}=\frac{M}{L}(3b^2-L^2)`]],
 ['1577f0bd-b224-4a09-b92c-63a85b1403a4',[R`M_{AB}=-\frac{PL}{8},\quad M_{BA}=\frac{PL}{8}`]],
 ['45b8bb9a-934f-476c-a65a-aba55a7c0f0a',[R`M_{AB}=-\frac{wL^2}{12},\quad M_{BA}=\frac{wL^2}{12}`]],
 ['7c344f42-f456-4fa9-a873-94e9da46c446',[R`M_{AB}=-\frac{5wL^2}{96},\quad M_{BA}=\frac{5wL^2}{96}`]],
 ['9f4e33cb-a625-47d1-995f-5a1a0d7c44ad',[R`M_{AB}=-\frac{5PL}{16},\quad M_{BA}=\frac{5PL}{16}`]],
 ['755bc8f0-3b48-4e9e-9793-20c0035ff8b9',[R`|\theta_L|=|\theta_R|=\frac{w_0L^3}{24EI}`]],
 ['a7977794-fc9c-47c9-8d0b-5e6cc35f3f11',[R`|\theta_L|=|\theta_R|=\frac{PL^2}{16EI}`]],
 ['1a40e7f9-1a64-4ee8-9efd-0d5afbd2e53c',[R`M_{AB}=-\frac{Pab^2}{L^2},\quad M_{BA}=\frac{Pa^2b}{L^2}`]],
 ['c00b0fd5-6f8e-4785-8352-35cfbc3e94a2',[R`M_{AB}=-\frac{2PL}{9},\quad M_{BA}=\frac{2PL}{9}`]],
 ['3fac9911-4049-4d3c-a1fa-7dce97f72fec',[R`M_{AB}=-\frac{11wL^2}{192},\quad M_{BA}=\frac{5wL^2}{192}`]],
 ['33a1d425-2d0c-440d-87e8-f9389960c8bc',[R`M_{AB}=-\frac{wL^2}{20},\quad M_{BA}=\frac{wL^2}{30}`]],
 ['94b1cdba-0afb-47a4-b8da-b62f7916d747',[R`M_{AB}=\frac{Mb(2a-b)}{L^2},\quad M_{BA}=\frac{Ma(2b-a)}{L^2}`]],
 ['0d3701e5-6b31-48eb-a8d2-443c77b8674a',[R`\beta_1=\max\left(0.65,\ 0.85-0.05\frac{\max(f'_c-28,0)}7\right)`]],
 ['96c23078-f84d-4f3b-a0b9-8e7c9021fa27',[R`\rho_{min}=\max\left(\frac{1.4}{f_y},\frac{\sqrt{f'_c}}{4f_y}\right)`]],
 ['036dbcbb-7a7a-4a76-ac36-54de6190ca15',[R`s\le\min\left(\frac d2,600\ \mathrm{mm}\right)`]],
 ['cbdb845c-5df7-4a50-af72-1132143a5308',[R`s\le\min\left(\frac d4,300\ \mathrm{mm}\right)`]],
 ['bd9dffef-ad92-4add-9129-30d2dbcc4b98',[R`V_u\le\phi V_c`,'Punching Shear Adequacy Check','Design is adequate when factored punching demand does not exceed design punching capacity.']],
 ['dc97630b-88ef-45c3-825d-2d8891de552b',[R`V_u\le\phi V_c`,'One-Way Shear Adequacy Check','Design is adequate when factored one-way shear does not exceed the design concrete shear capacity.']],
 ['d2eb22f1-cc79-4ea4-95ca-a079fab47aa3',[R`\mathbf F_{avg}=\frac{\Delta\mathbf p}{\Delta t}`]],
 ['657a07d2-1fbc-401c-a373-f6cf3d5f5a5d',[R`|f_s|\le\mu_sN,\quad |f_k|=\mu_kN`,'Static and Kinetic Friction','Static friction adjusts to equilibrium up to μsN; equality applies at impending slip. Kinetic friction applies during sliding.']],
]);
const greek={α:'alpha',β:'beta',γ:'gamma',δ:'delta',ε:'varepsilon',θ:'theta',λ:'lambda',μ:'mu',ν:'nu',π:'pi',ρ:'rho',σ:'sigma',τ:'tau',φ:'phi',ω:'omega',Δ:'Delta',Σ:'Sigma',Ω:'Omega'};
export const cleanLatex = text => String(text||'').replace(/[αβγδεθλμνπρστφωΔΣΩ]/g,ch=>`\\${greek[ch]} `);
const definitions={
 I:['Composite second moment of area','mm⁴'], I_0:['Original section second moment of area','mm⁴'], b:['Plate or section width','mm'], t:['Plate thickness','mm'], d_p:['Plate centroid distance from neutral axis','mm'],
 L:['Span length','m'], x:['Load coordinate measured from the left support','m'], a:['Distance from left support to load or section, as defined','m'],
 P:['Concentrated force','kN'], w:['Uniform load intensity','kN/m'], w_0:['Peak load intensity','kN/m'], E:['Elastic modulus','consistent force/area'],
 M_AB:['Member end moment at A; clockwise positive','kN·m'], M_BA:['Member end moment at B; clockwise positive','kN·m'],
};

export function repairPsadFormulas(store){
 let changed=0,removed=0;
 store.transaction(()=>{
  for(const item of store.all('items')){
   if(item.spex!=='A'||item.ownerId||item.contentRevision===PSAD_REVISION)continue;
   if(item.kind==='formula'&&exampleIds.has(item.id)){store.remove('items',item.id);removed++;continue;}
   const updated={...item,title:cleanPsadText(item.title),topic:cleanPsadText(item.topic),contentRevision:PSAD_REVISION};
   if(item.kind==='formula'){
    updated.latex=cleanLatex(item.latex);
    updated.variables=(item.variables||[]).map(v=>({...v,symbol:cleanLatex(v.symbol),unit:cleanPsadText(v.unit)}));
    updated.conditions=cleanPsadText(item.conditions||'');
    const replacement=overrides.get(item.id);
    if(replacement){
     updated.latex=replacement[0]; updated.title=replacement[1]||updated.title;updated.conditions=replacement[2]||updated.conditions;
     updated.equationScope='general';updated.note='Symbolic relation checked against the source. Example-specific numerical substitutions belong in worked solutions.';
     // Retain existing definitions and add the variables introduced by generalizing.
     for(const [symbol,[meaning,unit]] of Object.entries(definitions)){
      const match=symbol.replace('_AB','_{AB}').replace('_BA','_{BA}');
      const tokens=updated.latex.replace(/\\[A-Za-z]+/g,'').replace(/[{}]/g,'');
      if(new RegExp(`(?<![A-Za-z_])${symbol}(?![A-Za-z_0-9])`).test(tokens)&&!updated.variables.some(v=>v.symbol.replace(/[{}\s]/g,'')===symbol))updated.variables.push({symbol:match,meaning,unit});
     }
    }
    if(item.set===2&&/^Fixed-End Moment/.test(item.title)){
     if(replacement)updated.conditions+=' Signed member-end moments: clockwise positive. A is the left end; B is the right end. For triangular or half-span loading, the load starts at A. Consult the source loading diagram.';
     else updated.conditions+=' This entry gives the moment magnitude. Determine its direction from the source loading diagram before applying your sign convention.';
    }
   }else updated.explanation=cleanPsadText(item.explanation||'');
   store.put('items',updated);changed++;
  }
 });
 return {changed,removed};
}
