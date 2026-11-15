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

## Next

1. **Dictation** in Listen: hear a groove, write it in the Build grid.
2. **Real drum input**
   - MIDI from an electronic kit (Chrome on Android and desktop; not Safari on iPhone). Lets accents and ghost notes be scored by how hard you hit.
   - Microphone: detect hits on a practice pad. Knows when you hit, not which drum.
3. **Longer charts**: 16 bars, repeats and endings written in Build.
4. **iPhone home-screen icon** (a PNG; the current icon is SVG only).
5. **Groove library**: save several grooves in Build, share one as a link, export as an image or MIDI file.
6. **More notation**: hi-hat foot, cross-stick, rimshot, ride bell, stickings (R/L), ties, 32nd notes, sextuplets, rolls and drags, and 2/4, 5/4 and 7/8.
7. **Practice tools**: tempo trainer that speeds up as you pass, tap tempo, separate volumes for click and drums.
8. **More tests**: tap scoring and the notation layout.

## Not yet checked

- Nothing has been tried on a real phone. Tap timing, the wake lock, the backup download and the chart's auto-scroll all need a real device.
