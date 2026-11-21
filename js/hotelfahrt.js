// Powershot – die Fahrt ins Hotel (ohne three.js, in node testbar).
//
// Bei den großen Turnieren (Grand Slam, Masters, ATP Finals, ATP 500 und ATP 250) gibt es einen Fahrdienst:
// Du steigst an der Haltebucht ein, und der Wagen fährt über die Zufahrt und die Straße draußen bis vor das Hotel.
// Diese Datei rechnet dafür drei Dinge aus:
//   1. hotelFuer(g)     Was für ein Hotel ist es? Hochhaus in der Großstadt, Grandhotel, Ferien-Resort oder Berghotel.
//   2. hotelPlanen(…)   Wo an der Straße ist Platz für das Hotel? (Es darf in nichts hineinragen: kein Fluss, kein Stadion, kein Berg.)
//   3. streckeBauen(…)  Die Fahrstrecke als Linie mit runden Kurven. ortAuf(strecke, s) sagt, wo der Wagen nach s Metern ist.
//
// Bei den kleinen Turnieren (ITF, Challenger) gibt es keinen Fahrdienst. Dort läuft man selbst durch die Stadt: siehe hotelweg.js.
// Alle Zahlen (Größe der Hotels, Tempo, Abstände) sind ausgedacht.

// ---- Zahlen zum Einstellen ----
export const TEMPO_STRASSE = 13.5;   // so schnell fährt der Wagen auf der Straße (Meter pro Sekunde; 13,5 sind knapp 50 km/h)
export const TEMPO_LANGSAM = 5.5;    // auf dem Gelände und vor dem Hotel
export const TEMPO_KURVE = 4.5;      // in engen Kurven
const SPUR_KLEIN = 1.2, SPUR_STRASSE = 1.9;      // so weit rechts von der Mitte fährt der Wagen (Rechtsverkehr)
const KURVE = 4.5;                   // so groß ist der Bogen einer Kurve (Meter)
const VOR = 13.5;                    // so weit liegt die Vorfahrt des Hotels von der Straßenmitte weg
const WAND = 18.5;                   // … und so weit die Vorderwand des Hotels
const WUNSCH_WEIT = 230;             // am liebsten steht das Hotel so viele Meter die Straße hinunter
const PFLASTER = 0xcfc8ba;

// So groß sind die Hotels: b = breit (an der Straße entlang), t = tief, h = hoch. klein = bei ATP 250 und ATP 500.
export const HOTEL_ARTEN = {
  turm: { b: 44, t: 30, h: 96, klein: { b: 38, t: 26, h: 62 }, wort: 'ein Hochhaus' },
  grand: { b: 62, t: 24, h: 23, klein: { b: 50, t: 20, h: 17 }, wort: 'ein großes altes Grandhotel' },
  resort: { b: 76, t: 28, h: 12, klein: { b: 60, t: 24, h: 10 }, wort: 'ein Ferien-Hotel mit Palmen' },
  chalet: { b: 46, t: 20, h: 13, klein: { b: 46, t: 20, h: 13 }, wort: 'ein Berghotel aus Holz' },
};

// Was für ein Hotel gehört zu diesem Gelände? Gibt { art, name, b, t, h, text } zurück – oder null, wenn es keinen Fahrdienst gibt.
export function hotelFuer(g) {
  if (!g) return null;
  let art, name;
  if (g.hotel) ({ art, name } = g.hotel);                      // die großen Turniere nennen ihr Hotel selbst (gelaende.js)
  else if (g.klein && g.stufe >= 2) {
    // ATP 250 und ATP 500: Das Hotel richtet sich nach der Gegend
    const um = Object.values(g.um || {}).join(' '), stadt = g.ort || 'Stadt';
    if (g.stil === 'alpen') { art = 'chalet'; name = `Hotel Alpenblick ${stadt}`; }
    else if (/skyline/.test(um)) { art = 'turm'; name = `${stadt} Tower Hotel`; }
    else if (/meer/.test(um) || g.stil === 'wueste' || g.stil === 'mittelmeer') { art = 'resort'; name = g.stil === 'wueste' ? `Palmen-Resort ${stadt}` : `Strandhotel ${stadt}`; }
    else { art = 'grand'; name = `Parkhotel ${stadt}`; }
  } else return null;
  const A = HOTEL_ARTEN[art] || HOTEL_ARTEN.grand, m = g.klein ? A.klein : A;
  return { art, name, b: m.b, t: m.t, h: m.h, text: `Dein Hotel für diese Woche: ${A.wort}. Hier wohnen alle Spieler des Turniers.` };
}

// Gibt es bei diesem Turnier einen Fahrdienst? Wenn nicht, geht man zu Fuß (hotelweg.js) – oder wohnt gleich auf der Anlage.
//   'fahrt' = der Wagen fährt · 'fuss' = selbst laufen · 'hier' = das Hotel steht auf der Anlage (Urlaubshotel) · 'heim' = Liga-Spiel zu Hause
export function hotelArt(g) {
  if (!g) return 'fahrt';
  if (!g.klein || g.stufe >= 2) return 'fahrt';
  if (g.liga) return 'heim';
  return g.imHotel ? 'hier' : 'fuss';
}

// Sucht einen Platz für das Hotel an der Straße und rechnet die Fahrt dorthin aus.
//   g = das Gelände · teile = alle Bausteine · strassen = die Straßen-Stücke vom Fahrdienst (aus strassenFuer in gelaende.js)
// Gibt { teil (das Hotel), flaechen, wege (Bausteine zum Zeichnen), route, halt, tuer } zurück – oder null, wenn nirgends Platz ist.
export function hotelPlanen(g, teile, strassen) {
  const H = hotelFuer(g), bucht = strassen.find((st) => st.art === 'bucht'), R = bucht && bucht.raus, auto = teile.find((el) => el.a === 'auto');
  if (!H || !R || !R.strasse || !auto || !g.rand) return null;
  const { quer, vz, draussen, bz, strasse, blick } = R, r = g.rand;
  // Wir rechnen an der Straße entlang: u = wie weit die Straße hinunter, v = wie weit von der Straße weg (nach draußen).
  const welt = (u, v) => (quer ? { x: draussen + vz * v, z: u } : { x: u, z: draussen + vz * v });
  const u0 = quer ? bz : R.zufahrt[blick];                 // hier kommt der Wagen auf die Straße
  if (u0 === null || u0 === undefined) return null;
  const ua = (quer ? strasse.z - strasse.t / 2 : strasse.x - strasse.b / 2) + 8, ub = (quer ? strasse.z + strasse.t / 2 : strasse.x + strasse.b / 2) - 8;
  const halbStrasse = Math.min(strasse.b, strasse.t) / 2;
  // Was steht schon da? Alles mit festen Maßen – auch Flüsse, Gleise, Parkplätze. Bäume nicht, die weichen später aus.
  const dinge = [];
  let meerAb = Infinity;
  for (const el of teile) {
    if (el === strasse || el.a === 'baeume' || el.a === 'schirme') continue;
    if (el.a === 'meer') meerAb = el.ab;
    else if (el.a === 'tuerme') for (const [x, z, b, t] of el.p) dinge.push({ x, z, b, t });
    else if (el.a === 'kugel') dinge.push({ x: el.x, z: el.z, b: el.r * 2, t: el.r * 2 });
    else if (typeof el.x === 'number' && el.b && el.t && Math.max(el.b, el.t) < 1500) dinge.push({ x: el.x, z: el.z, b: el.b, t: el.t });
  }
  for (const st of strassen) if (st !== strasse) dinge.push({ x: st.x, z: st.z, b: st.b, t: st.t });
  // Das Gelände selbst ist natürlich auch besetzt
  dinge.push({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, b: r.x1 - r.x0 + 6, t: r.z1 - r.z0 + 6 });
  // Ab wo steigt draußen der Boden an? Dort darf das Hotel nicht stehen (sonst steckt es im Berg).
  let flachBis = 260;
  for (const text of Object.values(g.um || {})) { const m = /ab:(\d+)/.exec(text); if (m) flachBis = Math.min(flachBis, +m[1]); }
  const weitWeg = (p) => Math.hypot(Math.max(0, r.x0 - p.x, p.x - r.x1), Math.max(0, r.z0 - p.z, p.z - r.z1));

  let best = null;
  for (const tief of [1, 0.8, 0.62, 0.5]) {
    const b = H.b, t = Math.round(H.t * tief);
    for (const richtung of [1, -1]) for (let d = 60; d <= 330; d += 10) {
      const uh = u0 + richtung * d;                         // Mitte des Hotels an der Straße
      if (uh - b / 2 - 8 < ua || uh + b / 2 + 8 > ub) continue;
      // Der Kasten, den Hotel und Vorplatz brauchen
      const e1 = welt(uh - b / 2 - 6, halbStrasse + 1), e2 = welt(uh + b / 2 + 6, WAND + t + 3);
      const k = { x: (e1.x + e2.x) / 2, z: (e1.z + e2.z) / 2, b: Math.abs(e1.x - e2.x), t: Math.abs(e1.z - e2.z) };
      if (dinge.some((s) => Math.abs(k.x - s.x) < (k.b + s.b) / 2 + 1 && Math.abs(k.z - s.z) < (k.t + s.t) / 2 + 1)) continue;
      const ecken = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ x: k.x + sx * k.b / 2, z: k.z + sz * k.t / 2 }));
      if (ecken.some((p) => weitWeg(p) > flachBis - 8 || p.z > meerAb - 8)) continue;
      const note = Math.abs(d - WUNSCH_WEIT) + (1 - tief) * 40;
      if (!best || note < best.note) best = { note, uh, b, t, richtung };
    }
    if (best) break;
  }
  if (!best) return null;
  const { uh, b, t, richtung } = best;
  // ---- Die Bausteine: Hotel, Vorplatz, Vorfahrt mit Ein- und Ausfahrt ----
  const mitte = welt(uh, WAND + t / 2), ein = Math.min(b / 2 - 4, 18), ue = uh - richtung * ein;
  const kasten = (ua2, va, ub2, vb, mehr) => { const p = welt(ua2, va), q = welt(ub2, vb); return { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2, b: Math.abs(p.x - q.x), t: Math.abs(p.z - q.z), ...mehr }; };
  // Die Vorderseite schaut zur Straße
  const seite = quer ? (vz > 0 ? 'w' : 'o') : (vz > 0 ? 'n' : 's');
  const teil = { a: 'hotel', art: H.art, name: H.name, text: H.text, x: mitte.x, z: mitte.z, b: quer ? t : b, t: quer ? b : t, h: H.h, breit: b, tief: t, seite, klein: !!g.klein };
  const flaechen = [kasten(uh - b / 2 - 4, halbStrasse, uh + b / 2 + 4, WAND, { a: 'flaeche', farbe: PFLASTER, e: 2 })];
  const wege = [
    kasten(uh - ein - 2.5, VOR - 2.5, uh + ein + 2.5, VOR + 2.5, { a: 'strasse', art: 'hotelweg' }),
    kasten(uh - ein - 2.5, halbStrasse, uh - ein + 2.5, VOR - 2.5, { a: 'strasse', art: 'hotelweg' }),
    kasten(uh + ein - 2.5, halbStrasse, uh + ein + 2.5, VOR - 2.5, { a: 'strasse', art: 'hotelweg' }),
  ];
  // ---- Die Fahrstrecke: Mittellinie der Wege, die der Wagen nimmt. spur = wie weit rechts er fährt, tempo = wie schnell. ----
  const mittel = [{ x: auto.x, z: bz, spur: SPUR_KLEIN, tempo: TEMPO_LANGSAM }];
  if (!quer) mittel.push({ x: u0, z: bz, spur: SPUR_KLEIN, tempo: TEMPO_LANGSAM });
  mittel.push({ ...welt(u0, 0), spur: Math.min(SPUR_STRASSE, halbStrasse / 2), tempo: TEMPO_STRASSE, halt: 'alle' });       // vor dem Einbiegen schauen, ob frei ist
  mittel.push({ ...welt(ue, 0), spur: SPUR_KLEIN, tempo: TEMPO_LANGSAM, halt: 'gegen' });                                // vor dem Abbiegen den Gegenverkehr durchlassen
  mittel.push({ ...welt(ue, VOR), spur: 0, tempo: TEMPO_KURVE });
  mittel.push({ ...welt(uh, VOR), spur: 0, tempo: 0 });
  const tuer = welt(uh, WAND - 0.8), aus = welt(uh, VOR + 1.7);
  return { teil, flaechen, wege, name: H.name, art: H.art, text: H.text, mittel, start: { x: auto.x, z: auto.z, w: blick > 0 ? Math.PI / 2 : -Math.PI / 2 }, aus, tuer, weit: Math.abs(uh - u0) };
}

// Macht aus der Mittellinie die echte Fahrlinie: ein Stück rechts von der Mitte (Rechtsverkehr), mit runden Kurven.
//   start = { x, z } dort steht der Wagen · mittel = [{ x, z, spur, tempo, halt }] (spur, tempo gelten für das Stück, das dort beginnt)
// Gibt { p: [{ x, z, s, tempo }], lang, halte: [{ s, x, z, nur }] } zurück. s = Meter seit dem Start.
export function streckeBauen(start, mittel) {
  const n = mittel.length - 1, richt = [], rechts = [];
  for (let i = 0; i < n; i++) {
    const dx = mittel[i + 1].x - mittel[i].x, dz = mittel[i + 1].z - mittel[i].z, l = Math.hypot(dx, dz) || 1;
    richt.push({ x: dx / l, z: dz / l, l });
    rechts.push({ x: -dz / l * mittel[i].spur, z: dx / l * mittel[i].spur });      // „rechts“ von der Fahrtrichtung, schon mal Spurbreite
  }
  // Eckpunkte der Fahrlinie
  const ecken = [{ x: start.x, z: start.z, tempo: mittel[0].tempo }];
  const raus = Math.min(5, richt[0].l * 0.4);                                       // aus der Haltebucht schräg auf die Spur ziehen
  ecken.push({ x: mittel[0].x + richt[0].x * raus + rechts[0].x, z: mittel[0].z + richt[0].z * raus + rechts[0].z, tempo: mittel[0].tempo });
  for (let i = 1; i < n; i++) {
    const gerade = Math.abs(richt[i - 1].x * richt[i].x + richt[i - 1].z * richt[i].z) > 0.9;
    if (gerade) ecken.push({ x: mittel[i].x + rechts[i - 1].x, z: mittel[i].z + rechts[i - 1].z, tempo: mittel[i].tempo }, { x: mittel[i].x + rechts[i].x, z: mittel[i].z + rechts[i].z, tempo: mittel[i].tempo });
    else ecken.push({ x: mittel[i].x + rechts[i - 1].x + rechts[i].x, z: mittel[i].z + rechts[i - 1].z + rechts[i].z, tempo: mittel[i].tempo, halt: mittel[i].halt, mitte: mittel[i] });
  }
  ecken.push({ x: mittel[n].x + rechts[n - 1].x, z: mittel[n].z + rechts[n - 1].z, tempo: 0 });
  // Kurven abrunden: Aus jeder Ecke wird ein Bogen aus 8 kleinen Stücken
  const p = [{ x: ecken[0].x, z: ecken[0].z, tempo: ecken[0].tempo }], halte = [];
  for (let i = 1; i < ecken.length - 1; i++) {
    const a = ecken[i - 1], e = ecken[i], c = ecken[i + 1];
    const la = Math.hypot(e.x - a.x, e.z - a.z), lc = Math.hypot(c.x - e.x, c.z - e.z);
    if (la < 0.05) continue;
    const rr = Math.min(KURVE, la * 0.45, lc * 0.45);
    const von = { x: e.x + (a.x - e.x) / la * rr, z: e.z + (a.z - e.z) / la * rr }, bis = { x: e.x + (c.x - e.x) / (lc || 1) * rr, z: e.z + (c.z - e.z) / (lc || 1) * rr };
    if (e.halt) halte.push({ nr: p.length, nur: e.halt, x: e.mitte.x, z: e.mitte.z });
    for (let k = 0; k <= 8; k++) {
      const f = k / 8, g = 1 - f;
      p.push({ x: g * g * von.x + 2 * g * f * e.x + f * f * bis.x, z: g * g * von.z + 2 * g * f * e.z + f * f * bis.z, tempo: k < 8 ? Math.min(TEMPO_KURVE, a.tempo || TEMPO_KURVE) : e.tempo });
    }
  }
  const ende = ecken[ecken.length - 1];
  p.push({ x: ende.x, z: ende.z, tempo: 0 });
  // Wie viele Meter sind es bis zu jedem Punkt?
  let s = 0;
  p[0].s = 0;
  for (let i = 1; i < p.length; i++) { s += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); p[i].s = s; }
  for (const h of halte) { h.s = Math.max(0, p[h.nr].s - 1.5); delete h.nr; }
  return { p, lang: s, halte };
}

// Wo ist der Wagen nach s Metern? Gibt { x, z, w (Fahrtrichtung als Winkel, 0 = nach Süden/+z), tempo (so schnell darf er hier fahren) } zurück.
export function ortAuf(strecke, s) {
  const p = strecke.p;
  s = Math.max(0, Math.min(strecke.lang, s));
  let i = 1;
  while (i < p.length - 1 && p[i].s < s) i++;
  const a = p[i - 1], b = p[i], l = b.s - a.s || 1, f = (s - a.s) / l;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, w: Math.atan2(b.x - a.x, b.z - a.z), tempo: a.tempo || TEMPO_KURVE };
}
