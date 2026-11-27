// Powershot – die Stimmen von Schiedsrichter und Linienrichtern.
// Die Ansagen sind kleine Aufnahmen im Ordner sounds/stimme/ (erzeugt mit 3D AI Studio, siehe sounds/QUELLEN.md).
// Sie sind auf Englisch – wie bei einem echten Turnier im Fernsehen: "Fifteen love", "Deuce", "Game, set and match".
// Diese Datei weiß nur, WAS gesagt wird (welche Aufnahmen hintereinander). Abgespielt wird in js/audio.js.
// Ohne three.js und ohne Browser – deshalb kann man sie mit node prüfen: node tools/stimme.mjs
//
// Eine Ansage ist eine Liste: Texte sind Aufnahmen ('en/deuce' = Datei sounds/stimme/en/deuce.mp3),
// Zahlen sind Pausen in Sekunden. Beispiel: ['en/advantage', 'namen/sinner'] = "Advantage, Sinner".

// Alle Ansagen des Schiedsrichters (Ordner en/). pAB = Punktestand: A = Punkte des Aufschlägers, B = Punkte des Rückschlägers
// (0 = love, 1 = fifteen, 2 = thirty, 3 = forty). nZ = die Zahl Z (für den Tiebreak), allZ = "Z all" (Z beide).
export const ANSAGEN = [
  'welcome', 'play',          // ganz vorn, weil sie als Erstes gebraucht werden (geladen wird in dieser Reihenfolge)
  'p10', 'p20', 'p30', 'p01', 'p11', 'p21', 'p31', 'p02', 'p12', 'p22', 'p32', 'p03', 'p13', 'p23', 'deuce', 'advantage', 'adv_server', 'adv_receiver',
  'game', 'game_set', 'game_set_match', 'tiebreak', 'fault', 'double_fault', 'time', 'quiet',
  'break_point', 'set_point', 'match_point', 'championship_point',
  ...Array.from({ length: 21 }, (_, i) => 'n' + i), ...Array.from({ length: 12 }, (_, i) => 'all' + (i + 1)),
];
// Was die Aufnahmen sagen (zum Nachlesen und für die Anhör-Seite tools/stimmen.html)
export const ANSAGE_TEXT = {
  deuce: 'Deuce (Einstand)', advantage: 'Advantage (Vorteil …)', adv_server: 'Advantage server (Vorteil Aufschläger)', adv_receiver: 'Advantage receiver (Vorteil Rückschläger)',
  game: 'Game (Spiel …)', game_set: 'Game and set (Spiel und Satz …)', game_set_match: 'Game, set and match (Spiel, Satz und Sieg …)', tiebreak: 'Tie-break',
  fault: 'Fault (Fehler)', double_fault: 'Double fault (Doppelfehler)', time: 'Time (die Pause ist vorbei)', play: 'Play (es geht los)', quiet: 'Quiet please (Ruhe bitte)',
  welcome: 'Ladies and gentlemen, please welcome the players', break_point: 'Break point', set_point: 'Set point', match_point: 'Match point', championship_point: 'Championship point',
};
// Linienrichter (Ordner linie/): drei verschiedene Stimmen, jede ruft zweimal "Out!" und zweimal "Fault!"
export const LINIE = { out: 6, fault: 6 };

// Für diese Nachnamen gibt es eine Aufnahme (Ordner namen/): die 200 Profis und die 40 Nachnamen der Nachwuchsspieler.
export const NAMEN = new Set(`
  zverev sinner alcaraz shelton medvedev cobolli fils tiafoe fritz jodar deminaur djokovic paul lehecka mensik davidovich augeraliassime ruud
  nakashima cerundolo darderi tien rublev khachanov bublik vacherot musetti blockx etcheverry hurkacz tabilo fery buse vanassche michelsen tsitsipas
  arnaldi humbert struff vandezandschulp borges merida berrettini bergs halys fonseca tirante gea navone griekspoor shapovalov norrie baez collignon
  vallejo faria rinderknech hijikata machac mannarino bellucci marozsan kecmanovic ugocarabelli diazacosta hanfmann quinn kopriva munar landaluce
  altmaier molcan safiullin atmane carrenobusta duckworth svajda medjedovic burruchaga droguet majchrzak kovacevic wong basilashvili jacquet fearnley
  trungelliti prizmic dzumhur bonzi samuel bu brooksby giron piros walton zheng cilic shevchenko seybothwild korda damm harris dejong wu virtanen
  dellien moutet sonego gaston choinski svrcina mejia rocha chidekh basavareddy oconnell heide martinez rodionov sweeny royer ofner sakamoto nava
  gojo shimabukuro popyrin alcalagurri mochizuki sanchez sakellaridis kouame dimitrov comesana djere vukic cina mpetshi dodig pellegrino llamasruiz
  kym schoolkate fucsovics simakin gaubas moller mmoh blanch gentzsch neumayer muller draper kwon zhang passaro lajovic guerrieri kumstat maestrelli
  wawrinka lajal draxl diallo kotov daniel schwaerzler onclin cecchinato balshaw tomic travaglia budkovkjaer reisdasilva brunold midon rodesch
  pradoangelo justo tabur bueno dedura dietrich pinnington smith montes galarneau gueymard jordasanchis skatov pavlovic feldbausch ilagan varillas
  holmgren mena boyer kessler brandtner rivassoler marchandet zalewicz bellandi echaniz whitcombe morikawa hadraba arantes hargrove lindqvist
  stavridis marasovic oltmanns delacroze pimentel aaltonen rutli verhoeven petrasin castellan wenbo dubnicky tremblay olmedo fontanesi kardos solheim
  trautwein guerrica vandenbroek nyholm tachibana maddison akhmetbek roussard engelhart peralta
`.split(/\s+/).filter(Boolean));

// Zahlen zum Einstellen
export const PAUSE = 0.32;          // Pause zwischen zwei Sätzen einer Ansage (Sekunden)
export const QUIET_OFT = 0.3;       // so oft bittet der Schiedsrichter vor einem Satz- oder Matchball um Ruhe (0.3 = bei 3 von 10)

// Aus einem Namen wird das Kürzel der Aufnahme: "J. M. Cerundolo" → "cerundolo", "Davidovich F." → "davidovich", "Rütli" → "rutli"
export function nameKuerzel(name) {
  return String(name || '').replace(/^([A-Z]\. )+/, '').replace(/ [A-Z]\.$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}
// Die Aufnahme zu einem Namen – oder null, wenn es keine gibt (zum Beispiel für deinen eigenen Namen in der Karriere)
export function nameClip(name) {
  const k = nameKuerzel(name);
  return NAMEN.has(k) ? 'namen/' + k : null;
}

// Der Punktestand als Ansage (Punktzahl des Aufschlägers zuerst). null = dafür gibt es keine Aufnahme.
export function standTeile(sc, names) {
  const s = sc.server, r = 1 - s;
  const [a, b] = [sc.points[s], sc.points[r]];
  if (sc.tiebreak) {
    if (a === b) return a >= 1 && a <= 12 ? ['en/all' + a] : null;
    if (Math.max(a, b) > 20) return null;
    // "Three two, Sinner" – wer führt, wird zuletzt genannt
    const wer = nameClip(names[a > b ? s : r]);
    return ['en/n' + Math.max(a, b), 'en/n' + Math.min(a, b), ...(wer ? [wer] : [])];
  }
  if (a >= 3 && b >= 3) {
    if (a === b) return ['en/deuce'];
    const wer = nameClip(names[a > b ? s : r]);
    // Ohne Aufnahme für den Namen sagt der Schiedsrichter "Advantage server" oder "Advantage receiver"
    return wer ? ['en/advantage', wer] : [a > b ? 'en/adv_server' : 'en/adv_receiver'];
  }
  return [`en/p${a}${b}`];
}

// Was wird nach einem Punkt gesagt?
//   info  = der Punkt aus match.js (winner, reason, events), sc = der Spielstand (MatchScore), names = die zwei Namen
//   opt   = { finale: Endspiel?, netz: ging der Aufschlag ins Netz? }
// Zurück kommt { linie, teile }: linie = was der Linienrichter sofort ruft ('out', 'fault' oder null),
// teile = was der Schiedsrichter danach sagt (null = keine Aufnahme dafür da, dann spricht die Stimme des Geräts).
// Wie im echten Tennis sagt der Schiedsrichter nichts zu einem Ass oder einem Ball ins Netz – er nennt nur den Spielstand.
export function punktAnsage(info, sc, names, opt = {}) {
  let linie = null;
  const teile = [];
  if (info.reason === 'aus') linie = 'out';
  if (info.reason === 'doppelfehler') {
    if (!opt.netz) linie = 'fault';
    teile.push('en/double_fault', PAUSE);
  }
  const wer = nameClip(names[info.winner]);
  const mitName = (clip) => { teile.push(clip); if (wer) teile.push(wer); };
  if (info.events.includes('match')) mitName('en/game_set_match');
  else if (info.events.includes('set')) mitName('en/game_set');
  else if (info.events.includes('game')) {
    mitName('en/game');
    if (info.events.includes('tiebreak')) teile.push(PAUSE, 'en/tiebreak');
  } else {
    const stand = standTeile(sc, names);
    if (!stand) return { linie, teile: null };
    teile.push(...stand);
    // Wichtiger Punkt? (Das sagt ein echter Schiedsrichter nicht – bei uns schon, damit man es mitbekommt.)
    const w = sc.wichtigerPunkt();
    if (w) teile.push(PAUSE, 'en/' + { break: 'break_point', satz: 'set_point', match: opt.finale ? 'championship_point' : 'match_point' }[w.art]);
  }
  return { linie, teile };
}

// Alle Aufnahmen, die ein Match braucht: Schiedsrichter, Linienrichter und die Namen der beiden Spieler
export function dateienFuer(names = []) {
  const out = ANSAGEN.map((k) => 'en/' + k);
  for (const art of Object.keys(LINIE)) for (let i = 1; i <= LINIE[art]; i++) out.push(`linie/${art}_${i}`);
  for (const n of names) { const c = nameClip(n); if (c) out.push(c); }
  return out;
}
