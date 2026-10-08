# Motif

A beginner music theory platform that listens to you play. Instead of reading and ticking boxes, you answer by playing or singing: the app hears notes, claps and chords through the microphone (or the on-screen keys, your computer keyboard, or a MIDI keyboard) and tells you whether you got it.

The beginner section is five levels, planned unit by unit in [`docs/PLAN.md`](docs/PLAN.md):

| Level | Title | Covers |
|---|---|---|
| 1 | Hear It, Find It | Pitch, octaves, the keyboard map, sharps and flats, half and whole steps, beat, tempo, basic rhythms |
| 2 | Steps & Scales | Treble and bass clef, the major scale in any key, solfège, intervals with song anchors, 3/4, dots, ties, sixteenths |
| 3 | Stack It | Triads, chord symbols, guitar shapes, inversions, the chords of a key, Roman numerals, 7th chords, arpeggios. Mic chord recognition starts here |
| 4 | The Clock | Key signatures, the Circle of Fifths, relative and parallel keys, natural, harmonic and melodic minor, chords in minor |
| 5 | Make It Move | Chord functions, the four-chord loop, 12-bar blues, ii–V–I, cadences, transposing, melody over chords, dynamics, form, your own 8-bar piece |

Every unit follows the arc **Hear → Echo → Explore → Name → Create**. Each level ends with a boss challenge that opens the next level (and lets you test out of a level you already know).

Every day there is a 10-minute **Daily Set**: tune in, review what is due, learn one new thing, make something, train your ear, and see **Today's 1%**, one number that got better. Finishing a unit adds review cards that come back after 1, 3, 7, 14 and 30 days. The **Sketchbook** keeps one musical idea growing from a Level 1 motif to a Level 5 eight-bar piece. The **Toolbox** has a "what am I playing?" listener (notes, chords and the likely key), a Circle of Fifths explorer, scale, chord and progression finders, and every memory hook in the course.

## Run it with the microphone

Browsers only allow the mic on a secure page (https or localhost). The claude.ai preview blocks it, so run it yourself:

```
python3 build.py
python3 -m http.server 8000 --directory public
# then open http://localhost:8000
```

Use headphones so the app's own sounds stay out of the mic.

Without a mic, everything works with the on-screen keys, the computer keyboard (A–K = C4–C5, W E T Y U for the black keys, Z/X change octave, Space taps a beat) or a USB MIDI keyboard (Chrome, Edge, Firefox). Chords can be tapped: notes played within about a second and a half count as one chord.

Progress is stored in this browser (localStorage). Accounts and sync come later.

## Deploy to Cloudflare

The repo is ready for Cloudflare Workers (static assets) or Cloudflare Pages; `public/` is the site. Step-by-step instructions are in [`docs/DEPLOYING.md`](docs/DEPLOYING.md). The short version:

```
npm install
npx wrangler login
npm run deploy        # builds public/ and deploys it as the "motif" Worker
```

Or connect the GitHub repo in **Workers & Pages → Create → Import a repository** (deploy command `npx wrangler deploy`), or create a Pages project with build output directory `public`.

## Project layout

```
docs/PLAN.md         the beginner plan, Levels 1–5
docs/DEVELOPING.md   how the app is built and how to add a level
docs/DEPLOYING.md    how to put it online with Cloudflare
src/pitch.js         listening engine: pitch detection, note tracker, onset detector, chord recognition
src/theory.js        theory engine: spelled notes, scales, chords, keys, Circle of Fifths, intervals, numerals
src/app/*.js         the app, one file per part (core, shared components, each level, views, toolbox)
src/styles*.css      design tokens (light and dark) and components
src/shell.html       page markup; build.py fills in the CSS and JS
src/site/            files copied into the site as is: _headers (mic permission, security), favicon, 404 page
build.py             writes public/ (the website) and dist/index.html (claude.ai artifact body)
public/              the built website, committed so it can be deployed as is
wrangler.jsonc       Cloudflare Workers config (static assets from public/)
test/                theory, pitch and chord tests (Node); walkthroughs of every level (jsdom)
```

## Build and test

```
npm install        # jsdom for the walkthrough tests, wrangler for Cloudflare
npm test           # builds, then runs every test
npm run preview    # the site on Cloudflare's local runtime, http://localhost:8787
```
