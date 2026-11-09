// Listen: hear a groove, then pick the notation that matches it.
// The choices differ by only a note or two, so you have to really read them.
import { h, segmented, svgIcon, ICONS } from '../ui.js';
import { LEVEL_NAMES, randomGroove, lookAlikes, subdivision } from '../grooves.js';
import { renderPattern } from '../notation.js';
import { transport } from '../audio.js';
import { store } from '../store.js';

export const title = 'Listen';

const ROUND = 8;
const BPM = [80, 84, 88];
const LETTERS = 'ABC';

let S = null;
let els = null;
let ro = null;

export function mount(root) {
  S = {
    level: store.get('listen.level', 0),
    round: null,
    playing: null, // index of the option being played, or 'q' for the question
  };
  if (!LEVEL_NAMES[S.level]) S.level = 0;

  const card = h('section', { class: 'card quiz-card', 'aria-live': 'polite' });
  root.append(
    h('div', { class: 'stack' },
      segmented(LEVEL_NAMES.map((label, value) => ({ value, label })), S.level, (v) => {
        S.level = v;
        store.set('listen.level', v);
        newRound(false);
      }, 'Level')),
    card,
    h('p', { class: 'footnote' }, 'Listen for where the kick and snare fall against the hi-hat count. After you answer, tap any groove to hear how it differs.'),
  );
  els = { card };
  newRound(false);

  let lastW = card.clientWidth;
  ro = new ResizeObserver(() => {
    if (card.clientWidth === lastW) return;
    lastW = card.clientWidth;
    if (els.choices) drawChoices();
  });
  ro.observe(card);
}

export function unmount() {
  ro?.disconnect();
  stopAudio();
  S.round = null;
}

function newRound(autoplay) {
  stopAudio();
  S.round = { i: 0, score: 0, q: null };
  newQuestion(autoplay);
}

function newQuestion(autoplay) {
  const answer = randomGroove(S.level);
  const { options, answer: idx } = lookAlikes(answer, 3, S.level);
  S.round.q = { options, answer: idx, picked: null, res: options.some((o) => subdivision(o) === 16) ? 1 : 2 };
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
    return renderPattern(host, { pattern: g.pattern, res: q.res, s: 8.5 });
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
  if (S.round.i >= ROUND) renderSummary();
  else newQuestion(true);
}

function renderSummary() {
  stopAudio();
  const r = S.round;
  els.choices = null;
  const msg = r.score === ROUND ? 'Perfect ears!'
    : r.score >= 6 ? 'Great listening.'
    : r.score >= 4 ? 'Getting there — keep going.'
    : 'Keep at it. Listen to the kick first, then the snare.';
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
      else if (ev.type === 'end') finishAudio();
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
