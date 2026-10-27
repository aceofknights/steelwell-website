# Milestone 3H — Fullscreen and individual table colors

Implemented locally; no deployment. This document supersedes the display-mode
description in the earlier workspace milestone notes.

## Display modes

The workspace redesign reused the original `fullscreenClassroomBtn` as **Present**.
Its old core handler requested fullscreen on `#classroom`, hid the surrounding
controls, and tied presentation styling to `fullscreenchange`. There was no
independent fullscreen control. That legacy handler is removed; the workspace
adapter now owns both display actions.

- **Fullscreen**, beside Present, requests the document element through the
  standard browser Fullscreen API and shows only the classroom desks/tables.
  Header, toolbar, roster, settings, aisle buttons and presentation buttons are
  hidden. The classroom receives focus so **R** randomizes even after typing in
  a field; native **Escape** returns to the workspace. This follows the user's
  classroom-only correction after the initial Milestone 3H review.
  It never changes the independent Present toggle automatically.
- Labels and pressed states follow `fullscreenchange`, including native Escape.
  Denied or unavailable fullscreen produces a notice without changing classroom
  data or enabling presentation.
- **Present** is an independent, fixed classroom view with Randomize, Fullscreen
  and Exit presentation controls. It hides editing controls and does not request
  browser fullscreen. Both modes can run together. Exiting either retains the
  other; Escape first belongs to native fullscreen, then exits presentation when
  browser fullscreen is off.
- Saved logical geometry remains unchanged by fullscreen. Fullscreen uses an
  unscaled classroom display and restores the previous workspace zoom on exit.
  Fit mode is released at its current scale; select Fit again to fit the viewport.
  ResizeObserver and the existing frame-sizing path refresh visible dimensions.
  The one-pixel clearance that prevents the fractional scrollbar feedback loop
  is retained.

## Table color controls

Open a table's **Settings → Table color…**. The modal lives outside the zoomed
classroom surface. Its hue ring supports pointer capture, mouse/touch input,
arrow keys (one degree), Shift+arrows (ten), Page Up/Down (ten), Home and End.
Native saturation and brightness sliders support keyboard and touch input.
Eight named preset buttons, a student-name preview, Restore default, and an
optional advanced hex input provide alternative ways to choose colors.

Changes preview only on the selected table and its seats. Cancel/Escape restores
its previous appearance without saving. Apply uses the existing `saveTables()`
boundary without recreating seats. Dialog keystrokes cannot invoke classroom
randomization. Native modal focus containment and return to the table Settings
summary support keyboard use; the dialog scrolls on small screens.

`seatColor` remains the existing string field. New custom colors are opaque
six-digit hex strings. Restore default explicitly saves the existing `gray`
value. Named legacy colors retain their dashboard palette appearance. Existing
hex and other browser-supported CSS colors are retained in their original form
until explicitly changed. The core select adds an option for an unfamiliar saved
value so loading cannot discard older custom colors. No storage keys, backup
format, student records, assignment logic or migration rules change.

The table and seats inherit a shared background. Names and table titles use
whichever of pure black and white has higher WCAG relative-luminance contrast;
for opaque RGB backgrounds this meets 4.5:1. Seat borders use the same contrasting
ink. Grid retains its existing colors and records; its workspace hint explains
that individual colors apply to Table mode.

## Changed files in this milestone

Application:

- `webpages/SeatingChart.html`: display actions, color dialog, scripts and help.
- `css/seating-workspace.css`: display grouping, independent presentation overlay,
  table color variables and responsive color dialog.
- `javascript/seating_workspace.js`: independent display state, fullscreen API,
  table color entry point and Grid guidance.
- `javascript/seating_touch.js`: presentation-aware guards; native fullscreen
  retains editing capability and native Escape behavior.
- `javascript/Seating_Chart.js`: retain unfamiliar saved color values; remove only
  the legacy coupled fullscreen handler. Placement algorithms are unchanged.
- `javascript/seating_color_math.js`: pure HSV/hex and WCAG contrast helpers.
- `javascript/seating_colors.js`: color preview, controls and existing save adapter.

Verification:

- `tests/seating-colors.test.js`: color conversion, round trips and contrast.
- `tests/seating-workspace.test.js`: audited core hash updated after the two
  narrowly reviewed core changes; backup/recovery hashes remain unchanged.
- `tests/browser/seating-workspace-tests.js`: denied fullscreen test targets the
  new Fullscreen action.
- `tests/browser/seating-display-color-harness.html` and
  `tests/browser/seating-display-color-tests.js`: isolated synthetic scenarios.
- `scripts/serve_seating_tests.py`: local regression server revisions all local
  scripts/styles, including dynamically loaded core, to avoid stale test assets.

## Verification and limitations

See the final verification results below. Browser scenarios are restricted to
`http://127.0.0.1:8873`; they use synthetic classes and never inspect production
classroom storage. Run `node --test tests/*.test.js`, then serve the repository
with `python scripts/serve_seating_tests.py` for the browser harnesses.

Native fullscreen depends on browser support, permission and a user gesture.
Trusted-click fullscreen entry and both exit buttons were exercised in the
isolated in-app browser, including both display modes together. The initial
full-display screenshot with controls predates the classroom-only correction and
is superseded by the corrected fullscreen screenshot. The browser
provider's Escape injection did not exercise native browser exit, so native
Escape remains a manual Chrome check.

Automated API-state tests and CSS rendering-scale tests do not establish native
Chrome fullscreen behavior at browser zoom 80%/100%. Windows Chrome control was
stopped by the inspection tool because it could not reliably determine the
current URL. Real Chrome verification remains required, including native Escape,
both display modes together, and the previously affected maximized configuration.
Emulated touch testing does not replace real tablet/phone testing. No pinch zoom,
vendor-prefixed fullscreen polyfill or new dependency is introduced.

Legacy transparent CSS colors are displayed composited over the navy panel;
their stored strings are not rewritten. Newly chosen colors are opaque.

### Results

- Node: **48/48 passed**; includes all previous data-protection/coordinate suites
  and three new color-math tests. Foreground contrast is checked over 4,096 RGB
  samples and extreme colors.
- Existing browser workspace: **30/30 passed**, including mouse and emulated touch
  editing at 34%, 73%, 100% and 150%, assignments, panel focus and backup controls.
- Existing browser reliability: **14/14 passed**, including all three randomizers,
  special names, locks, class switching, migration and storage failure handling.
- Existing visual stability: **46/46 passed** (24 matrix, 16 responsive, six
  fractional-scrollport cases). Idle seats showed zero position/size/font drift,
  zero child mutations and zero style mutations during the sampled periods.
- New display/color browser suite: **18/18 passed**, covering raw legacy color
  preservation, selected-table-only preview/cancel, preset/custom/default saves,
  reload/class/layout switching, keyboard and synthetic pointer operation,
  unscaled 320/390px dialogs at 10–200% workspace zoom, AA text, save failure,
  Grid preservation, independent display modes, presentation colors/accessibility,
  classroom-only fullscreen, R randomization, return to editing, and fractional
  resize stability at rendering scales 80/100%.
- Syntax checks and `git diff --check` passed. No console errors were recorded in
  the synthetic browser scenarios or interactive preview.

Review images and raw stability/display outputs are saved in the task's local
visualization directory (`3h-*` files). Desktop, tablet (768×1024), mobile
(390×844) picker and native in-app fullscreen images are included. The mobile
dialog scrolls internally; its bottom-view screenshot shows Apply and Restore
default accessible without page overflow.
