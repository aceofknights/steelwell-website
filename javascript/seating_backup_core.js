/* Classroom backup primitives. No DOM, network, or storage access on module load. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SeatingBackup = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = 'chriswellsdev-seating-backup';
  const VERSION = 1;
  // Internal recovery metadata, never interpreted as classroom data or imported from a file.
  const JOURNAL_KEY = 'chriswellsdev.seating-restore-journal.v1';
  const PREFIXES = ['seatingChartData_', 'currentTableLayout_', 'tableLayouts_'];

  function isClassroomKey(key) {
    return typeof key === 'string' && (key === 'classList' || key === 'tableLayouts' ||
      PREFIXES.some(prefix => key.startsWith(prefix)));
  }

  // Read-only application preflight. Raw backup validation deliberately does not parse values.
  function checkReadable(entries) {
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const requireValue = (condition, key) => { if (!condition) throw new Error('Unreadable saved classroom details (' + key + ').'); };
    entries.forEach(({ key, value: raw }) => {
      if (key.startsWith('currentTableLayout_')) return;
      const value = JSON.parse(raw);
      if (key === 'classList') {
        requireValue(Array.isArray(value) && value.every(name => typeof name === 'string'), key);
        return;
      }
      requireValue(object(value), key);
      if (!key.startsWith('seatingChartData_')) {
        Object.values(value).forEach(layout => {
          requireValue(object(layout) || Array.isArray(layout), key);
          const tables = Array.isArray(layout) ? layout : layout.tables;
          if (tables !== undefined) requireValue(Array.isArray(tables) && tables.every(object), key);
          if (layout.grid !== undefined) requireValue(object(layout.grid) &&
            (!('aisles' in layout.grid) || Array.isArray(layout.grid.aisles)), key);
        });
        return;
      }
      ['tables', 'manualStudentNames', 'gridSeats', 'studentGroups'].forEach(field => {
        if (field in value) requireValue(Array.isArray(value[field]), key);
      });
      requireValue((value.manualStudentNames || []).every(name => typeof name === 'string'), key);
      requireValue((value.studentGroups || []).every(object), key);
      requireValue((value.gridSeats || []).every(object), key);
      requireValue((value.tables || []).every(table => object(table) &&
        (!('seats' in table) || (Array.isArray(table.seats) && table.seats.every(name => typeof name === 'string')))), key);
      if ('gridSettings' in value) requireValue(object(value.gridSettings) &&
        (!('aisles' in value.gridSettings) || Array.isArray(value.gridSettings.aisles)), key);
      if ('studentsData' in value) {
        requireValue(object(value.studentsData), key);
        Object.values(value.studentsData).forEach(student => {
          requireValue(object(student) && (!('blacklist' in student) || Array.isArray(student.blacklist)) &&
            (!student.lockedSeat || object(student.lockedSeat)), key);
        });
      }
    });
    return true;
  }

  function verifyBackup(input) {
    const backup = validateBackup(input);
    let applicationReadable = true;
    try { checkReadable(backup.entries); } catch (_) { applicationReadable = false; }
    return { backup, entryCount: backup.entries.length, structurallyRestorable: true, applicationReadable };
  }

  function validateEntries(entries) {
    if (!Array.isArray(entries)) throw new Error('The backup must contain a list of saved items.');
    const seen = new Set();
    return entries.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
          !isClassroomKey(entry.key) || typeof entry.value !== 'string' || seen.has(entry.key)) {
        throw new Error('The backup contains an invalid, unrelated, or repeated saved item.');
      }
      seen.add(entry.key);
      return { key: entry.key, value: entry.value };
    }).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  }

  function readEntries(storage) {
    // Enumerate namespaces, not classList: orphaned and legacy records are included.
    const keys = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (isClassroomKey(key)) keys.push(key);
    }
    const entries = keys.map(key => {
      const value = storage.getItem(key);
      if (typeof value !== 'string') throw new Error('Saved data changed while it was being read. Try again.');
      return { key, value };
    });
    return validateEntries(entries);
  }

  function envelope(entries, sourceOrigin, createdAt = new Date().toISOString()) {
    return validateBackup({ format: FORMAT, version: VERSION, createdAt, sourceOrigin, entries });
  }

  function capture(storage, sourceOrigin) {
    return envelope(readEntries(storage), sourceOrigin);
  }

  function validateBackup(input) {
    const backup = typeof input === 'string' ? JSON.parse(input) : input;
    if (!backup || backup.format !== FORMAT || backup.version !== VERSION ||
        typeof backup.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(backup.createdAt) ||
        !Number.isFinite(Date.parse(backup.createdAt)) || new Date(backup.createdAt).toISOString() !== backup.createdAt ||
        typeof backup.sourceOrigin !== 'string') {
      throw new Error('This file is not a supported version 1 Classroom Data backup.');
    }
    if (backup.sourceOrigin !== 'null') {
      let origin;
      try { origin = new URL(backup.sourceOrigin); } catch (_) { /* Rejected below. */ }
      if (!origin || !['http:', 'https:'].includes(origin.protocol) || origin.origin !== backup.sourceOrigin) {
        throw new Error('The backup has an invalid website address.');
      }
    }
    return { format: FORMAT, version: VERSION, createdAt: backup.createdAt,
      sourceOrigin: backup.sourceOrigin, entries: validateEntries(backup.entries) };
  }

  function equalEntries(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function planRestore(storage, input) {
    const backup = validateBackup(input);
    const before = readEntries(storage);
    const current = new Map(before.map(entry => [entry.key, entry.value]));
    let added = 0, replaced = 0, identical = 0;
    const writes = [];
    backup.entries.forEach(entry => {
      if (!current.has(entry.key)) { added++; writes.push(entry); }
      else if (current.get(entry.key) !== entry.value) { replaced++; writes.push(entry); }
      else identical++;
    });
    const included = new Set(backup.entries.map(entry => entry.key));
    const retained = before.filter(entry => !included.has(entry.key)).length;
    return { backup, before, writes, added, replaced, identical, retained,
      unchanged: identical + retained };
  }

  function readJournal(storage) {
    const raw = storage.getItem(JOURNAL_KEY);
    if (raw === null) return null;
    const journal = JSON.parse(raw);
    if (!journal || journal.format !== 'chriswellsdev-seating-recovery' || journal.version !== 1) {
      throw new Error('The recovery record cannot be read. Keep an exported backup and do not open the classroom yet.');
    }
    return { format: journal.format, version: 1,
      before: validateEntries(journal.before), writes: validateEntries(journal.writes) };
  }

  function rollback(storage, journal) {
    const before = new Map(journal.before.map(entry => [entry.key, entry.value]));
    const errors = [];
    [...journal.writes].reverse().forEach(entry => {
      try {
        const current = storage.getItem(entry.key);
        const original = before.has(entry.key) ? before.get(entry.key) : null;
        if (current === original) return;
        // Do not clobber a newer value from another tab.
        if (current !== entry.value) throw new Error('Another window changed a saved item.');
        if (original === null) storage.removeItem(entry.key);
        else storage.setItem(entry.key, original);
      } catch (error) { errors.push(error); }
    });
    let recovered = false;
    try { recovered = equalEntries(readEntries(storage), journal.before); }
    catch (error) { errors.push(error); }
    if (recovered) {
      try { storage.removeItem(JOURNAL_KEY); }
      catch (error) { errors.push(error); }
    }
    if (errors.length || !recovered) {
      const error = new Error('Recovery is still needed. Saved data may be incomplete; keep the classroom closed and retry recovery.');
      error.recoveryPending = true;
      error.dataRecovered = recovered;
      throw error;
    }
    return { recovered: true };
  }

  function restore(storage, input, expectedBefore) {
    if (storage.getItem(JOURNAL_KEY) !== null) throw new Error('Finish the earlier recovery before restoring another backup.');
    const plan = planRestore(storage, input);
    if (expectedBefore && !equalEntries(plan.before, expectedBefore)) {
      throw new Error('Classroom data changed after the preview. Close other classroom tabs and preview the backup again.');
    }
    if (!plan.writes.length) return plan;
    const journal = { format: 'chriswellsdev-seating-recovery', version: 1,
      before: plan.before, writes: plan.writes };
    const rawJournal = JSON.stringify(journal);
    // This must succeed before the first classroom record is changed.
    storage.setItem(JOURNAL_KEY, rawJournal);
    if (storage.getItem(JOURNAL_KEY) !== rawJournal) throw new Error('The safety copy could not be verified. Restore was not started.');
    try {
      plan.writes.forEach(entry => storage.setItem(entry.key, entry.value));
      const merged = new Map(plan.before.map(entry => [entry.key, entry.value]));
      plan.writes.forEach(entry => merged.set(entry.key, entry.value));
      const expected = validateEntries([...merged].map(([key, value]) => ({ key, value })));
      if (!equalEntries(readEntries(storage), expected)) throw new Error('The restored data could not be verified.');
      storage.removeItem(JOURNAL_KEY);
    } catch (cause) {
      try { rollback(storage, journal); }
      catch (error) { error.cause = cause; throw error; }
      const error = new Error('Restore could not be completed. Your original classroom data has been put back.');
      error.rolledBack = true;
      error.cause = cause;
      throw error;
    }
    return plan;
  }

  function recover(storage) {
    const journal = readJournal(storage);
    return journal ? rollback(storage, journal) : { recovered: true };
  }

  return Object.freeze({ FORMAT, VERSION, JOURNAL_KEY, isClassroomKey, readEntries,
    envelope, capture, validateBackup, verifyBackup, checkReadable, planRestore, readJournal, restore, recover });
});
