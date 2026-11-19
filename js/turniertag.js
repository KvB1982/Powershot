// Powershot – Der Tag vor dem Match auf der Turnieranlage (nur Regeln und Zahlen, kein three.js).
//
// Vor jedem Match in der Karriere hast du ZEIT_FENSTER freie Zeitfenster (Morgen und Mittag).
// In jedem Fenster kannst du an EINEM Ort etwas tun. Du kannst also nicht alles machen – such dir aus, was dir heute am meisten hilft.
// Danach gehst du zum Centre Court und spielst dein Match. Was du am Tag getan hast, gilt nur für dieses eine Match.
//
// Was ist echt, was geschätzt?
//   echt:      dass Profis vor dem Match einschlagen, essen, zum Physio gehen und Schläger bespannen lassen,
//              und dass es bei kleinen ITF-Turnieren fast nichts davon auf der Anlage gibt
//   geschätzt: alle Zahlen (Pluspunkte, Frische, Kosten, Fans)
//
// Pluspunkte gelten für: s = Aufschlag, p = Kraft, t = Tempo, c = Präzision, v = Volley
import { addXp, saveCareer, traegt, bespannen, gratis } from './career.js';
import { ausheilen } from './ausbau.js';
import { zweiWochen } from './kalender.js';

export const ZEIT_FENSTER = 2;
export const FENSTER_NAMEN = ['Morgen', 'Mittag', 'Match'];
// Bei den Turnieren über zwei Wochen (Grand Slam, große Masters) ist zwischen den Matches ein freier Tag: ein Zeitfenster mehr.
export const fensterVon = (def) => ZEIT_FENSTER + (def && zweiWochen(def.id) ? 1 : 0);
// Wie heißt das Zeitfenster, das gerade dran ist?
export function fensterName(c) {
  const t = c.tag || {}, max = t.max ?? ZEIT_FENSTER, frei = Math.max(0, max - (t.fenster || 0));
  if (frei <= 0) return 'Match';
  return frei > 2 ? 'Freier Tag' : FENSTER_NAMEN[2 - frei];
}
export const TAG_FANS_MAX = 6;        // so viele Fan-Sterne kann man durch Autogramme und Presse höchstens sammeln
export const AUTOGRAMME_PRO_STERN = 3;

// Wie groß ist das Turnier? 0 = ITF, 1 = Challenger und Liga, 2 = ATP-Tour und die ganz großen
export function stufeVon(def) {
  if (!def || def.cat === 'ITF') return 0;
  if (def.cat === 'CH' || def.cat === 'LIGA') return 1;
  return 2;
}

// Die Tätigkeiten. ort = Name des Ortes in anlage.js · ab = ab welcher Turnier-Stufe es das gibt ·
// frische = so ändert sich deine Frische · bonus = Pluspunkte für das Match heute · xp = Erfahrung · geld = Kosten in $
export const TAETIGKEITEN = {
  // Der Trainingsplatz ist ein echtes Minispiel: Wie gut du die Zielfelder triffst, bestimmt die Pluspunkte (siehe UEBUNGEN).
  training: { name: 'Einschlagen', ab: 0, frische: -4, spiel: true },
  // Der Kraftraum ist ein kleines Geschicklichkeitsspiel (siehe KRAFT_SPIEL): Wer sauber hebt, hat mehr davon.
  kraft: { name: 'Krafttraining', ab: 1, frische: -9, kraft: true,
    text: 'Gewichte, Sprünge, Medizinball. Du lernst viel dazu – aber so kurz vor dem Match macht es müde.',
    fehlt: 'Bei so kleinen Turnieren gibt es keinen Kraftraum. Die Tür ist zu.' },
  physio: { name: 'Massage und Tapen', ab: 1, frische: 10, text: 'Die Physiotherapeutin lockert deine Beine und klebt ein Tape auf die Schulter.',
    fehlt: 'Hier gibt es keinen Physio. Du musst dich selbst dehnen.' },
  // Im Restaurant suchst du dir selbst aus, was du isst (siehe ESSEN) – nicht alles ist vor einem Match gut.
  essen: { name: 'Etwas essen', ab: 2, wahl: 'essen', text: 'Das Buffet ist riesig. Was nimmst du?',
    fehlt: 'Ein Spieler-Restaurant gibt es erst bei den großen Turnieren. Du isst dein Brötchen vom Supermarkt.' },
  saiten: { name: 'Frisch bespannen', ab: 0, bonus: { c: 1 }, saiten: true,
    text: 'Der Besaiter zieht dir frische Saiten auf. So genau triffst du nur mit neuen Saiten.' },
  // Bei der Presse stellt ein Reporter eine Frage (siehe FRAGEN). Wie du antwortest, entscheidet über die Fans.
  presse: { name: 'Fragen der Reporter', ab: 2, wahl: 'presse', text: 'Die Reporter warten schon mit ihren Mikrofonen.',
    fehlt: 'Hier ist kein Reporter. Für die Presse musst du erst bei den großen Turnieren spielen.' },
  fans: { name: 'Autogramme geben', ab: 0, autogramm: true, text: 'Du unterschreibst Bälle und Kappen. Die Kinder strahlen.' },
};

// Die zwei Übungen auf dem Trainingsplatz. modus = Spielart in match.js · baelle = so viele Bälle ·
// stufen = [ab welchem Anteil der möglichen Punkte, Pluspunkte, Satz dazu] – die erste passende Zeile gilt
export const UEBUNGEN = {
  einschlagen: { name: 'Einschlagen mit der Ballmaschine', kurz: '10 Bälle auf die Zielfelder', modus: 'ballmaschine', baelle: 10, stufen: [
    [0.5, { c: 2, p: 1 }, 'Was für ein Einschlagen! Heute triffst du alles.'],
    [0.25, { c: 1, p: 1 }, 'Gut eingeschlagen. Dein Arm ist warm und die Bälle kommen genau.'],
    [0, { c: 1 }, 'Ein paar Bälle gingen daneben, aber du bist jetzt wach.']] },
  aufschlag: { name: 'Aufschlag üben', kurz: '8 Aufschläge auf die Zielfelder', modus: 'aufschlag', baelle: 8, stufen: [
    [0.5, { s: 2 }, 'Dein Aufschlag sitzt heute wie angenagelt!'],
    [0.25, { s: 1 }, 'Der Aufschlag fühlt sich gut an.'],
    [0, {}, 'Der Aufschlag wollte heute nicht so recht. Wenigstens ist die Schulter warm.']] },
};
export const PUNKTE_PRO_BALL = 5;     // so viele Punkte gibt ein Ball höchstens (gelbes Zielfeld)

// Kraftraum: Ein Zeiger läuft über einen Balken. Drücke, wenn er im grünen Feld steht. Bei jeder Wiederholung wird das Feld kleiner.
//   stufen = [ab so vielen sauberen Wiederholungen, Pluspunkte, Erfahrung, Satz dazu]
export const KRAFT_SPIEL = { wdh: 5, breite: [0.26, 0.22, 0.18, 0.15, 0.12], dauer: 1.5, stufen: [
  [4, { s: 1, p: 1 }, 45, 'Saubere Technik bei fast jeder Wiederholung. Du fühlst dich stark!'],
  [2, { s: 1 }, 30, 'Ordentliches Training. Ein paar Wiederholungen waren wackelig.'],
  [0, {}, 15, 'Das war heute nichts. Mit schlechter Technik bringt Krafttraining wenig.']] };

// Restaurant: Was isst ein Profi vor dem Match? (Echt: viele Kohlenhydrate, wenig Fett. Die Zahlen sind geschätzt.)
export const ESSEN = [
  { name: '🍝 Nudeln mit Hähnchen', frische: 4, bonus: { t: 1 }, text: 'Richtig gewählt! Nudeln geben lange Kraft, ohne schwer im Magen zu liegen. Das essen fast alle Profis vor dem Match.' },
  { name: '🍔 Burger mit Pommes', frische: -3, text: 'Lecker – aber das viele Fett liegt schwer im Magen. Im Match fühlst du dich träge.' },
  { name: '🥗 Nur ein kleiner Salat', frische: 1, text: 'Gesund, aber viel zu wenig. Nach einer Stunde im Match hast du schon wieder Hunger.' },
  { name: '🍌 Reis, Banane und viel Wasser', frische: 3, bonus: { a: 1 }, text: 'Gute Wahl! Leicht, viel Energie, und du hast genug getrunken. So hältst du lange durch.' },
];

// Presse: Jede Antwort hat eine Art. nett = +1 Fan-Stern · witzig = klappt manchmal richtig gut, manchmal nicht · patzig = kostet einen Fan-Stern
export const FRAGEN = [
  { frage: 'Ihr nächster Gegner sagt, er habe keine Angst vor Ihnen. Was sagen Sie dazu?', antworten: [
    ['nett', 'Er ist ein starker Spieler. Ich freue mich auf ein gutes Match.'],
    ['witzig', 'Angst muss er nicht haben – nur schnelle Beine!'],
    ['patzig', 'Der soll erst mal ein Match gegen mich gewinnen.']] },
  { frage: 'Gestern haben Sie einen ganz einfachen Ball ins Netz geschlagen. Was war da los?', antworten: [
    ['patzig', 'Nächste Frage. Haben Sie selbst schon mal Tennis gespielt?'],
    ['nett', 'Das passiert jedem. Ich habe daraus gelernt und heute extra geübt.'],
    ['witzig', 'Der Ball wollte unbedingt das Netz kennenlernen.']] },
  { frage: 'Wie gefällt Ihnen unsere Stadt?', antworten: [
    ['witzig', 'Bisher kenne ich nur Hotel, Tennisplatz und Nudelteller – aber die Nudeln sind super!'],
    ['patzig', 'Ich bin zum Arbeiten hier, nicht für Urlaub.'],
    ['nett', 'Die Leute sind sehr freundlich, und die Anlage ist toll. Ich komme gern wieder.']] },
  { frage: 'Viele Kinder schauen Ihnen zu. Haben Sie einen Tipp für sie?', antworten: [
    ['nett', 'Habt Spaß am Spiel und übt jeden Tag ein bisschen. Dann wird man von ganz allein besser.'],
    ['witzig', 'Esst euer Gemüse – und hört auf euren Trainer. Meistens.'],
    ['patzig', 'Dafür habe ich jetzt keine Zeit.']] },
  { frage: 'Sie stehen in der Rangliste weit hinter Ihrem Gegner. Haben Sie überhaupt eine Chance?', antworten: [
    ['patzig', 'Was für eine dumme Frage.'],
    ['witzig', 'Die Rangliste spielt zum Glück nicht mit – auf dem Platz stehen nur er und ich.'],
    ['nett', 'Er ist der Favorit. Aber ich gebe alles, und im Tennis ist immer etwas möglich.']] },
];
export const ANTWORT_SATZ = {
  nett: 'Die Reporter nicken. Morgen steht etwas Nettes über dich in der Zeitung.',
  witzigGut: 'Alle im Raum lachen! Das Video davon sehen heute Abend Tausende.',
  witzigSchlecht: 'Keiner lacht. Na ja – einen Versuch war es wert.',
  patzig: 'Stille im Raum. Morgen steht in der Zeitung, du seist unfreundlich.',
};

// ---------------------------------------------------------------
// Zufälle: Nicht jeder Turniertag läuft nach Plan. Manchmal passiert morgens etwas (ungefähr an jedem zweiten Tag).
// ---------------------------------------------------------------
//   ab = ab welcher Turnier-Stufe · wahl = die Antworten: [Knopf, Folgen, Satz dazu]
//   Folgen: frische, bonus (für das Match heute), fenster (+1 = ein Zeitfenster mehr), geld, xp, autogramme
export const EREIGNIS_CHANCE = 0.5;
export const EREIGNISSE = {
  regen: { ab: 0, bild: '🌧️', text: 'Es regnet. Alle Matches fangen später an – du hast heute mehr Zeit.', wahl: [
    ['Gut, mehr Zeit!', { fenster: 1 }, 'Ein Zeitfenster mehr.']] },
  stau: { ab: 0, bild: '🚗', text: 'Stau auf dem Weg zur Anlage! Der Fahrdienst kommt nicht voran.', wahl: [
    ['Warten', { fenster: -1 }, 'Du kommst spät an. Ein Zeitfenster ist weg.'],
    ['Aussteigen und den Rest joggen', { frische: -4 }, 'Du bist pünktlich, aber schon ein bisschen aus der Puste.']] },
  kind: { ab: 0, bild: '🧒', text: 'Am Eingang steht ein Kind und fragt schüchtern nach deinem Schweißband.', wahl: [
    ['Schenken und ein Foto machen', { autogramme: 2 }, 'Das Kind strahlt. So etwas erzählt es noch in zehn Jahren.'],
    ['Keine Zeit, weitergehen', {}, 'Du gehst weiter. Das Kind schaut dir nach.']] },
  partner: { ab: 1, bild: '🤝', text: 'Ein bekannter Spieler hat keinen Partner zum Einschlagen und fragt dich.', wahl: [
    ['Klar, gern!', { bonus: { c: 1 }, frische: -3, xp: 15 }, 'Zwanzig Minuten mit einem richtig guten Spieler. Dein Timing ist danach super.'],
    ['Lieber nicht', {}, 'Du bleibst bei deinem eigenen Plan.']] },
  tasche: { ab: 0, bild: '🧳', text: 'Deine Schlägertasche ist am Flughafen hängen geblieben!', wahl: [
    ['Taxi schicken und holen lassen (80 $)', { geld: -80 }, 'Eine Stunde später ist die Tasche da. Alles gut.'],
    ['Mit einem Leihschläger spielen', { bonus: { c: -1 } }, 'Der fremde Schläger fühlt sich komisch an.']] },
  hitze: { ab: 0, bild: '☀️', text: 'Heute ist es sehr heiß. Schon beim Aufwärmen läuft dir der Schweiß.', wahl: [
    ['Viel trinken und im Schatten bleiben', {}, 'Klug. So bleibt dein Körper kühl.'],
    ['Egal, ich bin fit', { frische: -6 }, 'Zu wenig getrunken: Dir ist schon vor dem Match ein bisschen schwindelig.']] },
  sponsor: { ab: 2, bild: '📸', text: 'Dein Sponsor möchte ein paar Fotos mit dir machen. Das dauert eine Weile, wird aber bezahlt.', wahl: [
    ['Hingehen (+500 $)', { geld: 500, fenster: -1 }, 'Lächeln, Schläger halten, noch mal lächeln. Ein Zeitfenster ist weg.'],
    ['Absagen – das Match geht vor', {}, 'Der Sponsor versteht das.']] },
};

// ---------------------------------------------------------------
// Der Abend nach einem gewonnenen Match (das Turnier geht für dich weiter): Was machst du?
// ---------------------------------------------------------------
export const ABEND = {
  schlafen: { name: '😴 Früh schlafen gehen', bringt: '+6 Frische', frische: 6, text: 'Um neun liegst du im Bett. Am Morgen bist du ausgeruht.' },
  video: { name: '🎬 Den nächsten Gegner auf Video ansehen', bringt: '+2 Taktik im nächsten Match', bonus: { k: 2 }, text: 'Du weißt jetzt, wohin er am liebsten aufschlägt und welche Seite schwächer ist.' },
  team: { name: '🍽️ Mit dem Team essen gehen', bringt: '+25 Erfahrung', xp: 25, text: 'Ihr sprecht das Match noch einmal durch. Dabei lernst du viel.' },
  fans: { name: '📱 Den Fans im Internet antworten', bringt: 'zählt wie einmal Autogramme geben', autogramme: 1, text: 'Du beantwortest eine Stunde lang Nachrichten. Die Fans freuen sich riesig.' },
};

// Folgen anwenden (für Zufälle und den Abend). Gibt Sätze zurück, was sich geändert hat.
function folgen(c, F) {
  const bringt = [];
  if (F.frische) { c.frische = Math.max(0, Math.min(100, c.frische + F.frische)); bringt.push(`Frische ${F.frische > 0 ? '+' : '−'}${Math.abs(F.frische)}`); }
  if (F.geld) { c.money = Math.max(0, c.money + F.geld); bringt.push(`${F.geld > 0 ? '+' : '−'} ${Math.abs(F.geld)} $`); }
  if (F.autogramme) for (let i = 0; i < F.autogramme; i++) {
    c.autogramme = (c.autogramme || 0) + 1;
    if (c.autogramme % AUTOGRAMME_PRO_STERN === 0 && (c.tagFans || 0) < TAG_FANS_MAX) { c.tagFans = (c.tagFans || 0) + 1; bringt.push('+1 Fan-Stern ⭐'); }
  }
  if (F.xp) { addXp(c, F.xp); bringt.push(`+${F.xp} Erfahrung`); }
  return bringt;
}

// Alte Spielstände kennen den Tag noch nicht
function tag(c) {
  if (!c.tag) c.tag = { fenster: 0, getan: [], bonus: {} };
  c.tagFans = c.tagFans || 0;
  c.autogramme = c.autogramme || 0;
  return c.tag;
}

// Ein neuer Tag beginnt (vor jedem Match). def = das Turnier. Vielleicht passiert heute etwas Besonderes (ereignis).
export function tagStart(c, def, zufall = Math.random) {
  c.tag = { fenster: 0, getan: [], bonus: {}, max: fensterVon(def), frage: Math.floor(zufall() * FRAGEN.length), ereignis: null };
  tag(c);
  if (zufall() < EREIGNIS_CHANCE) {
    const moeglich = Object.keys(EREIGNISSE).filter((id) => EREIGNISSE[id].ab <= stufeVon(def) && id !== c.letztesEreignis);
    c.tag.ereignis = moeglich[Math.floor(zufall() * moeglich.length)] || null;
    c.letztesEreignis = c.tag.ereignis;
  }
  saveCareer(c);
  return c.tag;
}
// Das Ereignis von heute, solange du noch nicht entschieden hast (oder null)
export const ereignis = (c) => (c.tag && c.tag.ereignis ? { id: c.tag.ereignis, ...EREIGNISSE[c.tag.ereignis] } : null);
// Beim Ereignis eine Antwort wählen. Gibt { text, bringt } zurück.
export function ereignisWahl(c, nr) {
  const E = ereignis(c), W = E && E.wahl[nr];
  if (!W) return null;
  const F = W[1], t = c.tag, bringt = folgen(c, F);
  if (F.fenster) { t.max = Math.max(0, (t.max ?? ZEIT_FENSTER) + F.fenster); bringt.push(F.fenster > 0 ? 'ein Zeitfenster mehr' : 'ein Zeitfenster weniger'); }
  if (F.bonus) { for (const k in F.bonus) t.bonus[k] = (t.bonus[k] || 0) + F.bonus[k]; bringt.push('wirkt im Match heute'); }
  t.ereignis = null;
  saveCareer(c);
  return { text: W[2], bringt };
}

// Der Abend nach einem gewonnenen Match. Gibt { text, bringt } zurück.
export function abend(c, id) {
  const A = ABEND[id];
  if (!A || !c.abendOffen) return null;
  const bringt = folgen(c, A);
  if (A.bonus) { c.abend = { bonus: A.bonus }; bringt.push(A.bringt); }
  c.abendOffen = false;
  saveCareer(c);
  return { text: A.text, bringt };
}

// --- Leben auf dem Gelände ---
// Der Glücksball: An jedem Turniertag liegt irgendwo auf dem Gelände ein goldener Ball. Wer ihn findet, geht mit einem
// guten Gefühl ins Match (+1 Mental, nur heute). Gibt die Liste zurück, was er bringt – oder null, wenn er schon gefunden ist.
export const GLUECKSBALL = { bonus: { m: 1 }, xp: 5 };
export const ballGefunden = (c) => !!tag(c).ball;
export function gluecksball(c) {
  const t = tag(c);
  if (t.ball) return null;
  t.ball = true;
  for (const k in GLUECKSBALL.bonus) t.bonus[k] = (t.bonus[k] || 0) + GLUECKSBALL.bonus[k];
  addXp(c, GLUECKSBALL.xp);
  saveCareer(c);
  return ['+1 Mental im Match heute', `+${GLUECKSBALL.xp} Erfahrung`];
}
// Eine Sehenswürdigkeit zum ersten Mal entdeckt (blauer Kreis ℹ️): ein bisschen Erfahrung
export const ENTDECKT_XP = 4;
export function entdeckt(c) { addXp(c, ENTDECKT_XP); saveCareer(c); return [`+${ENTDECKT_XP} Erfahrung`]; }

export const freieFenster = (c) => Math.max(0, (tag(c).max ?? ZEIT_FENSTER) - tag(c).fenster);

// Darf ich das jetzt tun? Gibt { ok, warum } zurück.
export function kann(c, ort, def) {
  const T = TAETIGKEITEN[ort], t = tag(c);
  if (!T) return { ok: false, warum: '' };
  if (stufeVon(def) < T.ab) return { ok: false, warum: T.fehlt || 'Das gibt es bei diesem Turnier nicht.' };
  if (t.getan.includes(ort)) return { ok: false, warum: 'Hier warst du heute schon.' };
  if (freieFenster(c) <= 0) return { ok: false, warum: 'Keine Zeit mehr – dein Match fängt gleich an. Geh zum Centre Court!' };
  if (T.saiten) {
    const saite = traegt(c, 'Saiten');
    if (!saite) return { ok: false, warum: 'Du hast noch keine Saiten. Kauf zuerst welche unter „Ausrüstung“.' };
    if (!gratis(c, saite) && c.money < saite.price) return { ok: false, warum: 'Dafür reicht dein Geld gerade nicht.' };
  }
  return { ok: true, warum: '' };
}

// Etwas tun. Gibt eine Liste mit Sätzen zurück, was es gebracht hat (oder null, wenn es nicht geht).
// spiel = beim Trainingsplatz: { uebung: 'einschlagen' | 'aufschlag', punkte } – das Ergebnis des Minispiels
//         im Kraftraum: { treffer } · im Restaurant und bei der Presse: { wahl: Nummer der Antwort, zufall }
export function tun(c, ort, def, spiel) {
  if (!kann(c, ort, def).ok) return null;
  let T = TAETIGKEITEN[ort];
  const t = tag(c), bringt = [];
  if (T.spiel) {
    const U = UEBUNGEN[spiel && spiel.uebung];
    if (!U) return null;
    const anteil = Math.max(0, Math.min(1, spiel.punkte / (U.baelle * PUNKTE_PRO_BALL)));
    const stufe = U.stufen.find((s) => anteil >= s[0]);
    T = { ...T, bonus: stufe[1], xp: 10 + Math.round(20 * anteil) };
    bringt.push(stufe[2]);
  }
  if (T.kraft) {
    const n = Math.max(0, Math.min(KRAFT_SPIEL.wdh, (spiel && spiel.treffer) || 0));
    const stufe = KRAFT_SPIEL.stufen.find((s) => n >= s[0]);
    T = { ...T, bonus: stufe[1], xp: stufe[2] };
    bringt.push(`${n} von ${KRAFT_SPIEL.wdh} sauber. ${stufe[3]}`);
  }
  if (T.wahl === 'essen') {
    const E = ESSEN[spiel && spiel.wahl];
    if (!E) return null;
    T = { ...T, frische: E.frische, bonus: E.bonus };
    bringt.push(E.text);
  }
  if (T.wahl === 'presse') {
    const A = (FRAGEN[t.frage || 0] || FRAGEN[0]).antworten[spiel && spiel.wahl];
    if (!A) return null;
    let art = A[0];
    if (art === 'witzig') art = ((spiel && spiel.zufall) || Math.random)() < 0.6 ? 'witzigGut' : 'witzigSchlecht';
    bringt.push(ANTWORT_SATZ[art]);
    if (art === 'nett') T = { ...T, fans: 1 };
    if (art === 'witzigGut') T = { ...T, fans: 1, xp: 10 };
    if (art === 'patzig' && c.tagFans > 0) { c.tagFans--; bringt.push('−1 Fan-Stern'); }
  }
  if (T.saiten) {
    const saite = traegt(c, 'Saiten'), frei = gratis(c, saite);
    bespannen(c, saite.id);
    bringt.push(frei ? 'Gratis – das zahlt dein Ausrüster.' : `Kostet ${saite.price} $.`);
  }
  if (T.frische) {
    c.frische = Math.max(0, Math.min(100, c.frische + T.frische));
    bringt.push(`Frische ${T.frische > 0 ? '+' : '−'}${Math.abs(T.frische)}`);
  }
  // Die Physiotherapeutin behandelt auch, was gerade zwickt
  if (ort === 'physio' && c.koerper) { const teil = c.koerper.teil; ausheilen(c); bringt.push(`Deine Beschwerden sind weg (${teil}).`); }
  if (T.bonus && Object.keys(T.bonus).length) {
    for (const k in T.bonus) t.bonus[k] = (t.bonus[k] || 0) + T.bonus[k];
    bringt.push('Pluspunkte für das Match heute');
  }
  if (T.fans && c.tagFans < TAG_FANS_MAX) { c.tagFans += T.fans; bringt.push('+1 Fan-Stern ⭐'); }
  if (T.autogramm) {
    c.autogramme++;
    if (c.autogramme % AUTOGRAMME_PRO_STERN === 0 && c.tagFans < TAG_FANS_MAX) { c.tagFans++; bringt.push('+1 Fan-Stern ⭐'); }
    else bringt.push(`Noch ${AUTOGRAMME_PRO_STERN - c.autogramme % AUTOGRAMME_PRO_STERN} Mal Autogramme geben bis zum nächsten Fan-Stern`);
  }
  if (T.xp) { addXp(c, T.xp); bringt.push(`+${T.xp} Erfahrung`); }
  t.getan.push(ort);
  t.fenster++;
  saveCareer(c);
  return bringt;
}
