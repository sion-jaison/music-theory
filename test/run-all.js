/* Runs every test file in order and prints a one-line summary per file (full output on failure). */
const { spawnSync } = require('child_process');
const fs = require('fs');
const files = ['theory.test.js', 'pitch.test.js', 'chord.test.js', 'components.js', 'notation.js', 'voices.js', 'toolbox.js', 'songcraft.js', 'portfolio.js', 'smoke.js', 'rhythm.js', 'level2.js', 'level3.js', 'level4.js', 'level5.js', 'level6-rhythm.js', 'level6.js']
  .filter(f => fs.existsSync(__dirname + '/' + f));
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [__dirname + '/' + f], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const passes = (out.match(/^PASS/gm) || []).length, fails = (out.match(/^FAIL/gm) || []).length;
  const ok = r.status === 0 && fails === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${f.padEnd(18)} ${passes} passed${fails ? `, ${fails} failed` : ''}`);
  if (!ok) console.log(out.split('\n').filter(l => !/^PASS/.test(l)).join('\n'));
}
process.exit(failed ? 1 : 0);
