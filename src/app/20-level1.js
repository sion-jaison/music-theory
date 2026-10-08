/* =================================================================
   Level 1 content
   ================================================================= */
const L1_UNITS = [
  { id: '1.1', title: 'What a note is', blurb: 'Turn vibration into a dot you can steer.', steps: [
    { k: 'card', tag: 'Hear', title: 'Low, then high', play: [{ m: 45, t: 0, d: 0.9 }, { m: 76, t: 1.0, d: 0.9 }], playLabel: 'Play two notes', body: '<p>Press play: a low note, then a high one.</p><p>Every sound is something vibrating: a string, your vocal cords, a speaker. The faster it vibrates, the higher it sounds. That height is called <b>pitch</b>.</p>' },
    { k: 'task', tag: 'Echo', type: 'climb', p: { dir: 1, prompt: 'Make the dot climb: play or sing three notes, each higher than the last.' } },
    { k: 'task', tag: 'Explore', type: 'climb', p: { dir: -1, prompt: 'Now make it fall: three notes, each lower than the last.' } },
    { k: 'card', tag: 'Name', title: 'A note is a pitch with a name', body: '<p>The A above middle C vibrates <b>440 times a second</b>, written 440 Hz. Every tuner in the world agrees on that number, so every musician agrees on what “A” means.</p><p>The readout in the dock does the same job: it turns vibrations into a name.</p>' }
  ] },
  { id: '1.2', title: 'Octaves', blurb: 'Why seven letters are enough.', steps: [
    { k: 'card', tag: 'Hear', title: 'Three notes, one name', play: [{ m: 45, t: 0, d: 0.8 }, { m: 57, t: 0.9, d: 0.8 }, { m: 69, t: 1.8, d: 0.8 }], playLabel: 'Play A2, A3, A4', body: '<p>These three notes sound like the same note at different heights. Each vibrates exactly twice as fast as the one before: 110, 220, 440 Hz.</p>' },
    { k: 'task', tag: 'Echo', type: 'octave', p: { rounds: 3 } },
    { k: 'card', tag: 'Name', title: 'Double it and you get an octave', body: '<p>Doubling the vibrations gives an <b>octave</b>. Because octaves sound like the same note, music needs only 7 letters: A B C D E F G, then the alphabet starts again.</p><p>The number after a letter says which octave: A4 is the 440 Hz A. Middle C is C4.</p>' }
  ] },
  { id: '1.3', title: 'The keyboard map', blurb: 'Black-key groups are your landmarks.', steps: [
    { k: 'card', tag: 'Hear', title: 'Twos and threes', marks: [1, 3, 6, 8, 10], body: '<p>Look at the dock: the black keys come in groups of two and three, over and over. Those groups are the landmarks for every white key.</p>' },
    { k: 'card', tag: 'Name', title: 'C and F', marks: [0, 5], body: '<p><b>C</b> sits just left of every group of two black keys. <b>F</b> sits just left of every group of three. The glowing keys are all the Cs and Fs.</p>' },
    { k: 'task', tag: 'Echo', type: 'findAll', p: { pc: 0, need: 3, tip: 'Look left of each pair of black keys.' } },
    { k: 'task', tag: 'Explore', type: 'findAll', p: { pc: 5, need: 3, tip: 'Look left of each group of three.' } },
    { k: 'task', tag: 'Explore', type: 'playName', p: { prompt: 'Find each note from the nearest landmark, in any octave.', items: shuffle([2, 4, 7, 9, 11]).map(pc => ({ pc, label: SHARP[pc] })) } }
  ] },
  { id: '1.4', title: 'Sharps, flats, two names', blurb: 'One black key, two names.', steps: [
    { k: 'card', tag: 'Name', title: '♯ up, ♭ down', marks: [1], body: '<p><b>♯ (sharp)</b> means one key higher. <b>♭ (flat)</b> means one key lower.</p><p>The glowing key is one key above C, so it is C♯. It is also one key below D, so it is D♭. One key, two names: these are called <b>enharmonic</b> notes. A double sharp (𝄪) or double flat (𝄫) moves two keys.</p>' },
    { k: 'task', tag: 'Echo', type: 'nameBlack', p: { rounds: 4 } },
    { k: 'task', tag: 'Explore', type: 'playName', p: { prompt: 'Play each one, in any octave.', items: shuffle([[6, 'F♯'], [10, 'B♭'], [3, 'E♭'], [1, 'C♯']]).map(([pc, label]) => ({ pc, label })) } }
  ] },
  { id: '1.5', title: 'Half and whole steps', blurb: 'The only two rulers you need.', steps: [
    { k: 'card', tag: 'Hear', title: 'Small and smaller', play: [{ m: 64, t: 0, d: 0.6 }, { m: 65, t: 0.65, d: 0.6 }, { m: 64, t: 1.6, d: 0.6 }, { m: 66, t: 2.25, d: 0.6 }], playLabel: 'E → F, then E → F♯', body: '<p>First a half step, then a whole step. Hear how the second gap is wider.</p>' },
    { k: 'card', tag: 'Name', title: 'Half step, whole step', body: '<p>A <b>half step</b> is the very next key, black or white, with nothing between (on a guitar, the next fret). A <b>whole step</b> is two half steps.</p><p>B to C and E to F are half steps with no black key between them.</p>' },
    { k: 'task', tag: 'Echo', type: 'step', p: { rounds: 5 } },
    { k: 'task', tag: 'Explore', type: 'chromatic', p: {} }
  ] },
  { id: '1.6', title: 'Guitar and voice view', blurb: 'Same 12 notes, other instruments.', steps: [
    { k: 'card', tag: 'Name', title: 'One fret, one half step', fret: true, body: '<p>A guitar holds the same 12 notes, laid out in a line. Each fret raises the string one half step, so the low E string reaches E again at fret 12: one octave.</p>' },
    { k: 'task', tag: 'Explore', type: 'range', p: {} }
  ] },
  { id: '1.7', title: 'Beat, tempo, strong and weak', blurb: 'Feel the pulse before you count it.', steps: [
    { k: 'card', tag: 'Hear', title: 'ONE two three four', play: 'metronome', playLabel: 'Play two bars at 80 BPM', body: '<p>A <b>beat</b> is the steady pulse you tap your foot to. <b>Tempo</b> is how fast it goes, in beats per minute (BPM).</p><p>Beats group into bars. Beat 1 of each bar is strong; the others are weaker. Listen for the higher click on beat 1.</p>' },
    { k: 'task', tag: 'Echo', type: 'pulse', p: { bpm: 80 } },
    { k: 'task', tag: 'Explore', type: 'pulse', p: { bpm: 100 } }
  ] },
  { id: '1.8', title: 'Note lengths in 4/4 and 2/4', blurb: 'Count rhythms with ta and ti-ti.', steps: [
    { k: 'card', tag: 'Name', title: 'How long a note lasts', rhythm: [4], body: '<p>Note shapes tell you how many beats a sound lasts. In 4/4 there are four beats in every bar:</p><p><b>Whole note</b> 4 beats (ta-a-a-a) · <b>half note</b> 2 (ta-a) · <b>quarter note</b> 1 (ta) · <b>two eighth notes</b> share 1 beat (ti-ti) · a <b>quarter rest</b> is 1 beat of silence (sh).</p><p>2/4 means two beats a bar, like a march. Saying the syllables out loud is the fastest way to feel a rhythm.</p>' },
    { k: 'task', tag: 'Echo', type: 'clapback', p: { rounds: 3, bpm: 72 } }
  ] },
  { id: '1.9', title: 'Echo and answer', blurb: 'Music as a conversation.', steps: [
    { k: 'card', tag: 'Hear', title: 'Call and response', body: '<p>Music often works like conversation: one phrase calls, another answers. Copying a phrase exactly trains your ear. Changing it makes it yours.</p><p>Everything here uses black keys only. Together they form a <b>pentatonic</b> scale, so nothing you play will clash.</p>' },
    { k: 'task', tag: 'Echo', type: 'echo', p: {} }
  ] },
  { id: '1.M', title: 'Your first motif', blurb: 'Make something of your own.', create: true, steps: [
    { k: 'card', tag: 'Name', title: 'A motif is a seed', body: '<p>A <b>motif</b> is a short musical idea, often only 3 or 4 notes, that a whole piece can grow from. You will keep coming back to the one you make now: Level 2 turns it into a phrase, and Level 5 grows it into an 8-bar piece.</p>' },
    { k: 'task', tag: 'Create', type: 'motif', p: { prompt: 'Make a motif of 3 to 6 notes on black keys only. Play it back, change what you don’t like, then name it.', blackOnly: true, min: 3, max: 6 } }
  ] },
  { id: '1.B', title: 'Boss challenge', blurb: 'Eight notes against the clock, then two bars of steady beat.', boss: true, steps: [
    { k: 'card', tag: 'Name', title: 'Show what you know', body: '<p>Part 1: the app names 8 notes. Play each within 3 seconds, in any octave. You need 7.</p><p>Part 2: keep a steady beat for two bars at 80 BPM. You need 6 of 8 beats.</p>' },
    { k: 'task', tag: 'Echo', type: 'playName', p: { prompt: 'Play it, any octave. 3 seconds each.', limit: 3, pass: 7, passMsg: 'Part 1 passed.', items: shuffle([0, 2, 4, 5, 7, 9, 11, 1, 3, 6, 8, 10]).slice(0, 8).map(pc => ({ pc, label: isBlack(pc) ? (Math.random() < 0.5 ? SHARP[pc] : FLAT[pc]) : SHARP[pc] })) } },
    { k: 'task', tag: 'Echo', type: 'pulse', p: { bpm: 80 } }
  ] }
];

/* Review deck: unlocked when the unit that teaches it is finished */
const L1_CARDS = {
  '1.1': [{ id: 'q-pitch', type: 'choice', q: 'A string starts vibrating faster. The note sounds…', options: ['Higher', 'Lower', 'Only louder'], answer: 0 }],
  '1.2': [
    { id: 'q-oct-hz', type: 'choice', q: 'A4 vibrates 440 times a second. How fast does A5 vibrate?', options: ['220 Hz', '660 Hz', '880 Hz'], answer: 2 },
    { id: 'q-oct-why', type: 'choice', q: 'Why does music need only 7 letter names?', options: ['Octaves sound like the same note', 'Pianos only have 7 keys', 'High notes have no names'], answer: 0 }
  ],
  '1.3': WHITE_PCS.map(pc => ({ id: 'play-' + pc, type: 'play', pc, label: SHARP[pc] })),
  '1.4': BLACK_PCS.map(pc => ({ id: 'black-' + pc, type: 'nameBlack', pc })).concat([[10, 'B♭'], [6, 'F♯'], [3, 'E♭'], [8, 'A♭'], [1, 'C♯']].map(([pc, label]) => ({ id: 'play-b-' + pc, type: 'play', pc, label }))),
  '1.5': [[64, 1, 1], [71, 1, 1], [64, 1, 2], [60, -1, 2], [65, -1, 1], [69, 1, 2], [60, -1, 1], [71, 1, 2]].map(([s, d, z]) => ({ id: `step-${s}-${d}-${z}`, type: 'step', start: s, dir: d, size: z })),
  '1.7': [
    { id: 'q-strong', type: 'choice', q: 'In 4/4, which beat is the strongest?', options: ['Beat 1', 'Beat 2', 'Beat 4'], answer: 0 },
    { id: 'q-bpm', type: 'choice', q: 'What does 80 BPM mean?', options: ['80 beats every minute', '80 bars every minute', '80 notes in the song'], answer: 0 }
  ],
  '1.8': [
    { id: 'q-half', type: 'choice', q: 'How many beats does a half note last in 4/4?', options: ['1', '2', '4'], answer: 1 },
    { id: 'q-titi', type: 'choice', q: 'Two eighth notes (ti-ti) together last…', options: ['Half a beat', '1 beat', '2 beats'], answer: 1 },
    { id: 'q-whole', type: 'choice', q: 'A whole note in 4/4 lasts…', options: ['1 beat', '2 beats', '4 beats'], answer: 2 },
    { id: 'q-24', type: 'choice', q: 'What does 2/4 time mean?', options: ['Two beats in every bar', 'Two bars per minute', 'Half notes only'], answer: 0 }
  ]
};

addLevel({
  n: 1, title: 'Hear It, Find It', tagline: 'Pitch, octaves, the keyboard map, steps, beat and rhythm',
  units: L1_UNITS, cards: L1_CARDS,
  passText: 'You can find any note, step by half and whole steps, keep a steady beat and read basic rhythms.',
  create: {
    params: { blackOnly: true, min: 3, max: 8 },
    prompts: [
      'Make a 4-note motif on black keys that climbs, then falls.',
      'Make a motif that starts and ends on the same note.',
      'Make a motif with one big jump in it.',
      'Make a motif that uses only two different notes.',
      'Make a motif that sounds like a question.',
      'Repeat one note three times, then move. Make that a motif.'
    ]
  },
  ear: {
    title: 'Higher or lower?', sub: 'Two notes. Was the second one higher or lower than the first?',
    run(body, finish) {
      let r = 0, a = 0, b = 0, ok = 0, timer = 0;
      body.innerHTML = `<div class="row">${playBtn('Hear them again')}<div class="progress-dots">${'<span></span>'.repeat(5)}</div></div><div class="choices"><button type="button" class="choice" data-v="1">Higher</button><button type="button" class="choice" data-v="-1">Lower</button></div><p class="fb info" aria-live="polite"></p>`;
      const fbEl = body.querySelector('.fb'), dots = body.querySelectorAll('.progress-dots span'), box = body.querySelector('.choices');
      const play = () => Sound.seq([{ m: a, t: 0, d: 0.6 }, { m: b, t: 0.75, d: 0.6 }]);
      function next() {
        const gap = r < 2 ? randInt(4, 7) : r < 4 ? randInt(2, 3) : 1;
        a = randInt(55, 68); b = a + (Math.random() < 0.5 ? gap : -gap);
        box.querySelectorAll('.choice').forEach(c => { c.className = 'choice'; c.disabled = false; });
        play();
      }
      body.querySelector('[data-act="play"]').onclick = play;
      box.onclick = ev => {
        const c = ev.target.closest('.choice'); if (!c || c.disabled) return;
        const right = Math.sign(b - a) === +c.dataset.v;
        box.querySelectorAll('.choice').forEach(x => { x.disabled = true; });
        c.classList.add(right ? 'right' : 'wrong'); dots[r].classList.add(right ? 'on' : 'miss');
        if (right) ok++;
        fb(fbEl, right ? 'good' : 'bad', `${noteName(a)} → ${noteName(b)}: ${Math.abs(b - a)} half step${Math.abs(b - a) > 1 ? 's' : ''} ${b > a ? 'up' : 'down'}.`);
        r++;
        if (r >= 5) finish(ok, 5); else timer = setTimeout(next, 1300);
      };
      timer = setTimeout(next, 250);
      return () => clearTimeout(timer);
    }
  }
});
