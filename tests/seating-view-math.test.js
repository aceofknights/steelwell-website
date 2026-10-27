const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('../javascript/seating_view_math.js');
test('view scale is finite and constrained to 10–200 percent', () => {
  assert.equal(math.clamp(-1), .1); assert.equal(math.clamp(10), 2);
  assert.equal(math.clamp(NaN), 1); assert.equal(math.clamp(Infinity), 1);
});
test('inverse pointer conversion preserves logical pixels across zoom and scrolling', () => {
  for (const scale of [.1,.25,.5,1,1.5,2]) {
    for (const left of [-500,0,80]) {
      const rect = {left,top:-120}; const point = math.pointer(left+420*scale,-120+260*scale,rect,scale);
      assert.ok(Math.abs(point.x-420)<1e-9); assert.ok(Math.abs(point.y-260)<1e-9);
    }
  }
});
test('fit considers real content dimensions with padding and does not enlarge small rooms', () => {
  assert.equal(math.fit({width:1000,height:500},532,532),.5);
  assert.equal(math.fit({width:500,height:1000},532,532),.5);
  assert.equal(math.fit({width:100,height:100},1000,1000),1);
  assert.equal(math.fit({width:100000,height:50000},320,200),.1);
});
test('empty and zero-size content fits at 100 percent without division errors', () => {
  assert.equal(math.fit(null,320,200),1); assert.equal(math.fit({width:0,height:0},320,200),1);
});
test('zoom anchors the visible center where scroll bounds allow', () => {
  const scroll = math.anchor(300,400,.5,1.5);
  assert.equal((scroll+200)/1.5,(300+200)/.5);
  assert.equal(math.anchor(0,1000,2,.1),0);
});

test('automatic fit includes full bounds and centers without a ten-percent floor',()=>{
  for(const bounds of [{left:0,top:0,width:300,height:200},{left:1600,top:900,width:4000,height:9000},{left:-300,top:-500,width:100000,height:100000}]){
    const copy=JSON.stringify(bounds);
    for(const [width,height] of [[320,200],[1920,1080],[2400,1350]]){
      const p=math.autoFit(bounds,width-1,height-1);
      assert.ok(p.scale>0&&p.scale<=1);
      assert.ok(bounds.left*p.scale+p.x>=11.9&&bounds.top*p.scale+p.y>=11.9);
      assert.ok((bounds.left+bounds.width)*p.scale+p.x<=width-12.9);
      assert.ok((bounds.top+bounds.height)*p.scale+p.y<=height-12.9);
    }
    assert.equal(JSON.stringify(bounds),copy);
  }
  assert.ok(math.autoFit({left:0,top:0,width:100000,height:100000},320,200).scale<.1);
  assert.deepEqual(math.autoFit(null,320,200),{scale:1,x:0,y:0});
});
