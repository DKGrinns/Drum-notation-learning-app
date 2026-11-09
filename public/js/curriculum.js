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
// Grooves use the preset spec format: { instrumentId: [slots 0–15], trip?: [triplet beats], long?: true }
// (see grooves.js). In a triplet beat, slots beat*4 + 0..2 are "1 trip let".

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
      ] },
      { id: 'learn', kind: 'drill', mode: 'learn', title: 'Ride groove', spec: { crash: [0], ride: [2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 6, 8] }, judge: ['snare', 'kick'], bpm: 72 },
      { id: 'practice', kind: 'drill', mode: 'practice', title: 'Push the kick', spec: { ride: E, snare: [4, 12], kick: [0, 3, 8, 11] }, judge: ['snare', 'kick'], bpm: 70 },
      { id: 'test', kind: 'drill', mode: 'test', title: 'Final test', bpm: 76, judge: ['snare', 'kick'],
        pool: [
          { ride: E, snare: [4, 12], kick: [0, 7, 8, 14] },
          { crash: [0], ride: [2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 3, 10] },
          { ride: E, snare: [4, 12], kick: [0, 6, 7, 11] },
        ] },
    ],
  },
];

