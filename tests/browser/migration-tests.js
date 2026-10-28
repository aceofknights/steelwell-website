/* Browser runs are isolated to the disposable origin. No production classroom access. */
(() => {
 const output=document.querySelector('#results'),frame=document.querySelector('#app'),core=window.SeatingBackup;
 if(location.origin!=='http://127.0.0.1:8873')return;
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const report={routes:[],resources:[],failures:[],warnings:[]};window.migrationReport=report;
 async function open(url,expected,width=1248){
  frame.style.width=width+'px';
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Load timeout '+url)),20000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.src=url;});
  for(let i=0;i<300;i++){if(frame.contentWindow.location.pathname===expected&&frame.contentDocument.readyState==='complete')break;await delay(30);}
  if(frame.contentWindow.location.pathname!==expected)throw Error('Unexpected route '+frame.contentWindow.location.pathname+' expected '+expected);
  await delay(40);return frame.contentDocument;
 }
 function seed(values){core.readEntries(localStorage).forEach(e=>localStorage.removeItem(e.key));localStorage.removeItem(core.JOURNAL_KEY);Object.entries(values).forEach(([k,v])=>localStorage.setItem(k,v));localStorage.setItem('migration-unrelated','retain');}
 document.querySelector('#run').onclick=async()=>{
  output.textContent='Running...';report.routes=[];report.resources=[];report.failures=[];report.warnings=[];
  try{
   seed({classList:'["default"]'});
   const {routes}=await (await fetch('/data/routes.json')).json();const audit=await (await fetch('/docs/migration-reference-audit.json')).json();
   // Every local reference is backed by a distinct fetch; image references additionally decode.
   const targets=new Map();audit.references.filter(r=>r.result==='pass').forEach(r=>targets.set(r.resolved.split('#')[0],r));
   for(const [url,ref] of targets){
    try{const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);await response.arrayBuffer();
     if(/\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url)){const img=new Image();img.src=url;await img.decode();}
     report.resources.push({url,status:response.status,result:'pass'});
    }catch(e){report.resources.push({url,result:'fail',error:e.message});report.failures.push({url,error:e.message});}
   }
   const cases=[];const seen=new Set();
   for(const route of routes){
    if(!seen.has(route.clean)){cases.push({url:route.clean,expected:route.clean,kind:route.kind,canonical:route.canonical});seen.add(route.clean);}
    if(route.old)cases.push({url:route.old,expected:route.legacyStrategy.startsWith('functional')?route.old:route.clean,kind:route.kind,canonical:route.canonical,legacy:true});
   }
   if(!seen.has('/test-lab/migration/'))cases.push({url:'/test-lab/migration/',expected:'/test-lab/migration/',kind:'test',canonical:'https://chriswellsdev.com/test-lab/migration/'});
   for(const width of [320,390,768,1248,1440])for(const entry of cases){
    const item={...entry,width};
    try{
     const source=await (await fetch(entry.url)).text();const parsed=new DOMParser().parseFromString(source,'text/html');
     const fragment=parsed.querySelector('[id]')?.id;
     // Redirect pages use a real anchor from their canonical target instead of their fallback-link ID.
     const destinationSource=entry.legacy&&entry.url!==entry.expected?await (await fetch(entry.expected)).text():source;
     const expectedDoc=new DOMParser().parseFromString(destinationSource,'text/html');const hash=expectedDoc.querySelector('[id]')?.id;
     const query='?migrationAudit=1&routeProbe=keep%20me';
     const doc=await open(entry.url+query+(hash?'#'+encodeURIComponent(hash):''),entry.expected,width);
     if(doc.title!==expectedDoc.title)throw Error('Wrong title '+doc.title);
     if(!doc.querySelector('h1,h2,h3,h4'))throw Error('No expected page heading');
     if(doc.querySelector('link[rel="canonical"]')?.href!==entry.canonical)throw Error('Canonical mismatch');
     if(frame.contentWindow.location.search!==query||decodeURIComponent(frame.contentWindow.location.hash)!==(hash?'#'+hash:''))throw Error('Query/fragment lost');
     const imgs=[...doc.images];imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.decode()));
     const state=frame.contentWindow.migrationObservation;
     if(!state)throw Error('Early error observer unavailable');
     item.observation=JSON.parse(JSON.stringify(state));item.networkResources=frame.contentWindow.performance.getEntriesByType('resource').map(r=>({url:r.name,initiator:r.initiatorType,duration:r.duration,bytes:r.transferSize,status:r.responseStatus||null}));
     const localErrors=state.resourceErrors.filter(url=>new URL(url,location.origin).origin===location.origin);
     if(state.errors.length||state.consoleErrors.length||localErrors.length)throw Error('Runtime/resource errors '+JSON.stringify(state));
     if(state.resourceErrors.length)report.warnings.push({url:entry.url,width,externalResourceErrors:state.resourceErrors});
     item.overflow=doc.documentElement.scrollWidth>frame.contentWindow.innerWidth;
     if(item.overflow)report.warnings.push({url:entry.url,width,reason:'Horizontal overflow',scrollWidth:doc.documentElement.scrollWidth});
     item.images=imgs.length;item.stylesheets=doc.styleSheets.length;item.scripts=doc.scripts.length;
     const nav=doc.querySelector('.cw-navigation');if(nav&&width<1161){const summary=nav.querySelector('summary');summary.click();if(!nav.open)throw Error('Menu failed to open');summary.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));if(nav.open||doc.activeElement!==summary)throw Error('Menu Escape/focus failed');}
     item.primaryActions=[...doc.querySelectorAll('main a,.cw-nav-links a')].map(a=>a.getAttribute('href'));
     const navigation=[...doc.querySelectorAll('nav a,.back-button,.sc-brand')].find(a=>a.href.startsWith(location.origin)&&!a.getAttribute('href').startsWith('#'));
     if(navigation){const destination=new URL(navigation.href);navigation.click();for(let i=0;i<200;i++){if(frame.contentWindow.location.pathname===destination.pathname&&frame.contentDocument.readyState==='complete')break;await delay(20);}if(frame.contentWindow.location.pathname!==destination.pathname)throw Error('Primary navigation failed');item.navigationDestination=destination.pathname;}
     const primary=doc.querySelector('a[data-action]');if(primary){item.primaryActionTarget=primary.getAttribute('href');
      const actionURL=new URL(primary.href);
      if(actionURL.origin===location.origin){const fresh=await open(entry.url+query+(hash?'#'+encodeURIComponent(hash):''),entry.expected,width);fresh.querySelector('a[data-action]').click();for(let i=0;i<200;i++){if(frame.contentWindow.location.pathname===actionURL.pathname&&frame.contentDocument.readyState==='complete')break;await delay(20);}if(frame.contentWindow.location.pathname!==actionURL.pathname)throw Error('Primary project action failed');item.primaryActionDestination=actionURL.pathname;}
     }
     item.result='pass';
    }catch(e){item.result='fail';item.error=e.message;report.failures.push(item);}
    report.routes.push(item);output.textContent='Routes '+report.routes.length+'; failures '+report.failures.length+'; latest '+entry.url+' at '+width;
   }
   document.querySelector('#machine').textContent=JSON.stringify(report);output.textContent+='\nCOMPLETE '+report.routes.length+' route cases; '+report.resources.length+' resources; '+report.failures.length+' failures.';
  }catch(e){report.failures.push({error:e.message});output.textContent+='\nFAIL '+e.message;}
 };
 document.querySelector('#fallback').onclick=async()=>{
  const result={cases:[],failures:[]};const text=document.querySelector('#fallbackResults');text.textContent='Running no-script fallbacks...';
  try{const {routes}=await (await fetch('/data/routes.json')).json();frame.setAttribute('sandbox','allow-same-origin');
   for(const route of routes.filter(r=>r.old&&r.legacyStrategy.startsWith('client-side'))){
    const doc=await open(route.old,new URL(route.old,location.origin).pathname);const link=doc.querySelector('#cleanDestination');
    if(!link||link.getAttribute('href')!==route.clean||!link.textContent.trim())throw Error('Missing visible fallback '+route.old);
    link.click();for(let i=0;i<200;i++){if(frame.contentWindow.location.pathname===route.clean&&frame.contentDocument.readyState==='complete')break;await delay(20);}
    if(frame.contentWindow.location.pathname!==route.clean)throw Error('Fallback did not navigate '+route.old);
    result.cases.push({legacy:route.old,target:route.clean,result:'pass'});
   }
   text.textContent='COMPLETE '+result.cases.length+' no-script fallbacks passed.';
  }catch(e){result.failures.push(e.message);text.textContent+=' FAIL '+e.message;}finally{frame.removeAttribute('sandbox');document.querySelector('#fallbackMachine').textContent=JSON.stringify(result);}
 };
 document.querySelector('#data').onclick=async()=>{
  const result={checks:[],failures:[]};window.seatingRouteReport=result;const text=document.querySelector('#dataResults');text.textContent='Running data checks...';
  const assert=(ok,name)=>{if(!ok)throw Error(name);result.checks.push(name);text.textContent+='\nPASS '+name;};
  const snapshot=()=>JSON.stringify(core.readEntries(localStorage));
  async function backup(doc,id){const win=doc.defaultView;let blob;const create=win.URL.createObjectURL,click=win.HTMLAnchorElement.prototype.click;win.URL.createObjectURL=value=>{blob=value;return 'blob:synthetic';};win.HTMLAnchorElement.prototype.click=()=>{};doc.querySelector(id).click();win.URL.createObjectURL=create;win.HTMLAnchorElement.prototype.click=click;if(!blob)throw Error('Backup absent');return JSON.parse(await blob.text());}
  try{
   const fixtures=await (await fetch('/tests/fixtures/seating-storage.json')).json();for(const key of ['seatingChartData_default','tableLayouts'])fixtures.classrooms[key]=fixtures.classrooms[key].replaceAll('\"seatColor\": \"gray\"','\"seatColor\": \"#c084fc\"');seed(fixtures.classrooms);const original=snapshot();
   let doc=await open('/webpages/SeatingChart.html?migrationAudit=1','/webpages/SeatingChart.html');
   assert(JSON.stringify((await backup(doc,'#backupClassroomData')).entries)===original,'Old URL opening safety copy preserves all exact pre-initialization raw strings');
   const baseline=snapshot();const record=localStorage.getItem('seatingChartData_default');
   for(const path of ['/seating-chart/','/webpages/SeatingChart.html','/seating-chart/']){
    const before=snapshot();doc=await open(path+'?migrationAudit=1',path);
    assert(!doc.querySelector('#seatingApplication').disabled,'Application initializes at '+path);
    assert(JSON.stringify((await backup(doc,'#backupClassroomData')).entries)===before,'Opening capture is exact at '+path);
    assert(snapshot()===baseline&&localStorage.getItem('seatingChartData_default')===record,'All classes, seats, locks, geometry, colors, layouts and legacy/orphan strings survive '+path);
    assert([...doc.querySelectorAll('.seat')].some(s=>s.dataset.studentName==='Avery'),'Saved visible assignments load at '+path);assert(JSON.parse(localStorage.getItem('seatingChartData_default')).tables[0].seatColor==='#c084fc','Custom table color survives '+path);
    assert(JSON.stringify((await backup(doc,'#backupCurrentClassroomData')).entries)===snapshot(),'Current backup captures current records at '+path);
   }
   const selector=doc.querySelector('#classSelector');selector.value='Science';selector.dispatchEvent(new doc.defaultView.Event('change'));await delay(80);assert(doc.querySelector('#layoutModeSelect').value==='grid','Class switching restores grid mode');selector.value='default';selector.dispatchEvent(new doc.defaultView.Event('change'));await delay(80);assert([...doc.querySelectorAll('.seat')].some(s=>s.dataset.studentName==='Avery'),'Class switching retains table assignment');
   seed(fixtures.malformed);const malformed=snapshot();
   for(const path of ['/webpages/SeatingChart.html','/seating-chart/']){doc=await open(path+'?migrationAudit=1',path);assert(doc.querySelector('#seatingApplication').disabled&&snapshot()===malformed,'Malformed data pauses safely without writes at '+path);assert(JSON.stringify((await backup(doc,'#backupClassroomData')).entries)===malformed,'Malformed opening values remain exportable at '+path);}
   seed(fixtures.classrooms);const journal=JSON.stringify({format:'chriswellsdev-seating-recovery',version:1,before:[],writes:[]});localStorage.setItem(core.JOURNAL_KEY,journal);
   for(const path of ['/webpages/SeatingChart.html','/seating-chart/']){doc=await open(path+'?migrationAudit=1',path);assert(doc.querySelector('#seatingApplication').disabled&&localStorage.getItem(core.JOURNAL_KEY)===journal,'Recovery journal stays intact and never auto-recovers at '+path);}
   assert(localStorage.getItem('migration-unrelated')==='retain','Unrelated storage is preserved');localStorage.removeItem(core.JOURNAL_KEY);
   document.querySelector('#dataMachine').textContent=JSON.stringify(result);text.textContent+='\nCOMPLETE '+result.checks.length+' passed.';
  }catch(e){result.failures.push(e.message);document.querySelector('#dataMachine').textContent=JSON.stringify(result);text.textContent+='\nFAIL '+e.message;}
 };
})();
