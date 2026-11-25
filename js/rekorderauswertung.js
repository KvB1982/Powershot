// Powershot – wertet Aufnahmen des Match-Rekorders aus (js/rekorder.js). Ohne Grafik, läuft auch in node.
//   auswerten(aufnahmen)  → Zahlen je Gruppe (gleiche Steuerung, gleiche Stufe, gleiche Spielart)
//   bericht(gruppen)      → dieselben Zahlen als Text-Zeilen, mit Auffälligkeiten
// Die Auffälligkeiten sind einfache Faustregeln (Zahlen unten bei GRENZE). Sie sagen, wo man hinschauen sollte –
// was man daraus ändert, entscheidet ein Mensch.

const C = { W: 4.115, L: 11.885 };      // halbe Breite (Einzel) und halbe Länge des Platzes in Metern

// Ab wann etwas auffällig ist (alles geschätzt)
export const GRENZE = {
  wenigPunkte: 30,          // unter so vielen Punkten sind die Zahlen noch Zufall
  verpasst: 0.2,            // mehr als so viele der erreichbaren Bälle verpasst
  zuLeicht: 0.7,            // Anteil eigener Punkte: darüber ist es wohl zu leicht …
  zuSchwer: 0.35,           // … darunter zu schwer
  hilfe: 0.3,               // Anteil Hilfs-Schläge an den eigenen Schlägen
  kurz: 2.6, lang: 9,       // Schläge pro Ballwechsel im Schnitt
  fehler: 0.22,             // Anteil eigener Schläge, die im Netz oder im Aus landen
  einseitig: 0.6,           // Anteil der Schläge in dasselbe Drittel des Platzes
  doppelfehler: 0.15,       // Doppelfehler pro eigenem Aufschlagpunkt
  ohneWirkung: 0.3,         // Anteil der Eingaben, aus denen kein Schlag wurde
  nichtErreicht: 0.35,      // Anteil der verlorenen Punkte, bei denen man gar nicht an den Ball kam
};

export const STEUERUNG_NAME = { klassik: 'Maus (Klassik)', profi: 'Tastatur (Profi)', touch: 'Touch', wisch: 'Wischen', controller: 'Controller / Uhr / iPhone-Schläger' };
export const GRUND_NAME = { zu_frueh: 'zu früh (Eingabe verfallen)', zu_spaet: 'zu spät (Eingabe kam nach dem Ball)', keine_eingabe: 'gar nicht geschlagen', nicht_erreicht: 'nicht hingekommen' };
const ENDE_NAME = { ass: 'Ass', winner: 'Winner', aus: 'Aus', netz: 'Netz', doppelfehler: 'Doppelfehler' };

const pct = (a, b) => (b ? Math.round(100 * a / b) + ' %' : '–');
const mittel = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
function quantil(a, q) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i);
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo);
}
const zaehl = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const liste = (o, name = (k) => k) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${name(k)} ${v}`).join(', ') || '–';

// Welche Steuerung war es genau? Bei "controller" steht dabei, ob geschwungen wurde.
function steuerungVon(a) {
  const K = a.kopf || {};
  let s = K.steuerung || '?';
  if (s === 'controller') s += K.uhr ? ' (Uhr)' : K.schlaeger ? ' (' + K.schlaeger + ')' : '';
  if (K.kamera && K.kamera !== 'aus') s += ' + Kamera';
  return s;
}

function leer(schluessel, kopf) {
  return {
    schluessel, steuerung: schluessel.split(' | ')[0], stufe: kopf.stufe, modus: kopf.modus, laufhilfe: kopf.laufhilfe,
    matches: 0, siege: 0, abgebrochen: 0, punkte: 0, meine: 0, dauer: 0,
    schlaege: 0, laengen: [],                       // Schläge je Punkt
    enden: [{}, {}],                                // wie die Punkte jeder Seite enden: { ass, winner, … }
    ich: neuSeite(), gegner: neuSeite(),
    verpasst: {}, verpasstSeite: { fh: 0, bh: 0 }, ankommend: 0, ankommendSeite: { fh: 0, bh: 0 },
    vor: [], spaet: 0, hilfe: 0,
    eingaben: 0, verfallen: 0, geloescht: 0, schwungKraft: [], schwungAlter: [], wischTempo: [],
    aufschlag: { punkte: 0, erster: 0, ersterDrin: 0, doppel: 0, asse: 0, arten: {} },
    nichtErreicht: 0, abstand: [], verloren: 0,
    spielzuege: [0, 0], netzwunsch: 0,
  };
}
function neuSeite() {
  return { schlaege: 0, drin: 0, netz: 0, aus: 0, lang: 0, breit: 0, kmh: [], arten: {}, hand: { fh: 0, bh: 0 }, handFehler: { fh: 0, bh: 0 }, drittel: [0, 0, 0], streck: [], volley: 0, reakt: [] };
}

// Alle Aufnahmen durchgehen. Ergebnis: eine Liste von Gruppen.
export function auswerten(aufnahmen) {
  const G = new Map();
  for (const a of aufnahmen) {
    if (!a || !a.kopf || !Array.isArray(a.punkte)) continue;
    const K = a.kopf, ms = K.mensch == null ? 0 : K.mensch;
    const key = `${steuerungVon(a)} | ${K.stufe || '?'} | ${K.modus || 'match'} | Laufhilfe ${K.laufhilfe || '?'}`;
    if (!G.has(key)) G.set(key, leer(key, K));
    const g = G.get(key);
    g.matches++;
    const E = a.ergebnis || {};
    if (E.abgebrochen) g.abgebrochen++; else if (E.sieger === ms) g.siege++;
    g.dauer += E.dauer || 0;
    for (const P of a.punkte) punkt(g, P, ms, K);
  }
  for (const g of G.values()) {
    // Aufschläge gehören nicht zu den Schlägen im Ballwechsel
    g.aufschlagSchlaege = Object.entries(g.ich.arten).filter(([k]) => k.startsWith('Aufschlag')).reduce((s, [, v]) => s + v, 0);
    g.aufschlagFehler = Math.min(g.ich.netz + g.ich.aus, Math.max(0, g.aufschlag.erster - g.aufschlag.ersterDrin) + g.aufschlag.doppel);
  }
  return [...G.values()];
}

function punkt(g, P, ms, K) {
  const en = P.ende;
  const match = (K.modus || 'match') === 'match' || K.modus === 'spielzug';
  if (en && en.sieger != null) {
    g.punkte++;
    if (en.sieger === ms) g.meine++; else g.verloren++;
    zaehl(g.enden[en.sieger], en.grund);
    g.laengen.push(en.schlaege);
    if (en.sieger !== ms && (en.grund === 'winner' || en.grund === 'ass')) {
      // Punkt verloren, ohne den Ball zu berühren: nicht hingekommen – oder in Reichweite, aber nicht geschlagen?
      if (!en.verpasst) { g.nichtErreicht++; zaehl(g.verpasst, 'nicht_erreicht'); if (en.abstand != null) g.abstand.push(en.abstand); }
    }
    if (match && P.auf === ms) {
      const A = g.aufschlag;
      A.punkte++;
      if (en.grund === 'doppelfehler') A.doppel++;
      if (en.grund === 'ass' && en.sieger === ms) A.asse++;
    }
  }
  for (const e of P.e) {
    if (e.a === 'schlag') {
      g.schlaege++;
      const S = e.s === ms ? g.ich : g.gegner;
      S.schlaege++;
      S.kmh.push(e.kmh);
      zaehl(S.arten, e.auf ? 'Aufschlag ' + (e.art || '') : e.typ);
      if (e.hand === 'fh' || e.hand === 'bh') S.hand[e.hand]++;
      if (e.streck) S.streck.push(e.streck);
      if (e.volley) S.volley++;
      S.reakt.push(e.reakt || 0);
      // Wie ging der Schlag aus? (vorausberechnet beim Schlagen: landet er im Feld, im Netz oder im Aus)
      if (e.insNetz) { S.netz++; if (e.hand in S.handFehler) S.handFehler[e.hand]++; }
      else if (!e.drin) {
        S.aus++;
        if (e.hand in S.handFehler) S.handFehler[e.hand]++;
        if (e.landet && !e.auf) { if (Math.abs(e.landet[1]) > C.L) S.lang++; else if (Math.abs(e.landet[0]) > C.W) S.breit++; }
      } else S.drin++;
      // In welches Drittel des Platzes (aus Sicht des Schlägers: links, Mitte, rechts)?
      if (e.landet && !e.auf) {
        const x = e.landet[0] * (e.s === 0 ? 1 : -1);
        S.drittel[x < -C.W / 3 ? 0 : x > C.W / 3 ? 2 : 1]++;
      }
      if (e.s === ms) {
        if (e.hilfe) g.hilfe++;
        if (e.vor != null) g.vor.push(e.vor);
        if (e.spaet) g.spaet++;
        if (e.auf) {
          const A = g.aufschlag;
          zaehl(A.arten, e.art || 'gerade');
          if (e.auf === 1) { A.erster++; if (e.drin && !e.insNetz) A.ersterDrin++; }
        }
      } else if (e.drin && !e.insNetz) g.ankommend++;      // ein Ball kommt auf den Menschen zu, den er spielen muss
    } else if (e.a === 'verpasst' && e.s === ms) {
      zaehl(g.verpasst, e.grund);
      if (e.seite in g.verpasstSeite) g.verpasstSeite[e.seite]++;
    } else if (e.a === 'eingabe') {
      if (e.was === 'eingabe' && !e.halten) g.eingaben++;
      else if (e.was === 'verfallen') g.verfallen++;
      else if (e.was === 'geloescht') g.geloescht++;
      else if (e.was === 'schwung') { g.schwungKraft.push(e.kraft); g.schwungAlter.push(e.alter); }
      else if (e.was === 'wisch') g.wischTempo.push(e.tempo);
    } else if (e.a === 'spielzug') g.spielzuege[e.s === ms ? 0 : 1]++;
    else if (e.a === 'netzwunsch') g.netzwunsch++;
  }
  // Vorhand oder Rückhand: Auf welcher Seite kamen die Bälle an, die der Mensch geschlagen oder verpasst hat?
  for (const e of P.e) if (e.a === 'schlag' && e.s === ms && (e.hand === 'fh' || e.hand === 'bh')) g.ankommendSeite[e.hand]++;
}

// Aus den Zahlen einer Gruppe: Was fällt auf? → Liste von Sätzen
export function auffaellig(g) {
  const A = [], I = g.ich, X = GRENZE;
  const verpasstAlle = Object.values(g.verpasst).reduce((s, v) => s + v, 0) - (g.verpasst.nicht_erreicht || 0);
  const erreichbar = I.schlaege - g.aufschlagSchlaege + verpasstAlle;
  if (g.punkte < X.wenigPunkte && (g.modus || 'match') === 'match') A.push(`Nur ${g.punkte} Punkte aufgenommen – die Zahlen sind noch Zufall. Mehr Matches aufnehmen.`);
  if (erreichbar > 8 && verpasstAlle / erreichbar > X.verpasst) {
    const [grund, n] = Object.entries(g.verpasst).filter(([k]) => k !== 'nicht_erreicht').sort((a, b) => b[1] - a[1])[0];
    A.push(`Viele Bälle in Reichweite verpasst: ${verpasstAlle} von ${erreichbar} (${pct(verpasstAlle, erreichbar)}). Häufigster Grund: ${GRUND_NAME[grund] || grund} (${n}-mal).`
      + (grund === 'zu_frueh' ? ' → Eingaben sollten länger gelten.' : grund === 'zu_spaet' ? ' → Das Fenster nach dem besten Moment ist zu kurz, oder der Moment ist schlecht zu erkennen.' : ' → Erkennt die Steuerung die Eingabe nicht, oder weiß der Spieler nicht, wann er schlagen soll?'));
  }
  const vf = g.verpasstSeite.fh, vb = g.verpasstSeite.bh, sf = g.ankommendSeite.fh + vf, sb = g.ankommendSeite.bh + vb;
  if (sf > 6 && sb > 6) {
    const qf = vf / sf, qb = vb / sb;
    if (qb > 0.1 && qb > 2 * qf) A.push(`Auf der Rückhand-Seite wird viel öfter verpasst (${pct(vb, sb)}) als auf der Vorhand-Seite (${pct(vf, sf)}).`);
    if (qf > 0.1 && qf > 2 * qb) A.push(`Auf der Vorhand-Seite wird viel öfter verpasst (${pct(vf, sf)}) als auf der Rückhand-Seite (${pct(vb, sb)}).`);
  }
  if (g.punkte >= X.wenigPunkte && g.modus === 'match') {
    const q = g.meine / g.punkte;
    if (q > X.zuLeicht) A.push(`Du gewinnst ${pct(g.meine, g.punkte)} der Punkte – die Stufe „${g.stufe}“ ist mit dieser Steuerung wohl zu leicht.`);
    if (q < X.zuSchwer) A.push(`Du gewinnst nur ${pct(g.meine, g.punkte)} der Punkte – die Stufe „${g.stufe}“ ist mit dieser Steuerung wohl zu schwer.`);
  }
  if (I.schlaege > 10 && g.hilfe / I.schlaege > X.hilfe) A.push(`${pct(g.hilfe, I.schlaege)} deiner Schläge waren Hilfs-Schläge (das Spiel hat für dich geschlagen) – es wird kaum selbst geschlagen.`);
  const ml = mittel(g.laengen);
  if (g.punkte >= 15 && g.modus === 'match') {
    if (ml < X.kurz) A.push(`Ballwechsel sind sehr kurz (im Schnitt ${ml.toFixed(1)} Schläge) – die Punkte enden meist nach Aufschlag und Return.`);
    if (ml > X.lang) A.push(`Ballwechsel sind sehr lang (im Schnitt ${ml.toFixed(1)} Schläge) – es ist schwer, einen Punkt zu machen.`);
  }
  const eigene = I.schlaege - g.aufschlagSchlaege, fehl = I.netz + I.aus - g.aufschlagFehler;
  if (eigene > 12 && fehl / eigene > X.fehler) A.push(`${pct(fehl, eigene)} deiner Schläge im Ballwechsel gehen ins Netz oder ins Aus (Netz ${I.netz}, zu lang ${I.lang}, zu breit ${I.breit}).`);
  const dr = I.drittel, ds = dr[0] + dr[1] + dr[2];
  if (ds > 15) {
    const mx = Math.max(...dr), wo = ['nach links', 'in die Mitte', 'nach rechts'][dr.indexOf(mx)];
    if (mx / ds > X.einseitig) A.push(`${pct(mx, ds)} deiner Schläge gehen ${wo} – die Richtung lässt sich mit dieser Steuerung schlecht wählen (oder wird nicht gewählt).`);
  }
  if (g.aufschlag.punkte > 8 && g.aufschlag.doppel / g.aufschlag.punkte > X.doppelfehler) A.push(`Viele Doppelfehler: ${g.aufschlag.doppel} bei ${g.aufschlag.punkte} eigenen Aufschlagpunkten.`);
  const tot = g.verfallen + g.geloescht;
  if (g.eingaben > 12 && tot / g.eingaben > X.ohneWirkung) A.push(`${pct(tot, g.eingaben)} der Eingaben blieben ohne Wirkung (${g.verfallen} zu früh und verfallen, ${g.geloescht} schon vor dem Schlag des Gegners).`);
  if (g.verloren > 10 && g.nichtErreicht / g.verloren > X.nichtErreicht) A.push(`Bei ${pct(g.nichtErreicht, g.verloren)} der verlorenen Punkte kam deine Figur gar nicht an den Ball (im Schnitt ${mittel(g.abstand).toFixed(1)} m entfernt) – Laufhilfe, Lauftempo oder die Schläge des Gegners prüfen.`);
  if (g.vor.length > 10 && (g.steuerung.startsWith('controller') || g.steuerung.startsWith('wisch'))) {
    const md = quantil(g.vor, 0.5);
    A.push(`Timing: Die Eingabe kommt im Mittel ${md.toFixed(2)} s vor dem Treffen (die meisten zwischen ${quantil(g.vor, 0.1).toFixed(2)} und ${quantil(g.vor, 0.9).toFixed(2)} s), ${g.spaet}-mal nach dem besten Moment.`);
  }
  if (!A.length) A.push('Nichts Auffälliges.');
  return A;
}

// Die Zahlen als Text (eine Liste von Zeilen)
export function bericht(gruppen) {
  const Z = [];
  for (const g of gruppen) {
    const I = g.ich, O = g.gegner, st = g.steuerung;
    Z.push(`=== ${STEUERUNG_NAME[st] || st} · Stufe ${g.stufe} · ${g.modus} · Laufhilfe ${g.laufhilfe} ===`);
    Z.push(`Aufnahmen: ${g.matches} (${g.siege} gewonnen, ${g.abgebrochen} abgebrochen) · ${g.punkte} Punkte · ${Math.round(g.dauer / 60)} Minuten Spielzeit`);
    if (g.punkte) {
      const L = g.laengen, n = L.length;
      Z.push(`Punkte für dich: ${g.meine} von ${g.punkte} (${pct(g.meine, g.punkte)})`);
      Z.push(`Ballwechsel: im Schnitt ${mittel(L).toFixed(1)} Schläge · 1–2: ${pct(L.filter((v) => v <= 2).length, n)} · 3–4: ${pct(L.filter((v) => v > 2 && v <= 4).length, n)} · 5–8: ${pct(L.filter((v) => v > 4 && v <= 8).length, n)} · 9 und mehr: ${pct(L.filter((v) => v > 8).length, n)}`);
      Z.push(`Deine Punkte durch: ${liste(g.enden[0], (k) => ENDE_NAME[k] || k)}`);
      Z.push(`Punkte des Gegners durch: ${liste(g.enden[1], (k) => ENDE_NAME[k] || k)}`);
    }
    const zeile = (name, S) => {
      if (!S.schlaege) return;
      const ds = S.drittel[0] + S.drittel[1] + S.drittel[2];
      Z.push(`${name}: ${S.schlaege} Schläge · im Feld ${pct(S.drin, S.schlaege)} · Netz ${S.netz} · Aus ${S.aus} (zu lang ${S.lang}, zu breit ${S.breit}) · Tempo im Schnitt ${Math.round(mittel(S.kmh))} km/h, schnellster ${Math.max(...S.kmh)} km/h`);
      Z.push(`   Arten: ${liste(S.arten)}`);
      Z.push(`   Vorhand ${S.hand.fh} (Fehler ${S.handFehler.fh}) · Rückhand ${S.hand.bh} (Fehler ${S.handFehler.bh}) · Volleys ${S.volley} · Richtung links/Mitte/rechts: ${pct(S.drittel[0], ds)} / ${pct(S.drittel[1], ds)} / ${pct(S.drittel[2], ds)}`);
    };
    zeile('Du', I);
    zeile('Gegner', O);
    if (O.reakt.length) Z.push(`   Der Gegner läuft im Schnitt ${mittel(I.reakt).toFixed(2)} s nach deinem Schlag los, du ${mittel(O.reakt).toFixed(2)} s nach seinem.`);
    const vp = Object.entries(g.verpasst);
    if (vp.length) Z.push(`Nicht geschlagen: ${vp.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${GRUND_NAME[k] || k} ${v}`).join(' · ')} · auf der Vorhand-Seite ${g.verpasstSeite.fh}, auf der Rückhand-Seite ${g.verpasstSeite.bh}`);
    if (g.hilfe) Z.push(`Hilfs-Schläge (das Spiel schlägt für dich): ${g.hilfe}`);
    if (g.vor.length) Z.push(`Timing: Eingabe im Mittel ${quantil(g.vor, 0.5).toFixed(2)} s vor dem Treffen (10 %: ${quantil(g.vor, 0.1).toFixed(2)} s, 90 %: ${quantil(g.vor, 0.9).toFixed(2)} s) · nach dem besten Moment geschlagen: ${g.spaet}`);
    if (g.eingaben) Z.push(`Eingaben: ${g.eingaben} · zu früh und verfallen ${g.verfallen} · vor dem Schlag des Gegners gelöscht ${g.geloescht}`);
    if (g.schwungKraft.length) Z.push(`Schwünge: ${g.schwungKraft.length} · Kraft im Mittel ${Math.round(100 * quantil(g.schwungKraft, 0.5))} % (10 %: ${Math.round(100 * quantil(g.schwungKraft, 0.1))} %, 90 %: ${Math.round(100 * quantil(g.schwungKraft, 0.9))} %) · unterwegs im Mittel ${Math.round(1000 * quantil(g.schwungAlter, 0.5))} ms`);
    if (g.wischTempo.length) Z.push(`Wische: ${g.wischTempo.length} · Tempo im Mittel ${quantil(g.wischTempo, 0.5).toFixed(1)} Bildschirmhöhen pro Sekunde (10 %: ${quantil(g.wischTempo, 0.1).toFixed(1)}, 90 %: ${quantil(g.wischTempo, 0.9).toFixed(1)})`);
    const A = g.aufschlag;
    if (A.punkte) Z.push(`Dein Aufschlag: ${A.punkte} Punkte · erster im Feld ${pct(A.ersterDrin, A.erster)} · Asse ${A.asse} · Doppelfehler ${A.doppel} · Arten: ${liste(A.arten)}`);
    if (g.spielzuege[0] + g.spielzuege[1]) Z.push(`Spielzüge: du ${g.spielzuege[0]}, Gegner ${g.spielzuege[1]}`);
    if (g.netzwunsch) Z.push(`Ans Netz / zurück gewünscht: ${g.netzwunsch}-mal`);
    Z.push('Auffällig:');
    for (const s of auffaellig(g)) Z.push('  • ' + s);
    Z.push('');
  }
  if (!gruppen.length) Z.push('Keine Aufnahmen gefunden.');
  return Z;
}

// Einen Punkt Schlag für Schlag als Text (zum Nachlesen und für die Wiedergabe)
export function schlagText(e, namen = ['Du', 'Gegner']) {
  const wer = namen[e.s] || '';
  if (e.a === 'schlag') {
    const art = e.auf ? `${e.auf}. Aufschlag${e.art && e.art !== 'gerade' ? ' (' + e.art + ')' : ''}` : `${e.hand === 'bh' ? 'Rückhand' : e.hand === 'fh' ? 'Vorhand' : ''} ${e.typ}`.trim();
    const aus = e.insNetz ? '→ ins Netz' : e.drin ? '→ im Feld' : '→ ins Aus';
    const zus = [e.hilfe ? 'Hilfs-Schlag' : '', e.vor != null ? `Eingabe ${e.vor.toFixed(2)} s vorher` : '', e.spaet ? `${e.spaet.toFixed(2)} s zu spät` : '', e.streck > 0.5 ? 'gestreckt' : '', e.volley ? 'aus der Luft' : ''].filter(Boolean).join(', ');
    return `${wer}: ${art}, ${e.kmh} km/h ${aus}${zus ? ' (' + zus + ')' : ''}`;
  }
  if (e.a === 'verpasst') return `${wer}: verpasst – ${GRUND_NAME[e.grund] || e.grund}${e.nach ? ` (${e.nach.toFixed(2)} s danach)` : ''}, Ball ${e.abstand.toFixed(1)} m entfernt`;
  if (e.a === 'fehler') return `${e.nr}. Aufschlag: Fehler (${e.grund})`;
  if (e.a === 'eingabe') {
    if (e.was === 'verfallen') return `Eingabe verfallen (zu früh, ${e.alt} s alt)`;
    if (e.was === 'geloescht') return 'Eingabe gelöscht (kam vor dem Schlag des Gegners)';
    if (e.was === 'schwung') return `Schwung: Kraft ${Math.round(e.kraft * 100)} %, ${e.hoch < -0.35 ? 'von oben' : e.hoch > 0.35 ? 'von unten' : 'seitlich'}, ${Math.round(e.alter * 1000)} ms unterwegs`;
    if (e.was === 'wisch') return `Wisch: ${e.finger} Finger, Tempo ${e.tempo}`;
    if (e.was === 'eingabe') return `Eingabe: ${e.name || e.art || ''}${e.halten ? ' (Taste gehalten)' : ''}${e.zuSpaet ? ' – zu spät' : ''}`;
  }
  if (e.a === 'netz') return e.typ === 'cord' ? 'Netzkante' : 'Netz';
  if (e.a === 'spielzug') return `${wer}: Spielzug ${e.id}`;
  if (e.a === 'netzwunsch') return e.vor ? 'Du willst ans Netz' : 'Du willst zurück an die Grundlinie';
  return null;
}
export function endeText(en, namen = ['Du', 'Gegner']) {
  if (!en || en.sieger == null) return 'Ende';
  return `Punkt für ${namen[en.sieger]} (${ENDE_NAME[en.grund] || en.grund}${en.abstand != null ? `, ${en.abstand.toFixed(1)} m vom Ball entfernt` : ''}) nach ${en.schlaege} Schlägen`;
}
