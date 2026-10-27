# Seating Chart backups, recovery and reliability — Milestones 3B–3C

The classroom interface and placement algorithms are retained. New controls provide
an opening safety copy, a current-data backup, and an explicitly confirmed restore.
No records are uploaded, and there is no online backup account or backend.

## Opening capture and startup

`webpages/SeatingChart.html` loads `seating_backup_core.js` and
`seating_data_protection.js` synchronously in the head. The controller captures raw
values immediately, before the legacy application script is loaded or initialized.
The opening copy stays in memory for this page visit; it is **not** a durable backup
until the user downloads it. Reloading creates a new opening copy from that moment.

**Backup Classroom Data** downloads the opening copy, including pre-migration values.
**More backup options → Backup Current Classroom Data** reads what is saved now,
including edits since startup. Both exports are read-only. Browser download
requests can be blocked or silently refused, so the UI asks users to check Downloads
and never claims that the file was successfully written to their device.

The existing `DOMContentLoaded` initialization callback is now the named function
`initializeSeatingChart`, called once after the controller safely captures data.
Milestone 3C also fixes assignment loading, live table redraws, constraint selectors,
shortcuts, migration duplication and zero positions. If storage is unavailable, a
recovery is pending, or stored JSON cannot be opened, the application stays paused
but available backup/restore controls remain usable. Malformed raw records are not
corrected or discarded by the backup code.

## Version 1 backup format

```json
{
  "format": "chriswellsdev-seating-backup",
  "version": 1,
  "createdAt": "2026-10-27T12:00:00.000Z",
  "sourceOrigin": "https://chriswellsdev.com",
  "entries": [
    { "key": "classList", "value": "[\"default\"]" },
    { "key": "seatingChartData_default", "value": "{malformed but preserved" }
  ]
}
```

`createdAt` is a UTC ISO timestamp. `sourceOrigin` is an HTTP(S) origin, or the
literal string `"null"` for opaque origins such as a directly opened local file.
The origin is informational; the application never navigates to or fetches from it.
The example is synthetic and does not describe a real classroom.

`entries` is an array of unique `{key, value}` records. Every value must be a string.
The inner strings are deliberately **not parsed and reserialized** during backup
or restore. Whitespace, invalid inner JSON, unknown fields, orphaned records, legacy
arrays, empty values, Unicode, and original name/ID representations survive.
The envelope itself must be valid JSON with a supported format/version. Unrelated
keys, duplicate keys, invalid metadata, and non-string values reject the whole file
before classroom writes begin. No existing classroom schema is renamed or migrated.

Namespace enumeration includes every key matching:

- `classList` exactly;
- `seatingChartData_` followed by any suffix;
- `tableLayouts` exactly;
- `currentTableLayout_` followed by any suffix;
- `tableLayouts_` followed by any suffix.

Enumeration is independent of `classList`, so unlisted classes and legacy/orphaned
records are included. Other website preferences are excluded and remain untouched.

## Non-destructive backup verification

Choose **More backup options → Verify Backup File** and select the downloaded JSON.
This uses the same envelope/entry validator as restoration, but never reads current
classroom storage, creates a restore preview, or writes data. It reports the saved-item
count and whether the file is structurally restorable. A separate warning identifies
malformed classroom JSON or incompatible known field shapes: raw restoration is still
possible, but normal classroom startup remains paused. Unknown fields are allowed.
This is structural validation, not a cryptographic checksum, a storage-capacity test,
or proof that every classroom constraint is satisfiable. Detectable download exceptions
produce an error; browsers do not always expose download cancellation or disk failure.

## Restore workflow

1. Choose **Restore Backup** and select a downloaded JSON file.
2. The controller validates the complete envelope and reads a fresh saved-state
   snapshot. This preview performs no writes.
3. Review counts of saved items to add, replace, or leave unchanged. Counts describe
   storage records, not students or classes. Existing items absent from the backup
   are retained and included in the unchanged count. A different source origin is
   called out. Close other Seating Chart tabs before continuing.
4. Check the explicit acknowledgment and press the dialog's **Restore Backup**
   button. Cancel, Escape, an invalid file, or an unchecked acknowledgment makes no
   classroom changes. A stale preview is rejected and must be prepared again.
5. Before writing any classroom records, save and verify a recovery journal. Apply
   only changed values, verify the resulting raw values, then remove the journal.
6. Keep the old application paused after success so its in-memory state cannot
   overwrite restored records. The teacher may download a current backup and then
   explicitly choose **Open Saved Classroom**, which reloads the page.

Import is a merge of the supplied records, not a deletion of everything else.
There is no call to `localStorage.clear()`. Normal restores never delete classroom
records absent from the file, and never modify unrelated storage.

## Failure recovery

The internal control key `chriswellsdev.seating-restore-journal.v1` contains the raw
before-image and intended writes. It is a temporary recovery note, separate from
the five unchanged classroom namespaces. It is not an importable classroom record
and cannot be supplied by a backup file. Successful restore/rollback removes it.
Its before-image is available through **Download Pre-Restore Safety Copy** when
recovery is pending or a restore has completed.

A write/verification/cleanup failure triggers rollback. Added keys are removed;
replaced values are put back exactly. With functioning storage, a failed restore
returns to the original raw state. Unrelated entries are never part of rollback.

**localStorage has no multi-key transaction.** If storage continues rejecting
writes, immediate rollback cannot be guaranteed. The journal is retained, normal
startup is blocked, and the UI offers a downloadable pre-restore copy plus
**Recover Original Classroom Data**. Recovery requires another preview and
explicit acknowledgment; it is never applied automatically on page load. Once
storage accepts writes again, recovery can finish. A different value written by
another tab is not blindly overwritten; the classroom remains paused for review.

A corrupt recovery note is not automatically deleted. Export available raw data
and seek assistance rather than opening the classroom against uncertain state.
The journal consumes storage space: if it cannot fit, restore stops before the
first classroom write. A storage/device/browser failure that also destroys the
journal cannot be recovered without a previously exported backup.

## Limits and deferred issues

- Keep a downloaded backup outside the browser, especially before restoring.
  The in-memory opening copy disappears when the tab closes.
- Other tabs, older app versions, extensions, browser settings, or external code
  can change storage. Fresh-preview checks and conflict-aware recovery reduce risk
  but do not provide a database transaction or a lock over other writers.
- Local `file:` pages have browser-dependent storage/download behavior. Use a local
  HTTP server for verification; production and test origins have separate data.
- Backups preserve malformed classroom records, but those records may still prevent
  the old application from opening. Import does not repair their classroom schema.
- Saved assignments now survive loading and redraws. Existing conflicting/impossible
  constraints are not automatically repaired. Old dangling locks cannot crash the
  randomizers, but may leave affected students unassigned with the existing warning.
- Migration retains legacy source keys and does not delete duplicates created by
  older versions. An occupied conflict-suffixed layout is preserved rather than
  overwritten. Existing manually edited layouts are not replaced by migration.
- Ordinary classroom operations spanning multiple saved items are not database
  transactions. A storage failure pauses editing; previously completed writes can
  remain, while the opening backup provides the pre-start recovery source. Unsaved
  in-memory edits are not included in a current-data backup.
- Backup files contain classroom names and student details. Keep them private on
  the user's device. This feature does not transmit them.

## Verification

No dependencies or build step are required. From the repository root run:

```text
node --test tests/seating-backup.test.js tests/seating-controller.test.js tests/seating-compatibility.test.js tests/seating-verification.test.js
python scripts/check_catalog.py
```

The Node tests use synthetic fixtures and isolated Map-backed storage. They cover
all five namespaces, raw round trips, malformed/unknown fields, cancellation,
preview counts, unsupported files, stale previews, unavailable storage, quota and
mid-write failures, journal cleanup failures, persistent failures with retry,
conflicting writers, startup ordering, read-only verification and detectable download
failure. Compatibility checks compare all three randomization functions against the
original implementation, permitting only the missing-table guard.

The browser harness at `tests/browser/seating-backup-harness.html` is guarded to
operate **only** on `http://127.0.0.1:8873`; it disables itself elsewhere without
reading storage. Start `python -m http.server 8873 --bind 127.0.0.1`, open that
loopback URL, and use its explicitly labeled synthetic seed buttons. Never use a
production origin or real classroom records. Test-only fixtures include multiple
classes, table locks, exact locks, attendance, assigned/unassigned students, grids,
aisles, legacy layouts, malformed JSON, and unknown nested fields.

The additional `tests/browser/seating-reliability-harness.html` uses the same origin
guard. Choose **Run Synthetic Reliability Tests** to run 14 real-DOM scenarios in
an iframe. These exercise load/reload, class switching, autosave, live redraws,
displaced students, special names and IDs, table deletion, all three randomizers
(12 runs each), dangling legacy constraints, keyboard filtering, repeated migration,
zero coordinates, startup corruption, and runtime blocked/full/malformed storage.
It leaves only synthetic test data on this dedicated origin. No dependencies are
installed. The browser checks do not imply exhaustive algorithm or cross-browser
coverage; impossible-constraint behavior retains the original semantics.

## Intentional seat reductions and runtime errors

Reducing a table's seat count retains assignments at surviving indices. Students in
removed seats remain on the roster and become unassigned. Exact locks to removed
indices are released; valid table-only locks remain. Increasing the seat count again
does not resurrect removed assignments. Deleting a table releases both exact-seat
and table-only locks to that table.

Classroom reads validate JSON and known field shapes; malformed raw records are never
replaced with defaults. Runtime read/write errors pause the workspace and show an
error beside the existing backup controls. Later editing writes stay blocked until
the page is reopened, avoiding repeated autosaves after failure. Download the opening
copy first. The version 1 backup envelope, original five key families, and classroom
storage schemas are unchanged.

Milestone 3C local verification on 2026-10-27: **34 Node tests passed**, **14 browser
scenarios passed**, and no browser console errors were recorded. Syntax checks,
the catalog/local-reference checker, and `git diff --check` passed. Classroom browser
testing used only the dedicated loopback origin and synthetic records. All three
placement algorithms match the original source except for the missing-table guard.
Other browsers and exhaustive impossible-constraint combinations were not tested.
