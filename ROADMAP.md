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

- **Groove library**: save named grooves in Build, play them in Play, share one as a link, export a MIDI file or a picture.
- **Longer charts**: 16-bar charts in Play; up to 16 bars and a repeat with two endings in Build.
- **More notation**: cross-stick, ride bell, and 2/4 and 5/4 time, each with a lesson page, a preset and a check from the kit.
- **Stickings, rimshots, drags, rolls and ties**: stickings (R/L) under the staff; four more note types.
- **Home-screen icons** as PNG, for iPhone and iPad.
- **Notation-layout tests**: the staff is drawn into a stand-in page and checked (49 tests in total).
- **Microphone input**: play along on a practice pad or an acoustic drum; a hit counts for whichever note is due.
- **7/8 time**: seven 8ths grouped 2 + 2 + 3. Beats can now differ in length.
- **32nd notes and sextuplets**: any beat can be split twice as fine.
- **Looks**: Studio Gray and Studio Dark (after Ableton Live) and Groovebox (after Maschine), chosen in Learn → Progress.

## Next

1. **Test on the real kit and a real phone** (see "Not yet checked"), and tune from a diagnostics file.

Everything else on the original list is built. Ideas that came up along the way, none started:

- 7/8 grouped other ways (3 + 2 + 2, 2 + 3 + 2), and 5/8 and 9/8.
- Random sight-reading grooves that use the newer notation (32nds, 7/8, drags, rolls).
- In Build, a wider staff for a beat of 32nds: on a phone the noteheads touch, because the staff lines up with the grid.
- Telling a microphone hit's drum apart by its sound (low for kick, bright for cymbals).

## Not yet checked

- Nothing has been tried on a real phone or a real kit. Tap timing, the wake lock, the backup and diagnostics downloads, the chart's auto-scroll, MIDI over USB on Android and Windows, the loud/soft thresholds and whether a flam on the TD-17 arrives as two separate hits whether the TD-17 sends note 37 for a cross-stick and 53 for the ride bell as its note list says, all need a real device. The microphone has only been tried with a simulated sound, never a real pad in a real room, and none of the newer sounds (cross-stick, bell, rimshot, drag, roll) has been listened to. So do the phone's share sheet and the MIDI and picture downloads; the MIDI file has not been opened in drum software yet.
