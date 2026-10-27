const test=require('node:test');
const assert=require('node:assert/strict');
const color=require('../javascript/seating_color_math.js');
test('HSV conversion handles hue wrap, primary colors, gray, black and white',()=>{
  assert.equal(color.hsvToHex(0,100,100),'#ff0000');assert.equal(color.hsvToHex(120,100,100),'#00ff00');
  assert.equal(color.hsvToHex(240,100,100),'#0000ff');assert.equal(color.hsvToHex(360,100,100),'#ff0000');
  assert.equal(color.hsvToHex(-120,100,100),'#0000ff');assert.equal(color.hsvToHex(50,0,100),'#ffffff');
  assert.equal(color.hsvToHex(80,100,0),'#000000');assert.equal(color.hex('abc'),'#aabbcc');assert.equal(color.hex('invalid'),null);
});
test('saved opaque custom colors round trip through HSV without channel changes',()=>{
  for(const value of ['#4388f5','#000000','#ffffff','#f4bd50','#a307dd','#808080','#101722']){
    const {h,s,v}=color.hexToHsv(value);assert.equal(color.hsvToHex(h,s,v),value);
  }
});
test('automatic foreground meets WCAG AA normal-text contrast across the RGB cube',()=>{
  assert.equal(color.contrast('#000000','#ffffff'),21);
  for(let r=0;r<=255;r+=17)for(let g=0;g<=255;g+=17)for(let b=0;b<=255;b+=17){
    const value='#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
    assert.ok(color.contrast(value,color.foreground(value))>=4.5,value);
  }
});
