# Roadmap

What's planned, in priority order. Updated 2026-11-14.

## Done

- **Screen stays on** while anything is playing, and playback stops cleanly if the app goes to the background.
- **Backup and restore** of all progress (Learn → Progress → Backup), plus a request to the browser not to clear saved data.
- **4-bar charts** in Play: a groove, a variation, the groove again, then a fill. Beginner, Intermediate and Advanced.
- **Automated tests** for the groove model (`npm test`).
- **Repeat charts**: a repeat sign with first and second endings, and 4-bar charts in every style.
- **Multi-bar Build**: write up to 8 bars; they play in order and appear in Play.
- **Learn level 13, "Reading a chart"**: bar lines, fills, repeats and endings.
- **Reading quizzes**: note values and rests, and "which count is this note on?".
- **Online**: published to GitHub Pages on every push.
- **Electronic drum kit input (MIDI)**: built-in Roland TD-17KVX / VH-10 and General MIDI layout, hit-to-learn, kit timing calibration.
- **Kit expression**: accents, ghost notes and open/closed hi-hat checked from how the kit was played.
- **Tests** for tap scoring, the kit note map and replaying a recording (18 in total).
- **Diagnostics**: record kit messages and scored runs to a file; `scripts/replay.mjs` reads it.

## Next

1. **Dictation** in Listen: hear a groove, write it in the Build grid.
2. **More from the kit**
   - Check the kit on a real TD-17KVX: every zone, USB on Android and Windows, and whether the loud/soft thresholds feel fair.
   - Add the hi-hat pedal to the notation and score it.
   - Flams from the kit (two hits close together).
   - Microphone input for practice pads (knows when you hit, not which drum). Lower priority now.
   - A short first-run tour, including "connect your kit".
3. **Longer charts**: 16 bars, repeats and endings written in Build.
4. **iPhone home-screen icon** (a PNG; the current icon is SVG only).
5. **Groove library**: save several grooves in Build, share one as a link, export as an image or MIDI file.
6. **More notation**: hi-hat foot, cross-stick, rimshot, ride bell, stickings (R/L), ties, 32nd notes, sextuplets, rolls and drags, and 2/4, 5/4 and 7/8.
7. **Practice tools**: tempo trainer that speeds up as you pass, tap tempo, separate volumes for click and drums.
8. **More tests**: the notation layout.

## Not yet checked

- Nothing has been tried on a real phone. Tap timing, the wake lock, the backup download and the chart's auto-scroll all need a real device.
