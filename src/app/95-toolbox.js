/* =================================================================
   Toolbox (filled in below)
   ================================================================= */
function renderToolbox() {
  view.innerHTML = '<section class="panel"><h2>Toolbox</h2><div class="art">' +
    Staff.svg({ clef: 'treble', notes: ['C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C6', ['C4', 'E4', 'G4'], 'F♯4', 'B♭4'], labels: ['C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C6', 'C', 'F♯', 'B♭'] }) +
    Staff.svg({ clef: 'bass', notes: ['G2', 'B2', 'D3', 'F3', 'A3', 'C4', 'E2', 'C2'], keySig: 3, time: [3, 4] }) +
    Staff.svg({ clef: 'grand', notes: ['C4', 'G4', 'E3', 'C3', 'A5', 'F2'], keySig: -4, filled: true }) +
    Staff.svg({ clef: 'treble', notes: [], keySig: 7 }) + Staff.svg({ clef: 'treble', notes: [], keySig: -7 }) +
    '</div><div class="art" style="max-width:420px">' + Circle.svg({ selected: 1, family: true }) + '</div></section>';
}
