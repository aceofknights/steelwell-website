document.querySelector('#run').addEventListener('click', async () => {
  const output = document.querySelector('#results');
  if (location.origin !== 'http://127.0.0.1:8873') { output.textContent = 'Test origin required.'; return; }
  const frame = document.querySelector('#app');
  let passed = 0;
  const errors = [];
  function check(ok, message) { if (!ok) throw Error(message); output.textContent += '\nPASS ' + message; passed++; }
  output.textContent = 'Running...';
  try {
    const { projects } = await (await fetch('../../data/projects.json')).json();
    for (const width of [320, 390, 768, 1248, 1440]) {
      frame.style.width = width + 'px';
      await new Promise(resolve => { frame.onload = resolve; frame.src = '../../index.html?home-review=' + Date.now(); });
      const doc = frame.contentDocument, win = frame.contentWindow;
      win.addEventListener('error', event => errors.push(event.message));
      const images = [...doc.querySelectorAll('main img')];
      check(images.length === 4 && images.every(img => img.loading === 'lazy' && img.decoding === 'async'), 'Four lazy/async project previews at ' + width);
      images.forEach(img => { img.loading = 'eager'; }); // Test-only decoding of below-fold previews.
      await Promise.all(images.map(img => img.decode()));
      check(doc.documentElement.scrollWidth <= win.innerWidth, 'No horizontal page overflow at ' + width);
      check(images.every(img => img.naturalWidth === Number(img.getAttribute('width')) && img.naturalHeight === Number(img.getAttribute('height')) && img.alt), 'Declared image dimensions and alt text match real assets at ' + width);
      const seatingImage = doc.querySelector('.cw-home-feature-media img');
      const rect = seatingImage.getBoundingClientRect();
      check(Math.abs(rect.width / rect.height - seatingImage.naturalWidth / seatingImage.naturalHeight) < 0.02, 'Featured screenshot keeps its natural aspect ratio at ' + width);
      check([...doc.querySelectorAll('.cw-project-thumbnail')].every(el => { const r = el.getBoundingClientRect(); return Math.abs(r.width / r.height - 1.6) < 0.02; }), 'Curated preview frames stay 16:10 at ' + width);
      const cards = [...doc.querySelectorAll('.cw-card')];
      check(cards.length === 3 && cards.every(card => {
        const project = projects.find(p => p.id === card.dataset.projectId);
        return project && card.querySelector('h3').textContent === project.title && card.querySelector('.cw-project-summary').textContent === project.summary && card.querySelector('img').getAttribute('src') === project.preview.src;
      }), 'Curated names, descriptions, and previews match metadata at ' + width);
      check(doc.querySelectorAll('h1').length === 1 && !doc.querySelector('a[href$="resume.html"]') && doc.querySelectorAll('main script').length === 0, 'Semantic heading, no Resume, no homepage runtime code at ' + width);
      const links = [...doc.querySelectorAll('main a')];
      check(links.every(a => { const r = a.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= width && win.getComputedStyle(a).visibility === 'visible'; }), 'Every homepage action remains visible and within bounds at ' + width);
      check([...doc.querySelectorAll('.cw-home-launches a')].map(a => a.getAttribute('href')).join('|') === 'webpages/SeatingChart.html|webpages/HexMath.html|webpages/sortTheNumber.html', 'Quick access opens the three original applications at ' + width);
      check(doc.querySelector('[data-project-id="auto-clicker"] a[href^="https://github.com/"]')?.textContent === 'View Source', 'Auto Clicker offers source rather than a browser launch at ' + width);
      if (width === 390) check(doc.querySelector('.cw-home-feature').getBoundingClientRect().top < 650, 'Seating Chart arrives earlier in the mobile page');
      if (width <= 390) check(cards.every(card => card.getBoundingClientRect().width > win.innerWidth / 2), 'Cards stack into a readable single column at ' + width);
      if (width === 1440) {
        for (const href of new Set(links.map(a => a.getAttribute('href')).filter(href => !href.startsWith('https:')))) {
          const response = await fetch(new URL(href, frame.contentWindow.location.href));
          check(response.ok && (await response.text()).includes('<html'), 'Internal homepage action resolves: ' + href);
        }
      }
    }
    check(errors.length === 0, 'No runtime errors: ' + JSON.stringify(errors));
    output.textContent += '\nCOMPLETE ' + passed + ' passed.';
  } catch (error) { output.textContent += '\nFAIL ' + error.message; }
});
