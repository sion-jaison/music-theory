# Developing Motif

How the app is put together, and how to add or change a level. Read `docs/PLAN.md` for *what* each level teaches; this file is about *how* it is built.

## Layout

```
src/shell.html         page markup; build.py fills in CSS and JS
src/site/              copied into public/ as is: _headers, favicon.svg, 404.html
src/styles.css         design tokens (light and dark) and base components
src/styles/*.css       more styles, concatenated in name order (10-components.css, then one per level)
src/pitch.js           listening engine: pitch detection, note tracker, onset detector, chord recognition
src/theory.js          theory engine: spelled notes, scales, chords, keys, circle, intervals, numerals
src/app/*.js           the app, concatenated in name order inside one strict-mode function
  00-core.js           helpers, event bus, storage, sound, mic, MIDI, computer keys, dock keyboard
  05-registry.js       LEVELS, ARC, CARD_DEFS, CARD_TYPES, addLevel()
  10-tasks.js          Level 1 tasks (climb, octave, findAll, playName, step, pulse, clapback, echo, motif, choice, card …)
  11-components.js     shared pieces: Staff, Circle, ChordIn, chordHit, chromaMeter, Tasks.quiz/playSeq/playChords
  20-level1.js … 60-level5.js   one file per level: its tasks, units, review cards, Daily Set ear and create config
  80-progress.js       units done, level unlocks, review scheduling, sketches, streak, personal bests
  85-lesson.js         lesson runner
  90-views.js          home, lesson, Daily Set, sketchbook, setup
  95-toolbox.js        Toolbox
  99-boot.js           start-up
test/                  Node tests (theory, pitch, chord) and jsdom walkthroughs (smoke, rhythm, level2 … level5)
```

All `src/app` files share one scope, so a function or `const` defined in an earlier file is visible in later ones. Names must be unique across files. Function declarations are hoisted; `const` values are not, so top-level code may only use constants from earlier files.

`python3 build.py` writes `public/` (the website: `index.html`, the complete app in one page, plus everything in `src/site/`) and `dist/index.html` (the page body for a claude.ai artifact). `MOTIF_PUBLIC=/some/dir` and `MOTIF_DIST=/some/dir` build elsewhere; tests read `MOTIF_PAGE` (default `public/index.html`). Commit `public/` with source changes: it is what Cloudflare deploys (see `docs/DEPLOYING.md`).

## Tests

```
npm install            # jsdom, once
npm test               # build, then every test
node test/theory.test.js
MOTIF_PAGE=/tmp/x/index.html node test/level3.js
```

Walkthrough tests use `test/helpers.js`:

```js
const H = require('./helpers');
(async () => {
  const t = await H.load({ unlock: 3 });   // bosses of Levels 1–2 marked passed, so Levels 1–3 are open
  t.openUnit('3.2'); await t.wait(40);
  t.next();                                // the Next button of the current step (throws if disabled)
  t.pc('C'); t.pc('E'); t.pc('G');         // play pitch classes on the computer keys (any octave)
  t.check(!t.nextBtn().disabled, '3.2 C major chord recognized from keys');
  t.check(await t.walk('3.5'), '3.5 renders every step');   // skip/next through a whole unit
  t.finish();                              // fails on any runtime error, exits with the right code
})();
```

## Levels, units and steps

A level file ends with `addLevel({...})`:

```js
addLevel({
  n: 2, title: 'Steps & Scales', tagline: 'one line under the title on home',
  units: [ /* unit objects, in order; the last is the boss */ ],
  cards: { '2.1': [ /* review cards unlocked by finishing 2.1 */ ] },
  passText: 'Shown when the boss is passed: what the learner can now do.',
  create: { params: { pcs: [0, 2, 4, 5, 7, 9, 11], pcsLabel: 'C major', min: 3, max: 8 }, prompts: ['…', '…'] },  // Daily Set "Create"
  ear: { title: 'Name the interval', sub: '…', run(body, finish) { …; finish(okCount, total); return cleanup; } }   // Daily Set "Ear spark"
});
```

A unit: `{ id: '2.3', title, blurb, steps: [...] }`, plus `create: true` for a Create stop (id like `2.P`) or `boss: true` for the boss (id **must** be `N.B`; passing it opens level N+1). Boss steps cannot be skipped, so every boss task must be completable with the on-screen keys and computer keys alone (no mic required).

A step is a reading card or a task, tagged with one of `ARC`: `Hear`, `Echo`, `Explore`, `Name`, `Create`.

```js
{ k: 'card', tag: 'Name', title: 'Two halves', body: '<p>…</p>',
  play: [{ m: 60, t: 0, d: 0.5 }] | 'metronome' | () => {…}, playLabel: 'Play it',
  marks: [0, 4, 7],                    // pitch classes to glow on the dock keyboard
  art: Staff.svg({...}) | () => html,  // a picture under the text
  mount: el => { …; return cleanup; }, // an interactive widget (e.g. a Circle explorer)
  rhythm: [1, 1, 2], fret: true }      // Level 1 extras
{ k: 'task', tag: 'Echo', type: 'playSeq', p: {...} | () => ({...}) }   // p as a function is re-run each time the step opens
```

A task is `Tasks.name = (el, p, done) => cleanup`. Call `done(true, extra)` once the learner has done it (this enables Next). Return a cleanup that removes every Bus listener, timer and keyboard mark. A level may add its own tasks to `Tasks`.

## Input

Everything the learner plays arrives on the event bus, whatever the source (on-screen keys, computer keys A–K, MIDI, mic):

| Event | Data |
|---|---|
| `note` | `{ midi, source: 'tap'|'key'|'midi'|'mic', t }` |
| `noteoff` | `{ midi, source }` |
| `onset` | `{ t, source }` (claps, taps, Space) |
| `chord` | `{ source, pcs, bassPc, rootPc, q, sym, inversion }` (only while `ChordIn` is started) |
| `chroma` | `{ chroma: Float32Array(12), bassPc, energy }` or `null` (mic chord analysis) |
| `mic` | mic state string |

`Bus.on(name, fn)` returns an unsubscribe function. The dock keyboard covers C3–C5 (MIDI 48–72): `Keyboard.mark(midi, cls)`, `Keyboard.markPcs(pcs, cls)`, `Keyboard.flash(midi, cls, ms)`, `Keyboard.clearMarks()`; classes `hint`, `target`, `found`.

Chords: call `ChordIn.start()` (and `ChordIn.stop()` in cleanup). Notes tapped within 1.6 s form a chord, MIDI held notes form a chord, and the mic switches to chord analysis. Use `chordHit(ev, chordTarget('C/E'))` to check a `chord` event; it compares pitch-class sets (and the bass when the target has one).

## Sound

`Sound.tone(midi, when, dur, vel)`, `Sound.seq([{ m, t, d, v }])` (returns ms), `Sound.chord(midis, when, dur)`, `Sound.click(when, accent, soft)`, `Sound.wood(when)`, `Sound.now()`. `playChordList([{ sym, t, d }], oct)` plays chord symbols. `Theory.voicing(root, q, oct, inversion)` gives MIDI numbers. The mic ignores input while the app's own sound is playing (`Sound.busyUntil`).

## Shared components

- **`Staff.svg({ clef, notes, keySig, time, labels, marks, gap, filled })`**: treble, bass or grand staff. `notes` items are `'C4'`, `['C4','E4','G4']` (a chord), `null`, or `{ n, label, mark, staff }`. Accidentals are drawn from the spelling (`'F♯4'`); pass `acc: false` on an item to hide them (when the key signature covers them).
- **`Circle.svg(opts)` / `Circle.mount(el, opts, onPick(pos, ring))`**: the Circle of Fifths. Positions 0–11 clockwise from C. `selected`, `family` (light I IV V and ii vi iii), `hide` + `reveal` (blank clock for games), `marks` (`{ 3: 'ok', m3: 'no' }`; `m` prefix = inner ring), `ring: 'major'` (outer ring only), `center` (lines of hub text), `static`.
- **`Tasks.quiz`** (multiple-choice rounds from a generator), **`Tasks.playSeq`** (play notes in order: scales, arpeggios, melodies), **`Tasks.playChords`** (play named chords; timed or not). See the comments in `11-components.js` for every option.
- **`chromaMeter(el)`**: live 12-bar picture of what the mic hears.
- **`Theory`**: see `src/theory.js`. Notes are spelled strings (`'F♯4'`, `'B♭'`); `Theory.midi`, `Theory.pc`, `Theory.scale(root, type, withTop)`, `Theory.recipe(type)`, `Theory.chordNotes(root, q)`, `Theory.identify(pcs, bassPc)`, `Theory.interval(a, b)`, `Theory.INTERVALS` (with song anchors), `Theory.keySig(tonic, mode)`, `Theory.keyFromSig(n, mode)`, `Theory.CIRCLE`, `Theory.circlePos`, `Theory.diatonic(tonic, mode, sevenths)`, `Theory.romanChord(roman, tonic, mode)`, `Theory.progression(romans, tonic, mode)`, `Theory.PROGRESSIONS`.

## Review cards

`cards: { unitId: [card, …] }`. Every card has a unique, stable `id` (prefix with the level: `l3-…`) and a `type`:

| type | fields | shown as |
|---|---|---|
| `choice` | `q, options, answer, why, html, play` | one multiple-choice question |
| `gen` | `gen() → { q, options, answer, why, html, play }` | a fresh question each time |
| `seq` | `prompt, notes (array or function), show` | play a short sequence; one slip allowed |
| `chord` | `prompt, chord (symbol or function), tones` | play one chord; one wrong chord allowed |
| `play`, `step`, `nameBlack` | Level 1 types | |

A level can register its own type: `CARD_TYPES.myType = (el, card, fin) => cleanup`, calling `fin(ok)` exactly once.

## Sketches

`saveSketch({ name, notes: [{ m, t, d }], prompt, level, chords: [{ sym, t, d }], key, bpm, from })` stores an idea in the sketchbook; `playSketch(s)` plays melody and chords. `Store.data.sketches` is newest first. Levels grow the same idea: motif (1) → phrase (2) → harmonized phrase (3) → minor version (4) → 8-bar piece (5); set `from` to the id of the sketch it grew from.

## Storage and progress

`Store.data` is saved to localStorage (`motif.v1`) with `Store.save()`. `Store.day()` is today's record (`earOk`, `earN`, `wins`, …). `recordBest(key, value, { lowerIsBetter, label, format })` keeps a personal best and, when it improves, gives Today's 1% something to show.

## Writing style

Short sentences, second person, no exclamation marks, no emoji. Bold a term the first time it is named. Use ♯ and ♭ symbols, curly quotes and apostrophes (’ “ ”), "half step" and "whole step", "bar" for measure. Hear and play before naming: the first step of a unit is usually a sound, not a definition. Every unit works with the keys alone; the mic is a bonus, never a gate.
