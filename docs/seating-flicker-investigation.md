# Milestone 3F.1 — visual stability investigation

Historical findings: the affected Chrome session was subsequently reached in
Milestone 3F.2. See [the live diagnosis and correction](seating-live-chrome-flicker.md).

## Status

The reported continuous Grid flicker has **not been reproduced** in the available
Chromium-based in-app browser on Windows. This is not evidence that the user's
Chrome report is resolved. No production application code or CSS was changed;
there is no claimed repair or confirmed root cause and no before/after fix comparison.

All records used here are synthetic, exclusively on `http://127.0.0.1:8873`.
No production classroom records were read, exported, or changed. Nothing was deployed.

## Source inspection

- `Seating_Chart.js`: `createGrid`, `setSeatStudent`, `fitGridSeatName`,
  `fitAllGridSeatNames`, table geometry and mouse handlers. Grid seats are created
  on loading/rebuilding the grid; assignments schedule name fitting. The binary
  font search writes several intermediate font sizes synchronously, ending before
  the next paint. This alone does not demonstrate a visible oscillation.
- `seating_workspace.js`: `enhance`, `queue`, `sizeCanvas`, `renderView`, `fitView`,
  room/roster child-list observers, table-only style observer and viewport resize
  observer. The adapter refits grid names when it enhances the workspace. Name
  style mutations are ignored by the table-only geometry observer. Repeated
  enhancement remains a hypothesis only if an external trigger keeps firing.
- `seating_touch.js`: child-list enhancement, seat focus attributes and pointer
  handlers. Its attribute writes are not observed by its child-list observer.
  Idle Grid mode does not have active table drag/resize processing.
- `seating_view_math.js`: pure scale, Fit and anchor calculations; no timers,
  observers or model mutation.
- `styles.css`, `dashboard.css`, `seating-workspace.css`: fixed 88 CSS-pixel grid
  seat height, fractional grid tracks, clipped labels, font and inherited rules.
  Classroom transitions are explicitly disabled. Scrollport dimensions feed the
  logical canvas and zoom frame; scrollbar feedback was investigated rather than
  presumed to be the cause.

No diagnostic instrumentation was added to production files.

## Reproduction and measurement

Open `tests/browser/seating-stability-harness.html` through the dedicated loopback
server, with other synthetic test runners stopped. **Run Stability Matrix** seeds
30 fictional students, including a long compound name and Unicode/punctuation,
an 8 × 6 grid and a separate six-table class. It covers both modes, sidebar open
and closed, 100%, Fit and 150%, before and after randomization, at zero and nonzero
workspace scroll offsets (where the content allows scrolling).

**Run Viewport Sweep** checks Grid with the sidebar open at 320 × 740,
390 × 844, 768 × 1024, 1024 × 768, 1280 × 960, 1360 × 960, 1440 × 960 and
1920 × 1080, at 100% and Fit. Compact sidebars overlay the workspace by design.

Each case waits for application initialization, `document.fonts.ready`, and a
300 ms settling period, then samples every animation frame for at least three
seconds. All seat rectangles (x/y/width/height), computed name font sizes, viewport
dimensions and scroll offsets are read. Original element identities, child-list
and style mutation counts, grid fitting calls, and resize notifications are tracked.
The resize count includes the observer's mandatory initial notification; it is
not itself a count of actual viewport changes. These are DOM-level measurements,
not a GPU/compositor trace or proof of the absence of a paint-only artifact.

The test rejects geometry/font/scroll drift above **0.25 CSS px** (a small allowance
for subpixel rounding, below a whole CSS-pixel jump), element replacement, child-list
churn, or repeated fitting. It also requires at least 30 frames and loaded seats,
preventing an empty/uninitialized fixture from passing vacuously. Inline style
mutations are reported even when they do not move geometry.

Machine-readable measurements are in `seating-stability-matrix.json` and
`seating-stability-viewports.json`. The `first`/`last` arrays contain first-seat
`[x,y,width,height,fontSize]`; `maxDelta` covers **every** seat during the sample.
Coordinates are relative to the classroom document inside the test iframe.

Recorded results: **24/24 matrix cases and 16/16 viewport cases passed**. Each
sample contained approximately 718–722 animation frames. Every case recorded zero
maximum x/y/width/height/font-size drift, zero scroll drift, stable seat identity,
zero room child-list/style mutations and zero repeated grid-fit calls during idle
sampling. Each resize observer delivered only its initial notification.

For the reported-like Grid/open/100% case, the first seat stayed at
`x=327, y=228, width=153.328125, height=88`, font size `17px`, across 718 frames and
3003 ms. The viewport stayed `737 × 570`, with both scrollbars present. The long
name label measured `137 × 70` within an available `137 × 72` logical-pixel area.
These are beginning/end measurements of unchanged code, **not before/after a fix**.

The added files are this report, the two measurement JSON files, and
`tests/browser/seating-stability-harness.html` / `seating-stability-tests.js`.
The test-only `seed`, `sample` and matrix/sweep handlers are the new functions;
no production function changed. **Prepare Synthetic Preview** also seeds a full-page
manual reproduction through the adjacent application link. Test controls are
disabled outside the dedicated origin and while another diagnostic run is active.

Existing checks: **43/43 Node tests**, **14/14 reliability browser scenarios**
(including all three randomizers), and **30/30 workspace/touch browser scenarios**
passed. No browser console errors were captured in these runners or the stability
runner. JavaScript syntax, catalog/local references and `git diff --check` passed.
The touch suite remains browser-emulated, not real-device verification.

A separate full-page 1100 × 850 synthetic preview matched the reported setup
(Grid, 100%, roster open, both scrollbars). A short 20-read DOM probe also showed
unchanged geometry; it is supplemental and does not replace the three-second
per-frame iframe tests. A screenshot is saved as `seating-stability-grid.jpg` in
the task's visualization directory. It illustrates conditions, not motion evidence.

## Long names

The existing fitter bounds names to the seat's logical width and height. The
synthetic long names are checked for containment separately from movement. Stored
strings are not truncated. Full names remain in the seat's native title, accessible
name and assignment prompt. Arbitrary word wrapping can look awkward and very long
names become small; no speculative typography change was bundled with this
unreproduced regression. A native title is primarily a pointer-hover affordance;
keyboard/screen-reader users retain the accessible full name and assignment action.

## Remaining uncertainty and next reproduction

Only the in-app browser is connected; the affected standalone Chrome profile,
version, GPU/compositor, browser zoom, Windows display scaling and extensions were
not available for comparison. Iframe tests can differ from a top-level page.
Candidate causes still requiring evidence include a viewport/scrollbar threshold,
late font changes, cached or different application revisions, or paint-only
compositing behavior. None is a confirmed diagnosis.

Run this same synthetic harness in the affected Chrome environment first. Preserve
the JSON result lines and note browser version, browser zoom, display scaling and
viewport dimensions. If motion occurs with stationary DOM measurements, capture
a screen recording and a rendering/compositor trace. If measurements oscillate,
the geometry, font, viewport, mutation and identity fields narrow the responsible
path before editing production code. No real classroom backup is needed to run it.
