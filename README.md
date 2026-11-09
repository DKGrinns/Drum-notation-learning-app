# Drum Reader

A mobile-first web app for learning to read drum notation. No dependencies, no build step.

## Run it

```bash
npm start
```

Open http://localhost:5173. To try it on your phone (same Wi-Fi), run `HOST=0.0.0.0 npm start` and open your computer's IP address on port 5173.

## What's in it

| Tab | What it teaches |
| --- | --- |
| **Learn** | A 13-level path: quarter notes, rests, 8ths, half notes and dotted quarters, grooves, 16ths, gallops, dotted 8ths and dotted rests, triplets, the shuffle, toms and fills, ride and crash. Each level has an **intro** (short explanations plus quick checks), a **Learn** drill (tap along while you hear the part), a **Practice** drill (click only), and a **Test** (a new pattern from a pool; score 80% to unlock the next level). Up to 3 stars per challenge. Edit the path in `js/curriculum.js`. |
| **Build** | Tap a step grid and watch it turn into real notation. The grid columns line up with the notes on the staff, with counts (`1 e & a`, `1 trip let`) above. Make any beat a **triplet**, turn on **long notes** to write half notes and dotted quarters, and pick from presets (including a shuffle and a triplet fill). Tempo, metronome, and 8th/16th grids. |
| **Quiz** | *Name the note* (see a note, pick the drum) or *Place the note* (see a drum, tap its spot on the staff). Three levels; notes you miss come up more often. |
| **Listen** | Hear a groove, then pick which of three look-alike staffs matches it. After answering, tap any choice to hear how it differs. Beginner / Intermediate / Advanced. |
| **Play** | Tap along to a groove after a 4-click count-in. Afterwards each note on the staff is colored green, orange, or red, with on-time/early/late/missed counts and a rushing/dragging hint. Pick a *Sight-read* groove to get a fresh random one at your level (**New groove** for another). |

## Code map

```
public/
  index.html          app shell + tab bar
  css/app.css         iOS-style design (light + dark)
  js/curriculum.js    levels, intros, drills (the learning path)
  js/kit.js           drum kit + staff positions (Weinberg/PAS key)
  js/grooves.js       groove model, presets, random grooves + look-alikes
  js/notation.js      SVG notation renderer (two voices, beams, rests, triplets, long notes;
                      notes spaced by length, or on a grid in Build)
  js/audio.js         synthesized drums + look-ahead transport + tap timing
  js/ui.js            segmented control, stepper, switch, sheet, toast
  js/views/*.js       Learn, Build, Quiz, Listen, Play
serve.mjs             zero-dependency dev server
```

Progress and settings are saved in `localStorage`.
