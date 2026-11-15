// Practice history: which days you practiced (for the streak) and recent scores.
import { store } from './store.js';

const MAX_HISTORY = 300;
const MAX_DAYS = 400;

/** Local calendar day, e.g. "2026-11-09". */
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Record one finished exercise.
 * entry: { kind: 'drill'|'play'|'listen'|'quiz'|'sight', label, score (0–100), bpm? }
 */
export function logPractice(entry) {
  const history = store.get('history', []);
  history.push({ t: Date.now(), ...entry });
  store.set('history', history.slice(-MAX_HISTORY));
  const days = new Set(store.get('days', []));
  days.add(dayKey());
  store.set('days', [...days].sort().slice(-MAX_DAYS));
  keepStorage();
}

/** Ask the browser not to clear our saved progress when it tidies up (asked once). */
function keepStorage() {
  if (store.get('persistAsked', false) || !navigator.storage?.persist) return;
  store.set('persistAsked', true);
  navigator.storage.persist().catch(() => {});
}

export const history = () => store.get('history', []);
const daySet = () => new Set(store.get('days', []));

/** Consecutive days practiced, ending today (or yesterday, if today isn't done yet). */
export function streak() {
  const days = daySet();
  const d = new Date();
  const today = days.has(dayKey(d));
  if (!today) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return { days: n, today };
}

/** The longest streak ever. */
export function bestStreak() {
  const days = [...daySet()].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of days) {
    const d = new Date(`${k}T12:00:00`);
    run = prev && Math.round((d - prev) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** The last 7 days, oldest first: [{ key, label, done }]. */
export function lastWeek() {
  const days = daySet();
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), done: days.has(dayKey(d)), today: i === 0 });
  }
  return out;
}
