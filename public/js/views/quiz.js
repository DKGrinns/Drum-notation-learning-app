// Quiz: learn where each drum lives on the staff.
//   Name the note  – see a note, pick the drum.
//   Place the note – see a drum name, tap its spot on the staff.
import { h, segmented } from '../ui.js';
import { KIT, byId } from '../kit.js';
import { renderSingle } from '../notation.js';
import { playInstrument } from '../audio.js';
import { store } from '../store.js';

export const title = 'Quiz';

const ROUND = 10;
const LEVELS = [
  { value: 0, label: 'Basics', ids: ['hihat', 'snare', 'kick'] },
  { value: 1, label: '+ Toms', ids: ['hihat', 'snare', 'kick', 'tom1', 'tom2', 'floor'] },
  { value: 2, label: 'Full kit', ids: KIT.map((k) => k.id) },
];

let S = null;
let els = null;
let ro = null;

export function mount(root) {
  S = {
    mode: store.get('quiz.mode', 'name'),
    level: store.get('quiz.level', 0),
    round: null,
    placed: null,
    answered: null, // { correct, picked }
  };
  if (!LEVELS[S.level]) S.level = 0;

  const card = h('section', { class: 'card quiz-card', 'aria-live': 'polite' });
  root.append(
    h('div', { class: 'stack' },
      segmented([{ value: 'name', label: 'Name the note' }, { value: 'place', label: 'Place the note' }], S.mode, (v) => {
        S.mode = v;
        store.set('quiz.mode', v);
        newRound();
      }, 'Quiz mode'),
      segmented(LEVELS.map(({ value, label }) => ({ value, label })), S.level, (v) => {
        S.level = v;
        store.set('quiz.level', v);
        newRound();
      }, 'Level')),
    card,
    h('p', { class: 'footnote' }, 'Tip: cymbals use x noteheads, drums use round ones, and the kick’s stem points down.'),
  );
  els = { card };
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

function newRound() {
  S.round = { qs: pickQuestions(), i: 0, score: 0, streak: 0, misses: [] };
  S.placed = null;
  S.answered = null;
  renderQuestion();
}

function target() {
  return byId[S.round.qs[S.round.i]];
}

function renderQuestion() {
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
    : 'Keep at it. Try fewer drums with Basics first.';
  const missed = [...new Set(r.misses)].map((id) => byId[id]);
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
