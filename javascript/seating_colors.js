/* Table appearance adapter. The existing seatColor string and save pipeline are retained. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),math=window.SeatingColorMath,dialog=$('tableColorDialog');
  const wheel=$('tableHueWheel'),saturation=$('tableSaturation'),brightness=$('tableBrightness'),hex=$('tableColorHex'),error=$('tableColorError'),apply=$('applyTableColor');
  const legacy={gray:'#304056',blue:'#263e61',purple:'#42365b',green:'#24433d',pink:'#52334e',red:'#57323d',orange:'#5b4230',yellow:'#514b2c',lightblue:'#294753','#ff06ff':'#523354'};
  const cache=new Map(),ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
  let active=null,original=null,launcher=null,draft='gray',hsv={h:0,s:0,v:0},pointer=null,committed=false;
  function resolve(value){
    if(legacy[value])return legacy[value];if(cache.has(value))return cache.get(value);
    let result=math.hex(value);
    if(!result&&CSS.supports('color',value)){
      ctx.fillStyle='#1b2638';ctx.fillRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);
      result='#'+[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');
    }
    result=result||legacy.gray;cache.set(value,result);return result;
  }
  function paint(table,value){
    const surface=resolve(value),ink=math.foreground(surface);
    if(table.dataset.colorSurface===surface)return;
    table.dataset.colorSurface=surface;
    table.style.setProperty('--sc-table-surface',surface);table.style.setProperty('--sc-seat-ink',ink);
  }
  function allowed(){return active?.isConnected&&!$('seatingApplication').disabled&&!$('seatingApplication').inert&&!window.SeatingViewport?.isDisplaying();}
  function fail(text){error.textContent=text;error.hidden=!text;apply.disabled=!!text||!allowed();}
  function render(){
    const surface=resolve(draft),ink=math.foreground(surface),angle=hsv.h*Math.PI/180;
    wheel.setAttribute('aria-valuenow',String(Math.round(hsv.h)%360));wheel.setAttribute('aria-valuetext',Math.round(hsv.h)%360+' degrees');
    wheel.style.setProperty('--hue-x',(50+Math.sin(angle)*42)+'%');wheel.style.setProperty('--hue-y',(50-Math.cos(angle)*42)+'%');
    saturation.value=Math.round(hsv.s);brightness.value=Math.round(hsv.v);
    $('saturationValue').value=saturation.value+'%';$('brightnessValue').value=brightness.value+'%';
    saturation.style.background=`linear-gradient(to right,#fff,${math.hsvToHex(hsv.h,100,100)})`;
    brightness.style.background=`linear-gradient(to right,#000,${math.hsvToHex(hsv.h,hsv.s,100)})`;
    $('tableColorPreview').style.backgroundColor=surface;$('tableColorPreview').style.color=ink;
    if(document.activeElement!==hex)hex.value=surface;
    dialog.querySelectorAll('[data-color-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.colorPreset===surface)));
    if(active?.isConnected)paint(active,draft);fail('');
  }
  function choose(value){draft=value;hsv=math.hexToHsv(resolve(value));render();}
  function change(){draft=math.hsvToHex(hsv.h,hsv.s,hsv.v);render();}
  function cancel(){if(dialog.open)dialog.close();}
  function open(table,button){
    if($('seatingApplication').disabled||window.SeatingViewport?.isDisplaying())return;
    active=table;original=table.querySelector('.seat-color').value;launcher=button;committed=false;
    $('tableColorTitle').textContent='Table color · '+(table.querySelector('.table-name-input').value||'Untitled table');
    dialog.showModal();choose(original);wheel.focus();
  }
  // Keep classroom shortcuts out of the modal while native slider keys still work.
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{
    if(!committed&&active?.isConnected)paint(active,original);
    pointer=null;const focus=launcher?.closest('.sc-table-settings');active=null;original=null;
    if(focus?.isConnected)focus.querySelector('summary').focus({preventScroll:true});
  });
  $('cancelTableColor').addEventListener('click',cancel);
  $('defaultTableColor').addEventListener('click',()=>choose('gray'));
  apply.addEventListener('click',()=>{
    if(!allowed()){fail('This classroom is paused or the table has changed. Cancel and reopen its settings.');return;}
    const select=active.querySelector('.seat-color'),before=select.value;
    if(![...select.options].some(o=>o.value===draft)){const option=document.createElement('option');option.value=draft;option.textContent='Custom color';select.append(option);}
    select.value=draft;
    try{window.saveTables();committed=true;paint(active,draft);dialog.close();}
    catch(_){select.value=before;paint(active,before);fail('The color could not be saved. Your previous color is kept. Check Backup & Restore.');}
  });
  saturation.addEventListener('input',()=>{hsv.s=Number(saturation.value);change();});
  brightness.addEventListener('input',()=>{hsv.v=Number(brightness.value);change();});
  hex.addEventListener('input',()=>{const value=math.hex(hex.value);if(value)choose(value);else fail('Use a hex color such as #4388F5, or choose a color visually.');});
  wheel.addEventListener('keydown',event=>{
    const step=event.shiftKey?10:1,delta={ArrowRight:step,ArrowUp:step,ArrowLeft:-step,ArrowDown:-step,PageUp:10,PageDown:-10};
    if(event.key in delta||['Home','End'].includes(event.key)){
      event.preventDefault();hsv.h=event.key==='Home'?0:event.key==='End'?359:(hsv.h+delta[event.key]+360)%360;change();
    }
  });
  function move(event){
    const rect=wheel.getBoundingClientRect(),dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2);
    if(Math.hypot(dx,dy)<rect.width*.12)return;
    hsv.h=(Math.atan2(dx,-dy)*180/Math.PI+360)%360;change();
  }
  wheel.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;event.preventDefault();pointer=event.pointerId;
    try{wheel.setPointerCapture(pointer);}catch(_){}move(event);
  });
  wheel.addEventListener('pointermove',event=>{if(event.pointerId===pointer){event.preventDefault();move(event);}});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])wheel.addEventListener(name,()=>{pointer=null;});
  const presets={Navy:'#304056',Blue:'#4388f5',Teal:'#21b8a6',Purple:'#9a77ec',Amber:'#f4bd50',Rose:'#e77ca0',White:'#f2f6fc',Charcoal:'#18202c'};
  for(const [name,value] of Object.entries(presets)){
    const button=document.createElement('button');button.type='button';button.dataset.colorPreset=value;button.setAttribute('aria-label',name+' table color');button.title=name;button.style.setProperty('--preset',value);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>choose(value));$('tableColorPresets').append(button);
  }
  document.addEventListener('change',event=>{if(dialog.open&&event.target.matches('#classSelector,#layoutSelector,#layoutModeSelect'))cancel();},true);
  document.addEventListener('seating-presentation-change',cancel);
  new MutationObserver(()=>{if(dialog.open&&!allowed())cancel();}).observe($('seatingApplication'),{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','inert']});
  window.SeatingColors=Object.freeze({open,cancel,resolve,enhance:table=>paint(table,dialog.open&&active===table?draft:table.querySelector('.seat-color').value)});
})();
