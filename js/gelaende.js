// Powershot – die Turniergelände der großen Turniere (ohne three.js, in node testbar).
//
// Jedes Grand-Slam- und Masters-Turnier hat hier seinen eigenen Lageplan: Wo stehen die Stadien,
// wo die Nebenplätze, die Trainingsplätze, die Häuser für die Spieler – und was sieht man drumherum?
//
// Die Pläne sind den echten Anlagen NACHEMPFUNDEN (Stand 2026), aber vereinfacht:
//   - Alles ist ungefähr auf ein Drittel verkleinert, damit man nicht minutenlang laufen muss.
//   - Welche Stadien es gibt, wie viele Zuschauer hineinpassen und was ungefähr wo liegt, ist echt.
//   - Die genaue Lage kleiner Häuser (Kraftraum, Besaiter, Presse …) ist geschätzt.
//   - Sponsoren-Namen und Logos gibt es nicht.
//
// Koordinaten: Meter. x = nach Osten (rechts auf der Karte), z = nach Süden (unten auf der Karte). Norden ist also −z.
//
// Bausteine (a = Art):
//   stadion  Stadion mit Tribünen. form: 'oval' | 'rund' | 'eckig' | 'acht' · dach: 'offen' | 'schieb' (Schiebedach) | 'ring' | 'zu' | 'glas' | 'blume'
//   plaetze  mehrere Tennisplätze nebeneinander (nx Stück nach Osten, nz Stück nach Süden; quer = Plätze liegen quer)
//   haus     Gebäude. dach: 'flach' | 'sattel' | 'glas' (Gewächshaus) | 'zelt'
//   flaeche  farbige Fläche auf dem Boden (Pflaster, Rasen, Straße). wasser: true = Wasser, da kann man nicht durch
//   baeume   Bäume: art 'laub' | 'palme' | 'pinie' | 'zypresse' – als Reihe (linie) oder verstreut (feld)
//   modell   ein einzelnes fertiges 3D-Modell als Schmuck (z. B. eine Yacht): modell = Name der Datei in assets/gelaende/, dreh in Grad, gr = Größe
//   Stadien, Häuser und Türme dürfen mit „modell“ ein eigenes 3D-Modell nennen; „stil“ beim Gelände sagt, wie die übrigen Häuser aussehen (england, mittelmeer, wueste, usa, asien, alpen, europa, modern).
//   dazu: huegel, berge, meer, kugel, bogen, tuerme, statuen, obelisk, leinwand, schirme, zelte, glasdach, auto, zaun
// Ein Baustein mit „ort“ ist eine Tür, an der man etwas tun kann (court, training, kraft, physio, essen, saiten, presse, hotel, fans).
// Ein Baustein mit „info“ ist eine Sehenswürdigkeit: Wer hingeht, bekommt den Text zu lesen.

import { kleinesGelaende } from './gelaendeklein.js';

// So groß ist ein Tennisplatz auf dem Gelände (mit Auslauf) und so viel Abstand ist zum nächsten
export const PLATZ_L = 13, PLATZ_B = 7, LUECKE_B = 1.2, LUECKE_L = 1.5;

// ---- Farben, die oft vorkommen ----
const PFLASTER = 0xcfc8ba, ASPHALT = 0x77777c, RASEN = 0x4f8a45, WIESE = 0x5c9a4c, WASSER = 0x3f8fc8, SANDPLATZ = 0xc8643a, WEISS = 0xf2efe8;

// ---- Kurzschreibweisen, damit die Pläne unten gut lesbar bleiben ----
const S = (name, x, z, b, t, h, mehr = {}) => ({ a: 'stadion', name, x, z, b, t, h, ...mehr });
const H = (name, x, z, b, t, h, mehr = {}) => ({ a: 'haus', name, x, z, b, t, h, ...mehr });
const P = (x, z, nx, nz, mehr = {}) => ({ a: 'plaetze', x, z, nx, nz, ...mehr });
const F = (x, z, b, t, farbe, mehr = {}) => ({ a: 'flaeche', x, z, b, t, farbe, ...mehr });
const B = (art, mehr) => ({ a: 'baeume', art, ...mehr });
const AUTO = (x, z) => ({ a: 'auto', x, z, b: 4.4, t: 2, ort: 'hotel', tuer: 's' });
const ZAUN = (x, z) => ({ a: 'zaun', x, z, b: 4, t: 1, ort: 'fans', tuer: 's' });

export const GELAENDE = {
  // =====================================================================================
  // AUSTRALIAN OPEN – Melbourne Park. Ein langes Gelände zwischen den Bahngleisen (Norden) und dem Fluss Yarra (Süden).
  // =====================================================================================
  ao: {
    stil: 'modern', name: 'Melbourne Park', stadt: 'Melbourne, Australien',
    rand: { x0: -106, x1: 110, z0: -48, z1: 48 }, umland: 0x6f9a5a, boden: PFLASTER, feld: [0x2f6fc4, 0x1f4f9c],
    teile: [
      F(0, 55, 700, 8, ASPHALT), F(0, 112, 700, 30, WASSER), F(0, -57, 700, 10, 0x6a6258),          // Straße, Fluss Yarra, Bahngleise
      S('Cricket-Stadion MCG', -20, -104, 74, 68, 17, { form: 'rund', dach: 'ring', farbe: 0xb8bcc4, sitz: 0x8a9aa8, wiese: true }),
      { a: 'huegel', x: 78, z: 88, b: 52, t: 40, h: 11, farbe: 0xf4f4f0 },                            // das Fußballstadion mit dem Blasen-Dach
      S('Rod Laver Arena', -30, 0, 44, 40, 12, { modell: 'stadion_ao', form: 'acht', dach: 'schieb', farbe: 0xd8dce2, sitz: 0x2a5aa8, ort: 'court', tuer: 's',
        text: 'Das größte Stadion von Melbourne: fast 15.000 Plätze und ein Dach, das zufahren kann. Benannt nach Rod Laver, der zweimal alle vier Grand Slams in einem Jahr gewann.' }),
      S('Margaret Court Arena', 10, -24, 28, 26, 9, { form: 'eckig', dach: 'schieb', farbe: 0xc8a070, sitz: 0x3a6ab0, tuer: 's',
        info: 'Das drittgrößte Stadion (7.500 Plätze). Sein Dach schließt in nur fünf Minuten – schneller als jedes andere Tennis-Dach.' }),
      S('Show Court 2', -44, -34, 16, 14, 3.5, { form: 'eckig', tuer: 'w', info: 'Ein kleines Stadion für 3.000 Zuschauer. Hier sitzt man ganz nah an den Spielern.' }),
      S('Court 3', -64, -32, 16, 14, 3.5, { form: 'eckig' }),
      P(-88, -8, 3, 3, { name: 'Westplätze' }),
      F(-62, 2, 22, 22, WIESE, { e: 2 }), { a: 'leinwand', x: -62, z: -10.5, b: 10, h: 5, name: 'Garden Square', tuer: 's', info: 'Auf der Wiese sitzen die Fans in Liegestühlen und schauen die Matches auf der großen Leinwand.' },
      H('Medien-Haus', -84, 36, 22, 9, 7, { farbe: 0x8a9098, ort: 'presse', tuer: 'n' }),
      H('Besaiter', -60, 37, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 'n' }),
      H('Centrepiece', -8, 35, 24, 12, 8, { farbe: 0x3a4250, dachFarbe: 0xb8c0c8, ort: 'essen', tuer: 'n', name2: 'Spieler-Restaurant' }),
      F(24, 10, 32, 24, WIESE, { e: 2, rund: true }), { a: 'schirme', x: 24, z: 10, b: 24, t: 16, n: 9, farbe: 0xf0f0f0 },
      ZAUN(24, 26),
      S('Show Court Arena', 50, 30, 22, 20, 5, { form: 'eckig', dach: 'ring', tuer: 'w', info: 'Das neueste Stadion (5.000 Plätze). Es ist halb in den Boden eingelassen, und das Dach spendet Schatten.' }),
      H('National Tennis Centre', 50, -26, 32, 18, 9, { farbe: 0x7a8894, tueren: [{ ort: 'kraft', s: 's', v: -9 }, { ort: 'physio', s: 's', v: 9 }] }),
      P(56, -1, 2, 1, { quer: true, ort: 'training', tuer: 'w', name: 'Trainingsplätze' }),
      S('John Cain Arena', 90, 6, 34, 32, 11, { form: 'oval', dach: 'schieb', farbe: 0xe0e4e8, sitz: 0x2a8a9a, tuer: 'w',
        info: 'Das „Stadion des Volkes“ (10.500 Plätze): Hier kommt man mit der einfachen Tageskarte hinein, und die Stimmung ist besonders laut.' }),
      P(88, -32, 2, 1, { quer: true, name: 'Ostplätze' }),
      AUTO(14, 43),
      B('laub', { linie: [-100, 45, 100, 45], n: 16 }), B('laub', { linie: [-100, -45, 30, -45], n: 10 }), B('laub', { feld: [0, 82, 300, 30], n: 40 }),
    ],
  },

  // =====================================================================================
  // ROLAND GARROS – Paris. Ein schmaler Streifen am Stadtwald Bois de Boulogne, ganz im Osten das Stadion im Gewächshaus-Garten.
  // =====================================================================================
  rg: {
    stil: 'europa', name: 'Stade Roland Garros', stadt: 'Paris, Frankreich',
    rand: { x0: -110, x1: 100, z0: -33, z1: 33 }, umland: 0x5a8a4a, boden: 0xd8cdb8, feld: [0xcc6a3c, 0xbc5e36],
    teile: [
      F(0, -40, 700, 9, ASPHALT), F(0, 40, 700, 8, ASPHALT),
      B('laub', { feld: [0, -85, 420, 70], n: 150 }),                                                // der Wald Bois de Boulogne
      { a: 'tuerme', modell: 'haus_altbau', p: [[-90, 56, 14, 12, 9], [-60, 58, 18, 12, 11], [-25, 56, 16, 12, 10], [10, 58, 20, 12, 9], [45, 56, 16, 12, 11], [80, 58, 18, 12, 10]], farbe: 0xe6dcc8, dach: 0x6a7078 },   // Pariser Wohnhäuser
      S('Court Philippe-Chatrier', 10, 0, 42, 38, 12, { modell: 'stadion_rg', form: 'eckig', dach: 'schieb', farbe: 0xd8d0c0, sitz: 0x2a6a4a, ort: 'court', tuer: 's',
        text: 'Der Centre Court von Paris: 15.000 Plätze, roter Sand und seit 2020 ein Dach. An den vier Tribünen stehen die Namen der „vier Musketiere“ des französischen Tennis.' }),
      S('Court Suzanne-Lenglen', -36, 4, 32, 28, 9, { form: 'oval', dach: 'schieb', farbe: 0xe0d8c8, sitz: 0x2a6a4a, tuer: 's',
        info: 'Das zweitgrößte Stadion (10.000 Plätze), benannt nach der berühmten Spielerin Suzanne Lenglen. Seit 2024 hat es ein Dach aus weißem Stoff.' }),
      F(-12, -21, 18, 16, WIESE, { e: 2, rund: true }), { a: 'leinwand', x: -12, z: -30, b: 9, h: 4.5, name: 'Place des Mousquetaires', tuer: 's', info: 'Der Platz der vier Musketiere. Hier stand früher der runde Platz Nr. 1, die „Stierkampf-Arena“. Heute schaut man hier auf der Leinwand zu.' },
      H('Les Jardins', -12, 26, 14, 8, 4, { farbe: 0xe8e0d0, dachFarbe: 0x3a6a4a, ort: 'essen', tuer: 'n' }),
      P(-70, -2.25, 3, 2, { name: 'Plätze 6 bis 11' }),
      S('Court 14', -97, -4, 16, 20, 3.5, { form: 'eckig', tuer: 'o', info: 'Ein kleines Stadion im Westen, in den Boden eingelassen. Die Fans lieben es, weil man den Spielern hier ganz nah ist.' }),
      P(-96, 21, 1, 1, { quer: true, ort: 'training', tuer: 'o', name: 'Trainingsplatz' }),
      H('Spielerzentrum', 44, -18, 16, 10, 6, { farbe: 0xd0c8b8, tueren: [{ ort: 'kraft', s: 's', v: -4 }, { ort: 'physio', s: 's', v: 4 }] }),
      H('Le Village', 44, 10, 14, 12, 5, { farbe: 0xf0ece0, dach: 'zelt', ort: 'presse', tuer: 'n' }),
      H('Besaiter', 58, 26, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 'n' }),
      S('Court Simonne-Mathieu', 80, -2, 22, 20, 4.5, { form: 'eckig', sitz: 0x3a6a4a, tuer: 's',
        info: 'Ein Stadion mitten im Garten: Es liegt vier Meter tief und ist rundherum von Gewächshäusern mit Pflanzen aus aller Welt umgeben.' }),
      H('', 80, -18, 30, 5, 5, { dach: 'glas' }), H('', 65.5, -2, 5, 20, 5, { dach: 'glas' }), H('', 94.5, -2, 5, 20, 5, { dach: 'glas' }),
      ZAUN(26, 26), AUTO(4, 29),
      B('laub', { linie: [-104, -30, 96, -30], n: 22 }), B('laub', { feld: [80, 22, 30, 14], n: 8 }),
    ],
  },

  // =====================================================================================
  // WIMBLEDON – London. Rasen, dunkelgrüne Stadien, lila Blumen. Im Norden der Hügel und die Trainingsplätze, im Osten die Church Road.
  // =====================================================================================
  wim: {
    stil: 'england', name: 'All England Club', stadt: 'London, England',
    rand: { x0: -56, x1: 52, z0: -82, z1: 76 }, umland: 0x4f8a45, boden: 0xb8b4a4, feld: [0x4a9a3c, 0x3f8a34],
    teile: [
      F(60, 0, 8, 500, ASPHALT), F(-64, 0, 7, 500, ASPHALT),                                          // Church Road (Osten), Somerset Road (Westen)
      F(110, -10, 46, 70, WASSER, { rund: true }), B('laub', { feld: [115, 0, 90, 240], n: 60 }),     // See und Park hinter der Straße
      { a: 'tuerme', p: [[-84, -50, 12, 10, 7], [-86, -20, 12, 12, 8], [-84, 12, 12, 10, 7], [-86, 44, 12, 12, 8]], farbe: 0xb8866a, dach: 0x5a4a44 },
      S('Centre Court', 5, 10, 36, 36, 12, { modell: 'stadion_wim', form: 'acht', dach: 'schieb', farbe: 0x1f4a2e, sitz: 0x2a5a3a, dachFarbe: 0xe8ece8, ort: 'court', tuer: 's',
        text: 'Der berühmteste Tennisplatz der Welt: 15.000 Plätze, heiliger Rasen und ein Dach wie eine Ziehharmonika. Über dem Spielereingang steht ein Satz aus einem Gedicht über Sieg und Niederlage.' }),
      S('No. 1 Court', 8, -38, 34, 34, 11, { form: 'rund', dach: 'schieb', farbe: 0x1f4a2e, sitz: 0x2a5a3a, dachFarbe: 0xe8ece8, tuer: 'o',
        info: 'Das zweite große Stadion (über 12.000 Plätze). Seit 2019 hat es auch ein Dach.' }),
      { a: 'leinwand', x: -11.5, z: -36, b: 9, h: 5, dreh: 270 },
      { a: 'huegel', x: -26, z: -36, b: 24, t: 24, h: 4, farbe: 0x58a048, name: 'Der Hügel', tuer: 's', info: 'Auf diesem Hügel sitzen Tausende Fans mit Picknick und Erdbeeren und schauen auf die Leinwand. Die Engländer nennen ihn „Henman Hill“.' },
      F(5, -14.5, 24, 8, RASEN, { e: 2 }), { a: 'schirme', x: 5, z: -14.5, b: 20, t: 5, n: 6, farbe: 0x2a5a3a },
      P(0, -70, 6, 1, { ort: 'training', tuer: 's', name: 'Aorangi Park' }),
      H('Aorangi-Pavillon', 38, -68, 12, 9, 4.5, { farbe: 0x2a5a3a, dach: 'sattel', ort: 'physio', tuer: 'w' }),
      P(-41, 13, 2, 2, { name: 'Plätze 14 bis 17' }), P(-41, -13, 2, 1, { name: 'Plätze 18 und 19' }),
      H('Millennium-Gebäude', -19, 10, 8, 30, 8, { farbe: 0x244e32, tueren: [{ ort: 'presse', s: 'w', v: -10 }, { ort: 'essen', s: 'w', v: 0, name: 'Spieler-Restaurant' }, { ort: 'kraft', s: 'w', v: 10 }] }),
      P(-10, 50, 5, 2, { name: 'Plätze 4 bis 13' }),
      S('No. 3 Court', 30, 37, 16, 14, 4, { form: 'eckig', farbe: 0x1f4a2e, sitz: 0x2a5a3a }),
      S('No. 2 Court', 32, 60, 18, 22, 5, { form: 'eckig', farbe: 0x1f4a2e, sitz: 0x2a5a3a, tuer: 'w', info: 'Hier passen 4.000 Zuschauer hinein. Der alte Platz 2 hieß „Friedhof der Champions“, weil dort so viele Favoriten verloren haben.' }),
      H('Museum', 36, 8, 8, 14, 5, { farbe: 0x244e32, tuer: 's', info: 'Im Wimbledon-Museum stehen die echten Pokale: der goldene für die Herren und die silberne Schale für die Damen.' }),
      H('Besaiter', 42, -14, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 's' }),
      F(26, 24, 3, 3, 0x7a4ab8, { e: 2 }), F(-6, 31.5, 14, 2, 0x7a4ab8, { e: 2 }), F(18, -18, 2, 6, 0x7a4ab8, { e: 2 }),      // lila Blumenbeete
      ZAUN(28, -60), AUTO(44, 26),
      B('laub', { linie: [50, -78, 50, 72], n: 14 }), B('laub', { linie: [-54, -78, -54, 72], n: 12 }),
    ],
  },

  // =====================================================================================
  // US OPEN – New York, Flushing Meadows. Das größte Tennisstadion der Welt in der Mitte, die Weltkugel im Park dahinter.
  // =====================================================================================
  uso: {
    stil: 'usa', name: 'National Tennis Center', stadt: 'New York, USA',
    rand: { x0: -96, x1: 98, z0: -70, z1: 70 }, umland: 0x5a8a4a, boden: 0xb8b8b4, feld: [0x2f5fb0, 0x3f8a4a],
    teile: [
      F(0, -80, 700, 12, 0x6a6258),                                                                   // Gleise der U-Bahn
      S('Baseball-Stadion', 40, -136, 80, 76, 16, { form: 'rund', dach: 'ring', farbe: 0x8a5a44, sitz: 0x2a4a8a, wiese: true }),
      { a: 'kugel', x: 0, z: 104, r: 11 }, F(0, 104, 34, 34, WASSER, { rund: true, e: 2 }), F(0, 80, 12, 22, PFLASTER),
      B('laub', { feld: [0, 112, 320, 70], n: 80 }),
      S('Arthur Ashe Stadium', 0, -6, 60, 56, 16, { modell: 'stadion_uso', form: 'acht', dach: 'schieb', farbe: 0x7a8088, sitz: 0x1f3a7a, dachFarbe: 0xf0f0f0, ort: 'court', tuer: 's',
        text: 'Das größte Tennisstadion der Welt: fast 24.000 Plätze! Benannt nach Arthur Ashe, dem ersten schwarzen Sieger der US Open. Abends unter Flutlicht ist es hier am lautesten.' }),
      S('Louis Armstrong Stadium', 64, -40, 36, 32, 11, { form: 'eckig', dach: 'schieb', farbe: 0xc8a888, sitz: 0x1f3a7a, tuer: 's',
        info: 'Das zweitgrößte Stadion (14.000 Plätze), benannt nach dem Jazz-Trompeter Louis Armstrong, der gleich nebenan wohnte. Die Seiten sind offen, damit Wind hindurchweht.' }),
      S('Grandstand', -72, 44, 26, 26, 6, { form: 'rund', dach: 'ring', farbe: 0xe8e8e4, sitz: 0x1f3a7a, tuer: 'o', info: 'Ein rundes Stadion mit 8.000 Plätzen in der Ecke des Geländes. Es liegt tiefer als der Boden drumherum.' }),
      S('Court 17', 76, 46, 18, 18, 4, { form: 'rund', sitz: 0x1f3a7a, tuer: 'w', info: 'Die Fans nennen diesen Platz „die Grube“: Er ist in den Boden eingelassen, und oben stehen die Zuschauer rundherum.' }),
      F(0, 37, 9, 16, WASSER, { e: 2, modell: 'mal_brunnen' }), { a: 'leinwand', x: 0, z: 27.5, b: 0.1, h: 0.1, name: 'Brunnen-Platz', tuer: 'o', v: 18, info: 'Der große Platz mit den Brunnen. Von hier sieht man durch das Tor bis zur riesigen Weltkugel aus Stahl im Park.' },
      P(40, 48, 4, 2, { name: 'Plätze 8 bis 16' }), P(-34, 48, 4, 2, { name: 'Plätze 4 bis 7 und mehr' }),
      P(-70, -2, 5, 1, { ort: 'training', tuer: 's', name: 'Trainingsplätze P1 bis P5' }),
      ZAUN(-44, 12),
      H('Trainingshalle', -66, -44, 42, 22, 9, { farbe: 0x8a9098, tueren: [{ ort: 'kraft', s: 's', v: -12 }, { ort: 'physio', s: 's', v: 12 }] }),
      H('Food Village', 50, 0, 14, 16, 4.5, { farbe: 0xc88a2a, ort: 'essen', tuer: 'w' }), { a: 'schirme', x: 50, z: 17, b: 20, t: 10, n: 8, farbe: 0x1f3a7a },
      H('Pressezentrum', 18, -48, 16, 9, 6, { farbe: 0x4a5a6a, ort: 'presse', tuer: 's' }),
      H('Besaiter', -18, -48, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 's' }),
      AUTO(90, 4),
      B('laub', { linie: [-92, 67, 94, 67], n: 16 }), B('laub', { linie: [-92, -66, 30, -66], n: 10 }), B('laub', { linie: [-12, 28, -12, 62], n: 4 }), B('laub', { linie: [12, 28, 12, 62], n: 4 }),
    ],
  },

  // =====================================================================================
  // INDIAN WELLS – Kalifornien. Mitten in der Wüste: Palmen, grüne Wiesen und dahinter die Berge.
  // =====================================================================================
  iw: {
    stil: 'wueste', name: 'Indian Wells Tennis Garden', stadt: 'Indian Wells, USA',
    rand: { x0: -92, x1: 94, z0: -74, z1: 72 }, umland: 0xd8c098, boden: 0xd8ccb0, feld: [0x5a4a9c, 0x3f8a5a],
    teile: [
      { a: 'berge', seite: 'n', farbe: 0x9a8468, h: 70, modell: 'mal_berge' }, { a: 'berge', seite: 'w', farbe: 0xa89070, h: 55, modell: 'mal_berge' },
      F(0, -84, 700, 9, ASPHALT), F(0, -110, 240, 36, 0x8a8a8c),                                       // Straße und Parkplatz
      S('Stadium 1', -6, -10, 54, 54, 15, { modell: 'stadion_iw', form: 'acht', farbe: 0xc8b08a, sitz: 0x7a6a50, ort: 'court', tuer: 's',
        text: 'Das zweitgrößte Tennisstadion der Welt (16.100 Plätze) – und es steht mitten in der Wüste! Von den oberen Reihen sieht man die Berge.' }),
      S('Stadium 2', 60, 26, 32, 32, 10, { form: 'eckig', farbe: 0xc8b08a, sitz: 0x7a6a50, tuer: 'w', info: 'Hier passen 8.000 Leute hinein. Ganz oben gibt es Restaurants, in denen man beim Essen auf den Platz schauen kann.' }),
      H('Restaurants', 60, 3, 26, 8, 7, { farbe: 0xb89a6a, ort: 'essen', tuer: 'n', name2: 'Spieler-Restaurant' }),
      S('Stadium 3', -62, 22, 20, 22, 5, { form: 'eckig', farbe: 0xc8b08a, sitz: 0x7a6a50 }),
      P(-64, -30, 3, 2, { name: 'Stadien 4 bis 9' }),
      P(8, -60, 6, 1, { ort: 'training', tuer: 's', name: 'Trainingsplätze' }),
      F(64, -48, 38, 30, 0x5aa84a, { e: 2 }), { a: 'leinwand', x: 64, z: -31, b: 0.1, h: 0.1, name: 'Spielwiese', tuer: 's', info: 'Auf dieser Wiese wärmen sich die Profis auf – und spielen dabei oft Fußball. Die Fans stehen am Rand und schauen zu.' },
      ZAUN(40, -40),
      H('Spieler-Haus', 38, -14, 12, 16, 6, { farbe: 0xc0a47a, tueren: [{ ort: 'kraft', s: 'o', v: -4 }, { ort: 'physio', s: 'o', v: 4 }] }),
      F(-20, 46, 44, 26, 0x5aa84a, { e: 2 }), { a: 'schirme', x: -20, z: 46, b: 36, t: 18, n: 12, farbe: 0xf0e8d0 }, { a: 'leinwand', x: -20, z: 61, b: 10, h: 5, dreh: 180 },
      H('Pressezentrum', -52, 54, 14, 9, 5, { farbe: 0xb89a6a, ort: 'presse', tuer: 'o' }),
      H('Besaiter', 22, 40, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 's' }),
      P(20, 62, 4, 1, { quer: true, name: 'Trainingsplätze Süd' }),
      AUTO(80, -66),
      B('palme', { linie: [-88, -70, 90, -70], n: 20 }), B('palme', { linie: [-88, 69, 90, 69], n: 20 }), B('palme', { linie: [-38, 22, -38, 68], n: 6 }),
      B('palme', { linie: [30, 20, 30, 36], n: 3 }), B('palme', { linie: [-88, -60, -88, 60], n: 12 }), B('palme', { linie: [90, -60, 90, 60], n: 12 }), B('palme', { linie: [46, -68, 82, -30], n: 5 }),
    ],
  },

  // =====================================================================================
  // MIAMI – Der Centre Court wird jedes Jahr MITTEN IN EIN FOOTBALL-STADION gebaut. Die anderen Plätze stehen auf dem Parkplatz daneben.
  // =====================================================================================
  mia: {
    stil: 'usa', name: 'Hard Rock Stadium', stadt: 'Miami, USA',
    rand: { x0: -90, x1: 90, z0: -74, z1: 74 }, umland: 0x8a8a8c, boden: 0xb4b4b0, feld: [0x4a3a8c, 0x2a8a9a],
    teile: [
      F(0, -88, 700, 10, ASPHALT), F(120, 0, 10, 500, ASPHALT),
      S('Football-Stadion', 0, -30, 86, 74, 20, { modell: 'mal_miami', form: 'acht', dach: 'ring', spitzen: true, farbe: 0xe8e8e4, sitz: 0x2a9aa8, wiese: true, ort: 'court', tuer: 's',
        tueren: [{ ort: 'kraft', s: 's', v: -18, name: 'Kraftraum' }, { ort: 'physio', s: 's', v: 18, name: 'Physio' }, { ort: 'presse', s: 'o', v: 10, name: 'Pressesaal' }],
        text: 'Hier spielt sonst die Football-Mannschaft von Miami. Für das Tennisturnier wird auf dem Rasen ein Tennisstadion mit fast 14.000 Plätzen aufgebaut – in einem Stadion für 65.000!' }),
      F(0, 14, 170, 10, 0xd8d0c0, { e: 2 }), { a: 'leinwand', x: 34, z: 13, b: 10, h: 5, name: 'Dolphin Plaza', tuer: 's', info: 'Die breite Straße zwischen dem Stadion und den Tennisplätzen: Palmen, Musik, bunte Wandbilder und eine große Leinwand.' },
      S('Grandstand', -30, 36, 24, 22, 7, { form: 'eckig', farbe: 0x2a8a9a, sitz: 0x2a9aa8, tuer: 'o', info: 'Das zweitgrößte Stadion (5.000 Plätze). Es bleibt das ganze Jahr stehen, nur die Tribüne im Norden wird abgebaut.' }),
      S('Court 1', 4, 34, 18, 18, 5, { form: 'eckig', farbe: 0x2a8a9a, sitz: 0x2a9aa8 }),
      S('Butch-Buchholz-Platz', -60, 36, 14, 16, 3.5, { form: 'eckig', farbe: 0x2a8a9a, sitz: 0x2a9aa8, tuer: 'w', info: 'Benannt nach dem Mann, der das Turnier in Miami gegründet hat.' }),
      P(54, 40, 5, 2, { ort: 'training', tuer: 'w', name: 'Trainingsplätze' }),
      P(-22, 63, 5, 1, { quer: true, name: 'Außenplätze' }),
      H('Spieler-Restaurant', -72, 62, 14, 10, 4.5, { farbe: 0xe89a4a, ort: 'essen', tuer: 'n' }),
      H('Besaiter', 24, 52, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 'w' }),
      ZAUN(26, 24), AUTO(-80, 20),
      B('palme', { linie: [-84, 9, 84, 9], n: 18 }), B('palme', { linie: [-84, 19.5, 84, 19.5], n: 14 }), B('palme', { linie: [-86, 71, 86, 71], n: 18 }),
      B('palme', { linie: [-86, -70, -86, 60], n: 12 }), B('palme', { linie: [87, -70, 87, 60], n: 12 }),
    ],
  },

  // =====================================================================================
  // MONTE-CARLO – Die Plätze liegen wie Treppenstufen am Hang: hinten die Felsen, vorne das Mittelmeer.
  // =====================================================================================
  mc: {
    stil: 'mittelmeer', name: 'Monte-Carlo Country Club', stadt: 'Roquebrune-Cap-Martin, Frankreich (direkt neben Monaco)',
    rand: { x0: -72, x1: 72, z0: -50, z1: 46 }, umland: 0x8a9a6a, boden: 0xe0cfa8, feld: [0xc8643a, 0xb85a34], kamW: Math.PI,      // kamW: Die Kamera schaut am Anfang nach Süden, aufs Meer
    teile: [
      { a: 'meer', ab: 50 }, { a: 'berge', seite: 'n', farbe: 0x8a8a78, h: 90 },
      { a: 'modell', modell: 'mal_yacht', x: -30, z: 82, dreh: 12 }, { a: 'modell', modell: 'mal_yacht', x: 44, z: 104, dreh: -20, gr: 0.8 }, { a: 'modell', modell: 'mal_yacht', x: 96, z: 74, dreh: 80, gr: 0.6 },      // Yachten vor der Küste
      F(0, -56, 700, 7, ASPHALT),
      { a: 'tuerme', p: [[-150, -30, 16, 16, 42], [-170, 0, 14, 14, 56], [-140, 14, 14, 14, 34], [-190, -40, 18, 16, 48], [-160, 34, 12, 12, 28]], farbe: 0xe8dcc8, dach: 0xc8b8a0 },    // die Hochhäuser von Monaco
      S('Court Rainier III', 4, 8, 36, 30, 8, { modell: 'stadion_mc', form: 'eckig', farbe: 0xe8dcc0, sitz: 0x8a8a90, ort: 'court', tuer: 's',
        text: 'Der Centre Court (10.200 Plätze), benannt nach einem Fürsten von Monaco. Von der Tribüne schaut man über den roten Sand direkt aufs blaue Meer.' }),
      H('Clubhaus', 4, -27, 36, 10, 8, { farbe: 0xe8b890, dachFarbe: 0xc86a4a, dach: 'sattel',
        tueren: [{ ort: 'kraft', s: 's', v: -13 }, { ort: 'essen', s: 's', v: 0, name: 'Terrasse am Clubhaus' }, { ort: 'physio', s: 's', v: 13 }],
        text: 'Das Clubhaus aus dem Jahr 1928. Von der Terrasse schauen die Gäste beim Mittagessen auf den Centre Court hinunter.' }),
      F(4, -15, 36, 8, 0xf0e4c8, { e: 2 }), { a: 'schirme', x: 4, z: -14, b: 32, t: 4, n: 8, farbe: 0xf8f4ec },
      S('Court des Princes', -36, 10, 20, 22, 5, { form: 'eckig', farbe: 0xe8dcc0, sitz: 0x8a8a90, tuer: 'n', info: 'Der zweite große Platz, „Platz der Prinzen“. Die Tribünen werden nur für das Turnier aufgebaut.' }),
      P(50, -10, 2, 2, { name: 'Plätze 2 bis 5' }), P(-58, -24, 2, 1, { name: 'Plätze 9 und 11' }),
      P(-30, 36, 3, 1, { quer: true, ort: 'training', tuer: 'n', name: 'Trainingsplätze am Meer' }), P(42, 34, 2, 1, { quer: true }),
      F(-62, 10, 8, 14, WASSER, { e: 2 }), H('', -62, 22, 8, 4, 3, { farbe: 0xf0e4c8 }),                // Schwimmbad
      H('Pressezentrum', -32, -30, 12, 8, 5, { farbe: 0xe8c8a0, dachFarbe: 0xc86a4a, dach: 'sattel', ort: 'presse', tuer: 's' }),
      H('Besaiter', 38, -34, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 's' }),
      { a: 'leinwand', x: 14, z: 43, b: 0.1, h: 0.1, name: 'Blick aufs Meer', tuer: 'n', info: 'Die Plätze liegen wie Treppenstufen am Hang über dem Mittelmeer. Der Club gehört zu Monaco, liegt aber in Frankreich – nur 150 Meter hinter der Grenze.' },
      ZAUN(18, 27), AUTO(-12, -45),
      B('zypresse', { linie: [-68, -47, 68, -47], n: 16 }), B('palme', { linie: [-68, 44, 68, 44], n: 12 }), B('zypresse', { linie: [26, -8, 26, 24], n: 4 }), B('palme', { linie: [-20, -8, -20, 24], n: 4 }),
    ],
  },

  // =====================================================================================
  // MADRID – Die „Caja Mágica“ (Zauberkiste): drei Stadien in einem einzigen Kasten aus Metall, am Wasser.
  // =====================================================================================
  mad: {
    stil: 'modern', name: 'Caja Mágica', stadt: 'Madrid, Spanien',
    rand: { x0: -86, x1: 86, z0: -60, z1: 64 }, umland: 0x9a9a6a, boden: 0xc8c4bc, feld: [0xc96a40, 0xb85e38],
    teile: [
      F(140, 0, 22, 600, WASSER), B('laub', { feld: [118, 0, 26, 300], n: 40 }),                       // der Fluss Manzanares mit seinem Park
      F(8, -47, 124, 14, WASSER, { e: 2 }), F(-45, -8, 14, 62, WASSER, { e: 2 }),                      // der See um die Kiste
      S('Estadio Manolo Santana', -8, -10, 44, 44, 14, { modell: 'mal_kiste', form: 'eckig', dach: 'schieb', farbe: 0x7a7e86, sitz: 0x5a5a62, dachFarbe: 0xb8bcc4, ort: 'court', tuer: 's',
        text: 'Die „Zauberkiste“: Drei Stadien stecken in einem Kasten aus Metallgitter. Das größte hat 12.442 Plätze. Jedes Dach kann aufklappen wie der Deckel einer Kiste.' }),
      S('Estadio Arantxa Sánchez Vicario', 30, -21, 30, 22, 12, { form: 'eckig', dach: 'schieb', farbe: 0x7a7e86, sitz: 0x5a5a62, dachFarbe: 0xb8bcc4 }),
      S('Stadion 3', 30, 1, 30, 22, 12, { form: 'eckig', dach: 'schieb', farbe: 0x7a7e86, sitz: 0x5a5a62, dachFarbe: 0xb8bcc4, tuer: 'o', info: 'Das kleinste der drei Stadien in der Kiste. Benannt sind die großen nach Manolo Santana und Arantxa Sánchez Vicario, zwei spanischen Tennis-Legenden.' }),
      H('Tennis-Halle', -68, 10, 16, 84, 8, { farbe: 0x8a8e96, tueren: [{ ort: 'kraft', s: 'o', v: 22 }, { ort: 'physio', s: 'o', v: 36 }],
        text: 'Eine lange Halle mit elf Tennisplätzen hintereinander.' }),
      P(30, 40, 8, 2, { ort: 'training', tuer: 'w', name: 'Tennis-Garten (16 Plätze)' }),
      H('Spieler-Restaurant', -36, 34, 14, 9, 4.5, { farbe: 0xc88a2a, ort: 'essen', tuer: 'o' }),
      H('Pressezentrum', -36, 50, 14, 9, 5, { farbe: 0x4a5a6a, ort: 'presse', tuer: 'o' }),
      H('Besaiter', 64, 14, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 's' }),
      { a: 'leinwand', x: -18, z: 24, b: 10, h: 5, dreh: 180 }, { a: 'schirme', x: -16, z: 34, b: 12, t: 12, n: 6, farbe: 0xf0f0f0 },
      ZAUN(-10, 46), AUTO(-14, 60),
      B('laub', { linie: [-82, 62, 82, 62], n: 14 }), B('laub', { linie: [72, -56, 82, 56], n: 10 }), B('laub', { linie: [-80, -56, 70, -57], n: 12 }),
    ],
  },

  // =====================================================================================
  // ROM – Foro Italico. Marmor-Statuen, Schirm-Pinien, der Fluss Tiber im Osten und der Hügel Monte Mario im Westen.
  // =====================================================================================
  rom: {
    stil: 'mittelmeer', name: 'Foro Italico', stadt: 'Rom, Italien',
    rand: { x0: -82, x1: 86, z0: -68, z1: 62 }, umland: 0x6a9a52, boden: 0xd4ccb8, feld: [0xc4603a, 0xb45632],
    teile: [
      F(150, 0, 30, 600, 0x6a9a8a), { a: 'berge', seite: 'w', farbe: 0x4a7a44, h: 40 },                 // Tiber und Monte Mario
      S('Stadio Olimpico', -128, -80, 76, 90, 17, { form: 'oval', dach: 'ring', farbe: 0xe8e8e4, sitz: 0x3a5a9a, wiese: true }),
      F(14, -20, 136, 8, WEISS, { e: 2 }), { a: 'obelisk', x: 80, z: -20, b: 2.4, t: 2.4, h: 17, name: 'Obelisk', tuer: 'w', info: 'Ein 17 Meter hoher Obelisk aus weißem Marmor am Eingang. Von hier führt die breite Marmor-Allee zum Olympiastadion, in dem die Fußballer von Rom spielen.' },
      { a: 'kugel', x: -56, z: -20, r: 2.4, voll: true },
      F(12, -46, 62, 36, 0xb8623a, { e: 2, rund: true }), F(12, -46, 50, 25, WIESE, { e: 3, rund: true }),
      { a: 'statuen', x: 12, z: -46, b: 68, t: 42, n: 30 },
      S('Arena im Stadio dei Marmi', 12, -46, 24, 20, 6, { form: 'eckig', farbe: 0xe8e4dc, sitz: 0x2a5a3a, tuer: 's',
        info: 'Das „Marmor-Stadion“: Rundherum stehen 60 riesige Sportler aus weißem Marmor. Für das Turnier wird mitten hinein ein Tennisstadion für 7.000 Zuschauer gebaut.' }),
      S('Campo Centrale', -10, 20, 36, 32, 10, { modell: 'stadion_rom', form: 'oval', farbe: 0xd8d0c0, sitz: 0xb8b0a0, ort: 'court', tuer: 's',
        text: 'Der Centre Court von Rom mit 10.500 Plätzen. Die Tribünen heißen wie das, worauf man schaut: „Monte Mario“ (der Hügel) und „Tevere“ (der Fluss).' }),
      S('Stadio Pietrangeli', 32, 14, 26, 20, 2.5, { form: 'oval', farbe: WEISS, sitz: WEISS, tuer: 's',
        info: 'Für viele der schönste Tennisplatz der Welt: Er liegt tief im Boden, die Stufen sind aus weißem Marmor, und oben schauen 18 Statuen zu.' }),
      { a: 'statuen', x: 32, z: 14, b: 30, t: 24, n: 18 },
      S('SuperTennis Arena', -54, 14, 20, 20, 6, { form: 'acht', farbe: 0x3a4a5a, sitz: 0x2a5a3a, tuer: 'o', info: 'Das neue Stadion mit den vielen Ecken, gegenüber vom Campo Centrale.' }),
      F(58, -2, 22, 9, WASSER, { e: 2 }), H('Schwimmstadion', 58, 9, 26, 6, 6, { farbe: 0xd8d0c0 }),
      P(22, 48, 6, 1, { name: 'Plätze unter den Pinien' }), P(-48, 46, 3, 1, { ort: 'training', tuer: 'n', name: 'Trainingsplätze' }),
      H('Spieler-Haus', 64, 32, 12, 18, 6, { farbe: 0xc86a4a, tueren: [{ ort: 'kraft', s: 'w', v: -5 }, { ort: 'physio', s: 'w', v: 5 }] }),
      H('Spieler-Restaurant', 66, 52, 14, 9, 4.5, { farbe: 0xc88a2a, ort: 'essen', tuer: 'w' }),
      H('Pressezentrum', -20, 49, 10, 10, 5, { farbe: 0xc86a4a, ort: 'presse', tuer: 'n' }),
      H('Besaiter', -74, 38, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 'o' }),
      ZAUN(50, 28), AUTO(74, -30),
      B('pinie', { linie: [-78, 59, 82, 59], n: 16 }), B('pinie', { linie: [-6, 39, 50, 39], n: 6 }), B('pinie', { linie: [-78, -8, -78, 56], n: 7 }),
      B('pinie', { linie: [-40, -10, 50, -11], n: 8 }), B('zypresse', { linie: [-50, -64, 80, -65], n: 14 }), B('pinie', { linie: [83, -10, 83, 56], n: 7 }),
    ],
  },

  // =====================================================================================
  // KANADA – Montreal, IGA-Stadion im Jarry-Park. Früher war hier ein Baseball-Stadion.
  // =====================================================================================
  can: {
    stil: 'usa', name: 'Stade IGA im Jarry-Park', stadt: 'Montreal, Kanada',
    rand: { x0: -78, x1: 78, z0: -56, z1: 56 }, umland: 0x5a9a4c, boden: 0xc4c0b8, feld: [0x2a66b8, 0x3a7a9a],
    teile: [
      F(92, 0, 12, 500, 0x6a6258), F(0, 64, 700, 8, ASPHALT),                                          // Bahngleise im Osten, Straße im Süden
      F(-60, -28, 24, 30, WASSER, { e: 2, rund: true }), F(-54, 4, 40, 30, WIESE, { e: 2 }),
      { a: 'leinwand', x: -44, z: -26, b: 0.1, h: 0.1, name: 'Teich im Jarry-Park', tuer: 'o', info: 'Das Stadion steht mitten in einem Stadtpark mit Teich. Im Sommer picknicken hier die Familien, während nebenan die Profis spielen.' },
      B('laub', { feld: [-130, 0, 90, 200], n: 60 }), B('laub', { feld: [-56, 6, 36, 26], n: 7 }),
      S('Centre Court', 12, -2, 40, 38, 11, { form: 'acht', dach: 'ring', farbe: 0x3a5a8a, sitz: 0x3a5a8a, ort: 'court', tuer: 's',
        text: 'Der Centre Court mit fast 12.000 Plätzen. Ein Teil der Tribüne stammt noch vom alten Baseball-Stadion, in dem früher die „Expos“ spielten.' }),
      S('Court Rogers', -24, -34, 24, 22, 7, { form: 'eckig', farbe: 0x3a5a8a, sitz: 0x3a5a8a, tuer: 's', info: 'Das zweite Stadion mit gut 4.000 Plätzen.' }),
      H('Tennis-Halle', 40, -42, 52, 18, 8, { farbe: 0x8a9098, tueren: [{ ort: 'kraft', s: 's', v: -14 }, { ort: 'physio', s: 's', v: 2 }, { ort: 'presse', s: 's', v: 18, name: 'Pressesaal' }],
        text: 'In dieser Halle liegen 16 Tennisplätze – im kanadischen Winter kann man draußen nicht spielen.' }),
      P(10, 40, 6, 1, { ort: 'training', tuer: 'n', name: 'Trainingsplätze' }), P(-52, 40, 3, 1), P(60, 12, 3, 1),
      H('Spieler-Restaurant', 58, 36, 14, 9, 4.5, { farbe: 0xc88a2a, ort: 'essen', tuer: 'n' }),
      H('Besaiter', -22, 26, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 'o' }),
      ZAUN(-14, 12), AUTO(-10, 52),
      B('laub', { linie: [-74, 54, 74, 54], n: 12 }), B('laub', { linie: [76, -52, 76, 50], n: 10 }), B('laub', { linie: [-74, -53, 10, -53], n: 8 }),
    ],
  },

  // =====================================================================================
  // CINCINNATI – Mason, Ohio. 2025 ganz neu gebaut: viele Plätze, ein Clubhaus, ein Stadion im Boden. Rundherum Wiesen.
  // =====================================================================================
  cin: {
    stil: 'usa', name: 'Lindner Family Tennis Center', stadt: 'Mason bei Cincinnati, USA',
    rand: { x0: -88, x1: 88, z0: -70, z1: 70 }, umland: 0x5c9a4c, boden: 0xc8c4b8, feld: [0x2a5aa8, 0x2a8a6a],
    teile: [
      F(-112, 0, 18, 600, ASPHALT),                                                                   // die Autobahn im Westen
      { a: 'tuerme', p: [[-165, -30, 5, 5, 60]], farbe: 0x5a6a5a, dach: 0x5a6a5a, spitz: true },        // der Turm im Freizeitpark hinter der Autobahn
      F(130, -30, 30, 16, 0xe8d8a8, { rund: true }), F(150, 30, 26, 40, WASSER, { rund: true }), B('laub', { feld: [140, 0, 80, 220], n: 40 }),      // der alte Golfplatz
      S('Center Court', 0, -20, 40, 40, 12, { form: 'acht', farbe: 0x8a5a44, sitz: 0x5a6a7a, ort: 'court', tuer: 's',
        text: 'Der Center Court (11.400 Plätze) steht seit 1981 – auf einem früheren Golfplatz. Das Turnier selbst ist eines der ältesten der Welt: Es wird seit 1899 gespielt.' }),
      H('Spieler-Zentrum', -27, -20, 10, 30, 12, { farbe: 0x7a4a3a, ort: 'presse', tuer: 'w', name2: 'Pressesaal' }),
      S('Grandstand', 46, -26, 26, 24, 8, { form: 'eckig', farbe: 0x8a5a44, sitz: 0x5a6a7a, tuer: 'w', info: 'Das zweite Stadion mit 5.000 Plätzen.' }),
      S('Champions Court', 46, 6, 18, 16, 2.5, { form: 'eckig', farbe: 0xc8c0b0, sitz: 0x5a6a7a, tuer: 'w', info: 'Seit 2025 neu: ein Stadion, das im Boden liegt. Die Idee kommt vom Marmor-Platz in Rom. Hier darf jeder ohne Extra-Karte zuschauen.' }),
      S('Stadium 3', -62, -22, 22, 22, 6, { form: 'eckig', farbe: 0x8a5a44, sitz: 0x5a6a7a }),
      H('Clubhaus', -44, 22, 28, 14, 8, { farbe: 0xd8d0c0, dachFarbe: 0x4a5a6a, tueren: [{ ort: 'kraft', s: 's', v: -9 }, { ort: 'essen', s: 's', v: 0, name: 'Restaurant im Clubhaus' }, { ort: 'physio', s: 's', v: 9 }],
        text: 'Das neue Clubhaus von 2025: Restaurant, Ruheräume und Umkleiden für die Spieler.' }),
      P(4, 22, 6, 1, { name: 'Plätze 4 bis 9' }), P(74, 20, 2, 2, { name: 'Plätze 10 bis 13' }), P(-10, -58, 4, 1, { quer: true, name: 'Nordplätze' }),
      P(10, 54, 10, 1, { ort: 'training', tuer: 'n', name: 'Trainingsplätze (10 Stück)' }),
      F(-70, 50, 28, 24, WIESE, { e: 2 }), { a: 'schirme', x: -70, z: 50, b: 22, t: 18, n: 8, farbe: 0xf0f0f0 }, { a: 'leinwand', x: -70, z: 64, b: 10, h: 5, dreh: 180 },
      H('Besaiter', 60, -52, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 's' }),
      ZAUN(-42, 44), AUTO(30, -64),
      B('laub', { linie: [-84, 68, 84, 68], n: 14 }), B('laub', { linie: [-85, -66, -85, 40], n: 10 }), B('laub', { linie: [85, -66, 85, 60], n: 12 }), B('laub', { linie: [-24, 6, 30, 6], n: 5 }),
    ],
  },

  // =====================================================================================
  // SHANGHAI – Qizhong. Das Stadion mit dem Dach, das sich öffnet wie eine Blume mit acht Blättern.
  // =====================================================================================
  sha: {
    stil: 'asien', name: 'Qizhong Tennis Center', stadt: 'Shanghai, China',
    rand: { x0: -82, x1: 82, z0: -66, z1: 66 }, umland: 0x4a8a44, boden: 0xc8c8c0, feld: [0x3a4aa8, 0x2a6a8a],
    teile: [
      F(0, -52, 70, 16, WASSER, { e: 2, rund: true }), F(0, -5, 76, 76, 0xe0dcd0, { e: 2, rund: true }),
      B('laub', { feld: [0, -110, 400, 70], n: 90 }), B('laub', { feld: [-130, 0, 80, 200], n: 50 }), B('laub', { feld: [130, 0, 80, 200], n: 50 }),      // der „Wald“ der Sportstadt
      S('Centre Court', 0, -5, 52, 52, 14, { modell: 'mal_qizhong', form: 'rund', dach: 'blume', farbe: 0xe4e4e0, sitz: 0x7a2a3a, ort: 'court', tuer: 's',
        text: 'Das Dach dieses Stadions besteht aus acht riesigen Stahl-Blättern. Sie drehen sich in acht Minuten auf – wie eine Magnolie, die Blume der Stadt Shanghai. 13.800 Plätze.' }),
      S('Grandstand 2', -52, 30, 24, 22, 8, { form: 'eckig', dach: 'schieb', farbe: 0xd8d8d4, sitz: 0x7a2a3a, tuer: 'o', info: 'Das zweite Stadion mit 5.000 Plätzen. Seit 2025 hat es auch ein Dach zum Zufahren.' }),
      S('Court 3', 52, 30, 16, 16, 4, { form: 'eckig', farbe: 0xd8d8d4, sitz: 0x7a2a3a }),
      H('Tennis-Halle', 58, -32, 28, 22, 9, { farbe: 0x8a9098, tueren: [{ ort: 'kraft', s: 'w', v: -5 }, { ort: 'physio', s: 'w', v: 5 }] }),
      P(0, 52, 10, 1, { ort: 'training', tuer: 'n', name: 'Außenplätze' }), P(-62, -30, 3, 2), P(64, 2, 2, 1),
      H('Spieler-Restaurant', -30, -44, 14, 9, 4.5, { farbe: 0xc88a2a, ort: 'essen', tuer: 's' }),
      H('Pressezentrum', 30, -46, 14, 9, 5, { farbe: 0x4a5a6a, ort: 'presse', tuer: 'w' }),
      H('Besaiter', 30, 30, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 'w' }),
      { a: 'leinwand', x: -22, z: 34, b: 10, h: 5, dreh: 180 },
      ZAUN(-14, 36), AUTO(8, 40),
      B('laub', { linie: [-78, 63, 78, 63], n: 14 }), B('laub', { linie: [-79, -60, -79, 56], n: 10 }), B('laub', { linie: [79, -60, 79, 56], n: 10 }),
    ],
  },

  // =====================================================================================
  // PARIS (Masters) – seit 2025 in der riesigen Halle im Hochhaus-Viertel La Défense. Alle vier Plätze liegen unter EINEM Dach.
  // (Das Dach ist im Spiel durchsichtig, damit man hineinschauen kann.)
  // =====================================================================================
  par: {
    stil: 'modern', name: 'Arena in La Défense', stadt: 'Nanterre bei Paris, Frankreich',
    rand: { x0: -72, x1: 74, z0: -52, z1: 54 }, umland: 0x8a8a90, boden: 0xc4c4c8, feld: [0x2a3a6a, 0x1a1a22],
    teile: [
      { a: 'bogen', x: 112, z: 10, b: 34, h: 36, t: 34 },
      { a: 'tuerme', p: [[150, -40, 20, 20, 70], [170, 20, 18, 18, 90], [135, 60, 20, 16, 60], [185, -20, 16, 16, 55], [110, -60, 18, 18, 50], [150, 90, 22, 18, 76], [90, 90, 16, 16, 44], [-110, -70, 20, 16, 30], [-120, 40, 18, 18, 24]], farbe: 0x7a9ab8, dach: 0x5a6a7a },
      F(0, -62, 700, 8, ASPHALT),
      S('Centre Court', -22, -8, 56, 44, 14, { modell: 'stadion_par', form: 'eckig', dach: 'glas', farbe: 0xc8ccd4, sitz: 0x4a5a8a, ort: 'court', tuer: 's',
        tueren: [{ ort: 'kraft', s: 's', v: -20, name: 'Kraftraum' }, { ort: 'presse', s: 's', v: 20, name: 'Pressesaal' }, { ort: 'physio', s: 'w', v: 0, name: 'Physio' }],
        text: 'Die größte Halle Europas! Hier spielt sonst eine Rugby-Mannschaft. Beim Tennis passen 17.500 Zuschauer um den Centre Court – so viele wie bei keinem anderen Hallenturnier.' }),
      S('Court 1', 20, -19, 26, 21, 12, { form: 'eckig', dach: 'glas', farbe: 0xc8ccd4, sitz: 0x4a5a8a }),
      S('Court 2', 20, 3, 26, 21, 12, { form: 'eckig', dach: 'glas', farbe: 0xc8ccd4, sitz: 0x4a5a8a, tuer: 's', info: 'Zwei weitere Plätze mit je 4.000 Plätzen liegen in derselben Halle, nur durch dicke Vorhänge getrennt.' }),
      P(43, -8, 1, 3, { ort: 'training', tuer: 'o', name: 'Court 3 und Einschlagplätze' }), { a: 'glasdach', x: 43, z: -8, b: 11, t: 46, h: 12 },
      F(-10, 34, 110, 12, WIESE, { e: 2 }), B('laub', { linie: [-62, 34, 42, 34], n: 12 }),
      { a: 'leinwand', x: 60, z: 30, b: 0.1, h: 0.1, name: 'Blick zur Grande Arche', tuer: 'w', info: 'Der riesige weiße Würfel mit dem Loch ist die „Grande Arche“, ein Bürohaus. Er ist so groß, dass eine ganze Kirche hineinpassen würde.' },
      H('Spieler-Restaurant', -52, 46, 14, 8, 4.5, { farbe: 0xc88a2a, ort: 'essen', tuer: 'n' }),
      H('Besaiter', 30, 46, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 'n' }),
      ZAUN(4, 24), AUTO(-20, 49),
    ],
  },

  // =====================================================================================
  // ATP FINALS – Turin. Eine Halle wie eine Kiste aus Stahl, direkt neben dem alten Olympiastadion.
  // =====================================================================================
  fin: {
    stil: 'modern', name: 'Arena von Turin', stadt: 'Turin, Italien',
    rand: { x0: -70, x1: 72, z0: -50, z1: 52 }, umland: 0x6a9a5a, boden: 0xc8c4bc, feld: [0x1f5fb8, 0x0f1a3a],
    teile: [
      { a: 'berge', seite: 'n', farbe: 0xd8dce4, h: 80 },                                              // die Alpen mit Schnee
      F(0, -60, 700, 8, ASPHALT),
      S('Olympiastadion', -78, -8, 56, 70, 13, { form: 'oval', dach: 'ring', farbe: 0xc8b8a8, sitz: 0x8a2a2a, wiese: true }),
      { a: 'tuerme', modell: 'mal_turm_turin', p: [[-44, -44, 5, 5, 34]], farbe: 0xc86a4a, dach: 0xc86a4a },                      // der Marathon-Turm
      S('Centre Court', 6, -8, 50, 40, 12, { modell: 'mal_turin', form: 'eckig', dach: 'glas', farbe: 0xa8acb4, sitz: 0x3a5a9a, ort: 'court', tuer: 's',
        tueren: [{ ort: 'kraft', s: 's', v: -18, name: 'Kraftraum' }, { ort: 'presse', s: 's', v: 18, name: 'Pressesaal' }, { ort: 'physio', s: 'o', v: -8, name: 'Physio' }],
        text: 'Hier spielen am Ende des Jahres nur die acht besten Spieler der Welt. Die Halle wurde für die Olympischen Winterspiele 2006 gebaut – damals für Eishockey.' }),
      P(52, 22, 2, 1, { quer: true, ort: 'training', tuer: 'w', name: 'Trainingsplätze im Zelt' }), { a: 'glasdach', x: 52, z: 22, b: 30, t: 10, h: 8 },
      F(-6, 36, 80, 16, WIESE, { e: 2 }), { a: 'zelte', x: -6, z: 36, b: 60, n: 6 }, { a: 'leinwand', x: -44, z: 30, b: 0.1, h: 0.1, name: 'Fan-Dorf', tuer: 'n', info: 'Vor der Halle steht das Fan-Dorf mit Zelten. Dahinter der Turm vom alten Stadion – er heißt „Marathon-Turm“.' },
      H('Spieler-Restaurant', 56, 40, 14, 8, 4.5, { farbe: 0xc88a2a, ort: 'essen', tuer: 'w' }),
      H('Besaiter', 58, -30, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 'w' }),
      ZAUN(20, 22), AUTO(-20, 47),
      B('laub', { linie: [-66, 50, 68, 50], n: 12 }), B('laub', { linie: [69, -46, 69, 44], n: 8 }),
    ],
  },
};

export const gelaendeVon = (id) => GELAENDE[id] || null;
export const GELAENDE_LISTE = Object.keys(GELAENDE);

// ---------------------------------------------------------------
// Aus einem Plan ausrechnen: Wo sind die Türen? Wo kann man nicht durchlaufen? Wo stehen die Bäume genau?
// ---------------------------------------------------------------

// Ein Zufall, der immer dieselben Zahlen liefert (damit die Bäume jedes Mal an derselben Stelle stehen)
function zufall(start) {
  let s = start >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Wie groß ist eine Gruppe von Plätzen?
export function plaetzeMass(el) {
  const lx = el.quer ? PLATZ_L + LUECKE_L : PLATZ_B + LUECKE_B, lz = el.quer ? PLATZ_B + LUECKE_B : PLATZ_L + LUECKE_L;
  return { lx, lz, b: el.nx * lx - (el.quer ? LUECKE_L : LUECKE_B), t: el.nz * lz - (el.quer ? LUECKE_B : LUECKE_L) };
}

const SEITEN = { n: [0, -1], s: [0, 1], o: [1, 0], w: [-1, 0] };
const WAND = 0.2, TUER_BREIT = 2.6;      // Wände begehbarer Häuser und die Lücke für die Tür (Meter)
// Was steht drinnen? (Namen der Modelle aus assets/gelaende/)
const MOEBEL = { kraft: ['innen_kraft', 'innen_laufband'], physio: ['innen_liege', 'innen_spinde'], essen: ['innen_buffet', 'innen_tisch'], saiten: ['innen_bespann'], presse: ['innen_podium', 'innen_stuehle'], hotel: ['innen_empfang', 'innen_sofa'] };
// In welche Häuser kann man hineingehen? Sie müssen groß genug sein und eine Tür für den Turniertag haben.
const begehbar = (el) => Math.min(el.b, el.t) >= 6 && el.dach !== 'glas' && el.dach !== 'zelt' && !el.modell && (!!el.ort || (el.tueren || []).some((t) => t.ort));
const TUER_VOR = 1.9;        // so weit vor der Wand liegt der Punkt, an dem man „an der Tür“ steht

// Macht aus einem Plan alles, was das Spiel zum Bauen und Laufen braucht:
//   teile   = die Bausteine (Plätze bekommen ihre Größe b/t dazu)
//   sperren = Formen, durch die man nicht laufen kann
//   orte    = alle Türen: { id, name, text, info, tx, tz (da steht man), wx, wz (da ist die Tür in der Wand), teil }
//   punkte  = wo Bäume, Statuen, Schirme und Zelte genau stehen (je Baustein eine Liste [x, z, größe])
export const planVon = (id) => (GELAENDE[id] ? planAus(GELAENDE[id], id) : null);
// Das Gelände für ein Turnier: die großen haben einen eigenen Plan, für die kleinen wird einer zusammengebaut (gelaendeklein.js)
export const gelaendeFuer = (def) => (def ? GELAENDE[def.id] || kleinesGelaende(def) : null);
// g = ein Gelände (aus GELAENDE oder von kleinesGelaende) · id = ein Kürzel, nur für den Zufall der Bäume
export function planAus(g, id = g.name) {
  if (!g) return null;
  const teile = g.teile.map((el) => (el.a === 'plaetze' ? { ...el, ...plaetzeMass(el) } : { ...el }));
  const sperren = [], orte = [], punkte = new Map(), fest = [], raeume = [];
  let infoNr = 0;
  // 1. Feste Dinge sperren. „fest“ merkt sich jedes Haus als Ganzes (dort wächst kein Baum),
  //    in „sperren“ stehen bei begehbaren Häusern später nur die Wände – innen kann man laufen.
  const zu = (s) => { sperren.push(s); fest.push(s); };
  teile.forEach((el, nr) => {
    if (el.a === 'stadion') zu({ x: el.x, z: el.z, b: el.b, t: el.t, h: el.h, rund: el.form === 'oval' || el.form === 'rund' });
    else if (el.a === 'haus' && begehbar(el)) { fest.push({ x: el.x, z: el.z, b: el.b, t: el.t, h: el.h }); raeume.push({ teil: nr, x: el.x, z: el.z, b: el.b, t: el.t, h: el.h, name: el.name || '', tueren: [], waende: [], moebel: [] }); }
    else if (el.a === 'haus' || el.a === 'plaetze' || el.a === 'auto' || el.a === 'zaun') zu({ x: el.x, z: el.z, b: el.b, t: el.t, h: el.a === 'haus' ? el.h : 0 });
    else if (el.a === 'flaeche' && el.wasser) zu({ x: el.x, z: el.z, b: el.b, t: el.t, rund: !!el.rund });
    else if (el.a === 'huegel') zu({ x: el.x, z: el.z, b: el.b * 0.8, t: el.t * 0.8, h: el.h * 0.7, rund: true });
    else if (el.a === 'kugel') zu({ x: el.x, z: el.z, b: el.r * 2, t: el.r * 2, rund: true });
    else if (el.a === 'bogen') zu({ x: el.x, z: el.z, b: el.b, t: el.t });
    else if (el.a === 'tuerme') for (const [x, z, b, t, h] of el.p) zu({ x, z, b, t, h });
    else if (el.a === 'obelisk') zu({ x: el.x, z: el.z, b: 2.4, t: 2.4 });
    else if (el.a === 'hecke') zu({ x: el.x, z: el.z, b: el.b, t: el.t });
    else if (el.a === 'leinwand' && el.b > 1) { const quer = el.dreh === 90 || el.dreh === 270; zu({ x: el.x, z: el.z, b: quer ? 1 : el.b, t: quer ? el.b : 1, h: el.h + 2 }); }
  });
  const inFest = (x, z, luft = 1.2) => fest.some((s) => {
    const dx = (x - s.x) / (s.b / 2 + luft), dz = (z - s.z) / (s.t / 2 + luft);
    return s.rund ? dx * dx + dz * dz <= 1 : Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
  });
  // 2. Türen
  const tuer = (el, t, nr) => {
    const [sx, sz] = SEITEN[t.s] || SEITEN.s, v = t.v || 0;
    const hb = Math.max(el.b || 0, 0.2) / 2, ht = Math.max(el.t || 0, 0.2) / 2;
    const wx = el.x + sx * hb - sz * v, wz = el.z + sz * ht + sx * v;            // Punkt in der Wand (v verschiebt die Tür an der Wand entlang)
    orte.push({
      id: t.ort || 'info' + (++infoNr), info: !t.ort, name: t.name || '', text: t.text || '',
      wx, wz, tx: wx + sx * TUER_VOR, tz: wz + sz * TUER_VOR, seite: t.s || 's', teil: nr,
    });
  };
  teile.forEach((el, nr) => {
    if (el.ort) tuer(el, { ort: el.ort, s: el.tuer, v: el.v, name: el.name2 || el.name, text: el.text }, nr);
    else if (el.info) tuer(el, { s: el.tuer, v: el.v, name: el.name, text: el.info }, nr);
    for (const t of el.tueren || []) tuer(el, t, nr);
  });
  // 2b. Begehbare Häuser: Wände mit Lücken für die Türen, drinnen Möbel passend zu dem, was man dort tut
  for (const r of raeume) {
    r.tueren = orte.filter((o) => o.teil === r.teil);
    const hb = r.b / 2, ht = r.t / 2;
    for (const [seite, [sx, sz]] of Object.entries(SEITEN)) {
      // Die Wand läuft von −halb bis +halb; wo eine Tür ist, bleibt ein Stück frei
      const halb = sx ? ht : hb, mitte = sx ? r.z : r.x;
      const luecken = r.tueren.filter((o) => o.seite === seite && !o.info).map((o) => (sx ? o.wz : o.wx) - mitte).sort((p, q) => p - q);
      let von = -halb;
      const stueck = (a, b) => { if (b - a < 0.3) return; const m = (a + b) / 2, l = b - a; r.waende.push(sx ? { x: r.x + sx * hb, z: r.z + m, b: WAND, t: l, seite } : { x: r.x + m, z: r.z + sz * ht, b: l, t: WAND, seite }); };
      for (const c of luecken) { stueck(von, c - TUER_BREIT / 2); von = c + TUER_BREIT / 2; }
      stueck(von, halb);
    }
    for (const w of r.waende) sperren.push({ x: w.x, z: w.z, b: w.b, t: w.t, h: r.h });
    // Möbel stehen an der Wand gegenüber der Tür
    const stell = (name, x, z, dreh) => {
      x = Math.max(r.x - hb + 1.9, Math.min(r.x + hb - 1.9, x)); z = Math.max(r.z - ht + 1.9, Math.min(r.z + ht - 1.9, z));
      if (r.moebel.some((m) => Math.hypot(m.x - x, m.z - z) < 2.5) || r.tueren.some((o) => Math.hypot(o.wx - x, o.wz - z) < 3)) return;
      r.moebel.push({ name, x, z, dreh });
      sperren.push({ x, z, b: 1.1, t: 1.1 });
    };
    for (const o of r.tueren) {
      const [sx, sz] = SEITEN[o.seite], liste = MOEBEL[o.id] || [];
      const dreh = Math.atan2(sx, sz);                                        // die Möbel schauen zur Tür
      const gx = sx ? r.x - sx * (hb - 1.9) : o.wx, gz = sz ? r.z - sz * (ht - 1.9) : o.wz;
      liste.forEach((name, i) => stell(name, gx + (sx ? 0 : (i ? 2.8 : 0)), gz + (sx ? (i ? 2.8 : 0) : 0), dreh));
    }
    if (/Club|Hotel|Spieler/.test(r.name) && r.tueren.length) {
      // Im Clubhaus: Pokal-Vitrine und Sofa-Ecke an einer Seitenwand
      const quer = r.tueren[0].seite === 'o' || r.tueren[0].seite === 'w';
      if (quer) { stell('innen_vitrine', r.x - 3, r.z - ht + 1.9, 0); stell('innen_sofa', r.x + 2, r.z - ht + 1.9, 0); }
      else { stell('innen_vitrine', r.x - hb + 1.9, r.z - 2.4, Math.PI / 2); stell('innen_sofa', r.x - hb + 1.9, r.z + 1.2, Math.PI / 2); }
    }
  }
  // 3. Bäume, Statuen, Schirme, Zelte: genaue Stellen ausrechnen
  teile.forEach((el, nr) => {
    const z = zufall(nr * 7919 + id.length * 104729 + id.charCodeAt(0)), liste = [];
    if (el.a === 'baeume' || el.a === 'schirme') {
      if (el.linie) {
        const [x1, z1, x2, z2] = el.linie;
        for (let i = 0; i < el.n; i++) { const f = el.n === 1 ? 0.5 : i / (el.n - 1); liste.push([x1 + (x2 - x1) * f + (z() - 0.5) * 0.8, z1 + (z2 - z1) * f + (z() - 0.5) * 0.8, 0.85 + z() * 0.35]); }
      } else {
        const [fx, fz, fb, ft] = el.feld || [el.x, el.z, el.b, el.t];
        for (let i = 0, versuch = 0; i < el.n && versuch < el.n * 12; versuch++) {
          const x = fx + (z() - 0.5) * fb, zz = fz + (z() - 0.5) * ft, gr = 0.85 + z() * 0.4;
          if (inFest(x, zz) || liste.some((p) => Math.hypot(p[0] - x, p[1] - zz) < 2.6)) continue;
          liste.push([x, zz, gr]); i++;
        }
      }
      const frei = liste.filter(([x, zz]) => !inFest(x, zz, 0.6) && !orte.some((o) => Math.hypot(o.tx - x, o.tz - zz) < 2.2));
      punkte.set(nr, frei);
      for (const [x, zz] of frei) sperren.push({ x, z: zz, b: 0.5, t: 0.5, rund: true });
    } else if (el.a === 'statuen') {
      for (let i = 0; i < el.n; i++) { const w = (i + 0.5) / el.n * Math.PI * 2; liste.push([el.x + Math.sin(w) * el.b / 2, el.z + Math.cos(w) * el.t / 2, 1]); }
      const frei = liste.filter(([x, zz]) => !orte.some((o) => Math.hypot(o.tx - x, o.tz - zz) < 2.6 || Math.hypot(o.wx - x, o.wz - zz) < 2.6));
      punkte.set(nr, frei);
      for (const [x, zz] of frei) sperren.push({ x, z: zz, b: 0.7, t: 0.7 });
    } else if (el.a === 'autos') {
      // geparkte Autos in einer Reihe (das dritte Feld ist hier die Nummer der Farbe)
      for (let i = 0; i < el.n; i++) liste.push([el.x + (el.n === 1 ? 0 : (i / (el.n - 1) - 0.5) * el.b), el.z, Math.floor(z() * 6)]);
      punkte.set(nr, liste);
      for (const [x, zz] of liste) sperren.push({ x, z: zz, b: 2, t: 4.4 });
    } else if (el.a === 'zelte') {
      for (let i = 0; i < el.n; i++) liste.push([el.x + (el.n === 1 ? 0 : (i / (el.n - 1) - 0.5) * el.b), el.z, 1]);
      punkte.set(nr, liste);
      for (const [x, zz] of liste) sperren.push({ x, z: zz, b: 4, t: 4 });
    }
  });
  return { id, g, teile, sperren, orte, punkte, raeume };
}

// Die neun Orte, die jedes Gelände braucht (dort passiert am Turniertag etwas)
export const PFLICHT_ORTE = ['court', 'training', 'kraft', 'physio', 'hotel', 'essen', 'saiten', 'presse', 'fans'];
