# Seating Chart workspace — Milestone 3D

Milestone 3E adds view zoom and pointer-coordinate adaptation; see
[the coordinate contract and current view behavior](seating-zoom.md). The notes below
describe the original 3D baseline, including its then-unchanged legacy script.

## Inspection and preserved dependencies

Before editing, the HTML, `css/styles.css`, backup styles, dashboard tokens, legacy
application script, backup controller/core, and 3B/3C tests were inspected.

- Every original HTML ID remains unique and available before application startup.
- The disabled `#seatingApplication` fieldset remains the backup controller's gate.
  Raw capture still runs synchronously in the head, before the dynamic application
  load. Backup and recovery controls remain outside that gate.
- Randomize is inserted beside Add Table through its parent; both remain in the
  same primary-action container. The existing click listener is retained.
- `.table-controls`, name/count/column/color inputs, delete button, `.seats`, and
  resize handle retain their classes and table ancestry. Settings labels wrap the
  existing controls rather than replacing them. The legacy `querySelector` calls
  still resolve them. Table settings stop header-drag propagation.
- Drag and resize handlers use `#classroom.getBoundingClientRect()` and table pixel
  geometry. The unscaled coordinate plane remains `#classroom`; scrolling moves its
  bounding rectangle with the content. A separate viewport pans the canvas.
- `.hidden` remains the sidebar toggle state. An observer synchronizes its expanded
  state and `inert` attribute so collapsed controls cannot receive keyboard focus.
- The fullscreen target remains `#classroom`; a UI adapter waits for native success,
  provides exit/randomize controls inside the target, and suppresses editing there.
- Existing inline styles for grid mode, group picker and constraint visibility remain
  authoritative. Layouts, storage formats, backups, migration, algorithms and rules
  are unchanged. The three 3B/3C JavaScript files are byte-for-byte unchanged.

## Structure

The compact header links back to the website and exposes Help and Backup & Restore.
The toolbar holds class selection, Randomize, Add Table, mode and layout selection,
layout settings, and presentation. Class creation/deletion is under Class options.
The student sidebar contains a collapsible bulk-add form, attendance, sublists,
the roster and existing per-student constraint panels. Table controls are under
each table's Settings disclosure. No editing control has been removed.

Desktop uses an independently scrolling roster beside a large room viewport.
Below 900px the roster is a dismissible overlay, initially closed. Mobile wraps
the toolbar and pans the original coordinate plane horizontally and vertically.
Canvas bounds include all existing table positions plus working space; resizing a
viewport does not change or save table geometry. Short viewports permit page scroll
instead of clipping controls. No zoom transforms are applied.

`dashboard.css` supplies the existing `.portfolio` tokens. New styles are scoped to
`.seating-workspace` and loaded after legacy and backup CSS; those stylesheets are
unchanged. The additive `seating_workspace.js` decorates generated controls and
handles presentation only. It has no storage or classroom model access.

## Verification and limitations

Run the four existing Node test files and `tests/seating-workspace.test.js` with
`node --test tests/*.test.js`. Run `python scripts/check_catalog.py` for local links.
The dedicated loopback browser harnesses use synthetic records only. The existing
3C harness covers both seating modes, all randomizers, assignment persistence,
constraints, migration, zero geometry, backups and storage failure gating.

Mouse/trackpad table drag and resize remain the existing interaction. Touch supports
native buttons, forms, panels and workspace panning; touch drag/resize is explicitly
not added in this visual milestone. Assignment still uses the existing browser prompt.
Fullscreen requires browser support and permission. Wide rooms require panning, and
large grids preserve their rows/columns rather than squeezing into a narrow screen.
Small table sizes or long names can still constrain seat-label readability. Existing
data/recovery and impossible-constraint limitations from 3C remain applicable.

## Local results

- 37 Node tests passed, including all 34 prior tests and three workspace checks.
- All 14 prior real-DOM reliability scenarios passed with the new shell.
- Ten new browser scenarios passed: five viewport sizes (1440, 1024, 768, 390,
  320px), scrolled mouse drag/resize, contextual table settings, student/attendance/
  constraints/class switching, backup/verification/cancel/confirmed restore, and
  modal Help/fullscreen rejection. Grid labels are checked after responsive sizing.
- Native fullscreen entry, presentation Randomize and exit were also exercised.
- No browser console errors were recorded. Local references, syntax checks and
  whitespace checks passed. No production classroom records were read or changed.
- Desktop/tablet/mobile screenshots use only the synthetic workspace fixture. The
  new browser harness is `tests/browser/seating-workspace-harness.html`, on the same
  guarded loopback origin as the prior harnesses. Its download test captures the
  generated Blob without downloading classroom data or contacting another service.

Physical touch hardware and other browser engines were not available for testing.
Touch-friendly controls and native panning are provided; mouse/trackpad dragging and
resizing remain the supported editing workflow. Modern browser support is required
for CSS grid, `:has`, native dialogs, `inert`, ResizeObserver, and fullscreen.
