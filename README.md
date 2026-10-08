# Motif — Level 1

The first playable slice of the beginner music theory platform: all 11 Level 1 stops (units 1.1–1.9, the motif and the boss challenge), the 10-minute Daily Set, a spaced-review deck, a sketchbook and an on-screen instrument.

## Run it with the microphone

Browsers only allow the mic on a secure page (https or localhost). The claude.ai preview blocks it, so run the standalone file yourself:

```
python3 -m http.server 8000
# then open http://localhost:8000/motif-standalone.html
```

Or upload `motif-standalone.html` to any https host (GitHub Pages, your own site). Use headphones so the app's own sounds stay out of the mic.

Without a mic, everything works with the on-screen keys, the computer keyboard (A–K = C4–C5, Z/X change octave, Space taps a beat) or a USB MIDI keyboard (Chrome, Edge, Firefox).

## Project layout

```
src/pitch.js     listening engine: McLeod pitch detection, note tracker, onset detector
src/app.js       sound, input, lessons, review deck, Daily Set, sketchbook, views
src/styles.css   design tokens (light and dark) and components
src/shell.html   page markup; build.py fills in the CSS and JS
build.py         writes dist/index.html (artifact) and dist/motif-standalone.html
test/            pitch.test.js (synthetic tones), smoke.js and rhythm.js (jsdom walkthroughs)
```

## Build and test

```
python3 build.py
node test/pitch.test.js
npm i jsdom@24 && node test/smoke.js && node test/rhythm.js
```

## How it maps to the plan

- Every unit follows the creative arc: Hear → Echo → Explore → Name → Create.
- Finishing a unit adds its review cards; cards return after 1, 3, 7, 14 and 30 days, and a miss resets a card to tomorrow.
- Progress is stored in this browser (localStorage). Accounts and sync come later.
- Mic chord recognition starts in Level 3; Level 1 only needs single notes and claps.
