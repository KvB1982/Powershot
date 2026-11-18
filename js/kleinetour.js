// Powershot – Die kleine Tour: ITF-Turniere, Challenger, ATP 250 und ATP 500.
//
// So läuft es bei den echten Profis: Niemand fängt in Wimbledon an. Zuerst spielt man ganz kleine
// Turniere (ITF), dann Challenger, dann die kleineren ATP-Turniere – und erst mit einem guten
// Weltranglistenplatz darf man zu den Masters und Grand Slams.
//
// Diese Datei enthält nur Listen und Zahlen (kein three.js). Hier kannst du gut selbst etwas ändern.
import { WOCHEN } from './kalender.js';
import { achtWerte } from './faehigkeiten.js';
//
// Was ist echt, was geschätzt?
//   echt:      Ranglistenpunkte pro Runde (ATP-Regeln), Namen der Turnierstufen, die Orte gibt es als Turnierorte wirklich
//   ungefähr:  Preisgeld (echte Größenordnung, gerundet), ab welchem Platz man mitspielen darf
//   echt:      die Größe der Felder (32 Spieler, ATP 250: 28 mit 4 Freilosen)

// ---------------------------------------------------------------
// Die Stufen der Tour, von klein nach groß
// ---------------------------------------------------------------
//   bisPlatz  = so gut muss dein Weltranglistenplatz mindestens sein, damit du mitspielen darfst
//   hotel     = true: Du musst dein Hotel selbst bezahlen. Ab den Challengern zahlt es das Turnier (das ist wirklich so!)
//   zuschauer = wie voll die Tribüne ist (1 = voll). Bei ITF-Turnieren schaut fast niemand zu.
//   staerke   = so stark sind die erfundenen Nachwuchsspieler dort (von … bis …)
//   draw      = so viele Spieler spielen mit (wie in echt: 32, bei ATP 250 meist 28 – dann haben die 4 Besten ein Freilos)
//   setz      = so viele Spieler sind gesetzt
//   abPlatz   = wer besser steht als dieser Platz, fährt zu so einem kleinen Turnier nicht mehr hin (geschätzt)
export const STUFEN = {
  M15:  { name: 'ITF M15', cat: 'ITF', draw: 32, setz: 8, bisPlatz: 9999, abPlatz: 420, hotel: true, zuschauer: 0.06, staerke: [38, 50],
    points: { W: 15, F: 8, SF: 4, QF: 2, R16: 1, R32: 0 }, money: { W: 2160, F: 1272, SF: 753, QF: 438, R16: 264, R32: 156 } },
  M25:  { name: 'ITF M25', cat: 'ITF', draw: 32, setz: 8, bisPlatz: 1000, abPlatz: 280, hotel: true, zuschauer: 0.1, staerke: [43, 54],
    points: { W: 25, F: 14, SF: 7, QF: 3, R16: 1, R32: 0 }, money: { W: 4320, F: 2544, SF: 1506, QF: 876, R16: 528, R32: 312 } },
  CH75: { name: 'Challenger 75', cat: 'CH', draw: 32, setz: 8, bisPlatz: 500, abPlatz: 110, hotel: false, zuschauer: 0.3, staerke: [48, 58],
    points: { W: 75, F: 44, SF: 22, QF: 12, R16: 6, R32: 0 }, money: { W: 14200, F: 8400, SF: 5000, QF: 2900, R16: 1700, R32: 1000 } },
  CH100: { name: 'Challenger 100', cat: 'CH', draw: 32, setz: 8, bisPlatz: 330, abPlatz: 80, hotel: false, zuschauer: 0.4, staerke: [51, 60],
    points: { W: 100, F: 50, SF: 25, QF: 14, R16: 7, R32: 0 }, money: { W: 22700, F: 13400, SF: 8000, QF: 4650, R16: 2700, R32: 1600 } },
  CH125: { name: 'Challenger 125', cat: 'CH', draw: 32, setz: 8, bisPlatz: 270, abPlatz: 60, hotel: false, zuschauer: 0.45, staerke: [53, 61],
    points: { W: 125, F: 64, SF: 35, QF: 16, R16: 8, R32: 0 }, money: { W: 28400, F: 16700, SF: 9900, QF: 5800, R16: 3400, R32: 2000 } },
  CH175: { name: 'Challenger 175', cat: 'CH', draw: 32, setz: 8, bisPlatz: 210, abPlatz: 50, hotel: false, zuschauer: 0.5, staerke: [55, 62],
    points: { W: 175, F: 90, SF: 50, QF: 25, R16: 13, R32: 0 }, money: { W: 42600, F: 25000, SF: 14800, QF: 8600, R16: 5000, R32: 3000 } },
  A250: { name: 'ATP 250', cat: 'A250', draw: 28, setz: 8, bisPlatz: 110, abPlatz: 0, hotel: false, zuschauer: 0.7,
    points: { W: 250, F: 165, SF: 100, QF: 50, R16: 25, R32: 0 }, money: { W: 105000, F: 61000, SF: 36000, QF: 21000, R16: 12000, R32: 7000 } },
  A500: { name: 'ATP 500', cat: 'A500', draw: 32, setz: 8, bisPlatz: 60, abPlatz: 0, hotel: false, zuschauer: 0.85,
    points: { W: 500, F: 330, SF: 200, QF: 100, R16: 50, R32: 0 }, money: { W: 480000, F: 258000, SF: 138000, QF: 70000, R16: 37500, R32: 20000 } },
};
// Für die großen Turniere (stehen in data.js): ab welchem Platz darf man mitspielen?
export const BIS_PLATZ_GROSS = { M: 76, GS: 104 };

// ---------------------------------------------------------------
// Erdteile – wichtig für die Flugkosten
// ---------------------------------------------------------------
export const ERDTEILE = { eu: 'Europa', af: 'Nordafrika', na: 'Nordamerika', sa: 'Südamerika', as: 'Asien', au: 'Australien' };
// Wo liegen die großen Turniere?
export const ERDTEIL_GROSS = { ao: 'au', iw: 'na', mia: 'na', mc: 'eu', mad: 'eu', rom: 'eu', rg: 'eu', wim: 'eu', can: 'na', cin: 'na', uso: 'na', sha: 'as', par: 'eu', fin: 'eu' };
// Wo wohnt dein Spieler? (alle Länder, die hier nicht stehen: Europa)
export const HEIMAT = { USA: 'na', CAN: 'na', ARG: 'sa', BRA: 'sa', AUS: 'au', JPN: 'as' };
// Was kostet ein Flug (hin und zurück gerechnet, in Dollar)? Geschätzte, runde Preise.
const FLUG = { 'eu-af': 350, 'eu-na': 800, 'eu-sa': 1000, 'eu-as': 900, 'eu-au': 1500, 'af-na': 1000, 'af-sa': 1100, 'af-as': 800, 'af-au': 1400,
  'na-sa': 700, 'na-as': 1100, 'na-au': 1400, 'sa-as': 1500, 'sa-au': 1500, 'as-au': 800 };
export const FLUG_NAH = 180;          // Zug oder kurzer Flug im selben Erdteil
export const flugPreis = (von, nach) => (von === nach ? FLUG_NAH : FLUG[von + '-' + nach] || FLUG[nach + '-' + von] || 1000);
export const HOTEL_WOCHE = 480;       // eine Woche Hotel bei einem ITF-Turnier
export const ESSEN_WOCHE = 150;       // Essen, Taxi, Wäsche …

// ---------------------------------------------------------------
// Die kleinen Turniere: Welche es in welcher Woche gibt, steht im Kalender (kalender.js)
// ---------------------------------------------------------------
// Farben des Platzes je nach Belag (kleine Turniere haben einfachere Plätze)
const FARBEN = {
  hard: { court: 0x2f6aa8, outer: 0x3a7a5a, wall: 0x1f3a5a, seats: 0x6a7078, sky: 0x8fc4f8, night: false },
  clay: { court: 0xc8683c, outer: 0xb85c36, wall: 0x2a4a34, seats: 0x7a7468, sky: 0x9fd0f8, night: false },
  grass: { court: 0x4a9a3c, outer: 0x3f8a34, wall: 0x1f4a2a, seats: 0x5a6a5a, sky: 0xb4d4ec, night: false },
  indoor: { court: 0x2a4a7a, outer: 0x1c1c26, wall: 0x14141a, seats: 0x2c2c36, sky: 0x08080c, night: true },
};

export const KLEINE_TURNIERE = WOCHEN.flatMap((w) => w.klein.map(({ stufe, city, erdteil, surface }, i) => {
  const S = STUFEN[stufe];
  return {
    id: 'k' + w.nr + '_' + i, woche: w.nr, stufe, name: (S.cat === 'ITF' ? stufe + ' ' : '') + city + (S.cat === 'CH' ? ' Challenger' : S.cat === 'ITF' ? '' : ' Open'),
    city, erdteil, surface, cat: S.cat, catName: S.name, draw: S.draw, setz: S.setz, points: S.points, money: S.money,
    bisPlatz: S.bisPlatz, abPlatz: S.abPlatz, hotel: S.hotel, zuschauer: S.zuschauer, theme: FARBEN[surface], klein: true,
  };
}));

// Liga-Spiel für deinen Verein: ein einziges Match zu Hause. Kein Flug, keine Punkte – aber Geld.
// (Viele echte Profis spielen nebenbei in der deutschen oder französischen Liga, um ihre Reisen zu bezahlen.)
export const LIGA = {
  id: 'liga', name: 'Liga-Spiel für deinen Verein', city: 'Zu Hause', surface: 'clay', cat: 'LIGA', catName: 'Liga', draw: 2,
  points: { W: 0, F: 0 }, money: { W: 900, F: 350 }, zuschauer: 0.12, theme: FARBEN.clay, klein: true, staerke: [42, 56],
};
export const STUNDEN_GELD = 600;      // so viel verdienst du in einer Woche als Tennislehrer

// ---------------------------------------------------------------
// Nachwuchsspieler (alle erfunden!) – deine Gegner bei ITF-Turnieren und Challengern
// ---------------------------------------------------------------
// Die echten Spieler im Spiel sind die Top 200 (data.js). Die Nachwuchsspieler hier haben wir uns ausgedacht.
const NAMEN = `Jonas|Kessler;GER
Luca|Brandtner;AUT
Mateo|Rivas Soler;ESP
Théo|Marchandet;FRA
Piotr|Zalewicz;POL
Marco|Bellandi;ITA
Tomás|Echaniz;ARG
Noah|Whitcombe;GBR
Kenji|Morikawa;JPN
Lukas|Hadraba;CZE
Felipe|Arantes;BRA
Dylan|Hargrove;USA
Sven|Lindqvist;SWE
Nikos|Stavridis;GRE
Ivo|Marasović;CRO
Jannis|Oltmanns;GER
Hugo|Delacroze;FRA
Rui|Pimentel;POR
Emil|Aaltonen;FIN
Bastian|Rütli;SUI
Daan|Verhoeven;NED
Miloš|Petrašin;SRB
Oliver|Castellan;AUS
Zhao|Wenbo;CHN
Marek|Dubnický;SVK
Liam|Tremblay;CAN
Santiago|Olmedo;CHI
Andrea|Fontanesi;ITA
Bence|Kardos;HUN
Erik|Solheim;NOR
Maximilian|Trautwein;GER
Pablo|Guerrica;ESP
Arthur|Vandenbroek;BEL
Kasper|Nyholm;DEN
Ryo|Tachibana;JPN
Cole|Maddison;USA
Timur|Akhmetbek;KAZ
Julien|Roussard;FRA
Fabian|Engelhart;GER
Nicolás|Peralta;ARG`;
const HEMD = [0xe84a3a, 0x2e6fd8, 0xffffff, 0x1fb87a, 0xf2e85c, 0x9a3ad8, 0xff7a2a, 0x2ab8b8, 0x1a1a1a];
const HAUT = [0xf0c8a0, 0xe2b48c, 0xeac09a, 0xc99872, 0xf3cfb0, 0x9a6a48];
const HAAR = [0x2b1d14, 0x5a4028, 0xb8935a, 0x1a1410, 0x8a6a45, 0x3a2a1c];
const FIGUR = ['a', 'c', 'd', 'f', 'e', 'b'];

// Hinter den Top 200 stehen in echt noch rund 2000 weitere Spieler. So hängen dort Punkte und Platz ungefähr zusammen:
// [Punkte, Platz]. (Der echten Rangliste grob nachempfunden: Mit 100 Punkten steht man ungefähr auf Platz 400.)
export const KURVE = [[0, 2000], [1, 1700], [4, 1300], [10, 1000], [20, 800], [40, 600], [60, 500], [100, 400], [150, 320], [220, 250], [300, 200], [400, 160], [500, 130]];
function punkteFuerPlatz(platz) {
  for (let i = 1; i < KURVE.length; i++) {
    const [p0, r0] = KURVE[i - 1], [p1, r1] = KURVE[i];
    if (platz >= r1) return Math.round(p0 + (p1 - p0) * (r0 - platz) / (r0 - r1));
  }
  return 500;
}

// Aus 40 Vornamen und 40 Nachnamen werden 400 Spieler: Die Namen werden immer wieder neu zusammengesetzt.
export const NACHWUCHS_ZAHL = 400;
const VOR = NAMEN.split('\n').map((z) => z.split('|')[0]);
const NACH = NAMEN.split('\n').map((z) => z.split('|')[1].split(';'));
export const NACHWUCHS = Array.from({ length: NACHWUCHS_ZAHL }, (_, i) => {
  const first = VOR[i % 40], [last, country] = NACH[(i % 40 + 7 * Math.floor(i / 40)) % 40];
  // Die Liste ist bunt gemischt. x sagt, wie gut der Spieler ist: 0 = der Beste, 1 = der Schwächste.
  // Es gibt viel mehr schwächere als starke Spieler – wie in echt.
  const x = ((i * 17) % NACHWUCHS_ZAHL) / (NACHWUCHS_ZAHL - 1);
  const base = 38 + 21 * Math.pow(1 - x, 1.6);
  const rank = Math.round(215 + 1400 * Math.pow(x, 1.3));               // ungefährer Weltranglistenplatz zu Beginn
  const stark = 'sptcv'[i % 5];
  const w = (key, n) => Math.round(base + (((i * 31 + n * 47) % 7) - 3) + (key === stark ? 5 : -1));
  const model = FIGUR[i % 6];
  return {
    id: 'nw' + i, name: first + ' ' + last, short: last, country, erfunden: true,
    rank, basePoints: punkteFuerPlatz(rank),
    stats: achtWerte({ s: w('s', 1), p: w('p', 2), t: w('t', 3), c: w('c', 4), v: w('v', 5) }, i),
    hand: i % 8 === 3 ? -1 : 1,
    look: {
      skin: HAUT[(i * 5 + 1) % HAUT.length], hair: HAAR[(i * 7 + 2) % HAAR.length], shirt: HEMD[(i * 4 + 3) % HEMD.length],
      shorts: i % 3 === 0 ? 0xffffff : 0x1a1a1a, head: model === 'e' ? 'cap' : model === 'b' ? 'band' : 'none', model,
      shoes: 0xffffff, racket: 0x202020, bh: i % 9 === 4 ? 1 : 2, pattern: i % 5, trim: i % 2 ? 0xffffff : 0x1a2a4a,
    },
  };
});
