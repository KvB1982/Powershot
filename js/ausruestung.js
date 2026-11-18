// Powershot – Ausrüstung, Team und Sponsoren für die Karriere.
//
// Hier stehen nur Listen und Zahlen (kein three.js). Die Marken und Modellreihen gibt es wirklich,
// wir benutzen aber nur ihre Namen als Text – keine Logos. Das Spiel ist nur für uns privat.
//
// Was ist echt, was geschätzt?
//   echt:      Marken, Namen der Schläger-Reihen, Saiten und Schuhe; welche Profis welche Reihe spielen
//              (Stand August 2026, Quelle: tennisnerd.net); Preise in der echten Größenordnung
//   geschätzt: alle Pluspunkte! Welcher Schläger "Spin" oder "Kontrolle" bringt, ist grob dem Ruf der Reihe nachempfunden.
//
// Die Pluspunkte gelten für die Fähigkeiten: s = Aufschlag, p = Kraft, t = Tempo, c = Präzision, v = Volley

// ---------------------------------------------------------------
// Schläger: jede Marke mit ihren Modellreihen
// ---------------------------------------------------------------
// Jeder Marken-Schläger bringt zusammen 4 Pluspunkte – nur anders verteilt. Es gibt also keinen "besten",
// sondern den, der zu deinem Spiel passt. typ sagt in einem Wort, wofür die Reihe bekannt ist.
// [Marke, Modell, typ, Pluspunkte, Preis in $, Farbe des Rahmens, "spielt z. B. …"]
const SCHLAEGER = [
  ['Head', 'Speed', 'Allround', { c: 2, p: 1, s: 1 }, 280, 0xf2f2f2, 'Sinner, Djokovic'],
  ['Head', 'Radical', 'Allround', { p: 2, c: 1, v: 1 }, 270, 0xff7a1a, 'Fritz, Cobolli'],
  ['Head', 'Boom', 'Power', { p: 2, s: 2 }, 260, 0x4fd8c0, 'Musetti'],
  ['Head', 'Extreme', 'Spin', { p: 3, c: 1 }, 260, 0xf2e030, 'Berrettini, Struff'],
  ['Head', 'Prestige', 'Kontrolle', { c: 3, v: 1 }, 290, 0x7a1420, 'F. Cerundolo'],
  ['Head', 'Gravity', 'Kontrolle', { c: 2, p: 1, v: 1 }, 280, 0x2ab8b8, 'Zverev, Rublev'],
  ['Wilson', 'Blade', 'Kontrolle', { c: 3, p: 1 }, 280, 0x1f6f43, 'Mensik, Tsitsipas'],
  ['Wilson', 'Pro Staff', 'Gefühl', { c: 2, v: 2 }, 290, 0x1a1a1a, 'Lehecka'],
  ['Wilson', 'Ultra', 'Power', { p: 2, s: 2 }, 260, 0x2e6fd8, 'de Minaur, Tien'],
  ['Wilson', 'Defyer', 'Power', { p: 2, s: 1, c: 1 }, 280, 0x8a2ad8, 'Rune, Khachanov, Korda'],
  ['Wilson', 'Clash', 'Gefühl', { v: 2, c: 1, p: 1 }, 270, 0xc82a2a, ''],
  ['Wilson', 'Shift', 'Spin', { p: 3, c: 1 }, 270, 0xe8e8f0, ''],
  ['Babolat', 'Pure Aero', 'Spin', { p: 3, c: 1 }, 280, 0xf2e85c, 'Alcaraz, Fils, Auger-Aliassime'],
  ['Babolat', 'Pure Drive', 'Power', { p: 2, s: 2 }, 270, 0x1f5fd8, 'Perricard'],
  ['Babolat', 'Pure Strike', 'Kontrolle', { c: 3, p: 1 }, 280, 0xf5f5f5, 'Norrie'],
  ['Yonex', 'EZONE', 'Power', { p: 2, s: 2 }, 270, 0x2a6ad8, 'Shelton, Ruud'],
  ['Yonex', 'VCORE', 'Spin', { p: 3, c: 1 }, 270, 0xd82a2a, 'Paul, Nakashima'],
  ['Yonex', 'PERCEPT', 'Kontrolle', { c: 3, v: 1 }, 280, 0x4a6a3a, 'Tiafoe, Darderi'],
  ['Tecnifibre', 'T-Fight', 'Allround', { c: 2, p: 1, s: 1 }, 260, 0xf0f0f8, 'Medvedev, Griekspoor'],
  ['Tecnifibre', 'TF40', 'Kontrolle', { c: 3, v: 1 }, 260, 0x1a2a6a, 'Rinderknech'],
  ['Tecnifibre', 'Fire', 'Power', { p: 2, s: 2 }, 250, 0xe8442a, 'Moutet'],
  ['Dunlop', 'CX', 'Kontrolle', { c: 3, p: 1 }, 250, 0xc81e1e, 'Brooksby'],
  ['Dunlop', 'FX', 'Power', { p: 2, s: 2 }, 250, 0x1e8ad8, 'Kecmanovic'],
  ['Dunlop', 'SX', 'Spin', { p: 3, c: 1 }, 250, 0xf2d21e, ''],
  ['Prince', 'Phantom', 'Gefühl', { c: 2, v: 2 }, 240, 0x2a2a2a, ''],
  ['Prince', 'Tour', 'Allround', { c: 2, p: 1, s: 1 }, 240, 0x2ad86a, ''],
  ['Diadem', 'Elevate', 'Allround', { p: 2, c: 1, v: 1 }, 240, 0x2ad8d8, ''],
].map(([marke, modell, typ, bonus, price, color, profis], i) => ({
  id: 'r_' + i, cat: 'Schläger', marke, name: marke + ' ' + modell, typ, bonus, price, color, profis,
}));

// ---------------------------------------------------------------
// Saiten. haelt = so viele Matches bleibt die Saite frisch. Danach wird automatisch neu bespannt (kostet wieder den Preis).
// ---------------------------------------------------------------
// vertrag = zu welcher Schläger-Marke die Saite gehört (Luxilon gehört zu Wilson). Mit einem Vertrag dieser Marke ist sie gratis.
const SAITEN = [
  ['Luxilon', 'ALU Power', 'Die Saite, die die meisten Profis spielen. Wird aber schnell müde.', { c: 2, p: 1 }, 40, 3, 'Wilson'],
  ['Luxilon', '4G', 'Hält die Spannung besonders lange.', { c: 2, s: 1 }, 40, 6, 'Wilson'],
  ['Babolat', 'RPM Blast', 'Achteckig – greift den Ball für viel Spin.', { p: 2, c: 1 }, 38, 4, 'Babolat'],
  ['Head', 'Hawk Touch', 'Viel Gefühl bei harten Schlägen.', { c: 2, v: 1 }, 38, 4, 'Head'],
  ['Yonex', 'PolyTour Pro', 'Weich und bequem für den Arm.', { c: 1, p: 1, v: 1 }, 35, 5, 'Yonex'],
  ['Solinco', 'Hyper-G', 'Die grüne Spin-Saite.', { p: 1, c: 2 }, 33, 5, ''],
  ['Tecnifibre', 'Razor Code', 'Schnell und direkt.', { s: 2, p: 1 }, 34, 4, 'Tecnifibre'],
  ['Dunlop', 'Explosive Tour', 'Günstig und kräftig.', { p: 2 }, 28, 5, 'Dunlop'],
  ['Wilson', "Champion's Choice", 'Halb Naturdarm, halb Kunststoff – eine berühmte Mischung.', { c: 2, s: 1, v: 1, p: 1 }, 60, 4, 'Wilson'],
  ['Babolat', 'VS Touch Naturdarm', 'Aus echtem Naturdarm: das beste Gefühl, aber teuer und empfindlich.', { c: 2, s: 2, v: 1, p: 1 }, 75, 3, 'Babolat'],
].map(([marke, modell, text, bonus, price, haelt, vertrag], i) => ({
  id: 's_' + i, cat: 'Saiten', marke, name: marke + ' ' + modell, text, bonus, price, haelt, vertrag,
}));

// ---------------------------------------------------------------
// Schuhe. Wichtig ist die Sohle: Sandplatz-Schuhe haben ein Fischgräten-Muster, Rasen-Schuhe kleine Noppen.
// ---------------------------------------------------------------
// tempo = Pluspunkte aufs Tempo je Belag. Hast du mehrere Paare, zieht dein Spieler von selbst das beste für den Belag an.
const SCHUHE = [
  ['Wilson', 'Rush Pro', 'Solider Schuh für alle Plätze.', { hard: 2, clay: 2, grass: 2, indoor: 2 }, 120, 0xe8e8e8],
  ['Asics', 'Gel-Resolution', 'Sehr stabil – gut für alle Plätze.', { hard: 2, clay: 2, grass: 2, indoor: 2 }, 150, 0x2a6ad8],
  ['Asics', 'Court FF', 'Schnell auf Hartplatz und in der Halle.', { hard: 4, clay: 1, grass: 1, indoor: 4 }, 180, 0xf24a2a],
  ['Nike', 'Vapor', 'Leicht und flink auf Hartplatz.', { hard: 4, clay: 1, grass: 2, indoor: 3 }, 160, 0xd8f02a],
  ['Nike', 'Vapor Grass', 'Mit Noppen: Damit rutschst du auf Rasen nicht weg.', { hard: 1, clay: 1, grass: 5, indoor: 1 }, 170, 0xffffff],
  ['adidas', 'Barricade Clay', 'Fischgräten-Sohle: So kannst du auf Sand in den Ball rutschen.', { hard: 1, clay: 5, grass: 1, indoor: 1 }, 160, 0xf2a02a],
  ['adidas', 'Ubersonic', 'Sehr leicht, überall ordentlich.', { hard: 3, clay: 2, grass: 2, indoor: 3 }, 150, 0x2ad8a0],
  ['Babolat', 'Propulse Clay', 'Sandplatz-Schuh.', { hard: 1, clay: 4, grass: 1, indoor: 1 }, 140, 0x1f5fd8],
  ['Head', 'Sprint Pro', 'Leicht, mit gutem Halt auf Sand und Hartplatz.', { hard: 3, clay: 3, grass: 1, indoor: 2 }, 150, 0x1a1a1a],
  ['Lacoste', 'AG-LT', 'Schick und bequem.', { hard: 3, clay: 2, grass: 2, indoor: 3 }, 160, 0x1f6f43],
  ['New Balance', 'CT-Rally', 'Viel Dämpfung auf harten Plätzen.', { hard: 4, clay: 1, grass: 1, indoor: 3 }, 150, 0x8a2ad8],
  ['Yonex', 'Eclipsion', 'Stabil in der Halle und auf Hartplatz.', { hard: 3, clay: 1, grass: 1, indoor: 4 }, 150, 0xd82a6a],
].map(([marke, modell, text, tempo, price, color], i) => ({
  id: 'h_' + i, cat: 'Schuhe', marke, name: marke + ' ' + modell, text, tempo, price, color,
}));

// ---------------------------------------------------------------
// Outfits (Hemd + Hose). Sie machen nicht stärker, bringen aber Fans (⭐). Mehr Fans = Sponsoren zahlen mehr.
// ---------------------------------------------------------------
const OUTFITS = [
  ['Nike', 'Court Slam Neon', 0xd8f02a, 0x1a1a1a, 3, 130],
  ['Nike', 'Court Weiß', 0xffffff, 0xffffff, 1, 100],
  ['adidas', 'Melbourne Blau', 0x2a8af0, 0x14285a, 2, 110],
  ['adidas', 'Paris Rot', 0xe8442a, 0x2a1a1a, 2, 110],
  ['Asics', 'Match Türkis', 0x2ad8c8, 0x1a2a4a, 1, 90],
  ['Lacoste', 'Klassik Weiß-Grün', 0xffffff, 0x1f6f43, 3, 140],
  ['On', 'Court Pastell', 0xf0b8d8, 0xf5f5f5, 2, 120],
  ['New Balance', 'Tournament Orange', 0xff8a2a, 0x1a1a1a, 2, 100],
  ['Lululemon', 'Fast & Free Lila', 0x8a5ad8, 0x2a2a34, 2, 120],
  ['Fila', 'Heritage Streifen', 0xf5f5f5, 0x1a2a6a, 2, 100],
  ['Sergio Tacchini', 'Retro Rot', 0xc81e2a, 0xffffff, 2, 100],
  ['Uniqlo', 'Schlicht Schwarz', 0x1a1a1a, 0x1a1a1a, 1, 70],
  ['Yonex', 'Team Gelb', 0xf2d21e, 0x1a1a6a, 1, 80],
].map(([marke, modell, shirt, shorts, sterne, price], i) => ({
  id: 'o_' + i, cat: 'Outfit', marke, name: marke + ' ' + modell, shirt, shorts, sterne, price,
  weiss: shirt === 0xffffff && shorts === 0xffffff,
}));

// Kappe oder Stirnband. Eine Kappe hilft, wenn die Sonne scheint (also nicht abends und nicht in der Halle): +1 Aufschlag.
const KOPF = [
  ['Nike', 'Dri-FIT Kappe', 'cap', 1, 30],
  ['adidas', 'Aeroready Kappe', 'cap', 1, 28],
  ['Lacoste', 'Krokodil-Kappe', 'cap', 2, 45],
  ['Head', 'Pro Player Kappe', 'cap', 1, 25],
  ['Nike', 'Swoosh Stirnband', 'band', 1, 12],
  ['adidas', 'Tennis-Bandana', 'band', 2, 20],
  ['Babolat', 'Logo-Stirnband', 'band', 1, 10],
].map(([marke, modell, head, sterne, price], i) => ({
  id: 'k_' + i, cat: 'Kopf', marke, name: marke + ' ' + modell, head, sterne, price,
  text: head === 'cap' ? 'Bei Sonne: +1 Aufschlag' : 'Hält Haare und Schweiß aus dem Gesicht',
}));

// Schweißbänder fürs Handgelenk: Die Hand bleibt trocken, der Griff rutscht nicht.
const BAENDER = [
  ['Head', 'Schweißbänder', { c: 1 }, 0, 8],
  ['Nike', 'Swoosh Schweißbänder', { c: 1 }, 1, 12],
  ['adidas', 'Schweißbänder breit', { c: 1, v: 1 }, 0, 16],
  ['Babolat', 'Schweißbänder Jumbo', { c: 1, s: 1 }, 0, 16],
].map(([marke, modell, bonus, sterne, price], i) => ({
  id: 'b_' + i, cat: 'Schweißband', marke, name: marke + ' ' + modell, bonus, sterne, price,
}));

// Taschen. In eine große Tasche passen mehr fertig bespannte Schläger – deine Saiten halten dadurch mehr Matches (mehr = …).
// Die Farbe sieht man im Match: Deine Tasche steht neben deiner Bank.
const TASCHEN = [
  ['Head', 'Tour Team 3er', 1, 0, 50, 0x2a2a34],
  ['Wilson', 'Super Tour 6er', 2, 0, 90, 0xc82a2a],
  ['Yonex', 'Pro 9er', 2, 1, 120, 0x2a6ad8],
  ['Babolat', 'Pure Aero 12er', 3, 1, 140, 0xf2e85c],
  ['Tecnifibre', 'Tour Endurance 15er', 4, 2, 160, 0xf0f0f8],
].map(([marke, modell, mehr, sterne, price, color], i) => ({
  id: 't_' + i, cat: 'Tasche', marke, name: marke + ' ' + modell, mehr, sterne, price, color,
  text: `Saiten halten ${mehr} ${mehr === 1 ? 'Match' : 'Matches'} länger`,
}));

// ---------------------------------------------------------------
// Seltene Stücke
// ---------------------------------------------------------------
// Jedes Teil hat eine Seltenheit (selten): 0 = normal, 1 = selten, 2 = episch, 3 = legendär.
// Die Stärke im Match hängt NICHT an der Seltenheit – seltene Stücke bringen vor allem Fans und sind etwas für Sammler.
export const SELTEN = ['Normal', 'Selten', 'Episch', 'Legendär'];
export const SELTEN_FARBE = ['#8a93a8', '#4aa8ff', '#b06aff', '#ffc83a'];

// Turnier-Editionen: Zu jedem großen Turnier gibt es ein Outfit in den Farben des Turniers. Man bekommt es nur im
// Turnier-Shop vor Ort – also nur in der Woche des Turniers, und nur, wenn man dort mitspielen darf.
// (In echt bringen die Marken zu den Grand Slams eigene Kollektionen heraus. Unsere sind erfunden und haben keine Marke.)
// [Turnier, Name, Hemd, Hose, Sterne, Preis, Seltenheit]
const EDITIONEN = [
  ['ao', 'Melbourne-Edition Himmelblau', 0x3aa0f0, 0xffffff, 4, 260, 2],
  ['rg', 'Paris-Edition Sandrot', 0xc8643a, 0x1a2a4a, 4, 260, 2],
  ['wim', 'London-Edition Schneeweiß', 0xffffff, 0xffffff, 4, 260, 2],
  ['uso', 'New-York-Edition Nachtblau', 0x1a1a4a, 0xf2e85c, 4, 260, 2],
  ['fin', 'Finals-Edition Schwarz-Gold', 0x1a1a1a, 0xd8b040, 5, 400, 3],
  ['iw', 'Wüsten-Edition Türkis', 0x2ad8c8, 0x8a5ad8, 3, 180, 1],
  ['mia', 'Miami-Edition Pink', 0xff5aa8, 0x2ad8d8, 3, 180, 1],
  ['mc', 'Monte-Carlo-Edition Azur', 0x2a7ad8, 0xf5e8d0, 3, 180, 1],
  ['mad', 'Madrid-Edition Lila', 0x7a3ac8, 0x1a1a1a, 3, 180, 1],
  ['rom', 'Rom-Edition Terrakotta', 0xd8703a, 0xf5f5f5, 3, 180, 1],
  ['can', 'Kanada-Edition Ahornrot', 0xd82a2a, 0xffffff, 3, 180, 1],
  ['cin', 'Cincinnati-Edition Marine', 0x1a2a6a, 0xf5f5f5, 3, 180, 1],
  ['sha', 'Shanghai-Edition Jade', 0x2aa87a, 0x1a1a1a, 3, 180, 1],
  ['par', 'Hallen-Edition Graphit', 0x4a4a58, 0xd8f02a, 3, 180, 1],
].map(([nur, name, shirt, shorts, sterne, price, selten]) => ({
  id: 'e_' + nur, cat: 'Outfit', marke: 'Turnier-Shop', name, shirt, shorts, sterne, price, selten, nur,
  weiss: shirt === 0xffffff && shorts === 0xffffff,
}));

// Sonderstücke: Die kann man nicht kaufen. Man bekommt sie für etwas Besonderes (verdient + wofuer).
//   verdient: 'titel' = erster Turniersieg · 'top100' / 'top10' / 'nr1' = so weit vorn in der Weltrangliste ·
//             'slam' = Grand-Slam-Sieg · 'siege100' = 100 gewonnene Matches
const SONDER = [
  { id: 'x_titel', cat: 'Schweißband', name: 'Goldenes Schweißband', bonus: { c: 1, s: 1 }, sterne: 2, verdient: 'titel', wofuer: 'deinen ersten Turniersieg' },
  { id: 'x_siege', cat: 'Kopf', name: 'Stirnband „100 Siege“', head: 'band', sterne: 2, verdient: 'siege100', wofuer: '100 gewonnene Matches', text: 'Hält Haare und Schweiß aus dem Gesicht' },
  { id: 'x_top100', cat: 'Kopf', name: 'Top-100-Kappe', head: 'cap', sterne: 3, verdient: 'top100', wofuer: 'einen Platz unter den besten 100', text: 'Bei Sonne: +1 Aufschlag' },
  { id: 'x_top10', cat: 'Tasche', name: 'Top-10-Tasche in Gold', mehr: 4, sterne: 3, color: 0xd8b040, verdient: 'top10', wofuer: 'einen Platz unter den besten 10', text: 'Saiten halten 4 Matches länger' },
  { id: 'x_slam', cat: 'Outfit', name: 'Champion-Outfit Gold', shirt: 0xe8c040, shorts: 0x1a1a1a, sterne: 5, verdient: 'slam', wofuer: 'einen Grand-Slam-Sieg' },
  { id: 'x_nr1', cat: 'Schläger', name: 'Schläger der Nummer 1', typ: 'Legende', bonus: { p: 1, c: 2, s: 1, v: 1 }, color: 0xd8b040, verdient: 'nr1', wofuer: 'Platz 1 der Weltrangliste' },
].map((x) => ({ marke: 'Sonderstück', price: 0, selten: 3, ...x }));

// Seltenheit der normalen Teile: viele Fan-Sterne oder Naturdarm = selten
for (const x of [...OUTFITS, ...KOPF, ...TASCHEN]) x.selten = x.sterne >= 3 ? 1 : 0;
for (const x of SAITEN) x.selten = x.price >= 60 ? 1 : 0;

export const SHOP = [...SCHLAEGER, ...SAITEN, ...SCHUHE, ...OUTFITS, ...EDITIONEN, ...KOPF, ...BAENDER, ...TASCHEN, ...SONDER];
for (const x of SHOP) x.selten = x.selten || 0;
export const SHOP_CATS = ['Schläger', 'Saiten', 'Schuhe', 'Outfit', 'Kopf', 'Schweißband', 'Tasche'];
export const SHOP_INFO = {
  'Schläger': 'Jeder Schläger bringt 4 Pluspunkte, nur anders verteilt. Such dir den aus, der zu deinem Spiel passt.',
  'Saiten': 'Saiten werden müde. Nach ein paar Matches wird automatisch neu bespannt – das kostet jedes Mal den Preis der Saite.',
  'Schuhe': 'Jeder Belag braucht eine andere Sohle. Du kannst mehrere Paare haben: Dein Spieler zieht von selbst das beste an.',
  'Outfit': 'Macht nicht stärker, bringt aber Fans (⭐). Je mehr Fans, desto mehr zahlen deine Sponsoren. In Wimbledon ist Weiß Pflicht!',
  'Kopf': 'Kappe oder Stirnband. Die Kappe hilft bei Sonne beim Aufschlag.',
  'Schweißband': 'Trockene Hand, fester Griff.',
  'Tasche': 'Mehr Platz für fertig bespannte Schläger.',
};
export const shopById = (id) => SHOP.find((s) => s.id === id);
export const WIMBLEDON_LEIHE = 100;   // so viel kostet weiße Leih-Kleidung in Wimbledon, wenn du kein weißes Outfit hast

// ---------------------------------------------------------------
// Dein Team. lohn = Kosten pro Turnierwoche in $
// ---------------------------------------------------------------
//   xp       = so viel mehr Erfahrung bekommst du (1.4 = 40 % mehr)
//   training = Trainingseinheiten vor jedem Turnier
//   bonus    = Pluspunkte, weil der Trainer deine Schläge verbessert
export const TRAINER = [
  { id: 't0', name: 'Kein Trainer', text: 'Du trainierst allein.', lohn: 0, xp: 1, training: 2 },
  { id: 't1', name: 'Vereinstrainer', text: 'Dein Trainer von zu Hause. Er reist nicht mit, hilft aber am Telefon.', lohn: 200, xp: 1.2, training: 2 },
  { id: 't2', name: 'Reise-Trainer', text: 'Kommt zu jedem Turnier mit und schaut sich deine Gegner an.', lohn: 1200, xp: 1.4, training: 3 },
  { id: 't3', name: 'Profi-Trainer', text: 'Hat schon Top-50-Spieler betreut.', lohn: 6000, xp: 1.7, training: 3, bonus: { s: 1, c: 1 } },
  { id: 't4', name: 'Star-Trainer', text: 'War früher selbst in den Top 10. Kennt jeden Trick.', lohn: 25000, xp: 2, training: 4, bonus: { s: 2, p: 1, t: 1, c: 2, v: 1 } },
];
//   erholung = so viel Frische bekommst du zwischen zwei Turnieren zurück
//   last     = so viel Frische kostet dich ein Match
export const PHYSIOS = [
  { id: 'p0', name: 'Kein Physio', text: 'Dehnen musst du selbst.', lohn: 0, erholung: 20, last: 9 },
  { id: 'p1', name: 'Massage am Turnier', text: 'Du buchst den Physio, den das Turnier anbietet.', lohn: 150, erholung: 27, last: 9 },
  { id: 'p2', name: 'Eigener Physio', text: 'Reist mit und kümmert sich jeden Tag um deine Muskeln.', lohn: 1000, erholung: 34, last: 6 },
  { id: 'p3', name: 'Physio und Fitnesstrainer', text: 'Zwei Leute nur für deinen Körper.', lohn: 5000, erholung: 44, last: 5, bonus: { t: 1 } },
];

// ---------------------------------------------------------------
// Reisen. mal = Flug und Hotel kosten so viel mal den normalen Preis, frische = so kommst du an
// ---------------------------------------------------------------
export const REISEN = {
  sparsam: { name: '🎒 Sparsam', text: 'Billigflug mit Umsteigen, Zimmer mit einem anderen Spieler teilen.', mal: 0.6, frische: -10 },
  normal: { name: '✈️ Normal', text: 'Direktflug und ein eigenes Hotelzimmer.', mal: 1, frische: 0 },
  business: { name: '🛏️ Business', text: 'Im Flugzeug liegen und schlafen, gutes Hotel.', mal: 3.5, frische: 8 },
  jet: { name: '🛩️ Privatjet', text: 'Fliegt, wann du willst. Du kommst ausgeruht an.', fest: 40000, frische: 20 },
};

// ---------------------------------------------------------------
// Sponsoren
// ---------------------------------------------------------------
// 1. Ausrüster-Verträge: einer für den Schläger, einer für die Kleidung. Je besser dein Platz, desto besser der Vertrag.
//    Dafür musst du aber auch mit den Sachen dieser Marke spielen – sonst gibt es kein Geld.
//    geld = Dollar pro Turnier. Bei ganz jungen Spielern gibt es in echt auch nur Material und noch kein Geld.
export const VERTRAGS_STUFEN = [
  { bisPlatz: 800, name: 'Material-Vertrag', geld: 0 },
  { bisPlatz: 300, name: 'Nachwuchs-Vertrag', geld: 150 },
  { bisPlatz: 100, name: 'Profi-Vertrag', geld: 1500 },
  { bisPlatz: 20, name: 'Star-Vertrag', geld: 15000 },
  { bisPlatz: 5, name: 'Weltstar-Vertrag', geld: 60000 },
];
export const PROFI_AB = 2;            // ab dieser Stufe (Profi-Vertrag) baut dir die Marke einen Schläger nach Maß: +1 Kraft, +1 Präzision
export const SCHLAEGER_MARKEN = ['Head', 'Wilson', 'Babolat', 'Yonex', 'Tecnifibre', 'Dunlop', 'Prince', 'Diadem'];
export const KLEIDER_MARKEN = ['Nike', 'adidas', 'Asics', 'Lacoste', 'On', 'New Balance', 'Lululemon', 'Fila', 'Sergio Tacchini', 'Uniqlo', 'Yonex'];
// Welche Sachen stellt ein Vertrag gratis?
export const VERTRAG_CATS = { schlaeger: ['Schläger', 'Saiten', 'Tasche'], kleidung: ['Outfit', 'Schuhe', 'Kopf', 'Schweißband'] };

// 2. Kleine und große Geldgeber mit einem Aufnäher auf dem Hemd (alle erfunden). Sie kommen von selbst, wenn du Erfolg hast.
//    wenn = Bedingung: siege (gewonnene Matches), titel, platz
export const GELDGEBER = [
  { id: 'verein', name: 'Dein Tennisverein', text: 'Der Verein sammelt für dich.', geld: 40, wenn: {} },
  { id: 'baecker', name: 'Bäckerei Krümel', text: 'Der Bäcker aus deinem Ort ist dein erster Fan.', geld: 60, wenn: { siege: 3 } },
  { id: 'rad', name: 'Fahrradladen Speiche', text: 'Dein erster Titel stand in der Zeitung!', geld: 120, wenn: { titel: 1 } },
  { id: 'auto', name: 'Autohaus Flitz', text: 'Top 500 der Welt – das ist Werbung wert.', geld: 300, wenn: { platz: 500 } },
  { id: 'limo', name: 'Limo-Fabrik Zisch', text: 'Top 200: Du bist jetzt im Fernsehen zu sehen.', geld: 1000, wenn: { platz: 200 } },
  { id: 'uhr', name: 'Uhrenmarke Tick & Tack', text: 'Top 50: Die großen Firmen rufen an.', geld: 8000, wenn: { platz: 50 } },
  { id: 'flug', name: 'Fluglinie Wolke 7', text: 'Top 10! Ab jetzt fliegst du gratis (außer im Privatjet).', geld: 30000, wenn: { platz: 10 }, freiflug: true },
];
export const FAN_PROZENT = 3;         // jeder Fan-Stern bringt so viel Prozent mehr Sponsorengeld
export const FAN_MAX = 20;            // mehr Sterne zählen nicht
