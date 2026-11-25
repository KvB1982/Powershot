// Match-Rekorder: Aufnahmen auswerten (js/rekorder.js, js/rekorderauswertung.js).
//
//   node tools/rekorder.mjs                         Probe: künstliche Spieler spielen auf Leicht, Mittel, Schwer, der Rekorder läuft mit.
//                                                   Geprüft wird, ob die Aufnahme zum Match passt (Punkte, Schläge, Ballflug zum Abspielen).
//                                                   Die Aufnahmen landen in aufnahmen/rekorder-probe.json.
//   node tools/rekorder.mjs probe 6                 dasselbe mit 6 Matches je Zeile
//   node tools/rekorder.mjs datei.json [mehr.json]  Aufnahmen aus dem Spiel auswerten (Hauptmenü → Einstellungen → Match-Rekorder → „Als Datei sichern“)
//   node tools/rekorder.mjs datei.json liste        alle Aufnahmen und Punkte der Datei auflisten
//   node tools/rekorder.mjs datei.json punkt 2.14   Aufnahme 2, Punkt 14 Schlag für Schlag, dazu ein Bild von oben (tools/rekorder.svg)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Match } from '../js/match.js';
import { PLAYERS } from '../js/data.js';
import { Ball, SURFACES, COURT as C } from '../js/physics.js';
import { Rekorder, kurzName, spurBei } from '../js/rekorder.js';
import { auswerten, bericht, schlagText, endeText } from '../js/rekorderauswertung.js';
import { Wiedergabe } from '../js/wiedergabe.js';
const { schwungHaerte, schwungRichtung } = await import('../js/controls.js');

const hier = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

// Eine Datei kann eine einzelne Aufnahme sein, eine Liste oder das Paket aus dem Spiel ({ aufnahmen: [...] })
function lesen(datei) {
  const d = JSON.parse(fs.readFileSync(datei, 'utf8'));
  const l = Array.isArray(d) ? d : d.aufnahmen ? d.aufnahmen : [d];
  return l.filter((a) => a && a.kopf && Array.isArray(a.punkte));
}

// ---------------------------------------------------------------
// Probe: künstliche Spieler (dieselben wie in tools/kind.mjs)
// ---------------------------------------------------------------
const zufall = () => { let s = 0; for (let i = 0; i < 4; i++) s += Math.random(); return (s - 2) * 1.2; };
function steuerung(art, match) {
  return {
    begin() {}, peek() { return null; }, move() { return { x: 0, f: 0 }; }, takeNetz() { return null; },
    takeServe() { return art === 'uhr' ? { power: Math.min(1.05, schwungHaerte(0.25 + 0.4 * Math.random()) + 0.1), aim: 0 } : { power: 0.6, aim: 0 }; },
    consume() {
      if (art === 'nix') return null;
      if (art === 'uhr') {
        if (Math.random() < 1 / 12) return null;
        const haerte = schwungHaerte(0.2 + 0.5 * Math.random());
        const lr = Math.max(-1, Math.min(1, zufall() * 0.55));
        return { type: 'drive', aimMode: 'abs', aim: schwungRichtung(lr) * 0.88, depth: 0.78 + 0.08 * Math.max(0, Math.min(1, (haerte - 0.5) * 2)), power: haerte, schwung: true };
      }
      if (art === 'drueckt') return { type: 'drive', aimMode: 'abs', aim: 0, power: 0.45 };
      const gegner = match().P[1];
      return { type: 'drive', aimMode: 'abs', aim: gegner.x >= 0 ? -0.75 : 0.75, power: 0.75 };
    },
  };
}

// Passt die Aufnahme zum Match? Und fliegt der Ball beim Nachrechnen dorthin, wo er im Match gelandet ist?
function pruefen(a, m) {
  const fehler = [];
  const pts = [0, 0];
  let schlaege = 0;
  for (const P of a.punkte) {
    if (!P.ende) { fehler.push(`Punkt ${P.nr} hat kein Ende`); continue; }
    if (P.ende.sieger != null) pts[P.ende.sieger]++;
    schlaege += P.ende.schlaege;
    if (P.spur.length % 5) fehler.push(`Punkt ${P.nr}: Spur hat eine krumme Länge`);
    if (!spurBei(P, P.t0)) fehler.push(`Punkt ${P.nr}: keine Spur`);
    let vorher = P.t0;
    for (const e of P.e) { if (e.t < vorher - 1e-6) fehler.push(`Punkt ${P.nr}: Zeiten laufen rückwärts`); vorher = e.t; }
  }
  const st = m.score.stats;
  if (pts[0] !== st[0].points || pts[1] !== st[1].points) fehler.push(`Punkte ${pts} passen nicht zum Match ${[st[0].points, st[1].points]}`);
  if (a.ergebnis.sieger !== m.score.winner) fehler.push('Sieger passt nicht');
  // Ballflug nachrechnen (so macht es auch die Wiedergabe): Aus Ort, Tempo und Drall beim Schlag muss derselbe Aufprall herauskommen.
  let weit = 0, n = 0;
  const flaeche = SURFACES[a.kopf.belag] || SURFACES.hard;
  for (const P of a.punkte) for (const [i, e] of P.e.entries()) {
    if (e.a !== 'schlag' || !e.landet || e.insNetz) continue;
    // Bälle an die Netzkante zählen nicht: Da entscheidet ein Zentimeter, wohin der Ball fällt.
    let kante = false;
    for (let j = i + 1; j < P.e.length && P.e[j].a !== 'schlag'; j++) if (P.e[j].a === 'netz') kante = true;
    if (kante) continue;
    const b = new Ball();
    b.launch({ x: e.von[0], y: e.von[1], z: e.von[2] }, { x: e.vel[0], y: e.vel[1], z: e.vel[2] }, { top: e.spin[0], seite: e.spin[1], drall: e.spin[2] }, e.s, !!e.auf);
    let auf = null;
    for (let i = 0; i < 1200 && !auf; i++) for (const ev of b.step(1 / 60, flaeche)) { if (ev.type === 'cord' || ev.type === 'net') kante = true; if (ev.type === 'bounce') { auf = ev; break; } }
    if (kante) continue;
    if (!auf) { fehler.push(`Punkt ${P.nr}: Ball kommt beim Nachrechnen nicht auf`); continue; }
    weit = Math.max(weit, Math.hypot(auf.x - e.landet[0], auf.z - e.landet[1])); n++;
  }
  if (weit > 0.25) fehler.push(`Ballflug weicht beim Nachrechnen bis ${weit.toFixed(2)} m ab`);
  // Abspielen (js/wiedergabe.js): Die Wiedergabe muss bis zum Ende laufen und beim selben Spielstand ankommen.
  // Dabei wird mitgezählt, was sie der Grafik meldet, und wie weit der Ball beim Schlag vom Schläger weg ist.
  // Späte Schläge (Uhr, Wischen) zählen dabei nicht: Dort springt der Ball auch im echten Match ein Stück zurück.
  const gemeldet = {}; let ende = null, luecke = 0;
  const w = new Wiedergabe(a, new Proxy({}, { get: (_, k) => (x) => { gemeldet[k] = (gemeldet[k] || 0) + 1; if (k === 'matchOver') ende = x; } }));
  const alt = w.ereignis.bind(w);
  w.ereignis = (P, e) => {
    if (e.a === 'schlag' && !e.auf && !e.spaet && w.ball.live) luecke = Math.max(luecke, Math.hypot(w.ball.pos.x - e.von[0], w.ball.pos.y - e.von[1], w.ball.pos.z - e.von[2]));
    alt(P, e);
  };
  let bilder = 0; while (w.state !== 'over' && bilder++ < 2000000) w.update(1 / 60);
  if (w.state !== 'over') fehler.push('Wiedergabe kommt nicht zum Ende');
  else if (!ende) fehler.push('Wiedergabe meldet kein Match-Ende');
  else {
    if (JSON.stringify(ende.sets) !== JSON.stringify(m.score.sets) || ende.winner !== m.score.winner) fehler.push(`Wiedergabe endet bei ${JSON.stringify(ende.sets)}, das Match bei ${JSON.stringify(m.score.sets)}`);
    for (const k of ['points', 'aces', 'winners', 'errors', 'doubleFaults', 'firstIn', 'firstTotal']) for (const i of [0, 1]) if (ende.stats[i][k] !== st[i][k]) fehler.push(`Wiedergabe zählt ${k} anders (${ende.stats[i][k]} statt ${st[i][k]})`);
  }
  if ((gemeldet.hit || 0) !== schlaege) fehler.push(`Wiedergabe zeigt ${gemeldet.hit} Schläge, aufgenommen sind ${schlaege}`);
  if (luecke > 1.2) fehler.push(`Wiedergabe: Ball ist beim Schlag bis ${luecke.toFixed(2)} m vom aufgenommenen Treffpunkt weg`);
  pruefen.luecke = Math.max(pruefen.luecke || 0, luecke);
  return { fehler, schlaege, weit, n };
}

function probe(N) {
  const ich = PLAYERS[0];
  const alle = [];
  let fehler = 0, weit = 0, schlaege = 0;
  const t0 = Date.now();
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    for (const art of ['nix', 'drueckt', 'zielt', 'uhr']) {
      for (let k = 0; k < N; k++) {
        let m;
        const gegner = PLAYERS[1 + (k * 3) % 19];
        const rek = new Rekorder({ titel: 'Probe', steuerung: 'künstlich: ' + art });
        m = new Match({ players: [ich, gegner], human: 0, surface: ['hard', 'clay', 'grass'][k % 3], difficulty: diff, sets: 1, games: 3, mode: 'match', assist: 'voll', controlMode: art === 'uhr' ? 'controller' : 'klassik', changeover: false, rekorder: rek },
          undefined, steuerung(art, () => m));
        let t = 0; while (m.state !== 'over' && t++ < 600000) m.update(1 / 60);
        const a = JSON.parse(JSON.stringify(rek.daten()));      // einmal durch JSON, wie beim Speichern
        const p = pruefen(a, m);
        for (const f of p.fehler) { console.log(`FEHLER ${diff} ${art} Match ${k + 1}: ${f}`); fehler++; }
        weit = Math.max(weit, p.weit); schlaege += p.schlaege;
        alle.push(a);
      }
    }
  }
  // Ohne Rekorder darf sich nichts ändern: Ein Match ohne ihn muss genauso laufen (hier nur: es läuft und hat keinen Rekorder).
  const ohne = new Match({ players: [ich, PLAYERS[3]], human: null, surface: 'hard', difficulty: 'mittel', sets: 1, games: 2, mode: 'match' });
  let t = 0; while (ohne.state !== 'over' && t++ < 600000) ohne.update(1 / 60);
  if (ohne.rek !== null) { console.log('FEHLER: Match ohne Rekorder hat einen Rekorder'); fehler++; }
  const ordner = path.join(hier, '..', 'aufnahmen');
  fs.mkdirSync(ordner, { recursive: true });
  const ziel = path.join(ordner, 'rekorder-probe.json');
  const text = JSON.stringify({ powershotAufnahmen: 1, aufnahmen: alle });
  fs.writeFileSync(ziel, text);
  console.log(bericht(auswerten(alle)).join('\n'));
  console.log(`${alle.length} Matches aufgenommen (${schlaege} Schläge, ${Math.round(text.length / 1024)} KB, im Schnitt ${Math.round(text.length / 1024 / alle.length)} KB je Match) in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${path.relative(process.cwd(), ziel)}`);
  console.log(`Ballflug beim Nachrechnen: höchstens ${(weit * 100).toFixed(0)} cm neben dem Aufprall im Match.`);
  console.log(`Wiedergabe: jede Aufnahme bis zum Ende abgespielt, Ball beim Schlag höchstens ${(100 * (pruefen.luecke || 0)).toFixed(0)} cm vom aufgenommenen Treffpunkt entfernt.`);
  console.log(fehler ? `\n${fehler} FEHLER` : '\nAlles in Ordnung: Jede Aufnahme passt zu ihrem Match.');
  process.exit(fehler ? 1 : 0);
}

// ---------------------------------------------------------------
// Einen Punkt ansehen: Text und ein Bild von oben
// ---------------------------------------------------------------
function punktZeigen(aufnahmen, wahl) {
  const [an, pn] = wahl.split('.').map(Number);
  const a = aufnahmen[(pn ? an : 1) - 1], P = a && a.punkte[(pn || an) - 1];
  if (!P) { console.log('Diesen Punkt gibt es nicht. Mit „liste“ siehst du alle.'); process.exit(1); }
  const namen = a.kopf.spieler.map((s) => s.kurz || s.name);
  console.log(`${kurzName(a)} · ${a.kopf.steuerung} · Stufe ${a.kopf.stufe}`);
  console.log(`Punkt ${P.nr}${P.stand ? ` beim Stand ${P.stand.spiele.join(':')} / ${P.stand.punkte.join(':')}` : ''}, Aufschlag ${namen[P.auf]}${P.wichtig ? ' – wichtiger Punkt' : ''}`);
  for (const e of P.e) { const s = schlagText(e, namen); if (s) console.log(`  ${(e.t - P.t0).toFixed(2).padStart(6)} s  ${s}`); }
  console.log('  ' + endeText(P.ende, namen));
  // Bild: Platz von oben, Ballflug je Schlag (blau = du, rot = Gegner), Kreuze = Aufprall, Linien = Laufwege
  const M = 22, X = (x) => (x + 9) * M, Z = (z) => (z + 19) * M;
  const L = [];
  const linie = (x1, z1, x2, z2, f = '#fff', w = 2) => L.push(`<line x1="${X(x1)}" y1="${Z(z1)}" x2="${X(x2)}" y2="${Z(z2)}" stroke="${f}" stroke-width="${w}"/>`);
  L.push(`<rect width="${18 * M}" height="${38 * M}" fill="#2d5f8a"/><rect x="${X(-5.485)}" y="${Z(-C.L)}" width="${10.97 * M}" height="${2 * C.L * M}" fill="#3a7a52" stroke="#fff" stroke-width="2"/>`);
  linie(-C.W, -C.L, -C.W, C.L); linie(C.W, -C.L, C.W, C.L); linie(-C.W, -C.SL, C.W, -C.SL); linie(-C.W, C.SL, C.W, C.SL); linie(0, -C.SL, 0, C.SL);
  linie(-6, 0, 6, 0, '#ddd', 3);
  const S = P.spur;
  for (const [i, f] of [[1, '#9cd0ff'], [3, '#ffb0a0']]) {
    const pts = []; for (let k = 0; k < S.length; k += 5) pts.push(`${X(S[k + i] / 100)},${Z(S[k + i + 1] / 100)}`);
    L.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${f}" stroke-width="2" stroke-dasharray="4 3"/>`);
  }
  let nr = 0;
  for (const e of P.e) {
    if (e.a === 'schlag') {
      nr++;
      const f = e.s === 0 ? '#4aa8ff' : '#ff6a4a';
      if (e.landet) linie(e.von[0], e.von[2], e.landet[0], e.landet[1], f, 2);
      L.push(`<circle cx="${X(e.von[0])}" cy="${Z(e.von[2])}" r="9" fill="${f}"/><text x="${X(e.von[0])}" y="${Z(e.von[2]) + 4}" font-size="11" text-anchor="middle" fill="#000" font-family="sans-serif">${nr}</text>`);
    } else if (e.a === 'aufprall' && e.n === 1) {
      L.push(`<text x="${X(e.x)}" y="${Z(e.z) + 5}" font-size="16" text-anchor="middle" fill="${e.drin ? '#fff36a' : '#ff3030'}" font-family="sans-serif">✕</text>`);
    } else if (e.a === 'verpasst') {
      L.push(`<circle cx="${X(e.ball[0])}" cy="${Z(e.ball[2])}" r="12" fill="none" stroke="#ff30ff" stroke-width="3"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${18 * M}" height="${38 * M}">${L.join('')}</svg>`;
  fs.writeFileSync(path.join(hier, 'rekorder.svg'), svg);
  console.log('\nBild: tools/rekorder.svg (du spielst unten; blau = deine Schläge, rot = Gegner, ✕ = Aufprall, lila Kreis = verpasst, gestrichelt = Laufwege)');
}

// ---------------------------------------------------------------
if (!args.length || args[0] === 'probe') probe(+args[1] || 2);
else {
  const dateien = [], rest = [];
  for (const a of args) (a.endsWith('.json') ? dateien : rest).push(a);
  const aufnahmen = dateien.flatMap(lesen);
  if (rest[0] === 'punkt') punktZeigen(aufnahmen, rest[1] || '1.1');
  else if (rest[0] === 'liste') {
    aufnahmen.forEach((a, i) => {
      console.log(`${i + 1}  ${a.kopf.wann.slice(0, 16).replace('T', ' ')}  ${kurzName(a)} · ${a.kopf.steuerung} · ${a.kopf.stufe} · ${a.kopf.modus} · ${a.punkte.length} Punkte`);
      for (const P of a.punkte) console.log(`     ${String(P.nr).padStart(3)}  ${endeText(P.ende, a.kopf.spieler.map((s) => s.kurz || s.name))}`);
    });
  } else {
    console.log(`${aufnahmen.length} Aufnahmen aus ${dateien.length} Datei(en)\n`);
    console.log(bericht(auswerten(aufnahmen)).join('\n'));
  }
}
