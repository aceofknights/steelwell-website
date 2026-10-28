/* Presentation adapter: never rebuild cells or change game state on resize. */
(function () {
  'use strict';
  const frame = document.querySelector('.hex-board-frame');
  if (!frame) return;
  let previousWidth;
  function fit() {
    const width = frame.clientWidth;
    if (!width || width === previousWidth) return;
    previousWidth = width;
    const scale = Math.min(1, width / 730);
    frame.style.setProperty('--hex-scale', String(scale));
    frame.style.height = (650 * scale) + 'px';
    frame.classList.add('is-fitted');
  }
  fit();
  // Write height outside observer delivery; otherwise the height change itself
  // can generate an undelivered-notification error even with a stable width.
  if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(fit)).observe(frame);
  else window.addEventListener('resize', fit);
})();
