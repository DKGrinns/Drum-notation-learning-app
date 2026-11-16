# Roadmap

What's planned, in priority order. Updated 2026-11-15.

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

- **Hi-hat pedal**: written as an x below the staff, played from the kit's pedal, with a lesson page in the ride level.
- **Dictation** in Listen ("Write it").
- **First-run tour**, replayable from Learn → Progress.
- **Practice tools** in Play: tap tempo, a tempo trainer, and separate click and drum volumes.
- **Flams from the kit**: the two strokes of a flam count as one note, timed by the second, and are reported under "From your kit".

## Next

1. **Test on the real kit and a real phone** (see "Not yet checked"), and tune from a diagnostics file.
2. **Longer charts**: 16 bars, repeats and endings written in Build.
3. **iPhone home-screen icon** (a PNG; the current icon is SVG only).
4. **Groove library**: save several grooves in Build, share one as a link, export as an image or MIDI file.
5. **More notation**: cross-stick, rimshot, ride bell, stickings (R/L), ties, 32nd notes, sextuplets, rolls and drags, and 2/4, 5/4 and 7/8.
6. **More tests**: the notation layout.
7. **Microphone input** for practice pads (knows when you hit, not which drum). Lower priority.

## Not yet checked

- Nothing has been tried on a real phone or a real kit. Tap timing, the wake lock, the backup and diagnostics downloads, the chart's auto-scroll, MIDI over USB on Android and Windows, the loud/soft thresholds and whether a flam on the TD-17 arrives as two separate hits all need a real device.
