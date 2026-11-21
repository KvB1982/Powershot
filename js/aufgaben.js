// Powershot – Aufgaben vom Team für den Turniertag (nur Regeln und Zahlen, kein three.js).
//
// Dein Team (Trainer, Fitnesstrainerin, Physio, Managerin) gibt dir an jedem Turniertag Aufgaben:
//   VOR dem Match  = 3 Aufgaben (bei Turnieren über zwei Wochen 4), zum Beispiel Warmmachen, Einschlagen, Besaiter
//   NACH dem Match = 2 Aufgaben (nur wenn du gewonnen hast und das Turnier weitergeht), zum Beispiel Dehnen und Presse
// Für jede Aufgabe gehst du auf dem Turniergelände zu einem Ort und spielst dort ein kleines Spiel.
// Wie gut du spielst (note: 0 = gar nicht, 1 = perfekt), bestimmt die Belohnung.
// Hast du ALLE Aufgaben geschafft, gibt es einen Team-Stern ⭐ und einen Bonus obendrauf.
//
// Aufgaben vom Team kosten keine Zeit. Alles andere darfst du freiwillig machen – das kostet wie bisher ein Zeitfenster.
// Niemand wird bestraft, wenn er die Aufgaben auslässt: Man kann weiter direkt „Match spielen“ drücken.
//
// Vorbild sind die Tagesaufgaben auf dem Pferdehof im Schwester-Spiel Reitturnier.
// Echt ist, DASS Profis all das an einem Turniertag tun. Alle Zahlen (Pluspunkte, Frische, Erfahrung) sind geschätzt.
import { addXp, saveCareer, traegt, bespannen, gratis } from './career.js';
import { ausheilen } from './ausbau.js';
import { stufeVon, freieFenster, fensterVon, ZEIT_FENSTER, TAG_FANS_MAX, AUTOGRAMME_PRO_STERN, TAETIGKEITEN } from './turniertag.js';

// Wer gibt die Aufgabe? name = mit eigenem Team · allein = solange du noch niemanden angestellt hast
export const TEAM = {
  trainer: { bild: '🧢', name: 'Dein Trainer', allein: 'Dein Trainingsplan' },
  fitness: { bild: '💪', name: 'Deine Fitnesstrainerin', allein: 'Dein Fitness-Plan' },
  physio: { bild: '🩹', name: 'Deine Physiotherapeutin', allein: 'Dein Dehn-Plan' },
  manager: { bild: '📱', name: 'Deine Managerin', allein: 'Die Turnierleitung' },
};
// Wie heißt der, der die Aufgabe gibt – bei diesem Spielstand?
export function werSagt(c, von) {
  const T = TEAM[von] || TEAM.trainer;
  const hatTrainer = c.trainer && c.trainer !== 't0', hatPhysio = c.physio && c.physio !== 'p0';
  const mit = von === 'physio' ? hatPhysio : von === 'trainer' ? hatTrainer : hatTrainer && c.trainer !== 't1';
  if (von === 'trainer' && c.trainer === 't1') return 'Dein Vereinstrainer (am Telefon)';
  return mit ? T.name : T.allein;
}

// Alle Aufgaben.
//   von = wer sie gibt · ort = Tür auf dem Gelände · ab = ab welcher Turnier-Stufe (0 = ITF, 1 = Challenger, 2 = ATP)
//   phase = 'vor', 'nach' oder 'beide' · spiel = welches Mini-Spiel (minispiele.js; 'platz' = auf dem echten Platz in 3D)
//   frische = kostet (−) oder bringt (+) immer · stufen = [ab welcher Note, Belohnung, Satz dazu] – die erste passende Zeile gilt
//   Belohnung: bonus (Pluspunkte fürs nächste Match), frische, xp, fans (Fan-Sterne), autogramme, druck (nur Saison)
export const AUFGABEN = {
  warm: { name: 'Warmmachen', bild: '🤸', von: 'fitness', ort: 'training', ab: 0, phase: 'vor', spiel: 'nachmachen',
    auftrag: 'Ohne Aufwärmen geht bei mir keiner auf den Platz! Mach mir die Übungen nach.',
    stufen: [
      [0.75, { bonus: { t: 1 }, xp: 15 }, 'Alle Muskeln sind warm. Du bist vom ersten Ball an schnell auf den Beinen.'],
      [0.4, { xp: 10 }, 'Halbwegs warm. Ein paar Übungen gingen durcheinander.'],
      [0, { xp: 4 }, 'Das war eher Gymnastik für Schlafmützen.']] },
  einschlagen: { name: 'Zielübung mit der Ballmaschine', bild: '🎯', von: 'trainer', ort: 'training', ab: 0, phase: 'vor', spiel: 'platz', modus: 'ballmaschine', baelle: 10, frische: -3,
    auftrag: '10 Bälle auf die Zielfelder. Ich will sehen, dass du die Ecken triffst.',
    stufen: [
      [0.5, { bonus: { c: 2, p: 1 }, xp: 25 }, 'Was für ein Einschlagen! Heute triffst du alles.'],
      [0.25, { bonus: { c: 1, p: 1 }, xp: 18 }, 'Gut eingeschlagen. Dein Arm ist warm und die Bälle kommen genau.'],
      [0, { bonus: { c: 1 }, xp: 10 }, 'Ein paar Bälle gingen daneben, aber du bist jetzt wach.']] },
  aufschlag: { name: 'Aufschlag-Ziele', bild: '🚀', von: 'trainer', ort: 'training', ab: 0, phase: 'vor', spiel: 'platz', modus: 'aufschlag', baelle: 8, frische: -3,
    auftrag: '8 Aufschläge auf die Zielfelder. Der Aufschlag ist heute dein wichtigster Schlag.',
    stufen: [
      [0.5, { bonus: { s: 2 }, xp: 25 }, 'Dein Aufschlag sitzt heute wie angenagelt!'],
      [0.25, { bonus: { s: 1 }, xp: 18 }, 'Der Aufschlag fühlt sich gut an.'],
      [0, { xp: 10 }, 'Der Aufschlag wollte heute nicht so recht. Wenigstens ist die Schulter warm.']] },
  spielzug: { name: 'Spielzug üben', bild: '🧠', von: 'trainer', ort: 'training', ab: 0, phase: 'vor', spiel: 'platz', modus: 'lernen', frische: -3,
    auftrag: 'Wir üben einen Spielzug für heute. Triff die grünen Felder der Reihe nach.',
    stufen: [
      [0.75, { bonus: { k: 2 }, xp: 25 }, 'Der Spielzug sitzt. Heute weißt du genau, was du auf dem Platz vorhast.'],
      [0.25, { bonus: { k: 1 }, xp: 18 }, 'Ein paar Mal hat es geklappt. Du hast einen Plan für das Match.'],
      [0, { xp: 10 }, 'Der Spielzug klappt noch nicht. Übung macht den Meister.']] },
  hochhalten: { name: 'Ball hochhalten', bild: '🎾', von: 'trainer', ort: 'training', ab: 0, phase: 'vor', spiel: 'hochhalten',
    auftrag: 'Ballgefühl! Halte den Ball mit dem Schläger in der Luft – 30 Berührungen will ich sehen.',
    stufen: [
      [0.7, { bonus: { v: 1, c: 1 }, xp: 15 }, 'Der Ball klebt an deinem Schläger. Mit so viel Gefühl gelingen heute auch die Volleys.'],
      [0.35, { bonus: { v: 1 }, xp: 10 }, 'Ordentliches Ballgefühl.'],
      [0, { xp: 4 }, 'Der Ball ist dir oft weggesprungen. Morgen noch einmal!']] },
  kraft: { name: 'Krafttraining', bild: '🏋️', von: 'fitness', ort: 'kraft', ab: 1, phase: 'vor', spiel: 'kraft', frische: -7,
    auftrag: 'Drei Übungen, je vier saubere Wiederholungen. Nicht reißen – sauber heben!',
    stufen: [
      [0.75, { bonus: { s: 1, p: 1 }, xp: 45 }, 'Saubere Technik bei fast jeder Wiederholung. Du fühlst dich stark!'],
      [0.4, { bonus: { s: 1 }, xp: 30 }, 'Ordentliches Training. Ein paar Wiederholungen waren wackelig.'],
      [0, { xp: 15 }, 'Das war heute nichts. Mit schlechter Technik bringt Krafttraining wenig.']] },
  massage: { name: 'Massage', bild: '💆', von: 'physio', ort: 'physio', ab: 1, phase: 'beide', spiel: 'massage', heilt: true,
    auftrag: 'Ab auf die Liege! Zeig mir, wo es verspannt ist – wir lockern alle harten Stellen.',
    stufen: [
      [0.8, { frische: 10 }, 'Alle Verspannungen sind weg. Deine Beine fühlen sich an wie neu.'],
      [0.5, { frische: 7 }, 'Die meisten harten Stellen sind locker.'],
      [0, { frische: 4 }, 'Ein bisschen lockerer – aber ein paar Stellen zwicken noch.']] },
  essen: { name: 'Richtig essen', bild: '🍝', von: 'fitness', ort: 'essen', ab: 2, phase: 'beide', spiel: 'buffet',
    auftrag: { vor: 'Vor dem Match brauchst du Treibstoff: viele Kohlenhydrate, wenig Fett – und trinken nicht vergessen!', nach: 'Nach dem Match braucht der Körper Eiweiß zum Reparieren, dazu Kohlenhydrate zum Auffüllen – und viel trinken!' },
    stufen: [
      [0.99, { frische: 4, bonus: { a: 1 } }, 'Ein Teller wie aus dem Lehrbuch. So hältst du lange durch.'],
      [0.7, { frische: 3 }, 'Fast perfekt gegessen.'],
      [0.45, { frische: 1 }, 'Na ja. Satt bist du, aber ideal war das nicht.'],
      [0, { frische: -3 }, 'Das liegt schwer im Magen. So isst kein Profi.']] },
  saiten: { name: 'Schläger bespannen', bild: '🪡', von: 'trainer', ort: 'saiten', ab: 0, phase: 'vor', spiel: 'bespannen', saiten: true,
    auftrag: 'Geh zum Besaiter und hilf ihm an der Maschine. Wer weiß, wie sein Schläger bespannt ist, spielt besser.',
    stufen: [
      [0.75, { bonus: { c: 2 }, xp: 12 }, 'Sauber geflochten und genau auf das richtige Gewicht gezogen. Der Schläger ist perfekt.'],
      [0, { bonus: { c: 1 }, xp: 6 }, 'Der Besaiter hat ein bisschen nachgebessert. Frische Saiten sind es trotzdem.']] },
  presse: { name: 'Pressekonferenz', bild: '🎤', von: 'manager', ort: 'presse', ab: 2, phase: 'beide', spiel: 'presse',
    auftrag: 'Die Reporter warten. Drei Fragen – bleib freundlich und antworte schnell, sonst wird es peinlich.',
    stufen: [
      [0.8, { fans: 1, xp: 10, druck: -8 }, 'Die Reporter mögen dich. Morgen steht etwas Nettes in der Zeitung.'],
      [0.5, { xp: 5, druck: -3 }, 'Ganz ordentlich. Nichts Besonderes, aber auch kein Ärger.'],
      [0, { fans: -1, druck: 12 }, 'Das ging schief. Morgen steht in der Zeitung, du seist unfreundlich.']] },
  fans: { name: 'Autogramme schreiben', bild: '✍️', von: 'manager', ort: 'fans', ab: 0, phase: 'beide', spiel: 'autogramm',
    auftrag: 'Am Zaun warten Kinder mit Bällen und Kappen. Unterschreib mit dem Finger – aber sauber im weißen Feld!',
    stufen: [
      [0.8, { autogramme: 3, xp: 8 }, 'Alle haben ein schönes Autogramm bekommen. Die Kinder strahlen.'],
      [0.45, { autogramme: 2, xp: 5 }, 'Viele Kinder sind glücklich, ein paar sind leer ausgegangen.'],
      [0, { autogramme: 1 }, 'Nur wenige Autogramme – und einige ziemlich gekrakelt.']] },
  quiz: { name: 'Tennis-Quiz', bild: '❓', von: 'trainer', ort: 'presse', ab: 0, phase: 'beide', spiel: 'quiz', anzahl: 5,
    ortName: 'im Besprechungsraum',
    auftrag: { vor: 'Kopf einschalten! Fünf Fragen rund ums Tennis. Wer sein Spiel versteht, spielt klüger.', nach: 'Video-Analyse: Fünf Fragen zu Taktik und Technik. Aus jedem Match lernt man etwas.' },
    themen: { nach: ['taktik', 'schlaege', 'regeln', 'koerper'] },
    stufen: [
      [0.8, { bonus: { k: 1, m: 1 }, xp: 25 }, 'Fast alles gewusst! Du gehst mit klarem Kopf ins nächste Match.'],
      [0.4, { bonus: { k: 1 }, xp: 15 }, 'Einiges gewusst und etwas dazugelernt.'],
      [0, { xp: 5 }, 'Das üben wir noch. Die richtigen Antworten hast du jetzt ja gesehen.']] },
  dehnen: { name: 'Auslaufen und Dehnen', bild: '🧘', von: 'fitness', ort: 'training', ab: 0, phase: 'nach', spiel: 'dehnen',
    auftrag: 'Nach dem Match wird gedehnt, sonst bist du morgen steif wie ein Brett. Halte jede Dehnung ruhig!',
    stufen: [
      [0.75, { frische: 6 }, 'Ruhig gehalten und gut gedehnt. Morgen bist du wieder locker.'],
      [0.4, { frische: 4 }, 'Ein bisschen gewackelt, aber gedehnt ist gedehnt.'],
      [0, { frische: 2 }, 'Das war mehr Zappeln als Dehnen.']] },
};
export const AUFGABEN_IDS = Object.keys(AUFGABEN);

// Team-Stern: Das gibt es obendrauf, wenn alle Aufgaben einer Liste geschafft sind
export const STERN = { vor: { bonus: { m: 1 }, xp: 20, text: 'Dein Team ist stolz auf dich: +1 Mental im Match heute' }, nach: { frische: 3, xp: 20, text: 'Dein Team ist stolz auf dich: +3 Frische' } };
// Welche Aufgaben sind „Tennis auf dem Platz“? Davon gibt es vor dem Match immer genau eine.
const TENNIS = ['einschlagen', 'aufschlag', 'spielzug', 'hochhalten'];

const passt = (A, phase) => A.phase === 'beide' || A.phase === phase;
export const gibtEs = (id, def) => !!AUFGABEN[id] && stufeVon(def) >= AUFGABEN[id].ab;
export const auftragText = (id, phase) => { const a = AUFGABEN[id].auftrag; return typeof a === 'string' ? a : a[phase] || a.vor; };

// Aus einer Liste zufällig eine nehmen (und herausnehmen). nicht = die lieber nicht (war gestern schon dran) – außer es gibt nichts anderes.
function nimm(pool, zufall, nicht = []) {
  const gut = pool.filter((id) => !nicht.includes(id)), aus = gut.length ? gut : pool;
  if (!aus.length) return null;
  const id = aus[Math.floor(zufall() * aus.length)];
  pool.splice(pool.indexOf(id), 1);
  return id;
}

// Die Aufgaben VOR dem Match aussuchen. Der Tag (c.tag) muss schon angefangen haben (tagStart in turniertag.js).
export function tagAufgaben(c, def, zufall = Math.random) {
  // Zum Besaiter schickt dich das Team nur, wenn du Saiten hast und sie bezahlen kannst
  const saite = c.saison ? null : traegt(c, 'Saiten'), saitenGeht = c.saison || (!!saite && (gratis(c, saite) || c.money >= saite.price));
  const da = AUFGABEN_IDS.filter((id) => gibtEs(id, def) && passt(AUFGABEN[id], 'vor') && (id !== 'saiten' || saitenGeht));
  const gestern = c.aufgGestern || [];
  const tennis = da.filter((id) => TENNIS.includes(id)), rest = da.filter((id) => !TENNIS.includes(id) && id !== 'warm');
  const liste = ['warm', nimm(tennis, zufall, gestern)];
  const n = 3 + (fensterVon(def) > ZEIT_FENSTER ? 1 : 0);
  while (liste.length < n && rest.length) liste.push(nimm(rest, zufall, gestern));
  c.tag.aufg = { liste: liste.filter(Boolean), getan: {}, stern: false };
  c.aufgGestern = c.tag.aufg.liste.slice(1);
  saveCareer(c);
  return c.tag.aufg;
}

// Die Aufgaben NACH dem Match. kennung = welches Match (zum Beispiel 'wim:3'), damit nach dem nächsten Sieg neue kommen.
export function nachAufgaben(c, def, kennung, zufall = Math.random) {
  if (c.nach && c.nach.kennung === kennung) return c.nach;
  const da = AUFGABEN_IDS.filter((id) => gibtEs(id, def) && passt(AUFGABEN[id], 'nach') && id !== 'dehnen');
  const liste = ['dehnen', nimm(da, zufall, c.nachGestern || [])].filter(Boolean);
  c.nach = { kennung, liste, getan: {}, stern: false };
  c.nachGestern = liste.slice(1);
  saveCareer(c);
  return c.nach;
}

// Die Liste, die gerade gilt (oder null): phase = 'vor' oder 'nach'
export const stand = (c, phase) => (phase === 'nach' ? c.nach : c.tag && c.tag.aufg) || null;
// Für die Anzeige: [{ id, A, note }] – note ist leer, solange die Aufgabe offen ist
export function liste(c, phase) {
  const S = stand(c, phase);
  return S ? S.liste.map((id) => ({ id, A: AUFGABEN[id], note: S.getan[id] })) : [];
}
export const offen = (c, phase) => liste(c, phase).filter((a) => a.note == null).length;

// Habe ich das heute schon gemacht (als Aufgabe oder freiwillig)?
function schonGetan(c, id, phase) {
  const S = stand(c, phase);
  if (S && S.getan[id] != null) return true;
  return phase === 'vor' && !!c.tag && (c.tag.getan || []).includes(id);
}

// Darf ich das jetzt machen? Gibt { ok, warum, team } zurück (team = ist eine Aufgabe vom Team und kostet keine Zeit).
export function kann(c, id, def, phase = 'vor') {
  const A = AUFGABEN[id], S = stand(c, phase);
  if (!A || !passt(A, phase)) return { ok: false, warum: '', team: false };
  const team = !!S && S.liste.includes(id);
  if (!gibtEs(id, def)) return { ok: false, team, warum: (TAETIGKEITEN[A.ort] || {}).fehlt || 'Das gibt es bei diesem Turnier nicht.' };
  if (schonGetan(c, id, phase)) return { ok: false, team, warum: 'Das hast du heute schon gemacht.' };
  if (!team && phase === 'nach') return { ok: false, team, warum: 'Nach dem Match machst du nur noch, was dein Team dir aufgegeben hat. Dann ab ins Hotel!' };
  if (!team && freieFenster(c) <= 0) return { ok: false, team, warum: 'Keine Zeit mehr für Freiwilliges – dein Match fängt gleich an.' };
  if (A.saiten && !c.saison) {         // ein Profi in der Saison hat immer Saiten: Die bezahlt sein Ausrüster
    const saite = traegt(c, 'Saiten');
    if (!saite) return { ok: false, team, warum: 'Du hast noch keine Saiten. Kauf zuerst welche unter „Ausrüstung“.' };
    if (!gratis(c, saite) && c.money < saite.price) return { ok: false, team, warum: 'Für neue Saiten reicht dein Geld gerade nicht.' };
  }
  return { ok: true, warum: '', team };
}

// Was kann man an diesem Ort machen? [{ id, A, team, note, ok, warum }] – Aufgaben vom Team stehen oben.
export function amOrt(c, ort, def, phase = 'vor') {
  const S = stand(c, phase);
  return AUFGABEN_IDS.filter((id) => AUFGABEN[id].ort === ort && passt(AUFGABEN[id], phase))
    .map((id) => ({ id, A: AUFGABEN[id], note: S && S.getan[id], ...kann(c, id, def, phase) }))
    .filter((a) => a.team || phase === 'vor')
    .sort((a, b) => (b.team ? 1 : 0) - (a.team ? 1 : 0));
}

const begrenzen = (x, a, b) => Math.max(a, Math.min(b, x));
// Welche Zeile der Belohnungen gilt bei dieser Note?
export const stufeFuer = (id, note) => AUFGABEN[id].stufen.find((s) => note >= s[0]) || AUFGABEN[id].stufen[AUFGABEN[id].stufen.length - 1];

// Eine Aufgabe ist gespielt. note = 0 … 1. Gibt { text, bringt: [Sätze], stern, team } zurück (oder null, wenn es nicht geht).
export function fertig(c, id, def, phase, note) {
  const k = kann(c, id, def, phase);
  if (!k.ok) return null;
  const A = AUFGABEN[id], S = stand(c, phase), bringt = [];
  note = begrenzen(+note || 0, 0, 1);
  const [, F, text] = stufeFuer(id, note);
  // Pluspunkte: vor dem Match gelten sie heute, nach dem Match für das nächste Match (wie die Abend-Auswahl)
  const plus = (bonus) => {
    if (phase === 'nach') c.abend = { bonus: { ...((c.abend && c.abend.bonus) || {}) } };
    const ziel = phase === 'nach' ? c.abend.bonus : c.tag.bonus;
    for (const key in bonus) ziel[key] = (ziel[key] || 0) + bonus[key];
  };
  const frische = (A.frische || 0) + (F.frische || 0);
  if (frische) { c.frische = begrenzen(c.frische + frische, 0, 100); bringt.push(`Frische ${frische > 0 ? '+' : '−'}${Math.abs(frische)}`); }
  if (A.heilt && c.koerper) { const teil = c.koerper.teil; ausheilen(c); bringt.push(`Deine Beschwerden sind weg (${teil}).`); }
  if (A.saiten) {
    if (c.saison) bringt.push('Neue Saiten – das zahlt dein Ausrüster.');
    else { const saite = traegt(c, 'Saiten'), frei = gratis(c, saite); bespannen(c, saite.id); bringt.push(frei ? 'Neue Saiten – das zahlt dein Ausrüster.' : `Neue Saiten: ${saite.price} $`); }
  }
  if (F.bonus && Object.keys(F.bonus).length) { plus(F.bonus); bringt.push(phase === 'nach' ? 'Pluspunkte für das nächste Match' : 'Pluspunkte für das Match heute'); }
  c.tagFans = c.tagFans || 0; c.autogramme = c.autogramme || 0;
  if (F.fans > 0 && c.tagFans < TAG_FANS_MAX) { c.tagFans++; bringt.push('+1 Fan-Stern ⭐'); }
  if (F.fans < 0 && c.tagFans > 0) { c.tagFans--; bringt.push('−1 Fan-Stern'); }
  for (let i = 0; i < (F.autogramme || 0); i++) {
    c.autogramme++;
    if (c.autogramme % AUTOGRAMME_PRO_STERN === 0 && c.tagFans < TAG_FANS_MAX) { c.tagFans++; bringt.push('+1 Fan-Stern ⭐'); }
  }
  if (F.autogramme) bringt.push(`${F.autogramme}-mal Autogramme gezählt`);
  // Nur im Saison-Modus gibt es den Medien-Druck (profisaison.js)
  if (F.druck && c.druck != null) { c.druck = begrenzen(c.druck + F.druck, 0, 100); bringt.push(F.druck < 0 ? 'Medien-Druck sinkt' : 'Medien-Druck steigt!'); }
  if (F.xp) { addXp(c, F.xp); bringt.push(`+${F.xp} Erfahrung`); }
  // Abhaken: Aufgabe vom Team (kostet keine Zeit) oder freiwillig (kostet ein Zeitfenster)
  let stern = false;
  if (k.team) {
    S.getan[id] = note;
    if (!S.stern && S.liste.every((x) => S.getan[x] != null)) {
      S.stern = stern = true;
      c.teamSterne = (c.teamSterne || 0) + 1;
      const B = STERN[phase];
      if (B.bonus) plus(B.bonus);
      if (B.frische) c.frische = begrenzen(c.frische + B.frische, 0, 100);
      addXp(c, B.xp);
    }
  } else { c.tag.getan.push(id); c.tag.fenster++; bringt.push('1 Zeitfenster verbraucht'); }
  saveCareer(c);
  return { text, bringt, stern, team: k.team, note };
}
