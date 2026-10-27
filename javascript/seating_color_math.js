/* Pure opaque-color conversion and WCAG relative luminance. No classroom state. */
(function (root,factory) {
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SeatingColorMath=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  function hex(value){
    const match=String(value).trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if(!match)return null;
    return '#'+(match[1].length===3?[...match[1]].map(c=>c+c).join(''):match[1]).toLowerCase();
  }
  function rgb(value){const h=hex(value);return h?[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)):null;}
  function hsvToHex(h,s,v){
    h=((Number(h)||0)%360+360)%360;s=clamp(s)/100;v=clamp(v)/100;
    const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c;
    const channels=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return '#'+channels.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
  }
  function hexToHsv(value){
    const channels=rgb(value);if(!channels)return null;
    const [r,g,b]=channels.map(n=>n/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    let h=0;if(d)h=max===r?60*((g-b)/d%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);
    return {h:(h+360)%360,s:max?d/max*100:0,v:max*100};
  }
  function luminance(value){return rgb(value).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);}
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  function foreground(value){return contrast(value,'#ffffff')>=contrast(value,'#000000')?'#ffffff':'#000000';}
  return Object.freeze({hex,hsvToHex,hexToHsv,contrast,foreground});
});
