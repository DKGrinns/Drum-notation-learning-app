// Listen: ear training, two ways.
//   Pick it  – hear a groove, then pick the notation that matches it. The choices
//              differ by only a note or two, so you have to really read them.
//   Write it – hear a groove and write it down on a small grid (dictation).
import { h, segmented, svgIcon, ICONS } from '../ui.js';
import { KIT } from '../kit.js';
import { LEVEL_NAMES, NOTE, randomGroove, lookAlikes, emptyPattern, usedInstruments } from '../grooves.js';
import { renderPattern } from '../notation.js';
import { transport } from '../audio.js';
import { store } from '../store.js';
import { logPractice } from '../progress.js';

export const title = 'Listen';

const ROUND = 8;
const WRITE_ROUND = 4; // dictation takes longer per question
const COUNTS = ['', 'e', '&', 'a'];
const BPM = [80, 84, 88];
const LETTERS = 'ABC';

let S = null;
let els = null;
let ro = null;

export function mount(root) {
  S = {
    mode: store.get('listen.mode', 'pick') === 'write' ? 'write' : 'pick',
    level: store.get('listen.level', 0),
    round: null,
    playing: null, // index of the option being played, or 'q' for the question
  };
  if (!LEVEL_NAMES[S.level]) S.level = 0;

  const card = h('section', { class: 'card quiz-card', 'aria-live': 'polite' });
  root.append(
    h('div', { class: 'stack' },
      segmented([{ value: 'pick', label: 'Pick it' }, { value: 'write', label: 'Write it' }], S.mode, (v) => {
        S.mode = v;
        store.set('listen.mode', v);
        newRound(false);
      }, 'Exercise'),
      segmented(LEVEL_NAMES.map((label, value) => ({ value, label })), S.level, (v) => {
        S.level = v;
        store.set('listen.level', v);
        newRound(false);
      }, 'Level')),
    card,
    h('p', { class: 'footnote' }, 'Listen for where the kick and snare fall against the hi-hat count. After you answer, tap any groove to hear how it differs. In Write it, tap the squares to write the groove down, then check it against the answer.'),
  );
  els = { card };
  newRound(false);

  let lastW = card.clientWidth;
  ro = new ResizeObserver(() => {
    if (card.clientWidth === lastW) return;
    lastW = card.clientWidth;
    if (els.choices) drawChoices();
    else els.redraw?.();
  });
  ro.observe(card);
}

export function unmount() {
  ro?.disconnect();
  stopAudio();
  S.round = null;
}

const roundLength = () => (S.mode === 'write' ? WRITE_ROUND : ROUND);

function newRound(autoplay) {
  stopAudio();
  S.round = { i: 0, score: 0, q: null };
  newQuestion(autoplay);
}

// ---------- Write it (dictation) ----------

function newWriteQuestion(autoplay) {
  // Plain notes only: you write where the notes fall, not how they're played.
  const answer = randomGroove(S.level);
  for (const k of KIT) answer.pattern[k.id] = answer.pattern[k.id].map((v) => (v ? NOTE.HIT : 0));
  const kits = usedInstruments(answer);
  const fine = kits.some((k) => answer.pattern[k.id].some((v, s) => v && s % 2)); // any 16th notes?
  S.round.q = { options: [answer], answer: 0, mine: emptyPattern(), kits, step: fine ? 1 : 2, checked: null };
  renderWrite();
  if (autoplay) play('q');
}

function renderWrite() {
  const r = S.round;
  const q = r.q;
  const listenBtn = h('button', { type: 'button', class: 'listen-btn', onClick: () => (S.playing === 'q' ? stopAudio() : play('q')) });
  const mineHost = h('div', { class: 'staff-host' });
  const grid = h('div', { class: 'dict-grid', role: 'grid', 'aria-label': 'Write the groove' });
  const feedback = h('div', { class: 'feedback' });
  const answerBox = h('div', { class: 'dict-answer', hidden: true });
  const actions = h('div', { class: 'actions' });

  els.choices = null;
  els.card.replaceChildren(
    h('div', { class: 'quiz-top' }, h('span', null, `${r.i + 1} of ${WRITE_ROUND}`), h('span', null, `${BPM[S.level]} BPM`)),
    h('div', { class: 'progress' }, h('div', { style: { width: `${(r.i / WRITE_ROUND) * 100}%` } })),
    h('div', { class: 'prompt' }, 'Write what you hear'),
    listenBtn, mineHost, grid, feedback, answerBox, actions,
  );
  Object.assign(els, { listenBtn, feedback, actions });
  updateListenBtn();

  const colors = () => {
    if (!q.checked) return {};
    const out = {};
    for (const k of q.kits) {
      q.mine[k.id].forEach((v, s) => {
        if (v) out[`${k.id}:${s}`] = q.options[0].pattern[k.id][s] ? 'var(--green)' : 'var(--red)';
      });
    }
    return out;
  };
  const drawMine = () => {
    els.staffs = [renderPattern(mineHost, { pattern: q.mine, colors: colors(), s: 9 })];
  };
  els.redraw = () => {
    drawMine();
    if (q.checked) renderPattern(answerBox.querySelector('.staff-host'), { pattern: q.options[0].pattern, s: 9 });
  };

  const slots = [];
  for (let s = 0; s < 16; s += q.step) slots.push(s);
  grid.style.gridTemplateColumns = `52px repeat(${slots.length}, minmax(0, 1fr))`;
  grid.append(h('span'));
  for (const s of slots) grid.append(h('span', { class: `count${s % 4 === 0 ? ' beat' : ''}` }, s % 4 === 0 ? String(s / 4 + 1) : COUNTS[s % 4]));
  for (const k of q.kits) {
    grid.append(h('span', { class: 'dict-label' }, k.label));
    for (const s of slots) {
      const cell = h('button', {
        type: 'button', class: `cell ${k.family}${(s >> 2) % 2 ? ' alt' : ''}`, 'aria-pressed': 'false', 'aria-label': `${k.name} on ${s / 4 + 1}`,
        onClick: () => {
          if (q.checked) return;
          q.mine[k.id][s] = q.mine[k.id][s] ? 0 : NOTE.HIT;
          cell.classList.toggle('on', !!q.mine[k.id][s]);
          cell.setAttribute('aria-pressed', !!q.mine[k.id][s]);
          drawMine();
        },
      });
      grid.append(cell);
    }
  }

  const check = () => {
    stopAudio();
    let right = 0, wrong = 0, want = 0;
    for (const k of q.kits) {
      for (let s = 0; s < 16; s++) {
        const a = !!q.options[0].pattern[k.id][s];
        const m = !!q.mine[k.id][s];
        if (a) want++;
        if (a && m) right++;
        if (m && !a) wrong++;
      }
    }
    const score = Math.max(0, Math.round((100 * (right - wrong)) / want));
    q.checked = { score };
    r.score += score;
    grid.classList.add('locked');
    answerBox.hidden = false;
    answerBox.replaceChildren(h('div', { class: 'section-label' }, 'The groove'), h('div', { class: 'staff-host' }));
    els.redraw();
    const perfect = right === want && !wrong;
    feedback.className = `feedback ${perfect ? 'good' : 'bad'}`;
    feedback.replaceChildren(h('span', null, h('b', null, perfect ? 'Exactly right. ' : `${score}%. `),
      perfect ? 'Every note in the right place.'
        : `${right} of ${want} notes right${wrong ? `, ${wrong} that ${wrong === 1 ? 'isn’t' : 'aren’t'} there (red)` : ''}. Play it again and compare with the answer below.`));
    const last = r.i + 1 >= WRITE_ROUND;
    actions.replaceChildren(h('button', { type: 'button', class: 'btn-primary', onClick: next }, last ? 'See results' : 'Next'));
  };
  actions.append(h('button', { type: 'button', class: 'btn-primary', onClick: check }, 'Check'));
  drawMine();
}

function newQuestion(autoplay) {
  if (S.mode === 'write') return newWriteQuestion(autoplay);
  const answer = randomGroove(S.level);
  const { options, answer: idx } = lookAlikes(answer, 3, S.level);
  S.round.q = { options, answer: idx, picked: null };
  renderQuestion();
  if (autoplay) play('q');
}

function renderQuestion() {
  const r = S.round;
  const listenBtn = h('button', { type: 'button', class: 'listen-btn', onClick: () => (S.playing === 'q' ? stopAudio() : play('q')) });
  const feedback = h('div', { class: 'feedback' });
  const choices = h('div', { class: 'choices' });
  const actions = h('div', { class: 'actions' });

  els.card.replaceChildren(
    h('div', { class: 'quiz-top' }, h('span', null, `${r.i + 1} of ${ROUND}`), h('span', null, `${BPM[S.level]} BPM`)),
    h('div', { class: 'progress' }, h('div', { style: { width: `${(r.i / ROUND) * 100}%` } })),
    h('div', { class: 'prompt' }, 'Which groove do you hear?'),
    listenBtn,
    choices,
    feedback,
    actions,
  );
  Object.assign(els, { listenBtn, feedback, choices, actions });
  updateListenBtn();
  drawChoices();
}

function drawChoices() {
  const q = S.round.q;
  els.choices.replaceChildren();
  els.staffs = q.options.map((g, i) => {
    const host = h('div', { class: 'staff-host' });
    let state = '';
    if (q.picked != null) {
      if (i === q.answer) state = ' right';
      else if (i === q.picked) state = ' wrong';
      else state = ' dim';
    }
    const btn = h('button', {
      type: 'button',
      class: `choice${state}`,
      'aria-label': `Groove ${LETTERS[i]}`,
      onClick: () => choose(i),
    }, h('span', { class: 'choice-letter' }, LETTERS[i]), host);
    els.choices.append(btn);
    return renderPattern(host, { pattern: g.pattern, s: 8.5 });
  });
}

function choose(i) {
  const q = S.round.q;
  if (q.picked != null) {
    // After answering, tapping a groove plays it so you can compare.
    if (S.playing === i) stopAudio();
    else play(i);
    return;
  }
  q.picked = i;
  const correct = i === q.answer;
  if (correct) S.round.score++;
  stopAudio();
  drawChoices();
  els.feedback.className = `feedback ${correct ? 'good' : 'bad'}`;
  els.feedback.replaceChildren(correct
    ? h('span', null, h('b', null, 'Correct. '), 'Tap any groove to hear it.')
    : h('span', null, h('b', null, `It was ${LETTERS[q.answer]}. `), 'Tap each groove to hear the difference.'));
  const last = S.round.i + 1 >= ROUND;
  els.actions.replaceChildren(h('button', { type: 'button', class: 'btn-primary', onClick: next }, last ? 'See results' : 'Next'));
}

function next() {
  S.round.i++;
  if (S.round.i >= roundLength()) renderSummary();
  else newQuestion(true);
}

function renderSummary() {
  stopAudio();
  const r = S.round;
  els.choices = null;
  els.redraw = null;
  if (S.mode === 'write') {
    const avg = Math.round(r.score / WRITE_ROUND);
    logPractice({ kind: 'listen', label: `Dictation · ${LEVEL_NAMES[S.level]}`, score: avg });
    els.card.replaceChildren(
      h('div', { class: 'summary' },
        h('div', { class: 'big-score' }, `${avg}`, h('span', null, '%')),
        h('div', { class: 'summary-msg' }, avg === 100 ? 'Perfect ears!' : avg >= 75 ? 'Great listening.' : avg >= 50 ? 'Getting there — keep going.' : 'Keep at it. Write the kick first, then the snare, then the cymbal.'),
        h('button', { type: 'button', class: 'btn-primary', onClick: () => newRound(true) }, 'New round')),
    );
    return;
  }
  const msg = r.score === ROUND ? 'Perfect ears!'
    : r.score >= 6 ? 'Great listening.'
    : r.score >= 4 ? 'Getting there — keep going.'
    : 'Keep at it. Listen to the kick first, then the snare.';
  logPractice({ kind: 'listen', label: `Listen · ${LEVEL_NAMES[S.level]}`, score: Math.round((100 * r.score) / ROUND) });
  const best = store.get('listen.best', {});
  const isBest = r.score > (best[S.level] || 0);
  if (isBest) {
    best[S.level] = r.score;
    store.set('listen.best', best);
  }
  els.card.replaceChildren(
    h('div', { class: 'summary' },
      h('div', { class: 'big-score' }, `${r.score}`, h('span', null, `/${ROUND}`)),
      h('div', { class: 'summary-msg' }, isBest && r.score ? `${msg} New personal best.` : msg),
      h('button', { type: 'button', class: 'btn-primary', onClick: () => newRound(true) }, 'New round')),
  );
}

// ---------- Audio ----------

function play(which) {
  const q = S.round?.q;
  if (!q) return;
  const g = which === 'q' ? q.options[q.answer] : q.options[which];
  stopAudio();
  S.playing = which;
  updateListenBtn();
  markPlaying();
  // Which staffs follow along: all of them for the question, just one when comparing.
  const follow = which === 'q' ? els.staffs : [els.staffs[which]];
  transport.start({
    getBpm: () => BPM[S.level],
    getPattern: () => g.pattern,
    loops: 2,
    countInBeats: 4,
    playGroove: true,
    metronome: false,
    onEvent: (ev) => {
      if (ev.type === 'step') for (const st of follow) st.setPlayhead(ev.slot);
      else if (ev.type === 'end' || ev.type === 'interrupt') finishAudio();
    },
  });
}

function stopAudio() {
  transport.stop();
  finishAudio();
}

function finishAudio() {
  if (!S) return;
  S.playing = null;
  for (const st of els?.staffs || []) st.setPlayhead(null);
  if (els?.listenBtn) updateListenBtn();
  markPlaying();
}

function markPlaying() {
  if (!els?.choices) return;
  [...els.choices.children].forEach((b, i) => b.classList.toggle('playing', S.playing === i));
}

function updateListenBtn() {
  const on = S.playing === 'q';
  els.listenBtn.replaceChildren(svgIcon(on ? ICONS.stop : ICONS.play), h('span', null, on ? 'Stop' : 'Play the groove'));
  els.listenBtn.classList.toggle('on', on);
}
