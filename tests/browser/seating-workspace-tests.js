(function () {
  'use strict';
  const output = document.getElementById('results'), frame = document.getElementById('app');
  if (location.origin !== 'http://127.0.0.1:8873') {
    document.querySelectorAll('button').forEach(button => button.disabled = true);
    output.textContent = 'Disabled: dedicated loopback test origin required.'; return;
  }
  const core = window.SeatingBackup;
  const people = ['Avery Chen','Blake Rivera','Cameron Ellis','Dara Morgan','Ellis Kim','Finley Brooks','Harper Quinn','Jordan Taylor','Kai Wilson','Logan Patel','Morgan Reid','Riley Parker','Sam Jones'];
  function fixture() {
    const tables = [32,370,708].map((posX, i) => ({ id:'synthetic-desk-' + i, tableName:['Front left','Front center','Front right'][i], seatCount:4, columnCount:2, seatColor:['blue','purple','green'][i], posX, posY:32, width:300, height:300, seats:people.slice(i * 4, i * 4 + 4) }));
    const studentsData = Object.fromEntries(people.map((name,i) => [name,{ present:i !== 12, lockedSeat:i === 0 ? { tableId:'synthetic-desk-0',seatIndex:0 } : null, lockedTable:null,blacklist:[],groupId:i % 2 ? 'b':'a' }]));
    const data = { tables, manualStudentNames:people, studentsData, layoutMode:'table', gridSeats:[], studentGroups:[{id:'a',name:'Group One'},{id:'b',name:'Group Two'}],useGroupAlternating:false,gridSettings:{rows:4,columns:4,aisles:[],rowGap:8,columnGap:8} };
    const grid = { ...data,tables:[],layoutMode:'grid',studentGroups:[],gridSeats:people.slice(0,12).map((studentName,i)=>({row:Math.floor(i/4)+1,column:i%4+1,studentName,isAisle:false})), studentsData:Object.fromEntries(people.map((name,i)=>[name,{present:i!==12,lockedSeat:null,lockedTable:null,blacklist:[]}])) };
    return { classList:'["default","Science"]',seatingChartData_default:JSON.stringify(data),seatingChartData_Science:JSON.stringify(grid),tableLayouts:JSON.stringify({'Three tables':{mode:'table',name:'Three tables',tables}}),currentTableLayout_default:'Three tables' };
  }
  function seed() {
    core.readEntries(localStorage).forEach(e=>localStorage.removeItem(e.key)); localStorage.removeItem(core.JOURNAL_KEY);
    Object.entries(fixture()).forEach(([key,value])=>localStorage.setItem(key,value)); localStorage.setItem('workspace-unrelated','preserved');
  }
  document.getElementById('seed').addEventListener('click',()=>{ seed(); output.textContent='Synthetic workspace prepared. Open Workspace Preview.'; });
  let win,doc; const browserErrors=[];
  const assert=(value,message)=>{ if(!value)throw Error(message); };
  const pause=()=>new Promise(resolve=>setTimeout(resolve,40));
  const entries=()=>JSON.stringify(core.readEntries(localStorage));
  async function open(width=1360,height=850,empty=false) {
    frame.src='about:blank'; await new Promise(resolve=>frame.onload=resolve); seed();
    if(empty)localStorage.setItem('seatingChartData_default',JSON.stringify({tables:[],manualStudentNames:[],studentsData:{}}));
    frame.style.width=width+'px'; frame.style.height=height+'px';
    await window.loadSyntheticSeatingPage(frame);
    win=frame.contentWindow;doc=frame.contentDocument;
    win.addEventListener('error',event=>{if(!event.error?.classroomStorageError)browserErrors.push(event.message);});
    for(let i=0;i<100;i++){if(doc.querySelector('#randomizeSeatingBtn')&&!doc.querySelector('#seatingApplication').disabled)break;await pause();}
    await pause();
    assert(!doc.querySelector('#seatingApplication').disabled,'Workspace ready');
    // Legacy interaction scenarios explicitly opt into temporary 100% editing zoom.
    doc.querySelector('#resetZoom').click();await pause();
  }
  const event=(el,type)=>el.dispatchEvent(new win.Event(type,{bubbles:true}));
  const percent=()=>Number.parseInt(doc.querySelector('#zoomValue').textContent);
  async function zoomTo(value){
    doc.querySelector('#resetZoom').click();
    const button=doc.querySelector(value<100?'#zoomOut':'#zoomIn');
    for(let i=0;i<Math.abs(value-100)/10;i++)button.click();
    await pause();assert(percent()===value,'Requested zoom '+value);
  }
  let pointerId=100;
  function pointer(target,type,id,x,y,extra={}) {
    target.dispatchEvent(new win.PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y,...extra}));
  }
  async function touchView(value,width,height) {
    await open(width,height);
    if(value===34||value===73){
      const viewport=doc.querySelector('#workspaceViewport');
      // Fit first so host scrollbar removal has settled before sizing this fixture.
      doc.querySelector('#fitRoom').click();await pause();
      const targetWidth=(viewport.clientWidth-25)/(value/100);
      doc.querySelectorAll('.table')[2].style.left=(32+targetWidth-300)+'px';win.saveTables();await pause();
      doc.querySelector('#fitRoom').click();await pause();assert(percent()===value,'Synthetic Fit fixture produces '+value+'%, got '+percent()+'% (viewport '+viewport.clientWidth+'×'+viewport.clientHeight+')');
    }else await zoomTo(value);
    doc.querySelector('#editTables').click();await pause();
    assert(doc.querySelector('#editTables').textContent==='Done Editing','Explicit editing mode');
  }
  async function test(name,fn){const count=browserErrors.length;try{await fn();assert(browserErrors.length===count,'No browser errors: '+browserErrors.slice(count).join('; '));output.textContent+='\nPASS '+name;}catch(error){output.textContent+='\nFAIL '+name+': '+error.message;}}
  async function chooseFile(mode,backup) {
    const input=doc.querySelector('#classroomBackupFile'); input.click=()=>{};
    doc.querySelector(mode==='verify'?'#verifyClassroomBackup':'#restoreClassroomData').click();
    Object.defineProperty(input,'files',{configurable:true,value:[new win.File([JSON.stringify(backup)],'synthetic.json',{type:'application/json'})]});
    event(input,'change'); await pause();
  }
  document.getElementById('run').addEventListener('click',async()=>{
    document.getElementById('run').disabled=true;output.textContent='Running workspace tests…';
    try {
      for(const [width,height] of [[1440,960],[1024,768],[768,1024],[390,844],[320,740]]) await test(width+'px: shell fits, room pans without changing geometry, sidebar controls remain accessible',async()=>{
        await open(width,height);const before=entries();
        assert(doc.documentElement.scrollWidth<=width+1,'No page horizontal overflow');
        const viewport=doc.querySelector('#workspaceViewport');const rect=viewport.getBoundingClientRect();
        assert(rect.height>=180&&rect.bottom<=height,'Workspace visible without page scrolling');
        assert(doc.querySelector('.table').style.left==='32px','Saved X preserved');
        assert(doc.querySelector('.table').style.width==='300px','Saved width preserved');
        const sidebar=doc.querySelector('#studentListContainer');const toggle=doc.querySelector('#toggleStudentListBtn');
        if(width<=900){assert(sidebar.classList.contains('hidden')&&sidebar.inert,'Compact sidebar initially inaccessible');toggle.click();await pause();assert(!sidebar.inert&&toggle.getAttribute('aria-expanded')==='true','Roster opens accessibly');}
        toggle.click();await pause();assert(sidebar.inert,'Collapsed roster cannot receive focus');
        viewport.scrollLeft=300;viewport.scrollTop=80;await pause();
        assert(doc.querySelector('.table').style.left==='32px','Panning never changes coordinates');
        assert(entries()===before,'Responsive panels and panning never save data');
        const classes=doc.querySelector('#classSelector');classes.value='Science';event(classes,'change');await pause();
        doc.querySelectorAll('.grid-seat').forEach(seat=>{
          const label=seat.querySelector('.grid-seat-name');if(!label.textContent)return;
          assert(label.scrollHeight<=seat.clientHeight-8,'Grid names fit vertically after canvas sizing');
        });
      });
      await test('mouse drag after workspace scrolling and resize retain the coordinate plane',async()=>{
        await open(1024,768);const viewport=doc.querySelector('#workspaceViewport');viewport.scrollLeft=200;
        const table=doc.querySelectorAll('.table')[1];const rect=table.getBoundingClientRect();
        table.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true,clientX:rect.left+10,clientY:rect.top+5}));
        doc.dispatchEvent(new win.MouseEvent('mousemove',{bubbles:true,clientX:rect.left+80,clientY:rect.top+55}));
        doc.dispatchEvent(new win.MouseEvent('mouseup',{bubbles:true}));
        assert(table.style.left==='440px'&&table.style.top==='82px','Scrolled drag delta is exact');
        const handle=table.querySelector('.table-resize-handle');const before=Number.parseFloat(table.style.width);
        handle.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true,clientX:600,clientY:350}));
        doc.dispatchEvent(new win.MouseEvent('mousemove',{bubbles:true,clientX:640,clientY:380}));doc.dispatchEvent(new win.MouseEvent('mouseup',{bubbles:true}));
        assert(Number.parseFloat(table.style.width)===before+40,'Resize delta retained');
      });
      await test('table settings disclose all original controls, focus states, and live edits',async()=>{
        await open();const table=doc.querySelector('.table');const details=table.querySelector('.sc-table-settings');
        assert(details&&!details.open,'Settings initially contextual');details.open=true;
        const color=table.querySelector('.seat-color');color.value='pink';event(color,'change');await pause();
        assert(table.querySelector('.seat').dataset.studentName===people[0],'Seat assignments survive edit');
        const columns=table.querySelector('.column-count');columns.focus();assert(doc.activeElement===columns,'Settings keyboard focusable');
        assert(table.querySelector('.delete-btn').textContent==='Remove table','Removal is discoverable');
      });
      await test('student assignment, attendance, constraints and class switching still use original handlers',async()=>{
        await open();const first=doc.querySelector('.student-list-item');first.querySelector('.options-btn').click();await pause();
        assert(first.querySelector('.options-panel').style.display==='block','Constraint panel opens');first.querySelector('.cancel-options-btn').click();
        const attendance=first.querySelector('.attendance-btn');attendance.checked=false;event(attendance,'change');await pause();
        assert(doc.querySelector('#attendanceSummary').textContent==='11 / 13 present','Attendance count updates');
        const seat=doc.querySelectorAll('.seat')[1];win.prompt=()=> 'Synthetic assignment';seat.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await pause();
        assert(seat.dataset.studentName==='Synthetic assignment','Keyboard assignment uses original prompt');
        const classes=doc.querySelector('#classSelector');classes.value='Science';event(classes,'change');await pause();
        assert(doc.querySelector('.seating-grid'),'Grid class loads');assert(doc.querySelector('.grid-seat-name').textContent===people[0],'Grid names visible');
      });
      await test('backup download, read-only verification, restore cancellation and confirmed pause remain intact',async()=>{
        await open();doc.querySelector('#toggleDataPanel').click();await pause();assert(doc.querySelector('#dataPanel').open,'Backup panel opens');
        const before=entries();let blob;win.URL.createObjectURL=value=>{blob=value;return 'blob:synthetic';};win.URL.revokeObjectURL=()=>{};
        const original=win.HTMLAnchorElement.prototype.click;win.HTMLAnchorElement.prototype.click=()=>{};
        doc.querySelector('#backupClassroomData').click();const exported=core.validateBackup(await blob.text());
        win.HTMLAnchorElement.prototype.click=original;
        assert(JSON.stringify(exported.entries)===JSON.stringify(core.envelope(Object.entries(fixture()).map(([key,value])=>({key,value})),location.origin).entries),'Opening export preserves exact fixture');
        assert(entries()===before,'Backup writes nothing');
        const backup=core.envelope([{key:'classList',value:'["default"]'}],location.origin);
        await chooseFile('verify',backup);assert(doc.querySelector('#dataProtectionStatus').textContent.startsWith('Backup verified'),'Verification feedback');assert(entries()===before,'Verification writes nothing');
        await chooseFile('restore',backup);assert(doc.querySelector('#dataRestoreDialog').open,'Restore preview opens');doc.querySelector('#cancelDataRestore').click();assert(entries()===before,'Cancellation unchanged');
        await chooseFile('restore',backup);const acknowledge=doc.querySelector('#dataRestoreConfirm');acknowledge.checked=true;event(acknowledge,'change');doc.querySelector('#confirmDataRestore').click();
        assert(doc.querySelector('#seatingApplication').disabled,'Confirmed restore pauses old workspace');assert(localStorage.getItem('workspace-unrelated')==='preserved','Unrelated storage retained');
      });
      await test('help is modal and rejected fullscreen does not fake presentation or change data',async()=>{
        await open();const before=entries();doc.querySelector('#openSeatingHelp').click();assert(doc.querySelector('#seatingHelp').open,'Help modal opens');doc.querySelector('#closeSeatingHelp').click();
        const room=doc.querySelector('#classroom');doc.documentElement.requestFullscreen=()=>Promise.reject(Error('Synthetic rejection'));doc.querySelector('#workspaceFullscreenBtn').click();await pause();
        assert(!room.classList.contains('fullscreen-classroom'),'Rejected fullscreen stays in workspace');assert(!doc.querySelector('#workspaceNotice').hidden,'Failure explained');assert(entries()===before,'Help and failed fullscreen do not save');
      });
      await test('zoom 10–200% changes presentation only, preserves center and resets predictably',async()=>{
        await open();const before=entries();const table=doc.querySelector('.table'),viewport=doc.querySelector('#workspaceViewport');
        for(const value of [50,150,10,200,100]){
          await zoomTo(value);
          assert(Math.abs(table.getBoundingClientRect().width-300*value/100)<1,'Visual table width at '+value);
          assert(table.style.width==='300px'&&table.style.left==='32px','Logical geometry unchanged');
          assert(entries()===before,'Zoom never writes classroom data');
        }
        await zoomTo(200);assert(doc.querySelector('#zoomIn').disabled,'Upper bound');
        viewport.scrollLeft=300;viewport.scrollTop=100;
        const center=(viewport.scrollLeft+viewport.clientWidth/2)/2;
        doc.querySelector('#zoomOut').click();
        assert(Math.abs((viewport.scrollLeft+viewport.clientWidth/2)/1.9-center)<1,'Visible center is retained');
        await zoomTo(10);assert(doc.querySelector('#zoomOut').disabled,'Lower bound');
        doc.querySelector('#resetZoom').click();assert(viewport.scrollLeft===0&&viewport.scrollTop===0,'Reset starts room at 100%');
      });
      await test('Fit to Room uses actual table bounds on mobile without page overflow',async()=>{
        await open(390,844);const before=entries();doc.querySelector('#fitRoom').click();await pause();
        const view=doc.querySelector('#workspaceViewport').getBoundingClientRect();
        doc.querySelectorAll('.table').forEach(table=>{const r=table.getBoundingClientRect();assert(r.left>=view.left-1&&r.right<=view.right+1&&r.top>=view.top-1&&r.bottom<=view.bottom+1,'Content fits viewport');});
        assert(percent()<100&&percent()>=10,'Fit zoom calculated');assert(doc.documentElement.scrollWidth===390,'No page overflow');assert(entries()===before,'Fit never saves');
        await zoomTo(200);assert(doc.documentElement.scrollWidth===390,'Maximum zoom stays inside mobile scrollport');
        doc.querySelectorAll('.table').forEach(table=>{table.style.left=(Number.parseFloat(table.style.left)+4000)+'px';table.style.top='2032px';});await pause();
        doc.querySelector('#fitRoom').click();await pause();assert(percent()>=30,'Far-from-origin room fits content rather than blank origin');
        doc.querySelectorAll('.table').forEach(table=>{const r=table.getBoundingClientRect();assert(r.left>=view.left-1&&r.right<=view.right+1&&r.top>=view.top-1&&r.bottom<=view.bottom+1,'Far room centered in viewport');});
        assert(entries()===before,'Fitting a far room never writes');
      });
      for(const scale of [.5,1.5])await test('scrolled drag and resize at '+scale+'x use logical coordinates and preserve assignments',async()=>{
        await open(1024,768);await zoomTo(scale*100);
        const viewport=doc.querySelector('#workspaceViewport');viewport.scrollLeft=120;viewport.scrollTop=40;
        const table=doc.querySelectorAll('.table')[1],r=table.getBoundingClientRect();
        table.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true,clientX:r.left+10*scale,clientY:r.top+5*scale}));
        doc.dispatchEvent(new win.MouseEvent('mousemove',{bubbles:true,clientX:r.left+80*scale,clientY:r.top+55*scale}));doc.dispatchEvent(new win.MouseEvent('mouseup',{bubbles:true}));
        assert(Math.abs(Number.parseFloat(table.style.left)-440)<.1&&Math.abs(Number.parseFloat(table.style.top)-82)<.1,'Inverse-scale drag delta');
        const handle=table.querySelector('.table-resize-handle'),h=handle.getBoundingClientRect();
        handle.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true,clientX:h.left,clientY:h.top}));
        doc.dispatchEvent(new win.MouseEvent('mousemove',{bubbles:true,clientX:h.left+40*scale,clientY:h.top+30*scale}));doc.dispatchEvent(new win.MouseEvent('mouseup',{bubbles:true}));
        assert(Math.abs(Number.parseFloat(table.style.width)-340)<.1&&Math.abs(Number.parseFloat(table.style.height)-330)<.1,'Inverse-scale resize delta');
        const data=JSON.parse(localStorage.getItem('seatingChartData_default'));assert(JSON.stringify(data.tables[1].seats)===JSON.stringify(people.slice(4,8)),'Assignments retained');
      });
      await test('seat hit testing and assignment remain correct at 50% and 150%',async()=>{
        for(const value of [50,150]){
          await open();await zoomTo(value);const viewport=doc.querySelector('#workspaceViewport');viewport.scrollLeft=viewport.scrollTop=0;
          const seat=doc.querySelectorAll('.seat')[1],r=seat.getBoundingClientRect();
          const hit=doc.elementFromPoint(r.left+r.width/2,r.top+r.height/2);assert(hit?.closest('.seat')===seat,'Browser hit test at '+value);
          win.prompt=()=> 'Zoom Synthetic';hit.dispatchEvent(new win.MouseEvent('click',{bubbles:true,detail:1}));
          assert(seat.dataset.studentName==='Zoom Synthetic','Original assignment handler at '+value);
        }
      });
      await test('Pan mode moves the viewport without moving tables or assigning seats',async()=>{
        await open(768,1024);await zoomTo(150);const before=entries();const viewport=doc.querySelector('#workspaceViewport');viewport.scrollLeft=100;
        doc.querySelector('#panRoom').click();const seat=doc.querySelector('.seat'),r=seat.getBoundingClientRect();let prompts=0;win.prompt=()=>{prompts++;return null;};
        seat.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true,clientX:r.left+20,clientY:r.top+20}));
        doc.dispatchEvent(new win.MouseEvent('mousemove',{bubbles:true,clientX:r.left-80,clientY:r.top-20}));doc.dispatchEvent(new win.MouseEvent('mouseup',{bubbles:true}));
        seat.dispatchEvent(new win.MouseEvent('click',{bubbles:true,detail:1}));
        assert(viewport.scrollLeft===200,'Pan uses screen-pixel scrolling');assert(prompts===0&&entries()===before,'Pan never edits');
        doc.querySelector('#panRoom').click();assert(doc.querySelector('#panRoom').getAttribute('aria-pressed')==='false','Pan exits accessibly');
      });
      await test('class and layout switching automatically fit and reset scroll; empty rooms fit at 100%',async()=>{
        await open();await zoomTo(150);const viewport=doc.querySelector('#workspaceViewport');viewport.scrollLeft=120;
        const classes=doc.querySelector('#classSelector');classes.value='Science';event(classes,'change');await pause();assert(doc.querySelector('#fitRoom').getAttribute('aria-pressed')==='true'&&viewport.scrollLeft===0,'Class switch fits');
        doc.querySelector('#fitRoom').click();await pause();const grid=doc.querySelector('.seating-grid'),g=grid.getBoundingClientRect(),v=viewport.getBoundingClientRect();assert(g.width<=v.width+1&&g.height<=v.height+1,'Grid fit');
        await zoomTo(150);const layout=doc.querySelector('#layoutSelector');layout.value='Three tables';event(layout,'change');await pause();assert(doc.querySelector('#fitRoom').getAttribute('aria-pressed')==='true'&&viewport.scrollTop===0,'Layout switch fits');
        await open(390,844,true);const before=entries();doc.querySelector('#fitRoom').click();await pause();assert(percent()===100,'Empty room has useful default zoom');assert(doc.querySelector('#viewStatus').textContent.includes('empty'),'Empty guidance');assert(entries()===before,'Empty fit no writes');
      });
      await test('view keys and panel Done/Escape restore keyboard focus; controls stay usable when zoomed',async()=>{
        await open(320,740);const viewport=doc.querySelector('#workspaceViewport');viewport.focus();
        viewport.dispatchEvent(new win.KeyboardEvent('keydown',{key:'-',bubbles:true}));assert(percent()===90,'Workspace minus shortcut');
        viewport.dispatchEvent(new win.KeyboardEvent('keydown',{key:'0',bubbles:true}));assert(percent()===100,'Workspace reset shortcut');
        viewport.dispatchEvent(new win.KeyboardEvent('keydown',{key:'+',ctrlKey:true,bubbles:true}));assert(percent()===100,'Browser modified shortcuts untouched');
        const settings=doc.querySelector('#layoutSettings');settings.open=true;await pause();settings.querySelector('.sc-close-panel').click();assert(doc.activeElement===settings.querySelector('summary'),'Done returns to summary');
        await zoomTo(50);viewport.scrollLeft=0;const detail=doc.querySelector('.sc-table-settings');detail.open=true;await pause();
        const panel=detail.querySelector('.sc-table-popover').getBoundingClientRect();assert(Math.abs(panel.width-240)<1,'Settings remain normal size at 50%');
        assert(panel.left>=viewport.getBoundingClientRect().left-1,'Settings remain in view');
        assert(panel.bottom<=viewport.getBoundingClientRect().bottom+1,'Short-screen settings scroll internally instead of clipping actions');
        detail.querySelector('input').focus();doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(doc.activeElement===detail.querySelector('summary'),'Escape restores table summary focus');
        assert(doc.documentElement.scrollWidth===320,'No mobile page overflow');
      });
      // These are synthetic Pointer Events, not physical touches or trusted browser
      // touch injection. Capture rejection falls back to document-level tracking.
      for(const [value,width,height] of [[34,390,844],[73,768,1024],[100,1024,768],[150,1024,768]])await test('emulated touch move/resize at '+value+'% saves logical geometry and survives reload',async()=>{
        await touchView(value,width,height);const scale=value/100;
        const viewport=doc.querySelector('#workspaceViewport');viewport.scrollLeft=80;viewport.scrollTop=20;
        const table=doc.querySelectorAll('.table')[1],move=table.querySelector('.sc-touch-move'),r=move.getBoundingClientRect();
        assert(r.width>=43&&r.height>=43,'Move target stays touch sized');const id=++pointerId;
        pointer(move,'pointerdown',id,r.left+10,r.top+10);
        assert(doc.querySelector('#zoomIn').disabled,'View locked during gesture');
        pointer(doc,'pointermove',id,r.left+10+70*scale,r.top+10+50*scale);
        pointer(doc,'pointerup',id,r.left+10+70*scale,r.top+10+50*scale);
        assert(table.style.left==='440px'&&table.style.top==='82px','Touch delta converted to logical pixels');
        const resize=table.querySelector('.table-resize-handle'),corner=resize.getBoundingClientRect();assert(corner.width>=43&&corner.height>=43,'Resize target stays touch sized');
        const sizeId=++pointerId;pointer(resize,'pointerdown',sizeId,corner.left+10,corner.top+10);
        pointer(doc,'pointermove',sizeId,corner.left+10+40*scale,corner.top+10+30*scale);pointer(doc,'pointerup',sizeId,corner.left+10+40*scale,corner.top+10+30*scale);
        assert(table.style.width==='340px'&&table.style.height==='330px','Touch resize preserves logical dimensions');
        const data=JSON.parse(localStorage.getItem('seatingChartData_default'));assert(JSON.stringify(data.tables[1].seats)===JSON.stringify(people.slice(4,8)),'Touch editing preserves assignments');
        doc.querySelector('#editTables').click();frame.contentWindow.location.reload();await new Promise(resolve=>frame.onload=resolve);await pause();
        win=frame.contentWindow;doc=frame.contentDocument;await pause();
        const restored=doc.querySelectorAll('.table')[1];assert(restored.style.left==='440px'&&restored.style.width==='340px','Geometry survives actual reload');
        assert(doc.querySelector('#editTables').getAttribute('aria-pressed')==='false','Editing mode never persists');
      });
      await test('touch cancellation, lost capture, second pointer, blur and Escape roll back without writes',async()=>{
        for(const reason of ['pointercancel','lostpointercapture','second','blur','viewport','escape']){
          await touchView(100,1024,768);const before=entries();const table=doc.querySelector('.table'),handle=table.querySelector('.sc-touch-move'),r=handle.getBoundingClientRect(),id=++pointerId;
          pointer(handle,'pointerdown',id,r.left+10,r.top+10);pointer(doc,'pointermove',id,r.left+80,r.top+60);
          if(reason==='second')pointer(doc.body,'pointerdown',id+1,100,100,{isPrimary:false});
          else if(reason==='blur')win.dispatchEvent(new win.Event('blur'));
          else if(reason==='viewport')win.dispatchEvent(new win.Event('resize'));
          else if(reason==='escape')win.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
          else pointer(reason==='lostpointercapture'?handle:doc,reason,id,r.left+80,r.top+60);
          pointer(doc,'pointerup',id,r.left+80,r.top+60);
          assert(table.style.left==='32px'&&table.style.top==='32px','Cancelled DOM restored: '+reason);assert(entries()===before,'Cancelled edits never write: '+reason);
        }
      });
      await test('normal touch selects seats; compatibility mouse events cannot drag; Edit mode never assigns seats',async()=>{
        await open(390,844);await zoomTo(100);const seat=doc.querySelectorAll('.seat')[1],r=seat.getBoundingClientRect();let prompts=0;win.prompt=()=>{prompts++;return 'Touch assignment';};
        const id=++pointerId;pointer(seat,'pointerdown',id,r.left+5,r.top+5);pointer(doc,'pointerup',id,r.left+5,r.top+5);
        seat.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true,clientX:r.left+5,clientY:r.top+5}));doc.dispatchEvent(new win.MouseEvent('mousemove',{bubbles:true,clientX:r.left+80,clientY:r.top+80}));doc.dispatchEvent(new win.MouseEvent('mouseup',{bubbles:true}));
        seat.dispatchEvent(new win.MouseEvent('click',{bubbles:true,detail:1}));assert(prompts===1&&seat.dataset.studentName==='Touch assignment','Normal touch seat assignment');assert(doc.querySelector('.table').style.left==='32px','Compatibility mouse does not move table');
        doc.querySelector('#editTables').click();seat.dispatchEvent(new win.MouseEvent('click',{bubbles:true,detail:1}));assert(prompts===1,'Editing disables seat assignment');
      });
      await test('Pan and Edit are exclusive; settings and keyboard geometry remain accessible',async()=>{
        await touchView(34,390,844);doc.querySelector('#panRoom').click();assert(doc.querySelector('#editTables').getAttribute('aria-pressed')==='false','Pan leaves Edit');
        doc.querySelector('#editTables').click();assert(doc.querySelector('#panRoom').getAttribute('aria-pressed')==='false','Edit leaves Pan');
        const table=doc.querySelector('.table');table.querySelector('.sc-touch-settings').click();await pause();assert(table.querySelector('.sc-table-settings').open,'Settings reachable in Edit mode');
        const section=table.querySelector('.sc-geometry-settings');section.open=true;await pause();
        section.querySelector('[data-geometry=left]').value='70';section.querySelector('[data-geometry=top]').value='80';section.querySelector('[data-geometry=width]').value='320';section.querySelector('[data-geometry=height]').value='310';
        section.querySelector('button').click();assert(table.style.left==='70px'&&table.style.width==='320px','Keyboard/form alternative applies geometry');
        assert(JSON.parse(localStorage.getItem('seatingChartData_default')).tables[0].posX===70,'Numeric geometry uses existing persistence');
        const panel=table.querySelector('.sc-table-popover').getBoundingClientRect();assert(panel.width>=230,'Settings remain normal size');
      });
      await test('mouse header drag and resize still work immediately after touch editing',async()=>{
        await touchView(100,1024,768);const table=doc.querySelector('.table'),handle=table.querySelector('.sc-touch-move'),r=handle.getBoundingClientRect(),id=++pointerId;
        pointer(handle,'pointerdown',id,r.left+10,r.top+10);pointer(doc,'pointermove',id,r.left+50,r.top+30);pointer(doc,'pointerup',id,r.left+50,r.top+30);doc.querySelector('#editTables').click();
        const t=table.getBoundingClientRect();pointer(table,'pointerdown',++pointerId,t.left+10,t.top+5,{pointerType:'mouse'});
        table.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true,clientX:t.left+10,clientY:t.top+5}));doc.dispatchEvent(new win.MouseEvent('mousemove',{bubbles:true,clientX:t.left+30,clientY:t.top+15}));doc.dispatchEvent(new win.MouseEvent('mouseup',{bubbles:true}));
        assert(table.style.left==='92px'&&table.style.top==='62px','Legacy mouse drag after touch');
        const resize=table.querySelector('.table-resize-handle');resize.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true,clientX:500,clientY:400}));doc.dispatchEvent(new win.MouseEvent('mousemove',{bubbles:true,clientX:520,clientY:420}));doc.dispatchEvent(new win.MouseEvent('mouseup',{bubbles:true}));
        assert(table.style.width==='320px'&&table.style.height==='320px','Legacy mouse resize after touch');
      });
      await test('class/layout changes cancel pending touch edits before save and exit editing mode',async()=>{
        for(const target of ['class','layout']){
          await touchView(100,1024,768);const table=doc.querySelector('.table'),handle=table.querySelector('.sc-touch-move'),r=handle.getBoundingClientRect(),id=++pointerId;
          pointer(handle,'pointerdown',id,r.left+10,r.top+10);pointer(doc,'pointermove',id,r.left+100,r.top+60);
          const select=doc.querySelector(target==='class'?'#classSelector':'#layoutSelector');select.value=target==='class'?'Science':'Three tables';event(select,'change');await pause();pointer(doc,'pointerup',id,r.left+100,r.top+60);
          assert(doc.querySelector('#editTables').getAttribute('aria-pressed')==='false','Switch exits Edit');
          const saved=JSON.parse(localStorage.getItem('seatingChartData_default'));assert(saved.tables[0].posX===32&&saved.tables[0].posY===32,'Pending geometry not saved during switch');
        }
      });
      await test('touch bounds, zero coordinates, minimum dimensions and final lift position are preserved',async()=>{
        await touchView(150,1024,768);const table=doc.querySelector('.table'),move=table.querySelector('.sc-touch-move'),r=move.getBoundingClientRect(),id=++pointerId;
        pointer(move,'pointerdown',id,r.left+10,r.top+10);pointer(doc,'pointerup',id,-10000,-10000);
        assert(table.style.left==='0px'&&table.style.top==='0px','Lift position commits within zero boundary');
        const resize=table.querySelector('.table-resize-handle'),corner=resize.getBoundingClientRect(),sizeId=++pointerId;
        pointer(resize,'pointerdown',sizeId,corner.left+10,corner.top+10);pointer(doc,'pointerup',sizeId,-10000,-10000);
        assert(table.style.width==='220px'&&table.style.height==='220px','Original minimum size retained');
        const saved=JSON.parse(localStorage.getItem('seatingChartData_default')).tables[0];assert(saved.posX===0&&saved.posY===0&&saved.width===220,'Zero and minimum geometry saved');
      });
      await test('settings, randomize and backup pause cannot save an unfinished touch gesture',async()=>{
        for(const reason of ['settings','randomize','pause']){
          await touchView(100,1024,768);const before=entries(),table=doc.querySelector('.table'),handle=table.querySelector('.sc-touch-move'),r=handle.getBoundingClientRect(),id=++pointerId;
          pointer(handle,'pointerdown',id,r.left+10,r.top+10);pointer(doc,'pointermove',id,r.left+100,r.top+60);
          win.dispatchEvent(new win.KeyboardEvent('keydown',{key:'r',bubbles:true,cancelable:true}));assert(entries()===before,'R cannot save while finger is down');
          if(reason==='settings'){const color=table.querySelector('.seat-color');color.value='pink';event(color,'change');}
          else if(reason==='randomize')doc.querySelector('#randomizeSeatingBtn').click();
          else {doc.querySelector('#seatingApplication').disabled=true;await pause();}
          pointer(doc,'pointerup',id,r.left+100,r.top+60);
          const saved=JSON.parse(localStorage.getItem('seatingChartData_default')).tables[0];assert(saved.posX===32&&saved.posY===32,'Interrupted geometry never saved: '+reason);
          if(reason==='pause')assert(entries()===before,'Backup gate does not trigger touch save');
        }
      });
      await test('failed touch save preserves the stored record and rolls back visible geometry',async()=>{
        await touchView(100,1024,768);const before=entries(),table=doc.querySelector('.table'),handle=table.querySelector('.sc-touch-move'),r=handle.getBoundingClientRect(),id=++pointerId;
        const original=win.Storage.prototype.setItem;win.Storage.prototype.setItem=()=>{throw new win.DOMException('Synthetic full storage','QuotaExceededError');};
        pointer(handle,'pointerdown',id,r.left+10,r.top+10);pointer(doc,'pointermove',id,r.left+100,r.top+60);pointer(doc,'pointerup',id,r.left+100,r.top+60);
        win.Storage.prototype.setItem=original;await pause();
        assert(entries()===before,'Failed save never replaces raw values');assert(table.style.left==='32px'&&table.style.top==='32px','Visible geometry rolled back');
        assert(doc.querySelector('#seatingApplication').disabled&&!doc.querySelector('#dataProtectionError').hidden,'Existing backup gate explains failure');
      });
      output.textContent+='\nCOMPLETE — '+(output.textContent.includes('FAIL')?'failures above':'all tests passed')+'.';
    }catch(error){output.textContent+='\nHARNESS ERROR: '+error.message;}finally{document.getElementById('run').disabled=false;}
  });
})();
