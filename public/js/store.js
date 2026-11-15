// localStorage wrapper that never throws (private mode, blocked storage, etc.).
const PREFIX = 'drumreader.';

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  /** Everything the app has saved, as one plain object (for a backup file). */
  exportAll() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
      }
    } catch {
      /* ignore */
    }
    return out;
  },
  /** Replace everything the app has saved with the contents of a backup. */
  importAll(data) {
    try {
      const old = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(PREFIX)) old.push(k);
      }
      for (const k of old) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(data)) localStorage.setItem(PREFIX + k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  },
};
