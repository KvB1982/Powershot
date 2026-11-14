// Powershot – Daten: Spieler, Turniere, Ausrüstung, Schwierigkeit
// Die Fähigkeitswerte der echten Spieler sind frei geschätzt (nur fürs Spiel).

// Weltrangliste Top 20, Stand 9. November 2026
// Werte: s = Aufschlag, p = Kraft, t = Tempo, c = Präzision, v = Volley
const TOP20 = [
  ['zverev', 'Alexander Zverev', 'GER', 9550, 95, 90, 84, 90, 78, 1, 0xf0c8a0, 0xc9a45c, 0xffffff, 0x1a1a1a, 'band'],
  ['sinner', 'Jannik Sinner', 'ITA', 9450, 90, 95, 90, 94, 80, 1, 0xf3cfb0, 0xc8642a, 0x1f6f43, 0xffffff, 'cap'],
  ['alcaraz', 'Carlos Alcaraz', 'ESP', 7100, 86, 93, 96, 91, 90, 1, 0xe2b48c, 0x2b1d14, 0xf2e85c, 0x202020, 'none'],
  ['shelton', 'Ben Shelton', 'USA', 5170, 97, 90, 85, 80, 82, -1, 0xc99872, 0x3a2a1c, 0x2e6fd8, 0xffffff, 'none'],
  ['medvedev', 'Daniil Medvedev', 'RUS', 3820, 88, 82, 88, 92, 72, 1, 0xf0c8a0, 0x8a6a45, 0x7fd0e8, 0x20304a, 'none'],
  ['cobolli', 'Flavio Cobolli', 'ITA', 3680, 80, 85, 90, 83, 74, 1, 0xe8bd98, 0x3a2a1c, 0xe84a3a, 0x1a1a1a, 'cap'],
  ['fils', 'Arthur Fils', 'FRA', 3625, 86, 91, 88, 80, 76, 1, 0x8a5a3c, 0x1a1410, 0xffffff, 0x1f3f8f, 'band'],
  ['tiafoe', 'Frances Tiafoe', 'USA', 3390, 84, 86, 90, 79, 85, 1, 0x7a4a30, 0x14100c, 0xff7a2a, 0x1a1a1a, 'band'],
  ['deminaur', 'Alex de Minaur', 'AUS', 3370, 76, 78, 98, 88, 80, 1, 0xeec4a0, 0x4a3524, 0x1fb87a, 0xffffff, 'cap'],
  ['fritz', 'Taylor Fritz', 'USA', 3285, 93, 90, 78, 85, 74, 1, 0xf0c8a0, 0x5a4028, 0x1a1a1a, 0x1a1a1a, 'band'],
  ['jodar', 'Rafael Jodar', 'ESP', 3234, 82, 86, 86, 82, 74, 1, 0xe6ba94, 0x2b1d14, 0xd83a3a, 0xffffff, 'none'],
  ['djokovic', 'Novak Djokovic', 'SRB', 2940, 86, 84, 84, 96, 84, 1, 0xeac09a, 0x2a2420, 0x2a4ab8, 0xffffff, 'none'],
  ['paul', 'Tommy Paul', 'USA', 2925, 82, 82, 92, 85, 82, 1, 0xf0c8a0, 0x6a4a2c, 0xffffff, 0xc82a2a, 'cap'],
  ['fauger', 'Felix Auger-Aliassime', 'CAN', 2875, 93, 88, 84, 80, 80, 1, 0x9a6a48, 0x1a1410, 0xe82a4a, 0xffffff, 'none'],
  ['lehecka', 'Jiri Lehecka', 'CZE', 2540, 88, 90, 84, 80, 76, 1, 0xf0c8a0, 0x5a4028, 0x3a8ad8, 0x1a1a1a, 'cap'],
  ['mensik', 'Jakub Mensik', 'CZE', 2500, 94, 87, 80, 79, 76, 1, 0xf0c8a0, 0x7a5a38, 0xb8e84a, 0x1a1a1a, 'none'],
  ['davidovich', 'Alejandro Davidovich Fokina', 'ESP', 2500, 76, 84, 90, 82, 78, 1, 0xeac09a, 0xb89a5c, 0xff9a2a, 0x202020, 'band'],
  ['ruud', 'Casper Ruud', 'NOR', 2435, 82, 88, 84, 86, 70, 1, 0xf2ccaa, 0xb8935a, 0x9a3ad8, 0xffffff, 'cap'],
  ['nakashima', 'Brandon Nakashima', 'USA', 2360, 84, 82, 82, 84, 74, 1, 0xe6c09a, 0x1a1410, 0x2ab8b8, 0x1a1a1a, 'none'],
  ['cerundolo', 'Francisco Cerundolo', 'ARG', 2220, 76, 88, 84, 82, 70, 1, 0xe8bd98, 0x3a2a1c, 0x7ac8ff, 0xffffff, 'band'],
];

export const FLAGS = {
  GER: '🇩🇪', ITA: '🇮🇹', ESP: '🇪🇸', USA: '🇺🇸', RUS: '🏳️', FRA: '🇫🇷', AUS: '🇦🇺', SRB: '🇷🇸', CAN: '🇨🇦',
  CZE: '🇨🇿', NOR: '🇳🇴', ARG: '🇦🇷', GBR: '🇬🇧', POL: '🇵🇱', GRE: '🇬🇷', DEN: '🇩🇰', BRA: '🇧🇷', CHN: '🇨🇳',
  JPN: '🇯🇵', NED: '🇳🇱', SUI: '🇨🇭', AUT: '🇦🇹', BEL: '🇧🇪', CRO: '🇭🇷', CHI: '🇨🇱', KAZ: '🇰🇿', POR: '🇵🇹',
  HUN: '🇭🇺', SWE: '🇸🇪', FIN: '🇫🇮',
};

function mk(a, rank) {
  const [id, name, country, points, s, p, t, c, v, hand, skin, hair, shirt, shorts, head] = a;
  const parts = name.split(' ');
  return {
    id, name, country, rank, basePoints: points, real: true,
    short: parts[parts.length - 1] === 'Fokina' ? 'Davidovich F.' : parts.slice(1).join(' '),
    stats: { s, p, t, c, v }, hand,
    look: { skin, hair, shirt, shorts, head, shoes: 0xffffff, racket: 0x202020 },
  };
}

// Erfundene Spieler für die Plätze 21–100
const VOR = ['Luca', 'Mateo', 'Jonas', 'Hugo', 'Leo', 'Nils', 'Marco', 'Pavel', 'Tomas', 'Erik',
  'Diego', 'Kenji', 'Milan', 'Oskar', 'Rui', 'Anton', 'Felipe', 'Jan', 'Noel', 'Viktor'];
const NACH = ['Bergström', 'Castellan', 'Novotny', 'Vandermeer', 'Okafor', 'Lindqvist', 'Moreau', 'Ferrand',
  'Kowalczyk', 'Bianchetti', 'Hartwig', 'Soriano', 'Takeda', 'Petrovan', 'Albrecht', 'Duarte', 'Keller',
  'Marchetti', 'Sandoval', 'Nyberg'];
const LAND = ['SWE', 'ESP', 'CZE', 'NED', 'GBR', 'FIN', 'FRA', 'BEL', 'POL', 'ITA', 'GER', 'ARG', 'JPN', 'CRO',
  'AUT', 'POR', 'SUI', 'CHI', 'DEN', 'HUN', 'BRA', 'KAZ', 'AUS', 'USA', 'CAN', 'GRE'];
const HEMDEN = [0xe84a3a, 0x2e6fd8, 0xffffff, 0x1fb87a, 0xf2e85c, 0x9a3ad8, 0xff7a2a, 0x2ab8b8, 0x1a1a1a, 0xe82a8a];
const HAUT = [0xf0c8a0, 0xe2b48c, 0xc99872, 0x9a6a48, 0x7a4a30, 0xf3cfb0];
const HAAR = [0x2b1d14, 0x5a4028, 0xb8935a, 0x1a1410, 0x8a6a45, 0xc8642a];

function filler(i) {
  const rank = 21 + i;
  const name = VOR[(i * 7 + 3) % 20] + ' ' + NACH[(i * 3 + Math.floor(i / 20) * 5) % 20];
  const base = 80 - i * 0.27;                       // Platz 21 ≈ 80, Platz 100 ≈ 59
  const w = (k) => Math.round(Math.max(45, Math.min(92, base + (((i * 37 + k * 53) % 13) - 6))));
  return {
    id: 'f' + rank, name, country: LAND[(i * 5 + 1) % LAND.length], rank, real: false,
    short: name.split(' ')[1],
    basePoints: Math.round(2200 * Math.pow(20 / rank, 1.25)),
    stats: { s: w(1), p: w(2), t: w(3), c: w(4), v: w(5) },
    hand: i % 9 === 4 ? -1 : 1,
    look: {
      skin: HAUT[i % HAUT.length], hair: HAAR[(i * 5) % HAAR.length], shirt: HEMDEN[i % HEMDEN.length],
      shorts: i % 3 === 0 ? 0xffffff : 0x1a1a1a, head: ['none', 'cap', 'band'][i % 3], shoes: 0xffffff, racket: 0x202020,
    },
  };
}

export const PLAYERS = [...TOP20.map((a, i) => mk(a, i + 1)), ...Array.from({ length: 80 }, (_, i) => filler(i))];
export const TOP_PLAYERS = PLAYERS.slice(0, 20);
export const playerById = (id) => PLAYERS.find((p) => p.id === id);
export const overall = (st) => Math.round((st.s + st.p + st.t + st.c + st.v) / 5);

export const STAT_NAMES = { s: 'Aufschlag', p: 'Kraft', t: 'Tempo', c: 'Präzision', v: 'Volley' };

// ---------------------------------------------------------------
// Turniere der Saison (Grand Slams, Masters 1000, ATP Finals)
// ---------------------------------------------------------------
const GS_P = { W: 2000, F: 1300, SF: 800, QF: 400, R16: 200, R32: 50 };
const M_P = { W: 1000, F: 650, SF: 400, QF: 200, R16: 30 };
const GS_M = { W: 3000000, F: 1600000, SF: 800000, QF: 430000, R16: 250000, R32: 120000 };
const M_M = { W: 1100000, F: 600000, SF: 330000, QF: 180000, R16: 90000 };

const T = (id, name, city, month, cat, surface, theme) => ({
  id, name, city, month, cat, surface, theme,
  draw: cat === 'GS' ? 32 : cat === 'M' ? 16 : 8,
  points: cat === 'GS' ? GS_P : M_P, money: cat === 'GS' ? GS_M : M_M,
  catName: cat === 'GS' ? 'Grand Slam' : cat === 'M' ? 'Masters 1000' : 'ATP Finals',
});

// theme: Farben des Stadions (court = Spielfeld, outer = Auslauf, wall = Bande, seats = Tribüne)
export const TOURNAMENTS = [
  T('ao', 'Australian Open', 'Melbourne', 'Januar', 'GS', 'hard', { court: 0x2f6fc4, outer: 0x1f4f9c, wall: 0x143a78, seats: 0x2a5aa8, sky: 0x6fb4ff, night: false }),
  T('iw', 'Indian Wells', 'Indian Wells', 'März', 'M', 'hard', { court: 0x5a4a9c, outer: 0x3f8a5a, wall: 0x2a6a44, seats: 0x7a6a50, sky: 0x8fc8ff, night: false }),
  T('mia', 'Miami Open', 'Miami', 'März', 'M', 'hard', { court: 0x4a3a8c, outer: 0x2a8a9a, wall: 0x1a5a6a, seats: 0x2a7a8a, sky: 0x7fc0ff, night: false }),
  T('mc', 'Monte-Carlo Masters', 'Monte-Carlo', 'April', 'M', 'clay', { court: 0xc8643a, outer: 0xb85a34, wall: 0x1a3a5a, seats: 0x8a8a90, sky: 0x8fd0ff, night: false }),
  T('mad', 'Madrid Open', 'Madrid', 'Mai', 'M', 'clay', { court: 0xc96a40, outer: 0xb85e38, wall: 0x3a3a40, seats: 0x5a5a62, sky: 0x9fccf0, night: false }),
  T('rom', 'Rom Masters', 'Rom', 'Mai', 'M', 'clay', { court: 0xc4603a, outer: 0xb45632, wall: 0x2a5a3a, seats: 0xb8b0a0, sky: 0x9fd0ff, night: false }),
  T('rg', 'Roland Garros', 'Paris', 'Juni', 'GS', 'clay', { court: 0xcc6a3c, outer: 0xbc5e36, wall: 0x1f5a3a, seats: 0x2a6a4a, sky: 0xa8d0f0, night: false }),
  T('wim', 'Wimbledon', 'London', 'Juli', 'GS', 'grass', { court: 0x4a9a3c, outer: 0x3f8a34, wall: 0x1a4a2a, seats: 0x2a5a3a, sky: 0xb8d4e8, night: false }),
  T('can', 'Canadian Open', 'Toronto', 'August', 'M', 'hard', { court: 0x2a66b8, outer: 0x3a7a9a, wall: 0x1a3a6a, seats: 0x3a5a8a, sky: 0x7fb8f0, night: false }),
  T('cin', 'Cincinnati Open', 'Cincinnati', 'August', 'M', 'hard', { court: 0x2a5aa8, outer: 0x2a8a6a, wall: 0x1a4a5a, seats: 0x5a6a7a, sky: 0x8fc0f8, night: false }),
  T('uso', 'US Open', 'New York', 'September', 'GS', 'hard', { court: 0x2f5fb0, outer: 0x3f8a4a, wall: 0x14285a, seats: 0x1f3a7a, sky: 0x0a1228, night: true }),
  T('sha', 'Shanghai Masters', 'Shanghai', 'Oktober', 'M', 'hard', { court: 0x3a4aa8, outer: 0x2a6a8a, wall: 0x6a1a2a, seats: 0x7a2a3a, sky: 0x1a2038, night: true }),
  T('par', 'Paris Masters', 'Paris', 'November', 'M', 'indoor', { court: 0x2a3a6a, outer: 0x1a1a22, wall: 0x101014, seats: 0x2a2a34, sky: 0x06060a, night: true }),
  T('fin', 'ATP Finals', 'Turin', 'November', 'F', 'indoor', { court: 0x1f5fb8, outer: 0x0f1a3a, wall: 0x0a0a14, seats: 0x1a1a2a, sky: 0x04040a, night: true }),
];
export const tournamentById = (id) => TOURNAMENTS.find((t) => t.id === id);
export const FINALS_POINTS = { RR: 200, SF: 400, F: 500 };
export const FINALS_MONEY = { RR: 400000, SF: 1100000, F: 2200000 };

export const SURFACE_NAMES = { hard: 'Hartplatz', clay: 'Sand', grass: 'Rasen', indoor: 'Halle' };
export const ROUND_NAMES = { R32: '1. Runde', R16: 'Achtelfinale', QF: 'Viertelfinale', SF: 'Halbfinale', F: 'Finale', W: 'Sieg', RR: 'Gruppenphase' };

// ---------------------------------------------------------------
// Ausrüstung (erfundene Marken). bonus = Pluspunkte auf die Fähigkeiten
// ---------------------------------------------------------------
export const SHOP = [
  { id: 'r1', cat: 'Schläger', name: 'Blitz 100', price: 150000, bonus: { p: 2, c: 1 }, color: 0xe84a3a },
  { id: 'r2', cat: 'Schläger', name: 'Tornado Tour', price: 600000, bonus: { p: 4, c: 2 }, color: 0x2e6fd8 },
  { id: 'r3', cat: 'Schläger', name: 'Präzisa Pro', price: 600000, bonus: { p: 2, c: 4 }, color: 0xf2e85c },
  { id: 'r4', cat: 'Schläger', name: 'Donner X Elite', price: 2500000, bonus: { p: 6, c: 5, s: 2 }, color: 0xff7a2a },
  { id: 's1', cat: 'Saiten', name: 'Kontroll-Saite', price: 80000, bonus: { c: 2 }, },
  { id: 's2', cat: 'Saiten', name: 'Power-Saite', price: 80000, bonus: { p: 1, s: 1 } },
  { id: 's3', cat: 'Saiten', name: 'Spin-Saite Pro', price: 450000, bonus: { c: 3, s: 2 } },
  { id: 's4', cat: 'Saiten', name: 'Darm-Saite Tour', price: 1600000, bonus: { c: 4, s: 3, v: 2 } },
  { id: 'h1', cat: 'Schuhe', name: 'Sprint Light', price: 120000, bonus: { t: 2 }, color: 0xff4a4a },
  { id: 'h2', cat: 'Schuhe', name: 'Court Racer', price: 500000, bonus: { t: 4 }, color: 0x2af0a0 },
  { id: 'h3', cat: 'Schuhe', name: 'Gepard Pro', price: 2000000, bonus: { t: 7 }, color: 0xf0d02a },
  { id: 'z1', cat: 'Zubehör', name: 'Griffband Tacky', price: 40000, bonus: { v: 2 } },
  { id: 'z2', cat: 'Zubehör', name: 'Schweißband-Set', price: 200000, bonus: { v: 2, c: 1 } },
  { id: 'z3', cat: 'Zubehör', name: 'Dämpfer & Profi-Griff', price: 900000, bonus: { v: 4, s: 2 } },
];
export const SHOP_CATS = ['Schläger', 'Saiten', 'Schuhe', 'Zubehör'];
export const shopById = (id) => SHOP.find((s) => s.id === id);

// ---------------------------------------------------------------
// Schwierigkeit: ai = Faktoren für den Gegner, me = Hilfen für dich
// ---------------------------------------------------------------
export const DIFFICULTY = {
  leicht: { name: 'Leicht', aiStat: 0.74, aiSigma: 1.7, aiReact: 0.33, meSigma: 0.3, meNet: 0, clampIn: true, autoReturn: true, marker: true },
  mittel: { name: 'Mittel', aiStat: 0.86, aiSigma: 1.3, aiReact: 0.27, meSigma: 0.6, meNet: 0.3, clampIn: true, autoReturn: false, marker: true },
  schwer: { name: 'Schwer', aiStat: 0.94, aiSigma: 1.0, aiReact: 0.22, meSigma: 1.0, meNet: 1, clampIn: false, autoReturn: false, marker: true },
  profi: { name: 'Profi', aiStat: 1.0, aiSigma: 0.9, aiReact: 0.18, meSigma: 1.0, meNet: 1, clampIn: false, autoReturn: false, marker: false },
};

// Matchlänge: sets = Gewinnsätze, games = Spiele pro Satz
export const LENGTHS = {
  kurz: { name: 'Kurz (1 Satz bis 3)', sets: 1, games: 3 },
  mittel: { name: 'Mittel (2 Gewinnsätze bis 4)', sets: 2, games: 4 },
  echt: { name: 'Echt (2 Gewinnsätze bis 6)', sets: 2, games: 6 },
};
