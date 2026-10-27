# Seating Chart view controls — Milestone 3E

Milestone 3F adds explicit touch table editing on this coordinate foundation; see
[the current touch interaction and device-review plan](seating-touch.md). The touch
editing deferral below describes the 3E baseline.

## Inspection and coordinate contract

Before implementation, the 3D HTML/CSS/adapter, table mousedown handlers, document
mousemove/mouseup handlers, table/grid label fitting and existing regression suites
were inspected. Saved geometry is in logical classroom pixels. Previously drag
offsets and resize deltas used client pixels and scaled DOM rectangles interchangeably;
CSS transforms alone would therefore move/resize the wrong distance.

The view now uses `#workspaceViewport` (native scrollport), `#workspaceZoomFrame`
(scaled scroll extent), and the existing `#classroom` (logical coordinate plane).
The room is visually transformed with a top-left origin; no saved geometry is scaled.
For scale `s` and the room's current screen rectangle:

```text
logicalX = (event.clientX - roomRect.left) / s
logicalY = (event.clientY - roomRect.top)  / s
dragOffset = logicalPointerAtStart - table.offsetPosition
newPosition = logicalPointerNow - dragOffset
newDimension = originalDimension + logicalPointerNow - logicalPointerAtStart
```

Native scrolling is already included in `roomRect.left/top`, so scroll offsets must
not be added again. Clamps use unscaled `clientWidth/clientHeight` and table
`offsetWidth/offsetHeight`. The existing 220px resize minimum is unchanged. Seat hit
testing uses the browser's transformed DOM; no duplicate seat map or synthetic pointer
dispatch is used in production. Table font calculations divide screen rectangles by
the view scale before choosing logical font sizes, avoiding double scaling.

Only the legacy **UI coordinate and font-size calculations** change. All three
randomization functions, constraints, migration, storage names/formats and assignment
persistence remain unchanged. Backup core and recovery controller are byte-for-byte
unchanged. Existing saves serialize logical style values, never view/scroll state.

## View behavior

- Zoom In/Out use 10 percentage-point steps, constrained to **10–200%**.
- Changing zoom retains the visible center where scroll limits allow. Reset Zoom
  returns to 100% and the top-left. View state is in memory only.
- Fit to Room uses the bounding union of actual tables, or the grid dimensions,
  rather than the minimum blank canvas. It reserves 16px on each side, centers
  the contents where scroll limits allow, and does not enlarge beyond 100%.
- Empty rooms fit at 100% with explanatory feedback. Very large rooms can exceed
  the available viewport even at the 10% minimum; native scrolling remains available.
- Fit follows viewport resizing while active. Starting a table edit or Pan gesture
  stops automatic fitting, so scale does not jump during an edit. Zoom buttons are
  disabled during a mouse edit.
- Class/layout/mode changes reset zoom and scrolling. Adding students or changing
  attendance retains the view. The reset is driven by visible selector values;
  cancelled selection changes leave the view intact.
- The outer frame clips unscaled overflow and sizes its scroll extents to the scaled
  canvas. The page itself never needs to grow horizontally for a zoomed room.
- Native wheel/trackpad/touch scrolling stays local to the workspace; no global
  wheel, browser-zoom, or touch-gesture interception is added. Pan is an explicit
  mouse mode that scrolls the viewport instead of starting table editing.
- Fullscreen presents at its own unscaled size and restores the workspace view on
  exit. Editing remains disabled during presentation.

## Panels and guidance

Only one Class options, Layout settings, or table Settings disclosure opens at once.
Done and Escape return focus to its summary; opening through the keyboard focuses
its first control. Outside clicks close disclosures without stealing the click.
Collapsed student controls remain inert; focus returns to Students when needed.
Table settings compensate for zoom so the input panel remains at normal readable
size, and its position is clamped to the workspace viewport. All original controls
and their handlers remain in their original table ancestry.

Help now covers roster entry, attendance, table/grid creation, assignment, randomizing,
locks/separation rules, layouts, current/opening backups, verification/restoration,
view navigation and presentation. Touch table editing is deliberately deferred.

## Verification

```text
node --test tests/*.test.js
python scripts/check_catalog.py
```

Use the existing guarded `tests/browser/seating-workspace-harness.html` on
`http://127.0.0.1:8873` for the expanded view/workflow tests, and the existing
`seating-reliability-harness.html` for all 3C regressions. Both use synthetic data
only. The math tests cover scale limits, inverse coordinates, center anchors and
empty/large content fitting. Browser cases cover responsive overflow, Fit, 50%/150%
drag and resize after scrolling, browser seat hit testing and assignment, Pan without
writes, resets, empty/grid rooms, panel focus and readable zoomed settings.

## Limits

At very low zoom, seats and table Settings summaries can be too small for detailed
editing; zoom in first. Long-name and impossible-constraint limits remain as before.
Browser zoom is separate from classroom zoom. Touch editing and physical touch-device
testing are outside this milestone. Modern CSS transforms, native dialogs, inert,
ResizeObserver and fullscreen support remain required. No deployment is performed.

## Recorded local results

42 Node tests passed (all prior tests plus five geometry tests). All 18 workspace
browser scenarios and 14 prior reliability scenarios passed. The browser suite now
fails a scenario if it records an unexpected JavaScript error. An initial
document-target keyboard-event guard error was corrected and the suite rerun.
Native keyboard panel focus, native fullscreen from 80% zoom, R randomization and
return to 80% were checked separately with no console errors. Screenshots are
1440×960 desktop, 768×1024 tablet and 390×844 mobile; responsive tests also cover
1024px and 320px. Fixtures and browser storage were isolated to the loopback test
origin. Cross-browser engines and physical touch hardware were not tested.

Changed files: `webpages/SeatingChart.html`, `css/seating-workspace.css`,
`javascript/seating_workspace.js`, `javascript/Seating_Chart.js` (pointer/font UI
calculations only), new `javascript/seating_view_math.js`,
`tests/seating-workspace.test.js`, new `tests/seating-view-math.test.js`,
`tests/browser/seating-workspace-tests.js`, `docs/seating-workspace.md`, and this file.
