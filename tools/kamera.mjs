// Prüft das Laufen mit der Kamera ohne Kamera: Wir tun so, als stünde jemand im Bild, und schauen,
// wohin der Spieler laufen würde.   Aufruf: node tools/kamera.mjs
import { KameraLauf, messen } from '../js/kamera.js';
import { Match } from '../js/match.js';
import { PLAYERS } from '../js/data.js';

let fehler = 0;
const pruefe = (text, ok, wert) => { if (!ok) fehler++; console.log((ok ? '  ok   ' : '  FALSCH ') + text + (wert !== undefined ? '  →  ' + wert : '')); };

// Baut künstliche Körperpunkte: Körpermitte bei x (0 bis 1 im Bild), "nah" = wie groß die Person erscheint (1 = wie beim Einmessen),
// "dreh" = wie weit sie sich zur Seite gedreht hat (0 = schaut zur Kamera, 1 = ganz seitlich).
function person(x, nah = 1, dreh = 0) {
  const P = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  const breit = 0.09 * nah * (1 - dreh), hoch = 0.2 * nah;      // Schulterbreite und Oberkörper im Bild
  P[11] = { x: x + breit / 2, y: 0.4, visibility: 0.99 }; P[12] = { x: x - breit / 2, y: 0.4, visibility: 0.99 };
  P[23] = { x: x + breit / 3, y: 0.4 + hoch, visibility: 0.99 }; P[24] = { x: x - breit / 3, y: 0.4 + hoch, visibility: 0.99 };
  return P;
}
// Spielt "sek" Sekunden lang dieselbe Haltung vor (30 Bilder pro Sekunde).
let t = 0;
function zeige(lauf, punkte, sek) { for (let i = 0; i < sek * 30; i++) { t += 1 / 30; lauf.update(punkte, 4 / 3, t); } }

console.log('Einmessen');
const lauf = new KameraLauf();
lauf.art = 'voll';
pruefe('ohne Einmessen steuert die Kamera nicht', lauf.ziel(t) === null);
lauf.einmessen();
zeige(lauf, person(0.5), 1.5);
pruefe('nach 1,5 Sekunden ist eingemessen', lauf.bereit);
pruefe('in der Mitte: Spieler in der Platzmitte an der Grundlinie', Math.abs(lauf.ziel(t).x) < 0.05 && lauf.ziel(t).vor === 0, JSON.stringify(lauf.ziel(t)));

console.log('Seitlich (Zimmer „mittel“: 1 Meter gehen = 4 Meter laufen)');
// Der Oberkörper ist im Bild 0,2 Bildhöhen lang und in echt etwa 0,5 m. 1 m nach rechts (von dir aus) = 0,4 Bildhöhen = 0,3 Bildbreiten nach LINKS im Bild.
zeige(lauf, person(0.5 - 0.3), 1);
pruefe('1 m nach rechts gegangen → etwa 4 m rechts', Math.abs(lauf.ziel(t).x - 4) < 0.2, lauf.ziel(t).x.toFixed(2));
zeige(lauf, person(0.5 - 0.3, 1, 0.8), 1);
pruefe('dabei zur Seite gedreht (Schlag) → bleibt bei etwa 4 m', Math.abs(lauf.ziel(t).x - 4) < 0.3, lauf.ziel(t).x.toFixed(2));
zeige(lauf, person(0.5 + 0.15), 1);
pruefe('0,5 m nach links → etwa 2 m links', Math.abs(lauf.ziel(t).x + 2) < 0.2, lauf.ziel(t).x.toFixed(2));
lauf.tauschen = true; zeige(lauf, person(0.5 + 0.15), 1);
pruefe('„Links und rechts tauschen“ dreht die Seite um', lauf.ziel(t).x > 1.8, lauf.ziel(t).x.toFixed(2));
lauf.tauschen = false;
lauf.raum = 'klein'; zeige(lauf, person(0.5 + 0.15), 1);
pruefe('Zimmer „klein“: derselbe Schritt zählt mehr (6-fach)', Math.abs(lauf.ziel(t).x + 3) < 0.3, lauf.ziel(t).x.toFixed(2));
lauf.raum = 'mittel';

console.log('Vor und zurück');
zeige(lauf, person(0.5, 1 / 0.7), 2);       // 30 % näher an der Kamera → erscheint 1/0,7-mal so groß
pruefe('ein großer Schritt nach vorne → am Netz (vor = 1)', lauf.ziel(t).vor > 0.95, lauf.ziel(t).vor.toFixed(2));
zeige(lauf, person(0.5, 1.03), 2);
pruefe('nur ein bisschen gewackelt → bleibt an der Grundlinie (vor = 0)', lauf.ziel(t).vor === 0, lauf.ziel(t).vor);
zeige(lauf, person(0.5, 1 / 1.2), 2);
pruefe('einen Schritt zurück → hinter die Grundlinie (vor < 0)', lauf.ziel(t).vor < -0.4, lauf.ziel(t).vor.toFixed(2));
lauf.art = 'seite'; zeige(lauf, person(0.5, 1.4), 1);
pruefe('„Nur links und rechts“: vor bleibt leer', lauf.ziel(t).vor === null);

console.log('Aus dem Bild gegangen');
zeige(lauf, null, 0.3);
pruefe('kurz weg (0,3 s): Kamera steuert noch', lauf.ziel(t) !== null);
zeige(lauf, null, 1);
pruefe('länger weg: Laufhilfe übernimmt wieder', lauf.ziel(t) === null);
pruefe('messen() ohne Hüfte nimmt nur die Schultern', messen(person(0.5).map((p, i) => (i >= 23 ? { ...p, visibility: 0.1 } : p))).rumpf === 0);

// Jetzt im echten Match: Die "Kamera" sagt 3 m rechts – läuft der Spieler dorthin und trifft er trotzdem Bälle?
console.log('Im Match');
function spiele(kamera, sek) {
  const steuerung = {
    move: () => ({ x: 0, f: 0 }), begin() {}, peek: () => null, takeNetz: () => false,
    // schlägt immer sofort zurück bzw. auf, damit Ballwechsel entstehen
    consume: () => ({ type: 'drive', aimMode: 'abs', aim: 0, depth: 0.7, power: 0.6, committed: true }),
    takeServe: () => ({ type: 'serve', aim: 0, power: 0.6, committed: true }),
    kameraZiel: kamera,
  };
  const m = new Match({ players: [PLAYERS[10], PLAYERS[11]], human: 0, surface: 'hard', difficulty: 'mittel', sets: 1, games: 6, mode: 'match', assist: 'voll', controlMode: 'profi' }, undefined, steuerung);
  let sumX = 0, sumZ = 0, n = 0, schlaege = 0, letzter = null;
  for (let i = 0; i < sek * 60 && m.state !== 'over'; i++) {
    m.update(1 / 60);
    if (m.state === 'rally') {
      sumX += m.P[0].x; sumZ += m.P[0].z; n++;
      if (m.ball.lastHitter !== letzter) { if (m.ball.lastHitter === 0 && !m.ball.isServe) schlaege++; letzter = m.ball.lastHitter; }
    }
  }
  return { x: sumX / n, z: sumZ / n, schlaege };
}
const ohne = spiele(() => null, 240);
const rechts = spiele(() => ({ x: 3, vor: null }), 240);
const netz = spiele(() => ({ x: 0, vor: 1 }), 240);
pruefe('ohne Kamera steht der Spieler im Schnitt etwa in der Mitte', Math.abs(ohne.x) < 1.5, `x = ${ohne.x.toFixed(2)} m, z = ${ohne.z.toFixed(2)} m, ${ohne.schlaege} Schläge`);
pruefe('Kamera sagt „3 m rechts“ → Spieler steht im Schnitt deutlich rechts', rechts.x > 1.5, `x = ${rechts.x.toFixed(2)} m, ${rechts.schlaege} Schläge`);
pruefe('… und trifft trotzdem noch Bälle (Hilfe für den letzten Schritt)', rechts.schlaege > 3, rechts.schlaege);
pruefe('Kamera sagt „am Netz“ → Spieler steht im Schnitt viel weiter vorne', netz.z < ohne.z - 3, `z = ${netz.z.toFixed(2)} m statt ${ohne.z.toFixed(2)} m`);

console.log(fehler ? `\n${fehler} Prüfung(en) falsch!` : '\nAlles in Ordnung.');
process.exit(fehler ? 1 : 0);
