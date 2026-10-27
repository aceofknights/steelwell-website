# Milestone 3I — Automatic classroom scaling

Implemented locally; no deployment. Supersedes previous notes about preserving
workspace zoom across fullscreen/class/layout changes: these now automatically
fit the complete arrangement.

## Calculation and view behavior

The classroom keeps its original logical coordinate plane. For tables, bounds
are the minimum left/top and maximum right/bottom across each table's full
unscaled dimensions. For Grid, a deterministic logical grid width accommodates
all configured columns (160 logical pixels per column plus the configured gaps);
88-pixel logical rows accommodate all configured rows. The displayed desk width,
height, gaps and text scale together. Long names cannot expand grid tracks.

For available width W and height H, reserve the existing one-pixel fractional
rounding clearance and 12 pixels on each edge, then calculate:

```
s = min(1, (W - 24) / bounds.width, (H - 24) / bounds.height)
x = (W - bounds.width * s) / 2 - bounds.left * s
y = (H - bounds.height * s) / 2 - bounds.top * s
transform = translate(x, y) scale(s)
```

Automatic fitting has no 10% floor, so extreme rooms can still fit. Small rooms
are not enlarged beyond 100%. Empty rooms use 100%. The fit frame fills the
visible workspace with one pixel of clearance; clipping is prevented by fitting
the complete measured bounds before hiding scrollbars.

Fullscreen uses a fixed, unscaled viewport frame containing the visually fitted
classroom. Only seating is displayed; R still randomizes and native Escape exits.
Presentation controls live outside the transformed classroom so they retain
normal sizes in Present. They remain hidden in native fullscreen.

Automatic fitting runs on load, class/layout/mode changes, grid/table updates,
fullscreen transitions, outer workspace resizing and sidebar changes. One queued
animation-frame pipeline handles changes. Identical bounds/viewport signatures
skip fit writes. ResizeObserver compares the outer viewport rectangle so changes
in scrollbar thickness cannot repeatedly turn manual zoom back into automatic
fit. The previous `clientWidth - 1` / `clientHeight - 1` correction remains intact.

Manual zoom/Pan and Edit Tables temporarily release auto-fit for close-up work.
The existing inverse pointer conversion uses the actual displayed scale and room
rectangle. Fit translation remains stationary during a drag or resize. Touch edit
mode suspends automatic refitting when its guidance changes workspace height,
preventing the coordinate system from changing under a finger. Fit to Room or a
subsequent class/layout/fullscreen/normal viewport change returns to full-room fit.

No classroom model, student name, assignment, table color, coordinate, dimension,
constraint, storage key, backup format, migration or randomization algorithm is
changed. The core and backup/recovery file hashes remain protected by Node tests.

## Changed files

- `javascript/seating_workspace.js`: default auto-fit, complete bounds, centering,
  display-frame fitting, resize filtering and fixed editing scale.
- `javascript/seating_view_math.js`: pure `autoFit` geometry helper; existing
  manual zoom range and helpers retained.
- `css/seating-workspace.css`: transformed classroom inside fixed fullscreen
  frame, bounded grid tracks and scrollbar-free fitted view.
- `webpages/SeatingChart.html`: updated teacher guidance.
- `tests/seating-view-math.test.js`: fit bounds, centering and below-10% scales.
- `tests/seating-frame-sizing.test.js`: renderer context updated; original
  fractional-size regression assertions retained.
- `tests/browser/seating-workspace-tests.js`: manual-interaction cases explicitly
  choose 100% editing zoom; class/layout expectations now check automatic fit;
  exact-scale touch fixtures use the new margin calculation.
- `tests/browser/seating-display-color-tests.js`: explicit manual test zoom and
  automatic-fit expectations after fullscreen transitions.
- `tests/browser/seating-autofit-harness.html` and `seating-autofit-tests.js`:
  synthetic size/shape, fullscreen, resize, sidebar, persistence and idle tests.
- This report.

## Verification scope

Use `node --test tests/*.test.js`. Browser harnesses are restricted to disposable
`http://127.0.0.1:8873`, served by `python scripts/serve_seating_tests.py`.
No production classroom records are inspected or seeded.

The new suite measures actual element rectangles against the visible frame for
small 2×2, large 30×30, wide 2×60, tall 60×2 and 120×2 grids, at desktop/mobile
widths, and three widely separated tables. It checks native-API-state fullscreen
entry/exit, viewport/sidebar/class changes, added/removed tables, grid dimension
changes, saved geometry after reload and fullscreen R randomization.

Rendering scales 80%, 100% and 125% are CSS emulations, not actual Chrome browser
zoom. Each idle sample checks rectangle stability and counts mutations. Actual
Chrome browser zoom and native Escape still require manual verification; the
Windows inspection tool previously could not identify Chrome's URL reliably.

Extremely large classrooms fit completely but their names can become unreadable.
For example, a 120-row mobile grid requires roughly 2.6% scale. Names remain
stored in full; use temporary editing zoom for close inspection. Synthetic touch
tests do not replace physical tablet/phone testing.

## Results and measurements

- **49/49 Node tests passed**, including the original fractional frame-sizing
  checks and the new bounds/centering/extreme-scale test.
- **126/126 browser scenarios passed**: 30 workspace/mouse/touch, 14 reliability,
  18 color/fullscreen, 46 existing visual-stability and 18 automatic-fit cases.
- Syntax checks and `git diff --check` passed. Synthetic preview and final suite
  console checks recorded no new errors.
- Existing core, backup core and backup controller SHA-256 hashes are unchanged.
- The 24-case stability matrix, 16-case responsive sweep and six fractional
  scrollport cases recorded zero idle geometry drift and zero style/child
  mutations. New 80/100/125% CSS rendering-scale samples likewise recorded zero
  clipping, zero workspace scrollbars and zero idle mutations.

Three tables with a combined logical bounding rectangle of 2080×2000 were used
for the before/after comparison. “Before” is an explicit unfitted 100% view of the
same fixture, rather than a screenshot of an older code checkout.

| Visible workspace | View | Scale | Clipped tables | Workspace scrollbars |
| --- | --- | --- | --- | --- |
| 994×636.5 | Unfitted baseline | 100% | 2 of 3 | Both |
| 994×636.5 | Automatic fit | 30.5% | 0 of 3 | None |
| 1920×1080 | Native in-app fullscreen | Fitted | 0 of 3 | None visible |

A trusted fullscreen click was exercised in the in-app browser. Actual table
rectangles all remained inside its 1920×1080 frame, with editing controls hidden;
a real keyboard R event changed assignments successfully without console errors.
Native Chrome zoom and native Escape remain manual checks as described above.

Review screenshots are saved in the task visualization directory:
`3i-desktop-auto-fit.png` (1360×900), `3i-mobile-auto-fit.png` (390×844), and
`3i-fullscreen-auto-fit.png` (1920×1080). Raw test outputs are saved as
`3i-*-results.txt` and `3i-stability-*.txt`; fullscreen measurements are in
`3i-native-fullscreen-measurement.json`.
