document.querySelector('#run').addEventListener('click', async () => {
  const output = document.querySelector('#results');
  if (location.origin !== 'http://127.0.0.1:8873') { output.textContent = 'Test origin required.'; return; }
  const frame = document.querySelector('#app');
  const errors = [];
  let passed = 0;
  function check(ok, message) { if (!ok) throw Error(message); output.textContent += '\nPASS ' + message; passed++; }
  output.textContent = 'Running...';
  try {
    const manifest = await (await fetch('/data/projects.json')).json();
    const pages = ['/projects/', '/tools-games/', ...manifest.projects.map(p => p.showcase)];
    for (const width of [1248, 768, 390, 320]) {
      frame.style.width = width + 'px';
      for (const page of pages) {
        await new Promise(resolve => { frame.onload = resolve; frame.src = page + '?review=' + Date.now(); });
        const doc = frame.contentDocument;
        frame.contentWindow.addEventListener('error', event => errors.push(event.message));
        const images = [...doc.querySelectorAll('main img')];
        // Force below-fold image decoding in this test frame only.
        images.forEach(img => { img.loading = 'eager'; });
        await Promise.all(images.map(img => img.decode()));
        check(doc.documentElement.scrollWidth <= frame.contentWindow.innerWidth, page + ' has no page overflow at ' + width);
        check(images.every(img => img.naturalWidth === Number(img.getAttribute('width')) && img.naturalHeight === Number(img.getAttribute('height')) && img.alt && ['contain', 'scale-down'].includes(frame.contentWindow.getComputedStyle(img).objectFit)), page + ' previews load at declared dimensions without cropping at ' + width);
        const previews = [...doc.querySelectorAll('.cw-project-thumbnail, .cw-project-media > a')];
        check(previews.every(el => { const r = el.getBoundingClientRect(); return Math.abs(r.width / r.height - 1.6) < 0.02; }), page + ' reserves consistent 16:10 preview space at ' + width);
        const links = [...doc.querySelectorAll('[data-action]')];
        check(links.length > 0 && links.every(link => { const r = link.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= width; }) && !doc.querySelector('a[href$="resume.html"]'), page + ' exposes actions and omits Resume at ' + width);
        if (page.startsWith('/projects/') && page !== '/projects/' && width <= 768) {
          check(doc.querySelector('.cw-project-sidebar').getBoundingClientRect().top < doc.querySelector('.cw-showcase-content').getBoundingClientRect().top, page + ' keeps actions before long content at ' + width);
        }
      }
    }
    check(errors.length === 0, 'No runtime errors: ' + JSON.stringify(errors));
    output.textContent += '\nCOMPLETE ' + passed + ' passed.';
  } catch (error) { output.textContent += '\nFAIL ' + error.message; }
});
