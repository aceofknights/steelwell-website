(function(){
  'use strict';
  const frame=document.querySelector('#app'),output=document.querySelector('#results'),run=document.querySelector('#run');
  if(location.origin!=='http://127.0.0.1:8873'){run.disabled=true;document.querySelector('#seed').disabled=true;return;}
  let win,doc,passed=0,failed=0;const errors=[];
  const pause=(ms=150)=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m);};
  function fixture(rows=6,columns=6,table=false){
    const names=Array.from({length:24},(_,i)=>'Synthetic Student '+(i+1));
    return {layoutMode:table?'table':'grid',manualStudentNames:names,studentsData:Object.fromEntries(names.map(n=>[n,{present:true,lockedSeat:null,lockedTable:null,blacklist:[]}])) ,studentGroups:[],useGroupAlternating:false,
      gridSettings:{rows,columns,aisles:[],rowGap:8,columnGap:8},gridSeats:table?[]:names.slice(0,rows*columns).map((studentName,i)=>({row:Math.floor(i/columns)+1,column:i%columns+1,studentName,isAisle:false})),
      tables:table?[[0,0,300,320],[1600,900,480,400],[700,1700,350,300]].map(([posX,posY,width,height],i)=>({id:'fit-'+i,tableName:'Synthetic table '+(i+1),seatCount:8,columnCount:2,seatColor:['blue','#abcdef','purple'][i],posX,posY,width,height,seats:names.slice(i*8,i*8+8)})):[]};
  }
  function seed(data=fixture(6,6,true)){
    window.SeatingBackup.readEntries(localStorage).forEach(e=>localStorage.removeItem(e.key));localStorage.removeItem(window.SeatingBackup.JOURNAL_KEY);
    localStorage.setItem('classList','["default","Other"]');localStorage.setItem('seatingChartData_default',JSON.stringify(data));localStorage.setItem('seatingChartData_Other',JSON.stringify(fixture(14,3)));
    localStorage.setItem('tableLayouts',JSON.stringify({Spread:{mode:'table',name:'Spread',tables:fixture(6,6,true).tables}}));
  }
  document.querySelector('#seed').onclick=()=>{seed();output.textContent='Synthetic spread-out tables prepared.';};
  async function open(data,width=1360,height=900){frame.src='about:blank';await new Promise(r=>frame.onload=r);seed(data);frame.style.width=width+'px';frame.style.height=height+'px';await window.loadSyntheticSeatingPage(frame);win=frame.contentWindow;doc=frame.contentDocument;win.confirm=()=>true;win.addEventListener('error',e=>errors.push(e.message));await pause(350);}
  const event=(el,type)=>el.dispatchEvent(new win.Event(type,{bubbles:true}));
  const saved=()=>localStorage.getItem('seatingChartData_default');
  const canonical=value=>JSON.stringify(JSON.parse(value),(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
  function measure(check=true){
    const viewport=doc.querySelector('#workspaceViewport'),host=doc.body.classList.contains('sc-workspace-fullscreen')?doc.querySelector('#workspaceZoomFrame'):viewport;
    const box=host.getBoundingClientRect(),items=[...doc.querySelectorAll('.table,.grid-seat')].map(el=>el.getBoundingClientRect());
    const clipped=items.filter(r=>r.left<box.left-.5||r.top<box.top-.5||r.right>box.right+.5||r.bottom>box.bottom+.5).length;
    const result={viewport:[box.width,box.height],items:items.length,clipped,scale:win.SeatingViewport.getScale(),scrollbars:[viewport.scrollWidth>viewport.clientWidth,viewport.scrollHeight>viewport.clientHeight]};
    if(check){assert(clipped===0,'All bounds inside view: '+JSON.stringify(result));assert(!result.scrollbars.some(Boolean),'No auto-fit scrollbars: '+JSON.stringify(result));}return result;
  }
  function fullscreen(){let active=null;Object.defineProperty(doc,'fullscreenElement',{configurable:true,get:()=>active});doc.documentElement.requestFullscreen=async()=>{active=doc.documentElement;event(doc,'fullscreenchange');};doc.exitFullscreen=async()=>{active=null;event(doc,'fullscreenchange');};}
  async function test(name,fn){const count=errors.length;try{await fn();assert(errors.length===count,errors.slice(count).join(';'));passed++;output.textContent+='\nPASS '+name;}catch(e){failed++;output.textContent+='\nFAIL '+name+': '+e.message;}}
  run.onclick=async()=>{
    run.disabled=true;passed=failed=0;output.textContent='Running…';
    for(const [rows,cols] of [[2,2],[30,30],[2,60],[60,2],[120,2]])for(const width of [1360,390])await test(rows+'×'+cols+' grid at '+width,async()=>{await open(fixture(rows,cols),width,width===390?844:900);const before=saved();output.textContent+='\nMEASURE '+JSON.stringify(measure());fullscreen();doc.querySelector('#workspaceFullscreenBtn').click();await pause();measure();await doc.exitFullscreen();await pause();measure();assert(saved()===before,'No saved grid or names changed');});
    await test('spread-out tables, sidebar, viewport resize, class switch and reload',async()=>{
      await open(fixture(6,6,true));const before=saved();output.textContent+='\nMEASURE '+JSON.stringify(measure());doc.querySelector('#toggleStudentListBtn').click();await pause();measure();frame.style.width='390px';frame.style.height='844px';await pause();measure();const classes=doc.querySelector('#classSelector');classes.value='Other';event(classes,'change');await pause();measure();classes.value='default';event(classes,'change');await pause();measure();assert(canonical(saved())===canonical(before),'Geometry, colors and assignments unchanged');await window.loadSyntheticSeatingPage(frame);win=frame.contentWindow;doc=frame.contentDocument;await pause(300);measure();assert(canonical(saved())===canonical(before),'Reload keeps saved geometry');
    });
    await test('unfitted 100% baseline compared with automatic bounds fit',async()=>{
      await open(fixture(6,6,true));doc.querySelector('#resetZoom').click();await pause();const before=measure(false);assert(before.clipped>0,'Baseline demonstrates clipping');doc.querySelector('#fitRoom').click();await pause();const after=measure();output.textContent+='\nBEFORE_AFTER '+JSON.stringify({before,after});
    });
    await test('saved layout switching fits its full table bounds',async()=>{
      await open(fixture(2,2),390,844);const layout=doc.querySelector('#layoutSelector');layout.value='Spread';event(layout,'change');await pause();assert(doc.querySelectorAll('.table').length===3,'Saved table layout loaded');measure();
    });
    await test('grid dimensions and table add/remove trigger fit without clipping',async()=>{
      await open(fixture(6,6,true));doc.querySelector('#addTableBtn').click();await pause();measure();doc.querySelector('.table:last-of-type .delete-btn')?.click();await pause();measure();const mode=doc.querySelector('#layoutModeSelect');mode.value='grid';event(mode,'change');await pause();doc.querySelector('#gridRowsInput').value=40;doc.querySelector('#gridColumnsInput').value=25;event(doc.querySelector('#gridRowsInput'),'change');await pause();measure();
    });
    for(const scale of [.8,1,1.25])await test('rendering scale '+scale+' bounds and idle stability',async()=>{
      await open(fixture(12,18),1600,1000);doc.documentElement.style.zoom=String(scale);fullscreen();doc.querySelector('#workspaceFullscreenBtn').click();await pause(400);const before=measure(),seat=doc.querySelector('.grid-seat'),first=seat.getBoundingClientRect().toJSON();let writes=0;const mo=new win.MutationObserver(r=>writes+=r.length);mo.observe(doc.querySelector('#classroom'),{attributes:true,subtree:true,childList:true});await pause(3000);mo.disconnect();const last=seat.getBoundingClientRect().toJSON();assert(['x','y','width','height'].every(k=>Math.abs(first[k]-last[k])<.1),'No idle movement');assert(writes===0,'No repeated mutations: '+writes);measure();output.textContent+='\nSTABILITY '+JSON.stringify({renderingScale:scale,...before,writes});
    });
    await test('fullscreen R randomizes and exit refits without changing table geometry',async()=>{
      await open(fixture(6,6,true));const geometry=()=>JSON.parse(saved()).tables.map(t=>[t.id,t.posX,t.posY,t.width,t.height,t.seatColor]);const before=JSON.stringify(geometry());fullscreen();doc.querySelector('#workspaceFullscreenBtn').click();await pause();measure();assert(win.getComputedStyle(doc.querySelector('.sc-toolbar')).visibility==='hidden','Minimal fullscreen');doc.querySelector('#classroom').dispatchEvent(new win.KeyboardEvent('keydown',{key:'r',bubbles:true,cancelable:true}));await pause();measure();assert(JSON.stringify(geometry())===before,'R preserves geometry and colors');await doc.exitFullscreen();await pause();measure();
    });
    output.textContent+='\nCOMPLETE '+passed+' passed, '+failed+' failed. Rendering scale is CSS emulation, not native Chrome browser zoom.';run.disabled=false;
  };
})();
