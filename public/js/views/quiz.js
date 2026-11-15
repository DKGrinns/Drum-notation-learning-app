// Quiz: three topics.
//   Drums       – where each drum lives on the staff:
//                   Name the note  – see a note, pick the drum.
//                   Place the note – see a drum name, tap its spot on the staff.
//   Note values – what kind of note (or rest) is this?
//   Counting    – which count does the highlighted note land on?
import { h, segmented } from '../ui.js';
import { KIT, byId } from '../kit.js';
import { renderSingle, renderPattern } from '../notation.js';
import { makeGroove, randomGroove, LEVEL_NAMES, validSlots, slotPos, isTrip, subdivision, countLabel, usedInstruments } from '../grooves.js';
import { playInstrument } from '../audio.js';
import { store } from '../store.js';
import { logPractice } from '../progress.js';

export const title = 'Quiz';

const ROUND = 10;
const LEVELS = [
  { value: 0, label: 'Basics', ids: ['hihat', 'snare', 'kick'] },
  { value: 1, label: '+ Toms', ids: ['hihat', 'snare', 'kick', 'tom1', 'tom2', 'floor'] },
  { value: 2, label: 'Full kit', ids: KIT.map((k) => k.id) },
];

const TOPICS = [
  { value: 'drums', label: 'Drums', tip: 'Tip: cymbals use x noteheads, drums use round ones, and the kick’s stem points down.' },
  { value: 'values', label: 'Note values', tip: 'Tip: each beam or flag halves a note’s length. A dot makes it half as long again.' },
  { value: 'counts', label: 'Counting', tip: 'Tip: find the beat first (1, 2, 3, 4), then the part of the beat.' },
];

const ALL16 = [...Array(16).keys()];
const TRIPS = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14];
const NOTE_NAMES = ['Whole note', 'Half note', 'Dotted quarter note', 'Quarter note', 'Dotted 8th note', '8th note', '8th-note triplet', '16th note'];
const REST_NAMES = ['Quarter rest', '8th rest', 'Dotted 8th rest', '16th rest'];
// `at` is the slot of the note being asked about; without it the question is about the bar's rests.
const VALUES = [
  { spec: { snare: [0, 4, 8, 12] }, at: 4, name: 'Quarter note', why: 'A quarter note has a filled head and a plain stem. It lasts one beat.' },
  { spec: { snare: [0, 4, 6, 8, 12] }, at: 8, name: 'Quarter note', why: 'A quarter note has a filled head and a plain stem. It lasts one beat.' },
  { spec: { snare: [0, 2, 4, 6, 8, 10, 12, 14] }, at: 6, name: '8th note', why: '8th notes are joined by one beam. Two fit in a beat.' },
  { spec: { snare: [0, 2, 3, 4, 8, 12] }, at: 0, name: '8th note', why: 'One beam: an 8th note. The two after it have two beams, so they’re 16ths.' },
  { spec: { snare: ALL16 }, at: 5, name: '16th note', why: '16th notes are joined by two beams. Four fit in a beat.' },
  { spec: { snare: [0, 2, 3, 4, 8, 12] }, at: 3, name: '16th note', why: 'Two beams: a 16th note. It’s half as long as the 8th before it.' },
  { spec: { snare: [0, 8], long: true }, at: 8, name: 'Half note', why: 'A half note has a hollow head and a stem. It lasts two beats.' },
  { spec: { snare: [0], long: true }, at: 0, name: 'Whole note', why: 'A whole note is a hollow head with no stem. It lasts four beats.' },
  { spec: { snare: [0, 6, 8, 12], long: true }, at: 0, name: 'Dotted quarter note', why: 'The dot adds half again: a beat and a half.' },
  { spec: { snare: [0, 3, 4, 8, 12] }, at: 0, name: 'Dotted 8th note', why: 'A dotted 8th lasts three 16ths. The 16th after it completes the beat.' },
  { spec: { trip: [0, 1, 2, 3], snare: TRIPS }, at: 5, name: '8th-note triplet', why: 'Three notes share one beat, marked with a 3.' },
  { spec: { snare: [0, 4, 12] }, name: 'Quarter rest', why: 'The squiggle on beat 3 is a quarter rest: one beat of silence.' },
  { spec: { snare: [2, 6, 10, 14] }, name: '8th rest', why: 'An 8th rest has one flag. Each one here fills the first half of a beat.' },
  { spec: { snare: [3, 7, 11, 15] }, name: 'Dotted 8th rest', why: 'A dotted 8th rest lasts three 16ths, so the note lands on the “a”.' },
  { spec: { snare: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15] }, name: '16th rest', why: 'A 16th rest has two flags. It takes the place of the first 16th in each beat.' },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
function shuffle(a) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

let S = null;
let els = null;
let ro = null;

export function mount(root) {
  S = {
    topic: store.get('quiz.topic', 'drums'),
    clevel: store.get('quiz.clevel', 0), // Counting level
    mode: store.get('quiz.mode', 'name'),
    level: store.get('quiz.level', 0),
    round: null,
    placed: null,
    answered: null, // { correct, picked }
  };
  if (!LEVELS[S.level]) S.level = 0;
  if (!TOPICS.some((t) => t.value === S.topic)) S.topic = 'drums';
  if (!LEVEL_NAMES[S.clevel]) S.clevel = 0;

  const card = h('section', { class: 'card quiz-card', 'aria-live': 'polite' });
  const tip = h('p', { class: 'footnote' });
  const modeSeg = segmented([{ value: 'name', label: 'Name the note' }, { value: 'place', label: 'Place the note' }], S.mode, (v) => {
    S.mode = v;
    store.set('quiz.mode', v);
    newRound();
  }, 'Quiz mode');
  const levelSeg = segmented(LEVELS.map(({ value, label }) => ({ value, label })), S.level, (v) => {
    S.level = v;
    store.set('quiz.level', v);
    newRound();
  }, 'Level');
  const countSeg = segmented(LEVEL_NAMES.map((label, value) => ({ value, label })), S.clevel, (v) => {
    S.clevel = v;
    store.set('quiz.clevel', v);
    newRound();
  }, 'Counting level');
  const showControls = () => {
    modeSeg.hidden = levelSeg.hidden = S.topic !== 'drums';
    countSeg.hidden = S.topic !== 'counts';
    tip.textContent = TOPICS.find((t) => t.value === S.topic).tip;
  };
  root.append(
    h('div', { class: 'stack' },
      segmented(TOPICS.map(({ value, label }) => ({ value, label })), S.topic, (v) => {
        S.topic = v;
        store.set('quiz.topic', v);
        showControls();
        newRound();
      }, 'Quiz topic'),
      modeSeg, levelSeg, countSeg),
    card,
    tip,
  );
  els = { card };
  showControls();
  newRound();
  let lastW = card.clientWidth;
  ro = new ResizeObserver(() => {
    if (card.clientWidth === lastW) return; // only redraw when the width changes
    lastW = card.clientWidth;
    if (els.staffHost) drawStaff();
  });
  ro.observe(card);
}

export function unmount() {
  ro?.disconnect();
  S.round = null;
}

function pickQuestions() {
  const ids = LEVELS[S.level].ids;
  const stats = store.get('quiz.stats', {});
  const weight = (id) => {
    const st = stats[id] || { seen: 0, wrong: 0 };
    return 1 + (3 * (st.wrong + 0.5)) / (st.seen + 1); // missed notes come up more often
  };
  const qs = [];
  let prev = null;
  for (let i = 0; i < ROUND; i++) {
    const pool = ids.filter((id) => id !== prev);
    const total = pool.reduce((a, id) => a + weight(id), 0);
    let r = Math.random() * total;
    let pick = pool[pool.length - 1];
    for (const id of pool) {
      r -= weight(id);
      if (r <= 0) {
        pick = id;
        break;
      }
    }
    qs.push(pick);
    prev = pick;
  }
  return qs;
}

// ---------- Note values and counting ----------
//
// A question: { pattern, colors, target ('drum:slot' or null), prompt, options, answer, why, sound }

function valueQuestions() {
  return shuffle(VALUES).slice(0, ROUND).map((v) => {
    const pattern = makeGroove('', v.spec).pattern;
    const isNote = v.at != null;
    const colors = {};
    if (isNote) {
      pattern.snare.forEach((on, s) => on && (colors[`snare:${s}`] = 'var(--ink3)'));
      colors[`snare:${v.at}`] = 'var(--blue)';
    }
    const options = isNote
      ? [v.name, ...shuffle(NOTE_NAMES.filter((n) => n !== v.name)).slice(0, 3)].sort((a, b) => NOTE_NAMES.indexOf(a) - NOTE_NAMES.indexOf(b))
      : REST_NAMES;
    return {
      pattern, colors, options,
      target: isNote ? `snare:${v.at}` : null,
      prompt: isNote ? ['What kind of note is the ', h('b', null, 'blue'), ' one?'] : 'Which kind of rest is in this bar?',
      answer: options.indexOf(v.name),
      why: v.why,
      sound: 'snare',
    };
  });
}

function countQuestions() {
  return Array.from({ length: ROUND }, () => {
    // Advanced mixes in shuffles, 6/8 and ghost-note grooves.
    const gen = S.clevel < 2 ? S.clevel : pick([2, 2, 'shuffle', '6/8', 'dynamics']);
    const { pattern } = randomGroove(gen);
    const k = pick(usedInstruments({ pattern }));
    const slot = pick(pattern[k.id].map((on, s) => (on ? s : -1)).filter((s) => s >= 0));
    const colors = {};
    for (const kk of KIT) pattern[kk.id].forEach((on, s) => on && (colors[`${kk.id}:${s}`] = 'var(--ink3)'));
    colors[`${k.id}:${slot}`] = 'var(--blue)';
    // Choices: the right count plus three nearby counts on the groove's own grid.
    const step = { 4: 4, 8: 2, 16: 1 }[subdivision({ pattern })];
    const dist = (a) => Math.abs(slotPos(pattern, a) - slotPos(pattern, slot));
    const near = validSlots(pattern).filter((s) => s !== slot && (isTrip(pattern, s >> 2) || (s & 3) % step === 0));
    near.sort((a, b) => dist(a) - dist(b));
    const opts = [slot, ...shuffle(near.slice(0, 5)).slice(0, 3)].sort((a, b) => a - b);
    return {
      pattern, colors,
      target: `${k.id}:${slot}`,
      prompt: ['What’s the count for the ', h('b', null, 'blue'), ' note?'],
      options: opts.map((s) => countLabel(s, pattern)),
      answer: opts.indexOf(slot),
      why: `That ${k.name.toLowerCase()} note is on “${countLabel(slot, pattern)}”.`,
      sound: k.id,
    };
  });
}

function roundHead(r) {
  return [
    h('div', { class: 'quiz-top' },
      h('span', null, `${r.i + 1} of ${r.qs.length}`),
      h('span', { class: 'streak' }, r.streak >= 3 ? `${r.streak} in a row` : '')),
    h('div', { class: 'progress' }, h('div', { style: { width: `${(r.i / r.qs.length) * 100}%` } })),
  ];
}

function renderRhythmQuestion() {
  const r = S.round;
  const q = r.qs[r.i];
  const staffHost = h('div', { class: 'staff-host' });
  const feedback = h('div', { class: 'feedback' });
  const actions = h('div', { class: 'answers' });
  els.card.replaceChildren(...roundHead(r), h('div', { class: 'prompt' }, q.prompt), staffHost, feedback, actions);
  Object.assign(els, { staffHost, feedback, actions });
  q.options.forEach((label, idx) => actions.append(h('button', { type: 'button', class: 'answer', onClick: () => answerRhythm(idx) }, label)));
  drawStaff();
}

function answerRhythm(idx) {
  if (S.answered) return;
  const r = S.round;
  const q = r.qs[r.i];
  const correct = idx === q.answer;
  S.answered = { correct };
  [...els.actions.children].forEach((b, k) => {
    b.disabled = true;
    if (k === q.answer) b.classList.add('right');
    else if (k === idx) b.classList.add('wrong');
  });
  if (q.target) q.colors[q.target] = correct ? 'var(--green)' : 'var(--red)';
  playInstrument(q.sound);
  if (correct) {
    r.score++;
    r.streak++;
  } else r.streak = 0;
  els.feedback.className = `feedback ${correct ? 'good' : 'bad'}`;
  els.feedback.replaceChildren(h('span', null, h('b', null, correct ? 'Correct. ' : `Not quite: ${q.options[q.answer]}. `), q.why));
  drawStaff();
  if (correct) {
    setTimeout(() => S.round === r && next(), 1400);
  } else {
    const btn = h('button', { type: 'button', class: 'btn-primary', onClick: next }, 'Continue');
    els.card.append(h('div', { class: 'actions' }, btn));
    btn.focus({ preventScroll: true });
  }
}

function newRound() {
  const qs = S.topic === 'values' ? valueQuestions() : S.topic === 'counts' ? countQuestions() : pickQuestions();
  S.round = { qs, i: 0, score: 0, streak: 0, misses: [] };
  S.placed = null;
  S.answered = null;
  renderQuestion();
}

function target() {
  return byId[S.round.qs[S.round.i]];
}

function renderQuestion() {
  if (S.topic !== 'drums') return renderRhythmQuestion();
  const r = S.round;
  const k = target();
  const staffHost = h('div', { class: 'staff-host quiz-staff' });
  const feedback = h('div', { class: 'feedback' });
  const actions = h('div', { class: S.mode === 'name' ? 'answers' : 'actions' });

  els.card.replaceChildren(
    h('div', { class: 'quiz-top' },
      h('span', null, `${r.i + 1} of ${r.qs.length}`),
      h('span', { class: 'streak' }, r.streak >= 3 ? `${r.streak} in a row` : '')),
    h('div', { class: 'progress' }, h('div', { style: { width: `${(r.i / r.qs.length) * 100}%` } })),
    h('div', { class: 'prompt' },
      S.mode === 'name' ? 'Which drum is this?' : ['Tap where the ', h('b', null, k.name), ' goes']),
    staffHost,
    feedback,
    actions,
  );
  Object.assign(els, { staffHost, feedback, actions });

  if (S.mode === 'name') {
    const ids = LEVELS[S.level].ids;
    if (ids.length % 3 === 0 && ids.length < 8) actions.classList.add('three');
    for (const k2 of KIT.filter((x) => ids.includes(x.id))) {
      actions.append(h('button', { type: 'button', class: 'answer', 'data-id': k2.id, onClick: () => answerName(k2.id) }, k2.name));
    }
  } else {
    actions.append(h('button', { type: 'button', class: 'btn-primary', disabled: true, onClick: checkPlace }, 'Check'));
  }
  drawStaff();
}

function staffItems() {
  const k = target();
  const base = { head: k.head, foot: k.foot };
  if (S.mode === 'name') {
    const color = S.answered ? (S.answered.correct ? 'var(--green)' : 'currentColor') : null;
    return [{ ...base, step: k.step, color }];
  }
  if (S.answered) {
    if (S.answered.correct) return [{ ...base, step: k.step, color: 'var(--green)' }];
    return [
      { ...base, step: S.placed, color: 'var(--red)', dx: -1.6 },
      { ...base, step: k.step, color: 'var(--green)', dx: 1.6 },
    ];
  }
  return S.placed == null ? [] : [{ ...base, step: S.placed, color: 'var(--blue)', opacity: 0.85 }];
}

function drawStaff() {
  if (S.topic !== 'drums') {
    const q = S.round.qs[S.round.i];
    return void renderPattern(els.staffHost, { pattern: q.pattern, colors: q.colors });
  }
  const st = renderSingle(els.staffHost, { items: staffItems(), s: 13 });
  if (S.mode === 'place' && !S.answered) {
    st.svg.classList.add('tappable');
    st.svg.addEventListener('pointerdown', (e) => {
      const rect = st.svg.getBoundingClientRect();
      const y = ((e.clientY - rect.top) * st.height) / rect.height;
      S.placed = Math.max(-1, Math.min(11, st.stepFromY(y)));
      els.actions.querySelector('button').disabled = false;
      drawStaff();
    });
  }
}

function record(id, correct) {
  const stats = store.get('quiz.stats', {});
  const st = stats[id] || { seen: 0, wrong: 0 };
  st.seen++;
  if (!correct) st.wrong++;
  stats[id] = st;
  store.set('quiz.stats', stats);
}

function answerName(pickedId) {
  if (S.answered) return;
  const k = target();
  const correct = pickedId === k.id;
  for (const b of els.actions.querySelectorAll('.answer')) {
    b.disabled = true;
    if (b.dataset.id === k.id) b.classList.add('right');
    else if (b.dataset.id === pickedId) b.classList.add('wrong');
  }
  finishAnswer(correct, correct ? null : `You picked ${byId[pickedId].name}.`);
}

function checkPlace() {
  if (S.answered || S.placed == null) return;
  finishAnswer(S.placed === target().step, null);
}

function finishAnswer(correct, prefix) {
  const r = S.round;
  const k = target();
  S.answered = { correct };
  record(k.id, correct);
  playInstrument(k.id);
  if (correct) {
    r.score++;
    r.streak++;
  } else {
    r.streak = 0;
    r.misses.push(k.id);
  }
  els.feedback.className = `feedback ${correct ? 'good' : 'bad'}`;
  els.feedback.replaceChildren(
    correct
      ? h('span', null, h('b', null, 'Correct. '), `The ${k.name} sits ${k.where}.`)
      : S.mode === 'place'
        ? h('span', null, h('b', null, 'Not quite. '), `The ${k.name} sits ${k.where}.`)
        : h('span', null, prefix ? `${prefix} ` : '', h('b', null, `This is the ${k.name}`), ` — it sits ${k.where}.`),
  );
  drawStaff();

  if (S.mode === 'place') els.actions.replaceChildren();
  if (correct) {
    const round = r;
    setTimeout(() => S.round === round && next(), 1100);
  } else {
    const btn = h('button', { type: 'button', class: 'btn-primary', onClick: next }, 'Continue');
    if (S.mode === 'name') els.card.append(h('div', { class: 'actions' }, btn));
    else els.actions.append(btn);
    btn.focus({ preventScroll: true });
  }
}

function next() {
  const r = S.round;
  r.i++;
  S.placed = null;
  S.answered = null;
  if (r.i >= r.qs.length) renderSummary();
  else renderQuestion();
}

function renderSummary() {
  const r = S.round;
  els.staffHost = null;
  const n = r.qs.length;
  const msg = r.score === n ? 'Perfect round!'
    : r.score >= 8 ? 'Great reading.'
    : r.score >= 5 ? 'Getting there — keep going.'
    : S.topic === 'drums' ? 'Keep at it. Try fewer drums with Basics first.'
    : 'Keep at it. The Learn tab explains each of these step by step.';
  const missed = [...new Set(r.misses)].map((id) => byId[id]);
  const label = S.topic === 'drums' ? LEVELS[S.level].label : S.topic === 'values' ? 'Note values' : `Counting · ${LEVEL_NAMES[S.clevel]}`;
  logPractice({ kind: 'quiz', label: `Quiz · ${label}`, score: Math.round((100 * r.score) / n) });
  els.card.replaceChildren(
    h('div', { class: 'summary' },
      h('div', { class: 'big-score' }, `${r.score}`, h('span', null, `/${n}`)),
      h('div', { class: 'summary-msg' }, msg),
      missed.length
        ? h('div', { class: 'review' },
          h('div', { class: 'section-label' }, 'Review'),
          h('div', { class: 'list inset' },
            missed.map((k) => h('button', { type: 'button', class: 'row row-btn', onClick: () => playInstrument(k.id) },
              h('span', { class: 'row-main' }, h('span', null, k.name), h('span', { class: 'row-sub' }, `Sits ${k.where}`))))))
        : null,
      h('button', { type: 'button', class: 'btn-primary', onClick: newRound }, 'New round')),
  );
}
