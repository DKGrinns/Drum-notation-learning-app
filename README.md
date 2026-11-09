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
| **Build** | Tap a step grid and watch it turn into real notation. The grid columns line up with the notes on the staff, with counts (`1 e & a`) above. Includes presets, tempo, metronome, and 8th/16th grids. |
| **Quiz** | *Name the note* (see a note, pick the drum) or *Place the note* (see a drum, tap its spot on the staff). Three levels; notes you miss come up more often. |
| **Play** | Tap along to a groove after a 4-click count-in. Afterwards each note on the staff is colored green, orange, or red, with on-time/early/late/missed counts and a rushing/dragging hint. |

## Code map

```
public/
  index.html          app shell + tab bar
  css/app.css         iOS-style design (light + dark)
  js/kit.js           drum kit + staff positions (Weinberg/PAS key)
  js/grooves.js       groove model + presets
  js/notation.js      SVG notation renderer (two voices, beams, rests)
  js/audio.js         synthesized drums + look-ahead transport + tap timing
  js/ui.js            segmented control, stepper, switch, sheet, toast
  js/views/*.js       Build, Quiz, Play
serve.mjs             zero-dependency dev server
```

Progress and settings are saved in `localStorage`.
