// The learning path: levels, each introducing one new element.
//
// Every level has a few challenges, unlocked in order:
//   intro  – meet the new element: short explanations, then quick checks
//   drill  – tap along. mode:
//              learn    – you hear the part you're tapping, as a guide
//              practice – just the click; you read it yourself
//              test     – a random pattern from the level's pool, click only.
//                         Pass it to unlock the next level.
//
// Intro pages:
//   info  – text + figure ({ notes: [ids] } or { spec, play: bpm })
//   name  – see a note, pick the drum
//   count – one note is highlighted; pick its count ("2 &")
//   pick  – hear a groove, pick the matching staff
//
// A figure or drill can also be a chart of several bars:
//   figure: { chart: { bars: [spec…], order?, endings? }, play: bpm }
//   drill:  spec (or a pool entry) of the form { bars: [spec…], order?, endings? }
// order lists the bar numbers as played; endings: [first, second] bar numbers.
//
// Grooves use the preset spec format (see grooves.js makeGroove):
//   { instrumentId: [slots], meter?: '3/4'|'6/8'|'12/8', trip?: [triplet beats], long?: true,
//     accent?|ghost?|open?|flam?: { instrumentId: [slots] } }
// Slots are beat*4 + j. In a triplet beat (and every 6/8 or 12/8 beat), j = 0..2 are the three 8ths.

const Q = [0, 4, 8, 12];
const E = [0, 2, 4, 6, 8, 10, 12, 14];
const X = [...Array(16).keys()];
const ROCK = { hihat: E, snare: [4, 12], kick: [0, 8] };
const T = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]; // every triplet slot
const SH = [0, 2, 4, 6, 8, 10, 12, 14]; // in triplet beats: "1 – let" (the shuffle)
const ALL = [0, 1, 2, 3];
const TWO_THREE = { trip: [1, 3], snare: [0, 2, 4, 5, 6, 8, 10, 12, 13, 14] };
const SHUFFLE = { trip: ALL, hihat: SH, snare: [4, 12], kick: [0, 8] };
const groove = (kick, extra = {}) => ({ hihat: E, snare: [4, 12], kick, ...extra });
const WALTZ = { meter: '3/4', hihat: [0, 2, 4, 6, 8, 10], snare: [4, 8], kick: [0] };
const ACC_ROCK = { hihat: E, accent: { hihat: Q }, snare: [4, 12], kick: [0, 8, 10] };
const GHOST = { hihat: E, snare: [4, 12], ghost: { snare: [7, 15] }, kick: [0, 8] };
const GHOST2 = { hihat: E, snare: [4, 12], ghost: { snare: [7, 9, 15] }, kick: [0, 3, 10] };
const OPEN = { hihat: [0, 2, 4, 6, 8, 10, 12], open: { hihat: [14] }, snare: [4, 12], kick: [0, 8, 10] };
const DISCO = { hihat: E, open: { hihat: [2, 6, 10, 14] }, snare: [4, 12], kick: Q };
const FLAM_ROCK = { hihat: E, snare: [4], flam: { snare: [12] }, kick: [0, 8, 10] };
const SIXEIGHT = { meter: '6/8', hihat: [0, 1, 2, 4, 5, 6], snare: [4], kick: [0, 2] };
const BLUES = { meter: '12/8', ride: T, snare: [4, 12], kick: [0, 2, 8, 10] };

// Charts (several bars)
const HH6 = [0, 2, 4, 6, 8, 10]; // hi-hat 8ths that stop before a beat-4 fill
const ROCK_AND = groove([0, 8, 10]);
const FILL_8 = { hihat: HH6, snare: [4, 12, 14], kick: [0, 8] };
const FILL_16 = { hihat: HH6, snare: [4, 12, 13, 14, 15], kick: [0, 8] };
const FILL_GALLOP = { hihat: HH6, snare: [4, 12, 14, 15], kick: [0, 8, 10] };
const CHART_2 = { bars: [ROCK, ROCK_AND] };
const CHART_4 = { bars: [ROCK, ROCK_AND, ROCK, FILL_8] };
const CHART_REPEAT = { bars: [ROCK, ROCK_AND, groove([0, 6, 8]), FILL_16], order: [0, 1, 2, 0, 1, 3], endings: [2, 3] };

export const PASS = { learn: 60, practice: 70, test: 80 };

export const LEVELS = [
  {
    id: 'l1', title: 'Quarter notes', element: 'The staff and counting to four',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the staff', pages: [
        { type: 'info', title: 'Five lines, one kit',
          body: ['Drum music uses a **five-line staff**. Each line and space stands for a **drum**, not a pitch.',
            'The two thick bars at the start are the **percussion clef**.'],
          figure: { notes: ['snare'] } },
        { type: 'info', title: 'Four beats in a bar',
          body: ['The **4/4** means each bar has **four beats**. A **quarter note** lasts one beat.',
            'Count out loud: **1, 2, 3, 4**. Press play and count along.'],
          figure: { spec: { snare: Q }, play: 76 } },
        { type: 'count', spec: { snare: Q }, target: ['snare', 8] },
        { type: 'count', spec: { snare: Q }, target: ['snare', 4] },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Tap the beat', spec: { snare: Q }, bpm: 70 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'On your own', spec: { snare: Q }, bpm: 80 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 84, pool: [{ snare: Q }] },
    ],
  },
  {
    id: 'l2', title: 'Quarter rests', element: 'Counting through silence',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the quarter rest', pages: [
        { type: 'info', title: 'A beat you don’t play',
          body: ['A **quarter rest** is one beat of silence. It looks like a squiggle.',
            '**Keep counting** through it. The beat never stops.'],
          figure: { spec: { snare: [0, 4, 12] }, play: 72 } },
        { type: 'count', spec: { snare: [0, 4, 12] }, target: ['snare', 12] },
        { type: 'pick', answer: { snare: [0, 8, 12] }, others: [{ snare: [0, 4, 12] }, { snare: [0, 4, 8] }], bpm: 72 },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Rest on beat 3', spec: { snare: [0, 4, 12] }, bpm: 70 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Rests on 2 and 4', spec: { snare: [0, 8] }, bpm: 76 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 80,
        pool: [{ snare: [0, 8, 12] }, { snare: [0, 4, 8] }, { snare: [4, 8, 12] }, { snare: [0, 12] }] },
    ],
  },
  {
    id: 'l3', title: '8th notes', element: 'Counting 1 & 2 &',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the 8th note', pages: [
        { type: 'info', title: 'Two per beat',
          body: ['**8th notes** split each beat in half. Pairs are joined by a **beam**.',
            'Count **1 & 2 & 3 & 4 &**. The “&” falls halfway between beats.'],
          figure: { spec: { snare: E }, play: 72 } },
        { type: 'count', spec: { snare: E }, target: ['snare', 6] },
        { type: 'count', spec: { snare: E }, target: ['snare', 14] },
        { type: 'info', title: 'Mixing quarters and 8ths',
          body: ['A note alone on a beat is a quarter. A beamed pair is two 8ths.'],
          figure: { spec: { snare: [0, 4, 6, 8, 12, 14] }, play: 72 } },
        { type: 'count', spec: { snare: [0, 4, 6, 8, 12, 14] }, target: ['snare', 14] },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Tap the 8ths', spec: { snare: E }, bpm: 66 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Quarters and 8ths', spec: { snare: [0, 4, 6, 8, 12, 14] }, bpm: 70 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 72,
        pool: [{ snare: [0, 2, 4, 8, 10, 12] }, { snare: [0, 4, 6, 8, 10, 12] }, { snare: [0, 2, 4, 6, 8, 12] }, { snare: [0, 4, 8, 10, 12, 14] }] },
    ],
  },
  {
    id: 'l4', title: '8th rests', element: 'Playing on the “&”',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the 8th rest', pages: [
        { type: 'info', title: 'Half a beat of silence',
          body: ['An **8th rest** looks like a small **7**. It fills the first half of a beat, so the note after it lands on the **“&”**.'],
          figure: { spec: { snare: [0, 6, 8, 14] }, play: 70 } },
        { type: 'count', spec: { snare: [0, 6, 8, 14] }, target: ['snare', 6] },
        { type: 'pick', answer: { snare: [0, 6, 8, 14] }, others: [{ snare: [0, 4, 8, 14] }, { snare: [0, 6, 10, 14] }], bpm: 70 },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Tap the “&”', spec: { snare: [0, 6, 8, 14] }, bpm: 64 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Off-beats only', spec: { snare: [2, 6, 10, 14] }, bpm: 70 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 72,
        pool: [{ snare: [0, 6, 10, 12] }, { snare: [2, 4, 8, 14] }, { snare: [0, 2, 6, 8, 14] }, { snare: [0, 4, 6, 10, 12] }] },
    ],
  },
  {
    id: 'lq', title: 'Longer notes', element: 'Half notes and dotted quarters',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the long notes', pages: [
        { type: 'info', title: 'The half note',
          body: ['A **half note** is hollow and lasts **two beats**. Count **1, 2** before the next note.',
            'A drum doesn’t really ring that long. The length tells you **how long until the next note**.'],
          figure: { spec: { snare: [0, 8], long: true }, play: 72 } },
        { type: 'count', spec: { snare: [0, 8, 12], long: true }, target: ['snare', 8] },
        { type: 'info', title: 'The dotted quarter',
          body: ['A dot adds half again. A **dotted quarter** lasts **one and a half beats**.',
            'It’s usually followed by an 8th on the **“&” of 2**. Count **1 & 2 & 3, 4** and play on **1**, the **“&” of 2**, **3** and **4**.'],
          figure: { spec: { snare: [0, 6, 8, 12], long: true }, play: 72 } },
        { type: 'count', spec: { snare: [0, 6, 8, 12], long: true }, target: ['snare', 6] },
        { type: 'pick', answer: { snare: [0, 6, 8, 12], long: true },
          others: [{ snare: [0, 4, 8, 12], long: true }, { snare: [0, 8, 12], long: true }], bpm: 72 },
        { type: 'info', title: 'The tie',
          body: ['A curved line joining two notes is a **tie**. Play the first note and **don’t play the second**: just let its time pass.',
            'On drums it works like a rest. You’ll meet it in charts written for a whole band.'],
          figure: { spec: { snare: [0, 4, 8, 12], tie: { snare: [8] } }, play: 72 } },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Long, short', spec: { snare: [0, 6, 8, 12], long: true }, bpm: 66 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Twice in a bar', spec: { snare: [0, 6, 8, 14], long: true }, bpm: 70 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 72,
        pool: [
          { snare: [0, 6, 12], long: true },
          { snare: [0, 8, 14], long: true },
          { snare: [0, 4, 10], long: true },
          { snare: [0, 6, 8], long: true },
        ] },
    ],
  },
  {
    id: 'l5', title: 'Your first groove', element: 'Hi-hat, snare and kick together',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the groove', pages: [
        { type: 'info', title: 'x means cymbal',
          body: ['Cymbals get an **x notehead**. The **hi-hat** sits just above the staff. The **kick** sits in the bottom space.'],
          figure: { notes: ['hihat', 'snare', 'kick'] } },
        { type: 'name', id: 'hihat', choices: ['hihat', 'snare', 'kick'] },
        { type: 'name', id: 'kick', choices: ['hihat', 'snare', 'kick'] },
        { type: 'info', title: 'Hands up, feet down',
          body: ['Hand notes have stems **up**; the kick’s stem points **down**. Read a groove **one beat at a time**, top to bottom.',
            'Snare on **2 and 4**, kick on **1 and 3**.'],
          figure: { spec: ROCK, play: 84 } },
        { type: 'count', spec: ROCK, target: ['kick', 8] },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Kick and snare', spec: ROCK, judge: ['snare', 'kick'], bpm: 72 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Add an “&” kick', spec: groove([0, 8, 10]), judge: ['snare', 'kick'], bpm: 76 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 80, judge: ['snare', 'kick'],
        pool: [groove([0, 6, 8]), groove([0, 8, 14]), groove([0, 2, 8]), groove([0, 8, 10])] },
    ],
  },
  {
    id: 'l6', title: '16th notes', element: 'Counting 1 e & a',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the 16th note', pages: [
        { type: 'info', title: 'Four per beat',
          body: ['**16th notes** split each beat into four and have **two beams**.',
            'Count **1 e & a, 2 e & a…** (“one-ee-and-uh”).'],
          figure: { spec: { snare: X }, play: 60 } },
        { type: 'count', spec: { snare: X }, target: ['snare', 5] },
        { type: 'count', spec: { snare: X }, target: ['snare', 11] },
        { type: 'info', title: 'Which hand?',
          body: ['Letters under the notes are the **sticking**: **R** for your right hand, **L** for your left.',
            'This pattern is a **paradiddle**: R L R R, L R L L. The app can’t see which hand you use, so that part is up to you.'],
          figure: { spec: { snare: [...Array(16).keys()], accent: { snare: Q }, sticking: { R: [0, 2, 3, 5, 8, 10, 11, 13], L: [1, 4, 6, 7, 9, 12, 14, 15] } }, play: 56 } },
        { type: 'info', title: 'Faster still: 32nd notes',
          body: ['A **third beam** makes **32nd notes**: eight to a beat, twice as fast as 16ths.',
            'Split a triplet the same way and you get a **sextuplet**: six to a beat, marked with a **6**.'],
          figure: { spec: { snare: [0, 4, 8, 9, 10, 11, 12], fine: [2], x: { snare: [8, 9, 10, 11] } }, play: 56 } },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'One beat of 16ths', spec: { snare: [0, 1, 2, 3, 4, 8, 12] }, bpm: 60 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: '16ths on 1 and 3', spec: { snare: [0, 1, 2, 3, 4, 8, 9, 10, 11, 12] }, bpm: 60 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 64,
        pool: [{ snare: [0, 4, 5, 6, 7, 8, 12] }, { snare: [0, 2, 4, 6, 8, 9, 10, 11, 12] }, { snare: [0, 1, 2, 3, 4, 6, 8, 12, 13, 14, 15] }] },
    ],
  },
  {
    id: 'l7', title: '8th + 16th', element: 'Gallops: “1 & a” and “1 e &”',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the gallop', pages: [
        { type: 'info', title: 'One 8th, two 16ths',
          body: ['An 8th and two 16ths often share a beam. This one is counted **1 & a**.'],
          figure: { spec: { snare: [0, 2, 3, 4, 6, 7, 8, 12] }, play: 64 } },
        { type: 'count', spec: { snare: [0, 2, 3, 4, 6, 7, 8, 12] }, target: ['snare', 7] },
        { type: 'info', title: 'Flip it around',
          body: ['Two 16ths then an 8th is counted **1 e &**. The second beam stops early.'],
          figure: { spec: { snare: [0, 1, 2, 4, 5, 6, 8, 12] }, play: 64 } },
        { type: 'count', spec: { snare: [0, 1, 2, 4, 5, 6, 8, 12] }, target: ['snare', 5] },
        { type: 'pick', answer: { snare: [0, 2, 3, 4, 8, 12] }, others: [{ snare: [0, 1, 2, 4, 8, 12] }, { snare: [0, 1, 2, 3, 4, 8, 12] }], bpm: 64 },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Tap “1 & a”', spec: { snare: [0, 2, 3, 4, 6, 7, 8, 12] }, bpm: 60 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Tap “1 e &”', spec: { snare: [0, 1, 2, 4, 5, 6, 8, 12] }, bpm: 60 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 64,
        pool: [{ snare: [0, 2, 3, 4, 5, 6, 8, 12] }, { snare: [0, 1, 2, 4, 8, 10, 11, 12] }, { snare: [0, 4, 6, 7, 8, 9, 10, 12] }] },
    ],
  },
  {
    id: 'l8', title: 'Dotted notes', element: 'Dotted 8ths and dotted rests',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the dot', pages: [
        { type: 'info', title: 'A dot adds half',
          body: ['Just like the dotted quarter, a **dotted 8th** is half as long again: it lasts **three 16ths**.',
            'Paired with a 16th, it’s counted **1 … a**: long, then short.'],
          figure: { spec: { snare: [0, 3, 4, 7, 8, 12] }, play: 64 } },
        { type: 'count', spec: { snare: [0, 3, 4, 7, 8, 12] }, target: ['snare', 7] },
        { type: 'info', title: 'Dotted rests',
          body: ['Rests can be dotted too. A **dotted 8th rest** is three 16ths of silence, so the note after it lands on the **“a”**, just before the next beat.'],
          figure: { spec: { snare: [0, 7, 8, 15] }, play: 64 } },
        { type: 'count', spec: { snare: [0, 7, 8, 15] }, target: ['snare', 15] },
        { type: 'pick', answer: { snare: [0, 3, 4, 8, 11, 12] }, others: [{ snare: [0, 2, 4, 8, 10, 12] }, { snare: [0, 3, 4, 8, 12] }], bpm: 64 },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Long-short', spec: { snare: [0, 3, 4, 7, 8, 11, 12] }, bpm: 60 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Wait for the “a”', spec: { snare: [0, 7, 8, 15] }, bpm: 60 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 64,
        pool: [{ snare: [0, 3, 4, 8, 11, 12] }, { snare: [0, 4, 7, 8, 11, 12] }, { snare: [3, 4, 8, 12, 15] }, { snare: [0, 3, 4, 7, 8, 12] }] },
    ],
  },
  {
    id: 'lt', title: 'Triplets', element: 'Counting 1 trip let',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the triplet', pages: [
        { type: 'info', title: 'Three in a beat',
          body: ['A **triplet** fits **three** even notes into one beat. The little **3** marks them.',
            'Count **1 trip let, 2 trip let…**'],
          figure: { spec: { trip: ALL, snare: T }, play: 60 } },
        { type: 'count', spec: { trip: ALL, snare: T }, target: ['snare', 5] },
        { type: 'count', spec: { trip: ALL, snare: T }, target: ['snare', 14] },
        { type: 'info', title: 'Two, then three',
          body: ['The real skill is switching between **two** and **three** per beat.',
            'Keep the beat steady. Only the way you split it changes.'],
          figure: { spec: TWO_THREE, play: 60 } },
        { type: 'count', spec: TWO_THREE, target: ['snare', 6] },
        { type: 'pick', answer: TWO_THREE, others: [{ snare: E }, { trip: ALL, snare: T }], bpm: 60 },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Triplets on 2 and 4', spec: { trip: [1, 3], snare: [0, 4, 5, 6, 8, 12, 13, 14] }, bpm: 60 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Two, then three', spec: TWO_THREE, bpm: 60 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 64,
        pool: [
          { trip: ALL, snare: T },
          { trip: [0, 2], snare: [0, 1, 2, 4, 6, 8, 9, 10, 12, 14] },
          { trip: [1, 2, 3], snare: [0, 4, 5, 6, 8, 9, 10, 12] },
          { trip: [1, 3], snare: [0, 2, 4, 6, 8, 12, 14] },
        ] },
    ],
  },
  {
    id: 'ls', title: 'The shuffle', element: 'Triplets with the middle left out',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the shuffle', pages: [
        { type: 'info', title: 'Leave out the middle',
          body: ['Play only the **first** and **last** note of each triplet: **1 – let, 2 – let**. That long-short bounce is a **shuffle**.',
            'It’s written as a **quarter and an 8th** under a 3.'],
          figure: { spec: { trip: ALL, snare: SH }, play: 72 } },
        { type: 'count', spec: { trip: ALL, snare: SH }, target: ['snare', 10] },
        { type: 'info', title: 'The shuffle groove',
          body: ['Put the shuffle on the **hi-hat**, with the snare on **2 and 4** and the kick on **1 and 3**. Blues and rock both use it.'],
          figure: { spec: SHUFFLE, play: 84 } },
        { type: 'pick', answer: SHUFFLE,
          others: [ROCK, { trip: ALL, hihat: T, snare: [4, 12], kick: [0, 8] }], bpm: 84 },
        { type: 'count', spec: { ...SHUFFLE, kick: [0, 6, 8] }, target: ['kick', 6] },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Shuffle on the snare', spec: { trip: ALL, snare: SH }, bpm: 72 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Shuffle the hi-hat', spec: SHUFFLE, judge: ['hihat'], bpm: 76 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 80, judge: ['snare', 'kick'],
        pool: [
          { ...SHUFFLE, kick: [0, 8, 10] },
          { ...SHUFFLE, kick: [0, 2, 8] },
          { ...SHUFFLE, kick: [0, 6, 8, 14] },
          { ...SHUFFLE, kick: [0, 8, 10, 14] },
        ] },
    ],
  },
  {
    id: 'l9', title: 'Toms and fills', element: 'Moving around the kit',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the toms', pages: [
        { type: 'info', title: 'Toms step down the staff',
          body: ['From high to low: **high tom** in the top space, **mid tom** on the line below, the **snare**, then the **floor tom**.'],
          figure: { notes: ['tom1', 'tom2', 'snare', 'floor'] } },
        { type: 'name', id: 'tom1', choices: ['tom1', 'tom2', 'snare', 'floor'] },
        { type: 'name', id: 'floor', choices: ['tom1', 'tom2', 'snare', 'floor'] },
        { type: 'name', id: 'tom2', choices: ['tom1', 'tom2', 'snare', 'floor'] },
        { type: 'info', title: 'A fill moves around the kit',
          body: ['A **fill** breaks the groove to lead into the next bar. Follow the notes **down the staff**.'],
          figure: { spec: { snare: [0, 2], tom1: [4, 6], tom2: [8, 10], floor: [12, 14], kick: Q }, play: 72 } },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Down the toms', spec: { snare: [0, 2], tom1: [4, 6], tom2: [8, 10], floor: [12, 14] }, bpm: 64 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: '16th fill', spec: { snare: [0, 1, 2, 3], tom1: [4, 5, 6, 7], tom2: [8, 9, 10, 11], floor: [12, 13, 14, 15] }, bpm: 56 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 64,
        pool: [
          { snare: [0, 2, 4], tom1: [6, 8], tom2: [10], floor: [12, 14] },
          { snare: [0, 1, 2, 3], tom2: [4, 6], floor: [8, 10, 12] },
          { tom1: [0, 2], tom2: [4, 6], floor: [8, 10], snare: [12, 13, 14, 15] },
          { snare: [0, 2, 4, 6], tom1: [8, 10], trip: [3], tom2: [12, 13], floor: [14] },
        ] },
    ],
  },
  {
    id: 'lch', title: 'Reading a chart', element: 'Bar lines, fills and repeats',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the chart', pages: [
        { type: 'info', title: 'One bar after another',
          body: ['Music is written in **bars**, split by **bar lines**. When a bar ends the next one starts straight away, so the count runs **1 2 3 4, 1 2 3 4**.',
            'Read **ahead**: while you play one beat, your eyes should already be on the next.'],
          figure: { chart: CHART_2, play: 80 } },
        { type: 'info', title: 'Spot what changes',
          body: ['Most bars repeat the groove, so look for the bar that is **different**. Here the last bar ends in a **fill**: the hands leave the hi-hat for the snare.',
            'Drummers think in **four-bar phrases**: three bars of groove, then a fill.'],
          figure: { chart: CHART_4, play: 80 } },
        { type: 'info', title: 'Repeats and endings',
          body: ['Two dots before a thick bar line mean **go back to the start and play it again**.',
            'The bar under the bracket marked **1.** is played the first time only. On the repeat you **skip it** and jump to the bracket marked **2.**'],
          figure: { chart: CHART_REPEAT, play: 80 } },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Two bars', spec: CHART_2, judge: ['snare', 'kick'], bpm: 76 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Four bars with a fill', spec: CHART_4, judge: ['snare', 'kick'], bpm: 80 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 80, judge: ['snare', 'kick'],
        pool: [
          { bars: [ROCK_AND, ROCK, ROCK_AND, FILL_GALLOP] },
          { bars: [groove([0, 6, 8]), ROCK, groove([0, 6, 8]), FILL_16] },
          CHART_REPEAT,
        ] },
    ],
  },
  {
    id: 'l10', title: 'Ride and crash', element: 'Cymbals and syncopated kicks',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the ride and crash', pages: [
        { type: 'info', title: 'Three cymbals',
          body: ['The **ride** sits on the top line, the **hi-hat** above it, and the **crash** highest of all on a **ledger line**.'],
          figure: { notes: ['crash', 'hihat', 'ride'] } },
        { type: 'name', id: 'ride', choices: ['crash', 'hihat', 'ride'] },
        { type: 'name', id: 'crash', choices: ['crash', 'hihat', 'ride'] },
        { type: 'info', title: 'Crash on 1',
          body: ['A **crash** usually marks beat 1 of a new section, played together with the kick.'],
          figure: { spec: { crash: [0], ride: [2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 6, 8] }, play: 84 } },
        { type: 'count', spec: { crash: [0], ride: [2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 6, 8] }, target: ['kick', 6] },
        { type: 'info', title: 'Hi-hat with your foot',
          body: ['An **x below the staff**, stem down, is the hi-hat played with your **foot**: press the pedal to close it with a soft “chick”.',
            'With your hand on the ride, the foot often keeps time on **2 and 4**, together with the snare.'],
          figure: { spec: { ride: E, snare: [4, 12], kick: [0, 8], hhfoot: [4, 12] }, play: 84 } },
        { type: 'name', id: 'hhfoot', choices: ['kick', 'hhfoot', 'floor'] },
        { type: 'info', title: 'The bell of the ride',
          body: ['A **diamond** where the ride goes means play the **bell**: the raised dome in the middle of the cymbal. It rings with a clear “ping”.'],
          figure: { spec: { ride: E, bell: { ride: Q }, snare: [4, 12], kick: [0, 8] }, play: 84 } },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Ride groove', spec: { crash: [0], ride: [2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 6, 8] }, judge: ['snare', 'kick'], bpm: 72 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Push the kick', spec: { ride: E, snare: [4, 12], kick: [0, 3, 8, 11] }, judge: ['snare', 'kick'], bpm: 70 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 76, judge: ['snare', 'kick'],
        pool: [
          { ride: E, snare: [4, 12], kick: [0, 7, 8, 14] },
          { crash: [0], ride: [2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 3, 10] },
          { ride: E, snare: [4, 12], kick: [0, 6, 7, 11] },
        ] },
    ],
  },
  {
    id: 'l34', title: 'Three-four time', element: 'Three beats in a bar',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet 3/4', pages: [
        { type: 'info', title: 'Count to three',
          body: ['In **3/4** each bar has **three beats**, still a quarter note each. Count **1, 2, 3, 1, 2, 3**.',
            'Beat 1 is the strong one. That’s what makes it feel like a waltz.'],
          figure: { spec: { meter: '3/4', snare: [0, 4, 8] }, play: 84 } },
        { type: 'info', title: 'The waltz',
          body: ['A **waltz** goes **boom, chick, chick**: kick on **1**, snare on **2 and 3**.'],
          figure: { spec: WALTZ, play: 96 } },
        { type: 'count', spec: { meter: '3/4', snare: [0, 4, 6, 8] }, target: ['snare', 6] },
        { type: 'pick', answer: WALTZ, others: [{ meter: '3/4', hihat: [0, 2, 4, 6, 8, 10], snare: [8], kick: [0, 4] }, ROCK], bpm: 96 },
        { type: 'info', title: 'Two and five',
          body: ['The top number can be other things too. **2/4** has **two** beats in a bar, like a march.',
            '**5/4** has **five**. It often feels like three plus two: count **1 2 3, 4 5**.'],
          figure: { spec: { meter: '5/4', hihat: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], snare: [4, 16], kick: [0, 6, 12] }, play: 100 } },
        { type: 'info', title: 'Seven-eight',
          body: ['In **7/8** the bottom number is 8, so you count **8th notes**: seven in a bar.',
            'They usually group as **2 + 2 + 3**. Count **1 2, 3 4, 5 6 7** and feel three uneven beats: short, short, long.'],
          figure: { spec: { meter: '7/8', hihat: [0, 2, 4, 6, 8, 9, 10], snare: [4], kick: [0, 8] }, play: 100 } },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Waltz', spec: WALTZ, judge: ['snare', 'kick'], bpm: 84 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: '8ths in three', spec: { meter: '3/4', snare: [0, 4, 6, 8] }, bpm: 80 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 84,
        pool: [
          { meter: '3/4', snare: [0, 2, 4, 8] },
          { meter: '3/4', snare: [0, 6, 8, 10] },
          { meter: '3/4', snare: [0, 4, 8, 10] },
          { meter: '3/4', snare: [0, 2, 4, 6] },
        ] },
    ],
  },
  {
    id: 'lac', title: 'Accents', element: 'Making some notes louder',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the accent', pages: [
        { type: 'info', title: 'The > mark',
          body: ['An **accent** (**>**) means play that note **louder**. The others stay at a normal level.',
            'Accents give a plain rhythm its shape. Listen for the loud ones.'],
          figure: { spec: { snare: E, accent: { snare: [0, 6, 12] } }, play: 72 } },
        { type: 'count', spec: { snare: E, accent: { snare: [0, 6, 12] } }, target: ['snare', 6] },
        { type: 'info', title: 'Accents on the hi-hat',
          body: ['Accenting the hi-hat on the **beat** makes a groove drive forward.',
            'On a real kit, hit the accented notes harder. Here the app scores your **timing**, so focus on placing every note.'],
          figure: { spec: ACC_ROCK, play: 84 } },
        { type: 'pick', answer: { snare: E, accent: { snare: [0, 6, 12] } },
          others: [{ snare: E, accent: { snare: [0, 4, 8, 12] } }, { snare: E, accent: { snare: [2, 6, 10, 14] } }], bpm: 72 },
        { type: 'info', title: 'The rimshot',
          body: ['A **slash through a snare note** is a **rimshot**: hit the head and the rim at the same moment.',
            'It’s the loudest, sharpest sound the snare makes.'],
          figure: { spec: { hihat: E, snare: [4], rim: { snare: [12] }, kick: [0, 8] }, play: 84 } },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Accented 8ths', spec: { snare: E, accent: { snare: [0, 6, 12] } }, bpm: 70 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Accents in a groove', spec: ACC_ROCK, judge: ['hihat', 'kick'], bpm: 76 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 72,
        pool: [
          { snare: E, accent: { snare: [2, 6, 10, 14] } },
          { snare: [0, 2, 3, 4, 6, 7, 8, 12], accent: { snare: [0, 4, 8] } },
          { snare: X, accent: { snare: [0, 3, 6, 8, 11, 14] } },
        ] },
    ],
  },
  {
    id: 'lgh', title: 'Ghost notes', element: 'Quiet notes between the backbeats',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the ghost note', pages: [
        { type: 'info', title: 'Notes in brackets',
          body: ['A **ghost note** is written in **brackets**. Play it **very softly**, barely a tap.',
            'Ghost notes on the snare fill the gaps around the backbeat. Funk drummers use them all the time.'],
          figure: { spec: GHOST, play: 76 } },
        { type: 'count', spec: GHOST, target: ['snare', 7] },
        { type: 'info', title: 'Loud and soft together',
          body: ['The backbeat on **2 and 4** stays loud. The ghost notes sit just before or after it.'],
          figure: { spec: GHOST2, play: 76 } },
        { type: 'pick', answer: GHOST2, others: [GHOST, { ...GHOST2, ghost: { snare: [9, 15] } }], bpm: 76 },
        { type: 'info', title: 'The cross-stick',
          body: ['An **x where the snare goes** is a **cross-stick**: lay the stick across the drum and tap the rim with it.',
            'It makes a soft, woody click. You’ll hear it in ballads and bossa nova.'],
          figure: { spec: { hihat: E, cross: { snare: [4, 12] }, kick: [0, 6, 8] }, play: 76 } },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Ghosts on the “a”', spec: GHOST, judge: ['snare'], bpm: 70 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Funk snare', spec: GHOST2, judge: ['snare', 'kick'], bpm: 72 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 72, judge: ['snare'],
        pool: [
          { hihat: E, snare: [4, 12], ghost: { snare: [6, 15] }, kick: [0, 8] },
          { hihat: E, snare: [4, 12], ghost: { snare: [3, 9, 11] }, kick: [0, 8] },
          { hihat: E, snare: [4, 12], ghost: { snare: [7, 10, 15] }, kick: [0, 8] },
        ] },
    ],
  },
  {
    id: 'loh', title: 'Open hi-hat', element: 'The little circle, and closing it',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the open hi-hat', pages: [
        { type: 'info', title: 'o means open',
          body: ['A small **o** above a hi-hat note means **open**: lift your foot so the cymbals ring.',
            'The next hi-hat note **closes** it again, cutting the sound off.'],
          figure: { spec: OPEN, play: 84 } },
        { type: 'count', spec: OPEN, target: ['hihat', 14] },
        { type: 'info', title: 'Disco hats',
          body: ['Open the hi-hat on every **“&”** and you get the classic **disco** sound, with the kick on every beat.'],
          figure: { spec: DISCO, play: 100 } },
        { type: 'pick', answer: DISCO, others: [{ ...DISCO, open: { hihat: [6, 14] } }, { hihat: E, snare: [4, 12], kick: Q }], bpm: 100 },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Open on 4 &', spec: OPEN, judge: ['hihat'], bpm: 76 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Disco hats', spec: DISCO, judge: ['hihat', 'kick'], bpm: 90 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 84, judge: ['hihat', 'kick'],
        pool: [
          { hihat: E, open: { hihat: [6, 14] }, snare: [4, 12], kick: [0, 8] },
          { hihat: E, open: { hihat: [2] }, snare: [4, 12], kick: [0, 8, 10] },
          { hihat: E, open: { hihat: [10] }, snare: [4, 12], kick: [0, 6, 8] },
        ] },
    ],
  },
  {
    id: 'lfl', title: 'Flams', element: 'Two sticks, almost together',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet the flam', pages: [
        { type: 'info', title: 'A tiny note in front',
          body: ['A **flam** has a tiny **grace note** just before the main note. Play it **softly** with one stick, then the main note loud with the other, almost together.',
            'It sounds like one fat note: **“flam”**. Count and tap the **main** note. On an electronic kit, play both strokes.'],
          figure: { spec: { snare: [4, 12], flam: { snare: [0, 8] } }, play: 72 } },
        { type: 'count', spec: { snare: [0, 4, 6, 12], flam: { snare: [8] } }, target: ['snare', 8] },
        { type: 'info', title: 'A flam on the backbeat',
          body: ['A flam on beat **4** makes the backbeat bigger.'],
          figure: { spec: FLAM_ROCK, play: 84 } },
        { type: 'pick', answer: FLAM_ROCK, others: [ROCK, { hihat: E, flam: { snare: [4] }, snare: [12], kick: [0, 8] }], bpm: 84 },
        { type: 'info', title: 'Drags and rolls',
          body: ['A **drag** has **two** tiny notes in front instead of one: a quick “brr” into the main note.',
            'Short lines across a stem mean a **roll**: let the stick bounce for the whole length of the note.'],
          figure: { spec: { snare: [0, 8], drag: { snare: [4] }, roll: { snare: [12] } }, play: 72 } },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Flams on 1 and 3', spec: { snare: [4, 12], flam: { snare: [0, 8] } }, bpm: 70 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Flam backbeat', spec: FLAM_ROCK, judge: ['snare', 'kick'], bpm: 80 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Level test', bpm: 76, judge: ['snare'],
        pool: [
          { snare: [0, 2, 4, 8, 10], flam: { snare: [12] } },
          { snare: [0, 4, 6, 12], flam: { snare: [8, 14] } },
          { snare: [2, 4, 8], flam: { snare: [0, 12] } },
        ] },
    ],
  },
  {
    id: 'l68', title: '6/8 and 12/8', element: 'Beats split in three',
    challenges: [
      { id: 'intro', kind: 'intro', title: 'Meet 6/8', pages: [
        { type: 'info', title: 'Six 8ths, two beats',
          body: ['**6/8** has **six 8th notes** in a bar, beamed in **groups of three**. You feel **two** big beats.',
            'Count **1 & a 2 & a**. (Some people count 1 2 3 4 5 6.) The clicks fall on the two big beats.'],
          figure: { spec: { meter: '6/8', snare: [0, 1, 2, 4, 5, 6] }, play: 60 } },
        { type: 'count', spec: { meter: '6/8', snare: [0, 1, 2, 4, 5, 6] }, target: ['snare', 5] },
        { type: 'info', title: 'The dotted quarter',
          body: ['A whole beat of 6/8 is a **dotted quarter**. A quarter plus an 8th fills a beat too: **long, short**.'],
          figure: { spec: { meter: '6/8', snare: [0, 4, 6] }, play: 60 } },
        { type: 'count', spec: { meter: '6/8', snare: [0, 4, 6] }, target: ['snare', 6] },
        { type: 'info', title: '12/8: four beats of three',
          body: ['**12/8** is four beats, each split in three. It sounds like **triplets** in 4/4, without the 3s. Blues ballads live here.'],
          figure: { spec: BLUES, play: 60 } },
        { type: 'pick', answer: SIXEIGHT, others: [{ meter: '6/8', hihat: [0, 1, 2, 4, 5, 6], snare: [0, 4] }, { meter: '3/4', hihat: [0, 2, 4, 6, 8, 10], snare: [4, 8], kick: [0] }], bpm: 60 },
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Six 8ths', spec: { meter: '6/8', snare: [0, 1, 2, 4, 5, 6] }, bpm: 56 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'A 6/8 groove', spec: SIXEIGHT, judge: ['snare', 'kick'], bpm: 60 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Final test', bpm: 60,
        pool: [
          { meter: '6/8', snare: [0, 2, 4, 5, 6] },
          { meter: '6/8', snare: [0, 4, 6] },
          { meter: '12/8', snare: [0, 2, 4, 8, 9, 10, 12] },
          { meter: '12/8', snare: [0, 4, 5, 6, 8, 12, 14] },
        ] },
    ],
  },
];

