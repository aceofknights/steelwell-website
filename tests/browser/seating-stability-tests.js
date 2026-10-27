(function () {
  'use strict';
  const output=document.querySelector('#results'), frame=document.querySelector('#app'), run=document.querySelector('#run');
  const sweep=document.querySelector('#sweep'), preview=document.querySelector('#seed'), fractional=document.querySelector('#fractional');
  if(location.origin!=='http://127.0.0.1:8873'){run.disabled=sweep.disabled=preview.disabled=fractional.disabled=true;output.textContent='Dedicated test origin required.';return;}
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let cases=0,failures=0;
  const finish=()=>{output.textContent+=`\nDONE: ${cases-failures}/${cases} passed`;};
  const people=Array.from({length:30},(_,i)=>i===0?'Alexandria Josephine Montgomery-Worthington':i===1?'李明 Rodríguez O’Connor-Smith':`Synthetic Student ${i+1}`);
  function seed(){
    window.SeatingBackup.readEntries(localStorage).forEach(e=>localStorage.removeItem(e.key));localStorage.removeItem(window.SeatingBackup.JOURNAL_KEY);
    const base={manualStudentNames:people,studentsData:Object.fromEntries(people.map(name=>[name,{present:true,lockedSeat:null,lockedTable:null,blacklist:[]}])),studentGroups:[],useGroupAlternating:false,gridSettings:{rows:8,columns:6,aisles:[],rowGap:8,columnGap:8}};
    const grid={...base,tables:[],layoutMode:'grid',gridSeats:people.map((studentName,i)=>({row:Math.floor(i/6)+1,column:i%6+1,studentName,isAisle:false}))};
    const tables=Array.from({length:6},(_,i)=>({id:`synthetic-${i}`,tableName:`Table ${i+1}`,seatCount:5,columnCount:2,seatColor:'blue',posX:32+(i%3)*340,posY:32+Math.floor(i/3)*360,width:300,height:320,seats:people.slice(i*5,i*5+5)}));
    localStorage.setItem('classList',JSON.stringify(['default','Tables']));localStorage.setItem('seatingChartData_default',JSON.stringify(grid));localStorage.setItem('seatingChartData_Tables',JSON.stringify({...base,tables,layoutMode:'table',gridSeats:[]}));
  }
  preview.addEventListener('click',()=>{seed();output.textContent='Prepared 30 synthetic students. Open the full-page classroom for visual review.';});
  async function sample(win,doc,label){
    await doc.fonts.ready;await pause(300);
    const room=doc.querySelector('#classroom'),viewport=doc.querySelector('#workspaceViewport');
    let fits=0,children=0,styles=0,resizes=0;
    const original=win.fitAllGridSeatNames;win.fitAllGridSeatNames=function(){fits++;return original.apply(this,arguments);};
    const mutation=new win.MutationObserver(records=>records.forEach(r=>{if(r.type==='childList')children++;else styles++;}));
    mutation.observe(room,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
    const resize=new win.ResizeObserver(()=>resizes++);resize.observe(viewport);
    const seats=[...room.querySelectorAll('.seat')], samples=[];
    if(seats.length<23)throw Error('Fixture did not load at least 23 seats');
    const start=win.performance.now();
    await new Promise(resolve=>{
      function tick(){
        samples.push({time:win.performance.now()-start,scroll:[viewport.scrollLeft,viewport.scrollTop],view:[viewport.clientWidth,viewport.clientHeight],seats:seats.map(s=>{const r=s.getBoundingClientRect();return [r.x,r.y,r.width,r.height,parseFloat(win.getComputedStyle(s.querySelector('.grid-seat-name')||s).fontSize)];})});
        if(win.performance.now()-start<3000)win.requestAnimationFrame(tick);else resolve();
      }win.requestAnimationFrame(tick);
    });
    mutation.disconnect();resize.disconnect();win.fitAllGridSeatNames=original;
    const first=samples[0],maxDelta=[0,0,0,0,0];let scrollDelta=0;
    for(const s of samples){s.seats.forEach((rect,i)=>rect.forEach((n,j)=>maxDelta[j]=Math.max(maxDelta[j],Math.abs(n-first.seats[i][j]))));scrollDelta=Math.max(scrollDelta,...s.scroll.map((n,i)=>Math.abs(n-first.scroll[i])));}
    const identities=seats.every((s,i)=>s===room.querySelectorAll('.seat')[i]);
    const fullNames=[...room.querySelectorAll('.grid-seat')].filter(s=>people.slice(0,2).includes(s.dataset.studentName)).map(s=>{
      const name=s.querySelector('.grid-seat-name');
      return {name:s.dataset.studentName,fullTitle:s.title===s.dataset.studentName,fullAccessibleName:s.getAttribute('aria-label').includes(s.dataset.studentName),width:name.scrollWidth,height:name.scrollHeight,available:[s.clientWidth-14,s.clientHeight-14]};
    });
    const result={label,frames:samples.length,duration:Math.round(samples.at(-1).time),maxDelta,scrollDelta,identities,fits,children,styles,resizes,first:first.seats[0],last:samples.at(-1).seats[0],viewSizes:[...new Set(samples.map(s=>s.view.join('x')))],scrollbars:[viewport.scrollWidth>viewport.clientWidth,viewport.scrollHeight>viewport.clientHeight],fullNames};
    // A quarter CSS pixel permits subpixel rounding, but rejects a visible pixel jump.
    result.pass=samples.length>=30&&result.duration>=3000&&maxDelta.every(n=>n<=.25)&&scrollDelta<=.25&&identities&&fits<=2&&children===0&&styles===0&&resizes<=2&&result.viewSizes.length===1&&fullNames.every(n=>n.fullTitle&&n.fullAccessibleName&&n.width<=n.available[0]&&n.height<=n.available[1]);
    cases++;if(!result.pass)failures++;
    output.textContent+='\n'+JSON.stringify(result);
  }
  sweep.addEventListener('click',()=>{run.dataset.sweep='true';run.click();});
  fractional.addEventListener('click',()=>{run.dataset.fractional='true';run.click();});
  run.addEventListener('click',async()=>{
    run.disabled=sweep.disabled=preview.disabled=fractional.disabled=true;cases=failures=0;output.textContent='Running…';
    try{
      frame.style.width='1100px';frame.style.height='850px';
      frame.removeAttribute('srcdoc');
      await new Promise(resolve=>{frame.onload=resolve;frame.src='about:blank';});seed();
      await window.loadSyntheticSeatingPage(frame);
      const win=frame.contentWindow,doc=frame.contentDocument;
      for(let i=0;i<100&&doc.querySelector('#seatingApplication').disabled;i++)await pause(50);
      if(doc.querySelector('#seatingApplication').disabled)throw Error('Application did not initialize');
      if(run.dataset.fractional==='true'){
        frame.style.width='2400px';frame.style.height='1600px';
        const viewport=doc.querySelector('#workspaceViewport');
        // CSS zoom emulates the affected device-pixel rounding in an isolated fixture.
        // A fractional width alone at DPR 1 does not reproduce Chrome's 80% behavior.
        doc.documentElement.style.zoom='.8';
        viewport.style.cssText='flex:none;width:2034.00390625px;height:932.578125px;border-width:1.25px';
        for(const mode of ['Grid','Table']){
          if(mode==='Table'){const select=doc.querySelector('#classSelector');select.value='Tables';select.dispatchEvent(new win.Event('change',{bubbles:true}));}
          for(const zoom of ['100','Fit','150']){
            doc.querySelector('#resetZoom').click();if(zoom==='Fit')doc.querySelector('#fitRoom').click();
            if(zoom==='150')for(let i=0;i<5;i++)doc.querySelector('#zoomIn').click();
            await sample(win,doc,`Fractional/${mode}/${zoom}`);
          }
        }
        finish();return;
      }
      if(run.dataset.sweep==='true'){
        for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[1280,960],[1360,960],[1440,960],[1920,1080]]){
          frame.style.width=width+'px';frame.style.height=height+'px';await pause(100);
          if(doc.querySelector('#studentListContainer').classList.contains('hidden'))doc.querySelector('#toggleStudentListBtn').click();
          for(const zoom of ['100','Fit']){
            doc.querySelector('#resetZoom').click();if(zoom==='Fit')doc.querySelector('#fitRoom').click();
            await sample(win,doc,`Grid/open/${width}x${height}/${zoom}`);
          }
        }
        finish();return;
      }
      for(const mode of ['Grid','Table']){
        if(mode==='Table'){const select=doc.querySelector('#classSelector');select.value='Tables';select.dispatchEvent(new win.Event('change',{bubbles:true}));await pause(100);}
        for(const sidebar of ['open','closed']){
          const side=doc.querySelector('#studentListContainer');if(side.classList.contains('hidden')===(sidebar==='open'))doc.querySelector('#toggleStudentListBtn').click();
          for(const zoom of ['100','Fit','150']){
            doc.querySelector('#resetZoom').click();if(zoom==='Fit')doc.querySelector('#fitRoom').click();if(zoom==='150')for(let i=0;i<5;i++)doc.querySelector('#zoomIn').click();
            for(const randomized of [false,true]){
              if(randomized)doc.querySelector('#randomizeSeatingBtn').click();
              const viewport=doc.querySelector('#workspaceViewport');viewport.scrollLeft=randomized?130:0;viewport.scrollTop=randomized?70:0;
              await sample(win,doc,`${mode}/${sidebar}/${zoom}/${randomized?'randomized-scrolled':'idle'}`);
            }
          }
        }
      }
      finish();
    }catch(error){output.textContent+='\nERROR '+error.stack;}finally{run.disabled=sweep.disabled=preview.disabled=fractional.disabled=false;delete run.dataset.sweep;delete run.dataset.fractional;}
  });
})();
