// Zeigt für jede Schlagart und jeden Aufschlag, wie der Ball fliegt und abspringt – ohne Grafik.
//   node tools/ballflug.mjs            (Hartplatz)
//   node tools/ballflug.mjs clay       (Sand; auch: grass, indoor)
// Am Ende prüft das Programm ein paar Tennis-Regeln ("Topspin springt höher als Slice" usw.).
import { COURT as C, SURFACES, Ball, solveSafe, solveBogen } from '../js/physics.js';
import { SCHLAEGE, AUFSCHLAEGE } from '../js/schlaege.js';

const boden = SURFACES[process.argv[2]] ? process.argv[2] : 'hard';
const surface = SURFACES[boden];
const KRAFT = 0.75, STAERKE = 0.7;        // Schlagkraft (0–1) und Kraft-Wert des Spielers (0–1)

// Schickt einen Ball los und misst alles Wichtige
function messen(from, target, vh, spin, netz, bogen) {
  const sol = bogen ? solveBogen(from, target, spin, bogen) : solveSafe(from, target, vh, spin, netz);
  const b = new Ball();
  b.launch(from, sol.vel, spin, 0);
  const m = { start: Math.hypot(sol.vel.x, sol.vel.y, sol.vel.z) * 3.6, netz: sol.clearance, gipfel: from.y, kurve: 0 };
  let t = 0, auf = null, gipfel2 = 0;
  const dx = target.x - from.x, dz = target.z - from.z, D = Math.hypot(dx, dz);
  while (t < 8 && b.live) {
    const ev = b.step(1 / 240, surface); t += 1 / 240;
    if (!auf) {
      m.gipfel = Math.max(m.gipfel, b.pos.y);
      // Abstand von der geraden Linie Start → Ziel (+ = rechts): so stark ist die Kurve in der Luft
      const q = ((b.pos.x - from.x) * -dz + (b.pos.z - from.z) * dx) / D;
      if (Math.abs(q) > Math.abs(m.kurve)) m.kurve = -q;
    } else gipfel2 = Math.max(gipfel2, b.pos.y);
    for (const e of ev) {
      if (e.type !== 'bounce') continue;
      if (e.n === 1) {
        auf = { x: e.x, z: e.z, t };
        m.landung = Math.hypot(e.x - target.x, e.z - target.z);
        m.tempoNach = Math.hypot(b.vel.x, b.vel.z) * 3.6;
        m.tempoVor = e.speed * 3.6;
        // Richtung nach dem Aufprall im Vergleich zur Richtung Start → Ziel (+ = nach rechts weggesprungen)
        m.weg = Math.atan2(b.vel.x * -dz + b.vel.z * dx, b.vel.x * dx + b.vel.z * dz) * 180 / Math.PI;
        m.vor = (b.vel.x * dx + b.vel.z * dz) / D * 3.6;       // negativ = Ball springt zurück
      } else if (e.n === 2 && m.weite === undefined) {
        m.weite = Math.hypot(e.x - auf.x, e.z - auf.z);
      }
    }
    if (b.bounces >= 2) break;
  }
  m.sprung = gipfel2;
  m.zeit = auf ? auf.t : 0;
  return m;
}

const f = (v, n = 1, w = 7) => (v === undefined || Number.isNaN(v) ? '–' : v.toFixed(n)).padStart(w);
const kopf = 'Schlag            Start  über    Gipfel  Kurve  Aufprall  danach  Sprung-  springt  2. Aufprall\n'
           + '                  km/h   Netz m  m       m      km/h      km/h    höhe m   weg °    nach m';
const zeile = (name, m) => `${name.padEnd(16)}${f(m.start, 0, 6)} ${f(m.netz, 2)} ${f(m.gipfel, 2)} ${f(m.kurve, 2)} ${f(m.tempoVor, 0, 8)} ${f(m.tempoNach, 0, 8)} ${f(m.sprung, 2, 8)} ${f(m.weg, 1, 8)} ${f(m.weite, 1, 9)}`;

console.log(`Boden: ${boden}\n\nGrundlinienschläge (von 1 m hinter der Grundlinie, Treffpunkt 0,95 m)\n${kopf}`);
const R = {};
for (const [art, S] of Object.entries(SCHLAEGE)) {
  const tp = S.tempo || [12, 12], nz = Array.isArray(S.netz) ? S.netz : [S.netz, S.netz];
  const vh = (tp[0] + (tp[1] - tp[0]) * STAERKE) * (1 - (S.kraft || 0) + (S.kraft || 0) * KRAFT);
  let from = { x: 0, y: 0.95, z: C.L + 1 }, d = C.L * 0.8;
  if (art === 'drop') d = 2.5;
  if (art === 'volley') from = { x: 0, y: 1.2, z: 3 };
  if (art === 'smash') from = { x: 0, y: 2.5, z: 5 };
  R[art] = messen(from, { x: 0, y: 0, z: -d }, vh, { top: S.top }, nz[0] + (nz[1] - nz[0]) * KRAFT, S.bogen);
  console.log(zeile(S.name, R[art]));
}

console.log(`\nAufschläge eines Rechtshänders (von rechts ins linke Aufschlagfeld, Ziel Mitte des Feldes)\n${kopf}`);
for (const [art, S] of Object.entries(AUFSCHLAEGE)) {
  const vh = S.bogen ? 12 : (35 + 23 * STAERKE) * (0.72 + 0.28 * 0.9) * S.tempo;
  const from = { x: 1.1, y: S.hoehe || 2.75, z: C.L + 0.05 };
  const d = S.tiefe ? (S.tiefe[0] + S.tiefe[1]) / 2 : C.SL - 0.8;
  R['a_' + art] = messen(from, { x: -C.W / 2, y: 0, z: -d }, vh, { top: S.top, seite: S.seite, drall: S.drall }, S.netz, S.bogen);
  console.log(zeile(S.name, R['a_' + art]));
}

// --- Stimmt das mit echtem Tennis überein? ---
console.log('\nPrüfung:');
let fehler = 0;
const pruefe = (text, ok) => { console.log((ok ? '  ✓ ' : '  ✗ ') + text); if (!ok) fehler++; };
pruefe('Alle Schläge landen höchstens 15 cm neben dem Ziel', Object.values(R).every((m) => m.landung < 0.15));
pruefe('Hoher Topspin springt höher als normaler Topspin, der höher als der gerade Schuss', R.topspin.sprung > R.drive.sprung && R.drive.sprung > R.flach.sprung);
pruefe('Slice springt flacher als Topspin', R.slice.sprung < R.drive.sprung);
pruefe('Hoher Topspin geht höher über das Netz als der gerade Schuss', R.topspin.netz > R.flach.netz + 0.3);
// Auf Rasen ist der Boden so rutschig, dass der Slice fast ungebremst durchrutscht – deshalb gilt die Regel dort nicht.
if (boden !== 'grass') pruefe('Slice verliert beim Aufprall mehr Tempo als Topspin', R.slice.tempoNach / R.slice.tempoVor < R.drive.tempoNach / R.drive.tempoVor);
pruefe('Stoppball kommt nach dem Aufprall weniger als 4 m weit (ein Topspin über 9 m)', R.drop.weite < 4 && R.drive.weite > 9);
pruefe('Lob steigt über 4 m', R.lob.gipfel > 4);
pruefe('Gerader Aufschlag ist der schnellste, Kick der langsamste von oben', R.a_gerade.start > R.a_slice.start && R.a_slice.start > R.a_kick.start);
pruefe('Slice-Aufschlag fliegt eine Kurve nach links (Bauch der Kurve über 15 cm, viel mehr als beim geraden)', R.a_slice.kurve < -0.15 && R.a_slice.kurve < 3 * R.a_gerade.kurve);
pruefe('Kick springt am höchsten und nach rechts weg', R.a_kick.sprung > R.a_gerade.sprung && R.a_kick.sprung > R.a_slice.sprung && R.a_kick.weg > 4);
pruefe('Kick geht höher über das Netz als der gerade Aufschlag', R.a_kick.netz > R.a_gerade.netz + 0.15);
pruefe('Aufschlag von unten ist langsam (unter 75 km/h) und kommt nach dem Aufprall keine 4 m weit', R.a_unten.start < 75 && R.a_unten.weite < 4);
console.log(fehler ? `\n${fehler} Prüfung(en) nicht bestanden.` : '\nAlles bestanden.');
process.exit(fehler ? 1 : 0);
