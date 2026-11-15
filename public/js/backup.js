// Backup and restore: everything the app saves, as one small file.
import { store } from './store.js';
import { toast } from './ui.js';
import { dayKey } from './progress.js';

const APP = 'drum-reader';

/** Download a backup file of all progress and settings. */
export function downloadBackup() {
  const backup = { app: APP, version: 1, saved: new Date().toISOString(), data: store.exportAll() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `drum-reader-backup-${dayKey()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  store.set('backupAt', Date.now());
  toast('Backup saved to your downloads');
}

/** "Last saved 3 days ago", for the backup row. */
export function lastBackup() {
  const t = store.get('backupAt', 0);
  if (!t) return 'No backup yet';
  const days = Math.floor((Date.now() - t) / 864e5);
  return `Last saved ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}`;
}

/** Read a backup's text. Returns { data, saved } or null if it isn't one of ours. */
export function parseBackup(text) {
  try {
    const b = JSON.parse(text);
    if (b?.app !== APP || !b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return null;
    return { data: b.data, saved: b.saved };
  } catch {
    return null;
  }
}

/** Ask for a backup file and load it, replacing what is saved here. */
export function restoreBackup(onDone) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const backup = parseBackup(await file.text());
    if (!backup) return toast('That file isn’t a Drum Reader backup');
    const when = backup.saved ? new Date(backup.saved).toLocaleDateString() : 'an unknown date';
    if (!window.confirm(`Replace the progress on this device with the backup from ${when}?`)) return;
    if (!store.importAll(backup.data)) return toast('Couldn’t restore the backup');
    store.set('backupAt', Date.now());
    onDone?.();
  });
  input.click();
}
