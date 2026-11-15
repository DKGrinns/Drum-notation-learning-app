// Learn: a level path. Each level introduces one element, then drills it.
import { h, svgIcon, ICONS, toast } from '../ui.js';
import { KIT, byId } from '../kit.js';
import { makeGroove, subdivision, emptyPattern, copyMeta, slotPos, validSlots, countLabel, isTrip, countInFor, chartOrder } from '../grooves.js';
import { renderPattern, renderChart, renderSingle } from '../notation.js';
import { transport, playInstrument } from '../audio.js';
import { tapSession, padButtons, keyHandler, kitHandler, flash, resultDetails, isCalibrated } from '../tap.js';
import { midiSounds } from '../midi.js';
import { openKitSetup, kitSummary } from '../kitsetup.js';
import { openCalibration } from '../calibrate.js';
import { logPractice, streak, bestStreak, lastWeek, history } from '../progress.js';
import { store } from '../store.js';
import { downloadBackup, restoreBackup, lastBackup } from '../backup.js';
import { LEVELS, PASS } from '../curriculum.js';

export const title = 'Learn';

const MODE_LABEL = { learn: 'Learn', practice: 'Practice', test: 'Test' };
const MODE_HELP = {
  learn: 'You’ll hear the part you’re tapping as a guide. Four clicks, then tap along.',
  practice: 'Just the click this time. Read the notes and tap.',
  test: (p) => `A pattern you haven’t practiced. Score ${p}% to pass the level.`,
};

let S = null;
let root = null;
let nav = null;
let onKey = null;
let offKit = null;
let ro = null;

export function mount(r, n) {
  root = r;
  nav = n;
  S = { progress: store.get('learn.progress', {}) };
  showPath();
}

export function unmount() {
  cleanup();
  nav.title?.(title);
}

function cleanup() {
  transport.stop();
  if (onKey) window.removeEventListener('keydown', onKey);
  onKey = null;
  offKit?.();
  offKit = null;
  ro?.disconnect();
  ro = null;
}

// ---------- Progress ----------

const key = (li, ci) => `${LEVELS[li].id}/${LEVELS[li].challenges[ci].id}`;
const rec = (li, ci) => S.progress[key(li, ci)] || {};
const passMark = (c) => (c.kind === 'intro' ? 0 : PASS[c.mode]);

function isDone(li, ci) {
  const c = LEVELS[li].challenges[ci];
  const r = rec(li, ci);
  return c.kind === 'intro' ? !!r.done : (r.best ?? -1) >= passMark(c);
}
const levelDone = (li) => LEVELS[li].challenges.every((_, ci) => isDone(li, ci));
const levelUnlocked = (li) => li === 0 || levelDone(li - 1);
const challengeUnlocked = (li, ci) => levelUnlocked(li) && (ci === 0 || isDone(li, ci - 1));

function stars(li, ci) {
  const c = LEVELS[li].challenges[ci];
  if (c.kind === 'intro') return isDone(li, ci) ? 3 : 0;
  const best = rec(li, ci).best ?? -1;
  const p = passMark(c);
  return best >= 95 ? 3 : best >= Math.min(90, p + 15) ? 2 : best >= p ? 1 : 0;
}

// Spaced review: passing a level test again doubles the wait before it's due
// (1, 2, 4… up to 30 days); failing brings it back tomorrow.
const DAY = 864e5;
function reviewPatch(r, passed) {
  return { last: Date.now(), ivl: passed ? Math.min(30, r.ivl ? r.ivl * 2 : 1) : 1 };
}
const testIndex = (li) => LEVELS[li].challenges.findIndex((c) => c.mode === 'test');
function reviewDue(li) {
  if (!levelDone(li)) return false;
  const r = rec(li, testIndex(li));
  return !r.last || Date.now() - r.last >= (r.ivl || 1) * DAY;
}

function save(li, ci, patch) {
  S.progress[key(li, ci)] = { ...rec(li, ci), ...patch };
  store.set('learn.progress', S.progress);
}

function starRow(n, max = 3) {
  return h('span', { class: 'stars', 'aria-label': `${n} of ${max} stars` },
    Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'on' : '' }, '★')));
}

// ---------- Screens ----------

function setScreen(t, back) {
  cleanup();
  root.replaceChildren();
  nav.set(back ? { left: { label: `‹ ${back.label}`, onClick: back.onClick } } : {});
  nav.title?.(t, { compact: !!back });
  window.scrollTo(0, 0);
}

// ---------- Streak, review and progress ----------

const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.6 3.2 2.4 4.9 4 6.7 1.5 1.7 2.5 3.4 2.5 5.6A6.5 6.5 0 0 1 12 21.3a6.5 6.5 0 0 1-6.5-6.5c0-2.4 1.1-4.3 2.6-5.6.2 1.6.9 2.8 2.1 3.4C9.8 9 10.6 5.4 12 2.5z" fill="currentColor"/></svg>';

function weekDots() {
  return h('div', { class: 'week', 'aria-label': 'Practice this week' }, lastWeek().map((d) =>
    h('span', { class: `day${d.done ? ' done' : ''}${d.today ? ' today' : ''}` }, h('i'), d.label)));
}

function streakCard() {
  const st = streak();
  const n = st.days;
  return h('button', { type: 'button', class: `card streak${n ? ' on' : ''}`, onClick: showProgress },
    h('span', { class: 'flame' }, svgIcon(FLAME)),
    h('span', { class: 'streak-text' },
      h('span', { class: 'streak-n' }, n ? `${n}-day streak` : 'Start a streak'),
      h('span', { class: 'row-sub' }, st.today ? 'You practiced today' : n ? 'Practice today to keep it going' : 'Finish any exercise today')),
    weekDots());
}

function daysAgo(t) {
  const d = Math.floor((Date.now() - t) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Passed levels whose test is due again, the most overdue first (up to 3). */
function reviewList() {
  const due = LEVELS.map((_, li) => li).filter(reviewDue)
    .sort((a, b) => (rec(a, testIndex(a)).last || 0) - (rec(b, testIndex(b)).last || 0))
    .slice(0, 3);
  if (!due.length) return '';
  return h('div', { class: 'review-due' },
    h('div', { class: 'section-label' }, 'Review'),
    h('div', { class: 'list' }, due.map((li) => {
      const r = rec(li, testIndex(li));
      return h('button', { type: 'button', class: 'row row-btn', onClick: () => openChallenge(li, testIndex(li)) },
        h('span', { class: 'kind-icon test' }, svgIcon(KIND_ICONS.test)),
        h('span', { class: 'row-main' }, h('span', null, `Level ${li + 1} · ${LEVELS[li].title}`),
          h('span', { class: 'row-sub' }, r.last ? `Last tested ${daysAgo(r.last)}` : 'Keep it fresh: retake the test')),
        svgIcon(ICONS.chevron, 'icon chevron'));
    })));
}

const KIND_NAME = { drill: 'Learn', play: 'Play', sight: 'Sight-reading', listen: 'Listen', quiz: 'Quiz' };

function showProgress() {
  setScreen('Progress', { label: 'Levels', onClick: showPath });
  const st = streak();
  const all = history();
  const weekAgo = Date.now() - 7 * DAY;
  const thisWeek = all.filter((e) => e.t >= weekAgo);
  const avg = thisWeek.length ? Math.round(thisWeek.reduce((a, e) => a + (e.score || 0), 0) / thisWeek.length) : null;
  const tile = (n, label) => h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, n), h('div', { class: 'stat-l' }, label));
  const recent = all.slice(-20).reverse();
  const backupSub = h('span', { class: 'row-sub' }, lastBackup());
  const kitVal = h('span', { class: 'row-value' }, kitSummary());
  root.append(
    h('section', { class: 'card progress-card' },
      h('div', { class: 'stats' },
        tile(st.days, 'Streak'),
        tile(bestStreak(), 'Best streak'),
        tile(thisWeek.length, 'This week'),
        tile(avg == null ? '–' : `${avg}%`, 'Avg score')),
      weekDots()),
    h('div', { class: 'section-label' }, 'Recent'),
    recent.length
      ? h('div', { class: 'list' }, recent.map((e) => h('div', { class: 'row' },
        h('span', { class: 'row-main' }, h('span', null, e.label),
          h('span', { class: 'row-sub' }, `${KIND_NAME[e.kind] || ''}${e.bpm ? ` · ${e.bpm} BPM` : ''} · ${daysAgo(e.t)}`)),
        h('span', { class: `score-pill${e.score >= 80 ? ' good' : e.score >= 50 ? ' ok' : ''}` }, `${e.score}%`))))
      : h('p', { class: 'footnote' }, 'Nothing yet. Finish a drill, a quiz or a sight-reading run and it shows up here.'),
    h('p', { class: 'footnote' }, 'Every exercise in any tab counts toward your streak. Passed levels come back for review after 1, 2, 4… days, so they stay fresh.'),
    h('div', { class: 'section-label' }, 'Equipment'),
    h('div', { class: 'list' },
      h('button', { type: 'button', class: 'row row-btn', onClick: () => openKitSetup(() => { kitVal.textContent = kitSummary(); }) },
        h('span', { class: 'row-main' }, h('span', null, 'Electronic drum kit'), h('span', { class: 'row-sub' }, 'Play along on a real kit over USB')),
        kitVal, svgIcon(ICONS.chevron, 'icon chevron'))),
    h('div', { class: 'section-label' }, 'Backup'),
    h('div', { class: 'list' },
      h('button', { type: 'button', class: 'row row-btn', onClick: () => { downloadBackup(); backupSub.textContent = lastBackup(); } },
        h('span', { class: 'row-main' }, h('span', null, 'Save a backup file'), backupSub),
        svgIcon(ICONS.chevron, 'icon chevron')),
      h('button', { type: 'button', class: 'row row-btn', onClick: () => restoreBackup(() => location.reload()) },
        h('span', { class: 'row-main' }, h('span', null, 'Restore from a backup'), h('span', { class: 'row-sub' }, 'Replaces the progress on this device')),
        svgIcon(ICONS.chevron, 'icon chevron'))),
    h('p', { class: 'footnote' }, 'Your progress is stored only in this browser. A backup file lets you keep it safe or move it to another device.'),
  );
}

function showPath() {
  setScreen(title);
  nav.set({ right: { label: 'Progress', onClick: showProgress } });
  const current = LEVELS.findIndex((_, li) => !levelDone(li));
  const doneCount = LEVELS.filter((_, li) => levelDone(li)).length;
  const totalStars = LEVELS.reduce((a, l, li) => a + l.challenges.reduce((b, _, ci) => b + stars(li, ci), 0), 0);
  const maxStars = LEVELS.reduce((a, l) => a + l.challenges.length * 3, 0);

  root.append(
    h('section', { class: 'card path-head' },
      h('div', { class: 'path-ring', style: { '--p': doneCount / LEVELS.length }, 'aria-label': `${doneCount} of ${LEVELS.length} levels done` },
        h('span', null, current === -1 ? svgIcon(ICONS.check) : current + 1)),
      h('div', { class: 'path-info' },
        h('div', { class: 'eyebrow' }, current === -1 ? 'Path complete' : `Up next · Level ${current + 1}`),
        h('div', { class: 'path-title' }, current === -1 ? 'Every level done!' : LEVELS[current].title),
        h('div', { class: 'path-meta' }, `${doneCount} of ${LEVELS.length} levels`, h('span', { class: 'dot-sep' }, '·'),
          h('span', { class: 'star-count' }, '★'), ` ${totalStars} of ${maxStars}`)),
      current === -1 ? null : h('button', { type: 'button', class: 'btn-primary path-go', onClick: () => continueFrom(current) }, 'Continue')),
    streakCard(),
    reviewList(),
    h('div', { class: 'section-label' }, 'Levels'),
    h('div', { class: 'list levels' },
      LEVELS.map((lv, li) => {
        const locked = !levelUnlocked(li);
        const done = levelDone(li);
        const n = lv.challenges.filter((_, ci) => isDone(li, ci)).length;
        return h('button', {
          type: 'button',
          class: `row row-btn level-row${locked ? ' locked' : ''}${li === current ? ' current' : ''}`,
          onClick: () => (locked ? toast(`Pass the Level ${li} test to unlock`) : showLevel(li)),
        },
        h('span', { class: `level-badge${done ? ' done' : ''}` }, done ? svgIcon(ICONS.check) : li + 1),
        h('span', { class: 'row-main' }, h('span', null, lv.title), h('span', { class: 'row-sub' }, lv.element)),
        locked ? svgIcon(ICONS.lock, 'icon lock')
          : h('span', { class: 'pips', 'aria-label': `${n} of ${lv.challenges.length} done` },
            lv.challenges.map((_, ci) => h('span', { class: isDone(li, ci) ? 'on' : '' }))),
        locked ? null : svgIcon(ICONS.chevron, 'icon chevron'));
      })),
    h('p', { class: 'footnote' }, 'Each level introduces one new idea, then drills it. Pass the level test to unlock the next one.'),
  );
}

function continueFrom(li) {
  const ci = LEVELS[li].challenges.findIndex((_, i) => !isDone(li, i));
  if (ci === -1) showLevel(li);
  else openChallenge(li, ci);
}

function showLevel(li) {
  const lv = LEVELS[li];
  setScreen(`Level ${li + 1}`, { label: 'Levels', onClick: showPath });
  root.append(
    h('div', { class: 'level-head' },
      h('div', { class: 'eyebrow' }, `Level ${li + 1} of ${LEVELS.length}`),
      h('div', { class: 'level-title' }, lv.title),
      h('div', { class: 'level-sub' }, lv.element)),
    h('div', { class: 'list' },
      lv.challenges.map((c, ci) => {
        const locked = !challengeUnlocked(li, ci);
        const sub = c.kind === 'intro' ? `${c.pages.length} cards`
          : `${MODE_LABEL[c.mode]} · ${c.bpm} BPM${c.mode === 'test' ? ` · pass ${PASS.test}%` : ''}`;
        return h('button', {
          type: 'button',
          class: `row row-btn challenge-row${locked ? ' locked' : ''}`,
          onClick: () => (locked ? toast('Finish the one before first') : openChallenge(li, ci)),
        },
        h('span', { class: `kind-icon ${c.kind === 'intro' ? 'intro' : c.mode}` }, svgIcon(KIND_ICONS[c.kind === 'intro' ? 'intro' : c.mode])),
        h('span', { class: 'row-main' }, h('span', null, c.title), h('span', { class: 'row-sub' }, sub)),
        locked ? svgIcon(ICONS.lock, 'icon lock') : starRow(stars(li, ci)),
        locked ? null : svgIcon(ICONS.chevron, 'icon chevron'));
      })),
    h('p', { class: 'footnote' }, 'Stars: pass for one, beat it by 15 points for two, 95% or better for three.'),
  );
}

function openChallenge(li, ci) {
  const c = LEVELS[li].challenges[ci];
  if (c.kind === 'intro') runIntro(li, ci);
  else runDrill(li, ci);
}

/** After finishing a challenge: go to the next one, or back to the path when the level is done. */
function nextAfter(li, ci) {
  if (ci + 1 < LEVELS[li].challenges.length) openChallenge(li, ci + 1);
  else if (li + 1 < LEVELS.length) showLevel(li + 1);
  else showPath();
}

const KIND_ICONS = {
  intro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C6.5 4.3 9.5 4.3 12 6c2.5-1.7 5.5-1.7 8-.5v13c-2.5-1.2-5.5-1.2-8 .5-2.5-1.7-5.5-1.7-8-.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 6v13" stroke="currentColor" stroke-width="1.8"/></svg>',
  learn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h3.5L12 19V5L7.5 9z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  practice: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  test: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v7a6 6 0 0 1-12 0z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 16.5v3.5M8 20.5h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

// ---------- Shared bits ----------

const spec2pattern = (spec) => makeGroove('', spec).pattern;
/** A chart spec { bars: [spec…], order?, endings? } as a chart of patterns. */
const spec2chart = (spec) => ({ bars: spec.bars.map(spec2pattern), order: spec.order, endings: spec.endings });

function richText(str) {
  return str.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? h('b', null, part) : part));
}

function playButton(label, onPlay) {
  const btn = h('button', { type: 'button', class: 'listen-btn' });
  const set = (on) => {
    btn.replaceChildren(svgIcon(on ? ICONS.stop : ICONS.play), h('span', null, on ? 'Stop' : label));
    btn.classList.toggle('on', on);
    btn.dataset.on = on ? '1' : '';
  };
  btn.addEventListener('click', () => {
    if (btn.dataset.on) {
      transport.stop();
      set(false);
      onPlay(null);
    } else {
      set(true);
      onPlay(() => set(false));
    }
  });
  set(false);
  btn.reset = () => set(false);
  return btn;
}

/** Play a pattern twice (or a chart once through) after a count-in, moving playheads on the given staffs. */
function playPattern(pattern, bpm, staffs, done, { overlay, loops = 2, chart = null } = {}) {
  const ord = chart && chartOrder(chart);
  if (chart) pattern = chart.bars[0];
  transport.start({
    getBpm: () => bpm,
    getPattern: ord ? (n) => chart.bars[ord[n % ord.length]] : () => pattern,
    loops: ord ? ord.length : loops,
    countInBeats: countInFor(pattern),
    playGroove: true,
    metronome: false,
    onEvent: (ev) => {
      if (ev.type === 'count' && overlay) popCount(overlay, ev.n);
      if (ev.type === 'step') {
        overlay?.classList.remove('show');
        for (const st of staffs()) st?.setPlayhead(ev.slot, ord ? ord[ev.loop % ord.length] : 0);
      }
      if (ev.type === 'end' || ev.type === 'interrupt') {
        for (const st of staffs()) st?.setPlayhead(null);
        done?.();
      }
    },
  });
}

function popCount(overlay, n) {
  overlay.textContent = n;
  overlay.classList.remove('pop');
  void overlay.offsetWidth;
  overlay.classList.add('pop', 'show');
}

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Intro (explain + check) ----------

function runIntro(li, ci) {
  const lv = LEVELS[li];
  const c = lv.challenges[ci];
  setScreen(c.title, { label: `Level ${li + 1}`, onClick: () => showLevel(li) });
  let i = 0;
  let correct = 0;
  let checks = 0;
  const card = h('section', { class: 'card quiz-card lesson-card', 'aria-live': 'polite' });
  root.append(card);
  let redraw = null;
  let lastW = 0;
  ro = new ResizeObserver(() => {
    if (card.clientWidth === lastW) return;
    lastW = card.clientWidth;
    redraw?.();
  });
  ro.observe(card);

  const page = () => {
    transport.stop();
    const p = c.pages[i];
    const top = [
      h('div', { class: 'quiz-top' }, h('span', null, `${i + 1} of ${c.pages.length}`), h('span', null, lv.title)),
      h('div', { class: 'progress' }, h('div', { style: { width: `${(i / c.pages.length) * 100}%` } })),
    ];
    const advance = () => {
      i++;
      if (i < c.pages.length) page();
      else finishIntro();
    };
    const cont = (label = 'Continue') => h('button', { type: 'button', class: 'btn-primary', onClick: advance }, label);
    const last = i === c.pages.length - 1;
    redraw = null;

    if (p.type === 'info') {
      const fig = h('div', { class: 'staff-host' });
      const overlay = h('div', { class: 'count-overlay', 'aria-hidden': 'true' });
      let staff = null;
      redraw = () => {
        if (p.figure.notes) {
          const n = p.figure.notes.length;
          renderSingle(fig, {
            s: 12,
            items: p.figure.notes.map((id, k) => ({ step: byId[id].step, head: byId[id].head, foot: byId[id].foot, dx: (k - (n - 1) / 2) * 3.4 })),
          });
          if (n) {
            fig.append(h('div', { class: 'fig-labels' }, p.figure.notes.map((id, k) =>
              h('span', { style: { left: `calc(50% + ${(k - (n - 1) / 2) * 3.4 * 12}px)` } }, byId[id].name))));
          }
        } else if (p.figure.chart) {
          const chart = spec2chart(p.figure.chart);
          staff = renderChart(fig, { bars: chart.bars, endings: chart.endings, full: true });
        } else {
          const pattern = spec2pattern(p.figure.spec);
          staff = renderPattern(fig, { pattern });
        }
      };
      const playBtn = p.figure.play
        ? playButton('Play it', (done) => done && (p.figure.chart
          ? playPattern(null, p.figure.play, () => [staff], done, { overlay, chart: spec2chart(p.figure.chart) })
          : playPattern(spec2pattern(p.figure.spec), p.figure.play, () => [staff], done, { overlay })))
        : null;
      card.replaceChildren(...[...top,
        h('div', { class: 'lesson-title' }, p.title),
        h('div', { class: 'staff-wrap' }, fig, overlay),
        playBtn,
        h('div', { class: 'lesson-body' }, p.body.map((t) => h('p', null, richText(t)))),
        h('div', { class: 'actions' }, cont(last ? 'Finish' : 'Continue'))].filter(Boolean));
      redraw();
      return;
    }

    // Question pages
    checks++;
    const feedback = h('div', { class: 'feedback' });
    const answers = h('div', { class: 'answers' });
    const actions = h('div', { class: 'actions' });
    const fig = h('div', { class: 'staff-host' });
    let prompt;
    let extra = null;
    const answered = (ok, msg) => {
      if (ok) correct++;
      feedback.className = `feedback ${ok ? 'good' : 'bad'}`;
      feedback.replaceChildren(h('span', null, h('b', null, ok ? 'Correct. ' : 'Not quite. '), msg));
      actions.replaceChildren(cont(last ? 'Finish' : 'Continue'));
    };
    const lockButtons = (rightIdx, pickedIdx) => {
      [...answers.children].forEach((b, k) => {
        b.disabled = true;
        if (k === rightIdx) b.classList.add('right');
        else if (k === pickedIdx) b.classList.add('wrong');
      });
    };

    if (p.type === 'name') {
      const k = byId[p.id];
      prompt = 'Which drum is this?';
      let color = null;
      redraw = () => renderSingle(fig, { s: 13, items: [{ step: k.step, head: k.head, foot: k.foot, color }] });
      if (p.choices.length === 3) answers.classList.add('three');
      p.choices.forEach((id, idx) => answers.append(h('button', {
        type: 'button', class: 'answer',
        onClick: () => {
          lockButtons(p.choices.indexOf(p.id), idx);
          playInstrument(p.id);
          color = id === p.id ? 'var(--green)' : null;
          redraw();
          answered(id === p.id, `The ${k.name} sits ${k.where}.`);
        },
      }, byId[id].name)));
    } else if (p.type === 'count') {
      const pattern = spec2pattern(p.spec);
      const [tid, tslot] = p.target;
      const colors = {};
      for (const kk of KIT) pattern[kk.id].forEach((on, s) => on && (colors[`${kk.id}:${s}`] = 'var(--ink3)'));
      colors[`${tid}:${tslot}`] = 'var(--blue)';
      prompt = h('span', null, 'What’s the count for the ', h('b', null, 'blue'), ' note?');
      redraw = () => renderPattern(fig, { pattern, colors });
      // Choices: the right count plus three nearby counts on the same grid.
      // Straight beats offer counts on the pattern's own grid (8ths or 16ths); triplet beats offer all three.
      const step = { 4: 4, 8: 2, 16: 1 }[subdivision({ pattern })];
      const dist = (a) => Math.abs(slotPos(pattern, a) - slotPos(pattern, tslot));
      const near = validSlots(pattern).filter((s) => s !== tslot && (isTrip(pattern, s >> 2) || (s & 3) % step === 0));
      near.sort((a, b) => dist(a) - dist(b));
      const opts = shuffle([tslot, ...shuffle(near.slice(0, 5)).slice(0, 3)]).sort((a, b) => a - b);
      opts.forEach((s, idx) => answers.append(h('button', {
        type: 'button', class: 'answer',
        onClick: () => {
          lockButtons(opts.indexOf(tslot), idx);
          playInstrument(tid);
          colors[`${tid}:${tslot}`] = s === tslot ? 'var(--green)' : 'var(--red)';
          redraw();
          answered(s === tslot, `It’s on “${countLabel(tslot, pattern)}”.`);
        },
      }, countLabel(s, pattern))));
    } else if (p.type === 'pick') {
      prompt = 'Which one do you hear?';
      const pats = shuffle([p.answer, ...p.others]).map(spec2pattern);
      const answerKey = JSON.stringify(spec2pattern(p.answer));
      const right = pats.findIndex((pt) => JSON.stringify(pt) === answerKey);
      let staffs = [];
      let picked = null;
      const choices = h('div', { class: 'choices' });
      redraw = () => {
        choices.replaceChildren();
        staffs = pats.map((pt, idx) => {
          const host = h('div', { class: 'staff-host' });
          const state = picked == null ? '' : idx === right ? ' right' : idx === picked ? ' wrong' : ' dim';
          choices.append(h('button', {
            type: 'button', class: `choice${state}`, 'aria-label': `Choice ${'ABC'[idx]}`,
            onClick: () => {
              if (picked != null) {
                listen.reset();
                playPattern(pats[idx], p.bpm, () => [staffs[idx]], null, { loops: 1 });
                return;
              }
              picked = idx;
              transport.stop();
              listen.reset();
              redraw();
              answered(idx === right, idx === right ? 'Tap any staff to hear it.' : `It was ${'ABC'[right]}. Tap each one to hear the difference.`);
            },
          }, h('span', { class: 'choice-letter' }, 'ABC'[idx]), host));
          return renderPattern(host, { pattern: pt, s: 8.5 });
        });
      };
      const listen = playButton('Play the groove', (done) => done && playPattern(pats[right], p.bpm, () => staffs, done));
      extra = [listen, choices];
      answers.hidden = true;
    }

    card.replaceChildren(...top, h('div', { class: 'prompt' }, prompt),
      ...(extra || [fig]), feedback, answers, actions);
    redraw();
  };

  const finishIntro = () => {
    const wasDone = isDone(li, ci);
    save(li, ci, { done: true });
    redraw = null;
    card.replaceChildren(
      h('div', { class: 'summary' },
        h('div', { class: 'done-mark' }, svgIcon(ICONS.check)),
        h('div', { class: 'lesson-title' }, `You’ve met: ${lv.title.toLowerCase()}`),
        h('div', { class: 'summary-msg' }, checks ? `${correct} of ${checks} checks right.` : ''),
        h('button', { type: 'button', class: 'btn-primary', onClick: () => nextAfter(li, ci) }, 'Next: tap it'),
        h('button', { type: 'button', class: 'btn-plain', onClick: () => { i = 0; correct = 0; checks = 0; page(); } }, 'Go through again')),
    );
    if (!wasDone) toast('Intro complete');
  };

  page();
}

// ---------- Drill (tap along) ----------

function runDrill(li, ci) {
  const lv = LEVELS[li];
  const c = lv.challenges[ci];
  const pass = PASS[c.mode];
  setScreen(c.title, { label: `Level ${li + 1}`, onClick: () => showLevel(li) });

  const D = { phase: 'idle', spec: null, pattern: null, judge: [], session: null, colors: {}, staff: null };
  const pickPattern = () => {
    let spec = c.spec;
    if (c.pool) {
      const others = c.pool.filter((s) => s !== D.spec);
      spec = others[Math.floor(Math.random() * others.length)] || c.pool[0];
    }
    D.spec = spec;
    // A spec with `bars` is a chart of several bars.
    D.chart = spec.bars ? spec2chart(spec) : null;
    D.pattern = D.chart ? D.chart.bars[0] : spec2pattern(spec);
    D.all = D.chart ? D.chart.bars : [D.pattern];
    D.judge = (c.judge || KIT.filter((k) => D.all.some((p) => p[k.id].some(Boolean))).map((k) => k.id)).map((id) => byId[id]);
  };
  pickPattern();

  const staffHost = h('div', { class: 'staff-host' });
  const overlay = h('div', { class: 'count-overlay', 'aria-hidden': 'true' });
  const results = h('div', { class: 'results', hidden: true, 'aria-live': 'polite' });
  const startBtn = h('button', { type: 'button', class: 'btn-primary start', onClick: () => (active() ? stop() : start()) });
  const hearBtn = c.mode === 'test' ? null
    : playButton('Hear it first', (done) => {
      if (!done) return;
      resetColors();
      playPattern(D.pattern, c.bpm, () => [D.staff], done, { overlay, chart: D.chart });
    });
  const nextBtn = h('button', { type: 'button', class: 'btn-primary', hidden: true, onClick: () => nextAfter(li, ci) }, 'Continue');
  const pads = h('div', { class: 'pads' });
  const best = rec(li, ci).best;
  const help = typeof MODE_HELP[c.mode] === 'function' ? MODE_HELP[c.mode](pass) : MODE_HELP[c.mode];

  root.append(
    h('div', { class: 'drill-head' },
      h('span', { class: `mode-chip ${c.mode}` }, MODE_LABEL[c.mode]),
      h('span', { class: 'drill-meta' }, `${c.bpm} BPM · pass ${pass}%${best != null ? ` · best ${best}%` : ''}`)),
    h('p', { class: 'drill-help' }, help,
      isCalibrated() ? null : [' ', h('button', { type: 'button', class: 'link-btn', onClick: () => openCalibration() }, 'Set up tap timing')]),
    h('section', { class: 'card score' }, h('div', { class: 'staff-wrap' }, staffHost, overlay), results),
    h('div', { class: `drill-actions${hearBtn ? '' : ' solo'}` }, hearBtn, startBtn, nextBtn),
    pads,
  );

  const active = () => D.phase === 'countin' || D.phase === 'running';
  const isJudged = (id) => D.judge.some((k) => k.id === id);
  const resetColors = () => {
    D.colors = {};
    // Notes you don't tap are shown in gray.
    D.all.forEach((p, b) => {
      for (const k of KIT) if (!isJudged(k.id)) p[k.id].forEach((on, s) => on && (D.colors[D.chart ? `${b}:${k.id}:${s}` : `${k.id}:${s}`] = 'var(--ink3)'));
    });
    renderStaff();
  };
  const renderStaff = () => {
    D.staff = D.chart
      ? renderChart(staffHost, { bars: D.chart.bars, endings: D.chart.endings, colors: D.colors })
      : renderPattern(staffHost, { pattern: D.pattern, colors: D.colors });
  };
  const renderPads = () => pads.replaceChildren(...padButtons(D.judge, hit));
  const updateControls = () => {
    startBtn.textContent = active() ? 'Stop' : D.phase === 'results' ? 'Try again' : 'Start';
    startBtn.classList.toggle('stop', active());
    if (hearBtn) hearBtn.disabled = active();
  };

  resetColors();
  renderPads();
  updateControls();
  let lastW = staffHost.clientWidth;
  ro = new ResizeObserver(() => {
    if (staffHost.clientWidth === lastW) return;
    lastW = staffHost.clientWidth;
    renderStaff();
  });
  ro.observe(staffHost);

  onKey = keyHandler(() => D.judge, hit, pads);
  window.addEventListener('keydown', onKey);
  offKit = kitHandler(() => D.judge, hit, pads);

  function hit(id, ts, pad, kit) {
    if (!kit || midiSounds()) playInstrument(id); // a kit makes its own sound
    if (!active()) return flash(pad);
    flash(pad, D.session.hit(id, ts, kit ? 'midi' : 'tap', kit));
  }

  function start() {
    hearBtn?.reset();
    if (D.phase === 'results' && c.pool) pickPattern(); // a test retry gets a different pattern
    D.phase = 'countin';
    results.hidden = true;
    nextBtn.hidden = true;
    resetColors();
    renderPads();
    updateControls();
    // One bar is played twice; a chart is played once through.
    const loops = D.chart ? 1 : 2;
    const ord = D.chart && chartOrder(D.chart);
    // Learn mode plays everything; otherwise only the parts you aren't tapping.
    const heard = D.all.map((pat) => {
      if (c.mode === 'learn') return pat;
      const p = copyMeta(pat, emptyPattern(pat.meter));
      for (const k of KIT) if (!isJudged(k.id)) p[k.id] = pat[k.id];
      return p;
    });
    transport.start({
      getBpm: () => c.bpm,
      getPattern: ord ? (n) => heard[ord[n % ord.length]] : () => heard[0],
      loops: ord ? ord.length * loops : loops,
      countInBeats: countInFor(D.pattern),
      playGroove: true,
      metronome: true,
      onEvent: (ev) => {
        if (ev.type === 'count') popCount(overlay, ev.n);
        else if (ev.type === 'step') {
          if (D.phase === 'countin') {
            D.phase = 'running';
            overlay.classList.remove('show');
          }
          D.staff.setPlayhead(ev.slot, ord ? ord[ev.loop % ord.length] : 0);
        } else if (ev.type === 'end') setTimeout(finish, 160);
        else if (ev.type === 'interrupt') stop();
      },
    });
    D.session = tapSession({ pattern: D.pattern, bars: D.chart?.bars, order: D.chart?.order, ids: D.judge.map((k) => k.id), loops, startTime: transport.startTime, sixteenth: transport.sixteenth });
  }

  function stop() {
    transport.stop();
    D.phase = 'idle';
    overlay.classList.remove('show');
    D.staff?.setPlayhead(null);
    updateControls();
  }

  function finish() {
    if (D.phase !== 'running') return;
    D.phase = 'results';
    D.staff.setPlayhead(null);
    const res = D.session.result();
    const { score } = res;
    Object.assign(D.colors, res.colors);
    renderStaff();

    const prevBest = rec(li, ci).best ?? -1;
    const wasDone = isDone(li, ci);
    const levelWasDone = levelDone(li);
    const passed = score >= pass;
    const patch = score > prevBest ? { best: score } : {};
    if (c.mode === 'test') Object.assign(patch, reviewPatch(rec(li, ci), passed));
    save(li, ci, patch);
    logPractice({ kind: 'drill', label: `Level ${li + 1} · ${c.title}`, score, bpm: c.bpm, level: lv.id });

    results.replaceChildren(
      h('div', { class: 'results-head' },
        h('div', { class: 'big-score' }, `${score}`, h('span', null, '%')),
        h('div', { class: 'results-msg' },
          h('div', { class: `results-title ${passed ? 'pass' : 'fail'}` }, passed ? (c.mode === 'test' ? 'Level passed!' : 'Passed') : `Need ${pass}% to pass`),
          h('div', { class: 'results-sub' }, starRow(stars(li, ci)), score > prevBest && prevBest >= 0 ? ' New best' : ''))),
      ...resultDetails(res),
      !passed && c.mode !== 'learn' ? h('p', { class: 'tendency' }, c.mode === 'test' ? 'Try again for a new pattern, or go back and practice.' : 'Tip: use “Hear it first”, then try again.') : '',
    );
    results.hidden = false;
    nextBtn.hidden = !isDone(li, ci);
    nextBtn.textContent = ci + 1 < lv.challenges.length ? 'Continue' : li + 1 < LEVELS.length ? `On to Level ${li + 2}` : 'Back to levels';
    updateControls();
    startBtn.classList.toggle('secondary', !nextBtn.hidden);
    if (!levelWasDone && levelDone(li)) toast(li + 1 < LEVELS.length ? `Level ${li + 2} unlocked` : 'You finished every level!');
    else if (!wasDone && isDone(li, ci)) toast('Next challenge unlocked');
  }
}
