// Powershot – Karriere: eigener Spieler, Weltrangliste, Geld, Ausrüstung, Team, Sponsoren, Reisen
//
// Die Idee: Du fängst ganz unten an (ITF-Turniere, kaum Preisgeld) und arbeitest dich hoch.
// Jede Turnierwoche entscheidest du: Wohin reise ich? Kann ich mir den Flug leisten? Bin ich noch frisch?
// Diese Datei rechnet nur – sie zeichnet nichts. Darum kann man sie ohne Browser testen (tools/logic.mjs).

import { PLAYERS, TOURNAMENTS, tournamentById, playerById } from './data.js';
import { createTournament, payout, simulateRest } from './tournament.js';
import {
  KLEINE_TURNIERE, LIGA, NACHWUCHS, STUFEN, BIS_PLATZ_GROSS, ERDTEIL_GROSS, HEIMAT,
  flugPreis, HOTEL_WOCHE, ESSEN_WOCHE, STUNDEN_GELD,
} from './kleinetour.js';
import {
  SHOP, shopById, TRAINER, PHYSIOS, REISEN, VERTRAGS_STUFEN, VERTRAG_CATS, PROFI_AB, GELDGEBER,
  FAN_PROZENT, FAN_MAX, WIMBLEDON_LEIHE,
} from './ausruestung.js';

const KEY = 'powershot.karriere.v1';
const WEIGHT = { GS: 2, M: 1, F: 1.5 };
export const START_GELD = 4000;       // damit fängst du an (in echt helfen am Anfang oft Eltern und Verein)
export const WILDCARDS_PRO_SAISON = 2;
export const TITEL_FANS = 2;          // so viele Fan-Sterne bringt jeder Titel

export function loadCareer() {
  try { return reparieren(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return null; }
}

// Punkte des "letzten Jahres" eines Spielers auf die Turniere verteilen
function basePoints(p) {
  const slots = TOURNAMENTS.filter((t) => t.cat !== 'F' || p.rank <= 8);
  const sum = slots.reduce((s, t) => s + WEIGHT[t.cat], 0);
  const out = {};
  for (const t of slots) out[t.id] = Math.round(p.basePoints * WEIGHT[t.cat] / sum);
  return out;
}

const heimat = (c) => HEIMAT[c.country] || 'eu';
const begrenzen = (x, a, b) => Math.max(a, Math.min(b, x));

// Alte Spielstände kennen manches noch nicht (oder Dinge, die es nicht mehr gibt). Hier wird alles nachgetragen.
function reparieren(c) {
  if (!c || !c.points) return c;
  const known = new Set(['me', ...PLAYERS.map((p) => p.id)]);
  for (const id of Object.keys(c.points)) if (!known.has(id)) delete c.points[id];
  for (const p of PLAYERS) if (!c.points[p.id]) c.points[p.id] = basePoints(p);
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
  c.v = 2;
  return c;
}
export function saveCareer(c) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* kein Speicher */ }
}
export function deleteCareer() {
  try { localStorage.removeItem(KEY); } catch (e) { /* egal */ }
}

// opts: { name, country, hand, look }
export function newCareer(opts) {
  const points = {};
  for (const p of PLAYERS) points[p.id] = basePoints(p);
  points.me = {};
  return reparieren({
    name: opts.name || 'Spieler', country: opts.country || 'GER', hand: opts.hand || 1, look: opts.look,
    skills: { s: 52, p: 52, t: 52, c: 52, v: 52 }, skillPoints: 10,
    xp: 0, level: 1, money: START_GELD,
    owned: [], equipped: {},
    season: 2026, week: 0, points, tournament: null, trainingLeft: 2,
    history: [], titles: 0, bestRank: 2000,
  });
}

// ---------------------------------------------------------------
// Weltrangliste
// ---------------------------------------------------------------
const total = (slots) => Object.values(slots || {}).reduce((s, v) => s + v, 0);

// Hinter den Top 200 stehen in echt noch rund 2000 weitere Spieler. Die haben wir nicht einzeln im Spiel.
// Darum schätzen wir deinen Platz aus deinen Punkten: [Punkte, Platz]. Dazwischen wird gleichmäßig verteilt.
// (Die Zahlen sind der echten Rangliste grob nachempfunden: Mit 100 Punkten steht man ungefähr auf Platz 400.)
const KURVE = [[0, 2000], [1, 1700], [4, 1300], [10, 1000], [20, 800], [40, 600], [60, 500], [100, 400], [150, 320], [220, 250], [300, 200], [400, 160], [500, 130]];
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

// Weltrangliste: sortierte Liste mit { id, name, country, points, rank, me }
export function ranking(c) {
  const list = PLAYERS.map((p) => ({ id: p.id, name: p.name, country: p.country, points: total(c.points[p.id]), ref: p }));
  const ich = { id: 'me', name: c.name, country: c.country, points: total(c.points.me), me: true };
  list.push(ich);
  list.sort((a, b) => b.points - a.points || (a.me ? 1 : -1));
  list.forEach((p, i) => { p.rank = i + 1; });
  // Stehst du hinter allen 200 echten Spielern? Dann wird dein Platz aus den Punkten geschätzt.
  if (ich.rank > PLAYERS.length) ich.rank = platzAusPunkten(ich.points, list[PLAYERS.length - 1].points);
  return list;
}
export function myRank(c) { return ranking(c).find((p) => p.me).rank; }
export function nextTournament(c) { return TOURNAMENTS[c.week]; }

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

// Das beste Paar Schuhe aus deinem Schrank für diesen Belag
export function besteSchuhe(c, surface, stufe) {
  let best = null;
  for (const s of SHOP) if (s.cat === 'Schuhe' && hat(c, s, stufe) && (!best || s.tempo[surface] > best.tempo[surface])) best = s;
  return best;
}

// Fans (⭐): schicke Sachen und Titel machen dich beliebt. Mehr Fans = mehr Geld von den Sponsoren.
export function fans(c) {
  const stufe = vertragsStufe(c);
  let n = c.titles * TITEL_FANS + (c.redeFans || 0);
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
  const f = frischeAbzug(c.frische);
  if (Object.keys(f).length) out.push({ name: c.frische >= 95 ? 'Topfit' : 'Müde', bonus: f });
  return out;
}

export function effectiveStats(c, def) {
  const st = { ...c.skills };
  for (const e of bonusListe(c, def)) for (const k in e.bonus) st[k] += e.bonus[k];
  for (const k in st) st[k] = begrenzen(st[k], 1, 99);
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
  return { id: 'me', name: c.name, short: parts[parts.length - 1], country: c.country, stats: effectiveStats(c, def), hand: c.hand, look, me: true };
}

export function buy(c, id) {
  const item = shopById(id);
  if (!item) return false;
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

// So viele Matches hält eine frische Bespannung (eine große Tasche bringt Matches dazu)
export function saitenLeben(c, item) {
  const tasche = traegt(c, 'Tasche');
  return item.haelt + (tasche ? tasche.mehr : 0);
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

const erdteil = (c, def) => (def.cat === 'LIGA' ? heimat(c) : def.erdteil || ERDTEIL_GROSS[def.id] || 'eu');
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
  if (def.cat === 'F') return { ok: platz <= 8, bis: 8, wildcard: false };
  const bis = def.bisPlatz ?? BIS_PLATZ_GROSS[def.cat];
  if (platz <= bis) return { ok: true, bis };
  return { ok: false, bis, wildcard: c.wildcards > 0 && platz <= bis * 3 };
}
export function qualified(c, def) { return zugang(c, def).ok; }

// Alle Turniere dieser Woche, das kleinste zuerst. Jeder Eintrag: { def, zugang, kosten, fehlt }
//   fehlt = so viele Dollar fehlen dir für Reise und Team (0 = du kannst es bezahlen)
export function angebot(c) {
  const gross = nextTournament(c), platz = myRank(c), sp = sponsorGeld(c).summe;
  return [...KLEINE_TURNIERE.filter((t) => t.slot === gross.id), gross].map((def) => {
    const kosten = reiseKosten(c, def);
    return { def, zugang: zugang(c, def, platz), kosten, fehlt: Math.max(0, kosten.summe + lohn(c) - c.money - sp) };
  });
}

const zufall = (liste, n) => [...liste].sort(() => Math.random() - 0.5).slice(0, n);
const staerke = (p) => (p.stats.s + p.stats.p + p.stats.t + p.stats.c + p.stats.v) / 5;

// Wer spielt mit? Je kleiner das Turnier, desto schwächer die Gegner.
function feld(c, def) {
  const ich = mePlayer(c);
  let andere;
  if (!def.klein) {
    const r = ranking(c).filter((p) => !p.me);
    andere = r.slice(0, def.draw - (def.cat === 'F' ? 0 : 1)).map((p) => p.ref);
    if (def.cat === 'F') { andere = ranking(c).slice(0, 8).map((p) => p.ref || ich); return andere; }
  } else if (def.cat === 'A500') andere = [...zufall(PLAYERS.slice(0, 10), 3), ...zufall(PLAYERS.slice(10, 30), 5), ...zufall(PLAYERS.slice(30, 70), 7)];
  else if (def.cat === 'A250') andere = [...zufall(PLAYERS.slice(7, 25), 2), ...zufall(PLAYERS.slice(25, 50), 4), ...zufall(PLAYERS.slice(50, 100), 9)];
  else {
    const [von, bis] = (STUFEN[def.stufe] || def).staerke;
    const pool = NACHWUCHS.filter((p) => { const s = staerke(p); return s >= von - 1 && s <= bis + 1; });
    andere = zufall(pool.length >= def.draw - 1 ? pool : NACHWUCHS, def.draw - 1);
    // Bei Challengern spielen in echt vor allem die Profis von Platz 100 bis 300. Darum mischen wir
    // ein paar echte Spieler unter die erfundenen: [von Platz, bis Platz, wie viele]
    const echte = { CH75: [[140, 200, 3]], CH100: [[120, 200, 4]], CH125: [[70, 100, 3], [100, 180, 3]], CH175: [[70, 100, 3], [100, 160, 4]] }[def.stufe] || [];
    const profis = echte.flatMap(([von, bis, wie]) => zufall(PLAYERS.slice(von, bis), wie));
    andere.splice(0, profis.length, ...profis);
  }
  // Setzliste: die Stärksten zuerst
  return [...andere, ich].sort((a, b) => staerke(b) - staerke(a));
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

// Zum Turnier reisen und es beginnen. defId: welches Turnier (ohne Angabe: das große der Woche).
// Gibt das Turnier zurück – oder null, wenn du nicht mitspielen darfst oder das Geld nicht reicht.
export function startTournament(c, defId, mitWildcard = false) {
  const def = defId ? tournamentById(defId) : nextTournament(c);
  const z = zugang(c, def);
  if (!z.ok && !(mitWildcard && z.wildcard)) return null;
  const rechnung = wocheBezahlen(c, def);
  if (!rechnung) return null;
  if (!z.ok) { c.wildcards--; rechnung.wildcard = true; }
  c.ort = erdteil(c, def);
  if (def.cat !== 'LIGA') c.frische = begrenzen(c.frische + REISEN[c.reise].frische, 0, 100);
  // Wimbledon: Wer kein weißes Outfit hat, muss sich eins leihen.
  const outfit = traegt(c, 'Outfit');
  if (def.id === 'wim' && !(outfit && outfit.weiss)) { rechnung.leihe = WIMBLEDON_LEIHE; c.money -= WIMBLEDON_LEIHE; }
  c.rechnung = rechnung;
  c.tournament = createTournament(def, feld(c, def), 'me');
  saveCareer(c);
  return c.tournament;
}
export const ligaSpiel = (c) => startTournament(c, LIGA.id);

// Nach jedem deiner Matches: Du wirst müder, die Saiten auch – und du sammelst Erfahrung.
// Gibt zurück, wie viele Level du aufgestiegen bist.
export function matchGespielt(c, gewonnen, runde = 1) {
  c.frische = begrenzen(c.frische - meinPhysio(c).last, 0, 100);
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
  return addXp(c, gewonnen ? 60 + 25 * runde : 25);
}

// Das große Turnier der Woche findet auch ohne dich statt: Die anderen sammeln dort ihre Punkte.
function grossesTurnierOhneMich(c, gross) {
  const liste = ranking(c).filter((p) => !p.me).slice(0, gross.draw).map((p) => p.ref);
  const G = createTournament(gross, liste, null);
  simulateRest(G);
  for (const id of Object.keys(G.players)) c.points[id][gross.id] = payout(G, id).points;
  return G.players[G.champion].name;
}

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

// Die Woche abschließen: erholen, nächste Woche, vielleicht neue Sponsoren
function wocheFertig(c, summary, erholung) {
  const gross = nextTournament(c);
  c.frische = begrenzen(c.frische + erholung, 0, 100);
  c.tournament = null;
  c.trainingLeft = meinTrainer(c).training;
  c.week++;
  summary.season = c.season;
  summary.tid = gross.id;
  summary.seasonOver = c.week >= TOURNAMENTS.length;
  if (summary.seasonOver) { c.week = 0; c.season++; c.wildcards = WILDCARDS_PRO_SAISON; }
  const rk = myRank(c);
  c.bestRank = Math.min(c.bestRank, rk);
  summary.rank = rk;
  summary.neueSponsoren = neueGeldgeber(c, rk);
  const r = summary.rechnung;
  summary.netto = summary.money + r.sponsor - r.flug - r.hotel - r.essen - r.team - r.bespannen - r.leihe;
  c.history.push({ season: summary.season, tid: summary.tid, name: summary.name, label: summary.label, points: summary.points, money: summary.money, netto: summary.netto });
  c.rechnung = null;
  saveCareer(c);
  return summary;
}

// Turnier abschließen: Punkte, Preisgeld, nächste Woche. Gibt eine Zusammenfassung zurück.
export function finishTournament(c) {
  const T = c.tournament;
  const def = tournamentById(T.defId), gross = nextTournament(c);
  if (!T.done) simulateRest(T);
  let grossSieger = null;
  if (def.id === gross.id) {
    for (const id of Object.keys(T.players)) {
      if (!c.points[id]) c.points[id] = {};
      c.points[id][def.id] = payout(T, id).points;
    }
  } else grossSieger = grossesTurnierOhneMich(c, gross);
  const mine = T.humanId ? payout(T, 'me') : { points: 0, money: 0, label: null };
  // Deine Punkte dieser Woche ersetzen die Punkte aus derselben Woche im Vorjahr
  c.points.me[gross.id] = mine.points;
  c.money += mine.money;
  const titel = mine.label === 'W' && def.cat !== 'LIGA';
  if (titel) c.titles++;
  return wocheFertig(c, {
    name: def.name, cat: def.cat, label: mine.label, points: mine.points, money: mine.money, titel,
    champion: T.players[T.champion].name, grossSieger, grossName: gross.name,
    rechnung: c.rechnung || { sponsor: 0, sponsoren: [], flug: 0, hotel: 0, essen: 0, team: 0, bespannen: 0, leihe: 0 },
  }, meinPhysio(c).erholung);
}

// Eine Woche ohne Turnier. art: 'pause' (ausruhen, danach wieder ganz frisch) oder 'stunden' (Tennisstunden geben, bringt Geld)
export function wocheOhneTurnier(c, art) {
  const gross = nextTournament(c);
  const rechnung = wocheBezahlen(c, null);
  const geld = art === 'stunden' ? STUNDEN_GELD : 0;
  c.money += geld;
  c.ort = heimat(c);
  const grossSieger = grossesTurnierOhneMich(c, gross);
  c.points.me[gross.id] = 0;
  return wocheFertig(c, {
    name: art === 'stunden' ? 'Tennisstunden gegeben' : 'Pause', cat: art, label: null, points: 0, money: geld, titel: false,
    champion: grossSieger, grossSieger, grossName: gross.name, rechnung,
  }, art === 'pause' ? 100 : meinPhysio(c).erholung);
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
    c.skillPoints += 3;
    ups++;
  }
  saveCareer(c);
  return ups;
}
export const xpNeed = (level) => 100 + level * 40;

export function raiseSkill(c, key) {
  if (c.skillPoints <= 0 || c.skills[key] >= 95) return false;
  c.skills[key]++;
  c.skillPoints--;
  saveCareer(c);
  return true;
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
