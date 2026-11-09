// Learn: a level path. Each level introduces one element, then drills it.
import { h, svgIcon, ICONS, toast } from '../ui.js';
import { KIT, byId } from '../kit.js';
import { makeGroove, subdivision, emptyPattern } from '../grooves.js';
import { renderPattern, renderSingle } from '../notation.js';
import { transport, playInstrument, audioTimeAt } from '../audio.js';
import { store } from '../store.js';
import { LEVELS, PASS, countLabel } from '../curriculum.js';

export const title = 'Learn';

const ON_TIME = 0.045;
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
  nav.title?.(t);
  window.scrollTo(0, 0);
}

function showPath() {
  setScreen(title);
  const current = LEVELS.findIndex((_, li) => !levelDone(li));
  const doneCount = LEVELS.filter((_, li) => levelDone(li)).length;
  const totalStars = LEVELS.reduce((a, l, li) => a + l.challenges.reduce((b, _, ci) => b + stars(li, ci), 0), 0);
  const maxStars = LEVELS.reduce((a, l) => a + l.challenges.length * 3, 0);

  root.append(
    h('section', { class: 'card path-head' },
      h('div', { class: 'path-ring', style: { '--p': doneCount / LEVELS.length } }, h('span', null, doneCount)),
      h('div', null,
        h('div', { class: 'card-title' }, current === -1 ? 'All levels complete!' : `Level ${current + 1}: ${LEVELS[current].title}`),
        h('div', { class: 'card-sub' }, `${doneCount} of ${LEVELS.length} levels · ${totalStars}/${maxStars} ★`)),
      current === -1 ? null : h('button', { type: 'button', class: 'btn-primary path-go', onClick: () => continueFrom(current) }, 'Continue')),
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
        locked ? svgIcon(ICONS.lock, 'icon lock') : h('span', { class: 'row-value' }, `${n}/${lv.challenges.length}`),
        svgIcon(ICONS.chevron, 'icon chevron'));
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
        svgIcon(ICONS.chevron, 'icon chevron'));
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
const resOf = (pattern) => ({ 4: 4, 8: 2, 16: 1 })[subdivision({ pattern })];

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

/** Play a pattern twice after a count-in, moving playheads on the given staffs. */
function playPattern(pattern, bpm, staffs, done, { overlay, loops = 2 } = {}) {
  transport.start({
    getBpm: () => bpm,
    getPattern: () => pattern,
    loops,
    countInBeats: 4,
    playGroove: true,
    metronome: false,
    onEvent: (ev) => {
      if (ev.type === 'count' && overlay) popCount(overlay, ev.n);
      if (ev.type === 'step') {
        overlay?.classList.remove('show');
        for (const st of staffs()) st?.setPlayhead(ev.slot);
      }
      if (ev.type === 'end') {
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
        } else {
          const pattern = spec2pattern(p.figure.spec);
          staff = renderPattern(fig, { pattern, res: resOf(pattern) });
        }
      };
      const playBtn = p.figure.play
        ? playButton('Play it', (done) => done && playPattern(spec2pattern(p.figure.spec), p.figure.play, () => [staff], done, { overlay }))
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
      const res = resOf(pattern);
      const [tid, tslot] = p.target;
      const colors = {};
      for (const kk of KIT) pattern[kk.id].forEach((on, s) => on && (colors[`${kk.id}:${s}`] = 'var(--ink3)'));
      colors[`${tid}:${tslot}`] = 'var(--blue)';
      prompt = h('span', null, 'What’s the count for the ', h('b', null, 'blue'), ' note?');
      redraw = () => renderPattern(fig, { pattern, res, colors });
      // Choices: the right count plus three nearby counts on the same grid.
      const step = Math.min(res, 4);
      const near = [];
      for (let s = 0; s < 16; s += step) if (s !== tslot) near.push(s);
      near.sort((a, b) => Math.abs(a - tslot) - Math.abs(b - tslot));
      const opts = shuffle([tslot, ...shuffle(near.slice(0, 5)).slice(0, 3)]).sort((a, b) => a - b);
      opts.forEach((s, idx) => answers.append(h('button', {
        type: 'button', class: 'answer',
        onClick: () => {
          lockButtons(opts.indexOf(tslot), idx);
          playInstrument(tid);
          colors[`${tid}:${tslot}`] = s === tslot ? 'var(--green)' : 'var(--red)';
          redraw();
          answered(s === tslot, `It’s on “${countLabel(tslot)}”.`);
        },
      }, countLabel(s))));
    } else if (p.type === 'pick') {
      prompt = 'Which one do you hear?';
      const pats = shuffle([p.answer, ...p.others]).map(spec2pattern);
      const answerKey = JSON.stringify(spec2pattern(p.answer));
      const right = pats.findIndex((pt) => JSON.stringify(pt) === answerKey);
      const res = Math.min(...pats.map(resOf));
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
          return renderPattern(host, { pattern: pt, res, s: 8.5 });
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

  const D = { phase: 'idle', spec: null, pattern: null, judge: [], expected: [], extras: 0, colors: {}, staff: null };
  const pickPattern = () => {
    let spec = c.spec;
    if (c.pool) {
      const others = c.pool.filter((s) => s !== D.spec);
      spec = others[Math.floor(Math.random() * others.length)] || c.pool[0];
    }
    D.spec = spec;
    D.pattern = spec2pattern(spec);
    D.judge = (c.judge || KIT.filter((k) => D.pattern[k.id].some(Boolean)).map((k) => k.id)).map((id) => byId[id]);
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
      playPattern(D.pattern, c.bpm, () => [D.staff], done, { overlay });
    });
  const nextBtn = h('button', { type: 'button', class: 'btn-primary', hidden: true, onClick: () => nextAfter(li, ci) }, 'Continue');
  const pads = h('div', { class: 'pads' });
  const best = rec(li, ci).best;
  const help = typeof MODE_HELP[c.mode] === 'function' ? MODE_HELP[c.mode](pass) : MODE_HELP[c.mode];

  root.append(
    h('div', { class: 'drill-head' },
      h('span', { class: `mode-chip ${c.mode}` }, MODE_LABEL[c.mode]),
      h('span', { class: 'drill-meta' }, `${c.bpm} BPM · pass ${pass}%${best != null ? ` · best ${best}%` : ''}`)),
    h('p', { class: 'drill-help' }, help),
    h('section', { class: 'card score' }, h('div', { class: 'staff-wrap' }, staffHost, overlay), results),
    hearBtn || '',
    h('div', { class: 'drill-actions' }, startBtn, nextBtn),
    pads,
  );

  const active = () => D.phase === 'countin' || D.phase === 'running';
  const isJudged = (id) => D.judge.some((k) => k.id === id);
  const resetColors = () => {
    D.colors = {};
    // Notes you don't tap are shown in gray.
    for (const k of KIT) if (!isJudged(k.id)) D.pattern[k.id].forEach((on, s) => on && (D.colors[`${k.id}:${s}`] = 'var(--ink3)'));
    renderStaff();
  };
  const renderStaff = () => {
    D.staff = renderPattern(staffHost, { pattern: D.pattern, res: resOf(D.pattern), colors: D.colors });
  };
  const renderPads = () => {
    pads.replaceChildren(...D.judge.map((k, i) => h('button', {
      type: 'button',
      class: `pad ${k.family}${i === D.judge.length - 1 && D.judge.length % 2 ? ' wide' : ''}`,
      'data-id': k.id,
      onPointerdown: (e) => {
        e.preventDefault();
        hit(k.id, e.timeStamp, e.currentTarget);
      },
    }, h('span', { class: 'pad-name' }, k.name), h('span', { class: 'pad-key' }, k.keyLabel || k.key.toUpperCase()))));
  };
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

  onKey = (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, [role="dialog"]')) return;
    const k = D.judge.find((x) => x.key === e.key.toLowerCase());
    if (!k) return;
    e.preventDefault();
    hit(k.id, e.timeStamp, pads.querySelector(`[data-id="${k.id}"]`));
  };
  window.addEventListener('keydown', onKey);

  function flash(pad, kind) {
    if (!pad) return;
    pad.classList.remove('hit', 'good', 'ok', 'bad');
    void pad.offsetWidth;
    pad.classList.add('hit');
    if (kind) pad.classList.add(kind);
    pad.addEventListener('animationend', () => pad.classList.remove('hit', 'good', 'ok', 'bad'), { once: true });
  }

  function nearestGap(id) {
    const slots = [];
    D.pattern[id].forEach((on, i) => on && slots.push(i));
    if (slots.length < 2) return 4;
    let min = 16 - slots[slots.length - 1] + slots[0];
    for (let i = 1; i < slots.length; i++) min = Math.min(min, slots[i] - slots[i - 1]);
    return min;
  }

  function hit(id, ts, pad) {
    playInstrument(id);
    if (!active()) return flash(pad);
    const t = audioTimeAt(ts) - store.get('play.offset', 0) / 1000;
    const win = Math.min(0.15, D.sixteenth * 0.5 * nearestGap(id));
    let bestE = null;
    let bestD = Infinity;
    for (const e of D.expected) {
      if (e.id !== id || e.hit) continue;
      const d = t - e.time;
      if (Math.abs(d) <= win && Math.abs(d) < Math.abs(bestD)) {
        bestE = e;
        bestD = d;
      }
    }
    if (bestE) {
      bestE.hit = true;
      bestE.d = bestD;
      flash(pad, Math.abs(bestD) <= ON_TIME ? 'good' : 'ok');
    } else {
      D.extras++;
      flash(pad, 'bad');
    }
  }

  function start() {
    hearBtn?.reset();
    if (D.phase === 'results' && c.pool) pickPattern(); // a test retry gets a different pattern
    D.phase = 'countin';
    D.extras = 0;
    results.hidden = true;
    nextBtn.hidden = true;
    resetColors();
    renderPads();
    updateControls();
    const loops = 2;
    // Learn mode plays everything; otherwise only the parts you aren't tapping.
    const heard = c.mode === 'learn' ? D.pattern : (() => {
      const p = emptyPattern();
      for (const k of KIT) if (!isJudged(k.id)) p[k.id] = D.pattern[k.id];
      return p;
    })();
    transport.start({
      getBpm: () => c.bpm,
      getPattern: () => heard,
      loops,
      countInBeats: 4,
      playGroove: true,
      metronome: true,
      onEvent: (ev) => {
        if (ev.type === 'count') popCount(overlay, ev.n);
        else if (ev.type === 'step') {
          if (D.phase === 'countin') {
            D.phase = 'running';
            overlay.classList.remove('show');
          }
          D.staff.setPlayhead(ev.slot);
        } else if (ev.type === 'end') setTimeout(finish, 160);
      },
    });
    D.sixteenth = transport.sixteenth;
    D.expected = [];
    for (let loop = 0; loop < loops; loop++) {
      for (let slot = 0; slot < 16; slot++) {
        for (const k of D.judge) {
          if (D.pattern[k.id][slot]) D.expected.push({ id: k.id, slot, time: transport.startTime + (loop * 16 + slot) * D.sixteenth, hit: false, d: 0 });
        }
      }
    }
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
    let on = 0, early = 0, late = 0, missed = 0, sum = 0, hits = 0;
    const byNote = {};
    const rank = { on: 0, off: 1, miss: 2 };
    for (const e of D.expected) {
      let grade;
      if (!e.hit) {
        missed++;
        grade = 'miss';
      } else {
        hits++;
        sum += e.d;
        if (Math.abs(e.d) <= ON_TIME) {
          on++;
          grade = 'on';
        } else {
          grade = 'off';
          if (e.d < 0) early++;
          else late++;
        }
      }
      const k = `${e.id}:${e.slot}`;
      if (!byNote[k] || rank[grade] > rank[byNote[k]]) byNote[k] = grade;
    }
    const total = D.expected.length;
    const score = Math.max(0, Math.round((100 * (on + 0.5 * (early + late) - 0.25 * D.extras)) / total));
    const colorFor = { on: 'var(--green)', off: 'var(--orange)', miss: 'var(--red)' };
    for (const [k, v] of Object.entries(byNote)) D.colors[k] = colorFor[v];
    renderStaff();

    const prevBest = rec(li, ci).best ?? -1;
    const wasDone = isDone(li, ci);
    const levelWasDone = levelDone(li);
    if (score > prevBest) save(li, ci, { best: score });
    const passed = score >= pass;

    const mean = hits ? (sum / hits) * 1000 : 0;
    const tendency = hits < 3 ? ''
      : mean < -15 ? `You’re rushing a little — about ${Math.round(-mean)} ms early on average.`
      : mean > 15 ? `You’re dragging a little — about ${Math.round(mean)} ms late on average.`
      : 'Nicely centered on the beat.';
    const stat = (n, label, cls) => h('div', { class: `stat ${cls}` }, h('div', { class: 'stat-n' }, n), h('div', { class: 'stat-l' }, label));
    results.replaceChildren(
      h('div', { class: 'results-head' },
        h('div', { class: 'big-score' }, `${score}`, h('span', null, '%')),
        h('div', { class: 'results-msg' },
          h('div', { class: `results-title ${passed ? 'pass' : 'fail'}` }, passed ? (c.mode === 'test' ? 'Level passed!' : 'Passed') : `Need ${pass}% to pass`),
          h('div', { class: 'results-sub' }, starRow(stars(li, ci)), score > prevBest && prevBest >= 0 ? ' New best' : ''))),
      h('div', { class: 'stats' }, stat(on, 'On time', 'on'), stat(early, 'Early', 'off'), stat(late, 'Late', 'off'), stat(missed, 'Missed', 'miss')),
      tendency && h('p', { class: 'tendency' }, tendency),
      D.extras ? h('p', { class: 'tendency' }, `${D.extras} extra tap${D.extras === 1 ? '' : 's'} that didn’t match a note.`) : '',
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
