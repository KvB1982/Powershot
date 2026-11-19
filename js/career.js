// Powershot – Karriere: eigener Spieler, Weltrangliste, Geld, Ausrüstung, Team, Sponsoren, Reisen
//
// Die Idee: Du fängst ganz unten an (ITF-Turniere, kaum Preisgeld) und arbeitest dich hoch.
// Jede Turnierwoche entscheidest du: Wohin reise ich? Kann ich mir den Flug leisten? Bin ich noch frisch?
// Diese Datei rechnet nur – sie zeichnet nichts. Darum kann man sie ohne Browser testen (tools/logic.mjs).

import { PLAYERS, TOURNAMENTS, tournamentById, playerById, overall } from './data.js';
import { STAT_NAMES } from './faehigkeiten.js';
import { createTournament, payout, simulateRest } from './tournament.js';
import {
  KLEINE_TURNIERE, LIGA, NACHWUCHS, KURVE, STUFEN, BIS_PLATZ_GROSS, ERDTEIL_GROSS, HEIMAT,
  flugPreis, HOTEL_WOCHE, ESSEN_WOCHE, STUNDEN_GELD,
} from './kleinetour.js';
import {
  SHOP, shopById, TRAINER, PHYSIOS, REISEN, VERTRAGS_STUFEN, VERTRAG_CATS, PROFI_AB, GELDGEBER,
  FAN_PROZENT, FAN_MAX, WIMBLEDON_LEIHE,
} from './ausruestung.js';
import { ausbauBonus, saitenPlus, grenze, technikWerte, koerperWoche, ausheilen, beschwerdenAbzug, kaufen, lernen } from './ausbau.js';
import { WOCHEN, WOCHEN_PRO_JAHR, ZAEHLT_HOECHSTENS, PFLICHT_MASTERS, wocheVon, zweiWochen } from './kalender.js';

const KEY = 'powershot.karriere.v1';
export const START_PUNKTE = 16;       // so viele Fähigkeitspunkte darfst du am Anfang verteilen
export const PUNKTE_PRO_LEVEL = 4;    // und so viele gibt es für jedes neue Level
export const START_GELD = 4000;       // damit fängst du an (in echt helfen am Anfang oft Eltern und Verein)
export const WILDCARDS_PRO_SAISON = 2;
export const TITEL_FANS = 2;          // so viele Fan-Sterne bringt jeder Titel

export function loadCareer() {
  try { return reparieren(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return null; }
}

// Alle Spieler der Rangliste außer dir: die 200 echten Profis und die erfundenen Nachwuchsspieler
const ALLE = [...PLAYERS, ...NACHWUCHS];
export const heimat = (c) => HEIMAT[c.country] || 'eu';
const begrenzen = (x, a, b) => Math.max(a, Math.min(b, x));

// Ein Spielstand aus der Zeit mit fünf Fähigkeiten (Aufschlag, Kraft, Tempo, Präzision, Volley):
// Kraft und Präzision werden zu Vorhand und Rückhand, Tempo wird zur Beinarbeit.
// Die drei neuen Fähigkeiten starten beim Durchschnitt der alten.
function vonFuenfAufAcht(alt) {
  const schlag = (alt.p + alt.c) / 2, mitte = Math.round((alt.s + alt.p + alt.t + alt.c + alt.v) / 5);
  return { s: alt.s, vh: Math.ceil(schlag), rh: Math.floor(schlag), v: alt.v, b: alt.t, a: mitte, m: mitte, k: mitte };
}

// Alte Spielstände kennen manches noch nicht (oder Dinge, die es nicht mehr gibt). Hier wird alles nachgetragen.
function reparieren(c) {
  if (!c || !(c.points || c.erg)) return c;
  if ((c.v || 0) < 3) vonAltemKalender(c);
  if (c.skills.vh == null) c.skills = vonFuenfAufAcht(c.skills);
  const known = new Set(['me', ...ALLE.map((p) => p.id)]);
  for (const id of Object.keys(c.erg)) if (!known.has(id)) delete c.erg[id];
  for (const p of ALLE) if (!c.erg[p.id]) c.erg[p.id] = vorjahr(p, jetzt(c));
  if (c.tournament && (!tournamentById(c.tournament.defId) || Object.keys(c.tournament.players).some((id) => id !== 'me' && !playerById(id)))) c.tournament = null;
  // Neu seit der Version mit Reisen und Sponsoren:
  c.owned = (c.owned || []).filter((id) => shopById(id));
  c.equipped = c.equipped || {};
  for (const cat of Object.keys(c.equipped)) if (!shopById(c.equipped[cat])) delete c.equipped[cat];
  c.frische = c.frische ?? 100;
  c.ort = c.ort || heimat(c);
  c.reise = REISEN[c.reise] ? c.reise : 'normal';
  c.trainer = c.trainer || 't0';
  c.physio = c.physio || 'p0';
  c.vertrag = c.vertrag || { schlaeger: null, kleidung: null };
  c.sponsoren = c.sponsoren || ['verein'];
  c.saitenRest = c.saitenRest || 0;
  c.wildcards = c.wildcards ?? WILDCARDS_PRO_SAISON;
  c.siege = c.siege || 0;
  c.pokale = c.pokale || [];           // Pokalschrank: ein Eintrag je Turniersieg
  c.redeFans = c.redeFans || 0;        // Fan-Sterne aus Siegerreden
  // Neu seit dem Profi-Service (siehe ausbau.js):
  c.ausbau = c.ausbau || {};           // welche Ausbaustufe in welchem Bereich
  c.techniken = c.techniken || [];     // gelernte Profi-Schläge
  c.serie = c.serie || 0;              // so viele Wochen hintereinander hast du Matches gespielt
  c.koerper = c.koerper || null;       // Beschwerden: { teil, wochen }
  c.verletzung = c.verletzung || null; // Verletzung: { name, teil, wochen, gesamt, fehler }
  c.plan = c.plan && c.plan.jahr === c.season ? c.plan : { jahr: c.season, wochen: {} };   // dein Turnierplan für dieses Jahr (siehe planer.js)
  c.handtuecher = c.handtuecher || []; // Sammlung: von jedem Turnier, bei dem du gespielt hast, ein Handtuch
  c.v = 3;
  return c;
}
export function saveCareer(c) {
  // Ein Profi aus dem Saison-Modus (profisaison.js) benutzt dieselben Funktionen, wird aber in der Saison gespeichert
  if (c.saison) { if (c.sichern) c.sichern(); return; }
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* kein Speicher */ }
}
export function deleteCareer() {
  try { localStorage.removeItem(KEY); } catch (e) { /* egal */ }
}

// opts: { name, country, hand, look }
export function newCareer(opts) {
  return reparieren({
    name: opts.name || 'Spieler', country: opts.country || 'GER', hand: opts.hand || 1, look: opts.look,
    skills: { s: 52, vh: 52, rh: 52, v: 52, b: 52, a: 52, m: 52, k: 52 }, skillPoints: START_PUNKTE,
    xp: 0, level: 1, money: START_GELD,
    owned: [], equipped: {},
    season: 2026, week: 0, erg: { me: [] }, stand: 0, v: 3, tournament: null, trainingLeft: 2,
    history: [], titles: 0, bestRank: 2000,
  });
}

// ---------------------------------------------------------------
// Weltrangliste
// ---------------------------------------------------------------
// Jeder Spieler (auch du) hat eine Liste seiner Ergebnisse: c.erg[spieler] = [{ a, p, k }, …]
//   a = in welcher Woche (alle Wochen seit dem Jahr 0 durchgezählt: Jahr × 52 + Woche)
//   p = Punkte
//   k = 1: Pflichtturnier (Grand Slam oder Pflicht-Masters), 2: ATP Finals, 0: alles andere
// Bei dir stehen zusätzlich Name (n), Stufe (cat) und Runde (label) dabei – für die Anzeige.
// Die Regeln, was davon zählt, stehen in kalender.js.
export const jetzt = (c) => c.season * WOCHEN_PRO_JAHR + c.week;

// Was zählt für die Rangliste? liste = Ergebnisse eines Spielers, von/bis = diese Wochen zählen (beide eingeschlossen).
// Zurück kommt { punkte, zaehlt: [...], gestrichen: [...] }
export function zaehlen(liste, von, bis) {
  const im = (liste || []).filter((e) => e.a >= von && e.a <= bis);
  const pflicht = im.filter((e) => e.k === 1), finals = im.filter((e) => e.k === 2);
  const andere = im.filter((e) => !e.k).sort((x, y) => y.p - x.p);
  const frei = Math.max(0, ZAEHLT_HOECHSTENS - pflicht.length);
  const zaehlt = [...pflicht, ...andere.slice(0, frei), ...finals];
  return { punkte: zaehlt.reduce((sum, e) => sum + e.p, 0), zaehlt, gestrichen: andere.slice(frei) };
}
// Weltrangliste: die letzten 52 Wochen. Das Ergebnis von genau vor einem Jahr zählt noch – bis diese Woche vorbei ist.
const fuerRangliste = (c, id) => zaehlen(c.erg[id], jetzt(c) - WOCHEN_PRO_JAHR, jetzt(c));
// ATP Race: nur das laufende Jahr.
const fuerRace = (c, id) => zaehlen(c.erg[id], c.season * WOCHEN_PRO_JAHR, jetzt(c));
// Deine Punkte einzeln aufgelistet (für die Anzeige)
export const meinePunkte = (c) => fuerRangliste(c, 'me');
export const meinRace = (c) => fuerRace(c, 'me');
// Diese Punkte von dir sind genau ein Jahr alt: Sie fallen nach dieser Woche aus der Rangliste.
export function zuVerteidigen(c, wochen = 1) {
  const von = jetzt(c) - WOCHEN_PRO_JAHR, z = meinePunkte(c).zaehlt;
  return c.erg.me.filter((e) => e.a >= von && e.a < von + wochen && e.p > 0).map((e) => ({ ...e, zaehlt: z.includes(e) }));
}

// Ein Ergebnis eintragen
function eintragen(c, id, e) {
  (c.erg[id] = c.erg[id] || []).push(e);
  c.stand = (c.stand || 0) + 1;
}
export const istPflicht = (def) => def.cat === 'GS' || (def.cat === 'M' && PFLICHT_MASTERS.includes(def.id));
const kVon = (def) => (def.cat === 'F' ? 2 : istPflicht(def) ? 1 : 0);

// Womit startet ein echter Profi? Seine echten Punkte (Stand der Liste in data.js) werden auf Turniere
// der letzten 52 Wochen verteilt – so, wie ein Spieler mit seinem Platz ungefähr gespielt hätte.
// Diese Ergebnisse fallen dann Woche für Woche weg, und die neuen (ausgerechneten) kommen dazu.
function vorjahr(p, heute) {
  const r = p.rank, liste = [];
  const woche = (w) => heute - WOCHEN_PRO_JAHR + ((w - (heute % WOCHEN_PRO_JAHR) + WOCHEN_PRO_JAHR) % WOCHEN_PRO_JAHR);   // die letzte Woche mit dieser Nummer
  for (const t of TOURNAMENTS) {
    const w = woche(wocheVon(t.id));
    if (t.cat === 'GS' && r <= 128) liste.push({ a: w, k: 1, g: r <= 96 ? 2 : 0.6 });
    if (t.cat === 'M' && r <= t.draw) liste.push({ a: w, k: istPflicht(t) ? 1 : 0, g: 1 });
    if (t.cat === 'F' && r <= 8) liste.push({ a: w, k: 2, g: 1.5 });
  }
  // Dazu kleinere Turniere, bis 18 Ergebnisse zusammen sind
  const frei = WOCHEN.filter((w) => !w.off && !w.gross && (r > 100 || w.klein.some((k) => k.stufe[0] === 'A'))).map((w) => w.nr).sort(() => Math.random() - 0.5);
  while (liste.filter((e) => e.k !== 2).length < ZAEHLT_HOECHSTENS && frei.length) liste.push({ a: woche(frei.pop()), k: 0, g: r <= 30 ? 0.45 : r <= 96 ? 0.6 : 1 });
  for (const e of liste) e.g *= 0.5 + Math.random();
  const summe = liste.reduce((x, e) => x + e.g, 0);
  for (const e of liste) { e.p = Math.round(p.basePoints * e.g / summe); delete e.g; }
  liste.sort((x, y) => y.p - x.p)[0].p += p.basePoints - liste.reduce((x, e) => x + e.p, 0);   // Rundungsrest
  return liste;
}

// Ein Spielstand aus der Zeit, als die Saison nur 14 Wochen hatte: auf den Kalender mit 52 Wochen umrechnen
function vonAltemKalender(c) {
  const alt = (c.points && c.points.me) || {};
  c.week = Math.max(0, wocheVon((TOURNAMENTS[c.week] || TOURNAMENTS[0]).id));
  c.erg = { me: [] };
  for (const [tid, p] of Object.entries(alt)) {
    const w = wocheVon(tid);
    if (w < 0 || !p) continue;
    const h = [...(c.history || [])].reverse().find((x) => x.tid === tid);
    c.erg.me.push({ a: (w < c.week ? c.season : c.season - 1) * WOCHEN_PRO_JAHR + w, p, k: 0, n: h ? h.name : tournamentById(tid).name });
  }
  for (const h of c.history || []) if (h.w == null) h.w = wocheVon(h.tid);
  delete c.points;
  c.stand = 1;
}

// Hinter den Top 200 wird der Platz aus den Punkten geschätzt (KURVE in kleinetour.js).
// punkteVomLetzten = so viele Punkte hat der letzte echte Spieler (Platz 200). Direkt dahinter beginnt die Schätzung.
export function platzAusPunkten(punkte, punkteVomLetzten) {
  const dahinter = PLAYERS.length + 1;
  const k = [...KURVE.filter(([p, platz]) => p < punkteVomLetzten && platz > dahinter), [punkteVomLetzten, dahinter]];
  for (let i = 1; i < k.length; i++) {
    if (punkte <= k[i][0]) {
      const [p0, r0] = k[i - 1], [p1, r1] = k[i];
      return Math.max(dahinter, Math.round(r0 + (r1 - r0) * (punkte - p0) / (p1 - p0)));
    }
  }
  return dahinter;
}

// Die Rangliste auszurechnen dauert ein bisschen (201 Spieler). Darum merken wir uns das letzte Ergebnis,
// solange sich nichts geändert hat.
let merk = { c: null, key: '', welt: null, race: null };
function gemerkt(c, art, rechnen) {
  const key = jetzt(c) + ':' + (c.stand || 0) + ':' + c.name;
  if (merk.c !== c || merk.key !== key) merk = { c, key, welt: null, race: null };
  return merk[art] || (merk[art] = rechnen());
}

// Weltrangliste: sortierte Liste mit { id, name, country, points, rank, me, ref }
// Vorn stehen die besten 200 mit ihrem genauen Platz. Dahinter kennen wir nicht alle Spieler der Welt einzeln –
// dort wird der Platz aus den Punkten geschätzt (für dich und für die Nachwuchsspieler auf die gleiche Art).
export function ranking(c) {
  return gemerkt(c, 'welt', () => {
    const list = ALLE.map((p) => ({ id: p.id, name: p.name, country: p.country, points: fuerRangliste(c, p.id).punkte, ref: p }));
    list.push({ id: 'me', name: c.name, country: c.country, points: meinePunkte(c).punkte, me: true });
    list.sort((a, b) => b.points - a.points || (a.me ? 1 : b.me ? -1 : a.ref.rank - b.ref.rank));
    const grenze = list[PLAYERS.length - 1].points;
    list.forEach((p, i) => { p.rank = i < PLAYERS.length ? i + 1 : Math.max(list[i - 1].rank + 1, platzAusPunkten(p.points, grenze)); });
    return list;
  });
}
export function myRank(c) { return ranking(c).find((p) => p.me).rank; }

// ATP Race: wie die Weltrangliste, aber nur mit den Punkten dieses Jahres. { …, slam: hat dieses Jahr einen Grand Slam gewonnen }
export function race(c) {
  return gemerkt(c, 'race', () => {
    const sieger = new Set(Object.values((c.slams && c.slams.jahr === c.season && c.slams.wer) || {}));
    const list = ALLE.map((p) => ({ id: p.id, name: p.name, country: p.country, points: fuerRace(c, p.id).punkte, ref: p, slam: sieger.has(p.id) }));
    list.push({ id: 'me', name: c.name, country: c.country, points: meinRace(c).punkte, me: true, slam: sieger.has('me') });
    list.sort((a, b) => b.points - a.points || (a.me ? 1 : b.me ? -1 : a.ref.rank - b.ref.rank));
    list.forEach((p, i) => { p.rank = i + 1; });
    return list;
  });
}
// Wer darf zu den ATP Finals? Die ersten 7 im Race. Den 8. Platz bekommt ein Grand-Slam-Sieger des Jahres,
// wenn er im Race auf Platz 8 bis 20 steht – sonst der Achte.
export function finalsFeld(c) {
  const r = race(c);
  return [...r.slice(0, 7), r.slice(7, 20).find((p) => p.slam) || r[7]];
}

// Das große Turnier, das in dieser Woche beginnt (oder null)
export const grossDerWoche = (c) => { const g = WOCHEN[c.week].gross; return g ? tournamentById(g) : null; };
// Das nächste große Turnier ab dieser Woche (für das Training: dort wird geübt)
export function nextTournament(c) {
  for (let i = 0; i < WOCHEN_PRO_JAHR; i++) { const g = WOCHEN[(c.week + i) % WOCHEN_PRO_JAHR].gross; if (g) return tournamentById(g); }
  return TOURNAMENTS[0];
}

// ---------------------------------------------------------------
// Ausrüstung
// ---------------------------------------------------------------

// Welche Stufe hat dein Ausrüster-Vertrag? (-1 = noch zu weit hinten für einen Vertrag)
export function vertragsStufe(c, platz = myRank(c)) {
  let stufe = -1;
  VERTRAGS_STUFEN.forEach((s, i) => { if (platz <= s.bisPlatz) stufe = i; });
  return stufe;
}

// Bekommst du dieses Teil von deinem Ausrüster geschenkt?
export function gratis(c, item, stufe = vertragsStufe(c)) {
  if (stufe < 0) return false;
  const marke = item.vertrag ?? item.marke;
  if (VERTRAG_CATS.schlaeger.includes(item.cat)) return !!c.vertrag.schlaeger && marke === c.vertrag.schlaeger;
  return !!c.vertrag.kleidung && marke === c.vertrag.kleidung;
}
// Hast du dieses Teil (gekauft oder vom Ausrüster)?
export const hat = (c, item, stufe) => !!item && (c.owned.includes(item.id) || gratis(c, item, stufe));

// Was trägst du gerade in dieser Kategorie? (null, wenn nichts – oder wenn der Vertrag weg ist und das Teil nicht dir gehört)
export function traegt(c, cat, stufe) {
  const item = shopById(c.equipped[cat]);
  if (!item) return null;
  if (cat === 'Saiten') return item;
  return hat(c, item, stufe) ? item : null;
}

// Passen deine Schuhe zu diesem Belag?
// Am Anfang hast du nur alte Turnschuhe. Die gehen auf Hartplatz und in der Halle – aber auf Sand rutscht man damit weg,
// und auf Rasen sind sie verboten (glatte Sohle). Ein gekaufter Schuh passt, wenn er auf dem Belag mindestens +2 Tempo bringt.
export const ALTE_SCHUHE_GEHEN = ['hard', 'indoor'];
export function schuhePassen(c, surface, stufe) {
  if (ALTE_SCHUHE_GEHEN.includes(surface)) return true;
  const s = besteSchuhe(c, surface, stufe);
  return !!s && s.tempo[surface] >= 2;
}
// Was fehlt dir für dieses Turnier? Gibt eine Liste zurück: [{ was: 'schuhe' | 'weiss', text, muss }]
//   muss = true: Ohne das darfst du nicht antreten. (Weiß in Wimbledon kann man leihen – das kostet nur Geld.)
export function fehltFuer(c, def) {
  const out = [];
  if (!def || def.cat === 'LIGA') return out;          // im eigenen Verein darfst du mit allem spielen
  if (!schuhePassen(c, def.surface)) out.push({ was: 'schuhe', muss: true, text: def.surface === 'clay' ? 'Sandplatz-Schuhe fehlen' : 'Rasen-Schuhe fehlen' });
  const outfit = traegt(c, 'Outfit');
  if (def.id === 'wim' && !(outfit && outfit.weiss)) out.push({ was: 'weiss', muss: false, text: `Weißes Outfit fehlt (Leihen kostet ${WIMBLEDON_LEIHE} $)` });
  return out;
}

// Deine Ausrüstung auf einen Blick – auch das, was du von Anfang an hast (für die Übersicht).
// Jede Zeile: { cat, name, info, eigen } – eigen = false: das ist noch die Sache vom Anfang
export function ausruestungJetzt(c) {
  const stufe = vertragsStufe(c), zeilen = [];
  const r = traegt(c, 'Schläger', stufe), s = traegt(c, 'Saiten', stufe), o = traegt(c, 'Outfit', stufe);
  const k = traegt(c, 'Kopf', stufe), b = traegt(c, 'Schweißband', stufe), t = traegt(c, 'Tasche', stufe);
  zeilen.push(r ? { cat: 'Schläger', name: r.name, bonus: r.bonus, eigen: true } : { cat: 'Schläger', name: 'Alter Vereinsschläger', info: 'vom Anfang · keine Pluspunkte' });
  zeilen.push(s ? { cat: 'Saiten', name: s.name, bonus: c.saitenRest > 0 ? s.bonus : null, info: c.saitenRest > 0 ? `noch ${c.saitenRest} ${c.saitenRest === 1 ? 'Match' : 'Matches'} frisch` : 'müde – bringen nichts mehr', eigen: true }
    : { cat: 'Saiten', name: 'Alte Saiten vom Verein', info: 'vom Anfang · keine Pluspunkte' });
  const schuhe = SHOP.filter((x) => x.cat === 'Schuhe' && hat(c, x, stufe));
  const belaege = ['hard', 'clay', 'grass', 'indoor'].filter((bel) => schuhePassen(c, bel, stufe));
  zeilen.push(schuhe.length ? { cat: 'Schuhe', name: schuhe.map((x) => x.name).join(', '), belaege, eigen: true }
    : { cat: 'Schuhe', name: 'Alte Turnschuhe', belaege, info: 'vom Anfang · nur für Hartplatz und Halle' });
  zeilen.push(o ? { cat: 'Outfit', name: o.name, sterne: o.sterne, info: o.weiss ? 'weiß – passt für Wimbledon' : '', eigen: true } : { cat: 'Outfit', name: 'Dein eigenes T-Shirt', info: 'vom Anfang · bringt keine Fans' });
  zeilen.push(k ? { cat: 'Kopf', name: k.name, sterne: k.sterne, eigen: true } : { cat: 'Kopf', name: '–', info: 'keine Kappe, kein Stirnband' });
  zeilen.push(b ? { cat: 'Schweißband', name: b.name, bonus: b.bonus, eigen: true } : { cat: 'Schweißband', name: '–', info: 'keins' });
  zeilen.push(t ? { cat: 'Tasche', name: t.name, info: t.text, eigen: true } : { cat: 'Tasche', name: 'Alter Rucksack', info: 'vom Anfang · Platz für einen Schläger' });
  return zeilen;
}

// Das beste Paar Schuhe aus deinem Schrank für diesen Belag
export function besteSchuhe(c, surface, stufe) {
  let best = null;
  for (const s of SHOP) if (s.cat === 'Schuhe' && hat(c, s, stufe) && (!best || s.tempo[surface] > best.tempo[surface])) best = s;
  return best;
}

// Fans (⭐): schicke Sachen und Titel machen dich beliebt. Mehr Fans = mehr Geld von den Sponsoren.
export function fans(c) {
  const stufe = vertragsStufe(c);
  let n = c.titles * TITEL_FANS + (c.redeFans || 0) + (c.tagFans || 0);      // tagFans: Autogramme und Presse (siehe turniertag.js)
  for (const cat of ['Outfit', 'Kopf', 'Schweißband', 'Tasche']) n += (traegt(c, cat, stufe) || {}).sterne || 0;
  return Math.min(FAN_MAX, n);
}

const laufendesTurnier = (c) => (c.tournament ? tournamentById(c.tournament.defId) : null);
const scheintSonne = (def) => !!def && !def.theme.night && def.surface !== 'indoor';

// Wie viel Tempo und Kraft kostet es, wenn du müde bist?
export function frischeAbzug(frische) {
  if (frische >= 95) return { t: 1 };                 // topfit: sogar ein Pluspunkt
  if (frische >= 70) return {};
  if (frische >= 50) return { t: -2 };
  if (frische >= 30) return { t: -4, p: -2 };
  return { t: -7, p: -4, s: -2 };
}

// Alle Pluspunkte einzeln aufgelistet (für die Anzeige): [{ name, bonus }]
// def = das Turnier, für das gerechnet wird (wegen Belag und Sonne). Ohne Angabe: das laufende Turnier oder Hartplatz.
export function bonusListe(c, def = laufendesTurnier(c)) {
  const stufe = vertragsStufe(c), surface = def ? def.surface : 'hard', out = [];
  const r = traegt(c, 'Schläger', stufe);
  if (r) {
    out.push({ name: r.name, bonus: r.bonus });
    if (stufe >= PROFI_AB && r.marke === c.vertrag.schlaeger) out.push({ name: 'Nach Maß gebaut von ' + r.marke, bonus: { p: 1, c: 1 } });
  }
  const s = traegt(c, 'Saiten', stufe);
  if (s && c.saitenRest > 0) out.push({ name: s.name, bonus: s.bonus });
  const h = besteSchuhe(c, surface, stufe);
  if (h) out.push({ name: h.name, bonus: { t: h.tempo[surface] } });
  const b = traegt(c, 'Schweißband', stufe);
  if (b) out.push({ name: b.name, bonus: b.bonus });
  const k = traegt(c, 'Kopf', stufe);
  if (k && k.head === 'cap' && scheintSonne(def)) out.push({ name: k.name + ' (Sonne)', bonus: { s: 1 } });
  const t = TRAINER.find((x) => x.id === c.trainer), p = PHYSIOS.find((x) => x.id === c.physio);
  if (t && t.bonus) out.push({ name: t.name, bonus: t.bonus });
  if (p && p.bonus) out.push({ name: p.name, bonus: p.bonus });
  // Profi-Service: Bespanner, Werkstatt, Ärzte (siehe ausbau.js)
  out.push(...ausbauBonus(c));
  const weh = beschwerdenAbzug(c);
  if (weh) out.push(weh);
  // Was du heute vor dem Match auf der Anlage getan hast (siehe turniertag.js)
  if (c.tag && Object.keys(c.tag.bonus || {}).length) out.push({ name: 'Heute auf der Anlage', bonus: c.tag.bonus });
  // Was du gestern Abend getan hast (siehe ABEND in turniertag.js)
  if (c.abend && c.abend.bonus) out.push({ name: 'Gestern Abend', bonus: c.abend.bonus });
  const f = frischeAbzug(c.frische);
  if (Object.keys(f).length) out.push({ name: c.frische >= 95 ? 'Topfit' : 'Müde', bonus: f });
  return out;
}

// Deine acht Fähigkeiten mit allen Pluspunkten. Ausrüstung und Team bringen zum Teil eigene Eigenschaften mit:
//   Tempo (t) zählt zur Beinarbeit. Kraft (p) und Präzision (c) sind keine Fähigkeiten – sie stehen als
//   kraft und praez dabei und machen im Match Vorhand und Rückhand härter bzw. genauer.
export function effectiveStats(c, def) {
  const st = { ...c.skills, kraft: 0, praez: 0 };
  const ziel = { t: 'b', p: 'kraft', c: 'praez' };
  for (const e of bonusListe(c, def)) for (const k in e.bonus) st[ziel[k] || k] += e.bonus[k];
  for (const k in STAT_NAMES) st[k] = begrenzen(st[k], 1, 99);
  return st;
}

// Dein Spieler in der Form, die das Match braucht
export function mePlayer(c) {
  const def = laufendesTurnier(c), stufe = vertragsStufe(c);
  const look = { ...c.look };
  const racket = traegt(c, 'Schläger', stufe), shoes = besteSchuhe(c, def ? def.surface : 'hard', stufe);
  if (racket) look.racket = racket.color;
  if (shoes) look.shoes = shoes.color;
  const outfit = traegt(c, 'Outfit', stufe);
  if (outfit) { look.shirt = outfit.shirt; look.shorts = outfit.shorts; }
  // In Wimbledon müssen alle ganz in Weiß spielen – das ist dort seit über 100 Jahren Regel.
  if (def && def.id === 'wim') { look.shirt = 0xffffff; look.shorts = 0xffffff; look.trim = 0xffffff; }
  const kopf = traegt(c, 'Kopf', stufe);
  if (kopf) { look.head = kopf.head; look.model = kopf.head === 'cap' ? 'e' : 'b'; }
  const parts = c.name.trim().split(' ');
  return { id: 'me', name: c.name, short: parts[parts.length - 1], country: c.country, stats: effectiveStats(c, def), hand: c.hand, look, me: true, technik: technikWerte(c) };
}

// Turnier-Edition: Gibt es dieses Teil gerade zu kaufen? Nur in der Woche "seines" Turniers (bei Turnieren über
// zwei Wochen auch in der zweiten), und nur, wenn du dort mitspielen darfst.
export function editionDa(c, item) {
  if (!item.nur) return true;
  const W = WOCHEN[c.week];
  return (W.gross === item.nur || W.zweite === item.nur) && zugang(c, tournamentById(item.nur)).ok;
}

// Sonderstücke: Hast du dir gerade eines verdient? Gibt die neuen Teile zurück (sie liegen dann in deinem Schrank).
export function sonderPruefen(c, platz = myRank(c)) {
  const erfuellt = {
    titel: c.titles >= 1, siege100: c.siege >= 100, top100: platz <= 100, top10: platz <= 10, nr1: platz <= 1,
    slam: c.pokale.some((p) => p.cat === 'GS') || c.history.some((h) => h.cat === 'GS' && h.label === 'W'),
  };
  const neu = SHOP.filter((s) => s.verdient && erfuellt[s.verdient] && !c.owned.includes(s.id));
  for (const s of neu) c.owned.push(s.id);
  return neu;
}

// So sähe dein Spieler mit diesem Teil aus (für die Anprobe im Shop). Ohne id: so, wie er jetzt aussieht.
export function anprobeLook(c, id) {
  const item = shopById(id);
  if (!item) return mePlayer({ ...c, tournament: null }).look;
  const look = mePlayer({ ...c, tournament: null, owned: [...c.owned, id], equipped: { ...c.equipped, [item.cat]: id } }).look;
  if (item.cat === 'Schuhe') look.shoes = item.color;
  return look;
}

export function buy(c, id) {
  const item = shopById(id);
  if (!item || item.verdient || !editionDa(c, item)) return false;
  if (item.cat === 'Saiten') return bespannen(c, id);
  if (hat(c, item) || c.money < item.price) return false;
  c.money -= item.price;
  c.owned.push(id);
  if (item.cat !== 'Schuhe') c.equipped[item.cat] = id;
  saveCareer(c);
  return true;
}

// Etwas anziehen oder wieder ablegen (Schuhe sucht sich dein Spieler selbst aus)
export function equip(c, id) {
  const item = shopById(id);
  if (!item || !hat(c, item) || item.cat === 'Schuhe' || item.cat === 'Saiten') return;
  if (c.equipped[item.cat] === id) delete c.equipped[item.cat]; else c.equipped[item.cat] = id;
  saveCareer(c);
}

// So viele Matches hält eine frische Bespannung (eine große Tasche und ein guter Bespanner bringen Matches dazu)
export function saitenLeben(c, item) {
  const tasche = traegt(c, 'Tasche');
  return item.haelt + (tasche ? tasche.mehr : 0) + saitenPlus(c);
}
// Den Schläger mit einer Saite bespannen lassen. Gibt true zurück, wenn es geklappt hat.
export function bespannen(c, id) {
  const item = shopById(id);
  if (!item || item.cat !== 'Saiten') return false;
  const frei = gratis(c, item);
  if (!frei && c.money < item.price) return false;
  if (!frei) c.money -= item.price;
  c.equipped['Saiten'] = id;
  c.saitenRest = saitenLeben(c, item);
  saveCareer(c);
  return true;
}

// ---------------------------------------------------------------
// Team, Reise-Art, Verträge
// ---------------------------------------------------------------
export const meinTrainer = (c) => TRAINER.find((t) => t.id === c.trainer) || TRAINER[0];
export const meinPhysio = (c) => PHYSIOS.find((p) => p.id === c.physio) || PHYSIOS[0];
export const lohn = (c) => meinTrainer(c).lohn + meinPhysio(c).lohn;

export function setTeam(c, id) {
  if (TRAINER.some((t) => t.id === id)) c.trainer = id;
  if (PHYSIOS.some((p) => p.id === id)) c.physio = id;
  saveCareer(c);
}
export function setReise(c, art) { if (REISEN[art]) { c.reise = art; saveCareer(c); } }
// art: 'schlaeger' oder 'kleidung'; marke: Name der Marke oder null (Vertrag beenden)
export function setVertrag(c, art, marke) { c.vertrag[art] = marke || null; saveCareer(c); }

export const erdteil = (c, def) => (def.cat === 'LIGA' ? heimat(c) : def.erdteil || ERDTEIL_GROSS[def.id] || 'eu');
const hatFreiflug = (c) => c.sponsoren.some((id) => (GELDGEBER.find((g) => g.id === id) || {}).freiflug);

// Was kostet die Reise zu diesem Turnier? { flug, hotel, essen, summe }
export function reiseKosten(c, def) {
  if (!def || def.cat === 'LIGA') return { flug: 0, hotel: 0, essen: 0, summe: 0 };
  const R = REISEN[c.reise];
  let flug = flugPreis(c.ort, erdteil(c, def)), hotel = def.hotel ? HOTEL_WOCHE : 0;
  if (R.fest) flug = R.fest;
  else {
    flug = hatFreiflug(c) ? 0 : Math.round(flug * R.mal);
    hotel = Math.round(hotel * R.mal);
  }
  return { flug, hotel, essen: ESSEN_WOCHE, summe: flug + hotel + ESSEN_WOCHE };
}

// Was zahlen deine Sponsoren für ein Turnier? { posten: [{ name, geld }], summe }
export function sponsorGeld(c) {
  const platz = myRank(c), stufe = vertragsStufe(c, platz), posten = [];
  const mal = 1 + fans(c) * FAN_PROZENT / 100;
  for (const g of GELDGEBER) if (c.sponsoren.includes(g.id)) posten.push({ name: g.name, geld: Math.round(g.geld * mal) });
  if (stufe >= 0) {
    const S = VERTRAGS_STUFEN[stufe];
    const r = traegt(c, 'Schläger', stufe), o = traegt(c, 'Outfit', stufe);
    if (S.geld && r && r.marke === c.vertrag.schlaeger) posten.push({ name: r.marke + ' (' + S.name + ')', geld: Math.round(S.geld * mal) });
    if (S.geld && o && o.marke === c.vertrag.kleidung) posten.push({ name: o.marke + ' (' + S.name + ')', geld: Math.round(S.geld * mal) });
  }
  return { posten, summe: posten.reduce((s, p) => s + p.geld, 0) };
}

// ---------------------------------------------------------------
// Die Turnierwoche: Was steht zur Auswahl?
// ---------------------------------------------------------------

// Darfst du bei diesem Turnier mitspielen? { ok, bis, wildcard }
//   bis      = so gut muss der Platz mindestens sein
//   wildcard = true: Du bist knapp zu weit hinten, könntest aber eine Wildcard (Einladung) einsetzen.
//              Das geht nur, wenn dein Platz höchstens dreimal so hoch ist wie erlaubt.
export function zugang(c, def, platz = myRank(c)) {
  if (def.cat === 'LIGA') return { ok: true };
  if (def.cat === 'F') return { ok: finalsFeld(c).some((p) => p.me), bis: 8, wildcard: false, race: true };
  const bis = def.bisPlatz ?? (def.direkt || BIS_PLATZ_GROSS[def.cat]);
  if (platz <= bis) return { ok: true, bis };
  return { ok: false, bis, wildcard: c.wildcards > 0 && platz <= bis * 3 };
}
export function qualified(c, def) { return zugang(c, def).ok; }

// Alle Turniere dieser Woche, das kleinste zuerst. Jeder Eintrag: { def, zugang, kosten, fehlt, pflicht }
//   fehlt   = so viele Dollar fehlen dir für Reise und Team (0 = du kannst es bezahlen)
//   pflicht = true: Pflichtturnier für dich. Fährst du nicht hin, zählen dafür 0 Punkte in deiner Rangliste.
export function angebot(c) {
  const gross = grossDerWoche(c), platz = myRank(c), sp = sponsorGeld(c).summe;
  const kleine = KLEINE_TURNIERE.filter((t) => t.woche === c.week).sort((a, b) => a.points.W - b.points.W);
  return [...kleine, ...(gross ? [gross] : [])].map((def) => {
    const kosten = reiseKosten(c, def), z = zugang(c, def, platz);
    return { def, zugang: z, kosten, fehlt: Math.max(0, kosten.summe + lohn(c) - c.money - sp), pflicht: istPflicht(def) && z.ok, sachen: fehltFuer(c, def) };
  });
}

const zufall = (liste, n) => [...liste].sort(() => Math.random() - 0.5).slice(0, n);
const staerke = (p) => overall(p.stats);

// ---------------------------------------------------------------
// Die ganze Tennis-Welt spielt mit
// ---------------------------------------------------------------
// Jede Woche überlegt sich jeder der 200 echten Profis, wo er spielt – so wie du. Die Besten spielen die
// großen Turniere, die anderen ATP-500/250-Turniere oder Challenger. Manche machen Pause.
// Alle Turniere werden ausgerechnet, und alle bekommen ihre Punkte. So bewegt sich die ganze Rangliste.
// (Alle Zahlen hier – wie oft jemand spielt, wie viele Profis zu einem Challenger fahren – sind geschätzt.)
const SPIELT_OFT = (platz) => (platz <= 10 ? 0.3 : platz <= 30 ? 0.55 : platz <= 200 ? 0.7 : 0.6);   // so oft spielt jemand in einer Woche
const CHALLENGER_DAZU = 2;             // so viele Challenger laufen jede Woche zusätzlich mit (geschätzt)
const FORM = 4;                       // so stark schwankt die Tagesform eines Spielers von Turnier zu Turnier (geschätzt)
const QUALI = 4;                      // so viele Plätze in jedem Feld gehen an Qualifikanten (Spieler, die eigentlich zu weit hinten stehen)

// Wer spielt diese Woche wo? Gibt eine Liste zurück: [{ def, liste: [Spieler, bester zuerst] }]
// meinDef = das Turnier, bei dem du selbst spielst (dort bleibt ein Platz für dich frei und du stehst mit in der Liste)
function wochenFelder(c, meinDef) {
  const W = WOCHEN[c.week], gross = grossDerWoche(c);
  const rang = ranking(c), ich = mePlayer(c), meinPlatz = myRank(c);
  const platz = new Map(rang.filter((p) => !p.me).map((p) => [p.ref, p.rank]));
  const alle = [...platz.keys()];                                           // bester zuerst
  const frei = new Set(alle);
  const felder = [];
  const plaetze = (def) => def.draw - (meinDef && def.id === meinDef.id ? 1 : 0);
  const neu = (def) => { const f = { def, liste: [] }; felder.push(f); return f; };
  const nimm = (f, p) => { f.liste.push(p); frei.delete(p); };

  if (gross && gross.cat === 'F') {
    neu(gross).liste = finalsFeld(c).map((p) => p.ref || ich);
  } else if (gross) {
    // Großes Turnier: Die Besten der Rangliste sind direkt dabei, die letzten Plätze gehen an Qualifikanten.
    const f = neu(gross), n = plaetze(gross), direkt = Math.min(gross.direkt, n);
    for (const p of [...alle.slice(0, direkt), ...zufall(alle.slice(direkt, direkt + 80), n - direkt)]) nimm(f, p);
  }
  // Die kleineren Turniere der Woche, das größte zuerst
  // Auf der Welt gibt es jede Woche mehr Challenger und ITF-Turniere, als in unserem Kalender stehen.
  // Damit auch die Spieler weiter hinten genug Punkte sammeln können, laufen ein paar davon unsichtbar mit.
  const sichtbar = KLEINE_TURNIERE.filter((t) => t.woche === c.week);
  const dazu = [...sichtbar.filter((t) => t.cat === 'CH').slice(0, CHALLENGER_DAZU), ...sichtbar.filter((t) => t.stufe === 'M25').slice(0, 1)]
    .map((t) => ({ ...t, id: t.id + 'x', name: 'Anderes ' + t.catName + '-Turnier' }));
  const kleine = [...sichtbar, ...dazu].sort((a, b) => b.points.W - a.points.W).map(neu);
  if (meinDef && meinDef.cat === 'LIGA') neu(meinDef);
  const will = new Set();
  for (const p of [...frei]) {
    const r = platz.get(p);
    // In der zweiten Woche eines großen Turniers sind die Besten noch dort beschäftigt.
    if ((W.zweite && r <= 60) || Math.random() > SPIELT_OFT(r)) continue;
    will.add(p);
    // Das größte Turnier nehmen, bei dem der Platz reicht und noch etwas frei ist (manchmal auch ein kleineres)
    const ziel = kleine.find((f) => r <= f.def.bisPlatz && r >= f.def.abPlatz && f.liste.length < plaetze(f.def) - QUALI && Math.random() < 0.65);
    if (ziel) nimm(ziel, p);
  }
  // Die restlichen Plätze: Qualifikanten. Das sind die nächstbesten Spieler, die diese Woche spielen wollen –
  // und wenn das nicht reicht, wer vom Platz her am besten zu diesem Turnier passt.
  for (const f of kleine) {
    const def = f.def, fehlt = () => plaetze(def) - f.liste.length;
    if (def.cat === 'LIGA') continue;
    const passt = (p) => platz.get(p) >= def.abPlatz && platz.get(p) <= def.bisPlatz * 2.5;
    for (const p of zufall([...frei].filter((p) => will.has(p) && passt(p)).slice(0, fehlt() * 3), fehlt())) nimm(f, p);
    const mitte = f.liste.length ? platz.get(f.liste[f.liste.length - 1]) : def.abPlatz;
    for (const p of [...frei].filter((p) => platz.get(p) >= def.abPlatz).sort((a, b) => Math.abs(platz.get(a) - mitte) - Math.abs(platz.get(b) - mitte)).slice(0, Math.max(0, fehlt()))) nimm(f, p);
  }
  for (const f of felder) {
    const def = f.def;
    if (def.cat === 'F') continue;
    if (def.cat === 'LIGA') {
      // Liga-Spiel: ein einziger Gegner vom anderen Verein
      const pool = NACHWUCHS.filter((p) => staerke(p) >= def.staerke[0] && staerke(p) <= def.staerke[1]);
      f.liste = zufall(pool, 1);
    }
    // Setzliste: nach Weltranglistenplatz
    if (meinDef && def.id === meinDef.id) f.liste.push(ich);
    f.liste.sort((a, b) => (a.me ? meinPlatz : platz.get(a)) - (b.me ? meinPlatz : platz.get(b)));
  }
  return felder;
}

// Ein Turnier ohne dich ausrechnen und allen Profis ihre Punkte geben. Gibt den Namen des Siegers zurück.
// Jeder Spieler ist bei jedem Turnier mal besser und mal schlechter drauf.
const mitForm = (liste) => liste.map((p) => {
  if (p.me) return p;
  const f = (Math.random() + Math.random() + Math.random() - 1.5) * 2 * FORM, st = {};
  for (const k in p.stats) st[k] = p.stats[k] + f;
  return { ...p, stats: st };
});
function turnierAusrechnen(c, feld) {
  const G = createTournament(feld.def, mitForm(feld.liste), null);
  simulateRest(G);
  punkteVerteilen(c, G, feld.def);
  return G.players[G.champion].name;
}
function punkteVerteilen(c, T, def) {
  const a = jetzt(c), k = kVon(def);
  for (const id of Object.keys(T.players)) {
    if (id === 'me' || !c.erg[id]) continue;
    const p = payout(T, id, def).points;
    if (p || k) eintragen(c, id, k ? { a, p, k } : { a, p });      // 0 Punkte bei einem kleinen Turnier: muss man sich nicht merken
  }
  if (def.cat === 'GS') {
    if (!c.slams || c.slams.jahr !== c.season) c.slams = { jahr: c.season, wer: {} };
    c.slams.wer[def.id] = T.champion;
  }
}

// Die Welt spielt ihre Woche (einmal pro Woche). Gibt die Felder zurück – dein eigenes Turnier ist noch nicht gespielt.
function weltWoche(c, meinDef) {
  const felder = wochenFelder(c, meinDef);
  c.welt = { a: jetzt(c), sieger: null, name: null };
  for (const f of felder) {
    if ((meinDef && f.def.id === meinDef.id) || f.def.cat === 'LIGA') continue;
    const sieger = turnierAusrechnen(c, f);
    if (!f.def.klein) { c.welt.sieger = sieger; c.welt.name = f.def.name; }
  }
  // Alte Ergebnisse der Profis wegwerfen (älter als ein Jahr), damit der Spielstand klein bleibt
  const alt = jetzt(c) - WOCHEN_PRO_JAHR;
  for (const p of ALLE) c.erg[p.id] = c.erg[p.id].filter((e) => e.a >= alt);
  c.erg.me = c.erg.me.filter((e) => e.a >= alt - WOCHEN_PRO_JAHR);
  return felder;
}

// Geld der Woche: Sponsoren zahlen, Reise und Team kosten. Gibt die Rechnung zurück –
// oder null, wenn das Geld für die Reise nicht reicht.
function wocheBezahlen(c, def) {
  const turnier = !!def && def.cat !== 'LIGA';
  const sp = turnier ? sponsorGeld(c) : { summe: 0, posten: [] };
  const reise = reiseKosten(c, def);
  let team = lohn(c), teamWeg = false;
  if (c.money + sp.summe < reise.summe + team) {
    if (turnier) return null;
    // Zu Hause und kein Geld für das Team: Trainer und Physio suchen sich einen anderen Spieler.
    teamWeg = team > 0; team = 0; c.trainer = 't0'; c.physio = 'p0';
  }
  c.money += sp.summe - reise.summe - team;
  return { sponsor: sp.summe, sponsoren: sp.posten, flug: reise.flug, hotel: reise.hotel, essen: reise.essen, team, teamWeg, bespannen: 0, leihe: 0 };
}

// Lässt du gerade ein Pflichtturnier aus, bei dem du mitspielen dürftest? Dann gibt es dafür 0 Punkte, die mitzählen.
function pflichtVerpasst(c, meinDef) {
  const gross = grossDerWoche(c);
  if (c.verletzung) return null;       // Wer verletzt ist, muss nicht antreten
  if (!gross || !istPflicht(gross) || (meinDef && meinDef.id === gross.id) || !zugang(c, gross).ok) return null;
  return gross;
}

// Zum Turnier reisen und es beginnen. defId: welches Turnier (ohne Angabe: das große der Woche).
// Gibt das Turnier zurück – oder null, wenn du nicht mitspielen darfst oder das Geld nicht reicht.
export function startTournament(c, defId, mitWildcard = false) {
  const def = defId ? tournamentById(defId) : grossDerWoche(c);
  if (!def || c.verletzung) return null;   // verletzt: erst gesund werden
  const z = zugang(c, def);
  if (!z.ok && !(mitWildcard && z.wildcard)) return null;
  if (fehltFuer(c, def).some((f) => f.muss)) return null;    // ohne passende Schuhe geht es nicht
  const verpasst = pflichtVerpasst(c, def);
  const rechnung = wocheBezahlen(c, def);
  if (!rechnung) return null;
  if (!z.ok) { c.wildcards--; rechnung.wildcard = true; }
  c.ort = erdteil(c, def);
  if (def.cat !== 'LIGA') c.frische = begrenzen(c.frische + REISEN[c.reise].frische, 0, 100);
  // Wimbledon: Wer kein weißes Outfit hat, muss sich eins leihen.
  const outfit = traegt(c, 'Outfit');
  if (def.id === 'wim' && !(outfit && outfit.weiss)) { rechnung.leihe = WIMBLEDON_LEIHE; c.money -= WIMBLEDON_LEIHE; }
  c.rechnung = rechnung;
  c.verpasst = verpasst ? verpasst.id : null;
  c.matchesWoche = 0;
  c.tiefFrische = 100;
  const meins = weltWoche(c, def).find((f) => f.def.id === def.id);
  c.tournament = createTournament(def, mitForm(meins.liste), 'me');
  saveCareer(c);
  return c.tournament;
}
export const ligaSpiel = (c) => startTournament(c, LIGA.id);

// Nach jedem deiner Matches: Du wirst müder, die Saiten auch – und du sammelst Erfahrung.
// Gibt zurück, wie viele Level du aufgestiegen bist.
export function matchGespielt(c, gewonnen, runde = 1) {
  // Bei den Turnieren über zwei Wochen ist zwischen den Matches ein freier Tag: Das kostet weniger Kraft.
  const ruhetag = c.tournament && zweiWochen(c.tournament.defId);
  // Ausdauer: Wer viel Ausdauer hat, den kostet ein Match weniger Frische (bei 52 wie bisher, bei 92 nur noch 60 %).
  const ausdauer = 1 - (c.skills.a - 52) / 100;
  // Für den Körper (ausbau.js): Wie viele Matches waren es diese Woche, und wie müde bist du dabei angetreten?
  c.matchesWoche = (c.matchesWoche || 0) + 1;
  c.tiefFrische = Math.min(c.tiefFrische ?? 100, c.frische);
  c.frische = begrenzen(c.frische - Math.round(meinPhysio(c).last * (ruhetag ? RUHETAG : 1) * ausdauer), 0, 100);
  c.tag = null;                        // der Tag ist vorbei, seine Pluspunkte auch
  c.abend = null;
  c.abendOffen = !!gewonnen;           // nach einem Sieg darfst du dir aussuchen, was du am Abend machst
  if (gewonnen) c.siege++;
  const saite = traegt(c, 'Saiten');
  if (saite && c.saitenRest > 0) {
    c.saitenRest--;
    // Saite müde? Dann wird gleich neu bespannt (wenn das Geld reicht).
    if (c.saitenRest === 0) {
      const frei = gratis(c, saite);
      if (bespannen(c, saite.id) && !frei && c.rechnung) c.rechnung.bespannen += saite.price;
    }
  }
  return addXp(c, gewonnen ? 40 + 15 * Math.min(runde, 5) : 15);
}
const RUHETAG = 0.6;                   // geschätzt
export const VORBEREITUNG_XP = 120;    // so viel Erfahrung bringt eine Woche Saisonvorbereitung (geschätzt)

// Neue Geldgeber? Gibt die Liste der neuen zurück.
function neueGeldgeber(c, platz) {
  const neu = [];
  for (const g of GELDGEBER) {
    if (c.sponsoren.includes(g.id)) continue;
    const w = g.wenn;
    if ((w.siege && c.siege < w.siege) || (w.titel && c.titles < w.titel) || (w.platz && platz > w.platz)) continue;
    c.sponsoren.push(g.id);
    neu.push(g);
  }
  return neu;
}

// Die Woche abschließen: erholen, nächste Woche, vielleicht neue Sponsoren.
// wochen = 2: Du warst bei einem großen Turnier bis in die zweite Woche dabei.
function wocheFertig(c, summary, erholung, wochen = 1) {
  const vorher = myRank(c);
  summary.season = c.season;
  summary.w = c.week;
  // Ein Pflichtturnier ausgelassen? Dann zählen dafür 0 Punkte.
  const verpasst = c.verpasst ? tournamentById(c.verpasst) : null;
  if (verpasst) eintragen(c, 'me', { a: jetzt(c), p: 0, k: 1, n: verpasst.name + ' (nicht angetreten)', cat: verpasst.cat });
  summary.verpasst = verpasst ? verpasst.name : null;
  c.verpasst = null;
  // Diese Punkte sind jetzt ein Jahr alt und fallen aus der Rangliste
  summary.weg = zuVerteidigen(c, wochen).filter((e) => e.zaehlt);
  if (c.welt && c.welt.a === jetzt(c) && c.welt.sieger && !summary.grossSieger) { summary.grossSieger = c.welt.sieger; summary.grossName = c.welt.name; }
  // Der Körper: Nach einer Woche mit Matches kann etwas zwicken – oder Schlimmeres. Eine Woche ohne Match heilt Beschwerden.
  if (c.matchesWoche) {
    c.serie = (c.serie || 0) + wochen;
    const k = koerperWoche(c, { matches: c.matchesWoche, tiefFrische: c.tiefFrische ?? 100, serie: c.serie, physio: PHYSIOS.indexOf(meinPhysio(c)) });
    summary.beschwerden = k.beschwerden || null;
    summary.verletzung = k.verletzung || null;
  } else {
    c.serie = 0;
    summary.geheilt = ausheilen(c);
  }
  c.matchesWoche = 0;
  c.tiefFrische = 100;
  c.abend = null;
  c.abendOffen = false;
  c.frische = begrenzen(c.frische + erholung, 0, 100);
  c.tournament = null;
  c.trainingLeft = meinTrainer(c).training;
  for (let i = 0; i < wochen; i++) {
    c.week++;
    if (c.week >= WOCHEN_PRO_JAHR) { c.week = 0; c.season++; c.wildcards = WILDCARDS_PRO_SAISON; summary.seasonOver = true; c.plan = { jahr: c.season, wochen: {} }; }
    // In der zweiten Woche spielt die Welt ohne dich weiter (du bist ja noch beim großen Turnier)
    if (i < wochen - 1) weltWoche(c, null);
  }
  c.stand = (c.stand || 0) + 1;
  summary.zweiteWoche = wochen > 1;
  const rk = myRank(c);
  c.bestRank = Math.min(c.bestRank, rk);
  summary.rank = rk;
  summary.vorher = vorher;
  summary.neueSponsoren = neueGeldgeber(c, rk);
  summary.neueTeile = sonderPruefen(c, rk);
  // Frisch verletzt? Dann ausrechnen, wie viele Punkte in der Zwangspause aus der Rangliste fallen.
  if (summary.verletzung) summary.punkteInGefahr = zuVerteidigen(c, summary.verletzung.wochen).filter((e) => e.zaehlt).reduce((x, e) => x + e.p, 0);
  const r = summary.rechnung;
  summary.netto = summary.money + r.sponsor - r.flug - r.hotel - r.essen - r.team - r.bespannen - r.leihe;
  c.history.push({ season: summary.season, w: summary.w, tid: summary.tid, name: summary.name, cat: summary.cat, label: summary.label, points: summary.points, money: summary.money, netto: summary.netto });
  if (c.history.length > 160) c.history = c.history.slice(-160);
  c.rechnung = null;
  saveCareer(c);
  return summary;
}

// Bist du bei einem Turnier über zwei Wochen so weit gekommen, dass du auch die zweite Woche dort warst?
// (Grand Slam: ab dem Achtelfinale. Masters: ab dem Viertelfinale.)
const ZWEITE_WOCHE = { GS: ['R16', 'QF', 'SF', 'F', 'W'], M: ['QF', 'SF', 'F', 'W'] };

// Turnier abschließen: Punkte, Preisgeld, nächste Woche. Gibt eine Zusammenfassung zurück.
export function finishTournament(c) {
  const T = c.tournament;
  const def = tournamentById(T.defId);
  if (!T.done) simulateRest(T);
  punkteVerteilen(c, T, def);
  const mine = T.humanId ? payout(T, 'me') : { points: 0, money: 0, label: null };
  if (def.cat !== 'LIGA') eintragen(c, 'me', { a: jetzt(c), p: mine.points, k: kVon(def), n: def.name, cat: def.cat, label: mine.label });
  c.money += mine.money;
  const titel = mine.label === 'W' && def.cat !== 'LIGA';
  if (titel) c.titles++;
  // Für die Sammlung: Von jedem Turnier nimmst du ein Handtuch mit (das machen die Profis wirklich).
  let handtuch = null;
  if (def.cat !== 'LIGA' && T.humanId) {
    const n = def.klein ? `${def.catName || def.cat} ${def.city}` : def.name;
    const h = c.handtuecher.find((x) => x.n === n);
    if (h) h.mal++; else { handtuch = { n, cat: def.cat, jahr: c.season, mal: 1 }; c.handtuecher.push(handtuch); }
  }
  const lang = !def.klein && zweiWochen(def.id) && (ZWEITE_WOCHE[def.cat] || []).includes(mine.label);
  return wocheFertig(c, {
    tid: def.id, name: def.name, cat: def.cat, label: mine.label, points: mine.points, money: mine.money, titel,
    champion: T.players[T.champion].name, handtuch,
    rechnung: c.rechnung || { sponsor: 0, sponsoren: [], flug: 0, hotel: 0, essen: 0, team: 0, bespannen: 0, leihe: 0 },
  }, meinPhysio(c).erholung, lang ? 2 : 1);
}

// Eine Woche ohne Turnier. art: 'pause' (ausruhen, danach wieder ganz frisch), 'stunden' (Tennisstunden geben, bringt Geld)
// oder 'vorbereitung' (nur in der Off-Season: hart trainieren für das neue Jahr, bringt Erfahrung).
// Wer verletzt ist, kann nur eines tun: gesund werden ('reha').
export function wocheOhneTurnier(c, art) {
  if (c.verletzung) art = 'reha';
  else if (art === 'reha') art = 'pause';
  if (art === 'vorbereitung' && !WOCHEN[c.week].off) art = 'pause';
  c.verpasst = (pflichtVerpasst(c, null) || {}).id || null;
  const rechnung = wocheBezahlen(c, null);
  const geld = art === 'stunden' ? STUNDEN_GELD : 0;
  c.money += geld;
  c.ort = heimat(c);
  weltWoche(c, null);
  if (art === 'vorbereitung') addXp(c, VORBEREITUNG_XP);
  const off = WOCHEN[c.week].off;
  let reha = null;
  if (art === 'reha') {
    const v = c.verletzung;
    v.wochen--;
    reha = { name: v.name, rest: v.wochen, gesund: v.wochen <= 0 };
    if (v.wochen <= 0) c.verletzung = null;
  }
  return wocheFertig(c, {
    tid: null, name: art === 'reha' ? 'Verletzungspause' : art === 'stunden' ? 'Tennisstunden gegeben' : art === 'vorbereitung' ? 'Saisonvorbereitung' : off ? 'Urlaub' : 'Pause',
    cat: art, label: null, points: 0, money: geld, titel: false, rechnung, reha,
  }, art === 'pause' || art === 'reha' ? 100 : meinPhysio(c).erholung);
}

// ---------------------------------------------------------------
// Erfahrung und Fähigkeiten
// ---------------------------------------------------------------

// Erfahrung sammeln (ein guter Trainer macht mehr daraus). Bei jedem neuen Level gibt es Fähigkeitspunkte.
export function addXp(c, n) {
  c.xp += Math.round(n * meinTrainer(c).xp);
  let ups = 0;
  while (c.xp >= xpNeed(c.level)) {
    c.xp -= xpNeed(c.level);
    c.level++;
    c.skillPoints += PUNKTE_PRO_LEVEL;
    ups++;
  }
  saveCareer(c);
  return ups;
}
export const xpNeed = (level) => 100 + level * 40;

export function raiseSkill(c, key) {
  // Ohne Spezial-Trainer ist irgendwann Schluss (siehe grenze in ausbau.js)
  if (c.skillPoints <= 0 || c.skills[key] >= grenze(c, key)) return false;
  c.skills[key]++;
  c.skillPoints--;
  saveCareer(c);
  return true;
}

// Profi-Service: die nächste Ausbaustufe kaufen (Bespanner, Werkstatt, Ärzte, Spezial-Trainer)
export function ausbauKaufen(c, id) {
  const ok = kaufen(c, id, myRank(c));
  if (ok) saveCareer(c);
  return ok;
}
// Einen Profi-Schlag lernen
export function technikLernen(c, id) {
  const ok = lernen(c, id);
  if (ok) saveCareer(c);
  return ok;
}

// ---------------------------------------------------------------
// Siegerehrung: Pokalschrank und Siegerrede
// ---------------------------------------------------------------

// Nach einem Turniersieg sagst du einen Satz ins Mikrofon. Jede Art von Rede bringt etwas anderes (Zahlen geschätzt).
export const REDEN = {
  fans: { knopf: '„Danke an die Fans!“', satz: 'Ihr wart unglaublich. Ohne euch hätte ich das nicht geschafft!', bringt: '+1 Fan-Stern ⭐' },
  team: { knopf: '„Danke an mein Team!“', satz: 'Dieser Pokal gehört auch meinem Team. Danke für die harte Arbeit!', bringt: '+30 Erfahrung' },
  gegner: { knopf: '„Glückwunsch an meinen Gegner!“', satz: 'Du hast toll gespielt. Wir sehen uns bestimmt bald wieder in einem Finale.', bringt: '+6 Frische (du schläfst zufrieden ein)' },
};
export const REDE_FANS_MAX = 5;       // mehr Fan-Sterne gibt es durch Reden insgesamt nicht
const FOTOS_MAX = 10;                 // so viele Siegerfotos werden aufgehoben (Fotos brauchen viel Speicherplatz)

export function siegerRede(c, art) {
  if (art === 'fans') c.redeFans = Math.min(REDE_FANS_MAX, (c.redeFans || 0) + 1);
  if (art === 'team') addXp(c, 30);
  if (art === 'gegner') c.frische = begrenzen(c.frische + 6, 0, 100);
  saveCareer(c);
}

// Einen Turniersieg in den Pokalschrank stellen. def = das Turnier, art = 'gold' | 'silber' | 'stern', foto = Bild als Text (oder null)
export function pokalMerken(c, def, art, foto) {
  c.pokale.push({ name: def.name, ort: def.city || '', cat: def.cat, jahr: c.season, woche: c.week + 1, art, foto: foto || null });
  // Von den älteren Siegen bleibt nur der Eintrag, das Foto wird gelöscht
  const mitFoto = c.pokale.filter((p) => p.foto);
  for (const p of mitFoto.slice(0, Math.max(0, mitFoto.length - FOTOS_MAX))) p.foto = null;
  saveCareer(c);
}

export { SHOP };
