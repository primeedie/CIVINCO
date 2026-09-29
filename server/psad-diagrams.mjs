export const BUNDLED_PSAD_ASSETS = new Set(['psad-column-section.png','psad-storey-weights.png']);
export const vectorReference = () => {
 const diagram = {
 title:'Cartesian vector reference',caption:'Generic reference, not the exact direction of the problem forces. i, j and k are unit vectors along the axes; λ is the unit vector along F. The component arrows add head-to-tail to F.',
 rectangles:[],circles:[{cx:32,cy:73,r:1,filled:true}],
 lines:[{x1:32,y1:73,x2:12,y2:88},{x1:32,y1:73,x2:91,y2:73},{x1:32,y1:73,x2:32,y2:10},{x1:32,y1:73,x2:81,y2:73,dashed:true},{x1:81,y1:73,x2:67,y2:84,dashed:true}],
 arrows:[{x1:32,y1:73,x2:18,y2:84},{x1:18,y1:84,x2:67,y2:84},{x1:67,y1:84,x2:67,y2:24},{x1:32,y1:73,x2:67,y2:24},{x1:32,y1:73,x2:42,y2:59}],
 labels:[{x:7,y:96,text:'+x, i',align:'start'},{x:84,y:69,text:'+y, j',align:'start'},{x:35,y:9,text:'+z, k',align:'start'},{x:11,y:72,text:'Fₓ i',align:'start'},{x:38,y:93,text:'Fᵧ j',align:'start'},{x:70,y:49,text:'Fz k',align:'start'},{x:54,y:32,text:'F',align:'start'},{x:22,y:53,text:'λ ∥ F',align:'start'}],
 };
 for (const key of ['lines','arrows']) diagram[key] = diagram[key].map(line => ({dashed:false,...line}));
 return diagram;
};
export function repairPsadDiagram(q,set,e){
 if(set===1&&e<=6)return {diagram:vectorReference(),diagramImage:undefined};
 let storageName,caption;
 if((set===3&&e===9)||(set===4&&e===4)){storageName='psad-column-section.png';caption='Source column section: three bars on each face. Use b = 250 mm and h = 400 mm from the statement; the source repeats h on both dimension arrows.';}
 if(set===5&&e<=3){storageName='psad-storey-weights.png';caption='Original source weight table. The 1st level is the base; each succeeding level is 3 m higher.';}
 if(storageName)return {diagramImage:{storageName,mime:'image/png',alt:caption,caption,visualAid:true}};
 if(set===5&&e===9)return {diagramImage:undefined,diagram:{title:'',caption:'',lines:[],arrows:[],circles:[],rectangles:[],labels:[]}};
 return {};
}
