// Prüft das Physik-Labor ohne Browser:  node tools/labor.mjs
//   1. Jeder Regler ist vollständig, sein Standard liegt zwischen kleinstem und größtem Wert und auf dem Raster.
//      Auch jede Zahl der vier Schwierigkeitsstufen lässt sich mit ihrem Regler genau einstellen.
//   2. Stehen alle Regler auf Standard, läuft ein Match haargenau wie vorher (gleicher Zufall → gleiches Ergebnis).
//   3. Jeder Regler tut wirklich etwas (Ball fliegt anders, Beine sind schneller …).
//   4. Auch mit allen Reglern ganz links oder ganz rechts läuft ein Match ohne Fehler bis zum Ende.
//   5. Speichern, Laden, eigene Stufen (mit einem nachgemachten Speicher).
import { REGLER, GRUPPEN, R, standard, setze, pruefe, stufeAus, geaendert, zeige } from '../js/regler.js';
import { Ball, SURFACES, solveShot } from '../js/physics.js';
import { Match } from '../js/match.js';
import { DIFFICULTY, PLAYERS } from '../js/data.js';
import * as LB from '../js/labor.js';

let fehler = 0;
const ok = (gut, text) => { console.log((gut ? '  ✓ ' : '  ✗ ') + text); if (!gut) fehler++; };

// Ein Zufall, der immer dieselben Zahlen liefert – so kann man zwei Matches genau vergleichen
function festerZufall(start) {
  let s = start >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const echterZufall = Math.random;

// Ein Computer-gegen-Computer-Match. Gibt den Spielstand und ein paar Zahlen zurück.
function spiele(werte, saat = 7, stufe = 'mittel') {
  Math.random = festerZufall(saat);
  setze(werte);
  let schlaege = 0, punkte = 0;
  const fx = new Proxy({}, { get: (_, k) => (x) => { if (k === 'point') { schlaege += x.rally; punkte++; } } });
  const m = new Match({ players: [PLAYERS[2], PLAYERS[5]], human: null, surface: 'hard', difficulty: stufe,
    diff: werte ? stufeAus(DIFFICULTY[stufe], werte) : null, sets: 1, games: 3, mode: 'match' }, fx);
  let t = 0;
  while (m.state !== 'over' && m.score.winner === null && t++ < 400000) m.update(1 / 60);
  Math.random = echterZufall;
  standard();
  return { fertig: m.score.winner !== null, stand: JSON.stringify(m.score.stats), rally: schlaege / Math.max(1, punkte), tempo: m.P[0].topSpeed, antritt: m.P[0].accel };
}

// Ein Topspin-Ball von der Grundlinie: Wo landet er, wie hoch springt er, wie schnell ist er danach?
function flug(werte, spin = { top: 2600, seite: 0, drall: 0 }) {
  setze(werte);
  const b = new Ball();
  b.launch({ x: 0, y: 1, z: 11 }, { x: 0, y: 4.5, z: -30 }, spin, 0);
  let landung = null, hoch = 0, danach = 0, seite = 0;
  for (let i = 0; i < 600 && b.bounces < 2; i++) {
    for (const e of b.step(1 / 240, SURFACES.hard)) if (e.type === 'bounce' && !landung) { landung = e.z; seite = e.x; danach = Math.hypot(b.vel.x, b.vel.z); }
    if (landung !== null) hoch = Math.max(hoch, b.pos.y);
  }
  standard();
  return { landung, hoch, danach, seite };
}

console.log('1. Die Regler-Tabelle');
const ids = new Set();
for (const r of REGLER) {
  let gut = !!r.name && !!r.text && !!GRUPPEN[r.gruppe] && !ids.has(r.id);
  ids.add(r.id);
  if (r.art !== 'schalter') {
    gut = gut && r.min < r.max && r.schritt > 0;
    if (!r.stufe) gut = gut && r.std >= r.min && r.std <= r.max && pruefe(r.id, r.std) === r.std;
    else for (const k in DIFFICULTY) gut = gut && pruefe(r.id, DIFFICULTY[k][r.id]) === DIFFICULTY[k][r.id];
  } else if (r.stufe) for (const k in DIFFICULTY) gut = gut && typeof DIFFICULTY[k][r.id] === 'boolean';
  if (!gut) ok(false, `Regler ${r.id} stimmt nicht`);
}
ok(true, `${REGLER.length} Regler in ${Object.keys(GRUPPEN).length} Gruppen geprüft`);
ok(pruefe('tempo', 99) === 1.4 && pruefe('tempo', -3) === 0.7 && pruefe('tempo', 'abc') === null && pruefe('gibtsnicht', 1) === null, 'Werte außerhalb der Grenzen werden zurückgeholt, Unsinn wird abgelehnt');
ok(zeige(REGLER[0], 1.15) === '115 %', 'Anzeige: 1,15 → „115 %“');

console.log('2. Standard = wie ohne Labor');
const a = spiele(null), b = spiele({}), c = spiele({ tempo: 1, drall: 1, aiStat: DIFFICULTY.mittel.aiStat });
ok(a.fertig && a.stand === b.stand && a.stand === c.stand, 'drei Matches mit gleichem Zufall und Standard-Reglern enden haargenau gleich');
ok(Object.keys(geaendert({ tempo: 1, drall: 1, aiStat: 0.86 }, DIFFICULTY.mittel)).length === 0, 'Standardwerte zählen nicht als „verstellt“');

console.log('3. Jeder Regler wirkt');
const f0 = flug({});
ok(flug({ drall: 0 }).landung < f0.landung - 1.5, `ohne Drall-Wirkung fliegt der Topspin-Ball weiter (${(11 - f0.landung).toFixed(1)} m → ${(11 - flug({ drall: 0 }).landung).toFixed(1)} m)`);
ok(flug({ drall: 2 }).landung > f0.landung + 1, 'mit doppelter Drall-Wirkung fällt er früher herunter');
ok(Math.abs(flug({ drall: 1.5 }, { top: 0, seite: 2600, drall: 0 }).seite) > Math.abs(flug({}, { top: 0, seite: 2600, drall: 0 }).seite) * 1.2, 'Seitendrall biegt den Ball mit mehr Drall-Wirkung weiter zur Seite');
ok(flug({ absprung: 1.2 }).hoch > f0.hoch * 1.2 && flug({ absprung: 0.8 }).hoch < f0.hoch * 0.8, `Absprung-Höhe: ${flug({ absprung: 0.8 }).hoch.toFixed(2)} m / ${f0.hoch.toFixed(2)} m / ${flug({ absprung: 1.2 }).hoch.toFixed(2)} m`);
const sl = { top: -2400, seite: 0, drall: 0 };
ok(flug({ griff: 1.5 }, sl).danach < flug({}, sl).danach - 0.5 && flug({ griff: 0.5 }, sl).danach > flug({}, sl).danach + 0.5, 'mehr Griff bremst einen Slice beim Aufprall stärker, weniger Griff lässt ihn durchrutschen');
// Der Schlag-Löser rechnet mit denselben Reglern: Der Ball landet auch mit anderem Drall am Ziel
setze({ drall: 1.7 });
{ const ziel = { x: 2, z: -9 }, sol = solveShot({ x: 0, y: 1, z: 11 }, ziel, 30, 2600), ball = new Ball(); ball.launch({ x: 0, y: 1, z: 11 }, sol.vel, 2600, 0);
  let l = null; for (let i = 0; i < 900 && !l; i++) for (const e of ball.step(1 / 240, SURFACES.hard)) if (e.type === 'bounce' && !l) l = e;
  ok(l && Math.hypot(l.x - ziel.x, l.z - ziel.z) < 0.1, 'mit verstelltem Drall trifft ein gezielter Schlag weiter sein Ziel (unter 10 cm daneben)'); }
standard();
const m0 = spiele({});
ok(Math.abs(spiele({ tempo: 1.2 }).tempo / m0.tempo - 1.2) < 1e-9 && Math.abs(spiele({ beinExtra: 0.8 }).tempo / m0.tempo - 0.8) < 1e-9, 'Tempo und „Nur die Beine“ machen die Spieler schneller und langsamer');
ok(Math.abs(spiele({ antritt: 1.5 }).antritt / m0.antritt - 1.5) < 1e-9, 'Antritt wirkt');
const wirkt = (werte) => spiele(werte).stand !== m0.stand;
for (const [id, w] of [['aufschlag', 0.7], ['ballExtra', 1.3], ['streu', 0.4], ['netzfehler', 2], ['reichweite', 2], ['muede', 3], ['aiStat', 0.7], ['aiSigma', 1.6], ['aiAngriff', 0], ['aiReact', 0.5]])
  ok(wirkt({ [id]: w }), `${REGLER.find((r) => r.id === id).name}: das Match verläuft anders`);
ok(spiele({ streu: 0.3, netzfehler: 0 }).rally > m0.rally * 1.3, `wenig Streuung und kein Netz machen die Ballwechsel länger (${m0.rally.toFixed(1)} → ${spiele({ streu: 0.3, netzfehler: 0 }).rally.toFixed(1)} Schläge)`);

console.log('4. Alle Regler am Anschlag');
const links = {}, rechts = {};
for (const r of REGLER) { links[r.id] = r.art === 'schalter' ? false : r.min; rechts[r.id] = r.art === 'schalter' ? true : r.max; }
for (const st of ['leicht', 'profi']) {
  ok(spiele(links, 3, st).fertig, `alles ganz links (${st}): Match läuft bis zum Ende`);
  ok(spiele(rechts, 3, st).fertig, `alles ganz rechts (${st}): Match läuft bis zum Ende`);
}
ok(R.tempo === 1 && R.drall === 1 && R.reichweite === 1.4, 'danach steht alles wieder auf Standard');

console.log('5. Speichern und eigene Stufen');
const speicher = { d: {}, getItem(k) { return k in this.d ? this.d[k] : null; }, setItem(k, v) { this.d[k] = String(v); } };
let s = LB.laden(DIFFICULTY, speicher);
ok(s.basis === 'mittel' && LB.anzahl(s) === 0 && s.stufen.length === 0, 'leerer Speicher: alles Standard');
LB.stellen(s, 'tempo', 1.15, DIFFICULTY); LB.stellen(s, 'aiStat', 0.9, DIFFICULTY); LB.stellen(s, 'marker', false, DIFFICULTY);
ok(LB.anzahl(s) === 3, 'drei Regler verstellt');
LB.stellen(s, 'tempo', 1, DIFFICULTY);
ok(LB.anzahl(s) === 2, 'zurück auf Standard nimmt den Regler aus der Liste');
LB.basisSetzen(s, 'schwer', DIFFICULTY);
ok(s.werte.aiStat === 0.9 && LB.wert(s, REGLER.find((r) => r.id === 'aiReact'), DIFFICULTY) === 0.22, 'andere Ausgangs-Stufe: eigene Werte bleiben, der Rest kommt von „Schwer“');
const e1 = LB.stufeMerken(s, 'Papa mit Uhr');
LB.stellen(s, 'drall', 1.3, DIFFICULTY);
const e2 = LB.stufeMerken(s, 'papa mit uhr');
ok(e1 && e2 && e1.id === e2.id && s.stufen.length === 1 && s.stufen[0].werte.drall === 1.3, 'gleicher Name überschreibt die alte Stufe');
for (let i = 0; i < 10; i++) LB.stufeMerken(s, 'Stufe ' + i);
ok(s.stufen.length === LB.STUFEN_MAX, `höchstens ${LB.STUFEN_MAX} eigene Stufen`);
LB.sichern(s, speicher);
const s2 = LB.laden(DIFFICULTY, speicher);
const sortiert = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
ok(sortiert(s2) === sortiert(s), 'gespeichert und genauso wieder geladen');
ok(speicher.d['powershot.labor.v1'] !== undefined, 'Speicher-Name fängt mit „powershot.“ an (gehört zum Profil)');
speicher.d['powershot.labor.v1'] = JSON.stringify({ basis: 'gibtsnicht', werte: { tempo: 77, quatsch: 3, drall: 'x' }, stufen: [null, { basis: 'profi', name: '<b>x</b>', werte: { aiStat: 5 } }] });
const s3 = LB.laden(DIFFICULTY, speicher);
ok(s3.basis === 'mittel' && s3.werte.tempo === 1.4 && !('quatsch' in s3.werte) && !('drall' in s3.werte) && s3.stufen.length === 1 && s3.stufen[0].werte.aiStat === 1.05, 'kaputte Daten werden beim Laden aufgeräumt');
ok(!LB.laborHtml(s3, DIFFICULTY, '').includes('<b>x</b>') && LB.laborHtml(s3, DIFFICULTY, '').includes('data-regler="tempo"'), 'die Seite lässt sich bauen, Namen werden entschärft');
LB.stufeHolen(s, e1.id);
ok(s.basis === 'schwer' && s.werte.drall === 1.3, 'eine Stufe zurück auf die Regler legen');
LB.stufeWeg(s, e1.id);
ok(!LB.stufeVon(s, e1.id), 'Stufe löschen');

console.log(fehler ? `\n${fehler} Fehler.` : '\nAlles bestanden.');
process.exit(fehler ? 1 : 0);
