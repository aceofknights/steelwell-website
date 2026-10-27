/* Pure view geometry; independent of classroom records and placement rules. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SeatingViewMath = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MIN = 0.1, MAX = 2;
  const clamp = value => Math.max(MIN, Math.min(MAX, Number.isFinite(value) ? value : 1));
  function pointer(clientX, clientY, rect, scale) {
    return { x:(clientX - rect.left) / clamp(scale), y:(clientY - rect.top) / clamp(scale) };
  }
  function fit(bounds, width, height) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return 1;
    return clamp(Math.floor(Math.min(1, Math.max(1, width - 32) / bounds.width,
      Math.max(1, height - 32) / bounds.height) * 100) / 100);
  }
  function anchor(scroll, viewportSize, oldScale, newScale) {
    return Math.max(0, (scroll + viewportSize / 2) / clamp(oldScale) * clamp(newScale) - viewportSize / 2);
  }
  function autoFit(bounds, width, height) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return {scale:1,x:0,y:0};
    const scale = Math.min(1, Math.max(.001,width-24)/bounds.width, Math.max(.001,height-24)/bounds.height);
    return {scale, x:(width-bounds.width*scale)/2-bounds.left*scale,
      y:(height-bounds.height*scale)/2-bounds.top*scale};
  }
  return Object.freeze({ MIN, MAX, clamp, pointer, fit, autoFit, anchor });
});
