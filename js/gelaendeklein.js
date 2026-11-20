// Powershot – die Gelände der kleineren Turniere (ohne three.js, in node testbar).
//
// Es gibt über 200 kleine Turniere im Kalender (ITF, Challenger, ATP 250, ATP 500). Für jedes einen Plan von Hand
// zu zeichnen, wäre viel zu viel. Deshalb BAUT sich das Spiel den Plan selbst zusammen – aus vier Dingen:
//   1. Wie groß ist das Turnier?  ITF = kleiner Tennisclub · Challenger = Club mit Tribünen ·
//                                  ATP 250 = kleines Stadion · ATP 500 = großes Stadion mit Fan-Dorf
//   2. Welcher Belag?             Sand, Hartplatz, Rasen oder Halle (Halle = Glasdach, im Winter liegt draußen Schnee)
//   3. Wo liegt die Stadt?        am Meer, in den Bergen, in der Wüste, in der Großstadt … (Tabelle ORTE_BESONDERS und Erdteil)
//   4. Der Name der Stadt         entscheidet per „Zufall“ über Kleinigkeiten (gespiegelt oder nicht, Farben, Dachform).
//                                  Dieselbe Stadt sieht deshalb jedes Mal gleich aus.
// Bekannte Turniere (z. B. Halle, Hamburg, Kitzbühel, Dubai) haben dazu echte Besonderheiten bekommen.
// Die Pläne sind ERFUNDEN und nur an die echten Orte angelehnt (Landschaft, Belag, bekannte Merkmale).

const PFLASTER = 0xcfc8ba, ASPHALT = 0x77777c, WIESE = 0x5c9a4c, WASSER = 0x3f8fc8, SCHNEE = 0xe8eef2;
const FELD = { clay: [0xc8643a, 0xb85a34], hard: [0x2f66b0, 0x2a8a6a], grass: [0x4a9a3c, 0x3f8a34], indoor: [0x2a4a8a, 0x23283a] };

// ---- Wo liegt die Stadt? Was ist dort besonders? ----
// land: 'meer' | 'berge' | 'alpen' | 'wueste' | 'stadt' | 'wald' | 'see' (mehrere möglich)
// stadion: Name · form · dach · satz = Text am Stadion · dazu = Extra-Sehenswürdigkeit { name, text }
const ORTE_BESONDERS = {
  // --- ATP 500 ---
  'Halle': { land: ['wald'], stadion: 'Stadion von Halle', form: 'eckig', dach: 'schieb', satz: 'Ein Rasen-Stadion mit Dach für 12.300 Zuschauer – mitten in einer kleinen Stadt in Westfalen. Das Spieler-Hotel steht direkt daneben.', dazu: { name: 'Sport-Hotel', text: 'Die Spieler wohnen hier nur 50 Meter vom Centre Court entfernt. Manche schauen vom Balkon aus beim Training zu.' } },
  'London': { land: ['stadt'], stadion: 'Centre Court im Queen’s Club', form: 'eckig', wand: 0xa8553a, satz: 'Einer der ältesten Tennisclubs der Welt (seit 1886). Der Rasen hier gilt als der beste überhaupt – noch vor Wimbledon.', dazu: { name: 'Altes Clubhaus', text: 'Das Clubhaus aus rotem Backstein. Drinnen hängen Bilder aller Sieger – viele haben danach auch Wimbledon gewonnen.' } },
  'Hamburg': { land: ['stadt', 'see'], stadion: 'Stadion am Rothenbaum', form: 'acht', dach: 'ring', satz: 'Deutschlands größtes Tennisstadion (10.000 Plätze). Das Dach ist aus weißem Stoff gespannt wie ein Zirkuszelt.', dazu: { name: 'Blick zur Alster', text: 'Gleich hinter dem Stadion liegt die Alster, ein großer See mitten in Hamburg.' } },
  'Barcelona': { land: ['berge', 'stadt'], stadion: 'Pista Rafa Nadal', form: 'eckig', satz: 'Der Centre Court im ältesten Tennisclub Spaniens trägt den Namen von Rafael Nadal: Er hat dieses Turnier zwölfmal gewonnen.', dazu: { name: 'Schwimmbecken', text: 'Eine alte Tradition: Der Sieger des Turniers springt zusammen mit den Ballkindern ins Schwimmbecken!' }, pool: true },
  'München': { land: ['wald', 'alpen'], stadion: 'Centre Court am Aumeister', form: 'eckig', satz: 'Der Club liegt am Rand des Englischen Gartens. An klaren Tagen sieht man von der Tribüne die Alpen.', dazu: { name: 'Biergarten', text: 'Zwischen den Plätzen sitzt man unter Kastanien im Biergarten.' } },
  'Rio de Janeiro': { land: ['berge', 'meer'], stadion: 'Quadra Guga Kuerten', form: 'eckig', satz: 'Das größte Turnier Südamerikas, gespielt auf rotem Sand im Jockey-Club. Der Centre Court heißt nach Gustavo „Guga“ Kuerten.', dazu: { name: 'Blick zum Berg', text: 'Über dem Gelände ragen die grünen Berge von Rio auf – auf einem steht die berühmte Christus-Statue.' } },
  'Doha': { land: ['wueste', 'stadt'], stadion: 'Centre Court von Doha', form: 'acht', satz: 'Tennis in der Wüste: Das Turnier findet im Februar statt, wenn es in Katar angenehm warm ist. Der Sieger bekommt einen goldenen Falken als Pokal.' },
  'Dubai': { land: ['wueste', 'stadt'], stadion: 'Tennisstadion von Dubai', form: 'acht', hochhaus: 150, satz: 'Das Stadion steht mitten in einem Dorf aus Restaurants mit einem kleinen Teich. Im Hintergrund: die höchsten Häuser der Welt.', teich: true },
  'Acapulco': { land: ['meer'], stadion: 'Arena von Acapulco', form: 'rund', dach: 'ring', satz: 'Hier wird abends gespielt, weil es tagsüber zu heiß ist. Die Stimmung ist berühmt: Die Fans singen und feiern bis nach Mitternacht.' },
  'Dallas': { land: ['stadt'], stadion: 'Halle der Football-Stars', form: 'eckig', satz: 'Gespielt wird in der Trainingshalle einer Football-Mannschaft. Unter dem Tennisplatz liegt ein ganzes Football-Feld!' },
  'Rotterdam': { land: ['stadt', 'see'], stadion: 'Centre Court im Ahoy', form: 'eckig', satz: 'Die große Halle am Hafen. Turnierchef ist ein früherer Wimbledon-Sieger: Richard Krajicek.' },
  'Washington': { land: ['wald'], stadion: 'Stadion im Rock-Creek-Park', form: 'eckig', satz: 'Das Stadion liegt mitten in einem Wald in der Hauptstadt der USA. Im Sommer ist es hier so heiß und feucht, dass die Spieler Eiswesten tragen.' },
  'Tokio': { land: ['stadt', 'meer'], stadion: 'Ariake Colosseum', form: 'acht', dach: 'schieb', satz: 'Das Stadion mit dem Schiebedach steht auf einer künstlichen Insel in der Bucht von Tokio. 10.000 Plätze.' },
  'Peking': { land: ['stadt'], stadion: 'Diamond Court', form: 'rund', dach: 'schieb', satz: 'Das „Diamant-Stadion“ (15.000 Plätze) wurde nach den Olympischen Spielen 2008 gebaut. Daneben steht das „Lotus-Stadion“, das aussieht wie eine Blüte.', platz1: 'Lotus Court', platz1Dach: 'blume' },
  'Wien': { land: ['stadt'], stadion: 'Centre Court in der Stadthalle', form: 'eckig', satz: 'Die Wiener Stadthalle: Hier spielen sonst Rockbands. Beim Tennis ist die Halle fast immer ausverkauft.' },
  'Basel': { land: ['stadt', 'berge'], stadion: 'Centre Court in der St. Jakobshalle', form: 'eckig', satz: 'Das Heim-Turnier von Roger Federer: Als Junge war er hier Ballkind, später hat er zehnmal gewonnen. Nebenan steht das Fußballstadion.', fussball: true },
  // --- ATP 250 mit besonderer Landschaft ---
  'Kitzbühel': { land: ['alpen'], stadion: 'Stadion am Kapserbach', form: 'eckig', satz: 'Tennis mitten in den Alpen auf 760 Metern Höhe. Die Bälle fliegen in der dünnen Luft schneller als am Meer.', haus: 'holz' },
  'Gstaad': { land: ['alpen'], stadion: 'Arena in den Bergen', form: 'eckig', satz: 'Das höchstgelegene Turnier Europas (1.050 Meter). Rundherum Almwiesen, Holzhäuser und Kuhglocken.', haus: 'holz' },
  'Umag': { land: ['meer'], stadion: 'Stadion am Meer', form: 'eckig', satz: 'Das Stadion liegt direkt an der Adria. Nach dem Match springen manche Spieler ins Meer.' },
  'Båstad': { land: ['meer', 'wald'], stadion: 'Centre Court von Båstad', form: 'eckig', satz: 'Ein kleiner Badeort in Schweden. Vom Centre Court sieht man die Segelboote im Hafen.' },
  'Eastbourne': { land: ['meer'], stadion: 'Centre Court im Devonshire Park', form: 'eckig', satz: 'Rasen-Tennis an der englischen Küste. Oft weht ein kräftiger Wind vom Meer – das macht den Aufschlag schwer.' },
  'Mallorca': { land: ['meer', 'berge'], stadion: 'Centre Court von Santa Ponsa', form: 'eckig', satz: 'Rasen auf einer Sonneninsel! Das Gras muss hier jeden Tag kräftig gewässert werden.' },
  'Los Cabos': { land: ['meer', 'wueste'], stadion: 'Stadion von Los Cabos', form: 'eckig', satz: 'An der Spitze einer langen Halbinsel in Mexiko, wo die Wüste auf das Meer trifft.' },
  'Estoril': { land: ['meer'], stadion: 'Centre Court von Estoril', form: 'eckig', satz: 'Ein Tennisclub in einem Badeort bei Lissabon, nur ein paar Minuten vom Strand.' },
  'Marrakesch': { land: ['wueste', 'berge'], stadion: 'Centre Court im Königlichen Club', form: 'eckig', satz: 'Das einzige ATP-Turnier in Afrika. Hinter den Palmen sieht man die schneebedeckten Gipfel des Atlas-Gebirges.' },
  'Genf': { land: ['see', 'alpen'], stadion: 'Centre Court im Park', form: 'eckig', satz: 'Der Club liegt in einem Park am Genfer See. Auf der anderen Seite des Sees: der Mont Blanc, der höchste Berg der Alpen.' },
  'Stuttgart': { land: ['wald', 'berge'], stadion: 'Centre Court am Weissenhof', form: 'eckig', satz: 'Der Club liegt auf einem Hügel über der Stadt. Früher wurde hier auf Sand gespielt, seit 2015 auf Rasen.' },
  '’s-Hertogenbosch': { land: ['wald'], stadion: 'Centre Court im Autotron', form: 'eckig', satz: 'Rasen-Tennis in Holland – zwischen Wald und Wiesen.' },
  'Brisbane': { land: ['stadt'], stadion: 'Pat Rafter Arena', form: 'oval', dach: 'ring', satz: 'Das Stadion hat ein Dach, aber keine Wände: So bleibt es im heißen australischen Sommer luftig. Benannt nach Patrick Rafter.' },
  'Hongkong': { land: ['stadt', 'meer', 'berge'], stadion: 'Centre Court im Victoria Park', form: 'eckig', hochhaus: 80, satz: 'Ein Stadion in einem Park, eingeklemmt zwischen Wolkenkratzern, Bergen und dem Hafen.' },
  'Santiago': { land: ['alpen'], stadion: 'Centre Court von Santiago', form: 'eckig', satz: 'Hinter dem Platz stehen die Anden – Berge, die über 5.000 Meter hoch sind.' },
  'Almaty': { land: ['alpen', 'stadt'], stadion: 'Halle von Almaty', form: 'eckig', satz: 'Kasachstan, mitten in Asien: Hinter der Stadt beginnen gleich die hohen, verschneiten Berge.' },
  'Auckland': { land: ['meer', 'stadt'], stadion: 'Centre Court von Auckland', form: 'eckig', satz: 'Das erste Turnier des Jahres in Neuseeland – in der „Stadt der Segel“.' },
  'Adelaide': { land: ['stadt', 'wald'], stadion: 'Memorial Drive', form: 'eckig', dach: 'ring', satz: 'Ein Tennisplatz mit über 100 Jahren Geschichte, direkt neben dem großen Cricket-Stadion.' },
  'Buenos Aires': { land: ['stadt'], stadion: 'Estadio Guillermo Vilas', form: 'oval', satz: 'Benannt nach Guillermo Vilas, dem größten Tennisspieler Argentiniens. Die Fans singen hier wie beim Fußball.' },
  'Houston': { land: ['wald'], stadion: 'Centre Court im River Oaks Club', form: 'eckig', satz: 'Ein vornehmer alter Club mit rotem Sand – das letzte Sandplatz-Turnier der USA.' },
  'Stockholm': { land: ['stadt', 'see'], stadion: 'Kungliga Tennishallen', form: 'eckig', satz: 'Die „Königliche Tennishalle“ aus Backstein steht seit 1943. Der schwedische König kommt oft zum Zuschauen.', wand: 0xa8553a },
  'Winston-Salem': { land: ['wald'], stadion: 'Stadion an der Universität', form: 'eckig', satz: 'Das Stadion gehört zu einer Universität. Es ist das letzte Turnier vor den US Open.' },
  'Delray Beach': { land: ['meer'], stadion: 'Stadion von Delray Beach', form: 'eckig', satz: 'Ein Stadion mitten in einer kleinen Stadt in Florida, zehn Minuten vom Strand.' },
  // --- Kleine Turniere an bekannten Urlaubsorten ---
  'Monastir': { land: ['meer', 'wueste'], hotel: true }, 'Sharm El Sheikh': { land: ['meer', 'wueste'], hotel: true }, 'Antalya': { land: ['meer', 'berge'], hotel: true },
  'Heraklion': { land: ['meer', 'berge'], hotel: true }, 'Hammamet': { land: ['meer', 'wueste'], hotel: true }, 'Santa Margherita di Pula': { land: ['meer'], hotel: true },
  'Manacor': { land: ['berge'], dazu: { name: 'Tennis-Akademie', text: 'In Manacor auf Mallorca ist Rafael Nadal aufgewachsen. Heute steht hier seine große Tennis-Akademie.' } },
  'Ortisei': { land: ['alpen'], haus: 'holz' }, 'Bolzano': { land: ['alpen'] }, 'Trento': { land: ['alpen'] }, 'Lugano': { land: ['see', 'alpen'] }, 'Zug': { land: ['see', 'alpen'] }, 'Como': { land: ['see', 'berge'] },
  'Überlingen': { land: ['see'] }, 'San Marino': { land: ['berge'] }, 'Saint-Tropez': { land: ['meer'] }, 'Cassis': { land: ['meer', 'berge'] }, 'Ajaccio': { land: ['meer', 'berge'] }, 'Olbia': { land: ['meer'] },
  'Poreč': { land: ['meer'] }, 'Zadar': { land: ['meer'] }, 'Carnac': { land: ['meer'] }, 'Koksijde': { land: ['meer'] }, 'Punta del Este': { land: ['meer'] }, 'Faro': { land: ['meer'] }, 'Tanger': { land: ['meer'] },
  'Neapel': { land: ['meer', 'berge'], dazu: { name: 'Blick zum Vulkan', text: 'Der Club liegt direkt am Meer. Über der Bucht steht der Vesuv, ein echter Vulkan.' } }, 'Genua': { land: ['meer', 'berge'] }, 'Triest': { land: ['meer'] },
  'Mexiko-Stadt': { land: ['stadt', 'berge'] }, 'Seoul': { land: ['stadt'] }, 'Shenzhen': { land: ['stadt'] }, 'Guangzhou': { land: ['stadt'] }, 'Chicago': { land: ['stadt', 'see'] }, 'Yokohama': { land: ['stadt', 'meer'] },
  'Kigali': { land: ['berge'] }, 'Manama': { land: ['wueste', 'meer'] }, 'Phoenix': { land: ['wueste', 'berge'] }, 'Tunis': { land: ['wueste', 'meer'] },
};
const MITTELMEER = ['Barcelona', 'Rom', 'Mallorca', 'Manacor', 'Estoril', 'Umag', 'Murcia', 'Girona', 'Barletta', 'Madrid', 'Oeiras', 'Francavilla', 'Vicenza', 'Mailand', 'Triest', 'Cordenons', 'Lissabon', 'Maia', 'Neapel', 'Perugia',
  'Genua', 'Olbia', 'Zadar', 'Istanbul', 'San Marino', 'Como', 'Valencia', 'Reus', 'Sabadell', 'Reggio Emilia', 'La Bisbal', 'Martos', 'Poreč', 'Santa Margherita di Pula', 'Grasse', 'Xanthi', 'Aix-en-Provence', 'Saint-Tropez', 'Cassis', 'Ajaccio', 'Heraklion', 'Antalya', 'Faro', 'Vila Real de Santo António'];

const ENGLAND = ['London', 'Eastbourne', 'Nottingham', 'Ilkley', 'Surbiton', 'Birmingham', 'Glasgow', 'Sunderland', 'Sheffield', 'Loughborough', 'Bath', 'Roehampton', 'Shrewsbury', 'Edinburgh', 'Dublin'];

// Ein Zufall, der für denselben Text immer dieselben Zahlen liefert
function zufallAus(text) {
  let s = 2166136261;
  for (const z of text) s = Math.imul(s ^ z.codePointAt(0), 16777619);
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- Kurzschreibweisen ----
const S = (name, x, z, b, t, h, mehr = {}) => ({ a: 'stadion', name, x, z, b, t, h, ...mehr });
const H = (name, x, z, b, t, h, mehr = {}) => ({ a: 'haus', name, x, z, b, t, h, ...mehr });
const P = (x, z, nx, nz, mehr = {}) => ({ a: 'plaetze', x, z, nx, nz, ...mehr });
const F = (x, z, b, t, farbe, mehr = {}) => ({ a: 'flaeche', x, z, b, t, farbe, ...mehr });
const B = (art, mehr) => ({ a: 'baeume', art, ...mehr });
const INFO = (name, x, z, text, seite = 's') => ({ a: 'leinwand', x, z, b: 0.1, h: 0.1, name, tuer: seite, info: text });

// Baut den Plan für ein kleines Turnier. def = das Turnier (aus kleinetour.js): { name, city, cat, stufe, surface, erdteil }
export function kleinesGelaende(def) {
  const stadt = def.city || 'Zu Hause', O = ORTE_BESONDERS[stadt] || {}, zf = zufallAus(stadt + '|' + def.cat);
  const liga = def.cat === 'LIGA';
  const stufe = def.cat === 'A500' ? 3 : def.cat === 'A250' ? 2 : def.cat === 'CH' ? 1 : 0;
  const halle = def.surface === 'indoor', winter = halle && (def.erdteil === 'eu' || stadt === 'Almaty') && !['Wien', 'Basel', 'Stockholm'].includes(stadt);
  const land = O.land || (def.erdteil === 'af' ? ['wueste'] : stufe >= 2 ? ['stadt'] : zf() < 0.5 ? ['wald'] : []);
  const warm = land.includes('wueste') || def.erdteil === 'af' || ['Acapulco', 'Los Cabos', 'Delray Beach', 'Rio de Janeiro', 'Doha', 'Dubai', 'Manama', 'Kigali', 'Nonthaburi', 'Chennai', 'Bengaluru', 'Delhi', 'Sarasota', 'Punta del Este'].includes(stadt);
  const sued = MITTELMEER.includes(stadt), holz = O.haus === 'holz';
  // Farben von Häusern und Dächern je nach Gegend
  const wand = O.wand || (holz ? 0x8a5a36 : sued ? 0xf0dcc0 : warm ? 0xe8d8b8 : def.erdteil === 'eu' ? [0xe8e0d0, 0xb8663a, 0xd8d0c0][Math.floor(zf() * 3)] : 0xe0e0dc);
  const dachF = holz ? 0x4a3a2c : sued ? 0xc86a4a : warm ? 0xe8e0d0 : def.erdteil === 'eu' ? 0x7a3a2a : 0x6a7078;
  const dachArt = warm && !sued ? 'flach' : 'sattel';
  const baum = warm ? 'palme' : sued ? (zf() < 0.5 ? 'pinie' : 'zypresse') : winter || land.includes('alpen') ? 'zypresse' : 'laub';
  const feld = FELD[def.surface] || FELD.hard;
  const umland = winter ? SCHNEE : land.includes('wueste') ? 0xd8c098 : stufe >= 2 && land.includes('stadt') && !land.includes('wald') ? 0x8a8a84 : land.includes('alpen') ? 0x6aa852 : 0x5c9a4c;
  const boden = winter ? 0xd0d4d8 : land.includes('wueste') ? 0xd8ccb0 : stufe === 0 ? (def.surface === 'clay' ? 0xc8b89a : 0xc4c0b4) : PFLASTER;
  const stadionDach = O.dach || (halle ? 'glas' : 'offen');
  const T = [];          // die Bausteine
  let rand, name, kamW = 0;
  const um = {};         // die Landschaft rundherum, je Himmelsrichtung

  // ---- Landschaft drumherum ----
  const landschaft = (r) => {
    if (land.includes('meer')) { T.push({ a: 'meer', ab: r.z1 + 6 }); kamW = Math.PI; }            // Kamera schaut aufs Meer
    // Was liegt rundherum? (Wörter für umgebung.js: vorn das, was nah am Zaun ist, dahinter die Ferne)
    const nah = winter ? 'wald felder' : land.includes('wueste') ? 'wueste' : land.includes('wald') ? 'wald felder' : stufe === 0 ? 'felder vorort' : 'vorort felder';
    for (const k of 'nosw') um[k] = nah;
    if (land.includes('stadt')) um.w = um.n = stufe >= 2 ? 'stadt skyline:0.8' : 'vorort stadt';
    if (land.includes('alpen')) { um.n += ' alpen:210'; um.w += ' waldberge:90'; um.o += ' waldberge:80'; um.s += ' huegel:30'; }
    else if (land.includes('berge')) { um.n += warm ? ' fels:120' : ' berge:110'; um.w += warm ? ' fels:70' : ' waldberge:70'; um.o += ' huegel:30'; }
    else if (land.includes('wueste')) { um.n += ' fels:80'; um.w += ' fels:45'; um.o += ' huegel:12'; um.s += ' huegel:10'; }
    else { um.n += ' huegel:22'; um.o += ' huegel:14'; um.w += ' huegel:26'; um.s += ' huegel:10'; }
    if (land.includes('see')) um.o = 'park wald huegel:16';
    if (land.includes('meer')) um.s = 'meer';
    if (land.includes('see')) T.push(F(r.x1 + 70, 10, 90, 150, WASSER, { rund: true }));
    if (land.includes('stadt')) {
      const p = [];
      for (let i = 0; i < 9; i++) p.push([r.x0 - 40 - zf() * 70, r.z0 + i * 26 - 30 + zf() * 10, 14 + zf() * 8, 14 + zf() * 6, (stufe >= 2 ? 26 : 14) + zf() * (stufe >= 2 ? 46 : 16)]);
      for (let i = 0; i < 7; i++) p.push([r.x0 + i * 34 + zf() * 10, r.z0 - 44 - zf() * 50, 14 + zf() * 8, 14 + zf() * 6, (stufe >= 2 ? 24 : 12) + zf() * (stufe >= 2 ? 40 : 14)]);
      if (O.hochhaus) p.push([r.x0 - 120, r.z0 - 60, 16, 16, O.hochhaus]);
      T.push({ a: 'tuerme', p, farbe: warm ? 0xd8ccb8 : 0x8aa2bc, dach: 0x5a6a7a });
    }
    if (land.includes('wald') || (!land.length && !winter)) T.push(B(baum, { feld: [(r.x0 + r.x1) / 2, r.z0 - 60, r.x1 - r.x0 + 160, 80], n: 70 }), B(baum, { feld: [r.x0 - 60, 0, 80, r.z1 - r.z0 + 60], n: 40 }));
    if (winter) T.push(B('zypresse', { feld: [(r.x0 + r.x1) / 2, r.z0 - 50, r.x1 - r.x0 + 120, 60], n: 40 }));
    T.push(F((r.x0 + r.x1) / 2, r.z0 - 9, 700, 8, ASPHALT));                                        // die Straße vor dem Eingang
  };
  // Ein überdachter Platz (Halle): Plätze mit Glasdach darüber
  const platzGruppe = (x, z, nx, nz, mehr = {}) => {
    T.push(P(x, z, nx, nz, { feld, ...mehr }));
    if (halle) { const lx = mehr.quer ? 14.5 : 8.2, lz = mehr.quer ? 8.2 : 14.5; T.push({ a: 'glasdach', x, z, b: nx * lx + 1, t: nz * lz + 1, h: 8 }); }
  };
  const fahnen = (x, z, n = 3) => T.push({ a: 'fahnen', x, z, n, farben: [0xe84a3a, 0xf4f4f0, 0x3a6ae8, 0xf0d040, 0x3aa85a].sort(() => zf() - 0.5).slice(0, n) });

  if (stufe === 0) {
    // =========================================================================
    // ITF-Turnier oder Liga: ein ganz normaler Tennisclub. Kein Stadion, kaum Zuschauer – so fängt jeder Profi an.
    // =========================================================================
    rand = { x0: -48, x1: 48, z0: -40, z1: 42 };
    name = liga ? 'Dein Heimatverein' : O.hotel ? `Hotel-Anlage in ${stadt}` : `Tennisclub ${stadt}`;
    landschaft(rand);
    // Clubhaus (oder das Urlaubshotel) mit Terrasse
    T.push(H(O.hotel ? 'Hotel' : 'Clubhaus', 0, -27, O.hotel ? 40 : 24, 10, O.hotel ? 12 : 4.6, { farbe: wand, dachFarbe: dachF, dach: O.hotel ? 'flach' : dachArt,
      tueren: [{ ort: 'kraft', s: 's', v: -9, name: 'Fitnessraum' }, { ort: 'essen', s: 's', v: 0, name: O.hotel ? 'Hotel-Buffet' : 'Club-Gaststätte' }, { ort: 'physio', s: 's', v: 9 }],
      text: O.hotel ? 'Viele kleine Turniere finden in Urlaubshotels statt: Die Spieler wohnen, essen und spielen am selben Ort – wochenlang.' : 'Das Clubhaus: Umkleide, Gaststätte und das Turnierbüro unter einem Dach.' }));
    T.push(F(0, -18.5, 26, 5, 0xe0d4bc, { e: 2 }), { a: 'schirme', x: 0, z: -18.5, b: 22, t: 2.5, n: 5, farbe: [0xf4f0e4, 0xe84a3a, 0x3a8a4a][Math.floor(zf() * 3)] });
    fahnen(-17, -20);
    // Platz 1 mit der kleinen Tribüne – hier spielst du
    T.push(S(liga ? 'Platz 1' : 'Platz 1 (Centre Court)', -15, 6, 15, 20, 2, { form: 'eckig', dach: halle ? 'glas' : 'offen', farbe: 0x8a8e96, sitz: 0x6a8a6a, feld, ort: 'court', tuer: 's', leer: 0.85,
      text: liga ? 'Dein Heimatplatz. Auf der kleinen Tribüne sitzen deine Vereinskollegen und feuern dich an.' : 'Der „Centre Court“ ist hier einfach Platz 1 mit ein paar Bänken. Zuschauer: der Trainer, die Eltern und ein Hund.' }));
    platzGruppe(17, 6, 3, 1, { name: 'Plätze 2 bis 4' });
    platzGruppe(4, 30, 2, 1, { quer: true, ort: 'training', tuer: 'n', name: 'Trainingsplätze' });
    T.push(H('Besaiter', -36, 26, 5, 5, 2.6, { farbe: 0xf4f2ec, dach: 'zelt', ort: 'saiten', tuer: 'o', text: 'Ein Zelt mit einer Bespann-Maschine. Bei kleinen Turnieren bespannt oft einer für alle Spieler.' }));
    T.push(H('Turnierbüro', 36, -6, 6, 5, 3, { farbe: wand, dachFarbe: dachF, ort: 'presse', tuer: 'w', name2: 'Turnierbüro' }));
    T.push({ a: 'leinwand', x: 26, z: -13, b: 3, h: 2.2, name: 'Auslosung', tuer: 's', info: 'An dieser Tafel hängt die Auslosung: 32 Namen, jeden Tag fliegt die Hälfte raus. Wer hier oft gewinnt, darf bald zu den Challengern.' });
    T.push({ a: 'zaun', x: -34, z: -4, b: 4, t: 1, ort: 'fans', tuer: 's' });
    T.push({ a: 'zelte', x: -34, z: -15, b: 0, n: 1 }, INFO('Imbiss', -34, -12, def.erdteil === 'eu' ? 'Der Imbiss-Stand vom Verein: Würstchen, Kuchen von den Eltern und Limo. Mehr gibt es bei einem ITF-Turnier nicht.' : 'Ein kleiner Stand mit Getränken und Snacks – mehr gibt es bei einem ITF-Turnier nicht.'));
    T.push(H('', 43, 26, 1.2, 9, 3.2, { farbe: 0x3a7a4a, dach: 'flach', name: 'Ballwand', tuer: 'w', info: 'An der Ballwand kann man allein üben: Die Wand spielt jeden Ball zurück und macht nie einen Fehler.' }));
    T.push(F(31, -30, 26, 12, ASPHALT, { e: 2 }), { a: 'autos', x: 34, z: -33.5, n: 4 + Math.floor(zf() * 3), b: 20 }, { a: 'auto', x: 26.5, z: -27, b: 4.4, t: 2, ort: 'hotel', tuer: 's' });
    if (O.hotel) T.push(F(-34, 36, 16, 8, WASSER, { e: 2 }), { a: 'schirme', x: -34, z: 29, b: 14, t: 2, n: 4, farbe: 0xf4f0e4 }, INFO('Hotel-Pool', -22, 36, 'Zwischen zwei Matches liegen die Spieler am Pool – oder sie lernen für die Schule: Viele sind erst 17 oder 18.', 'o'));
    if (O.dazu) T.push(INFO(O.dazu.name, 40, 12, O.dazu.text, 'w'));
    T.push({ a: 'hecke', x: 0, z: 40.5, b: 90, t: 1.2 }, { a: 'hecke', x: -46.5, z: 8, b: 1.2, t: 56 });
    T.push(B(baum, { linie: [-44, -37, 12, -37], n: 7 }), B(baum, { linie: [-43, 14, -43, 38], n: 4 }), B(baum, { linie: [26, 20, 44, 38], n: 3 }));
  } else if (stufe === 1) {
    // =========================================================================
    // Challenger: ein großer Club. Für das Turnier werden Tribünen aus Stahlrohr aufgebaut, es gibt Sponsoren-Zelte und einen Physio.
    // =========================================================================
    rand = { x0: -62, x1: 62, z0: -50, z1: 52 };
    name = `Tennisclub ${stadt}`;
    landschaft(rand);
    T.push(S('Centre Court', -8, 4, 26, 24, 5, { form: 'eckig', dach: halle ? 'glas' : 'offen', farbe: 0x8a8e96, sitz: 0x4a6a8a, feld, ort: 'court', tuer: 's', leer: 0.5,
      text: 'Die Tribünen aus Stahlrohr werden nur für diese eine Woche aufgebaut: Platz für etwa 1.500 Zuschauer. Wer bei Challengern gewinnt, klopft an die Tür zur großen Tour.' }));
    T.push(S('Platz 2', 30, -8, 14, 19, 2, { form: 'eckig', dach: halle ? 'glas' : 'offen', farbe: 0x8a8e96, sitz: 0x4a6a8a, feld, leer: 0.8 }));
    platzGruppe(34, 24, 3, 1, { name: 'Plätze 3 bis 5' });
    platzGruppe(-42, 30, 2, 1, { ort: 'training', tuer: 'o', name: 'Trainingsplätze' });
    T.push(H('Clubhaus', -36, -32, 26, 10, 5, { farbe: wand, dachFarbe: dachF, dach: dachArt, tueren: [{ ort: 'kraft', s: 's', v: -9 }, { ort: 'essen', s: 's', v: 0, name: 'Club-Gaststätte' }, { ort: 'physio', s: 's', v: 9 }],
      text: 'Im Clubhaus gibt es für diese Woche einen Physio und einen kleinen Kraftraum für die Spieler.' }));
    T.push(F(-36, -23.5, 26, 5, 0xe0d4bc, { e: 2 }), { a: 'schirme', x: -36, z: -23.5, b: 22, t: 2.5, n: 5, farbe: 0xf4f0e4 });
    T.push(H(halle ? 'Zweite Halle' : 'Tennishalle', 26, -38, 30, 14, 7, { farbe: 0x9a9ea6, dachFarbe: 0xc8ccd4, dach: 'sattel', ort: 'presse', tuer: 's', name2: 'Presse-Ecke' }));
    T.push(H('Besaiter', 52, 4, 5, 5, 2.6, { farbe: 0xf4f2ec, dach: 'zelt', ort: 'saiten', tuer: 'w' }));
    T.push(F(2, 41, 46, 9, winter ? 0xd8dce0 : WIESE, { e: 2 }), { a: 'zelte', x: 2, z: 41, b: 36, n: 5 },
      INFO('Sponsoren-Dorf', 2, 34.5, 'Ohne Sponsoren gäbe es kein Turnier: In den Zelten stellen sich das Autohaus, die Bank und die Bäckerei aus der Stadt vor.', 'n'));
    T.push({ a: 'leinwand', x: -26, z: 22, b: 5, h: 3, dreh: 180, name: 'Anzeigetafel', tuer: 'n', info: 'Die Anzeigetafel zeigt alle Ergebnisse des Tages. Ganz oben stehen die Gesetzten – die vier besten Spieler des Turniers.' });
    T.push({ a: 'zaun', x: 10, z: 24, b: 4, t: 1, ort: 'fans', tuer: 's' });
    fahnen(-18, -22, 4);
    T.push(F(-2, -42, 34, 12, ASPHALT, { e: 2 }), { a: 'autos', x: 2, z: -45.6, n: 6 + Math.floor(zf() * 3), b: 26 }, { a: 'auto', x: -12, z: -38.5, b: 4.4, t: 2, ort: 'hotel', tuer: 's' });
    if (O.dazu) T.push(INFO(O.dazu.name, 54, 44, O.dazu.text, 'w'));
    T.push({ a: 'hecke', x: 0, z: 50.5, b: 122, t: 1.2 });
    T.push(B(baum, { linie: [-58, -10, -58, 46], n: 8 }), B(baum, { linie: [59, -44, 59, 46], n: 10 }), B(baum, { linie: [-56, -47, -24, -47], n: 4 }));
  } else {
    // =========================================================================
    // ATP 250 und ATP 500: ein richtiges Stadion, ein zweiter großer Platz, Fan-Dorf, Presse, Spieler-Bereich.
    // =========================================================================
    const gross = stufe === 3, k = gross ? 1.18 : 1;
    rand = gross ? { x0: -86, x1: 86, z0: -64, z1: 66 } : { x0: -74, x1: 74, z0: -56, z1: 58 };
    name = `Turniergelände ${stadt}`;
    landschaft(rand);
    const form = O.form || ['eckig', 'acht', 'oval'][Math.floor(zf() * 3)], sitz = [0x2a5aa8, 0x2a6a4a, 0x7a2a3a, 0x4a4a8a, 0x2a7a8a][Math.floor(zf() * 5)];
    const plaetze = gross ? '7.000 bis 12.000' : '3.000 bis 7.000';
    T.push(S(O.stadion || 'Centre Court', -8 * k, -2, 38 * k, 35 * k, gross ? 12 : 9, { form, dach: stadionDach, farbe: O.wand || (halle ? 0xb8bcc4 : 0xd0ccc0), sitz, feld, ort: 'court', tuer: 's',
      text: O.satz || `Ein richtiges Stadion für ${plaetze} Zuschauer. Bei einem ATP-${gross ? '500' : '250'}-Turnier spielen schon viele Spieler aus den Top 50 mit.` }));
    T.push(S(O.platz1 || 'Court 1', 42 * k, -20 * k, 22 * k, 20 * k, gross ? 6.5 : 4.5, { form: 'eckig', dach: O.platz1Dach || (halle ? 'glas' : 'offen'), farbe: O.wand || 0xc8c4b8, sitz, feld, tuer: 'w',
      info: 'Der zweitgrößte Platz. Hier spielen in den ersten Runden oft die jungen Spieler – also vielleicht du.' }));
    if (gross) T.push(S('Court 2', 46, 14, 18, 16, 3.5, { form: 'eckig', dach: halle ? 'glas' : 'offen', farbe: 0xc8c4b8, sitz, feld }));
    platzGruppe(gross ? 44 : 44, gross ? 42 : 20, gross ? 4 : 3, 1, { name: 'Nebenplätze' });
    platzGruppe(gross ? -56 : -48, gross ? 38 : 30, gross ? 4 : 3, 1, { ort: 'training', tuer: 'n', name: 'Trainingsplätze' });
    const hx = gross ? -58 : -50;
    T.push(H('Spieler-Zentrum', hx, -14, 18, 16, 7, { farbe: wand, dachFarbe: dachF, dach: dachArt === 'sattel' && !holz ? 'flach' : dachArt, tueren: [{ ort: 'kraft', s: 'o', v: -4 }, { ort: 'physio', s: 'o', v: 4 }],
      text: 'Hier haben nur Spieler und Trainer Zutritt: Umkleide, Kraftraum, Physio und ein ruhiger Raum zum Ausruhen.' }));
    T.push(H(O.dazu && (O.dazu.name.includes('Hotel') || O.dazu.name.includes('Clubhaus')) ? O.dazu.name : 'Spieler-Restaurant', hx, gross ? -46 : -42, 20, 10, O.dazu && O.dazu.name.includes('Hotel') ? 12 : 5.5,
      { farbe: O.wand || wand, dachFarbe: dachF, dach: dachArt, ort: 'essen', tuer: 's', name2: 'Spieler-Restaurant', text: O.dazu && (O.dazu.name.includes('Hotel') || O.dazu.name.includes('Clubhaus')) ? O.dazu.text : '' }));
    T.push(H('Pressezentrum', 14, gross ? -52 : -45, 16, 9, 5.5, { farbe: 0x5a6a7a, ort: 'presse', tuer: 's' }));
    T.push(H('Besaiter', gross ? 70 : 60, gross ? -46 : -40, 7, 6, 3.2, { farbe: 0x6a4ac8, ort: 'saiten', tuer: 'w' }));
    // Fan-Dorf: Wiese mit Schirmen, Zelten und Leinwand
    const fz = gross ? 50 : 44;
    T.push(F(-4, fz, 46, 16, winter ? 0xd8dce0 : WIESE, { e: 2 }), { a: 'schirme', x: -12, z: fz, b: 22, t: 10, n: 8, farbe: 0xf4f0e4 }, { a: 'zelte', x: 10, z: fz + 3, b: 14, n: 3 },
      { a: 'leinwand', x: -4, z: fz + 9.5, b: 10, h: 5, dreh: 180, name: 'Fan-Dorf', tuer: 'n', v: 14, info: 'Im Fan-Dorf gibt es Essen, Musik und eine große Leinwand. Wer keine Karte für das Stadion hat, schaut hier zu.' });
    T.push({ a: 'zaun', x: 22, z: gross ? 30 : 26, b: 4, t: 1, ort: 'fans', tuer: 's' });
    fahnen(-30 * k, 24 * k, 5);
    T.push(F(gross ? -30 : -24, gross ? -56 : -49, 34, 12, ASPHALT, { e: 2 }), { a: 'autos', x: gross ? -28 : -22, z: gross ? -59.6 : -52.6, n: 7, b: 26 }, { a: 'auto', x: gross ? -14 : -10, z: gross ? -52.5 : -45.5, b: 4.4, t: 2, ort: 'hotel', tuer: 's' });
    if (O.pool) T.push(F(70, 20, 10, 16, WASSER, { e: 2 }));
    if (O.teich) T.push(F(-34, 26, 16, 10, WASSER, { e: 2, rund: true }));
    if (O.fussball) T.push(S('Fußballstadion', rand.x1 + 60, -30, 70, 86, 16, { form: 'eckig', dach: 'ring', farbe: 0xc84a3a, sitz: 0x3a5a9a, wiese: true }));
    if (O.dazu && !(O.dazu.name.includes('Hotel') || O.dazu.name.includes('Clubhaus'))) T.push(INFO(O.dazu.name, gross ? 78 : 66, gross ? 30 : 40, O.dazu.text, 'w'));
    T.push(B(baum, { linie: [rand.x0 + 3, rand.z1 - 3, rand.x1 - 3, rand.z1 - 3], n: 14 }), B(baum, { linie: [rand.x0 + 3, rand.z0 + 4, rand.x0 + 3, rand.z1 - 8], n: 10 }), B(baum, { linie: [rand.x1 - 3, rand.z0 + 4, rand.x1 - 3, rand.z1 - 8], n: 10 }),
      B(baum, { linie: [10 * k, 26 * k, 30 * k, 26 * k], n: 3 }));
  }
  // ---- Zum Schluss: manchmal spiegeln, damit nicht jedes Gelände gleich herum liegt ----
  const teile = zf() < 0.5 ? T : T.map(spiegeln);
  // so viele Besucher laufen herum: beim ITF-Turnier fast keiner, beim ATP 500 viele
  // Wie sehen die Häuser aus? Das richtet sich nach dem Land (für die 3D-Modelle in gelaendemodelle.js)
  const stil = holz || land.includes('alpen') ? 'alpen' : sued ? 'mittelmeer' : land.includes('wueste') ? 'wueste' : ENGLAND.includes(stadt) ? 'england'
    : def.erdteil === 'na' ? 'usa' : def.erdteil === 'as' ? 'asien' : def.erdteil === 'eu' ? (stufe >= 2 ? 'modern' : 'europa') : 'modern';
  return { name: liga ? name : name.replace('Tennisclub Zu Hause', 'Dein Verein'), stadt: def.name || stadt, rand, umland, boden, feld, kamW, leute: [10, 40, 90, 130][stufe], klein: true, stufe, stil, um, fichte: winter || land.includes('alpen'), teile };
}

// Einen Baustein an der Mitte spiegeln (Osten und Westen tauschen)
function spiegeln(el) {
  const n = { ...el };
  if (typeof el.x === 'number') n.x = -el.x;
  if (el.linie) n.linie = [-el.linie[0], el.linie[1], -el.linie[2], el.linie[3]];
  if (el.feld && el.a === 'baeume') n.feld = [-el.feld[0], el.feld[1], el.feld[2], el.feld[3]];
  if (el.p) n.p = el.p.map((q) => [-q[0], ...q.slice(1)]);
  const seite = (s) => (s === 'o' ? 'w' : s === 'w' ? 'o' : s);
  // Bei Türen an der Nord- oder Südwand wandert auch die Verschiebung an der Wand entlang auf die andere Seite
  const tuerDrehen = (t, s) => ({ s: seite(s), v: (s === 'o' || s === 'w') ? t.v : -(t.v || 0) });
  if (el.tuer || el.ort || el.info) { const d = tuerDrehen({ v: el.v }, el.tuer || 's'); n.tuer = d.s; if (el.v) n.v = d.v; }
  if (el.tueren) n.tueren = el.tueren.map((t) => ({ ...t, ...tuerDrehen(t, t.s || 's') }));
  if (el.a === 'berge' && (el.seite === 'w' || el.seite === 'o')) n.seite = seite(el.seite);
  if (el.dreh === 90 || el.dreh === 270) n.dreh = 360 - el.dreh;
  return n;
}
