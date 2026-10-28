/* Load real application markup with a fresh view adapter on the isolated test origin. */
(function () {
  'use strict';
  window.loadSyntheticSeatingPage=async function (frame) {
    if(location.origin!=='http://127.0.0.1:8873')throw Error('Dedicated synthetic test origin required');
    const appURL=new URL('/seating-chart/',document.baseURI);
    // serve_seating_tests.py adds a revision URL to the adapter in this response.
    appURL.searchParams.set('regression',Date.now());
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Synthetic application did not load')),15000);
      frame.onload=()=>{clearTimeout(timer);resolve();};frame.src=appURL;
    });
  };
})();
