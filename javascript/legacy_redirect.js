/* Static compatibility only: same origin, no storage access, no meta-refresh. */
(function () {
  'use strict';
  const path = document.body.dataset.cleanRoute;
  if (!path || !(path === '/' || /^\/[a-z0-9/-]+\/$/.test(path)) || path.startsWith('//')) return;
  if (location.pathname === path) return;
  const destination = path + location.search + location.hash;
  document.getElementById('cleanDestination').href = destination;
  location.replace(destination);
})();
