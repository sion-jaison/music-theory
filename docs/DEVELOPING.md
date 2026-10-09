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
  12-notation.js       rhythm and pitch notation (Score), quantizing taps and played notes, MelodyCapture and Tasks.capture,
                       rhythm tasks for any meter (rhythmTap, rhythmDictation, meterFeel)
  13-intermediate.js   intermediate pieces: Drone and key context, Tasks.degreeEar, the adaptive EarGym (addEarSkill),
                       Motive tools and Tasks.variationLab, contour, and the project steps (projectSetup, projectDraft,
                       review, compare)
  15-backing.js        Backing: a band (drums, bass, chords) in eleven styles over any chord list; start, ui, arrange, render
  16-midifile.js       MidiFile: any sketch as a Standard MIDI File (melody, chords, bass, parts, S A T B voices), and a reader
  17-transcribe.js     Transcribe: chords from a recording (the learner's own file or a practice track), with a waveform,
                       an A–B loop and slow-down; Tasks.transcribe
  18-instruments.js    INSTRUMENTS and Instruments: ranges, transpositions, clefs, written keys, range checks in words
  19-songcraft.js      Listening Maps (addListeningMap, Tasks.listeningMap: real songs by title only), the chord sheet
                       (ChordSheet: chords per bar or half bar as Roman numerals, key changes, the melody's fit; SheetHas
                       questions for checks) and Tasks.songDraft (chords plus a melody; drafts and version 2 for projects)
  20-level1.js … 60-level5.js   one file per level: its tasks, units, review cards, Daily Set ear and create config
  62-level6-rhythm.js, 63-level6.js   Level 6 (units 6.1–6.4 in the first file, the rest and addLevel in the second)
  80-progress.js       units done, level unlocks, review scheduling, sketches, streak, personal bests
  85-lesson.js         lesson runner
  90-views.js          home, lesson, Daily Set, sketchbook, setup
  95-toolbox.js        Toolbox: reference tabs, plus the Studio tabs (Transcribe, Export MIDI, Instruments)
  99-boot.js           start-up
test/                  Node tests (theory, pitch, chord) and jsdom walkthroughs (smoke, rhythm, studio, level2 … level6)
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

A unit: `{ id: '2.3', title, blurb, steps: [...] }`, plus `create: true` for a Create stop (id like `2.P`) or `boss: true` for the boss (id **must** be `N.B`; passing it opens level N+1). Intermediate units end in a workshop step and set `workshop: true`.

Levels 1–5 form the **Beginner** section and 6–10 the **Intermediate** section (`section` on the level, set automatically). Home groups the tabs by section; passing a section's last boss shows "<Section> section complete". When the learner's current level is intermediate, the Daily Set becomes Tune-in over a drone → Review → New bite → **Ear Gym** → **8 Bars** → Today's 1%. The Ear Gym runs the learner's weakest unlocked skill: register skills with `addEarSkill({ id, label, unit, run(body, finish(ok, total), difficulty) })`; difficulty (1–5) rises after 80% and falls below 50%. A level's `create` may name a `task` (e.g. `'capture'`) and give `params` as a getter so each day gets a fresh constraint. An intermediate level may also bring its own tune-in, `tune: { title, sub, task, params, share }`, which replaces the drone tune-in on a `share` of days (default half). Home shows intermediate learners **this week's Listening Map** (`addListeningMap`, see 19-songcraft.js) and their **Portfolio pick**; Ear Gym level-ups, picks and a version 2 rated higher than its draft on the same rubric become Today's 1%. Boss steps cannot be skipped, so every boss task must be completable with the on-screen keys and computer keys alone (no mic required).

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

`Sound.tone(midi, when, dur, vel)`, `Sound.seq([{ m, t, d, v }])` (returns ms), `Sound.chord(midis, when, dur)`, `Sound.click(when, accent, soft)`, `Sound.wood(when)`, `Sound.now()`. A synthesized kit and band: `Sound.kick/snare/hat/ride/rim(when, vel)` (`Sound.hat(when, vel, true)` is open), `Sound.bass(midi, when, dur, vel)`, `Sound.pad(midis, when, dur, vel, attack)`. `Sound.routed(gainNode, fn, { gate })` sends everything fn plays through a gain node (stop by fading it); `Sound.offline(ctx, fn)` plays into an OfflineAudioContext instead. `playChordList([{ sym, t, d }], oct)` plays chord symbols. `Theory.voicing(root, q, oct, inversion)` gives MIDI numbers. The mic ignores input while the app's own sound is playing (`Sound.busyUntil`).

## Studio tools

Four tools for Levels 7–10, each with a block comment at the top of its file listing every option. `test/studio.js` shows them in use.

**Backing** (`15-backing.js`): a band that plays a chord progression in a style. Styles (`Backing.STYLES[id]` has `name`, `desc`, `meter`, `bpm`, `swing`): `pop`, `rock`, `ballad`, `swing`, `bossa`, `waltz` (3/4), `ballad68` (6/8), `odd54` (5/4 as 3 + 2), `odd78` (7/8 as 2 + 2 + 3), `funk`, `ambient` (no drums).

```js
const band = Backing.start({ style: 'swing', chords: ['ii7', 'V7', 'Imaj7'], key: 'B♭', bpm: 160,
  mute: { chords: true }, onChord: (i, chord) => …, onBar: n => …, onEnd });   // loop: true by default; bars: 8 to stop
band.setMute('drums', true); band.setChords([{ sym: 'Cm7', beats: 2 }, …]); band.setTempo(120); band.stop();
const w = Backing.ui(el, { style: 'bossa', chords, key, styles: ['bossa', 'swing'] });   // picker, tempo, play, mutes; w.destroy()
Backing.arrange({ style, chords, … }).events   // [{ role, kind, t, d, m | ms, v, bar }] in beats: what start() plays
```

Chords may be symbols, Roman numerals (with `key`, `mode`), `{ sym | roman, beats }`, `Theory.progression` objects, or a ChordSheet timeline `[{ sym, t, d }]` in beats. `melody` puts notes (in beats) or a sketch on top. Every role (drums, bass, chords, melody) has its own gain node under the band's bus, so `stop()` and `setMute()` silence notes already scheduled. The mic keeps listening while it plays (`gate: true` to change that). bpm is quarter notes per minute in every meter, as in `Score`. `Backing.voiceLead(chords, 'full' | 'shell' | 'power' | 'quartal', n, [lo, hi])` gives smooth voicings on their own; `Backing.styleFor(meter, preferred)` picks a style for a meter. The Level 5 loop (`l5Engine`, `l5Loop`) is unchanged.

**MidiFile** (`16-midifile.js`): `MidiFile.download(sketch)` saves `Name.mid`; `MidiFile.fromSketch(sketch)` gives the bytes (type 1, 480 PPQ) and `MidiFile.parse(bytes)` reads them back. Tracks: Melody (`score` or `notes`), Chords and Bass (from `chords`), each of `parts: [{ name, notes, inst | program, channel (1–16), drums, role }]`, and `voices` (S A T B), after a conductor track with the tempo, meter and key signature. A sketch with `backing: { style }` exports that band (drums on channel 10).

**Transcribe** (`17-transcribe.js`): `Tasks.transcribe(el, { prompt, need: 4, practice: { romans, key, mode, bpm, style }, save: { level, tags } }, done)`. The learner opens an audio file (nothing is uploaded) or the practice track, loops and slows a passage, and confirms each suggested chord by ear and by playing it; `done(true, { chords, sketch })` after saving a sketch tagged `transcription`. The pure parts (`Transcribe.chroma`, `frames`, `smooth`, `peaks`, `loopOf`, `wav`) take plain `Float32Array`s. The chord analysis is the mic's (`spectrumChord` in `00-core.js`).

**Instruments** (`18-instruments.js`): `INSTRUMENTS` (21: woodwinds, brass, strings, guitar and bass, piano, four voices) with sounding ranges, transpositions, clefs and General MIDI programs. `Instruments.written(m, 'altoSax')`, `sounding`, `writtenKey('E♭', 'clarinet')` → `'F'`, `checkRange(notes, inst, { bpm, meter })` → sentences like "Bar 3: the B♭2 is below the alto sax’s lowest note, D♭3 (sounding).", `transposeEvents(events, semis, keySig)` and `part(events, inst, keySig)` → `{ events, keySig, clef }` for a written part.

`playSketch(s)` also plays `parts` and `voices`, and with `s.backing = { style }` (or `playSketch(s, { backing })`) has that band play the chords; `stopSketch()` stops it.

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
| `l6clap` | `meter, patterns, bpm, counts, swing, pickup, prompt` | clap one rhythm back, one try |
| `l6degree` | `degrees` | name one scale degree by ear after the key |

A level can register its own type: `CARD_TYPES.myType = (el, card, fin) => cleanup`, calling `fin(ok)` exactly once.

## Sketches

`saveSketch({ name, notes: [{ m, t, d }], prompt, level, chords: [{ sym, t, d }], key, bpm, from })` stores an idea in the sketchbook; `playSketch(s)` plays melody and chords. `Store.data.sketches` is newest first. Levels grow the same idea: motif (1) → phrase (2) → harmonized phrase (3) → minor version (4) → 8-bar piece (5); set `from` to the id of the sketch it grew from.

From Level 6 on, sketches written in the score editor (`Tasks.capture`) also carry `score: { meter, bpm, keySig, events, swing? }`, so they reopen as notation, and `tags` (e.g. `['contour', 'climax']`) for the sketchbook filter. Project drafts add `project` (the unit id), `version` (1 or 2), `review: { scores, note }` on the draft and `compare: { winner, why }` on version 2.

## Storage and progress

`Store.data` is saved to localStorage (`motif.v1`) with `Store.save()`. `Store.day()` is today's record (`earOk`, `earN`, `wins`, …). `recordBest(key, value, { lowerIsBetter, label, format })` keeps a personal best and, when it improves, gives Today's 1% something to show.

## Writing style

Short sentences, second person, no exclamation marks, no emoji. Bold a term the first time it is named. Use ♯ and ♭ symbols, curly quotes and apostrophes (’ “ ”), "half step" and "whole step", "bar" for measure. Hear and play before naming: the first step of a unit is usually a sound, not a definition. Every unit works with the keys alone; the mic is a bonus, never a gate.
