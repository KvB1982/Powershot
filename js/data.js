// Powershot – Daten: Spieler, Turniere, Schwierigkeit (Ausrüstung: ausruestung.js, kleine Turniere: kleinetour.js)
// Die Namen, Plätze und Punkte der 200 Spieler sind die echte Weltrangliste vom 16. November 2026.
// Die Fähigkeitswerte und das Aussehen sind frei geschätzt (nur fürs Spiel).

import { KLEINE_TURNIERE, LIGA, NACHWUCHS } from './kleinetour.js';
import { STAT_NAMES, STAT_INFO, BONUS_NAMES, achtWerte, gesamt } from './faehigkeiten.js';

// Die besten Spieler mit von Hand eingestellten Werten.
// Werte: s = Aufschlag, p = Kraft, t = Tempo, c = Präzision, v = Volley
// [Platz, id, Name, Land, Punkte, s, p, t, c, v, Schlaghand, Haut, Haare, Hemd, Hose, Kopf]
const STARS = [
  [1, 'zverev', 'Alexander|Zverev', 'GER', 9320, 95, 90, 84, 90, 78, 1, 0xf0c8a0, 0xc9a45c, 0xffffff, 0x1a1a1a, 'band'],
  [2, 'sinner', 'Jannik|Sinner', 'ITA', 7950, 90, 95, 90, 94, 80, 1, 0xf3cfb0, 0xc8642a, 0x1f6f43, 0xffffff, 'cap'],
  [3, 'alcaraz', 'Carlos|Alcaraz', 'ESP', 6100, 86, 93, 96, 91, 90, 1, 0xe2b48c, 0x2b1d14, 0xf2e85c, 0x202020, 'none'],
  [4, 'shelton', 'Ben|Shelton', 'USA', 5170, 97, 90, 85, 80, 82, -1, 0xc99872, 0x3a2a1c, 0x2e6fd8, 0xffffff, 'none'],
  [5, 'medvedev', 'Daniil|Medvedev', 'RUS', 3820, 88, 82, 88, 92, 72, 1, 0xf0c8a0, 0x8a6a45, 0x7fd0e8, 0x20304a, 'none'],
  [6, 'cobolli', 'Flavio|Cobolli', 'ITA', 3680, 80, 85, 90, 83, 74, 1, 0xe8bd98, 0x3a2a1c, 0xe84a3a, 0x1a1a1a, 'cap'],
  [7, 'fils', 'Arthur|Fils', 'FRA', 3625, 86, 91, 88, 80, 76, 1, 0x8a5a3c, 0x1a1410, 0xffffff, 0x1f3f8f, 'none'],
  [8, 'tiafoe', 'Frances|Tiafoe', 'USA', 3390, 84, 86, 90, 79, 85, 1, 0x7a4a30, 0x14100c, 0xff7a2a, 0x1a1a1a, 'band'],
  [9, 'fritz', 'Taylor|Fritz', 'USA', 3300, 93, 90, 78, 85, 74, 1, 0xf0c8a0, 0x5a4028, 0x1a1a1a, 0x1a1a1a, 'band'],
  [10, 'jodar', 'Rafael|Jodar', 'ESP', 3234, 82, 86, 86, 82, 74, 1, 0xe6ba94, 0x2b1d14, 0xd83a3a, 0xffffff, 'none'],
  [11, 'deminaur', 'Alex|de Minaur', 'AUS', 3170, 76, 78, 98, 88, 80, 1, 0xeec4a0, 0x4a3524, 0x1fb87a, 0xffffff, 'cap'],
  [12, 'djokovic', 'Novak|Djokovic', 'SRB', 2940, 86, 84, 84, 96, 84, 1, 0xeac09a, 0x2a2420, 0x2a4ab8, 0xffffff, 'none'],
  [13, 'paul', 'Tommy|Paul', 'USA', 2925, 82, 82, 92, 85, 82, 1, 0xf0c8a0, 0x6a4a2c, 0xffffff, 0xc82a2a, 'cap'],
  [14, 'lehecka', 'Jiri|Lehecka', 'CZE', 2540, 88, 90, 84, 80, 76, 1, 0xf0c8a0, 0x5a4028, 0x3a8ad8, 0x1a1a1a, 'cap'],
  [15, 'mensik', 'Jakub|Mensik', 'CZE', 2500, 94, 87, 80, 79, 76, 1, 0xf0c8a0, 0x7a5a38, 0xb8e84a, 0x1a1a1a, 'none'],
  [16, 'davidovich', 'Alejandro|Davidovich Fokina', 'ESP', 2500, 76, 84, 90, 82, 78, 1, 0xeac09a, 0xb89a5c, 0xff9a2a, 0x202020, 'band'],
  [17, 'fauger', 'Felix|Auger-Aliassime', 'CAN', 2465, 93, 88, 84, 80, 80, 1, 0x9a6a48, 0x1a1410, 0xe82a4a, 0xffffff, 'none'],
  [18, 'ruud', 'Casper|Ruud', 'NOR', 2435, 82, 88, 84, 86, 70, 1, 0xf2ccaa, 0xb8935a, 0x9a3ad8, 0xffffff, 'cap'],
  [19, 'nakashima', 'Brandon|Nakashima', 'USA', 2360, 84, 82, 82, 84, 74, 1, 0xe6c09a, 0x1a1410, 0x2ab8b8, 0x1a1a1a, 'cap'],
  [20, 'cerundolo', 'Francisco|Cerundolo', 'ARG', 2220, 76, 88, 84, 82, 70, 1, 0xe8bd98, 0x3a2a1c, 0x7ac8ff, 0xffffff, 'band'],
  [22, 'tien', 'Learner|Tien', 'USA', 2145, 76, 80, 88, 88, 76, -1, 0xe6c09a, 0x1a1410, 0xffffff, 0x1f3f8f, 'cap'],
];

// Alle anderen Spieler der Top 200: 'Platz;Vorname|Nachname;Land;Punkte;Besonderheit'
// Besonderheit: L = Linkshänder, dazu die Stärke (s, p, t, c oder v). Die Werte werden daraus berechnet.
// Echt sind Name, Platz, Land und Punkte. Die Stärke und die Schlaghand sind bei den hinteren Plätzen oft nur geschätzt.
const REST = `21;Luciano|Darderi;ITA;2160;p
23;Andrey|Rublev;RUS;2085;p
24;Karen|Khachanov;RUS;1980;p
25;Alexander|Bublik;KAZ;1885;s
26;Valentin|Vacherot;MON;1790;s
27;Lorenzo|Musetti;ITA;1785;c
28;Alexander|Blockx;BEL;1640;p
29;Tomas Martin|Etcheverry;ARG;1640;p
30;Hubert|Hurkacz;POL;1625;s
31;Alejandro|Tabilo;CHI;1595;Lc
32;Arthur|Fery;GBR;1507;t
33;Ignacio|Buse;PER;1495;c
34;Luca|van Assche;FRA;1492;t
35;Alex|Michelsen;USA;1480;c
36;Stefanos|Tsitsipas;GRE;1430;v
37;Matteo|Arnaldi;ITA;1321;t
38;Ugo|Humbert;FRA;1320;Lc
39;Jan-Lennard|Struff;GER;1296;s
40;Botic|van de Zandschulp;NED;1280;s
41;Nuno|Borges;POR;1241;c
42;Daniel|Merida;ESP;1237;c
43;Matteo|Berrettini;ITA;1223;s
44;Zizou|Bergs;BEL;1220;t
45;Quentin|Halys;FRA;1214;s
46;Joao|Fonseca;BRA;1200;p
47;Thiago Agustin|Tirante;ARG;1197;p
48;Arthur|Gea;FRA;1146;t
49;Mariano|Navone;ARG;1095;t
50;Tallon|Griekspoor;NED;1075;s
51;Denis|Shapovalov;CAN;1055;Lp
52;Cameron|Norrie;GBR;1045;Lt
53;Sebastian|Baez;ARG;1040;t
54;Juan Manuel|Cerundolo;ARG;1015;Lc
55;Raphael|Collignon;BEL;968;p
56;Adolfo Daniel|Vallejo;PAR;959;t
57;Jaime|Faria;POR;941;s
58;Arthur|Rinderknech;FRA;920;s
59;Rinky|Hijikata;AUS;909;v
60;Tomas|Machac;CZE;899;t
61;Adrian|Mannarino;FRA;898;Lc
62;Mattia|Bellucci;ITA;879;Lv
63;Fabian|Marozsan;HUN;875;c
64;Miomir|Kecmanovic;SRB;871;c
65;Camilo|Ugo Carabelli;ARG;845;t
66;Facundo|Diaz Acosta;ARG;836;Lt
67;Yannick|Hanfmann;GER;835;p
68;Ethan|Quinn;USA;831;s
69;Vit|Kopriva;CZE;828;c
70;Jaume|Munar;ESP;825;t
71;Martin|Landaluce;ESP;822;p
72;Daniel|Altmaier;GER;822;p
73;Alex|Molcan;SVK;820;Lt
74;Roman|Safiullin;RUS;807;p
75;Terence|Atmane;FRA;787;Lp
76;Pablo|Carreno Busta;ESP;773;c
77;James|Duckworth;AUS;772;s
78;Zachary|Svajda;USA;759;c
79;Hamad|Medjedovic;SRB;751;p
80;Roman Andres|Burruchaga;ARG;735;t
81;Titouan|Droguet;FRA;732;s
82;Kamil|Majchrzak;POL;725;c
83;Aleksandar|Kovacevic;USA;693;s
84;Coleman|Wong;HKG;692;p
85;Nikoloz|Basilashvili;GEO;688;p
86;Kyrian|Jacquet;FRA;680;c
87;Jacob|Fearnley;GBR;671;p
88;Marco|Trungelliti;ARG;670;c
89;Dino|Prizmic;CRO;663;c
90;Damir|Dzumhur;BIH;661;t
91;Benjamin|Bonzi;FRA;657;v
92;Toby|Samuel;GBR;647;s
93;Yunchaokete|Bu;CHN;646;p
94;Jenson|Brooksby;USA;638;c
95;Marcos|Giron;USA;638;t
96;Zsombor|Piros;HUN;620;c
97;Adam|Walton;AUS;619;c
98;Michael|Zheng;USA;616;c
99;Marin|Cilic;CRO;613;s
100;Aleksandr|Shevchenko;KAZ;609;c
101;Thiago|Seyboth Wild;BRA;609;p
102;Sebastian|Korda;USA;590;c
103;Martin|Damm;USA;588;Ls
104;Lloyd|Harris;RSA;579;s
105;Jesper|de Jong;NED;575;t
106;Yibing|Wu;CHN;571;p
107;Otto|Virtanen;FIN;570;s
108;Hugo|Dellien;BOL;566;t
109;Corentin|Moutet;FRA;540;Lv
110;Lorenzo|Sonego;ITA;539;s
111;Hugo|Gaston;FRA;530;Lv
112;Jan|Choinski;GBR;527;s
113;Dalibor|Svrcina;CZE;521;t
114;Nicolas|Mejia;COL;521;s
115;Henrique|Rocha;POR;521;p
116;Clement|Chidekh;FRA;512;c
117;Nishesh|Basavareddy;USA;510;c
118;Christopher|O'Connell;AUS;505;c
119;Gustavo|Heide;BRA;504;p
120;Pedro|Martinez;ESP;497;t
121;Jurij|Rodionov;AUT;496;Lp
122;Dane|Sweeny;AUS;493;t
123;Valentin|Royer;FRA;493;p
124;Sebastian|Ofner;AUT;491;p
125;Rei|Sakamoto;JPN;487;s
126;Emilio|Nava;USA;477;p
127;Borna|Gojo;CRO;461;s
128;Sho|Shimabukuro;JPN;457;v
129;Alexei|Popyrin;AUS;448;s
130;Max|Alcala Gurri;ESP;446;c
131;Shintaro|Mochizuki;JPN;444;v
132;Nikolas|Sanchez Izquierdo;ESP;438;t
133;Stefanos|Sakellaridis;GRE;431;s
134;Moise|Kouame;FRA;429;p
135;Grigor|Dimitrov;BUL;422;v
136;Francisco|Comesana;ARG;421;p
137;Laslo|Djere;SRB;419;c
138;Aleksandar|Vukic;AUS;418;s
139;Federico|Cina;ITA;415;c
140;Giovanni|Mpetshi Perricard;FRA;411;s
141;Matej|Dodig;CRO;406;p
142;Andrea|Pellegrino;ITA;404;t
143;Pablo|Llamas Ruiz;ESP;403;t
144;Jerome|Kym;SUI;403;p
145;Tristan|Schoolkate;AUS;401;v
146;Marton|Fucsovics;HUN;400;t
147;Ilia|Simakin;RUS;393;c
148;Vilius|Gaubas;LTU;389;t
149;Elmer|Moller;DEN;386;c
150;Michael|Mmoh;USA;386;t
151;Darwin|Blanch;USA;380;Ls
152;Tom|Gentzsch;GER;363;p
153;Lukas|Neumayer;AUT;362;t
154;Alexandre|Muller;FRA;361;c
155;Jack|Draper;GBR;360;Lp
156;Soonwoo|Kwon;KOR;355;t
157;Zhizhen|Zhang;CHN;354;s
158;Francesco|Passaro;ITA;354;p
159;Dusan|Lajovic;SRB;353;c
160;Andrea|Guerrieri;ITA;349;c
161;Jan|Kumstat;CZE;348;p
162;Francesco|Maestrelli;ITA;346;s
163;Stan|Wawrinka;SUI;343;p
164;Mark|Lajal;EST;343;p
165;Liam|Draxl;CAN;341;t
166;Gabriel|Diallo;CAN;339;s
167;Pavel|Kotov;RUS;339;p
168;Taro|Daniel;JPN;338;c
169;Joel|Schwaerzler;AUT;334;Lp
170;Gauthier|Onclin;BEL;333;c
171;Billy|Harris;GBR;327;s
172;Marco|Cecchinato;ITA;325;c
173;Felix|Balshaw;FRA;324;p
174;Bernard|Tomic;AUS;322;c
175;Stefano|Travaglia;ITA;322;p
176;Nicolai|Budkov Kjaer;NOR;321;s
177;Joao Lucas|Reis Da Silva;BRA;321;t
178;Mika|Brunold;SUI;320;c
179;Lautaro|Midon;ARG;319;t
180;Chris|Rodesch;LUX;317;s
181;Juan Carlos|Prado Angelo;BOL;314;p
182;Guido Ivan|Justo;ARG;308;t
183;Clement|Tabur;FRA;307;t
184;Gonzalo|Bueno;PER;307;t
185;Diego|Dedura;GER;307;Lt
186;Dylan|Dietrich;SUI;304;s
187;Jack|Pinnington Jones;GBR;302;v
188;Keegan|Smith;USA;301;v
189;Inaki|Montes-De La Torre;ESP;300;c
190;Alexis|Galarneau;CAN;297;t
191;Sascha|Gueymard Wayenburg;FRA;290;s
192;David|Jorda Sanchis;ESP;290;c
193;Timofey|Skatov;KAZ;290;t
194;Luka|Pavlovic;FRA;288;Lc
195;Kilian|Feldbausch;SUI;288;c
196;Andre|Ilagan;USA;288;t
197;Juan Pablo|Varillas;PER;288;p
198;August|Holmgren;DEN;286;v
199;Facundo|Mena;ARG;285;p
200;Tristan|Boyer;USA;284;p`;

export const FLAGS = {
  GER: '🇩🇪', ITA: '🇮🇹', ESP: '🇪🇸', USA: '🇺🇸', RUS: '🏳️', FRA: '🇫🇷', AUS: '🇦🇺', SRB: '🇷🇸', CAN: '🇨🇦',
  CZE: '🇨🇿', NOR: '🇳🇴', ARG: '🇦🇷', GBR: '🇬🇧', POL: '🇵🇱', GRE: '🇬🇷', DEN: '🇩🇰', BRA: '🇧🇷', CHN: '🇨🇳',
  JPN: '🇯🇵', NED: '🇳🇱', SUI: '🇨🇭', AUT: '🇦🇹', BEL: '🇧🇪', CRO: '🇭🇷', CHI: '🇨🇱', KAZ: '🇰🇿', POR: '🇵🇹',
  HUN: '🇭🇺', SWE: '🇸🇪', FIN: '🇫🇮', MON: '🇲🇨', PER: '🇵🇪', PAR: '🇵🇾', SVK: '🇸🇰', HKG: '🇭🇰', GEO: '🇬🇪',
  BIH: '🇧🇦', RSA: '🇿🇦', BOL: '🇧🇴', COL: '🇨🇴', BUL: '🇧🇬', LTU: '🇱🇹', KOR: '🇰🇷', EST: '🇪🇪', LUX: '🇱🇺',
};

const HEMDEN = [0xe84a3a, 0x2e6fd8, 0xffffff, 0x1fb87a, 0xf2e85c, 0x9a3ad8, 0xff7a2a, 0x2ab8b8, 0x1a1a1a, 0xe82a8a];
const HAUT = [0xf0c8a0, 0xe2b48c, 0xeac09a, 0xc99872, 0xf3cfb0, 0xe6ba94];
const HAAR = [0x2b1d14, 0x5a4028, 0xb8935a, 0x1a1410, 0x8a6a45, 0x3a2a1c];

// Kurze Namen für die Anzeigetafel: sehr lange Nachnamen werden abgekürzt.
// Gibt es einen Nachnamen zweimal (Cerundolo, Harris), kommt der erste Buchstabe des Vornamens davor.
const KURZ = {
  'Davidovich Fokina': 'Davidovich F.', 'Mpetshi Perricard': 'Mpetshi P.', 'Gueymard Wayenburg': 'Gueymard W.',
  'Montes-De La Torre': 'Montes', 'Sanchez Izquierdo': 'Sanchez I.', 'Pinnington Jones': 'Pinnington J.',
  'Juan Manuel|Cerundolo': 'J. M. Cerundolo', 'Lloyd|Harris': 'L. Harris', 'Billy|Harris': 'B. Harris',
};
function names(full) {
  const [first, last] = full.split('|');
  return { name: first + ' ' + last, short: KURZ[full] || KURZ[last] || last };
}

function star(a) {
  const [rank, id, full, country, points, s, p, t, c, v, hand, skin, hair, shirt, shorts, head] = a;
  return {
    id, ...names(full), country, rank, basePoints: points,
    stats: achtWerte({ s, p, t, c, v }, rank), hand,
    look: { skin, hair, shirt, shorts, head, shoes: 0xffffff, racket: 0x202020 },
  };
}

function other(line) {
  const [rk, full, country, pts, extra] = line.split(';');
  const rank = +rk, i = rank - 21;
  const n = names(full);
  const strong = extra.replace('L', '');
  // Platz 21 ≈ 78, Platz 100 ≈ 59. Dahinter liegen die Spieler eng beieinander: Platz 200 ≈ 53
  const base = rank <= 100 ? 78 - i * 0.24 : 59 - (rank - 100) * 0.06;
  const w = (key, k) => Math.round(Math.max(48, Math.min(93, base + (((i * 37 + k * 53) % 9) - 4) + (key === strong ? 7 : -1))));
  return {
    id: n.short.toLowerCase().replace(/[^a-z]/g, ''), ...n, country, rank, basePoints: +pts,
    stats: achtWerte({ s: w('s', 1), p: w('p', 2), t: w('t', 3), c: w('c', 4), v: w('v', 5) }, rank),
    hand: extra.includes('L') ? -1 : 1,
    look: {
      skin: HAUT[(i * 5 + 2) % HAUT.length], hair: HAAR[(i * 7 + 1) % HAAR.length], shirt: HEMDEN[(i * 3 + 1) % HEMDEN.length],
      shorts: i % 3 === 0 ? 0xffffff : 0x1a1a1a, head: ['none', 'cap', 'band'][(i * 2) % 3], shoes: 0xffffff, racket: 0x202020,
    },
  };
}

export const PLAYERS = [...STARS.map(star), ...REST.split('\n').map(other)].sort((a, b) => a.rank - b.rank);

// Figur und Kleidung: Wer eine Kappe trägt, bekommt das Modell mit Kappe (e), Stirnband = b,
// alle anderen eines von a, c, d, f. Dazu ein Muster (0–4) und eine zweite Farbe für die Kleidung.
const OHNE = ['a', 'c', 'd', 'f'];
const dark = (c) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255) < 300;
const EINHAND = ['tsitsipas', 'musetti', 'shapovalov', 'altmaier', 'kovacevic', 'dimitrov', 'wawrinka', 'lajovic', 'cecchinato', 'mpetship', 'oconnell', 'holmgren'];   // Rückhand mit einer Hand

// ---------------------------------------------------------------
// Stil der besten Spieler: Woran erkennt man sie auf dem Platz?
// ---------------------------------------------------------------
// Die Gesichter im Spiel sind erfunden – niemand soll aussehen wie der echte Spieler.
// Erkennen kann man die Spieler trotzdem, nämlich an ihrem Stil:
//   groesse  = Körpergröße in cm (so groß wird die Figur gezeichnet; große Spieler treffen den Aufschlag weiter oben)
//   statur   = 'schlank', 'normal' oder 'kraeftig'
//   modell   = welche der sechs Figuren (siehe figur.js): a = kurze Haare · b = längere Haare mit Stirnband ·
//              c = Locken, ärmelloses Hemd · d = Bart, sehr kurze Haare · e = Kappe · f = Haarknoten
//   prellen  = so oft tippt er den Ball vor dem Aufschlag auf den Boden
//   jubel    = so freut er sich über ein gewonnenes Spiel (alle Arten stehen in posen.js unter JUBEL)
//   merkmal  = kurzer Text für die Spielerkarte im Menü
//   unsicher = was davon nur geraten ist
// Die Größen sind die öffentlich bekannten Angaben. Wie oft jemand den Ball prellt, ist nur bei Zverev und
// Djokovic bekannt (beide sehr oft – im Spiel höchstens 5-mal, sonst dauert es zu lange); der Rest ist geschätzt.
// Haarfarbe, Hemd und Hose stehen oben in der Liste STARS. Die Kleiderfarben sind frei gewählt.
export const STIL = {
  zverev:     { groesse: 198, statur: 'schlank',  modell: 'b', prellen: 5, jubel: 'bruellen', merkmal: 'Sehr groß, Stirnband, prellt den Ball lange' },
  sinner:     { groesse: 191, statur: 'schlank',  modell: 'e', prellen: 3, jubel: 'ruhig',    merkmal: 'Rote Haare unter der Kappe, bleibt ganz ruhig' },
  alcaraz:    { groesse: 183, statur: 'kraeftig', modell: 'a', prellen: 3, jubel: 'ohr',      merkmal: 'Kräftig und blitzschnell, Hand ans Ohr: „Ich hör euch nicht!“' },
  shelton:    { groesse: 193, statur: 'kraeftig', modell: 'c', prellen: 2, jubel: 'telefon',  merkmal: 'Linkshänder, ärmellos, legt beim Jubeln den „Telefonhörer“ auf' },
  medvedev:   { groesse: 198, statur: 'schlank',  modell: 'a', prellen: 2, jubel: 'ruhig',    merkmal: 'Sehr groß und dünn, jubelt fast gar nicht' },
  cobolli:    { groesse: 183, statur: 'normal',   modell: 'e', prellen: 3, jubel: 'faust',    merkmal: 'Immer mit Kappe (in echt verkehrt herum)', unsicher: 'Jubel' },
  fils:       { groesse: 185, statur: 'kraeftig', modell: 'd', prellen: 3, jubel: 'muskel',   merkmal: 'Sehr kräftig, zeigt gern seine Muskeln', unsicher: 'Kopfbedeckung, Jubel' },
  tiafoe:     { groesse: 188, statur: 'kraeftig', modell: 'b', prellen: 3, jubel: 'arme',     merkmal: 'Stirnband, bunte Hemden, feiert mit dem Publikum', unsicher: 'Jubel' },
  deminaur:   { groesse: 183, statur: 'schlank',  modell: 'e', prellen: 4, jubel: 'faust',    merkmal: 'Schmal, Kappe, der schnellste Läufer' },
  jodar:      { groesse: 191, statur: 'schlank',  modell: 'a', prellen: 3, jubel: 'faust',    merkmal: 'Jung, groß und schlank', unsicher: 'Größe, Frisur, Jubel' },
  djokovic:   { groesse: 188, statur: 'schlank',  modell: 'a', prellen: 5, jubel: 'bruellen', merkmal: 'Prellt den Ball ewig, brüllt nach großen Punkten' },
  fritz:      { groesse: 196, statur: 'normal',   modell: 'b', prellen: 3, jubel: 'ruhig',    merkmal: 'Sehr groß, lange Haare mit Stirnband' },
  fauger:     { groesse: 193, statur: 'kraeftig', modell: 'a', prellen: 4, jubel: 'faust',    merkmal: 'Groß und athletisch, gewaltiger Aufschlag', unsicher: 'Jubel' },
  paul:       { groesse: 185, statur: 'normal',   modell: 'e', prellen: 3, jubel: 'ruhig',    merkmal: 'Kappe, lässig und flink', unsicher: 'Jubel' },
  lehecka:    { groesse: 185, statur: 'kraeftig', modell: 'e', prellen: 3, jubel: 'faust',    merkmal: 'Kappe, harte Schläge', unsicher: 'Kopfbedeckung, Jubel' },
  mensik:     { groesse: 196, statur: 'schlank',  modell: 'a', prellen: 4, jubel: 'faust',    merkmal: 'Sehr groß, einer der härtesten Aufschläge', unsicher: 'Kopfbedeckung, Jubel' },
  davidovich: { groesse: 183, statur: 'normal',   modell: 'b', prellen: 2, jubel: 'faust',    merkmal: 'Blonde Haare, wirft sich nach jedem Ball', unsicher: 'Kopfbedeckung, Jubel' },
  nakashima:  { groesse: 188, statur: 'normal',   modell: 'e', prellen: 3, jubel: 'ruhig',    merkmal: 'Kappe, zeigt nie Gefühle', unsicher: 'Kopfbedeckung' },
  tien:       { groesse: 180, statur: 'schlank',  modell: 'e', prellen: 3, jubel: 'ruhig',    merkmal: 'Linkshänder, eher klein, Kappe' },
  cerundolo:  { groesse: 185, statur: 'normal',   modell: 'b', prellen: 3, jubel: 'faust',    merkmal: 'Riesige Vorhand', unsicher: 'Kopfbedeckung, Jubel' },
  ruud:       { groesse: 183, statur: 'normal',   modell: 'e', prellen: 4, jubel: 'faust',    merkmal: 'Viel Topspin mit der Vorhand', unsicher: 'Kopfbedeckung, Jubel' },
};

PLAYERS.forEach((p, i) => {
  const L = p.look;
  L.bh = EINHAND.includes(p.id) ? 1 : 2;
  L.model = L.head === 'cap' ? 'e' : L.head === 'band' ? 'b' : OHNE[(i * 3 + 1) % 4];
  // Die Stars bekommen ihren Stil: Figur, Größe, Statur und Jubel wandern ins Aussehen (look)
  const stil = STIL[p.id];
  if (stil) {
    p.stil = stil;
    L.model = stil.modell;
    L.head = stil.modell === 'e' ? 'cap' : stil.modell === 'b' ? 'band' : 'none';
    L.groesse = stil.groesse; L.statur = stil.statur; L.jubel = stil.jubel;
  }
  L.pattern = (i * 3 + 2) % 5;
  L.trim = L.shirt === L.shorts ? (dark(L.shirt) ? 0xffffff : 0x1a2a4a) : (i % 2 ? L.shorts : (dark(L.shirt) ? 0xf2f2f2 : 0x1a2a4a));
});
export const TOP_PLAYERS = PLAYERS.slice(0, 20);
// Sucht einen Spieler: zuerst bei den echten Top 200, dann bei den erfundenen Nachwuchsspielern der kleinen Tour
export const playerById = (id) => PLAYERS.find((p) => p.id === id) || NACHWUCHS.find((p) => p.id === id);
// Gesamtstärke eines Spielers aus seinen acht Fähigkeiten (siehe faehigkeiten.js)
export const overall = gesamt;

export { STAT_NAMES, STAT_INFO, BONUS_NAMES };

// ---------------------------------------------------------------
// Turniere der Saison (Grand Slams, Masters 1000, ATP Finals)
// ---------------------------------------------------------------
// Punkte wie bei der echten ATP (Regeln 2026): Die Zahl sagt, was man bekommt, wenn man in dieser Runde ausscheidet.
// Echt:    Grand Slam   W 2000 · F 1300 · HF 800 · VF 400 · Achtelfinale 200 · Runde der 32: 100 · Runde der 64: 50 · 1. Runde: 10
//          Masters 1000 W 1000 · F  650 · HF 400 · VF 200 · Achtelfinale 100 · Runde der 32:  50 · davor 30 oder 10
const GS_P = { W: 2000, F: 1300, SF: 800, QF: 400, R16: 200, R32: 100, R64: 50, R128: 10 };
const M_P = { W: 1000, F: 650, SF: 400, QF: 200, R16: 100, R32: 50, R64: 30, R128: 10 };   // Masters mit 96 Spielern
const M56_P = { W: 1000, F: 650, SF: 400, QF: 200, R16: 100, R32: 50, R64: 10 };            // Masters mit 56 Spielern
// Preisgeld: echte Größenordnung, gerundet
const GS_M = { W: 3000000, F: 1600000, SF: 800000, QF: 430000, R16: 250000, R32: 150000, R64: 100000, R128: 70000 };
const M_M = { W: 1100000, F: 600000, SF: 330000, QF: 180000, R16: 90000, R32: 52000, R64: 30000, R128: 20000 };
// Die Felder sind so groß wie in echt:
//   Grand Slam: 128 Spieler, 7 Runden, 32 Gesetzte.
//   Masters: 96 Spieler (die 32 Gesetzten haben in der ersten Runde ein Freilos) – nur Monte-Carlo und Paris haben 56 Spieler (8 Freilose).
//   ATP Finals: die besten 8 des Jahres in zwei Gruppen.
const KLEINES_MASTERS = ['mc', 'par'];

const T = (id, name, city, month, cat, surface, theme) => ({
  id, name, city, month, cat, surface, theme,
  draw: cat === 'GS' ? 128 : cat === 'M' ? (KLEINES_MASTERS.includes(id) ? 56 : 96) : 8,
  setz: cat === 'GS' ? 32 : cat === 'M' ? (KLEINES_MASTERS.includes(id) ? 16 : 32) : 8,
  // direkt = so viele kommen über ihren Weltranglistenplatz ins Feld. Der Rest sind Qualifikanten und Wildcards.
  direkt: cat === 'GS' ? 104 : cat === 'M' ? (KLEINES_MASTERS.includes(id) ? 45 : 76) : 8,
  points: cat === 'GS' ? GS_P : KLEINES_MASTERS.includes(id) ? M56_P : M_P, money: cat === 'GS' ? GS_M : M_M,
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
  T('can', 'Canadian Open', 'Montreal', 'August', 'M', 'hard', { court: 0x2a66b8, outer: 0x3a7a9a, wall: 0x1a3a6a, seats: 0x3a5a8a, sky: 0x7fb8f0, night: false }),
  T('cin', 'Cincinnati Open', 'Cincinnati', 'August', 'M', 'hard', { court: 0x2a5aa8, outer: 0x2a8a6a, wall: 0x1a4a5a, seats: 0x5a6a7a, sky: 0x8fc0f8, night: false }),
  T('uso', 'US Open', 'New York', 'September', 'GS', 'hard', { court: 0x2f5fb0, outer: 0x3f8a4a, wall: 0x14285a, seats: 0x1f3a7a, sky: 0x0a1228, night: true }),
  T('sha', 'Shanghai Masters', 'Shanghai', 'Oktober', 'M', 'hard', { court: 0x3a4aa8, outer: 0x2a6a8a, wall: 0x6a1a2a, seats: 0x7a2a3a, sky: 0x1a2038, night: true }),
  T('par', 'Paris Masters', 'Paris', 'November', 'M', 'indoor', { court: 0x2a3a6a, outer: 0x1a1a22, wall: 0x101014, seats: 0x2a2a34, sky: 0x06060a, night: true }),
  T('fin', 'ATP Finals', 'Turin', 'November', 'F', 'indoor', { court: 0x1f5fb8, outer: 0x0f1a3a, wall: 0x0a0a14, seats: 0x1a1a2a, sky: 0x04040a, night: true }),
];
// Sucht ein Turnier: zuerst bei den großen, dann bei den kleinen (ITF, Challenger, ATP 250/500) und dem Liga-Spiel
export const tournamentById = (id) => TOURNAMENTS.find((t) => t.id === id) || KLEINE_TURNIERE.find((t) => t.id === id) || (id === LIGA.id ? LIGA : undefined);
export const FINALS_POINTS = { RR: 200, SF: 400, F: 500 };
export const FINALS_MONEY = { RR: 400000, SF: 1100000, F: 2200000 };

export const SURFACE_NAMES = { hard: 'Hartplatz', clay: 'Sand', grass: 'Rasen', indoor: 'Halle' };
export const ROUND_NAMES = { R128: 'Runde der 128', R64: 'Runde der 64', R32: 'Runde der 32', R16: 'Achtelfinale', QF: 'Viertelfinale', SF: 'Halbfinale', F: 'Finale', W: 'Sieg', RR: 'Gruppenphase' };

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
