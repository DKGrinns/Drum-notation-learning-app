# Roadmap

What's planned, in priority order. Updated 2026-11-14.

## Done

- **Screen stays on** while anything is playing, and playback stops cleanly if the app goes to the background.
- **Backup and restore** of all progress (Learn → Progress → Backup), plus a request to the browser not to clear saved data.
- **4-bar charts** in Play: a groove, a variation, the groove again, then a fill. Beginner, Intermediate and Advanced.
- **Automated tests** for the groove model (`npm test`).

## Next

1. **Finish multi-bar music**
   - Build: write and save charts of several bars.
   - Repeat signs with first and second endings; 8- and 16-bar charts.
   - A Learn level that teaches reading across bars and fills.
   - Chart options for shuffle, 3/4 and 6/8 (the generator already supports them).
2. **Real drum input**
   - MIDI from an electronic kit (Chrome on Android and desktop; not Safari on iPhone). Lets accents and ghost notes be scored by how hard you hit.
   - Microphone: detect hits on a practice pad. Knows when you hit, not which drum.
3. **Reading quizzes**: note and rest values, and "which count is this note on?".
4. **Dictation** in Listen: hear a groove, write it in the Build grid.
5. **Groove library**: save several grooves in Build, share one as a link, export as an image or MIDI file.
6. **More notation**: hi-hat foot, cross-stick, rimshot, ride bell, stickings (R/L), ties, 32nd notes, sextuplets, rolls and drags, and 2/4, 5/4 and 7/8.
7. **Practice tools**: tempo trainer that speeds up as you pass, tap tempo, separate volumes for click and drums.
8. **More tests**: tap scoring and the notation layout.

## Not yet checked

- Nothing has been tried on a real phone. Tap timing, the wake lock, the backup download and the chart's auto-scroll all need a real device.
