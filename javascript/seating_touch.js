/* Explicit touch editing. Geometry only; commits use the existing classroom save pipeline. */
(function () {
  'use strict';
  const app = document.getElementById('seatingApplication');
  const room = document.getElementById('classroom');
  const viewport = document.getElementById('workspaceViewport');
  const button = document.getElementById('editTables');
  const status = document.getElementById('tableEditStatus');
  let mode = false, gesture = null, touchMouseUntil = 0, suppressClickUntil = 0, pending = false;
  const presenting = () => !!window.SeatingViewport?.isDisplaying();
  const allowed = () => !app.disabled && !app.inert && !presenting();
  const signal = (name, detail) => document.dispatchEvent(new CustomEvent(name, {detail}));
  const say = text => {
    // Do not move the room's screen origin by reflowing guidance under a finger.
    if (!gesture) status.textContent = text;
    document.getElementById('viewStatus').textContent = text;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(Math.round(value), Math.floor(max)));
  const values = table => ({ left:parseFloat(table.style.left)||0, top:parseFloat(table.style.top)||0,
    width:parseFloat(table.style.width)||table.offsetWidth, height:parseFloat(table.style.height)||table.offsetHeight });
  function apply(table, value) {
    table.style.left = value.left + 'px'; table.style.top = value.top + 'px';
    table.style.width = value.width + 'px'; table.style.height = value.height + 'px';
    window.updateTableScale(table);
    window.updateSeatGrid(table, Number(table.querySelector('.seat-count').value));
  }
  function setMode(active, message) {
    cancel('Table edit cancelled. Original position and size kept.');
    mode = !!active && allowed() && !!room.querySelector('.table');
    document.body.classList.toggle('sc-touch-editing', mode);
    button.textContent = mode ? 'Done Editing' : 'Edit Tables';
    button.setAttribute('aria-pressed', String(mode));
    status.hidden = !mode;
    status.style.minHeight = '';
    signal('seating-touch-mode', {active:mode});
    syncSeats();
    const offMessage = allowed() ? 'Table editing is off. Scroll the room or select a seat.' : presenting() ? 'Table editing is off during presentation.' : 'Table editing is paused. Review Backup & Restore before reopening the classroom.';
    say(message || (mode ? 'Editing tables. Drag Move or Resize with one finger. Use Settings for exact position and size. Choose Done Editing to select seats again.' : offMessage));
    if (mode) status.style.minHeight = status.getBoundingClientRect().height + 'px';
  }
  function syncSeats() {
    room.querySelectorAll('.seat').forEach(seat => {
      seat.tabIndex = mode || presenting() || seat.dataset.seatType === 'aisle' ? -1 : 0;
      if (mode) seat.setAttribute('aria-disabled','true'); else seat.removeAttribute('aria-disabled');
    });
  }
  button.addEventListener('click', () => setMode(!mode));
  function commit(table, before, text) {
    if (!allowed() || !table.isConnected) { if (table.isConnected) apply(table, before); return; }
    if (Object.keys(before).every(key => values(table)[key] === before[key])) { say('No table changes to save.'); return; }
    try { window.saveTables(); say(text); }
    catch (error) {
      apply(table, before);
      // Storage failures already display the backup controller's error and pause editing.
      say('The table change could not be saved. Original position and size restored. Check Backup & Restore before reopening the classroom.');
      if (!error.classroomStorageError) document.getElementById('workspaceNotice').textContent = 'Table editing could not finish.';
    }
  }
  function finish(cancelled, message) {
    if (!gesture) return;
    const current = gesture; gesture = null;
    current.table.classList.remove('sc-touch-moving');
    if (cancelled && current.table.isConnected) apply(current.table, current.before);
    try { if (current.handle.hasPointerCapture(current.id)) current.handle.releasePointerCapture(current.id); } catch (_) { /* A cancelled pointer may already be released. */ }
    suppressClickUntil = performance.now() + 800;
    signal('seating-touch-gesture', {active:false});
    if (cancelled) say(message || 'Gesture cancelled. Original position and size kept.');
    else commit(current.table, current.before, 'Table ' + (current.kind === 'move' ? 'position' : 'size') + ' saved. Continue editing or choose Done Editing.');
  }
  function cancel(message) { finish(true, message); }
  // Native scrolling is never prevented in normal mode. Block only compatibility
  // mousedown in the room so a touch tap cannot start a second legacy mouse edit.
  window.addEventListener('pointerdown', event => {
    if (!gesture) suppressClickUntil = 0;
    if (event.pointerType === 'touch' || event.pointerType === 'pen') touchMouseUntil = performance.now() + 800;
    else if (event.pointerType === 'mouse' && !gesture) touchMouseUntil = 0;
    if (gesture && event.pointerId !== gesture.id) {
      cancel('Use one finger to edit a table. Interrupted changes were not saved.');
    }
  }, true);
  window.addEventListener('mousedown', event => {
    if (room.contains(event.target) && (gesture || event.sourceCapabilities?.firesTouchEvents || performance.now() < touchMouseUntil)) event.stopImmediatePropagation();
  }, true);
  room.addEventListener('pointerdown', event => {
    if (!mode || !allowed() || gesture || !event.isPrimary || event.button !== 0) return;
    const handle = event.target.closest('.sc-touch-move,.table-resize-handle');
    if (!handle || (event.pointerType === 'mouse' && !handle.classList.contains('sc-touch-move'))) return;
    if (!['touch','pen','mouse'].includes(event.pointerType) || window.SeatingViewport.isEditing()) return;
    const table = handle.closest('.table');
    event.preventDefault(); event.stopImmediatePropagation();
    gesture = { id:event.pointerId, table, handle, kind:handle.classList.contains('sc-touch-move')?'move':'resize',
      point:window.classroomPointer(event), before:values(table), width:room.clientWidth, height:room.clientHeight,
      scale:window.SeatingViewport.getScale() };
    signal('seating-touch-gesture', {active:true});
    table.classList.add('sc-touch-moving');
    try { handle.setPointerCapture(event.pointerId); } catch (_) { /* Document listeners also cover synthetic pointers and capture-unavailable engines. */ }
    say(gesture.kind === 'move' ? 'Moving table. Lift to save; Escape cancels.' : 'Resizing table. Lift to save; Escape cancels.');
  }, true);
  function updateGesture(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!allowed() || !gesture.table.isConnected || window.SeatingViewport.getScale() !== gesture.scale) { cancel('Editing interrupted. Original geometry kept.'); return; }
    event.preventDefault();
    const current = gesture, point = window.classroomPointer(event), next = {...current.before};
    if (current.kind === 'move') {
      next.left = clamp(current.before.left + point.x-current.point.x, 0, Math.max(0,current.width-current.before.width));
      next.top = clamp(current.before.top + point.y-current.point.y, 0, Math.max(0,current.height-current.before.height));
    } else {
      next.width = clamp(current.before.width + point.x-current.point.x, 220, Math.max(220,current.width-current.before.left));
      next.height = clamp(current.before.height + point.y-current.point.y, 220, Math.max(220,current.height-current.before.top));
    }
    apply(current.table, next);
  }
  document.addEventListener('pointermove', updateGesture, {passive:false});
  document.addEventListener('pointerup', event => { if (gesture?.id === event.pointerId) { event.preventDefault(); updateGesture(event); finish(false); } }, {passive:false});
  document.addEventListener('pointercancel', event => { if (gesture?.id === event.pointerId) cancel(); });
  room.addEventListener('lostpointercapture', event => { if (gesture?.id === event.pointerId) cancel('Pointer capture ended. Changes were not saved.'); }, true);
  room.addEventListener('contextmenu', event => {
    if (mode && event.target.closest('.sc-touch-move,.table-resize-handle')) { event.preventDefault(); cancel('Gesture interrupted. Original geometry kept.'); }
  });
  room.addEventListener('click', event => {
    if ((event.detail !== 0 && performance.now() < suppressClickUntil) || (mode && event.target.closest('.seat'))) {
      if (!event.target.closest('.sc-table-settings,.sc-touch-settings')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }
  }, true);
  window.addEventListener('keydown', event => {
    if (gesture && event.key.toLowerCase() === 'r') { event.preventDefault(); event.stopImmediatePropagation(); say('Finish or cancel the table gesture before randomizing.'); return; }
    if (event.key === 'Escape' && document.fullscreenElement) return;
    if (event.key !== 'Escape' || !mode || document.getElementById('seatingHelp').open || document.getElementById('dataRestoreDialog').open || document.getElementById('tableColorDialog').open) return;
    if (!gesture && document.querySelector('.sc-menu[open],.sc-table-settings[open]')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (gesture) cancel(); else { setMode(false); button.focus(); }
  }, true);
  window.addEventListener('blur', () => { if (mode) setMode(false, 'Editing paused. Interrupted changes were not saved.'); });
  window.addEventListener('resize', () => cancel('The room view changed. Interrupted changes were not saved.'));
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode) setMode(false); });
  document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement && mode) setMode(false); });
  document.addEventListener('seating-presentation-change', () => { if (mode) setMode(false); });
  document.addEventListener('seating-pan-state', event => { if (event.detail.active && mode) setMode(false); });
  document.addEventListener('seating-view-changed', () => { if (mode) setMode(false); });
  // Cancel before the legacy target handler can save/switch the old classroom.
  app.addEventListener('change', event => {
    if (event.target.matches('#classSelector,#layoutSelector,#layoutModeSelect') && mode) setMode(false);
    else if (gesture) cancel('Gesture cancelled before changing table settings.');
  }, true);
  app.addEventListener('input', () => { if (gesture) cancel('Gesture cancelled before changing settings.'); }, true);
  app.addEventListener('click', event => { if (gesture && !gesture.handle.contains(event.target)) cancel('Gesture cancelled before another action.'); }, true);
  ['addClassBtn','deleteClassBtn','fullscreenClassroomBtn'].forEach(id => document.getElementById(id).addEventListener('click', () => { if (mode) setMode(false); }, true));
  new MutationObserver(() => { if ((app.disabled || app.inert) && mode) setMode(false); }).observe(app, {attributes:true,attributeFilter:['disabled','inert']});

  function geometryFields(table, panel, details) {
    const section = document.createElement('details'); section.className = 'sc-geometry-settings';
    const summary = document.createElement('summary'); summary.textContent = 'Position & size'; section.append(summary);
    const fields = {};
    for (const [key,labelText] of Object.entries({left:'Left position',top:'Top position',width:'Width',height:'Height'})) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'number'; input.required = true; input.min = key === 'left' || key === 'top' ? '0' : '220'; input.step = '1'; input.dataset.geometry = key;
      label.append(labelText, input); section.append(label); fields[key] = input;
    }
    const applyButton = document.createElement('button'); applyButton.type = 'button'; applyButton.textContent = 'Apply position & size'; section.append(applyButton);
    const refresh = () => Object.entries(values(table)).forEach(([key,value]) => { fields[key].value = Math.round(value); });
    section.addEventListener('toggle', () => { if (section.open) refresh(); signal('seating-panel-layout'); });
    applyButton.addEventListener('click', () => {
      if (!allowed()) return;
      cancel();
      const invalid = Object.values(fields).find(input => !input.checkValidity());
      if (invalid) { invalid.reportValidity(); return; }
      const before = values(table), next = Object.fromEntries(Object.entries(fields).map(([key,input]) => [key,input.value.trim() === '' ? NaN : Number(input.value)]));
      if (Object.values(next).some(value => !Number.isFinite(value)) || next.left<0 || next.top<0 || next.width<220 || next.height<220) {
        say('Enter positions of 0 or more, and width and height of at least 220.');
        section.querySelector('input').focus(); return;
      }
      next.width = clamp(next.width,220,room.clientWidth); next.height = clamp(next.height,220,room.clientHeight);
      next.left = clamp(next.left,0,Math.max(0,room.clientWidth-next.width)); next.top = clamp(next.top,0,Math.max(0,room.clientHeight-next.height));
      apply(table,next); commit(table,before,'Table position and size saved.'); refresh();
    });
    panel.querySelector('.sc-close-panel').before(section);
    return section;
  }
  function enhance() {
    pending = false;
    if (gesture && !gesture.table.isConnected) cancel();
    room.querySelectorAll('.table').forEach(table => {
      if (table.querySelector('.sc-touch-move')) return;
      const settings = table.querySelector('.sc-table-settings'), panel = settings?.querySelector('.sc-table-popover');
      if (!panel) return; // The workspace adapter decorates the table first.
      const move = document.createElement('button'); move.type='button'; move.className='sc-touch-move'; move.textContent='Move'; move.setAttribute('aria-label','Move table. Drag with one finger, or press Enter for position fields.');
      const options = document.createElement('button'); options.type='button'; options.className='sc-touch-settings'; options.textContent='⚙'; options.setAttribute('aria-label','Table settings');
      const geometry = geometryFields(table,panel,settings);
      function openGeometry() { settings.open=true; geometry.open=true; requestAnimationFrame(() => geometry.querySelector('input').focus()); }
      move.addEventListener('click', event => { if (event.detail === 0 || performance.now() >= suppressClickUntil) { event.stopPropagation(); openGeometry(); } });
      options.addEventListener('click', event => { event.stopPropagation(); settings.open=true; requestAnimationFrame(() => panel.querySelector('select').focus()); });
      const resize = table.querySelector('.table-resize-handle');
      resize.setAttribute('role','button'); resize.tabIndex=0; resize.setAttribute('aria-label','Resize table. Drag the corner, or press Enter for size fields.');
      resize.addEventListener('keydown', event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); openGeometry(); } });
      table.append(move,options);
    });
    const hasTables=!!room.querySelector('.table');
    button.disabled=!hasTables || !window.PointerEvent;
    button.title=hasTables?'Move or resize tables with touch controls':'Add a table or choose Table mode to edit tables';
    if (!hasTables && mode) setMode(false);
    syncSeats();
  }
  function queue() { if (!pending) { pending=true; requestAnimationFrame(enhance); } }
  new MutationObserver(queue).observe(room,{childList:true,subtree:true});
  queue();
})();
