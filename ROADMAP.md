# Roadmap

What's planned, in priority order. Updated 2026-11-16.

## Done

- **Screen stays on** while anything is playing, and playback stops cleanly if the app goes to the background.
- **Backup and restore** of all progress (Settings → Backup), plus a request to the browser not to clear saved data.
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
- **First-run tour**, replayable from Settings.
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
- **Looks**: Studio Gray and Studio Dark (after Ableton Live) and Groovebox (after Maschine), chosen in Settings. Studio Gray is the default.

- **First try on a real kit** (Roland TD-17 over USB, Chrome on Windows, 2026-11-16), read back from two diagnostics files. Every pad zone that was hit reached the right drum, kit calibration settled at +85 ms, and both runs replay to the scores they were given.
- **Settings in one place**: a gear at the top of every tab opens sound, kit, microphone, timing, look, tour and backup. Play keeps only what belongs to a run; Progress only shows progress.
- **Kit hits make a sound** through the app unless switched off, louder for harder hits, for every drum.
- **Stray kit hits are ignored**: hits too soft to be a stroke (adjustable in kit setup; the kick's limit is twice as high) and a pad reporting one stroke twice within 30 ms.
- **Results in plain words**: coming in a bar late, the bar where a chart slipped, and one drum running ahead of or behind the others.
- **Fuller diagnostics**: timing and setting changes, each run starting, runs stopped early and tab changes are noted alongside the kit messages.
- **More uneven meters**: 7/8 grouped 3 + 2 + 2 and 2 + 3 + 2, 5/8 grouped 2 + 3 and 3 + 2, and 9/8, with a preset for each family.
- **A calmer Build screen**: five everyday kinds of note with the rest behind "More", the time signature in a list that says how each is counted, settings grouped as Rhythm, Bars and playback, and Keep and share, and the instructions in a help sheet.
- **Sight-reading in the newer notation**: three more styles in Play, each as a one-bar groove and a 4-bar, repeat and 16-bar chart: Odd time (7/8, 5/8, 9/8), Flams, drags and rolls, and 32nd notes.
- **Room for 32nds in Build**: a beat split into 32nds is twice as wide on the staff and the grid, and on a narrow screen the two scroll sideways together.
- **Kit sound delay explained**: kit setup says how far the app's drum sounds trail your sticks on this device, when it is enough to notice, and how to avoid it.
- **Tests** for all of the above, including two runs recorded on the real kit (68 in total).

## Next

1. **Test on a real phone, and more on the real kit** (see "Not yet checked"), and tune from a diagnostics file.

Everything else on the original list is built. Ideas that came up along the way, none started:

- A lesson page for 5/8 and 9/8 in Learn (7/8 has one), and uneven meters in Listen and Quiz.
- Telling a microphone hit's drum apart by its sound (low for kick, bright for cymbals).

## Not yet checked

- **Checked on the real kit so far** (TD-17, USB, Chrome on Windows): MIDI arrives, the diagnostics download works, the built-in note map is right for every zone that was hit (the ride bell does send 53), and kit calibration gives fair scores.
- **Still to check on the kit**: the cross-stick (note 37 was not played), the loud/soft thresholds for accents and ghost notes, whether a flam arrives as two separate hits, whether the new "softest hit that counts" limit (8, and 16 for the kick) is right, how the app's own drum sounds feel given about 50 ms of output delay, and MIDI over USB on Android.
- **Nothing has been tried on a real phone.** Tap timing, the wake lock, the backup download and the chart's auto-scroll all need one. The microphone has only been tried with a simulated sound, never a real pad in a real room, and none of the newer sounds (cross-stick, bell, rimshot, drag, roll) has been listened to. So do the phone's share sheet and the MIDI and picture downloads; the MIDI file has not been opened in drum software yet.
