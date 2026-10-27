/* Presentation adapters only: no storage, classroom model, migration or placement changes. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const room = byId('classroom');
  const viewport = byId('workspaceViewport');
  const sidebar = byId('studentListContainer');
  const toggle = byId('toggleStudentListBtn');
  const dataPanel = byId('dataPanel');
  const dataToggle = byId('toggleDataPanel');
  const help = byId('seatingHelp');
  const compact = window.matchMedia('(max-width:900px)');
  const math = window.SeatingViewMath;
  const frame = byId('workspaceZoomFrame');
  let zoom = 1, fitting = true, panning = false, panStart = null, editing = false;
  let displayScale = 1, fitSignature = '';
  let tableSignature = '';
  let viewSignature = null, fullscreenScroll = null, presenting = false;
  const displaying = () => presenting || document.fullscreenElement === document.documentElement;
  window.SeatingViewport = Object.freeze({ getScale:() => displaying() ? displayScale : zoom, isEditing:() => editing, isPresenting:() => presenting, isDisplaying:displaying });
  document.addEventListener('seating-touch-mode', event => {
    if (event.detail.active) { fitting = false; setPan(false); closeMenus(); }
  });
  document.addEventListener('seating-touch-gesture', event => {
    editing = event.detail.active;
    if (editing) fitting = false;
    renderView();
  });
  let queued = false;
  let lastHelpFocus;

  function notice(text) { byId('workspaceNotice').textContent = text; byId('workspaceNotice').hidden = !text; }
  function syncSidebar() {
    const visible = !sidebar.classList.contains('hidden');
    sidebar.inert = !visible;
    toggle.setAttribute('aria-expanded', String(visible));
    toggle.textContent = visible ? 'Hide students' : 'Students';
  }
  function closeSidebar() {
    if (sidebar.contains(document.activeElement)) toggle.focus();
    sidebar.classList.add('hidden'); syncSidebar();
  }
  if (compact.matches) closeSidebar();
  compact.addEventListener('change', event => { if (event.matches) closeSidebar(); });
  new MutationObserver(syncSidebar).observe(sidebar, { attributes:true, attributeFilter:['class'] });
  dataToggle.addEventListener('click', () => { dataPanel.open = !dataPanel.open; });
  dataPanel.addEventListener('toggle', () => dataToggle.setAttribute('aria-expanded', String(dataPanel.open)));
  new MutationObserver(() => {
    if (!byId('dataProtectionError').hidden) { dataPanel.open = true; dataToggle.setAttribute('aria-expanded', 'true'); }
  }).observe(byId('dataProtectionError'), { attributes:true, childList:true, subtree:true });
  byId('openSeatingHelp').addEventListener('click', () => { lastHelpFocus = document.activeElement; help.showModal(); byId('closeSeatingHelp').focus(); });
  byId('closeSeatingHelp').addEventListener('click', () => help.close());
  help.addEventListener('close', () => lastHelpFocus?.focus());
  document.addEventListener('keydown', event => {
    if (help.open) event.stopImmediatePropagation();
    if (event.key === 'Escape' && (document.fullscreenElement || byId('tableColorDialog').open)) return;
    if (event.key === 'Escape' && presenting) { setPresentation(false); event.preventDefault(); return; }
    if (event.key === 'Escape') {
      if (help.open) return;
      const menu = document.querySelector('.sc-menu[open],.sc-table-settings[open]');
      if (menu) { closeMenu(menu, true); event.preventDefault(); return; }
      if (dataPanel.open && !byId('dataRestoreDialog').open) { dataPanel.open = false; dataToggle.focus(); }
      else if (compact.matches && !sidebar.classList.contains('hidden') && !help.open) { closeSidebar(); toggle.focus(); }
    }
  }, true);
  document.addEventListener('click', event => {
    document.querySelectorAll('.sc-menu[open],.sc-table-settings[open]').forEach(details => { if (!details.contains(event.target)) details.open = false; });
  });

  function closeMenu(details, focus = false) { details.open = false; if (focus) details.querySelector('summary').focus(); }
  function closeMenus() { document.querySelectorAll('.sc-menu[open],.sc-table-settings[open]').forEach(details => closeMenu(details)); }
  function addCloseButton(details, panel) {
    const close = document.createElement('button'); close.type = 'button'; close.className = 'sc-close-panel'; close.textContent = 'Done';
    close.addEventListener('click', () => closeMenu(details, true)); panel.append(close);
  }
  document.querySelectorAll('.sc-menu').forEach(details => addCloseButton(details, details.querySelector('.sc-popover')));
  let keyboardMenu = null;
  document.addEventListener('keydown', event => {
    if (event.target.matches?.('summary') && ['Enter',' '].includes(event.key)) keyboardMenu = event.target.parentElement;
  }, true);
  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!details.matches('.sc-menu,.sc-table-settings')) return;
    if (details.open) {
      document.querySelectorAll('.sc-menu[open],.sc-table-settings[open]').forEach(other => { if (other !== details) closeMenu(other); });
      if (keyboardMenu === details) details.querySelector('.sc-popover :is(input,select,button),.sc-table-popover :is(input,select,button)')?.focus();
      positionTablePanels();
    } else if (details.contains(document.activeElement) && document.activeElement !== details.querySelector('summary')) details.querySelector('summary').focus();
    keyboardMenu = null;
  }, true);

  function contentBounds() {
    const tables = [...room.querySelectorAll('.table')];
    if (tables.length) {
      const left = Math.min(...tables.map(table => parseFloat(table.style.left) || 0));
      const top = Math.min(...tables.map(table => parseFloat(table.style.top) || 0));
      const right = Math.max(...tables.map(table => (parseFloat(table.style.left) || 0) + table.offsetWidth));
      const bottom = Math.max(...tables.map(table => (parseFloat(table.style.top) || 0) + table.offsetHeight));
      return { left, top, width:right-left, height:bottom-top };
    }
    const grid = room.querySelector('.seating-grid');
    if (grid) {
      const columns = Math.max(1, Number(byId('gridColumnsInput').value) || 1);
      room.style.setProperty('--sc-grid-width', Math.max(960,columns*160+(columns-1)*(parseFloat(getComputedStyle(grid).columnGap)||0))+'px');
    }
    return grid ? { left:grid.offsetLeft, top:grid.offsetTop, width:grid.offsetWidth, height:grid.offsetHeight } : null;
  }
  function renderView() {
    document.body.classList.toggle('sc-auto-fit', fitting || displaying());
    frame.style.setProperty('--sc-view-scale', zoom);
    frame.style.setProperty('--sc-inverse-zoom', 1 / zoom);
    // clientWidth/Height round to integers. At browser/display zoom they can exceed
    // the fractional scrollport, causing scrollbars and ResizeObserver to oscillate.
    // Inset only the viewport-filling minimum; keep all zoomed content scrollable.
    frame.style.width = Math.max(0, viewport.clientWidth - 1, parseFloat(room.style.width) * zoom) + 'px';
    frame.style.height = Math.max(0, viewport.clientHeight - 1, parseFloat(room.style.height) * zoom) + 'px';
    const percent = zoom < .01 ? (zoom*100).toFixed(2) : Math.round(zoom*100);
    byId('zoomValue').textContent = percent + '%';
    byId('resetZoom').setAttribute('aria-label', 'Zoom ' + percent + '%. Reset Zoom to 100%');
    byId('zoomOut').disabled = editing || zoom <= math.MIN;
    byId('zoomIn').disabled = editing || zoom >= math.MAX;
    byId('fitRoom').disabled = editing;
    byId('resetZoom').disabled = editing;
    byId('panRoom').disabled = editing;
    byId('fitRoom').setAttribute('aria-pressed', String(fitting));
    positionTablePanels();
  }
  function fitView() {
    const bounds = contentBounds();
    const width = Math.max(1, (displaying() ? frame.clientWidth : viewport.clientWidth) - 1);
    const height = Math.max(1, (displaying() ? frame.clientHeight : viewport.clientHeight) - (presenting && !document.fullscreenElement ? 64 : 1));
    const placement = math.autoFit(bounds, width, height);
    const signature = JSON.stringify([bounds,width,height,displaying(),placement]);
    if (signature === fitSignature) return !!bounds;
    fitSignature = signature;
    if (displaying()) displayScale = placement.scale; else zoom = placement.scale;
    renderView();
    frame.style.setProperty('--sc-view-scale', placement.scale);
    frame.style.setProperty('--sc-inverse-zoom', 1 / placement.scale);
    room.style.setProperty('--sc-fit-x', placement.x + 'px');
    room.style.setProperty('--sc-fit-y', (placement.y + (presenting && !document.fullscreenElement ? 64 : 0)) + 'px');
    frame.style.width = Math.max(0, viewport.clientWidth - 1) + 'px';
    frame.style.height = Math.max(0, viewport.clientHeight - 1) + 'px';
    viewport.scrollLeft = viewport.scrollTop = 0;
    return !!bounds;
  }
  function changeZoom(value, reset = false) {
    if (editing || displaying()) return;
    closeMenus(); fitting = false; fitSignature = '';
    room.style.removeProperty('--sc-fit-x'); room.style.removeProperty('--sc-fit-y');
    const old = zoom, left = viewport.scrollLeft, top = viewport.scrollTop;
    zoom = math.clamp(Math.round(value*100)/100); renderView();
    viewport.scrollLeft = reset ? 0 : math.anchor(left, viewport.clientWidth, old, zoom);
    viewport.scrollTop = reset ? 0 : math.anchor(top, viewport.clientHeight, old, zoom);
    byId('viewStatus').textContent = 'Workspace zoom ' + Math.round(zoom*100) + ' percent. Saved seating is unchanged.';
  }
  function setPan(value) {
    panning = value; viewport.classList.toggle('sc-pan-mode', panning);
    byId('panRoom').setAttribute('aria-pressed', String(panning));
    byId('viewStatus').textContent = panning ? 'Pan on. Drag the room to explore; turn Pan off to edit.' : 'Pan off. Table editing is available.';
    document.dispatchEvent(new CustomEvent('seating-pan-state', {detail:{active:panning}}));
  }
  byId('zoomIn').addEventListener('click', () => changeZoom(zoom + .1));
  byId('zoomOut').addEventListener('click', () => changeZoom(zoom - .1));
  byId('resetZoom').addEventListener('click', () => changeZoom(1, true));
  byId('fitRoom').addEventListener('click', () => {
    if (editing) return;
    closeMenus(); fitting = true; fitSignature = '';
    const content = fitView();
    byId('viewStatus').textContent = content ? 'Room fitted at ' + Math.round(zoom*100) + ' percent. Saved seating is unchanged.' : 'The room is empty. View reset to 100 percent.';
  });
  byId('panRoom').addEventListener('click', () => setPan(!panning));
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    if (['+','=','-','0'].includes(event.key)) {
      event.preventDefault();
      changeZoom(event.key === '0' ? 1 : zoom + (event.key === '-' ? -.1 : .1), event.key === '0');
    }
  });
  viewport.addEventListener('mousedown', event => {
    if (event.button !== 0 || displaying()) return;
    if (panning && frame.contains(event.target) && !event.target.closest('button,input,select,textarea,summary,.sc-table-popover')) {
      event.preventDefault(); event.stopImmediatePropagation(); fitting = false;
      panStart = { x:event.clientX, y:event.clientY, left:viewport.scrollLeft, top:viewport.scrollTop };
      viewport.classList.add('sc-panning'); viewport.focus({preventScroll:true});
    } else if (!panning && event.target.closest('.table') && !event.target.closest('input,select,button,label,summary,.sc-table-settings')) {
      editing = true; fitting = false; renderView();
    }
  }, true);
  document.addEventListener('mousemove', event => {
    if (!panStart) return;
    event.preventDefault();
    viewport.scrollLeft = panStart.left - (event.clientX - panStart.x);
    viewport.scrollTop = panStart.top - (event.clientY - panStart.y);
  });
  document.addEventListener('mouseup', () => { panStart = null; viewport.classList.remove('sc-panning'); if (editing) { editing = false; renderView(); } });
  window.addEventListener('blur', () => { panStart = null; viewport.classList.remove('sc-panning'); });
  viewport.addEventListener('click', event => {
    if (panning && frame.contains(event.target) && event.detail !== 0 && !event.target.closest('button,input,select,summary,.sc-table-popover')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  function positionTablePanels() {
    const view = viewport.getBoundingClientRect();
    room.querySelectorAll('.sc-table-settings[open] .sc-table-popover').forEach(panel => {
      panel.style.maxHeight = Math.max(64, viewport.clientHeight - 16) + 'px';
      panel.style.width = Math.max(120, Math.min(240, viewport.clientWidth - 16)) + 'px';
      panel.style.setProperty('--sc-panel-x', '0px'); panel.style.setProperty('--sc-panel-y', '0px');
      const rect = panel.getBoundingClientRect();
      const left = Math.max(view.left+8, Math.min(rect.left, view.right-8-rect.width));
      const top = Math.max(view.top+8, Math.min(rect.top, view.bottom-8-rect.height));
      panel.style.setProperty('--sc-panel-x', (left-rect.left)/zoom + 'px');
      panel.style.setProperty('--sc-panel-y', (top-rect.top)/zoom + 'px');
    });
  }
  viewport.addEventListener('scroll', positionTablePanels, {passive:true});
  document.addEventListener('seating-panel-layout', () => requestAnimationFrame(positionTablePanels));

  function labelControl(control, text, parent) {
    const label = document.createElement('label'); label.append(text, control); parent.append(label);
  }
  function enhanceTable(table) {
    const controls = table.querySelector('.table-controls');
    if (!controls || controls.querySelector('.sc-table-settings')) return;
    const settings = document.createElement('details'); settings.className = 'sc-table-settings';
    const summary = document.createElement('summary'); summary.textContent = 'Settings'; summary.setAttribute('aria-label', 'Table settings');
    const panel = document.createElement('div'); panel.className = 'sc-table-popover';
    const name = controls.querySelector('.table-name-input'); name.setAttribute('aria-label', 'Table name');
    labelControl(controls.querySelector('.seat-count'), 'Seats', panel);
    labelControl(controls.querySelector('.column-count'), 'Columns', panel);
    const color = controls.querySelector('.seat-color');
    const legacyColor = document.createElement('div'); legacyColor.hidden = true; legacyColor.append(color); panel.append(legacyColor);
    const colorButton = document.createElement('button'); colorButton.type = 'button'; colorButton.className = 'sc-open-color'; colorButton.textContent = 'Table color…';
    colorButton.addEventListener('click', () => window.SeatingColors.open(table, colorButton)); panel.append(colorButton);
    const remove = controls.querySelector('.delete-btn'); remove.textContent = 'Remove table'; remove.setAttribute('aria-label', 'Remove table'); panel.append(remove);
    settings.append(summary, panel); controls.append(settings);
    addCloseButton(settings, panel);
    // Settings must not start the legacy header-drag handler.
    settings.addEventListener('mousedown', event => event.stopPropagation());
    table.querySelector('.table-resize-handle').setAttribute('aria-label', 'Resize table with a mouse or trackpad');
  }
  function sizeCanvas() {
    if (displaying()) { fitView(); return; }
    let width = Math.max(960, viewport.clientWidth - 2), height = Math.max(680, viewport.clientHeight - 2);
    room.querySelectorAll('.table').forEach(table => {
      width = Math.max(width, (parseFloat(table.style.left) || 0) + (parseFloat(table.style.width) || 360) + 64);
      height = Math.max(height, (parseFloat(table.style.top) || 0) + (parseFloat(table.style.height) || 400) + 64);
    });
    const grid = room.querySelector('.seating-grid');
    if (grid) {
      const columns = Math.max(1, Number(byId('gridColumnsInput').value) || 1);
      width = Math.max(960, columns * 160 + Math.max(0, columns - 1) * (parseFloat(grid.style.columnGap) || 0));
      height = Math.max(680, grid.offsetHeight);
    }
    if (room.style.width !== width + 'px') room.style.width = width + 'px';
    if (room.style.height !== height + 'px') room.style.height = height + 'px';
    if (fitting) fitView(); else renderView();
  }
  function presentationControls() {
    if (frame.querySelector('.sc-presentation-controls')) return;
    const panel = document.createElement('div'); panel.className = 'sc-presentation-controls'; panel.setAttribute('aria-label', 'Presentation controls');
    const random = document.createElement('button'); random.type = 'button'; random.textContent = 'Randomize · R';
    random.addEventListener('click', () => byId('randomizeSeatingBtn')?.click());
    const exit = document.createElement('button'); exit.type = 'button'; exit.textContent = 'Exit presentation';
    exit.addEventListener('click', () => setPresentation(false));
    const fullscreen = document.createElement('button'); fullscreen.type = 'button'; fullscreen.dataset.workspaceFullscreen = 'true';
    fullscreen.addEventListener('click', toggleWorkspaceFullscreen);
    panel.append(random, fullscreen, exit); frame.append(panel); syncFullscreen();
  }
  function enhance() {
    queued = false;
    const tablesNow = [...room.querySelectorAll('.table')].map(table=>table.dataset.id).join('|');
    if (tablesNow !== tableSignature && !editing) { fitting = true; fitSignature = ''; }
    tableSignature = tablesNow;
    const signature = [byId('classSelector').value,byId('layoutSelector').value,byId('layoutModeSelect').value].join('|');
    if (viewSignature !== null && signature !== viewSignature) {
      document.dispatchEvent(new CustomEvent('seating-view-changed'));
      fitting = true; fitSignature = ''; viewport.scrollLeft = viewport.scrollTop = 0; setPan(false); closeMenus();
      byId('viewStatus').textContent = 'Room automatically fitted for the selected class or layout.';
    }
    viewSignature = signature;
    room.querySelectorAll('.table').forEach(enhanceTable);
    room.querySelectorAll('.table').forEach(table => window.SeatingColors?.enhance(table));
    room.querySelectorAll('.table-name-input').forEach(input => { input.inert = displaying(); });
    room.querySelectorAll('.table').forEach(table => table.querySelectorAll('.seat').forEach(seat => {
      seat.dataset.workspaceColor = table.querySelector('.seat-color').value;
    }));
    const random = byId('randomizeSeatingBtn');
    if (random) {
      random.textContent = 'Randomize'; random.title = 'Randomize seating (R)'; random.setAttribute('aria-keyshortcuts', 'R');
      if (random.nextElementSibling !== byId('addTableBtn')) byId('addTableBtn').before(random);
    }
    byId('fullscreenClassroomBtn').textContent = presenting ? 'Exit presentation' : 'Present';
    document.querySelectorAll('.student-list-item').forEach(item => {
      const name = item.dataset.student;
      item.querySelector('.attendance-btn')?.setAttribute('aria-label', name + ' is present');
      item.querySelector('.options-btn')?.setAttribute('aria-label', 'Seating constraints for ' + name);
      item.querySelector('.remove-student-btn')?.setAttribute('aria-label', 'Remove ' + name);
      const panel = item.querySelector('.options-panel');
      if (panel && !panel.querySelector('h3')) { const heading = document.createElement('h3'); heading.textContent = 'Seating constraints'; panel.prepend(heading); }
    });
    document.querySelectorAll('.student-group-list > .student-group-chip').forEach(chip => {
      const remove = chip.nextElementSibling;
      const pair = document.createElement('span'); pair.className = 'sc-group-chip';
      chip.before(pair); pair.append(chip);
      if (remove?.classList.contains('student-group-delete-btn')) pair.append(remove);
    });
    const attendance = [...document.querySelectorAll('.attendance-btn')];
    byId('attendanceSummary').textContent = attendance.filter(box => box.checked).length + ' / ' + attendance.length + ' present';
    const grid = !!room.querySelector('.seating-grid');
    byId('workspaceHint').textContent = grid ? 'Select a seat to assign a student. Individual table colors are available in Table mode.' : 'Drag a table to move it. Select a seat to assign a student.';
    room.querySelectorAll('.seat').forEach(seat => {
      const aisle = seat.dataset.seatType === 'aisle';
      seat.tabIndex = aisle || displaying() ? -1 : 0;
      // Grid seats contain a native aisle button: keep it exposed to assistive tools.
      seat.setAttribute('role', grid || displaying() ? 'group' : 'button');
      seat.setAttribute('aria-label', aisle ? 'Aisle' : (seat.dataset.studentName || 'Empty seat') +
        (displaying() ? '' : grid ? ' — press Enter to assign a student' : ' — assign student'));
      if (!seat.dataset.workspaceKeys) {
        seat.dataset.workspaceKeys = 'true';
        seat.addEventListener('keydown', event => {
          if (event.target === seat && ['Enter',' '].includes(event.key) && !displaying()) { event.preventDefault(); seat.click(); }
        });
      }
    });
    presentationControls(); sizeCanvas(); syncSidebar();
    if (window.updateSeatGrid) room.querySelectorAll('.table').forEach(table => window.updateSeatGrid(table, Number(table.querySelector('.seat-count').value)));
    if (grid) window.fitAllGridSeatNames?.();
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(enhance); } }
  new MutationObserver(queue).observe(room, { childList:true, subtree:true });
  new MutationObserver(queue).observe(byId('studentList'), { childList:true, subtree:true });
  byId('studentList').addEventListener('change', queue);
  // Observe geometry only on the classroom's direct table children.
  const geometry = new MutationObserver(records => { if (records.some(record => record.target.classList.contains('table'))) sizeCanvas(); });
  geometry.observe(room, { attributes:true, attributeFilter:['style'], subtree:true });
  let lastViewportSize = '';
  new ResizeObserver(() => {
    const rect = viewport.getBoundingClientRect(), signature = [rect.width,rect.height].join('|');
    if (signature !== lastViewportSize) {
      lastViewportSize = signature;
      if (!editing && !document.body.classList.contains('sc-touch-editing')) { fitting = true; fitSignature = ''; }
    }
    queue();
  }).observe(viewport);
  function syncFullscreen() {
    const active = document.fullscreenElement === document.documentElement;
    document.querySelectorAll('[data-workspace-fullscreen]').forEach(button => {
      button.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
      button.setAttribute('aria-pressed', String(active));
    });
    document.body.classList.toggle('sc-workspace-fullscreen', active);
    room.classList.toggle('fullscreen-classroom', active || presenting);
  }
  async function toggleWorkspaceFullscreen() {
    fullscreenScroll = {left:viewport.scrollLeft, top:viewport.scrollTop};
    // Fullscreen keeps the current scale. Fit can be selected again for the new view.
    fitting = true; fitSignature = '';
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notice('Fullscreen is unavailable in this browser. You can keep using the classroom normally.');
    } catch (_) { notice('Fullscreen could not start. Allow fullscreen in your browser and try again.'); }
  }
  function setPresentation(active) {
    if (active === presenting) return;
    if (active) {
      window.SeatingColors?.cancel(); closeMenus();
      fullscreenScroll = {left:viewport.scrollLeft, top:viewport.scrollTop};
    }
    presenting = active;
    fitting = true; fitSignature = '';
    document.dispatchEvent(new CustomEvent('seating-presentation-change', {detail:{active}}));
    room.classList.toggle('fullscreen-classroom', active || document.fullscreenElement === document.documentElement);
    document.body.classList.toggle('sc-presenting', active);
    byId('fullscreenClassroomBtn').textContent = active ? 'Exit presentation' : 'Present';
    byId('fullscreenClassroomBtn').setAttribute('aria-pressed', String(active));
    queue();
    requestAnimationFrame(() => {
      if (!active) {
        sizeCanvas();
        if (fullscreenScroll) { viewport.scrollLeft = fullscreenScroll.left; viewport.scrollTop = fullscreenScroll.top; }
        byId('fullscreenClassroomBtn').focus();
      } else frame.querySelector('.sc-presentation-controls button')?.focus();
      window.fitAllGridSeatNames?.();
    });
  }
  byId('fullscreenClassroomBtn').addEventListener('click', event => {
    event.stopImmediatePropagation(); setPresentation(!presenting);
  }, true);
  byId('workspaceFullscreenBtn').addEventListener('click', toggleWorkspaceFullscreen);
  document.addEventListener('fullscreenchange', () => {
    syncFullscreen(); fitting = true; fitSignature = ''; queue();
    document.dispatchEvent(new CustomEvent('seating-presentation-change', {detail:{active:displaying()}}));
    if (document.fullscreenElement) { room.tabIndex = -1; room.focus({preventScroll:true}); }
    else if (!presenting) byId('workspaceFullscreenBtn').focus({preventScroll:true});
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!presenting && fullscreenScroll) { viewport.scrollLeft = fullscreenScroll.left; viewport.scrollTop = fullscreenScroll.top; }
    }));
  });
  syncFullscreen();
  // Presentation must never start a legacy drag or seat-assignment prompt.
  room.addEventListener('mousedown', event => { if (displaying()) event.stopImmediatePropagation(); }, true);
  room.addEventListener('click', event => {
    if (displaying() && !event.target.closest('.sc-presentation-controls')) event.stopImmediatePropagation();
  }, true);
  queue();
})();
