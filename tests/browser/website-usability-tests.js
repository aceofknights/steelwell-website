/* Disposable browser regression origin only. Native keyboard activation is checked separately. */
document.querySelector('#run').addEventListener('click', async () => {
  const output = document.querySelector('#results');
  if (location.origin !== 'http://127.0.0.1:8873') { output.textContent = 'Refusing non-test origin.'; return; }
  const frame = document.querySelector('#app');
  let passed = 0;
  const errors = [];
  function check(condition, message) {
    if (!condition) throw Error(message);
    output.textContent += '\nPASS ' + message;
    passed++;
  }
  const settle = () => new Promise(resolve => setTimeout(resolve, 120));
  async function load(file, width = 390) {
    frame.style.width = width + 'px';
    await new Promise(resolve => { frame.onload = resolve; frame.src = '../../webpages/' + file + '?test=' + Date.now(); });
    frame.contentWindow.addEventListener('error', e => errors.push(e.message));
    await settle();
    return frame.contentDocument;
  }
  output.textContent = 'Runningâ€¦';
  try {
    let doc = await load('HexMath.html');
    const cells = [...doc.querySelectorAll('.hex-cell')];
    check(cells.length === 59, 'Hex has all 59 original cells');
    // Make one legal move through the existing factor controls.
    const selected = [...doc.querySelectorAll('.factor-buttons .selected')].map(e => Number(e.textContent));
    const move = [...doc.querySelectorAll('#factorAControls button')].find(e =>
      Number(e.textContent) !== selected[0] && cells.some(c => Number(c.dataset.product) === Number(e.textContent) * selected[1]));
    check(!!move, 'A legal factor move is available');
    move.click();
    check(doc.querySelectorAll('.claimed').length === 1, 'Existing factor action claims exactly one cell');
    const state = () => cells.map(e => e.dataset.product + ':' + e.className).join('|') + doc.querySelector('#turnMessage').textContent;
    const before = state();
    for (const width of [320, 390, 768, 1440]) {
      frame.style.width = width + 'px'; await settle();
      const wrap = doc.querySelector('.hex-board-wrap').getBoundingClientRect();
      check(cells.every(e => { const r = e.getBoundingClientRect(); return r.left >= wrap.left && r.right <= wrap.right; }), 'All Hex cells fit at ' + width + 'px');
      check(doc.documentElement.scrollWidth <= frame.contentWindow.innerWidth, 'No horizontal page overflow at ' + width + 'px');
      check(cells.every(e => e.isConnected) && state() === before, 'Resize preserves cell identity and progress at ' + width + 'px');
    }
    doc = await load('sortTheNumber.html');
    const cards = [...doc.querySelectorAll('.card-box')];
    check(cards.length === 5 && cards.every(e => e.tagName === 'BUTTON' && e.type === 'button' && e.tabIndex === 0), 'Sort exposes five native keyboard buttons');
    const messages = [];
    frame.contentWindow.alert = message => messages.push(message);
    for (let n = 1; n <= 5; n++) cards.find(e => Number(e.textContent) === n).click();
    check(messages.length === 1 && messages[0].startsWith('Congratulations'), 'Sort ordered mouse/touch click path still wins');
    check(cards.every(e => !e.classList.contains('clicked')), 'Sort resets after a win');
    cards.find(e => Number(e.textContent) === 2).click();
    check(messages.length === 2 && messages[1].startsWith('Game over'), 'Sort wrong-number rules remain intact');
    doc = await load('survey.html');
    check(doc.querySelector('.survey-notice').textContent.includes('not a working contact form'), 'Survey warns before data entry');
    doc.querySelector('#submitBtn').click();
    check(doc.querySelector('#errorMessage').textContent.includes('Please answer'), 'Survey validation remains functional');
    doc.querySelector('#userName').value = 'Synthetic Visitor';
    doc.querySelector('#q1').value = 'good'; doc.querySelector('#q2').value = 'Demo';
    doc.querySelector('#q3a').checked = true; doc.querySelector('#q4a').checked = true;
    doc.querySelector('#submitBtn').click();
    check(!doc.querySelector('#thankYouMessage').classList.contains('hidden') && doc.querySelector('#thankYouMessage').textContent.includes('Nothing was sent or saved'), 'Survey completion makes no delivery claim');
    check(doc.querySelector('#submittedUserName').textContent === 'Synthetic Visitor', 'Survey acknowledgment uses its unique output ID');
    check(new Set([...doc.querySelectorAll('[id]')].map(e => e.id)).size === doc.querySelectorAll('[id]').length, 'Survey IDs are unique');
    for (const width of [390, 1440]) {
      doc = await load('resume.html', width);
      const links = [...doc.querySelectorAll('main a')];
      check(links.length === 2 && links.every(e => e.getBoundingClientRect().width > 0) && links.some(e => e.hasAttribute('download')), 'Visible PDF open/download fallback at ' + width + 'px');
      doc.querySelector('embed').remove();
      check(links.every(e => e.isConnected), 'Fallback survives unavailable embed at ' + width + 'px');
    }
    const pdf = await fetch('../../assets/Chris%20Wells%202024.pdf');
    check(pdf.ok && (await pdf.text()).startsWith('%PDF-'), 'Fallback destination serves a real PDF');
    check(errors.length === 0, 'No runtime errors during scenarios: ' + JSON.stringify(errors));
    output.textContent += '\nCOMPLETE: ' + passed + ' passed.';
  } catch (error) { output.textContent += '\nFAIL: ' + error.message; }
});
