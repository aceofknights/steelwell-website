(function(){
  'use strict';
  const output=document.querySelector('#results'),frame=document.querySelector('#app'),run=document.querySelector('#run');
  if(location.origin!=='http://127.0.0.1:8873'){document.querySelectorAll('button').forEach(b=>b.disabled=true);return;}
  const pause=(ms=60)=>new Promise(resolve=>setTimeout(resolve,ms)),core=window.SeatingBackup;
  let win,doc,errors=[],passed=0,failed=0;
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  const people=Array.from({length:24},(_,i)=>'Synthetic Student '+(i+1));
  function fixture(){
    const tables=[32,370,708].map((posX,i)=>({id:'display-table-'+i,tableName:['Window table','Reading group','Activity table'][i],seatCount:8,columnCount:2,seatColor:['blue','#abcdef','rgb(130, 25, 190)'][i],posX,posY:32,width:300,height:320,seats:people.slice(i*8,i*8+8)}));
    const data={tables,manualStudentNames:people,studentsData:Object.fromEntries(people.map(name=>[name,{present:true,lockedSeat:null,lockedTable:null,blacklist:[]}])),layoutMode:'table',gridSeats:[],studentGroups:[],useGroupAlternating:false,gridSettings:{rows:6,columns:6,aisles:[],rowGap:8,columnGap:8}};
    const grid={...data,tables:[],layoutMode:'grid',gridSeats:people.map((studentName,i)=>({row:Math.floor(i/6)+1,column:i%6+1,studentName,isAisle:false}))};
    return {classList:'["default","Grid"]',seatingChartData_default:JSON.stringify(data),seatingChartData_Grid:JSON.stringify(grid),tableLayouts:JSON.stringify({'Original custom colors':{mode:'table',name:'Original custom colors',tables}}),currentTableLayout_default:'Original custom colors'};
  }
  function seed(){core.readEntries(localStorage).forEach(e=>localStorage.removeItem(e.key));localStorage.removeItem(core.JOURNAL_KEY);Object.entries(fixture()).forEach(([key,value])=>localStorage.setItem(key,value));localStorage.setItem('display-unrelated','keep');}
  document.querySelector('#seed').addEventListener('click',()=>{seed();output.textContent='Prepared 24 synthetic students and three tables, including older custom colors.';});
  const entries=()=>JSON.stringify(core.readEntries(localStorage));
  const record=()=>JSON.parse(localStorage.getItem('seatingChartData_default'));
  const event=(el,type)=>el.dispatchEvent(new win.Event(type,{bubbles:true}));
  async function open(reset=true,width=1360,height=900){
    await new Promise(resolve=>{frame.onload=resolve;frame.src='about:blank';});if(reset)seed();
    frame.style.width=width+'px';frame.style.height=height+'px';await window.loadSyntheticSeatingPage(frame);
    win=frame.contentWindow;doc=frame.contentDocument;errors=[];win.addEventListener('error',e=>{if(!e.error?.classroomStorageError)errors.push(e.message);});
    for(let i=0;i<100&&doc.querySelector('#seatingApplication').disabled;i++)await pause(30);await pause();
    assert(!doc.querySelector('#seatingApplication').disabled,'Application ready');doc.querySelector('#resetZoom').click();await pause();
  }
  async function test(name,fn){try{await fn();assert(!errors.length,errors.join('; '));passed++;output.textContent+='\nPASS '+name;}catch(error){failed++;output.textContent+='\nFAIL '+name+': '+error.message;}}
  async function picker(index=0){const table=doc.querySelectorAll('.table')[index];table.querySelector('.sc-table-settings').open=true;await pause();table.querySelector('.sc-open-color').click();await pause();assert(doc.querySelector('#tableColorDialog').open,'Color dialog opens');return table;}
  async function chooseHex(value){const input=doc.querySelector('#tableColorHex');input.value=value;event(input,'input');await pause();}
  async function apply(){doc.querySelector('#applyTableColor').click();await pause();assert(!doc.querySelector('#tableColorDialog').open,'Color dialog closes after save');}
  function geometry(){return [...doc.querySelectorAll('.table')].map(t=>({id:t.dataset.id,left:t.style.left,top:t.style.top,width:t.style.width,height:t.style.height,seats:[...t.querySelectorAll('.seat')].map(s=>s.dataset.studentName)}));}
  function mockFullscreen(){
    let current=null;
    Object.defineProperty(doc,'fullscreenElement',{configurable:true,get:()=>current});
    doc.documentElement.requestFullscreen=async()=>{current=doc.documentElement;event(doc,'fullscreenchange');};
    doc.exitFullscreen=async()=>{current=null;event(doc,'fullscreenchange');};
  }
  async function stability(label){
    await doc.fonts.ready;await pause(250);const viewport=doc.querySelector('#workspaceViewport'),seats=[...doc.querySelectorAll('.seat')];
    const read=()=>({view:[viewport.clientWidth,viewport.clientHeight],scroll:[viewport.scrollLeft,viewport.scrollTop],rects:seats.map(s=>{const r=s.getBoundingClientRect();return[r.x,r.y,r.width,r.height];})});
    const first=read();let max=0,frames=0,mutations=0;const mo=new win.MutationObserver(r=>mutations+=r.length);mo.observe(doc.querySelector('#classroom'),{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
    const start=win.performance.now();await new Promise((resolve,reject)=>{function tick(){try{const value=read();frames++;assert(value.view.join()===first.view.join(),'Stable viewport at '+label);value.rects.forEach((r,i)=>r.forEach((n,j)=>max=Math.max(max,Math.abs(n-first.rects[i][j]))));assert(value.scroll.join()===first.scroll.join(),'No unexpected scrolling');if(win.performance.now()-start<3000)win.requestAnimationFrame(tick);else resolve();}catch(error){mo.disconnect();reject(error);}}win.requestAnimationFrame(tick);});mo.disconnect();
    assert(frames>=30&&max<=.25&&mutations===0,'Idle geometry and mutation stability '+label+' (delta '+max+', mutations '+mutations+')');
  }
  run.addEventListener('click',async()=>{
    run.disabled=true;passed=failed=0;output.textContent='Running display and color tests…';
    await test('older named, hex and CSS colors load without overwriting raw records',async()=>{
      await open();assert(doc.querySelectorAll('.seat-color')[1].value==='#abcdef','Existing custom hex preserved');assert(doc.querySelectorAll('.seat-color')[2].value==='rgb(130, 25, 190)','Existing CSS color preserved');assert(record().tables[1].seatColor==='#abcdef','Stored custom value unchanged');
    });
    await test('live preview is selected-table only; Cancel keeps storage, geometry and assignments',async()=>{
      await open();const before=entries(),beforeGeometry=JSON.stringify(geometry()),other=doc.querySelectorAll('.table')[1].dataset.colorSurface;
      const table=await picker();await chooseHex('#ffffff');assert(table.dataset.colorSurface==='#ffffff','Live preview');assert(win.getComputedStyle(table.querySelector('.seat')).color==='rgb(0, 0, 0)','Dark readable names');assert(doc.querySelectorAll('.table')[1].dataset.colorSurface===other,'Other table unchanged');assert(entries()===before,'Preview does not save');doc.querySelector('#cancelTableColor').click();await pause();assert(table.dataset.colorSurface==='#263e61','Cancel restores original');assert(entries()===before&&JSON.stringify(geometry())===beforeGeometry,'Data and geometry unchanged');
    });
    await test('preset saves existing seatColor only and retains all seats and other table colors',async()=>{
      await open();const before=record(),beforeGeometry=JSON.stringify(geometry());await picker();doc.querySelector('[aria-label="Amber table color"]').click();await apply();const after=record();assert(after.tables[0].seatColor==='#f4bd50','Preset persisted');assert(after.tables[1].seatColor===before.tables[1].seatColor&&after.tables[2].seatColor===before.tables[2].seatColor,'Other colors retained');assert(JSON.stringify(after.studentsData)===JSON.stringify(before.studentsData),'Student records unchanged');assert(JSON.stringify(geometry())===beforeGeometry,'Geometry and assignments unchanged');assert(localStorage.getItem('display-unrelated')==='keep','Unrelated storage untouched');
    });
    await test('custom color persists after reload; class and saved layout switching preserve compatible colors',async()=>{
      await open();await picker();await chooseHex('#123abc');await apply();await open(false);assert(doc.querySelector('.seat-color').value==='#123abc','Custom survives reload');const classes=doc.querySelector('#classSelector');classes.value='Grid';event(classes,'change');await pause();classes.value='default';event(classes,'change');await pause();assert(doc.querySelector('.seat-color').value==='#123abc','Class switch retains custom');const layouts=doc.querySelector('#layoutSelector');layouts.value='Original custom colors';event(layouts,'change');await pause();assert(doc.querySelectorAll('.seat-color')[1].value==='#abcdef','Older saved layout retains custom hex');
    });
    await test('Restore default is explicit and persists the original gray configuration',async()=>{
      await open();await picker(1);doc.querySelector('#defaultTableColor').click();assert(record().tables[1].seatColor==='#abcdef','Default preview has not saved');await apply();assert(record().tables[1].seatColor==='gray','Default uses existing gray value');await open(false);assert(doc.querySelectorAll('.table')[1].dataset.colorSurface==='#304056','Default reload appearance');
    });
    await test('hue keyboard, touch pointer, cancellation, saturation and brightness work',async()=>{
      await open();await picker();const before=entries(),wheel=doc.querySelector('#tableHueWheel');wheel.dispatchEvent(new win.KeyboardEvent('keydown',{key:'r',bubbles:true}));assert(entries()===before,'Modal hue keys never randomize the classroom');wheel.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Home',bubbles:true}));wheel.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));assert(wheel.getAttribute('aria-valuenow')==='10','Keyboard hue moves ten degrees');
      const r=wheel.getBoundingClientRect(),p=(type,x,y)=>wheel.dispatchEvent(new win.PointerEvent(type,{pointerId:44,pointerType:'touch',isPrimary:true,button:0,buttons:1,bubbles:true,cancelable:true,clientX:x,clientY:y}));p('pointerdown',r.right-10,r.top+r.height/2);assert(wheel.getAttribute('aria-valuenow')==='90','Touch ring selects hue');p('pointercancel',r.right-10,r.top+r.height/2);p('pointermove',r.left+r.width/2,r.top);assert(wheel.getAttribute('aria-valuenow')==='90','Cancelled touch stops editing');
      const s=doc.querySelector('#tableSaturation'),v=doc.querySelector('#tableBrightness');s.value=100;event(s,'input');v.value=50;event(v,'input');assert(doc.querySelector('#brightnessValue').value==='50%','Brightness updates');assert(doc.querySelector('#tableColorHex').value==='#408000','HSV controls produce expected color');doc.querySelector('#cancelTableColor').click();
    });
    await test('picker stays outside workspace scaling from 10% through 200%, including mobile',async()=>{
      for(const width of [1360,390,320]){
        await open(true,width,width===1360?900:844);for(const steps of [-9,0,10]){
          doc.querySelector('#resetZoom').click();for(let i=0;i<Math.abs(steps);i++)doc.querySelector(steps<0?'#zoomOut':'#zoomIn').click();await pause();await picker();const d=doc.querySelector('#tableColorDialog'),r=d.getBoundingClientRect();assert(r.width<=width&&r.left>=0&&r.right<=width+1,'Dialog fits '+width);assert(doc.querySelector('#tableHueWheel').getBoundingClientRect().width===200,'Wheel is unscaled');doc.querySelector('#cancelTableColor').click();await pause();
        }
      }
    });
    await test('all presets and extreme custom colors keep names at WCAG AA contrast',async()=>{
      await open();await picker();for(const value of ['#ffffff','#000000','#777777','#ff0000','#00ff00','#0000ff',...Object.values({blue:'#4388f5',amber:'#f4bd50',teal:'#21b8a6',purple:'#9a77ec'})]){
        await chooseHex(value);const table=doc.querySelector('.table'),ink=win.SeatingColorMath.foreground(value);assert(win.SeatingColorMath.contrast(value,ink)>=4.5,'AA contrast '+value);assert(win.getComputedStyle(table.querySelector('.seat')).textShadow==='none','No low-contrast text shadow');assert(win.getComputedStyle(table.querySelector('.seat')).backgroundColor===win.getComputedStyle(doc.querySelector('#tableColorPreview')).backgroundColor,'Preview matches seats');
      }doc.querySelector('#cancelTableColor').click();
    });
    await test('failed color saves restore the original configuration and explain the failure',async()=>{
      await open();const before=entries();await picker();await chooseHex('#ff0000');const save=win.saveTables;win.saveTables=()=>{throw Error('Synthetic quota failure');};doc.querySelector('#applyTableColor').click();await pause();assert(entries()===before,'Failed save leaves storage untouched');assert(doc.querySelector('.seat-color').value==='blue','Original selected value restored');assert(!doc.querySelector('#tableColorError').hidden,'Failure feedback');win.saveTables=save;doc.querySelector('#cancelTableColor').click();
    });
    await test('Grid mode creates no table records or color controls and retains its original surfaces',async()=>{
      await open();const classes=doc.querySelector('#classSelector');classes.value='Grid';event(classes,'change');await pause();const before=entries(),color=win.getComputedStyle(doc.querySelector('.grid-seat')).backgroundColor;assert(!doc.querySelector('.table,.sc-open-color'),'No fictional tables');doc.querySelector('#fullscreenClassroomBtn').click();await pause();doc.querySelector('.sc-presentation-controls button:last-child').click();await pause();assert(entries()===before&&win.getComputedStyle(doc.querySelector('.grid-seat')).backgroundColor===color,'Grid appearance and data retained');
    });
    await test('fullscreen and presentation toggle independently, refitting without classroom data changes',async()=>{
      await open();mockFullscreen();for(let i=0;i<5;i++)doc.querySelector('#zoomIn').click();await pause();const before=entries(),g=JSON.stringify(geometry());doc.querySelector('#workspaceFullscreenBtn').click();await pause();assert(doc.fullscreenElement===doc.documentElement,'Whole application fullscreen');assert(!win.SeatingViewport.isPresenting(),'Does not enter Present');assert(doc.querySelector('#workspaceFullscreenBtn').textContent==='Exit Fullscreen','Label synchronized');assert(win.SeatingViewport.getScale()>0,'Fullscreen automatically fits classroom');
      doc.querySelector('#fullscreenClassroomBtn').click();await pause();assert(win.SeatingViewport.isPresenting()&&doc.fullscreenElement,'Both active');doc.querySelector('.sc-presentation-controls button:last-child').click();await pause();assert(!win.SeatingViewport.isPresenting()&&doc.fullscreenElement,'Exit Present keeps fullscreen');doc.querySelector('#fullscreenClassroomBtn').click();await pause();await doc.exitFullscreen();await pause();assert(win.SeatingViewport.isPresenting(),'Native fullscreen exit keeps Present');doc.querySelector('.sc-presentation-controls button:last-child').click();await pause();assert(doc.querySelector('#fitRoom').getAttribute('aria-pressed')==='true','Workspace automatically fitted on exit');assert(entries()===before&&JSON.stringify(geometry())===g,'No saved changes');
    });
    await test('presentation retains custom surfaces and readable names without saving',async()=>{
      await open();const before=entries(),table=doc.querySelectorAll('.table')[1],surface=win.getComputedStyle(table.querySelector('.seat')).backgroundColor;
      doc.querySelector('#fullscreenClassroomBtn').click();await pause();assert(win.getComputedStyle(table.querySelector('.seat')).backgroundColor===surface,'Presentation retains selected color');assert(win.getComputedStyle(table.querySelector('.seat')).color==='rgb(0, 0, 0)','Presentation retains contrasting names');assert(win.getComputedStyle(doc.querySelector('.table-controls')).display==='none','Editing hidden in presentation');assert(win.getComputedStyle(doc.querySelector('.sc-toolbar')).visibility==='hidden'&&table.querySelector('.table-name-input').inert,'Background editing controls excluded from keyboard access');doc.querySelector('.sc-presentation-controls button:last-child').click();await pause();assert(!table.querySelector('.table-name-input').inert,'Name editing restored');assert(entries()===before,'Presentation never changes records');
    });
    await test('fullscreen shows only desks, keeps R randomization and restores editing on exit',async()=>{
      await open();mockFullscreen();const before=JSON.stringify(geometry());doc.querySelector('#workspaceFullscreenBtn').click();await pause();
      assert(win.getComputedStyle(doc.querySelector('.sc-toolbar')).visibility==='hidden','Toolbar hidden');assert(win.getComputedStyle(doc.querySelector('.sc-presentation-controls')).display==='none','Presentation controls hidden');assert(win.getComputedStyle(doc.querySelector('.table-controls')).display==='none','Table editing hidden');
      assert(doc.activeElement===doc.querySelector('#classroom'),'Classroom focused for R');let saves=0;const save=win.saveTables;win.saveTables=()=>{saves++;return save();};doc.querySelector('#classroom').dispatchEvent(new win.KeyboardEvent('keydown',{key:'r',bubbles:true,cancelable:true}));await pause();assert(saves>0,'R still randomizes');win.saveTables=save;
      await doc.exitFullscreen();await pause();assert(win.getComputedStyle(doc.querySelector('.sc-toolbar')).visibility==='visible','Editing controls return');assert(!doc.querySelector('.table-name-input').inert,'Table name editing restored');
    });
    await test('denied and unsupported fullscreen show feedback without presentation or writes',async()=>{
      await open();const before=entries();doc.documentElement.requestFullscreen=()=>Promise.reject(Error('Denied'));doc.querySelector('#workspaceFullscreenBtn').click();await pause();assert(!doc.querySelector('#workspaceNotice').hidden&&!win.SeatingViewport.isPresenting(),'Denial explained');doc.documentElement.requestFullscreen=undefined;doc.querySelector('#workspaceFullscreenBtn').click();await pause();assert(doc.querySelector('#workspaceNotice').textContent.includes('unavailable'),'Unsupported explained');assert(entries()===before,'No writes');
    });
    for(const scale of [1,.8])for(const mode of ['Table','Grid'])await test('fullscreen resize stability at '+scale*100+'% rendering scale in '+mode,async()=>{
      await open();mockFullscreen();frame.style.width='2400px';frame.style.height='1600px';doc.documentElement.style.zoom=String(scale);
      if(mode==='Grid'){const classes=doc.querySelector('#classSelector');classes.value='Grid';event(classes,'change');}
      const viewport=doc.querySelector('#workspaceViewport');viewport.style.cssText=scale===.8?'flex:none;width:2034.00390625px;height:932.578125px;border-width:1.25px':'flex:none;width:2033.5px;height:932.078125px;border-width:1px';
      doc.querySelector('#workspaceFullscreenBtn').click();await pause();await stability(scale+'/'+mode);await doc.exitFullscreen();await pause();
    });
    output.textContent+='\nCOMPLETE — '+passed+' passed, '+failed+' failed. Native fullscreen still requires a real browser gesture.';run.disabled=false;
  });
})();
