import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { reviewedPsadQuestion } from '../../server/psad-repairs.mjs';
const source=JSON.parse(readFileSync(new URL('../fixtures/psad-source.json',import.meta.url)));
test('PSAD repaired solutions display fractions, units and figures on desktop and mobile',async({page})=>{
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 const chosen=[[1,4],[4,4],[6,9]].map(([set,entry])=>reviewedPsadQuestion(source.find(q=>q.set===set&&q.sourcePage===entry)));
 const questions=chosen.map(q=>({...q,diagramImage:q.set===4?{data:'data:image/png;base64,'+readFileSync(new URL('../../server/assets/psad-column-section.png',import.meta.url)).toString('base64'),alt:'Source column section',caption:'Source section'}:undefined}));
 const bank={version:1,name:'PSAD reviewed browser fixture',spex:'A',set:99,questions};
 const imported=await page.request.post('/api/problem-banks',{multipart:{file:{name:'psad-reviewed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bank))}}});
 expect(imported.ok(),await imported.text()).toBeTruthy();
 const list=await (await page.request.get('/api/guide/problems?spex=A&set=99')).json();
 expect(list.questions).toHaveLength(3);
 for(let i=0;i<3;i++){
  const opened=await page.request.post('/api/guide/problems/'+list.questions[i].id+'/open',{data:{replace:true}});
  expect(opened.ok()).toBeTruthy();
  await page.goto('/');
  await page.getByRole('button',{name:'Practice',exact:true}).click();
  await page.getByRole('button',{name:'Show solution instead',exact:true}).click();
  await expect(page.locator('.solution-panel')).toBeVisible();
  await expect(page.locator('.math-error')).toHaveCount(0);
  await expect(page.locator('.solution-step .katex').first()).toBeVisible();
  if(i===1)await expect(page.locator('.source-diagram img')).toBeVisible();
  await page.screenshot({path:'test-results/screenshots/psad-reviewed-'+i+'.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/screenshots/psad-reviewed-'+i+'-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1100});
 }
 expect(errors).toEqual([]);
});
