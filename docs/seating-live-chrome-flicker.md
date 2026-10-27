# Milestone 3F.2 — confirmed live Chrome scrollbar feedback

## Live connection and observation

Windows Computer Use successfully accessed the existing Chrome window at
`http://127.0.0.1:5501/webpages/SeatingChart.html`. Chrome was not restarted,
navigated away, or given a new profile. No cookies or classroom records were
cleared or read from storage. Live Server subsequently reloaded the same page
when local files were saved; application storage handling was unchanged.

The affected configuration was a maximized 1920 × 1080 Windows Chrome window,
**80% browser zoom**, 100% workspace zoom, student sidebar open and Grid mode.
The browser chrome remained visible: this was the maximized window, not the
application's Present mode. Device pixel ratio reported approximately 0.8 and
the page viewport was 2400 × 1196 CSS pixels. The user confirmed the issue was
visible at full window size. Individual screenshots showed scrollbars appearing
and disappearing; animation-frame measurements confirmed actual geometry motion.

Docking DevTools narrowed the viewport and masked the problem. Diagnostics were
therefore scheduled in the console, DevTools closed, and results read after the
idle sampling period. No seat clicks, assignment edits, randomization or storage
operations were performed by the diagnostic. Only numeric geometry and counts
were retained, without student names or classroom data.

## Confirmed cause

`seating_workspace.js` → `renderView()` sized `workspaceZoomFrame` to at least
`viewport.clientWidth` / `clientHeight`. Those DOM measurements are rounded
integers. At the affected browser scale:

- Scrollport border-box width: 2034.00390625 CSS px.
- Left and right computed borders: 1.25 CSS px each.
- Available inner width: **2031.50390625 CSS px**.
- Rounded `clientWidth`: **2032**.

The frame's viewport-filling minimum exceeded the actual available width by about
0.496 CSS px. This triggered a horizontal scrollbar, reducing height; a vertical
scrollbar then reduced width. The viewport `ResizeObserver` queued `enhance()` →
`sizeCanvas()` → `renderView()`, alternately resizing the logical display canvas
and frame as the scrollbars appeared and disappeared. `enhance()` also refitted
grid names on each iteration, producing additional font/style updates.

The viewport oscillated between **2032 × 930** and **2013 × 911**. Seats retained
their DOM identities; this was a layout feedback loop, not solely a paint or GPU
artifact. No graphics settings or extensions were changed.

## Controlled experiments and evidence

Each live measurement sampled all 36 rendered seats for four seconds. A temporary
observer counted mutations, viewport resize notifications and calls to
`fitAllGridSeatNames`; wrappers and observers were removed in `finally`.
Counts include one initial resize-observer notification in stable cases.

| Live condition | Frames | Max seat X drift | Max width drift | Max font drift | Grid refits | Mutations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original, sidebar open, maximized | 241 | 15.83984375px | 3.18359375px | 1px | 240 | 46,680 |
| Temporarily force scrollbars | 241 | 0 | 0 | 0 | 0 | 0 |
| Restore original scrolling | 241 | 15.83984375px | 3.18359375px | 1px | 240 | 46,680 |
| Temporarily cap frame width at 2031px | 242 | 0 | 0 | 0 | 0 | 0 |
| Remove temporary width cap | 241 | 15.83984375px | 3.18359375px | 1px | 240 | 46,680 |
| Saved correction, original full-width Chrome | 242 | 0 | 0 | 0 | 0 | 0 |

Seat Y/height and scroll offsets remained unchanged in these intervals. The first
seat alternated between widths 321.66015625 and 318.49609375 before the fix.
Afterward it remained at `[347.24609375, 228.41796875, 321.66015625, 87.98828125]`
with 62px text. The corrected viewport stayed 2032 × 930; room 2030 × 928 and
frame 2031 × 929. Seat identities remained stable.

An earlier width-cap trial was inconclusive because the window/sidebar changed;
its results were not used as proof. The repeated controlled trial and restored
state above established causality. Raw numeric evidence is saved in the task's
visualization directory as `seating-live-chrome-before.json` and
`seating-live-chrome-after.json`. No whole-browser Performance trace was exported;
the evidence is frame geometry, DOM mutation counts, resize counts and reversible
A/B/A intervention, rather than a compositor trace.

## Targeted correction

Only `renderView()` changes production behavior. Its viewport-filling minimum
is now `clientWidth - 1` / `clientHeight - 1`, bounded at zero. The one CSS-pixel
margin safely covers integer rounding of fractional scrollport dimensions.
The maximum still includes the **entire logical room size multiplied by zoom**,
so large/zoomed classrooms remain scrollable and are not clipped to the viewport.

No placement, dragging, resizing, Pan, presentation, constraints, randomization,
assignment, migration, backup/recovery or storage code was changed. The correction
does not force permanent scrollbars, turn off observers or suppress necessary
resizing. The temporary DevTools overflow and max-width values were restored.

## Regression coverage and running locally

Run `node --test tests/*.test.js`. The new frame-sizing test executes the actual
renderer with the measured rounded/fractional dimensions and checks full room
extents from 10% through 200% workspace zoom. It failed against the original
renderer and passes with the correction.

Start `python scripts/serve_seating_tests.py`, then open the three test harnesses
on **http://127.0.0.1:8873**. This loopback-only static server adds a revision query
to the adapter response and disables caching; it never modifies served files.
The common `seating-test-page.js` loader requests a fresh application URL. These
are test infrastructure, not deployment or application hosting changes. Plain
Python static-server heuristic caching initially kept an old adapter after edits;
the new loader/server ensures the suites exercise the saved revision.

**Run Fractional Scrollport Regression** uses 80% CSS zoom plus the measured
fractional scrollport/border dimensions. CSS zoom is an isolated approximation of
the device-pixel rounding, not a claim to be native browser zoom. A fractional
width alone at DPR 1 did not reproduce the defect. The enhanced fixture caught
the old Grid and Table resize loops. A normal browser-zoom test in the actual
affected Chrome session separately verifies the real environment.

The existing stability matrix and viewport sweep still cover open/closed
sidebars, Grid/Table modes, 100%/Fit/150%, randomization, scrolling and widths
320–1920. Each case waits for fonts/startup and samples every frame for three
seconds. In addition to a 0.25 CSS-pixel geometry/scroll tolerance and unchanged
identity, cases now reject idle style/child-list churn, multiple viewport sizes
or repeated resize notifications. A table can have stationary seats while its
scrollport still oscillates, so geometry alone is insufficient.

## Files changed for 3F.2

- `javascript/seating_workspace.js`: two frame-sizing expressions and explanation.
- `tests/seating-frame-sizing.test.js`: measured fractional-boundary and zoom-extent tests.
- `tests/browser/seating-stability-harness.html`, `seating-stability-tests.js`:
  fractional-scale cases, stricter idle stability checks and fresh-page loader.
- `tests/browser/seating-test-page.js`: shared fresh application loader.
- `tests/browser/seating-workspace-harness.html`, `seating-workspace-tests.js`,
  `seating-reliability-harness.html`, `seating-reliability-tests.js`: use that loader.
- `scripts/serve_seating_tests.py`: cache-safe synthetic-only loopback server.
- This report and a historical-status note in `seating-flicker-investigation.md`.

## Limits

The live diagnosis used the existing classroom view without accessing its storage
records. All automated regression fixtures used isolated synthetic data on port
8873. Saved-data/algorithm guards remain in the Node suites. Real touch-device
verification remains outstanding from earlier milestones. Other browser/display
scale combinations are covered by the general rounding safeguard and synthetic
tests, but have not all been manually inspected. Nothing was deployed.

## Final verification

- **45/45 Node tests passed**, including measured fractional frame sizing, full
  zoomed room extents, unchanged logical dimensions, algorithm compatibility and
  unchanged application/backup/recovery hashes.
- **46/46 stability browser cases passed**: six fractional-scale cases, 24 ordinary
  mode/sidebar/zoom/randomization/scroll cases and 16 viewport sweep cases.
- **14/14 reliability browser scenarios passed**, including all three randomizers,
  assignment persistence, table edits, constraints, storage errors and migration.
- **30/30 workspace/touch browser scenarios passed**, including dragging/resizing,
  Pan, zoom, focus, backup/restore/verification, class/layout switching and synthetic
  touch interactions at 34%, 73%, 100% and 150%.
- No console errors were captured in the final browser runners. JavaScript/Python
  syntax, catalog/local-reference validation and `git diff --check` passed.

The affected standalone Chrome was verified separately at its original browser
zoom and window size; the evidence above is not based solely on synthetic passes.
User visual confirmation is still pending. The browser was left on the classroom
with its sidebar open, at 100% workspace zoom, with DevTools closed. Existing
unrelated local changes were retained. No deployment or commit was performed.
