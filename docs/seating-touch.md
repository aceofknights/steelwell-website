# Seating Chart touch editing — Milestone 3F

## Pre-implementation inspection

The existing table/resize mousedown handlers, document mousemove/mouseup handlers,
`classroomPointer`, workspace scaling/frame sizing, Pan interception, seat click/
keyboard assignment, contextual Settings, backup gating and regression suites were
reviewed before implementation.

Conflicts to resolve:

- Touch browsers can synthesize mouse events after a tap. The legacy mouse handler
  treats table/seat mousedown as a table drag and may save on mouseup. Compatibility
  mouse events must not start a second edit after touch, while normal tap clicks
  must remain available for seat selection.
- The legacy resize corner uses `touch-action:none`, which can consume a scrolling
  gesture even when the user did not explicitly choose to edit tables.
- CSS zoom changes physical pointer deltas. Touch must use the existing logical
  classroom coordinate contract and keep view scale stable for a gesture.
- Pan and table editing cannot own the same gesture. Fullscreen, class/layout
  switches, backup pauses, multi-touch and lost capture must cancel pending edits.
- A resize grip scaled with a 34% room would be too small. Edit-mode controls need
  inverse scaling and targets of at least 44 physical CSS pixels.

## Interaction contract

Edit Tables is explicit and initially off. Normal mode retains native workspace
scrolling and seat tapping; desktop mouse header dragging and corner resizing retain
their existing handlers. Edit mode exposes Move, Settings and Resize controls and a
readable status. Seats cannot assign names while Edit mode is active. Done Editing
returns to normal. Pan and Edit are mutually exclusive.

One touch/stylus pointer owns a gesture with pointer capture where available. The
controller converts `(clientX - roomRect.left) / zoom` and the equivalent Y coordinate
through the existing `classroomPointer` helper. It snapshots starting geometry,
logical canvas bounds, and scale. Movement/resizing is clamped to those bounds, with
the existing 220px minimum dimensions. Only successful pointerup saves, through the
existing `saveTables` function; no storage API, schema, key or algorithm is added.
Cancellation restores the original inline geometry without saving. Mode/view/class
changes and backup pause also cancel. Interrupted gestures never auto-commit.

Position & size fields in existing table Settings provide a non-gesture alternative.
They apply the same bounds/minimums and save through the same existing pipeline.
All controls retain table ancestry so legacy selectors still resolve them.

Touch editing adds no pinch zoom. View zoom, Fit, and Pan retain their existing roles.
At very low overview zoom, enlarge the view if controls overlap. No real classroom
records may be used for testing; the loopback harness uses synthetic data only.

The mode-status band keeps a stable height and does not reflow its visible message
under an active pointer. Otherwise, changing guidance could shift the room origin
mid-gesture. View scale is locked during editing; native scrolling remains available
away from Move/Resize grips. A new real mouse pointer is distinguished from touch
compatibility mouse events, allowing immediate mouse use after touch.

## Synthetic verification and its limits

Run `node --test tests/*.test.js`, then the two guarded loopback browser harnesses.
The workspace harness injects **synthetic `PointerEvent` objects with pointerType
touch** into a real browser DOM. It is not a physical-device test or trusted browser
touchscreen injection. Compatibility mouse events and lost capture are explicitly
simulated. Because synthetic pointer IDs are not registered native pointers, native
pointer capture can reject them; document tracking is exercised as a fallback.
Actual OS/browser capture, scrolling arbitration, click synthesis, and multi-touch
recognition still require real-device testing.

The expanded scenarios cover 34% mobile Fit, 73% tablet Fit, 100% and 150%, movement,
resizing, scrolled rooms, reload persistence, cancellation/lost capture/second pointer/
blur/Escape, normal seat taps, compatibility mouse suppression, Pan/Edit exclusivity,
Settings/numeric geometry, mouse editing after touch, class/layout switches, zero
coordinates, 220px minimum dimensions, settings/randomization interruption, backup
pause and failed saves. No production classroom records are used.

## Required manual device review

Use only a disposable synthetic classroom and exported backup on:

1. iPad/iPhone Safari and Android Chrome: scroll over seats and table corners in normal
   mode; confirm there is no table movement, and a deliberate seat tap assigns once.
2. Move and resize at 34%, 73%, 100% and 150%, including after scrolling both axes.
   Check 44px grips, Settings access, Done Editing and numeric Position & size fields.
3. Drag off a grip, interrupt with another finger, long press, rotate the device,
   background the browser, or lock/unlock it. Confirm cancellation keeps the original
   saved position and size; then reload to verify the saved result.
4. Switch class/layout, enter presentation, or open backup recovery while editing.
   Check that unfinished geometry is not saved and new classes open in normal mode.
5. On a hybrid device, alternate finger, stylus and mouse immediately. Check mouse
   header drag/resize, keyboard focus and the non-gesture geometry form.

Known limits: no custom pinch zoom, no multi-pointer table editing, no touch auto-pan
at workspace edges, and no per-device tuning verified yet. Grips can obscure labels
or overlap on small tables at overview zoom; zoom in for detailed editing.
Boundary clamps are captured at gesture start. Storage errors pause editing through
the existing backup gate; an exported backup is still required for device/browser loss.

Changed files: `webpages/SeatingChart.html`, `css/seating-workspace.css`,
`javascript/seating_workspace.js` (view coordination only), new
`javascript/seating_touch.js`, `tests/seating-workspace.test.js`,
`tests/browser/seating-workspace-tests.js`, `docs/seating-zoom.md`, and this document. The legacy application,
backup core, recovery controller and view-math helper are unchanged.

Local results: **43 Node tests passed**, **30 workspace browser scenarios passed**,
and **14 prior reliability scenarios passed**, with no console errors. Syntax,
local-reference and whitespace checks passed. Native numeric Position & size controls
were exercised separately; screenshots show desktop, 73% tablet Edit mode, and 34%
mobile Edit mode with synthetic records. Actual touch-device validation remains the
manual checklist above and has not been performed.
