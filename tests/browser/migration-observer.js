if (location.origin === 'http://127.0.0.1:8873') {
  window.migrationObservation = { errors: [], resourceErrors: [], consoleErrors: [] };
  window.addEventListener('error', event => {
    if (event.target !== window) migrationObservation.resourceErrors.push(event.target.src || event.target.href || event.target.tagName);
    else migrationObservation.errors.push(event.message);
  }, true);
  window.addEventListener('unhandledrejection', event => migrationObservation.errors.push(String(event.reason)));
  const original = console.error;
  console.error = function (...values) { migrationObservation.consoleErrors.push(values.map(String).join(' ')); original.apply(console, values); };
}
