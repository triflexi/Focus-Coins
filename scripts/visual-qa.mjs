import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

// QA fixtures are intercepted in this browser only; no production data changes.
const base=process.env.QA_BASE_URL??'http://127.0.0.1:5173';
const output=path.resolve('artifacts/visual-qa');
await fs.mkdir(output,{recursive:true});
const report={base,screenshots:[],findings:[],animationChecks:[],mobileBottomChecks:[],consoleErrors:[]};
const now=new Date(),iso=date=>date.toISOString();
const tower={id:'qa-tower',kind:'tower',stake:'100.00',payout:'0.00',net:'-100.00',status:'active',result:{safe:true,cell:0,floor:3},floors:3,picks:[1,3,0],expiresAt:iso(new Date(+now+720000)),createdAt:iso(now)};
const session={id:'qa-active',minutes:50,startedAt:iso(new Date(+now-450000)),endsAt:iso(new Date(+now+2550000)),status:'active',reward:'75.00',multiplier:1.5};
const baseline={serverTime:iso(now),user:{id:'qa-user',login:'anna_focus',nickname:'pixel_anna',createdAt:'2026-09-01T09:00:00Z'},season:{key:'2026-10',endsAt:'2026-10-31T19:00:00Z'},balance:'1240.50',reserved:'0.00',rankingBalance:'1240.50',rank:42,active:null,history:[25,50,90].map((minutes,i)=>({id:`qa-history-${i}`,minutes,startedAt:iso(new Date(+now-(i+1)*86400000)),endsAt:iso(new Date(+now-(i+1)*86400000+minutes*60000)),status:i===2?'cancelled':'completed',reward:`${minutes}.00`,multiplier:1})),rounds:[{id:'qa-old-roulette',kind:'roulette',stake:'100.00',payout:'200.00',net:'100.00',status:'completed',result:{number:17,multiplier:2},floors:0,picks:[],expiresAt:iso(now),createdAt:iso(now)}],tower:null,daily:{minutes:20,streak:4,cycle:4,awarded:false,boostUntil:iso(new Date(+now+86400000))},stats:{totalMinutes:2330,weekMinutes:375,monthMinutes:1140,completed:23,cancelled:3,focusCoins:'1055.00',bonusCoins:'115.00',gameNet:'70.50',days:Array.from({length:30},(_,i)=>({day:`2026-09-${String(i+1).padStart(2,'0')}`,minutes:[25,50,75,0,30,90,105][i%7]}))},ledger:[{id:'qa-ledger-focus',kind:'focus',amount:'50.00',createdAt:iso(now)},{id:'qa-ledger-stake',kind:'stake',amount:'-100.00',createdAt:iso(now)},{id:'qa-ledger-payout',kind:'payout',amount:'200.00',createdAt:iso(now)}]};
const leaderboard={season:'2026-10',archives:['2026-09','2026-08'],self:{userId:'qa-user',nickname:'pixel_anna',balance:'1240.50',rank:42},rows:[{userId:'qa-first',nickname:'focus_master',balance:'4820.00',rank:1},{userId:'qa-second',nickname:'night_owl',balance:'3500.50',rank:2},{userId:'qa-third',nickname:'pixel_anna',balance:'1240.50',rank:42}]};

const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:process.env.QA_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{})});
async function setup(viewport,theme,reduced='reduce'){
  const context=await browser.newContext({viewport,reducedMotion:reduced});
  await context.addInitScript(t=>localStorage.setItem('fc-theme',t),theme);
  const state={fixture:'standard',data:structuredClone(baseline),roulette:0,draw:0,sequence:0,gameRequests:0,authenticated:true};
  await context.route('**/api/v1/**',async route=>{
    const req=route.request(),endpoint=new URL(req.url()).pathname.replace('/api/v1',''),body=req.postDataJSON();
    let response={ok:true},status=200;
    if(endpoint==='/auth/refresh'){if(state.authenticated)response={accessToken:'qa-local-token'};else{status=401;response={message:'QA: not authenticated'};}}
    else if(endpoint==='/dashboard')response={...state.data,serverTime:iso(new Date()),active:state.fixture==='active'?session:state.data.active,tower:state.fixture==='tower'?tower:state.data.tower,reserved:state.fixture==='tower'?'100.00':state.data.reserved};
    else if(endpoint==='/leaderboard')response=leaderboard;
    else if(endpoint.startsWith('/games/')){
      state.gameRequests++;
      const kind=endpoint.split('/').at(-1),multiplier=state.draw<50?0:state.draw<80?1:state.draw<95?2:state.draw<99?5:15;
      response={id:`qa-round-${++state.sequence}`,kind,stake:body.stake,payout:kind==='roulette'?String(Number(body.stake)*2):kind==='wheel'?String(Number(body.stake)*multiplier):'0.00',net:'0.00',status:kind==='tower'?'active':'completed',result:kind==='roulette'?{number:state.roulette,multiplier:2}:kind==='wheel'?{draw:state.draw,multiplier}:{},floors:0,picks:[],expiresAt:iso(new Date(+now+900000)),createdAt:iso(now)};
      if(kind==='tower')state.data.tower=response;else state.data.rounds.unshift(response);
    }else if(endpoint.includes('/pick')){
      const current=state.fixture==='tower'?structuredClone(tower):state.data.tower;
      response={...current,floors:current.floors+1,picks:[...current.picks,body.cell],result:{safe:true,cell:body.cell,floor:current.floors+1}};
      state.fixture='standard';state.data.tower=response;
    }else if(endpoint.includes('/collect')){response={...state.data.tower,status:'collected',payout:'225.18',net:'125.18'};state.data.tower=null;state.fixture='standard';}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(response)});
  });
  const page=await context.newPage();page.on('pageerror',e=>report.consoleErrors.push(String(e)));
  return {context,page,state};
}

let navigation=0;
async function ready(page,route='timer'){
  await page.goto(`${base}/?visual-qa=${++navigation}#${route}`);await page.locator('.app, .auth').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  // Lets a dynamically loaded stylesheet settle without changing source files.
  if(!(await page.locator('link[href*="animations"], style[data-vite-dev-id*="animations"]').count()))await page.addStyleTag({url:`${base}/src/animations.css`});
}
async function inspect(page){
  return page.evaluate(()=>{
    const findings=[],visible=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    if(document.documentElement.scrollWidth>innerWidth+1)findings.push({type:'viewport-overflow',width:document.documentElement.scrollWidth,viewport:innerWidth});
    for(const n of document.querySelectorAll('button,.panel-title,.badge,.timer-display strong,th,td,small,p,h1,h3,.metric strong')){
      if(!visible(n)||n.closest('.wheel-art')||n.matches('.sr-only')||getComputedStyle(n).display==='inline')continue;
      if(n.clientWidth&&n.scrollWidth>n.clientWidth+2)findings.push({type:'text-overflow',selector:n.className||n.tagName,text:n.textContent.slice(0,70),width:n.clientWidth,scroll:n.scrollWidth});
      if(n.clientHeight&&n.scrollHeight>n.clientHeight+2&&getComputedStyle(n).overflowY==='hidden')findings.push({type:'text-clipped',selector:n.className||n.tagName,text:n.textContent.slice(0,70)});
    }
    for(const parent of document.querySelectorAll('.two-col,.two-equal,.games-grid,.metrics,.day-cycle,.row,.wheel-legend,.tower-grid>div')){
      if(!visible(parent)||parent.closest('.wheel-art'))continue;
      const children=[...parent.children].filter(n=>visible(n)&&getComputedStyle(n).position!=='absolute');
      for(let a=0;a<children.length;a++)for(let b=a+1;b<children.length;b++){
        const ra=children[a].getBoundingClientRect(),rb=children[b].getBoundingClientRect(),w=Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left),h=Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top);
        if(w>2&&h>2)findings.push({type:'sibling-overlap',parent:parent.className,a:children[a].textContent.slice(0,35),b:children[b].textContent.slice(0,35),width:Math.round(w),height:Math.round(h)});
      }
    }
    const checks=[...document.querySelectorAll('.tower-grid>div')].map(row=>[...row.querySelectorAll('button')].map(n=>n.getBoundingClientRect().width));
    if(checks.some(s=>Math.max(...s)-Math.min(...s)>1))findings.push({type:'unequal-tower-cells'});
    return findings;
  });
}
async function capture(page,label,width,theme){
  await page.evaluate(()=>window.scrollTo(0,0));
  const filename=`${width}-${theme}-${label}.png`;await page.screenshot({path:path.join(output,filename),fullPage:true});
  report.screenshots.push(filename);const issues=await inspect(page);if(issues.length)report.findings.push({screen:label,width,theme,issues});
  if(width<=390){
    const viewportFilename=`${width}-${theme}-${label}-viewport.png`;await page.screenshot({path:path.join(output,viewportFilename),fullPage:false});report.screenshots.push(viewportFilename);
    if(await page.locator('.mobile-nav:visible').count()&&!(await page.locator('.modal-backdrop').count())){
      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
      const accessible=await page.evaluate(()=>{const content=document.querySelector('main')?.lastElementChild,nav=document.querySelector('.mobile-nav');return !content||!nav||content.getBoundingClientRect().bottom<=nav.getBoundingClientRect().top+2;});
      report.mobileBottomChecks.push({screen:label,width,theme,passed:accessible});
      if(!accessible)report.findings.push({screen:label,width,theme,issues:[{type:'bottom-content-covered-by-navigation'}]});
      if(['profile-password','tower','wheel','timer'].includes(label)){const bottomFilename=`${width}-${theme}-${label}-bottom.png`;await page.screenshot({path:path.join(output,bottomFilename),fullPage:false});report.screenshots.push(bottomFilename);}
    }
  }
}

try{
  for(const width of [1440,1024,768,390,320])for(const theme of ['dark','light']){
    const {context,page,state}=await setup({width,height:960},theme);
    for(const name of ['timer','stats','games','rating','profile']){
      state.fixture='standard';await ready(page,name);await capture(page,name,width,theme);
      if(name==='stats'){await page.getByRole('button',{name:'Месяц',exact:true}).click();await capture(page,'stats-month',width,theme);}
      if(name==='games')for(const [index,game] of ['roulette','wheel','tower'].entries()){
        state.fixture=game==='tower'?'tower':'standard';await ready(page,'games');await page.getByRole('button',{name:'Открыть игру',exact:true}).nth(index).click();await capture(page,game,width,theme);
      }
      if(name==='rating'){await page.getByRole('button',{name:'Архив сезонов',exact:true}).click();await capture(page,'rating-archive',width,theme);}
      if(name==='profile'){await page.getByRole('button',{name:'Изменить пароль',exact:true}).click();await capture(page,'profile-password',width,theme);}
    }
    state.fixture='active';await ready(page,'timer');await capture(page,'timer-active',width,theme);await page.getByRole('button',{name:'Отменить сессию',exact:true}).click();await capture(page,'timer-cancel',width,theme);
    state.authenticated=false;await ready(page,'timer');await capture(page,'login',width,theme);await page.getByRole('button',{name:'Регистрация',exact:true}).click();await capture(page,'registration',width,theme);
    await context.close();console.log(`Captured ${width}px ${theme}`);
  }

  const {context,page,state}=await setup({width:1440,height:960},'dark','no-preference');
  await ready(page,'games');await page.getByRole('button',{name:'Открыть игру'}).nth(0).click();state.roulette=32;
  await page.getByRole('button',{name:/Крутить ·/}).click();await page.locator('.is-spinning').waitFor();
  const pointer=await page.locator('.pointer').evaluate(n=>getComputedStyle(n).transform);
  const disabled=await page.locator('.bet-tools button,input[aria-label="Размер ставки"],.roulette-grid button,.bet-options button').evaluateAll(nodes=>nodes.every(n=>n.disabled));
  const before=state.gameRequests;await page.locator('.game-detail .button.primary').evaluate(n=>{n.click();n.click();});
  report.animationChecks.push({name:'server-result-hidden-until-stop',passed:await page.locator('.game-result').count()===0},{name:'pointer-stationary',passed:pointer==='none'},{name:'controls-locked-during-spin',passed:disabled},{name:'repeat-click-does-not-create-round',passed:state.gameRequests===before});
  await capture(page,'roulette-spinning',1440,'dark');await page.locator('.is-spinning').waitFor({state:'detached'});report.animationChecks.push({name:'result-revealed-after-spin',passed:(await page.locator('.wheel-center').textContent())==='32'});
  await capture(page,'roulette-result',1440,'dark');
  await page.getByRole('button',{name:'← Все игры'}).click();await page.getByRole('button',{name:'Открыть игру'}).nth(1).click();state.draw=99;
  await page.getByRole('button',{name:/Крутить ·/}).click();await page.locator('.is-spinning').waitFor();await capture(page,'wheel-spinning',1440,'dark');await page.locator('.is-spinning').waitFor({state:'detached'});await capture(page,'wheel-result',1440,'dark');
  report.animationChecks.push({name:'smallest-wheel-sector',passed:(await page.locator('.wheel-center').textContent())==='×15'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'← Все игры'}).click();await page.getByRole('button',{name:'Открыть игру'}).nth(0).click();
  const order=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const normalize=angle=>(angle%360+360)%360;let rouletteAngles=true;
  for(let number=0;number<37;number++){
    state.roulette=number;await page.getByRole('button',{name:/Крутить ·/}).click();await page.locator('.wheel-center').filter({hasText:new RegExp(`^${number}$`)}).waitFor();
    const rotation=await page.locator('.spin-wheel').evaluate(n=>parseFloat(n.style.getPropertyValue('--spin-rotation'))),centre=(order.indexOf(number)+.5)*360/37;
    if(Math.abs(normalize(rotation+centre))>1e-6&&Math.abs(normalize(rotation+centre)-360)>1e-6)rouletteAngles=false;
  }
  report.animationChecks.push({name:'all-37-european-pockets-land-on-result',passed:rouletteAngles});
  await page.getByRole('button',{name:'← Все игры'}).click();await page.getByRole('button',{name:'Открыть игру'}).nth(1).click();let wheelAngles=true;
  for(let draw=0;draw<100;draw++){
    state.draw=draw;const multiplier=draw<50?0:draw<80?1:draw<95?2:draw<99?5:15;
    await page.getByRole('button',{name:/Крутить ·/}).click();await page.waitForFunction(expected=>{const wheel=document.querySelector('.spin-wheel');return wheel&&Math.abs(parseFloat(wheel.style.getPropertyValue('--spin-rotation'))-expected)<1e-6&&document.querySelector('.game-detail')?.getAttribute('aria-busy')==='false';},normalize(-(draw+.5)*3.6));
    if((await page.locator('.wheel-center').textContent())!==`×${multiplier}`)wheelAngles=false;
    const rotation=await page.locator('.spin-wheel').evaluate(n=>parseFloat(n.style.getPropertyValue('--spin-rotation'))),angle=normalize(-rotation);
    if(Math.abs(angle-(draw+.5)*3.6)>1e-6)wheelAngles=false;
  }
  report.animationChecks.push({name:'all-100-wheel-draws-land-in-correct-sector',passed:wheelAngles});
  await context.close();
}finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({screenshots:report.screenshots.length,findings:report.findings,animationChecks:report.animationChecks,consoleErrors:report.consoleErrors},null,2));
if(report.findings.length||report.consoleErrors.length||report.animationChecks.some(c=>!c.passed))process.exitCode=1;
