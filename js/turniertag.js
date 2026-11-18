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

export const ZEIT_FENSTER = 2;
export const FENSTER_NAMEN = ['Morgen', 'Mittag', 'Match'];
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
  training: { name: 'Einschlagen', ab: 0, frische: -4, bonus: { c: 1, p: 1 }, xp: 15,
    text: 'Du schlägst dich eine halbe Stunde ein. Dein Arm ist warm und die Bälle kommen genau.' },
  kraft: { name: 'Krafttraining', ab: 1, frische: -9, bonus: { s: 1 }, xp: 30,
    text: 'Gewichte, Sprünge, Medizinball. Du lernst viel dazu – aber so kurz vor dem Match macht es müde.',
    fehlt: 'Bei so kleinen Turnieren gibt es keinen Kraftraum. Die Tür ist zu.' },
  physio: { name: 'Massage und Tapen', ab: 1, frische: 10, text: 'Die Physiotherapeutin lockert deine Beine und klebt ein Tape auf die Schulter.',
    fehlt: 'Hier gibt es keinen Physio. Du musst dich selbst dehnen.' },
  essen: { name: 'Nudeln essen', ab: 2, frische: 4, bonus: { t: 1 }, text: 'Ein großer Teller Nudeln mit Hähnchen. Damit hast du Kraft für lange Ballwechsel.',
    fehlt: 'Ein Spieler-Restaurant gibt es erst bei den großen Turnieren. Du isst dein Brötchen vom Supermarkt.' },
  saiten: { name: 'Frisch bespannen', ab: 0, bonus: { c: 1 }, saiten: true,
    text: 'Der Besaiter zieht dir frische Saiten auf. So genau triffst du nur mit neuen Saiten.' },
  presse: { name: 'Fragen der Reporter', ab: 2, fans: 1, text: 'Du beantwortest freundlich alle Fragen. Morgen steht dein Name in der Zeitung.',
    fehlt: 'Hier ist kein Reporter. Für die Presse musst du erst bei den großen Turnieren spielen.' },
  fans: { name: 'Autogramme geben', ab: 0, autogramm: true, text: 'Du unterschreibst Bälle und Kappen. Die Kinder strahlen.' },
};

// Alte Spielstände kennen den Tag noch nicht
function tag(c) {
  if (!c.tag) c.tag = { fenster: 0, getan: [], bonus: {} };
  c.tagFans = c.tagFans || 0;
  c.autogramme = c.autogramme || 0;
  return c.tag;
}

// Ein neuer Tag beginnt (vor jedem Match)
export function tagStart(c) {
  c.tag = { fenster: 0, getan: [], bonus: {} };
  tag(c);
  saveCareer(c);
  return c.tag;
}

export const freieFenster = (c) => Math.max(0, ZEIT_FENSTER - tag(c).fenster);

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
export function tun(c, ort, def) {
  if (!kann(c, ort, def).ok) return null;
  const T = TAETIGKEITEN[ort], t = tag(c), bringt = [];
  if (T.saiten) {
    const saite = traegt(c, 'Saiten'), frei = gratis(c, saite);
    bespannen(c, saite.id);
    bringt.push(frei ? 'Gratis – das zahlt dein Ausrüster.' : `Kostet ${saite.price} $.`);
  }
  if (T.frische) {
    c.frische = Math.max(0, Math.min(100, c.frische + T.frische));
    bringt.push(`Frische ${T.frische > 0 ? '+' : '−'}${Math.abs(T.frische)}`);
  }
  if (T.bonus) {
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
