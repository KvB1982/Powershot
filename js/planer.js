// Powershot – Saison-Planer: dein eigener Turnierplan für das Jahr.
//
// Echte Profis planen ihr Jahr lange im Voraus: Wo spiele ich? Wann mache ich Pause? Reicht das Geld für die Flüge?
// Hier kannst du das auch: Für jede Woche trägst du ein, was du vorhast. Der Planer rechnet aus,
//   - was jeder Monat kostet (Flüge, Hotel, Essen, Team),
//   - was sicher hereinkommt (Sponsoren, Tennisstunden, und das Preisgeld, das es sogar bei einer Niederlage in Runde 1 gibt),
//   - wie dein Kontostand im schlimmsten Fall aussieht – und ob dir irgendwann das Geld ausgeht,
//   - welche Ausrüstung du für den Plan noch brauchst (Sandplatz-Schuhe, Rasen-Schuhe, Weiß für Wimbledon).
// Der Plan ist nur ein Plan: Jede Woche entscheidest du in der Übersicht neu. Der Planer hilft dir beim Vorausdenken.
//
// Diese Datei rechnet nur (kein three.js). Alle Geldbeträge kommen aus career.js und sind dort geschätzt.

import { tournamentById } from './data.js';
import { KLEINE_TURNIERE, LIGA, STUNDEN_GELD } from './kleinetour.js';
import { WOCHEN, WOCHEN_PRO_JAHR, monatVon, phaseVon } from './kalender.js';
import { SHOP } from './ausruestung.js';
import { SERIE_LANG } from './ausbau.js';
import {
  myRank, zugang, reiseKosten, sponsorGeld, lohn, fehltFuer, erdteil, heimat, istPflicht, saveCareer, hat,
} from './career.js';

// Was man außer Turnieren in einer Woche tun kann
export const FREI = {
  stunden: { name: 'Tennisstunden geben', bild: '🧑‍🏫' },
  pause: { name: 'Pause', bild: '😴' },
  vorbereitung: { name: 'Saisonvorbereitung', bild: '🏋️' },
};

// Die drei Trainer-Typen für den automatischen Plan. pauseNach = nach so vielen Turnierwochen kommt eine Pause.
export const AUTO = {
  ruhig: { name: 'Vorsichtig', bild: '🐢', pauseNach: 2, text: 'Viele Pausen, wenig Risiko. Gut für Körper und Geldbeutel – aber langsam.' },
  mittel: { name: 'Ausgewogen', bild: '⚖️', pauseNach: 3, text: 'Drei Turniere, dann eine Pause. So planen die meisten Profis.' },
  voll: { name: 'Voll auf Angriff', bild: '🚀', pauseNach: 5, text: 'Fast jede Woche ein Turnier. Viele Punkte möglich – aber teuer und gefährlich für den Körper.' },
};

const kleinstes = (geld) => Math.min(...Object.values(geld));

// Was hast du für diese Woche geplant? (Kürzel eines Turniers, 'liga', 'stunden', 'pause', 'vorbereitung' – oder null)
export const wahlVon = (c, woche) => (c.plan && c.plan.wochen[woche]) || null;
export const defVon = (wahl) => (wahl && !FREI[wahl] ? tournamentById(wahl) : null);

// Alle Möglichkeiten einer Woche: [{ id, def, zugang }] für Turniere (das kleinste zuerst), dazu Liga und die freien Wochen
export function optionen(c, woche, platz = myRank(c)) {
  const W = WOCHEN[woche], out = [];
  const kleine = KLEINE_TURNIERE.filter((t) => t.woche === woche).sort((a, b) => a.points.W - b.points.W);
  for (const def of [...kleine, ...(W.gross ? [tournamentById(W.gross)] : [])]) out.push({ id: def.id, def, zugang: zugang(c, def, platz) });
  out.push({ id: LIGA.id, def: LIGA, zugang: { ok: true } }, { id: 'stunden' }, { id: 'pause' });
  if (W.off) out.push({ id: 'vorbereitung' });
  return out;
}

// Etwas in den Plan eintragen (wahl = null: Woche wieder freigeben)
export function setzen(c, woche, wahl) {
  if (wahl) c.plan.wochen[woche] = wahl; else delete c.plan.wochen[woche];
  saveCareer(c);
}
export function leeren(c) { c.plan.wochen = {}; saveCareer(c); }

// Das günstigste Teil aus dem Shop, das fehlt: passende Schuhe für einen Belag oder ein weißes Outfit
function guenstig(c, was, belag) {
  const liste = was === 'weiss' ? SHOP.filter((s) => s.cat === 'Outfit' && s.weiss && !s.nur && !s.verdient)
    : SHOP.filter((s) => s.cat === 'Schuhe' && s.tempo[belag] >= 2);
  return liste.filter((s) => !hat(c, s)).sort((a, b) => a.price - b.price)[0] || null;
}

// Den ganzen Plan durchrechnen – ab dieser Woche bis zum Jahresende.
// Zurück kommt { wochen, monate, hinweise, braucht, note, … } (siehe unten).
export function vorschau(c) {
  const platz = myRank(c), sp = sponsorGeld(c).summe, team = lohn(c), zuhause = heimat(c);
  let ort = c.ort, konto = c.money, serie = c.serie || 0, laengste = serie, fluege = 0, flugGeld = 0, maxPunkte = 0;
  const wochen = [], braucht = [], gekauft = new Set(), erdteile = new Set();
  const vorjahr = {};
  for (const e of c.erg.me) if (e.p > 0 && e.a >= (c.season - 1) * WOCHEN_PRO_JAHR && e.a < c.season * WOCHEN_PRO_JAHR) vorjahr[e.a % WOCHEN_PRO_JAHR] = (vorjahr[e.a % WOCHEN_PRO_JAHR] || 0) + e.p;

  for (let w = c.week; w < WOCHEN_PRO_JAHR; w++) {
    const W = WOCHEN[w], wahl = wahlVon(c, w), def = defVon(wahl);
    const z = { nr: w, wahl, def, monat: monatVon(c.season, w), kosten: team, sicher: 0, sachen: [], verteidigen: vorjahr[w] || 0 };
    if (def) {
      const rk = reiseKosten({ ...c, ort }, def);
      z.kosten += rk.summe; z.flug = rk.flug;
      if (rk.flug) { fluege++; flugGeld += rk.flug; }
      z.sicher += kleinstes(def.money) + (def.cat === 'LIGA' ? 0 : sp);
      z.zugang = zugang(c, def, platz);
      ort = erdteil(c, def);
      erdteile.add(ort);
      maxPunkte += def.cat === 'LIGA' ? 0 : def.points.W;
      // Fehlt Ausrüstung? Dann wird sie im Plan in dieser Woche gekauft (das günstigste passende Teil).
      for (const f of fehltFuer(c, def)) {
        const key = f.was === 'weiss' ? 'weiss' : def.surface;
        if (gekauft.has(key)) continue;
        gekauft.add(key);
        const teil = guenstig(c, f.was, def.surface);
        z.sachen.push(f.text);
        braucht.push({ was: f.was, belag: def.surface, text: f.text, woche: w, fuer: def.name, teil, preis: teil ? teil.price : 0 });
        z.kosten += teil ? teil.price : 0;
      }
      serie++;
    } else {
      if (wahl === 'stunden') z.sicher += STUNDEN_GELD;
      ort = zuhause;
      serie = 0;
    }
    laengste = Math.max(laengste, serie);
    z.serie = serie;
    // Pflichtturnier in dieser Woche, bei dem du mitspielen dürftest, aber etwas anderes geplant hast?
    const gross = W.gross ? tournamentById(W.gross) : null;
    z.pflichtAus = !!(gross && istPflicht(gross) && wahl && wahl !== gross.id && zugang(c, gross, platz).ok) && gross.name;
    konto += z.sicher - z.kosten;
    z.konto = konto;
    wochen.push(z);
  }

  // Monate zusammenzählen
  const monate = [];
  for (const z of wochen) {
    let m = monate[monate.length - 1];
    if (!m || m.monat !== z.monat) monate.push(m = { monat: z.monat, kosten: 0, sicher: 0, turniere: 0, konto: 0 });
    m.kosten += z.kosten; m.sicher += z.sicher; m.konto = z.konto;
    if (z.def && z.def.cat !== 'LIGA') m.turniere++;
  }

  // Der Trainer schaut auf den Plan
  const hinweise = [], geplant = wochen.filter((z) => z.wahl);
  const tief = wochen.reduce((a, z) => (z.konto < a.konto ? z : a), { konto: c.money, nr: c.week, monat: monatVon(c.season, c.week) });
  if (!geplant.length) hinweise.push({ art: 'info', text: 'Dein Plan ist noch leer. Trag ein paar Wochen ein – oder lass dir unten einen Vorschlag machen.' });
  if (tief.konto < 0) hinweise.push({ art: 'schlecht', text: `Geld: Wenn du überall früh verlierst, fehlen dir in Woche ${tief.nr + 1} bis zu ${Math.round(-tief.konto).toLocaleString('de-DE')} $. Plane Tennisstunden oder Liga-Spiele ein – oder du musst vorher Matches gewinnen.` });
  if (laengste >= SERIE_LANG) hinweise.push({ art: 'schlecht', text: `Körper: Du planst ${laengste} Wochen am Stück mit Matches. Ab ${SERIE_LANG} Wochen ohne Pause steigt die Verletzungsgefahr deutlich.` });
  for (const z of wochen) if (z.pflichtAus) hinweise.push({ art: 'schlecht', text: `Pflicht: ${z.pflichtAus} ist für dich ein Pflichtturnier. Wenn du es auslässt, zählt es mit 0 Punkten.` });
  const zuWeit = wochen.filter((z) => z.def && z.zugang && !z.zugang.ok);
  if (zuWeit.length) hinweise.push({ art: 'achtung', text: `Platz: Für ${zuWeit.length === 1 ? zuWeit[0].def.name : zuWeit.length + ' geplante Turniere'} stehst du noch zu weit hinten (${zuWeit.slice(0, 3).map((z) => `${z.def.name}: ab Platz ${z.zugang.bis}`).join(', ')}). Du musst bis dahin noch klettern – halte einen Plan B bereit.` });
  const ohne = wochen.filter((z) => z.verteidigen && z.wahl && !(z.def && z.def.cat !== 'LIGA'));
  if (ohne.length) hinweise.push({ art: 'achtung', text: `Punkte: In ${ohne.length === 1 ? 'Woche ' + (ohne[0].nr + 1) : ohne.length + ' Wochen'} fallen alte Punkte weg (${ohne.reduce((a, z) => a + z.verteidigen, 0)}), und du spielst dort kein Turnier.` });
  if (braucht.length) hinweise.push({ art: 'achtung', text: `Ausrüstung: Für diesen Plan brauchst du noch ${braucht.map((b) => b.was === 'weiss' ? 'ein weißes Outfit' : b.belag === 'clay' ? 'Sandplatz-Schuhe' : 'Rasen-Schuhe').join(', ')}.` });
  if (fluege >= 10 && flugGeld > 0) hinweise.push({ art: 'info', text: `Reisen: ${fluege} Flüge für zusammen ${flugGeld.toLocaleString('de-DE')} $. Turniere auf demselben Erdteil hintereinander sparen Geld und Kraft.` });
  // Note: 5 Sterne, für jeden schlimmen Fehler geht einer weg, für jede Warnung ein halber
  const note = !geplant.length ? 0 : Math.max(1, Math.round(5 - hinweise.filter((h) => h.art === 'schlecht').length - hinweise.filter((h) => h.art === 'achtung').length / 2));
  if (geplant.length && !hinweise.some((h) => h.art === 'schlecht' || h.art === 'achtung')) hinweise.push({ art: 'gut', text: 'Starker Plan! Genug Pausen, das Geld reicht, und die Ausrüstung passt.' });

  return {
    wochen, monate, hinweise, braucht, note, laengste, fluege, flugGeld, maxPunkte, erdteile: [...erdteile],
    turniere: wochen.filter((z) => z.def && z.def.cat !== 'LIGA').length,
    kosten: wochen.reduce((a, z) => a + z.kosten, 0), sicher: wochen.reduce((a, z) => a + z.sicher, 0),
    tief: tief.konto, tiefWoche: tief.nr, bedarf: Math.max(0, Math.round(-tief.konto)), ende: konto,
  };
}

// Automatischer Plan: Ein Trainer-Typ (siehe AUTO) füllt alle noch freien Wochen bis zum Jahresende.
// Er nimmt immer das größte Turnier, bei dem du HEUTE mitspielen dürftest und das du dir sicher leisten kannst.
// nurFreie = true: Was du schon selbst eingetragen hast, bleibt stehen.
export function autoPlan(c, art, nurFreie = true) {
  const A = AUTO[art] || AUTO.mittel, platz = myRank(c), sp = sponsorGeld(c).summe, team = lohn(c);
  let ort = c.ort, konto = c.money, serie = c.serie || 0, offNr = 0;
  for (let w = c.week; w < WOCHEN_PRO_JAHR; w++) {
    const W = WOCHEN[w];
    let wahl = nurFreie ? wahlVon(c, w) : null;
    if (!wahl) {
      const gross = W.gross ? tournamentById(W.gross) : null;
      const pflicht = gross && istPflicht(gross) && zugang(c, gross, platz).ok;
      const moeglich = optionen(c, w, platz).filter((o) => o.def && o.def.cat !== 'LIGA' && o.zugang.ok)
        .map((o) => ({ ...o, kosten: reiseKosten({ ...c, ort }, o.def).summe + team, schuhe: fehltFuer(c, o.def).some((f) => f.muss) }))
        .filter((o) => konto + sp >= o.kosten + (o.schuhe ? 150 : 0));
      // Der Vorsichtige bleibt lieber in der Nähe: Er nimmt von den zwei größten das billigere.
      let ziel = moeglich[moeglich.length - 1];
      if (art === 'ruhig' && moeglich.length > 1 && moeglich[moeglich.length - 2].kosten < ziel.kosten) ziel = moeglich[moeglich.length - 2];
      if (W.off) wahl = offNr++ < 2 ? 'pause' : 'vorbereitung';
      else if (pflicht) wahl = gross.id;
      else if (serie >= A.pauseNach) wahl = 'pause';
      else if (ziel) wahl = ziel.id;
      else wahl = konto < 1500 ? 'stunden' : LIGA.id;       // kein Turnier bezahlbar: Geld verdienen
      c.plan.wochen[w] = wahl;
    }
    const def = defVon(wahl);
    if (def) {
      konto += kleinstes(def.money) + (def.cat === 'LIGA' ? 0 : sp) - reiseKosten({ ...c, ort }, def).summe - team;
      ort = erdteil(c, def); serie++;
    } else { konto += (wahl === 'stunden' ? STUNDEN_GELD : 0) - team; ort = heimat(c); serie = 0; }
  }
  saveCareer(c);
}

// Für die Anzeige: In welcher Phase der Saison liegt die Woche? (weitergereicht aus kalender.js)
export { phaseVon };
