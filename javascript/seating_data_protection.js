/* Runs in the head: no classroom script is loaded until the raw opening capture is safe. */
(function () {
  'use strict';
  const core = window.SeatingBackup;
  let storage, openingBackup, pendingJournal, openingError;
  let hasJournal = false;
  try {
    if (!core) throw new Error('The backup helper did not load.');
    storage = window.localStorage;
    openingBackup = core.capture(storage, window.location.origin);
    hasJournal = storage.getItem(core.JOURNAL_KEY) !== null;
    pendingJournal = core.readJournal(storage);
  } catch (error) { openingError = error; }

  document.addEventListener('DOMContentLoaded', function () {
    const byId = id => document.getElementById(id);
    const app = byId('seatingApplication');
    const status = byId('dataProtectionStatus');
    const errorBox = byId('dataProtectionError');
    const backupButton = byId('backupClassroomData');
    const currentButton = byId('backupCurrentClassroomData');
    const restoreButton = byId('restoreClassroomData');
    const fileInput = byId('classroomBackupFile');
    const recoveryButton = byId('recoverClassroomData');
    const recoveryDownload = byId('backupRecoveryClassroomData');
    const openButton = byId('openRestoredClassroom');
    const dialog = byId('dataRestoreDialog');
    const confirmation = byId('dataRestoreConfirm');
    const confirmButton = byId('confirmDataRestore');
    let blocked = true;
    let preview = null;
    let safetyEntries = pendingJournal ? pendingJournal.before : null;
    let returnFocus = restoreButton;
    let filePurpose = 'restore';

    function message(text) { status.textContent = text; }
    function showError(text) { errorBox.textContent = text; errorBox.hidden = false; }
    function clearError() { errorBox.textContent = ''; errorBox.hidden = true; }
    function pause() { blocked = true; app.disabled = true; app.inert = true; }
    function ready() { blocked = false; app.disabled = false; app.inert = false; }
    pause();
    window.reportClassroomStorageError = text => {
      pause();
      showError(text + ' Changes visible in the classroom may not have been saved.');
      message('The classroom is paused to protect saved data. The opening safety copy is still available.');
      openButton.hidden = false;
    };
    // Inert/disabled plus event guards also cover the legacy application's clickable divs.
    ['click', 'input', 'change', 'keydown'].forEach(type => app.addEventListener(type, event => {
      if (blocked) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true));
    document.addEventListener('keydown', event => {
      const protectedControl = event.target.closest && event.target.closest('#classroomDataControls, #dataRestoreDialog');
      if (blocked || dialog.open || protectedControl) event.stopImmediatePropagation();
      if (dialog.open && event.key === 'Escape') { event.preventDefault(); closePreview(); }
    }, true);
    // A document-level legacy drag handler must not save stale DOM after a restore.
    ['mousemove', 'mouseup'].forEach(type => document.addEventListener(type, event => {
      if (blocked || dialog.open) event.stopImmediatePropagation();
    }, true));

    function download(backup, suffix) {
      let url;
      try {
        const validated = core.validateBackup(backup);
        const blob = new Blob([JSON.stringify(validated, null, 2) + '\n'], { type: 'application/json' });
        url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'classroom-data-' + validated.createdAt.replace(/[:.]/g, '-') + '-' + suffix + '.json';
        document.body.appendChild(anchor);
        try { anchor.click(); } finally { anchor.remove(); }
        clearError();
        message('Backup download requested. Check your Downloads folder and keep the file somewhere safe. If no file appears, allow downloads and try again.' + (blocked ? ' The classroom remains paused.' : ''));
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (_) {
        if (url) URL.revokeObjectURL(url);
        showError('The backup could not be downloaded. Your saved data was not changed. Check browser download permissions and available device space, then try again.');
      }
    }

    backupButton.disabled = !openingBackup;
    currentButton.disabled = !openingBackup;
    restoreButton.disabled = !openingBackup || hasJournal;
    backupButton.addEventListener('click', () => download(openingBackup, 'opening-safety-copy'));
    currentButton.addEventListener('click', () => {
      try { download(core.capture(storage, window.location.origin), 'current'); }
      catch (_) { showError('This browser could not read your saved classroom data. Nothing was changed. Try again when browser storage is available.'); }
    });
    recoveryDownload.addEventListener('click', () => {
      if (safetyEntries) download(core.envelope(safetyEntries, window.location.origin), 'before-restore');
    });

    function showRecovery(entries) {
      pause();
      safetyEntries = entries || safetyEntries;
      recoveryButton.hidden = false;
      recoveryDownload.hidden = !safetyEntries;
      restoreButton.disabled = true;
      message('The classroom is paused until recovery is finished. Download the pre-restore safety copy before trying again.');
    }

    function closePreview() {
      if (dialog.open) dialog.close();
      preview = null;
      confirmation.checked = false;
      confirmButton.disabled = true;
      returnFocus.focus();
    }

    function showPreview(plan, recovery = false, removeCount = 0) {
      preview = { plan, recovery };
      returnFocus = recovery ? recoveryButton : restoreButton;
      confirmation.checked = false;
      confirmButton.disabled = true;
      byId('dataRestoreTitle').textContent = recovery ? 'Recover your original classroom data' : 'Review your backup';
      byId('dataRestoreSummary').textContent = recovery
        ? 'This will put back the classroom data from before the interrupted restore.'
        : 'Backup created ' + new Date(plan.backup.createdAt).toLocaleString() + ' on ' + plan.backup.sourceOrigin +
          (plan.backup.sourceOrigin !== window.location.origin ? '. This is a different website address from this page.' : '.');
      const counts = byId('dataRestoreCounts');
      counts.replaceChildren();
      const rows = [['Saved items to add', plan.added], ['Saved items to replace', plan.replaced],
        ['Saved items left unchanged', plan.unchanged]];
      if (recovery) rows.push(['Items from the interrupted restore to remove', removeCount]);
      rows.forEach(([label, value]) => {
        const term = document.createElement('dt'); term.textContent = label;
        const definition = document.createElement('dd'); definition.textContent = String(value);
        counts.append(term, definition);
      });
      byId('dataRestoreWarning').textContent = recovery
        ? 'Recovery may overwrite current classroom data and remove items added by the interrupted restore. Other website data will be left alone. Close other Seating Chart tabs first.'
        : 'Restoring can overwrite saved classroom data in this browser. Items not included in the backup will stay as they are. Close other Seating Chart tabs first. Counts refer to saved items, not numbers of students or classes.';
      confirmButton.textContent = recovery ? 'Recover Original Data' : 'Restore Backup';
      dialog.showModal();
      byId('cancelDataRestore').focus();
    }

    restoreButton.addEventListener('click', () => {
      filePurpose = 'restore';
      byId('restoreFilePicker').hidden = false;
      fileInput.value = '';
      fileInput.click();
    });
    byId('verifyClassroomBackup').addEventListener('click', () => {
      filePurpose = 'verify';
      byId('restoreFilePicker').hidden = false;
      fileInput.value = '';
      fileInput.click();
    });
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files.length) return;
      const purpose = filePurpose;
      clearError();
      try {
        const result = core.verifyBackup(await fileInput.files[0].text());
        if (purpose === 'verify') {
          message('Backup verified: ' + result.entryCount + ' saved items. The file can be read and its raw saved items are structurally restorable. No classroom data was changed.' +
            (result.applicationReadable ? ' Available storage space and classroom behavior are not guaranteed by this check.' : ' Some classroom details are malformed: they can be restored exactly, but the classroom will remain paused until they are repaired or a known-good backup is restored.'));
        } else showPreview(core.planRestore(storage, result.backup));
      } catch (error) {
        preview = null;
        showError('This backup could not be opened. Nothing was changed. ' + error.message);
      }
    });
    byId('cancelDataRestore').addEventListener('click', closePreview);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closePreview(); });
    confirmation.addEventListener('change', () => { confirmButton.disabled = !confirmation.checked; });
    confirmButton.addEventListener('click', () => {
      if (!preview || !confirmation.checked) return;
      const selected = preview;
      safetyEntries = selected.recovery ? safetyEntries : selected.plan.before;
      pause();
      try {
        if (selected.recovery) {
          // Confirm the preview is still current before a recovery can remove/replace anything.
          if (JSON.stringify(core.readEntries(storage)) !== JSON.stringify(selected.plan.before)) {
            throw new Error('Classroom data changed after the preview. Preview recovery again.');
          }
          core.recover(storage);
        } else core.restore(storage, selected.plan.backup, selected.plan.before);
        closePreview();
        clearError();
        recoveryButton.hidden = true;
        recoveryDownload.hidden = false;
        restoreButton.disabled = false;
        openButton.hidden = false;
        message((selected.recovery ? 'Recovery completed.' : 'Backup restored.') + ' The classroom is paused. You can download a current backup or choose Open Saved Classroom when you are ready.');
        openButton.focus();
      } catch (error) {
        closePreview();
        showError(error.message);
        let journal;
        try { journal = core.readJournal(storage); } catch (_) { /* Remain paused if storage is unavailable. */ }
        if (journal || error.recoveryPending) showRecovery(journal ? journal.before : safetyEntries);
        else {
          openButton.hidden = false;
          message('The classroom is paused. No successful restore was applied. Check the message above before reopening.');
        }
      }
    });
    recoveryButton.addEventListener('click', () => {
      clearError();
      try {
        const journal = core.readJournal(storage);
        if (!journal) throw new Error('No recovery record was found. Reload this page to check your saved data again.');
        const backup = core.envelope(journal.before, window.location.origin);
        const beforeKeys = new Set(journal.before.map(entry => entry.key));
        const removeCount = journal.writes.filter(entry => !beforeKeys.has(entry.key) && storage.getItem(entry.key) !== null).length;
        showPreview(core.planRestore(storage, backup), true, removeCount);
      } catch (error) { showError('Recovery could not be prepared. Keep the classroom closed. ' + error.message); }
    });
    openButton.addEventListener('click', () => window.location.reload());

    // Reject known unreadable records before legacy startup can migrate or crash on them.

    if (openingError) {
      showError('Your classroom has been paused because its safety copy or recovery record could not be read. Nothing was changed by the backup controls. ' + openingError.message);
      message('If browser storage is blocked, allow it and reload. If a safety copy is available, download it before taking further steps.');
      if (hasJournal) showRecovery(pendingJournal ? pendingJournal.before : null);
      return;
    }
    if (pendingJournal) {
      showRecovery(pendingJournal.before);
      showError('An earlier restore did not finish. Review and confirm recovery before opening the classroom.');
      return;
    }
    try { core.checkReadable(openingBackup.entries); }
    catch (_) {
      showError('Some saved classroom details cannot be opened. Their original contents are preserved in your opening safety copy. Download it, or restore a known-good backup.');
      message('The classroom is paused to protect unreadable saved data.');
      return;
    }
    const script = document.createElement('script');
    script.src = '../javascript/Seating_Chart.js';
    script.onerror = () => showError('The classroom application could not load. Your backup controls are still available. Reload to try again.');
    script.onload = () => {
      try {
        window.initializeSeatingChart();
        ready();
        message('Opening safety copy captured before the classroom started. Backup Classroom Data downloads that original copy; use Backup Current Classroom Data to include later edits.');
      } catch (_) {
        pause();
        showError('The existing classroom application could not open some saved details. Download the opening safety copy or restore a known-good backup.');
        message('The classroom is paused. Your opening safety copy is still available.');
      }
    };
    document.body.appendChild(script);
  });
})();
