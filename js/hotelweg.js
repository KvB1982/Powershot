// Powershot – zu Fuß zum Hotel (ohne three.js, in node testbar).
//
// Bei den kleinen Turnieren (ITF, Challenger) gibt es keinen Fahrdienst. Nach dem Match läufst du selbst
// durch das Städtchen zu deinem Hotel – und musst den Weg erst finden!
//
// Diese Datei baut für jede Stadt ein kleines Städtchen als ganz normales „Gelände“ (dieselben Bausteine wie in gelaende.js).
// Deshalb kann das Spiel es genauso bauen und man kann genauso darin herumlaufen wie auf einer Turnieranlage.
//
// So ist das Städtchen aufgebaut:
//   • Häuserblocks in einem Gitter, dazwischen Gassen. Ein Block ist ein Park, einer der Marktplatz.
//   • Manche Gassen sind gesperrt (Baustelle oder Hecke) – wie in einem Irrgarten. Es gibt aber immer einen Weg.
//   • An einigen Kreuzungen steht ein Wegweiser. Sein Pfeil zeigt in die Richtung, in der das Hotel liegt (Luftlinie!).
//   • Unterwegs gibt es Läden mit einem blauen Kreis ℹ️ – dort bekommst du einen Stempel ins Heft.
// Derselbe Stadtname ergibt immer dasselbe Städtchen (fester „Zufall“). Alles ist ausgedacht.

// ---- Zahlen zum Einstellen ----
const BLOCK_B = 24, BLOCK_T = 20;    // so groß ist ein Häuserblock (Meter)
const GASSE = 7;                     // so breit sind die Gassen
const OFFEN = 0.25;                  // so viele der „überflüssigen“ Gassen bleiben trotzdem offen (0 = strenger Irrgarten, 1 = alles offen)
export const TEMPO_SOLL = 3.4;       // mit diesem Tempo wird die Soll-Zeit gerechnet (Meter pro Sekunde)
export const STERNE_ZEIT = [1.4, 2.2];   // bis 1,4-mal die Soll-Zeit gibt es 3 Sterne, bis 2,2-mal 2 Sterne, sonst 1 Stern
export const TIPP_WEIT = 45;         // im Städtchen läuft die Figur höchstens so weit von allein (sonst wäre das Suchen ja langweilig)

const WIESE = 0x5c9a4c, WASSER = 0x3f8fc8, GASSEN_FARBE = 0xbdb5a6, MARKT_FARBE = 0xd8cdb8;
const HOTEL_NAMEN = ['Hotel Central', 'Pension Sonnenhof', 'Hotel Goldener Ball', 'Hotel Am Markt', 'Pension Tennisblick', 'Sporthotel Ass', 'Hotel Zur Post', 'Hotel Bella Vista', 'Pension Zum Netzroller', 'Hotel Drei Linden'];
// Läden und Orte, an denen man unterwegs vorbeikommt: Name und Erklärtext (für den Stempel im Heft)
const LAEDEN = [
  ['Bäckerei', 'Hier holen sich die Spieler morgens Brötchen. Bei kleinen Turnieren gibt es kein Spieler-Restaurant – jeder kümmert sich selbst ums Frühstück.'],
  ['Eisdiele', 'Nach einem Sieg gibt es eine Kugel Eis. Nach einer Niederlage auch – dann schmeckt sie nur nicht ganz so gut.'],
  ['Sportgeschäft', 'Im Schaufenster liegen Schläger und Griffbänder. Der Besitzer bespannt auch Schläger – manchmal noch spät am Abend für die Turnierspieler.'],
  ['Waschsalon', 'Auf der kleinen Tour wäscht jeder seine Tenniskleidung selbst. Viele Spieler sitzen abends hier und warten auf die Maschine.'],
  ['Supermarkt', 'Bananen, Nudeln, Wasser: Wer bei kleinen Turnieren Geld sparen will, kauft selbst ein, statt essen zu gehen.'],
  ['Apotheke', 'Pflaster für Blasen an den Händen und Tape für die Finger – das brauchen Tennisspieler ständig.'],
  ['Rathaus', 'Der Bürgermeister kommt zum Finale und überreicht den Pokal. Für die kleine Stadt ist das Turnier das größte Ereignis des Jahres.'],
  ['Bahnhof', 'Viele junge Spieler reisen mit dem Zug zum nächsten Turnier – mit der großen Schlägertasche auf dem Rücken.'],
  ['Buchladen', 'Im Fenster liegt ein Buch über die besten Tennisspieler aller Zeiten. Vielleicht steht dein Name irgendwann auch darin.'],
  ['Pizzeria', 'Am Abend vor dem Match essen viele Spieler Nudeln oder Pizza: Das gibt Kraft für lange Ballwechsel.'],
];

// Ein Zufall, der für denselben Text immer dieselben Zahlen liefert
function zufallAus(text) {
  let s = 2166136261;
  for (const z of text) s = Math.imul(s ^ z.codePointAt(0), 16777619);
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Baut das Städtchen. def = das Turnier · g = das Gelände des Turniers (von dort kommen Baustil, Farben und Landschaft)
export function stadtGelaende(def, g) {
  const stadt = (g && g.ort) || (def && def.city) || 'Zu Hause', heim = !!(g && g.liga);
  const zf = zufallAus(stadt + '|zu Fuß'), aus = (liste) => liste[Math.floor(zf() * liste.length)];
  const NX = 4, NZ = g && g.stufe >= 1 ? 4 : 3;                       // so viele Blocks nebeneinander und hintereinander
  const X = (i) => (i - NX / 2) * (BLOCK_B + GASSE), Z = (k) => (k - NZ / 2) * (BLOCK_T + GASSE);      // die Kreuzungen
  const rand = { x0: X(0) - 5, x1: X(NX) + 5, z0: Z(0) - 5, z1: Z(NZ) + 9 };
  const T = [];
  // Farben und Dächer wie auf der Anlage des Turniers
  const muster = ((g && g.teile) || []).find((el) => el.a === 'haus' && el.farbe && el.dachFarbe) || { farbe: 0xe8e0d0, dachFarbe: 0x7a3a2a, dach: 'sattel' };
  const dach = muster.dach === 'flach' ? 'flach' : 'sattel';
  const waende = [muster.farbe, 0xe8e0d0, 0xd8c8a8, 0xf0e4d0], daecher = [muster.dachFarbe, muster.dachFarbe, 0x6a4a3e];
  const baum = ((g && g.teile) || []).find((el) => el.a === 'baeume');
  const baumArt = baum ? baum.art : 'laub';
  const haus = (x, z, b, t, mehr = {}) => T.push({ a: 'haus', x, z, b, t, h: 5.5 + Math.floor(zf() * 4), farbe: aus(waende), dachFarbe: aus(daecher), dach, ...mehr });
  const info = (name, x, z, text, seite) => T.push({ a: 'leinwand', x, z, b: 0.1, h: 0.1, name, tuer: seite, info: text });

  // ---- 1. Start und Hotel ----
  const iStart = 1 + Math.floor(zf() * (NX - 1));                     // an dieser Kreuzung am Südrand kommst du vom Tennisclub
  // Das Hotel steht in der hintersten Reihe, möglichst weit zur Seite weg vom Start
  const iHotel = iStart <= NX / 2 ? NX - 1 - Math.floor(zf() * 2) * (NX > 3 ? 1 : 0) : Math.floor(zf() * 2);
  const blockMitte = (i, k) => [(X(i) + X(i + 1)) / 2, (Z(k) + Z(k + 1)) / 2];
  const [hx, hz] = blockMitte(iHotel, 0);
  const zielName = heim ? 'Zuhause' : aus(HOTEL_NAMEN);
  T.push({ a: 'haus', name: zielName, x: hx, z: hz + BLOCK_T / 2 - 6, b: BLOCK_B, t: 12, h: heim ? 7 : 9.5, farbe: heim ? 0xf0e4d0 : 0xf4ecd8, dachFarbe: heim ? 0x8a3a2a : 0x4a5a6a, dach, ort: 'ziel', tuer: 's', heim,
    text: heim ? 'Zu Hause! Heute schläfst du im eigenen Bett.' : 'Geschafft – das ist dein Hotel. Bei kleinen Turnieren ist es eine einfache Pension, in der fast alle Spieler wohnen.' });
  // dahinter der Garten, von einer Hecke umgeben (damit der Block rundherum zu ist)
  T.push({ a: 'flaeche', x: hx, z: hz - 6, b: BLOCK_B - 1, t: 8, farbe: WIESE, e: 2 }, { a: 'baeume', art: baumArt, feld: [hx, hz - 6, BLOCK_B - 6, 4], n: 3 });
  T.push({ a: 'hecke', x: hx, z: hz - BLOCK_T / 2 + 0.5, b: BLOCK_B, t: 1 }, { a: 'hecke', x: hx - BLOCK_B / 2 + 0.5, z: hz - 6, b: 1, t: 8 }, { a: 'hecke', x: hx + BLOCK_B / 2 - 0.5, z: hz - 6, b: 1, t: 8 });
  // Start: das Tor vom Tennisclub am Südrand (eine Hecke mit Lücke, zwei Fahnen)
  const sx = X(iStart), sz = Z(NZ) + 6.5;
  T.push({ a: 'leinwand', x: sx, z: sz, b: 0.1, h: 0.1, ort: 'start', tuer: 'n' });
  for (const s of [-1, 1]) { const l = s < 0 ? sx - 2.2 - rand.x0 : rand.x1 - sx - 2.2; T.push({ a: 'hecke', x: sx + s * (2.2 + l / 2), z: sz + 0.4, b: l, t: 1.2 }); }
  T.push({ a: 'fahnen', x: sx - 4.6, z: sz - 1.2, n: 2, farben: [0xf0d040, 0x3a6ae8] }, { a: 'fahnen', x: sx + 3, z: sz - 1.2, n: 2, farben: [0xe84a3a, 0xf4f4f0] });

  // ---- 2. Die übrigen Blocks: Häuser, ein Park, ein Marktplatz ----
  const bloecke = [];
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) if (!(i === iHotel && k === 0)) bloecke.push([i, k]);
  // Park und Markt irgendwo in der Mitte (nicht direkt neben dem Hotel)
  const mitte = bloecke.filter(([i, k]) => k > 0 && Math.abs(i - iHotel) + k > 1).sort(() => zf() - 0.5);
  const park = mitte[0], markt = mitte[1];
  const laeden = LAEDEN.slice().sort(() => zf() - 0.5).slice(0, 4), ladenBloecke = bloecke.filter((b) => b !== park && b !== markt).sort(() => zf() - 0.5).slice(0, 4);
  for (const b of bloecke) {
    const [i, k] = b, [cx, cz] = blockMitte(i, k);
    if (b === park) {
      T.push({ a: 'flaeche', x: cx, z: cz, b: BLOCK_B, t: BLOCK_T, farbe: WIESE, e: 2 }, { a: 'baeume', art: baumArt, feld: [cx, cz, BLOCK_B - 4, BLOCK_T - 4], n: 7 });
      T.push({ a: 'flaeche', x: cx + 4, z: cz - 2, b: 8, t: 5, farbe: WASSER, e: 2, rund: true, wasser: true });
      info('Stadtpark', cx - 6, cz + BLOCK_T / 2 - 0.2, 'Quer durch den Park kann man abkürzen! Im Teich schwimmen Enten, auf der Wiese spielen Kinder Fußball.', 's');
    } else if (b === markt) {
      T.push({ a: 'flaeche', x: cx, z: cz, b: BLOCK_B, t: BLOCK_T, farbe: MARKT_FARBE, e: 2 });
      T.push({ a: 'flaeche', x: cx, z: cz + 3, b: 4.5, t: 4.5, farbe: WASSER, e: 2, rund: true, wasser: true });           // der Brunnen
      T.push({ a: 'zelte', x: cx, z: cz - 5, b: 14, n: 3 }, { a: 'schirme', x: cx - 7, z: cz + 4, b: 5, t: 6, n: 3, farbe: 0xe84a3a }, { a: 'schirme', x: cx + 7, z: cz + 4, b: 5, t: 6, n: 3, farbe: 0xf4f0e4 });
      info('Marktplatz', cx - 6, cz + BLOCK_T / 2 - 0.2, 'Der Marktplatz mit dem Brunnen. Am Samstag ist Wochenmarkt – und am Turnier-Wochenende hängt hier ein großes Plakat mit den Spielern.', 's');
    } else {
      // Häuser, Wand an Wand: zwei nebeneinander, zwei hintereinander oder vier kleine
      const art = Math.floor(zf() * 2.4);                              // vier kleine Häuser gibt es seltener (jedes Haus ist ein eigenes 3D-Modell)
      if (art === 0) for (const s of [-1, 1]) haus(cx + s * BLOCK_B / 4, cz, BLOCK_B / 2, BLOCK_T);
      else if (art === 1) for (const s of [-1, 1]) haus(cx, cz + s * BLOCK_T / 4, BLOCK_B, BLOCK_T / 2);
      else for (const s of [-1, 1]) for (const q of [-1, 1]) haus(cx + s * BLOCK_B / 4, cz + q * BLOCK_T / 4, BLOCK_B / 2, BLOCK_T / 2);
      const nr = ladenBloecke.indexOf(b);
      if (nr >= 0 && laeden[nr]) {
        // Ein Laden: der blaue Kreis liegt vor der Hauswand, ein Stück neben der Mitte (dort steht nie eine Absperrung)
        const sued = k < NZ - 1 || zf() < 0.5;
        info(laeden[nr][0], cx + (zf() < 0.5 ? -7 : 7), cz + (sued ? 1 : -1) * (BLOCK_T / 2 + 0.05), laeden[nr][1], sued ? 's' : 'n');
      }
    }
  }

  // ---- 3. Der Irrgarten: Welche Gassen sind gesperrt? ----
  // Kreuzungen sind Punkte (i, k). Wir laufen vom Start kreuz und quer los („Tiefensuche“) und merken uns jede Gasse,
  // über die wir zu einer neuen Kreuzung kommen. Diese Gassen bleiben offen – so ist garantiert jede Kreuzung erreichbar.
  const nr = (i, k) => k * (NX + 1) + i, offen = new Set(), besucht = new Set([nr(iStart, NZ)]), stapel = [[iStart, NZ]];
  const kante = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
  while (stapel.length) {
    const [i, k] = stapel[stapel.length - 1];
    const nachbarn = [[i + 1, k], [i - 1, k], [i, k + 1], [i, k - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a <= NX && b <= NZ && !besucht.has(nr(a, b)));
    if (!nachbarn.length) { stapel.pop(); continue; }
    const [a, b] = aus(nachbarn);
    besucht.add(nr(a, b)); offen.add(kante(nr(i, k), nr(a, b))); stapel.push([a, b]);
  }
  offen.add(kante(nr(iHotel, 1), nr(iHotel + 1, 1)));                 // die Gasse vor dem Hotel ist immer offen
  let sperrNr = 0;
  const sperre = (x, z, laengs) => {
    // abwechselnd eine Baustelle und eine dichte Hecke quer über die Gasse
    const quer = laengs ? { b: 1.2, t: GASSE + 0.4 } : { b: GASSE + 0.4, t: 1.2 };
    T.push({ a: sperrNr++ % 2 ? 'hecke' : 'absperrung', x, z, ...quer });
  };
  for (let k = 0; k <= NZ; k++) for (let i = 0; i <= NX; i++) {
    if (i < NX && !offen.has(kante(nr(i, k), nr(i + 1, k))) && zf() > OFFEN) sperre((X(i) + X(i + 1)) / 2, Z(k), true);
    if (k < NZ && !offen.has(kante(nr(i, k), nr(i, k + 1))) && zf() > OFFEN) sperre(X(i), (Z(k) + Z(k + 1)) / 2, false);
  }

  // ---- 4. Wegweiser: an jeder zweiten Kreuzung, der Pfeil zeigt zum Hotel ----
  const tuer = { x: hx, z: hz + BLOCK_T / 2 + 1.9 };                  // dort steht man vor der Hoteltür
  for (let k = 0; k <= NZ; k++) for (let i = 0; i <= NX; i++) {
    const amStart = i === iStart && k === NZ;
    if (!amStart && ((i + k) % 2 || Math.hypot(X(i) - tuer.x, Z(k) - tuer.z) < 30)) continue;
    const x = X(i) + 2.7, z = Z(k) + (k === NZ ? 2.7 : -2.7);
    T.push({ a: 'wegweiser', x, z, w: Math.atan2(tuer.x - x, tuer.z - z), text: heim ? 'Nach Hause' : 'Hotel' });
  }
  // Laternen-Ersatz: ein paar Bäume am Rand, damit das Städtchen nicht kahl aussieht
  T.push({ a: 'baeume', art: baumArt, linie: [rand.x0 + 1.2, rand.z0 + 1.2, rand.x1 - 1.2, rand.z0 + 1.2], n: 9 });

  // ---- 5. Die Landschaft rundherum: wie beim Turnier, nur liegt vorn immer ein Vorort ----
  const um = {};
  for (const k of 'nosw') {
    const alt = ((g && g.um) || {})[k] || '';
    if (/\bmeer\b/.test(alt) && k === 's') { um[k] = 'meer'; continue; }
    const fern = alt.split(/\s+/).filter((w) => /^(huegel|waldberge|berge|alpen|fels|skyline)/.test(w)).join(' ');
    um[k] = `${/wueste/.test(alt) ? 'vorort wueste' : 'vorort felder'} ${fern}`.trim();
  }
  if (um.s === 'meer') T.push({ a: 'meer', ab: rand.z1 + 6 });
  return {
    name: heim ? 'Dein Heimatort' : `Ortsmitte ${stadt}`, stadt: heim ? 'der Weg nach Hause' : 'zu Fuß zum Hotel', ort: stadt, rand, umland: (g && g.umland) || 0x5c9a4c, boden: GASSEN_FARBE, feld: (g && g.feld) || [0xc8643a, 0xb85a34],
    kamW: 0, leute: 14, klein: true, stufe: (g && g.stufe) || 0, stil: (g && g.stil) || 'europa', um, fichte: !!(g && g.fichte), teile: T,
    zuFuss: true, heim, ziel: { name: zielName },
    // Namen und Texte für die zwei besonderen Türen (die übrigen Namen stehen an den Bausteinen)
    orteNamen: { start: { name: heim ? 'Dein Tennisverein' : 'Tennisclub', text: 'Von hier bist du losgelaufen.' }, ziel: { name: heim ? 'Hier wohnst du' : 'Dein Hotel', text: '' } },
  };
}

// Wie viele Sterne gibt es für diese Zeit? weg = kürzester Weg in Metern, zeit = gebrauchte Sekunden
export function sterneFuer(weg, zeit) {
  const soll = weg / TEMPO_SOLL;
  return zeit <= soll * STERNE_ZEIT[0] ? 3 : zeit <= soll * STERNE_ZEIT[1] ? 2 : 1;
}
