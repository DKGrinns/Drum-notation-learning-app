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
| **Build** | Tap a step grid and watch it turn into real notation. The grid columns line up with the notes on the staff, with counts (`1 e & a`, `1 trip let`) above. Pick a **time signature** (4/4, 3/4, 2/4, 5/4, 7/8, 6/8, 12/8), make any beat a **triplet**, split any beat twice as fine for **32nd notes** or a **sextuplet**, and use the note brush to change notes: **Accent, Ghost, Open, Flam, Cross** (cross-stick, an x on the snare), **Bell** (the ride's bell, a diamond), **Rim** (rimshot, a slashed note), **Drag, Roll** and **Tie** (held, not played). The **Sticking** row writes R or L under a note. Turn on **long notes** to write half notes and dotted quarters. Press **+** to add a bar (up to 16); the bars play in order and appear in Play as "My groove". With three or more bars, **Repeat with two endings** turns the last two bars into the 1st and 2nd endings, and **See the whole chart** shows every bar together. Presets, tempo, metronome, 8th/16th grids. **Save this groove** keeps it under a name in **Saved grooves** (they also appear in Play). **Share or export** makes a link that opens the groove in the app on any device, a MIDI file for drum software, or a picture of the written music. |
| **Quiz** | Three topics. **Drums**: *Name the note* (see a note, pick the drum) or *Place the note* (see a drum, tap its spot on the staff), in three levels; notes you miss come up more often. **Note values**: name the highlighted note or the rest in a bar. **Counting**: pick the count a highlighted note lands on, in three levels. |
| **Listen** | **Pick it**: hear a groove, then pick which of three look-alike staffs matches it; after answering, tap any choice to hear how it differs. **Write it** (dictation): hear a groove and write it on a small grid, then check it against the answer. Beginner / Intermediate / Advanced. |
| **Play** | Tap along to a groove after a one-bar count-in. Afterwards each note on the staff is colored green, orange, or red, with on-time/early/late/missed counts and a rushing/dragging hint. **Sight-read** options deal a fresh random groove each time: Beginner, Intermediate, Advanced, Shuffle, 3/4, 6/8 and 12/8, and Accents and ghosts. Press **Next groove** after a run for another. **4-bar charts** (the three levels plus each style) are a groove, a variation, the groove again and a fill. **Repeat charts** add a repeat sign with first and second endings: five bars written, eight played. **16-bar charts** are four phrases: the groove twice, a contrasting section, then the groove again, each phrase ending in a fill. On a phone a long chart scrolls to follow the music. **Practice tools**: press **Tap** in time to set the tempo; turn on the **Tempo trainer** to go 4 BPM faster each time you score 85% or more (and slower again below 50%); set the **click** and **drum** volumes separately. |

### Tap timing

Phones and Bluetooth headphones play sound late (often 20–250 ms). **Play → Calibrate tap timing** has you tap along with 16 clicks and stores the average offset. All scoring (Learn and Play) subtracts it. You can fine-tune it with the Tap offset stepper. Drills show a "Set up tap timing" link until you've calibrated.

With screen taps, accents, ghost notes and flams are scored for **timing only**: a screen can't measure how hard you hit. An electronic kit can (see below).

### Electronic drum kits

**Settings → Electronic drum kit** (the gear at the top right of every tab) connects a kit over USB MIDI. It works in Chrome and Edge on Android, Windows, Mac and Chromebooks; iPhone and iPad browsers have no MIDI support.

- The General MIDI drum layout and Roland's are built in, written out in full for the **TD-17KVX with the VH-10 hi-hat**: head and rim on the snare and toms, cross-stick, bow and edge on both crashes, bow, edge and bell on the ride, and open and closed bow and edge on the hi-hat. See the table at the top of `js/midi.js`.
- The setup screen shows what each hit was heard as. **Learn** next to a drum re-teaches it: hit every part of that pad, then press Done.
- Kit hits have their own timing correction (**Calibrate with the kit**), separate from screen taps.
- The app plays its own drum sound for each kit hit by default, so you hear your playing through the same speaker or headphones as the click. Turn **App drum sounds** off if you listen through the kit's module instead.
- Every drum written in the music is scored, including the **hi-hat pedal** (an x below the staff). Drums that an exercise doesn't use are ignored.
- After a run, **From your kit** shows how many accents, ghost notes and open (and closed) hi-hats came out right. Loud and soft are judged against your own normal notes on the same drum: an accent is at least 15% harder, a ghost note at most 60% as hard. This is shown beside the timing score, not folded into it.
- The Roland note numbers were checked against a published TD-17 note list (all 24 zones match), but not yet on a real kit.

### Microphone

**Settings → Microphone** lets you play along on a practice pad or an acoustic drum. The app listens for hits (nothing is recorded or sent anywhere). A microphone can tell when you hit but not which drum, so each hit counts for whichever note is due. Wear headphones, or it will hear the app's own click. It has its own sensitivity setting and timing calibration.

### Appearance

**Settings → Look** changes the whole app's style:

- **Classic**: the original iOS-style look, light or dark to match your device.
- **Studio Gray** (the default) and **Studio Dark**: flat mid-grey panels with orange and cyan, modelled on Ableton Live. The greys and accents are the values in Live 11's own Mid Light and Mid Dark theme files (listed beside each colour in `css/themes.css`).
- **Groovebox**: near-black with white lit buttons and pads that glow in their drum's colour, in the spirit of NI Maschine. Maschine's colours aren't published, so these were chosen by eye.

### First run

A four-card tour opens the first time the app loads. Replay it from Settings → Show the quick tour.

### While you practice

The screen stays on while anything is playing. If you switch away from the app, playback stops instead of drifting out of time.

## Tests

```bash
npm test
```

Checks the groove model (presets, random grooves and charts), tap scoring, and the drum kit note map. See `ROADMAP.md` for what's planned next.

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
  js/calibrate.js     tap (and kit) timing calibration sheet
  js/theme.js         the look picker (colours are in css/themes.css)
  js/midi.js          electronic drum kit input: note map, hit-to-learn, connection
  js/mic.js           microphone input (mic-worklet.js finds the hits, micsetup.js is its sheet)
  js/kitsetup.js      kit setup sheet
  js/progress.js      practice history and streaks
  js/diag.js          optional diagnostics recording
  js/library.js       saved grooves, share links, MIDI files
  js/export.js        downloads, sharing, pictures
  js/tour.js          first-run tour
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

## Diagnostics

For troubleshooting on a real device. In **Electronic drum kit** (Settings), switch on **Record diagnostics**, play as normal, then press **Save diagnostics file**.

The file holds every message the kit sent, each scored run in full (what was written, every hit and how it was judged), any errors, and details of the device and audio delay. It records data only, never sound, keeps the most recent 30 runs and 3000 events, and stays on the device unless you save and send it.

To read one:

```bash
node scripts/replay.mjs path/to/drum-reader-diagnostics-….json
```

This re-scores each run and prints, per drum, how early or late the hits were and how hard each kind of note was played, plus any kit notes the built-in map doesn't know.
