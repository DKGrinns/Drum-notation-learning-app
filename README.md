# Drum Reader

A mobile-first web app for learning to read drum notation. No dependencies, no build step.

## Run it

```bash
npm start
```

Open http://localhost:5173. To try it on your phone (same Wi-Fi), run `HOST=0.0.0.0 npm start` and open your computer's IP address on port 5173.

Once loaded over HTTPS (or on localhost), it works offline and can be added to the home screen. The service worker in `public/sw.js` is network-first, so you always get the newest files when online. If you add a new file, add it to the `FILES` list there.

## What's in it

| Tab | What it teaches |
| --- | --- |
| **Learn** | A 20-level path: quarter notes, rests, 8ths, half notes and dotted quarters, grooves, 16ths, gallops, dotted 8ths and dotted rests, triplets, the shuffle, toms and fills, reading a chart (bar lines, fills, repeats and endings), ride and crash, 3/4 time, accents, ghost notes, open hi-hat, flams, and 6/8 and 12/8. Each level has an **intro** (short explanations plus quick checks), a **Learn** drill (tap along while you hear the part), a **Practice** drill (click only), and a **Test** (a new pattern from a pool; score 80% to unlock the next level). Up to 3 stars per challenge. The path page shows your **practice streak** and a **Review** list: passed levels come back after 1, 2, 4… days (up to 30). **Progress** (top right) shows streaks and recent scores from every tab, and lets you **save a backup file** of your progress or restore one. Edit the path in `js/curriculum.js`. |
| **Build** | Tap a step grid and watch it turn into real notation. The grid columns line up with the notes on the staff, with counts (`1 e & a`, `1 trip let`) above. Pick a **time signature** (4/4, 3/4, 6/8, 12/8), make any beat a **triplet**, and use the **Accent / Ghost / Open / Flam** brush to change notes. Turn on **long notes** to write half notes and dotted quarters. Press **+** to add a bar (up to 8); the bars play in order and appear in Play as "My groove". Presets, tempo, metronome, 8th/16th grids. |
| **Quiz** | Three topics. **Drums**: *Name the note* (see a note, pick the drum) or *Place the note* (see a drum, tap its spot on the staff), in three levels; notes you miss come up more often. **Note values**: name the highlighted note or the rest in a bar. **Counting**: pick the count a highlighted note lands on, in three levels. |
| **Listen** | Hear a groove, then pick which of three look-alike staffs matches it. After answering, tap any choice to hear how it differs. Beginner / Intermediate / Advanced. |
| **Play** | Tap along to a groove after a one-bar count-in. Afterwards each note on the staff is colored green, orange, or red, with on-time/early/late/missed counts and a rushing/dragging hint. **Sight-read** options deal a fresh random groove each time: Beginner, Intermediate, Advanced, Shuffle, 3/4, 6/8 and 12/8, and Accents and ghosts. Press **Next groove** after a run for another. **4-bar charts** (the three levels plus each style) are a groove, a variation, the groove again and a fill. **Repeat charts** add a repeat sign with first and second endings: five bars written, eight played. On a phone a long chart scrolls to follow the music. |

### Tap timing

Phones and Bluetooth headphones play sound late (often 20–250 ms). **Play → Calibrate tap timing** has you tap along with 16 clicks and stores the average offset. All scoring (Learn and Play) subtracts it. You can fine-tune it with the Tap offset stepper. Drills show a "Set up tap timing" link until you've calibrated.

Accents, ghost notes and flams are scored for **timing only**: taps on a screen can't measure how hard you hit.

### While you practice

The screen stays on while anything is playing. If you switch away from the app, playback stops instead of drifting out of time.

## Tests

```bash
npm test
```

Checks the groove model: presets, random grooves and charts. See `ROADMAP.md` for what's planned next.

## Code map

```
public/
  index.html          app shell + tab bar
  sw.js               offline cache (network first)
  css/app.css         iOS-style design (light + dark)
  js/curriculum.js    levels, intros, drills (the learning path)
  js/kit.js           drum kit + staff positions (Weinberg/PAS key)
  js/grooves.js       groove model (meters, note types), presets, random grooves + look-alikes
  js/notation.js      SVG notation renderer (two voices, beams, rests, triplets, compound meters,
                      long notes, accents, ghost notes, open hi-hat, flams; notes spaced by
                      length, or on a grid in Build)
  js/audio.js         synthesized drums (accents, ghosts, open/closed hi-hat, flams)
                      + look-ahead transport
  js/tap.js           tap-along scoring shared by Learn and Play
  js/calibrate.js     tap timing calibration sheet
  js/progress.js      practice history and streaks
  js/backup.js        save and restore a backup file
  js/ui.js            segmented control, stepper, switch, sheets, toast
  js/views/*.js       Learn, Build, Quiz, Listen, Play
serve.mjs             zero-dependency dev server
test/                 automated tests (npm test)
```

### Groove format

One bar per pattern: `{ [drum]: number[beats * 4], meter?, trip?, long? }`. Slot `beat * 4 + j`. Straight beats use j = 0–3 as 16ths; triplet beats, and every beat of 6/8 and 12/8, use j = 0–2. A slot's value is 0 (none), 1 (note), 2 (accent), 3 (ghost), 4 (open hi-hat) or 5 (flam).

A chart is `{ name, bars: pattern[], order?, endings? }`: one-bar patterns in one meter. `order` lists the bar numbers as played (default: each once, in order) and `endings: [first, second]` marks the bars drawn under the "1." and "2." brackets.

Progress and settings are saved in `localStorage`.

## Online

Every push to `master` runs the tests and publishes `public/` to GitHub Pages: https://dkgrinns.github.io/Drum-notation-learning-app/
