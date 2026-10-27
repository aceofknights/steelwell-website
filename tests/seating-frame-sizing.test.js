const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function render({ width=2032, height=930, roomWidth=2030, roomHeight=928, zoom=1 }={}) {
  const source=fs.readFileSync(path.join(__dirname,'../javascript/seating_workspace.js'),'utf8');
  const start=source.indexOf('  function renderView() {');
  const end=source.indexOf('  function fitView()',start);
  assert.ok(start>=0&&end>start,'Exercise the actual view renderer');
  const style={setProperty(){}}, controls={setAttribute(){}};
  const context={frame:{style},viewport:{clientWidth:width,clientHeight:height},
    room:{style:{width:roomWidth+'px',height:roomHeight+'px'}},zoom,editing:false,
    math:{MIN:.1,MAX:2},byId:()=>controls,positionTablePanels(){},fitting:false,
    displaying:()=>false,document:{body:{classList:{toggle(){}}}}};
  vm.runInNewContext(source.slice(start,end)+'\nrenderView();',context);
  assert.equal(context.room.style.width,roomWidth+'px','Logical width is unchanged');
  assert.equal(context.room.style.height,roomHeight+'px','Logical height is unchanged');
  return [parseFloat(style.width),parseFloat(style.height)];
}

test('rounded-up viewport dimensions never make a room that fits acquire scrollbars',()=>{
  // Measured Chrome 80% zoom: inner width 2031.50390625, clientWidth 2032.
  const [width,height]=render();
  assert.ok(width<=2031.50390625,'Frame must fit the fractional inner width');
  assert.ok(width>=2030,'Keep the whole logical classroom');
  assert.ok(height<=930.078125);
  // The same rounding boundary can occur vertically at other browser/display zooms.
  const [w,h]=render({width:1201,height:801,roomWidth:1199,roomHeight:799});
  assert.ok(w<=1200.51&&h<=800.51,'Both axes reserve a subpixel-rounding margin');
});

test('frame sizing keeps full zoomed content extents and never changes logical geometry',()=>{
  for(const zoom of [.1,.34,.73,1,1.5,2]){
    const [width,height]=render({roomWidth:3000,roomHeight:2000,zoom});
    assert.ok(width>=3000*zoom&&height>=2000*zoom,'Large rooms still scroll at '+zoom);
  }
  assert.deepEqual(render({roomWidth:3000,roomHeight:2000,zoom:1.5}),[4500,3000]);
});
