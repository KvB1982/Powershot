// Powershot – Der Tour-Kalender: 52 Wochen, so wie das echte Tennisjahr 2026 abläuft.
//
// Ein Tennisjahr beginnt Anfang Januar in Australien und endet im November mit den ATP Finals.
// Danach ist "Off-Season": ein paar Wochen Urlaub, dann Vorbereitung auf das neue Jahr.
//
// Diese Datei enthält nur Listen und Zahlen (kein three.js, keine anderen Dateien).
//
// Was ist echt, was vereinfacht?
//   echt:        die Wochen der Grand Slams, Masters, ATP Finals und der ATP-500/250-Turniere (ATP-Kalender 2026),
//                die Regeln der Weltrangliste (siehe unten), die Orte der Challenger und ITF-Turniere gibt es wirklich
//   ungefähr:    in welcher Woche ein Challenger oder ITF-Turnier liegt
//   vereinfacht: Ein großes Turnier über zwei Wochen wird bei uns in seiner ersten Woche ausgespielt.
//                Wer weit kommt, ist auch die zweite Woche dort. Jedes Jahr hat denselben Kalender.

export const WOCHEN_PRO_JAHR = 52;

// ---------------------------------------------------------------
// Regeln der Weltrangliste (ATP-Regelbuch 2026)
// ---------------------------------------------------------------
// - Ein Ergebnis zählt genau 52 Wochen lang. Danach fällt es weg: Man muss seine Punkte "verteidigen".
// - Es zählen höchstens 18 Turniere (bis 2025 waren es 19).
// - Pflicht sind die 4 Grand Slams und 8 Masters (alle außer Monte-Carlo) – für jeden, der dort mitspielen darf.
//   Wer nicht hinfährt, bekommt dafür 0 Punkte, und diese 0 zählt als eines der 18 Turniere.
// - Die übrigen Plätze füllen die besten anderen Ergebnisse (ATP 500, 250, Challenger, ITF, Monte-Carlo).
// - Die ATP Finals zählen als 19. Turnier obendrauf.
// - Das ATP Race zählt genauso, aber nur die Turniere des laufenden Jahres. Am 1. Januar haben alle 0 Punkte.
//   Die besten 8 des Race spielen im November die ATP Finals.
export const ZAEHLT_HOECHSTENS = 18;
export const PFLICHT_MASTERS = ['iw', 'mia', 'mad', 'rom', 'can', 'cin', 'sha', 'par'];

// ---------------------------------------------------------------
// Die 52 Wochen. Eine Zeile = eine Woche (Woche 1 beginnt am ersten Montag im Januar).
// ---------------------------------------------------------------
// 'Großes Turnier | kleine Turniere | Hinweis'
//   Großes Turnier: Kürzel aus data.js (ao, iw …). Mit '2' dahinter = die zweite Woche dieses Turniers.
//                   'off' = Off-Season (keine Profi-Turniere).
//   kleine Turniere: 'Stufe:Ort:Erdteil:Belag', mit Komma getrennt
const LISTE = `|M15:Monastir:af:hard,M25:Esch-sur-Alzette:eu:indoor,CH75:Nonthaburi:as:hard,CH125:Canberra:au:hard,A250:Hongkong:as:hard,A250:Brisbane:au:hard|Das neue Tennisjahr beginnt. Alle starten im ATP Race bei 0 Punkten.
|M15:Manacor:eu:hard,M25:Antalya:eu:clay,CH75:Oeiras:eu:indoor,CH100:Buenos Aires:sa:clay,A250:Auckland:au:hard,A250:Adelaide:au:hard|
ao|M15:Monastir:af:hard,M25:Bressuire:eu:indoor,CH75:Oeiras:eu:indoor,CH100:Quimper:eu:indoor|
ao2|M15:Sharm El Sheikh:af:hard,M25:Nußloch:eu:indoor,CH75:Koblenz:eu:indoor,CH100:Punta del Este:sa:clay|
|M15:Antalya:eu:clay,M25:Hammamet:af:clay,CH75:Cleveland:na:indoor,CH100:Lille:eu:indoor,A250:Montpellier:eu:indoor|
|M15:Monastir:af:hard,M25:Trento:eu:indoor,CH75:Chennai:as:hard,CH125:Manama:as:hard,A250:Buenos Aires:sa:clay,A500:Dallas:na:indoor,A500:Rotterdam:eu:indoor|
|M15:Sharm El Sheikh:af:hard,M25:Vila Real de Santo António:eu:hard,CH75:Delhi:as:hard,CH125:Pau:eu:indoor,A250:Delray Beach:na:hard,A500:Rio de Janeiro:sa:clay,A500:Doha:as:hard|
|M15:Monastir:af:hard,M25:Faro:eu:hard,CH75:Lugano:eu:indoor,CH100:Bengaluru:as:hard,A250:Santiago:sa:clay,A500:Acapulco:na:hard,A500:Dubai:as:hard|
iw|M15:Antalya:eu:clay,M25:Santa Margherita di Pula:eu:clay,CH75:Kigali:af:clay,CH100:Thionville:eu:indoor|
iw2|M15:Heraklion:eu:hard,M25:Poreč:eu:clay,CH75:Santiago de Chile:sa:clay,CH175:Phoenix:na:hard|
mia|M15:Sharm El Sheikh:af:hard,M25:Santa Margherita di Pula:eu:clay,CH75:Murcia:eu:clay,CH100:Zadar:eu:clay|
mia2|M15:Monastir:af:hard,M25:Saint-Dizier:eu:indoor,CH75:Girona:eu:clay,CH125:Neapel:eu:clay|
|M15:Antalya:eu:clay,M25:Reus:eu:clay,CH75:Barletta:eu:clay,CH125:Mexiko-Stadt:na:clay,A250:Houston:na:clay,A250:Marrakesch:af:clay,A250:Bukarest:eu:clay|Die Sandplatz-Zeit beginnt.
mc|M15:Sharm El Sheikh:af:hard,M25:Santa Margherita di Pula:eu:clay,CH75:Madrid:eu:clay,CH100:Sarasota:na:clay|
|M15:Heraklion:eu:hard,M25:Angers:eu:clay,CH75:Oeiras:eu:clay,CH100:Tallahassee:na:clay,A500:München:eu:clay,A500:Barcelona:eu:clay|
mad|M15:Antalya:eu:clay,M25:Nottingham:eu:hard,CH75:Ostrava:eu:clay,CH100:Savannah:na:clay|
mad2|M15:Monastir:af:hard,M25:Sabadell:eu:clay,CH75:Rom:eu:clay,CH175:Aix-en-Provence:eu:clay|
rom|M15:Heraklion:eu:hard,M25:Most:eu:clay,CH75:Francavilla:eu:clay,CH100:Prag:eu:clay|
rom2|M15:Antalya:eu:clay,M25:Reggio Emilia:eu:clay,CH75:Tunis:af:clay,CH175:Bordeaux:eu:clay|
|M15:Monastir:af:hard,M25:Kiseljak:eu:clay,CH75:Skopje:eu:clay,CH100:Istanbul:eu:clay,A250:Genf:eu:clay,A500:Hamburg:eu:clay|
rg|M15:Grasse:eu:clay,M25:Carnac:eu:clay,CH75:Vicenza:eu:clay,CH100:Little Rock:na:hard|
rg2|M15:Kuršumlijska Banja:eu:clay,M25:La Bisbal:eu:clay,CH100:Prostějov:eu:clay,CH125:Heilbronn:eu:clay,CH125:Birmingham:eu:grass|
|M15:Monastir:af:hard,M25:Martos:eu:hard,CH75:Bratislava:eu:clay,CH125:Perugia:eu:clay,A250:’s-Hertogenbosch:eu:grass,A250:Stuttgart:eu:grass|Die kurze Rasen-Zeit beginnt.
|M15:Saarlouis:eu:clay,M25:Kaltenkirchen:eu:clay,CH75:Posen:eu:clay,CH125:Nottingham:eu:grass,A500:Halle:eu:grass,A500:London:eu:grass|
|M15:Tanger:af:clay,M25:Bourg-en-Bresse:eu:clay,CH75:Mailand:eu:clay,CH125:Ilkley:eu:grass,A250:Eastbourne:eu:grass,A250:Mallorca:eu:grass|
wim|M15:Monastir:af:hard,M25:Ajaccio:eu:hard,CH75:Troyes:eu:clay,CH100:Karlsruhe:eu:clay|
wim2|M15:Marburg:eu:clay,M25:Kassel:eu:clay,CH75:Triest:eu:clay,CH125:Braunschweig:eu:clay|
|M15:Uslar:eu:clay,M25:Esch-sur-Alzette:eu:clay,CH75:Amersfoort:eu:clay,CH100:Iași:eu:clay,A250:Umag:eu:clay,A250:Gstaad:eu:clay,A250:Båstad:eu:clay|Nach Wimbledon machen viele Profis ein paar Tage Urlaub.
|M15:Monastir:af:hard,M25:Wetzlar:eu:clay,CH75:Tampere:eu:clay,CH125:Zug:eu:clay,A250:Estoril:eu:clay,A250:Kitzbühel:eu:clay|
|M15:Xanthi:eu:clay,M25:Edwardsville:na:hard,CH75:Lexington:na:hard,CH100:San Marino:eu:clay,A250:Los Cabos:na:hard,A500:Washington:na:hard|Die Hartplatz-Zeit in Nordamerika beginnt.
can|M15:Monastir:af:hard,M25:Bolzano:eu:clay,CH75:Bonn:eu:clay,CH100:Lüdenscheid:eu:clay|
cin|M15:Frankfurt:eu:clay,M25:Überlingen:eu:clay,CH75:Cordenons:eu:clay,CH100:Chicago:na:hard|
cin2|M15:Bad Schussenried:eu:clay,M25:Koksijde:eu:clay,CH75:Augsburg:eu:clay,CH100:Cary:na:hard|
|M15:Monastir:af:hard,M25:Poznań:eu:clay,CH75:Zhangjiagang:as:hard,CH100:Como:eu:clay,A250:Winston-Salem:na:hard|
uso|M15:Allershausen:eu:clay,M25:Oldenzaal:eu:clay,CH75:Cassis:eu:hard,CH125:Genua:eu:clay|
uso2|M15:Monastir:af:hard,M25:Maribor:eu:clay,CH75:Tulln:eu:clay,CH125:Szczecin:eu:clay|
|M15:Sharm El Sheikh:af:hard,M25:Plaisir:eu:indoor,CH75:Bad Waltersdorf:eu:clay,CH125:Saint-Tropez:eu:hard,CH125:Guangzhou:as:hard|Diese Woche ist Davis Cup. Viele Profis ruhen sich nach den US Open aus.
|M15:Monastir:af:hard,M25:Pardubice:eu:clay,CH75:Sibiu:eu:clay,CH125:Orléans:eu:indoor,A250:Hangzhou:as:hard,A250:Chengdu:as:hard|Die Tour zieht nach Asien.
|M15:Heraklion:eu:hard,M25:Falun:eu:indoor,CH75:Lissabon:eu:clay,CH100:Mouilleron-le-Captif:eu:indoor,A500:Tokio:as:hard,A500:Peking:as:hard|
sha|M15:Sharm El Sheikh:af:hard,M25:Santa Margherita di Pula:eu:clay,CH75:Ismaning:eu:indoor,CH100:Valencia:eu:clay|
sha2|M15:Monastir:af:hard,M25:Nevers:eu:indoor,CH75:Roanne:eu:indoor,CH100:Shenzhen:as:hard,CH125:Olbia:eu:hard|
|M15:Heraklion:eu:hard,M25:Saint-Augustin:na:indoor,CH75:Hamburg:eu:indoor,CH100:Brest:eu:indoor,A250:Brüssel:eu:indoor,A250:Lyon:eu:indoor,A250:Almaty:as:indoor|Jetzt wird in der Halle gespielt.
|M15:Antalya:eu:clay,M25:Sarreguemines:eu:indoor,CH75:Ortisei:eu:indoor,CH100:Seoul:as:hard,A500:Wien:eu:indoor,A500:Basel:eu:indoor|
par|M15:Sharm El Sheikh:af:hard,M25:Villers-lès-Nancy:eu:indoor,CH75:Matsuyama:as:hard,CH100:Eckental:eu:indoor|
|M15:Monastir:af:hard,M25:Trnava:eu:indoor,CH75:Kōbe:as:indoor,CH125:Helsinki:eu:indoor,A250:Stockholm:eu:indoor|Letzte Chance auf Punkte für die ATP Finals.
fin|M15:Antalya:eu:clay,M25:Heraklion:eu:hard,CH75:Yokohama:as:hard,CH100:Montevideo:sa:clay|
|M15:Sharm El Sheikh:af:hard,M25:Monastir:af:hard,CH75:Maia:eu:clay,CH100:Temuco:sa:hard|Die ATP-Saison ist vorbei. Nur noch die letzten Challenger laufen.
off|M15:Monastir:af:hard,M25:Antalya:eu:clay|Off-Season: Die Profis machen Urlaub. Nur ganz kleine Turniere laufen noch.
off|M15:Sharm El Sheikh:af:hard,M25:Monastir:af:hard|Off-Season: Viele Profis beginnen jetzt mit der Vorbereitung auf das neue Jahr.
off|M15:Antalya:eu:clay|Off-Season: Vorbereitung – Kraft, Ausdauer und neue Schläge üben.
off||Weihnachten. Es gibt kein einziges Profi-Turnier.
off||Zwischen den Jahren: Die Profis fliegen nach Australien. Nächste Woche geht es wieder los.`;

// Wie lange dauert ein großes Turnier? (2 = zwei Wochen)
export const WOCHEN = LISTE.split('\n').map((zeile, nr) => {
  const [g, klein, hinweis] = zeile.split('|');
  const zweite = g.endsWith('2') ? g.slice(0, -1) : null;
  return {
    nr,
    gross: g && g !== 'off' && !zweite ? g : null,   // dieses große Turnier beginnt in dieser Woche
    zweite,                                           // dieses große Turnier ist in seiner zweiten Woche
    off: g === 'off',                                 // Off-Season
    hinweis: hinweis || '',
    klein: klein ? klein.split(',').map((t) => { const [stufe, city, erdteil, surface] = t.split(':'); return { stufe, city, erdteil, surface }; }) : [],
  };
});

// In welcher Woche beginnt ein großes Turnier? (-1 = steht nicht im Kalender)
export const wocheVon = (grossId) => WOCHEN.findIndex((w) => w.gross === grossId);
// Dauert dieses große Turnier zwei Wochen?
export const zweiWochen = (grossId) => WOCHEN.some((w) => w.zweite === grossId);

// ---------------------------------------------------------------
// Datum: An welchem Montag beginnt eine Woche?
// ---------------------------------------------------------------
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
// Woche 0 beginnt am ersten Montag ab dem 4. Januar (2026 ist das der 5. Januar – so wie in echt).
export function montag(jahr, woche) {
  const d = new Date(Date.UTC(jahr, 0, 4));
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7) + woche * 7);
  return d;
}
// '5. Januar'
export function datumText(jahr, woche) {
  const d = montag(jahr, woche);
  return d.getUTCDate() + '. ' + MONATE[d.getUTCMonth()];
}
// '5.1.'
export function datumKurz(jahr, woche) {
  const d = montag(jahr, woche);
  return d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '.';
}
