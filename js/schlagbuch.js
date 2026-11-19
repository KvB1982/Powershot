// Powershot – das Schlagbuch: alle Schlagarten zum Nachlesen, mit einem Strichmännchen, das die Bewegung zeigt.
//
// Diese Datei baut nur Text und Bilder (HTML und SVG) – ohne three.js. Das Menü dazu steht in app.js ("schlagbuch").
// Das Strichmännchen wird nicht gemalt, sondern ausgerechnet: Für jeden Schlag stehen unten drei "Posen"
// (1 Ausholen, 2 Treffen, 3 Ausschwingen). Eine Pose sagt nur, wo die Schlaghand ist und wohin der Schläger zeigt.
// Ellbogen, Knie und der Rest ergeben sich daraus von selbst.
//
// Die Liste ist dieselbe wie auf der Apple Watch (ios/PowershotWatch/Schlaeger.swift, "schlagarten").
// Wenn du dort einen Schlag dazuschreibst, schreib ihn auch hier dazu – mit demselben Kürzel.

import { SCHLAEGE, AUFSCHLAEGE } from './schlaege.js';

// Eine Pose:  h = [vor, hoch] wo die Schlaghand ist (in Metern; 0 = Körpermitte, Boden = 0; das Männchen schlägt nach rechts)
//             w = wohin der Schläger zeigt, in Grad (0 = nach vorn, 90 = nach oben, 180 = nach hinten, 270 = nach unten)
//             a = wo die andere Hand ist – oder 'beide', wenn beide Hände am Schläger sind
//             neig = Oberkörper vorgebeugt (+) oder zurückgelehnt (−), tief = so weit geht man in die Knie
const P = (h, w, extra) => ({ h, w, a: [0.28, 1.05], neig: 0, tief: 0, ...extra });

// Wo der Ball herkommt und wo er hinfliegt (nur für das Bild)
const VON_VORN = [1.75, 1.0];

export const GRUPPEN = ['Grundschläge', 'Am Netz', 'Besondere Schläge', 'Aufschläge', 'Kein Schlag'];

// spiel = Name der Zeile in js/schlaege.js (SCHLAEGE oder AUFSCHLAEGE), aus der das Spiel die Zahlen für diesen Schlag nimmt
export const BUCH = [
  // ---------------- Grundschläge ----------------
  { k: 'vorhand-topspin', name: 'Vorhand Topspin', gruppe: 0, spiel: 'drive',
    kurz: 'Der wichtigste Schlag. Der Ball dreht nach vorn, fällt von selbst ins Feld und springt hoch weg.',
    schritte: ['Schläger nach hinten und unter den Ball – die Hand ist auf Kniehöhe.', 'Von unten nach oben durch den Ball. Du triffst ihn vor dem Körper, etwa auf Hüfthöhe.', 'Weiter nach oben schwingen, bis die Hand über der anderen Schulter ist.'],
    tipp: 'Für den „hohen Topspin“ im Spiel ist es dieselbe Bewegung, nur noch steiler nach oben.',
    posen: [P([-0.46, 0.72], 215, { tief: 0.08 }), P([0.46, 0.98], 60), P([0.08, 1.58], 150, { neig: 0.05 })], nach: [1.75, 1.75] },
  { k: 'vorhand-flach', name: 'Vorhand flach', gruppe: 0, spiel: 'flach',
    kurz: 'Der gerade Schuss: sehr schnell und knapp über das Netz, fast ohne Drall.',
    schritte: ['Schläger auf Hüfthöhe gerade nach hinten.', 'Waagerecht durch den Ball – wie eine Schublade zuschieben.', 'Nach vorn durchschwingen, die Hand endet auf Schulterhöhe.'],
    tipp: 'Die Hand bleibt die ganze Zeit ungefähr auf einer Höhe. Das ist der Unterschied zum Topspin.',
    posen: [P([-0.5, 1.02], 180), P([0.5, 1.04], 65), P([0.36, 1.36], 125)], nach: [1.75, 1.12] },
  { k: 'vorhand-slice', name: 'Vorhand Slice', gruppe: 0, spiel: 'slice',
    kurz: 'Der Ball dreht rückwärts. Er schwebt lange und bleibt nach dem Aufkommen flach.',
    schritte: ['Schläger hoch nehmen – die Hand ist auf Kopfhöhe.', 'Von oben nach unten unter den Ball schneiden, wie mit einem Messer.', 'Flach nach vorn ausschwingen, die Hand endet tief.'],
    tipp: 'Genau umgekehrt wie beim Topspin: von oben nach unten.',
    posen: [P([-0.3, 1.52], 110), P([0.46, 0.96], 45), P([0.58, 0.74], 15, { neig: 0.06 })], nach: [1.75, 1.05] },
  { k: 'rueckhand-topspin', name: 'Rückhand Topspin', gruppe: 0, spiel: 'drive',
    kurz: 'Wie der Vorhand-Topspin, aber auf der anderen Seite – meist mit beiden Händen am Schläger.',
    schritte: ['Schulter zum Netz drehen, Schläger mit beiden Händen nach hinten unten.', 'Von unten nach oben durch den Ball, beide Hände bleiben am Griff.', 'Hoch über die Schulter ausschwingen.'],
    tipp: 'Die Uhr sitzt am Schlagarm. Bei der beidhändigen Rückhand ist das die untere Hand am Griff.',
    posen: [P([-0.42, 0.74], 210, { a: 'beide', tief: 0.08 }), P([0.42, 0.96], 55, { a: 'beide' }), P([0.1, 1.56], 140, { a: 'beide', neig: 0.05 })], nach: [1.75, 1.75] },
  { k: 'rueckhand-flach', name: 'Rückhand flach', gruppe: 0, spiel: 'flach',
    kurz: 'Gerader, schneller Schlag mit der Rückhand.',
    schritte: ['Schläger mit beiden Händen auf Hüfthöhe nach hinten.', 'Waagerecht durch den Ball.', 'Nach vorn durchschwingen bis auf Schulterhöhe.'],
    tipp: 'Die Hände bleiben auf einer Höhe – nicht nach oben ziehen.',
    posen: [P([-0.46, 1.0], 180, { a: 'beide' }), P([0.46, 1.02], 60, { a: 'beide' }), P([0.36, 1.34], 120, { a: 'beide' })], nach: [1.75, 1.12] },
  { k: 'rueckhand-slice', name: 'Rückhand Slice', gruppe: 0, spiel: 'slice',
    kurz: 'Mit einer Hand von oben nach unten geschnitten. Der Ball schwebt und rutscht flach weg.',
    schritte: ['Schläger hoch neben die Schulter, die andere Hand stützt ihn.', 'Mit einer Hand von oben nach unten durch den Ball schneiden.', 'Arm nach vorn strecken, die andere Hand geht nach hinten – wie ein Vogel mit ausgebreiteten Flügeln.'],
    tipp: 'Nur eine Hand am Schläger, auch wenn du sonst beidhändig spielst.',
    posen: [P([-0.26, 1.5], 115, { a: 'beide' }), P([0.44, 0.98], 45, { a: [-0.2, 1.1] }), P([0.58, 0.82], 20, { a: [-0.42, 1.12] })], nach: [1.75, 1.05] },

  // ---------------- Am Netz ----------------
  { k: 'vorhand-volley', name: 'Vorhand-Volley', gruppe: 1, spiel: 'volley',
    kurz: 'Am Netz: Der Ball wird aus der Luft geblockt, bevor er aufspringt.',
    schritte: ['Schläger vor dem Körper hochhalten – nicht ausholen!', 'Einen kleinen Schritt und den Ball vor dem Körper blocken.', 'Nur ein kurzes Stück nach vorn schieben, dann stoppen.'],
    tipp: 'Die ganze Bewegung ist nur so lang wie dein Unterarm. Trotzdem kurz und fest – sonst merkt die Uhr nichts.',
    posen: [P([0.16, 1.3], 100, { tief: 0.06 }), P([0.46, 1.2], 85, { tief: 0.06 }), P([0.56, 1.08], 75, { tief: 0.06 })], von: [1.75, 1.3], nach: [1.75, 0.9] },
  { k: 'rueckhand-volley', name: 'Rückhand-Volley', gruppe: 1, spiel: 'volley',
    kurz: 'Der Volley auf der Rückhand-Seite.',
    schritte: ['Schläger vor dem Körper, die andere Hand hält ihn oben am Hals.', 'Mit einer Hand kurz nach vorn blocken.', 'Kurz ausschieben, die andere Hand bleibt hinten.'],
    tipp: 'Kein Ausholen. Der Schläger bleibt immer vor dir, wo du ihn sehen kannst.',
    posen: [P([0.14, 1.28], 105, { a: 'beide', tief: 0.06 }), P([0.44, 1.18], 85, { a: [-0.1, 1.15], tief: 0.06 }), P([0.54, 1.06], 75, { a: [-0.28, 1.12], tief: 0.06 })], von: [1.75, 1.3], nach: [1.75, 0.9] },
  { k: 'halbvolley', name: 'Halbvolley', gruppe: 1, spiel: null, hinweis: 'Im Spiel gibt es den Halbvolley noch nicht als eigenen Schlag.',
    kurz: 'Der Ball wird direkt nach dem Aufspringen genommen – ganz tief über dem Boden.',
    schritte: ['Tief in die Knie, Schläger knapp über dem Boden.', 'Den Ball direkt nach dem Aufspringen treffen, Schläger fast senkrecht.', 'Sanft nach vorn und oben anheben.'],
    tipp: 'Wirklich in die Knie gehen. Beim Treffen ist die Hand unter Kniehöhe.',
    posen: [P([-0.08, 0.5], 250, { tief: 0.3, neig: 0.12 }), P([0.42, 0.42], 300, { tief: 0.3, neig: 0.14 }), P([0.56, 0.74], 20, { tief: 0.22, neig: 0.1 })], von: [1.2, 0.02], nach: [1.75, 1.2] },
  { k: 'stopp-volley', name: 'Stopp-Volley', gruppe: 1, spiel: null, hinweis: 'Im Spiel gibt es den Stopp-Volley noch nicht als eigenen Schlag.',
    kurz: 'Ein ganz weicher Volley: Der Ball fällt kurz hinter das Netz.',
    schritte: ['Schläger vor dem Körper wie beim Volley.', 'Beim Treffen die Hand locker lassen und ein wenig zurücknehmen.', 'Fast keine Bewegung mehr – der Schläger „fängt“ den Ball.'],
    tipp: 'Sehr kleine Bewegung. Kann sein, dass die Uhr den Schlag nicht erkennt – dann etwas zackiger anfangen.',
    posen: [P([0.2, 1.28], 100, { tief: 0.06 }), P([0.42, 1.18], 70, { tief: 0.06 }), P([0.38, 1.1], 55, { tief: 0.06 })], von: [1.75, 1.3], nach: [1.5, 0.75] },
  { k: 'smash', name: 'Schmetterball', gruppe: 1, spiel: 'smash',
    kurz: 'Ein hoher Ball wird von oben mit voller Wucht ins Feld gehauen.',
    schritte: ['Seitlich hinstellen. Schläger hinter den Kopf, die andere Hand zeigt auf den Ball.', 'Hoch strecken und den Ball am höchsten Punkt treffen.', 'Nach unten durchschwingen, am Körper vorbei.'],
    tipp: 'Wie der Aufschlag, nur ohne den Ball selbst hochzuwerfen.',
    posen: [P([-0.2, 1.56], 255, { a: [0.3, 1.9], neig: -0.06 }), P([0.16, 1.98], 88, { a: [0.3, 1.2] }), P([0.34, 0.8], 300, { a: [0.1, 1.0], neig: 0.12 })], von: [0.9, 2.75], nach: [1.75, 0.6] },
  { k: 'rueckhand-smash', name: 'Rückhand-Schmetterball', gruppe: 1, spiel: 'smash',
    kurz: 'Ein hoher Ball über die Rückhand-Schulter – einer der schwersten Schläge.',
    schritte: ['Rücken halb zum Netz, Ellbogen hoch, Schläger hängt hinter der Schulter.', 'Arm nach oben strecken und das Handgelenk schnell nach vorn klappen.', 'Kurz nach vorn-unten ausschwingen.'],
    tipp: 'Der Schwung kommt fast nur aus Unterarm und Handgelenk.',
    posen: [P([-0.12, 1.62], 230, { a: [0.2, 1.1], neig: -0.08 }), P([0.05, 1.96], 80, { a: [0.2, 1.1], neig: -0.04 }), P([0.4, 1.5], 340, { a: [0.15, 1.05] })], von: [0.9, 2.75], nach: [1.75, 0.8] },

  // ---------------- Besondere Schläge ----------------
  { k: 'topspin-lob', name: 'Topspin-Lob', gruppe: 2, spiel: 'lob',
    kurz: 'Hoch über den Gegner am Netz. Durch den Topspin fällt der Ball hinten noch ins Feld.',
    schritte: ['Schläger ganz tief unter den Ball.', 'Steil nach oben durch den Ball bürsten.', 'Die Hand endet weit über dem Kopf.'],
    tipp: 'Noch steiler als der Topspin: fast senkrecht nach oben.',
    posen: [P([-0.36, 0.6], 230, { tief: 0.14 }), P([0.4, 0.9], 40, { tief: 0.06 }), P([0.14, 1.82], 120, { neig: -0.05 })], nach: [1.4, 2.8] },
  { k: 'slice-lob', name: 'Slice-Lob', gruppe: 2, spiel: null, hinweis: 'Im Spiel gibt es nur einen Lob (mit Topspin).',
    kurz: 'Ein hoher Verteidigungs-Ball: Der Schläger ist offen wie ein Teller und hebt den Ball hoch.',
    schritte: ['Schläger auf Hüfthöhe nach hinten, die Fläche zeigt nach oben.', 'Unter den Ball fahren und ihn anheben.', 'Langsam nach vorn oben ausschwingen.'],
    tipp: 'Ruhige, lange Bewegung – kein Reißen.',
    posen: [P([-0.32, 0.92], 190), P([0.42, 0.86], 25), P([0.5, 1.5], 50)], nach: [1.4, 2.8] },
  { k: 'vorhand-stopp', name: 'Vorhand-Stopp', gruppe: 2, spiel: 'drop',
    kurz: 'Stoppball: ganz kurz hinter das Netz, mit Rückwärtsdrall. Er bleibt fast liegen.',
    schritte: ['Ausholen wie zum Slice – der Gegner soll nichts merken.', 'Kurz und weich unter den Ball schneiden.', 'Gleich nach dem Treffen stoppen.'],
    tipp: 'Wie ein Slice, der nach dem Treffen sofort aufhört.',
    posen: [P([-0.2, 1.36], 115), P([0.42, 0.96], 40), P([0.5, 0.86], 20)], nach: [1.6, 1.3] },
  { k: 'rueckhand-stopp', name: 'Rückhand-Stopp', gruppe: 2, spiel: 'drop',
    kurz: 'Der Stoppball mit der Rückhand.',
    schritte: ['Ausholen wie zum Rückhand-Slice.', 'Mit einer Hand kurz und weich unter den Ball.', 'Sofort stoppen, die andere Hand bleibt hinten.'],
    tipp: 'Nur eine Hand am Schläger.',
    posen: [P([-0.18, 1.36], 115, { a: 'beide' }), P([0.4, 0.98], 40, { a: [-0.15, 1.1] }), P([0.48, 0.88], 20, { a: [-0.3, 1.1] })], nach: [1.6, 1.3] },
  { k: 'tweener', name: 'Tweener (zwischen den Beinen)', gruppe: 2, spiel: null, hinweis: 'Der Tweener ist ein Show-Schlag (Karriere → Show-Schläge). Dafür fehlt noch die Bewegung für die Figur.',
    kurz: 'Der Show-Schlag: mit dem Rücken zum Netz dem Ball hinterherlaufen und ihn zwischen den Beinen zurückschlagen.',
    schritte: ['Über den Ball laufen, Beine breit, Schläger hoch.', 'Schläger zwischen den Beinen nach hinten durchpeitschen.', 'Die Hand kommt hinter dir wieder heraus.'],
    tipp: 'Im Bild läuft das Männchen nach links vom Netz weg, der Ball fliegt nach rechts zum Netz zurück. Vorsicht mit den Knien!',
    posen: [P([-0.3, 1.2], 120, { neig: -0.2, breit: 0.16, a: [-0.36, 1.0] }), P([0.02, 0.4], 290, { neig: -0.28, tief: 0.12, breit: 0.16, a: [-0.4, 0.9] }), P([0.34, 0.56], 340, { neig: -0.3, tief: 0.1, breit: 0.16, a: [-0.42, 0.9] })], von: [-0.1, 0.02], nach: [1.75, 1.6] },

  // ---------------- Aufschläge ----------------
  { k: 'aufschlag-gerade', name: 'Aufschlag gerade', gruppe: 3, auf: 'gerade',
    kurz: 'Der schnellste Aufschlag. Kaum Drall – deshalb geht er oft daneben.',
    schritte: ['Ball hochwerfen, etwas vor dich. Der Schläger fällt hinter den Rücken („Rucksack“).', 'Hoch strecken und den Ball am höchsten Punkt gerade von hinten treffen.', 'Nach vorn unten durchschwingen, am Körper vorbei.'],
    tipp: 'Den Wurfarm mitmachen, auch wenn du ohne Ball übst – dann stimmt der Rhythmus.',
    posen: [P([-0.2, 1.56], 255, { a: [0.3, 1.95], neig: -0.08, tief: 0.08 }), P([0.18, 2.0], 88, { a: [0.3, 1.2] }), P([0.34, 0.8], 300, { a: [0.1, 1.0], neig: 0.14 })], von: [0.32, 2.0], nach: [1.75, 1.6] },
  { k: 'aufschlag-slice', name: 'Aufschlag Slice', gruppe: 3, auf: 'slice',
    kurz: 'Der Ball dreht seitlich und fliegt eine Kurve. Er zieht den Gegner aus dem Feld.',
    schritte: ['Ball etwas weiter zur Schlaghand-Seite werfen.', 'Außen am Ball vorbeischneiden – als würdest du ihn seitlich schälen.', 'Quer vor dem Körper ausschwingen.'],
    tipp: 'Von der Seite sieht er fast wie der gerade Aufschlag aus. Der Unterschied: Das Handgelenk dreht nicht voll nach vorn, sondern zieht zur Seite.',
    posen: [P([-0.2, 1.56], 255, { a: [0.3, 1.95], neig: -0.08, tief: 0.08 }), P([0.24, 1.94], 80, { a: [0.3, 1.2] }), P([0.22, 0.86], 285, { a: [0.1, 1.0], neig: 0.12 })], von: [0.36, 1.94], nach: [1.75, 1.6] },
  { k: 'aufschlag-kick', name: 'Aufschlag Kick', gruppe: 3, auf: 'kick',
    kurz: 'Viel Topspin: hoch über das Netz, fällt steil und springt hoch weg. Der sicherste zweite Aufschlag.',
    schritte: ['Ball über den Kopf oder sogar leicht hinter dich werfen. Ins Hohlkreuz gehen.', 'Von unten nach oben über den Ball bürsten.', 'Zur Schlaghand-Seite ausschwingen – nicht quer vor den Körper.'],
    tipp: 'Du triffst den Ball weiter hinten als sonst und schwingst nach oben statt nach vorn.',
    posen: [P([-0.26, 1.46], 262, { a: [0.16, 1.95], neig: -0.16, tief: 0.12 }), P([-0.02, 1.98], 100, { a: [0.3, 1.2], neig: -0.08 }), P([0.42, 1.02], 320, { a: [0.1, 1.0], neig: 0.06 })], von: [-0.02, 2.0], nach: [1.75, 2.1] },
  { k: 'aufschlag-unten', name: 'Aufschlag von unten', gruppe: 3, auf: 'unten',
    kurz: 'Erlaubt, aber selten: kurz und langsam, als Überraschung.',
    schritte: ['Ball vor dir fallen lassen, Schläger kurz nach hinten unten.', 'Unter Hüfthöhe von unten gegen den Ball schneiden.', 'Kurz nach vorn ausschwingen.'],
    tipp: 'Kleine, schnelle Bewegung aus dem Unterarm.',
    posen: [P([-0.36, 0.9], 225, { a: [0.34, 1.0] }), P([0.34, 0.74], 330, { neig: 0.06 }), P([0.52, 1.0], 30)], von: [0.44, 1.0], nach: [1.75, 1.3] },

  // ---------------- Kein Schlag ----------------
  { k: 'doppelklopfen', name: 'Doppelklopfen', gruppe: 4, spiel: null, hinweis: 'Im Spiel: ans Netz laufen oder zurück an die Grundlinie.',
    kurz: 'Zweimal kurz die Hände aneinander klopfen. Damit läufst du im Spiel ans Netz (und wieder zurück).',
    schritte: ['Beide Hände vor den Bauch.', 'Zweimal kurz hintereinander zusammenklopfen: tock-tock.', 'Hände wieder auseinander und still halten.'],
    tipp: 'Das Handgelenk dabei nicht drehen – daran erkennt die Uhr, dass es kein Schlag ist.',
    posen: [P([0.3, 1.1], 60, { a: [0.42, 1.08] }), P([0.36, 1.1], 60, { a: 'beide' }), P([0.3, 1.1], 60, { a: [0.42, 1.08] })], ball: false },
  { k: 'kein-schlag', name: 'Kein Schlag', gruppe: 4, spiel: null, hinweis: 'Damit die Uhr später lernt, was kein Schlag ist.',
    kurz: 'Alles, was kein Schlag ist: loslaufen, jubeln, Schweiß abwischen, Ball aufheben.',
    schritte: ['Normal dastehen.', 'Irgendetwas tun, das kein Schlag ist – zum Beispiel die Faust ballen.', 'Wieder still stehen.'],
    tipp: 'Nimm ruhig viele verschiedene Sachen auf. Je bunter, desto besser.',
    posen: [P([0.2, 0.95], 300), P([0.3, 1.5], 80), P([0.2, 0.95], 300)], ball: false },
];

// ---------------------------------------------------------------
// Das Strichmännchen ausrechnen
// ---------------------------------------------------------------
const M = 62, BODEN = 190, MITTE = 96;                 // 1 Meter = 62 Bildpunkte; hier ist der Boden und die Körpermitte
const px = ([x, y]) => [MITTE + x * M, BODEN - y * M]; // Meter → Bildpunkte (im Bild zählt "hoch" nach unten, deshalb das Minus)
const f1 = (z) => Math.round(z * 10) / 10;

// Ein Gelenk zwischen zwei Punkten finden (Ellbogen zwischen Schulter und Hand, Knie zwischen Hüfte und Fuß).
// l1, l2 = Länge der beiden Knochen. "seite" sagt, auf welche Seite das Gelenk knickt.
function gelenk(a, b, l1, l2, seite) {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  let d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.005;
  if (d > max) { b = [a[0] + dx / d * max, a[1] + dy / d * max]; dx = b[0] - a[0]; dy = b[1] - a[1]; d = max; }   // zu weit weg: Arm ganz strecken
  const entlang = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const quer = Math.sqrt(Math.max(0, l1 * l1 - entlang * entlang)) * seite;
  return { knick: [a[0] + dx / d * entlang - dy / d * quer, a[1] + dy / d * entlang + dx / d * quer], ende: b };
}

// Aus einer Pose alle Punkte des Männchens berechnen (in Metern)
function koerper(p) {
  const huefte = [p.neig * -0.3, 0.92 - p.tief];
  const schulter = [huefte[0] + p.neig, huefte[1] + 0.5];
  const kopf = [schulter[0] + p.neig * 0.3, schulter[1] + 0.2];
  const arm = gelenk(schulter, p.h, 0.3, 0.29, p.h[1] > schulter[1] + 0.25 ? 1 : -1);
  const hand = arm.ende;
  const w = p.w * Math.PI / 180;
  const kopfS = [hand[0] + Math.cos(w) * 0.52, hand[1] + Math.sin(w) * 0.52];          // Mitte vom Schlägerkopf
  const griff = [hand[0] + Math.cos(w) * 0.36, hand[1] + Math.sin(w) * 0.36];
  const andere = gelenk(schulter, p.a === 'beide' ? [hand[0] + Math.cos(w) * 0.1, hand[1] + Math.sin(w) * 0.1] : p.a, 0.3, 0.29, -1);
  const b = p.breit || 0;
  const bein1 = gelenk(huefte, [-0.2 - b, 0], 0.47, 0.47, 1), bein2 = gelenk(huefte, [0.22 + b, 0], 0.47, 0.47, 1);
  const uhr = [arm.knick[0] + (hand[0] - arm.knick[0]) * 0.78, arm.knick[1] + (hand[1] - arm.knick[1]) * 0.78];
  return { huefte, schulter, kopf, arm: [schulter, arm.knick, hand], andere: [schulter, andere.knick, andere.ende],
    bein1: [huefte, bein1.knick, bein1.ende], bein2: [huefte, bein2.knick, bein2.ende], schlaeger: [hand, griff], kopfS, uhr };
}

// Zwischen zwei Posen mischen (t = 0 … 1). So entstehen die Zwischenbilder für die Bewegung.
function mischen(p, q, t) {
  const m = (a, b) => a + (b - a) * t;
  let dw = ((q.w - p.w + 540) % 360) - 180;                       // den Schläger auf dem kürzeren Weg drehen
  const ha = (pose) => (pose.a === 'beide' ? [pose.h[0] + 0.05, pose.h[1] + 0.05] : pose.a);
  const beide = p.a === 'beide' && q.a === 'beide';
  return { h: [m(p.h[0], q.h[0]), m(p.h[1], q.h[1])], w: p.w + dw * t, neig: m(p.neig, q.neig), tief: m(p.tief, q.tief),
    breit: m(p.breit || 0, q.breit || 0), a: beide ? 'beide' : [m(ha(p)[0], ha(q)[0]), m(ha(p)[1], ha(q)[1])] };
}

const punkte = (liste) => liste.map((q) => px(q).map(f1).join(',')).join(' ');

// Ein stehendes Bild einer Pose. ball = [x, y] oder nichts.
function bild(p, ball) {
  const k = koerper(p);
  const [kx, ky] = px(k.kopf), [sx, sy] = px(k.kopfS), [ux, uy] = px(k.uhr);
  return `<line class="sb-boden" x1="8" y1="${BODEN}" x2="212" y2="${BODEN}"/>
    <g class="sb-fig"><polyline points="${punkte(k.bein1)}"/><polyline points="${punkte(k.bein2)}"/>
    <polyline points="${punkte([k.huefte, k.schulter])}"/><polyline class="sb-hinten" points="${punkte(k.andere)}"/>
    <circle class="sb-kopf" cx="${f1(kx)}" cy="${f1(ky)}" r="8"/><polyline points="${punkte(k.arm)}"/></g>
    <polyline class="sb-schl" points="${punkte(k.schlaeger)}"/><circle class="sb-schlkopf" cx="${f1(sx)}" cy="${f1(sy)}" r="10"/>
    <circle class="sb-uhr" cx="${f1(ux)}" cy="${f1(uy)}" r="3.6"/>
    ${ball ? `<circle class="sb-ball" cx="${f1(px(ball)[0])}" cy="${f1(px(ball)[1])}" r="3.6"/>` : ''}`;
}

// Wann in der Bewegung was passiert (0 = Anfang, 1 = Ende einer Runde): erst stillhalten, dann schlagen, dann stillhalten
const T_START = 0.22, T_TREFFEN = 0.42, T_ENDE = 0.58, T_ZURUECK = 0.86, DAUER = 3.2;

// Das bewegte Bild: Aus den drei Posen werden viele Zwischenbilder, und der Browser blendet sie nacheinander durch.
function film(s) {
  const [A, T, E] = s.posen;
  const bilder = [], zeiten = [];
  const dazu = (pose, zeit) => { bilder.push(koerper(pose)); zeiten.push(zeit); };
  dazu(A, 0);
  for (let i = 0; i <= 5; i++) dazu(mischen(A, T, i / 5), T_START + (T_TREFFEN - T_START) * i / 5);
  for (let i = 1; i <= 4; i++) dazu(mischen(T, E, i / 4), T_TREFFEN + (T_ENDE - T_TREFFEN) * i / 4);
  dazu(E, T_ZURUECK);
  dazu(A, 1);
  const zt = zeiten.map((z) => Math.round(z * 1000) / 1000).join(';');
  const anim = (attr, werte) => `<animate attributeName="${attr}" dur="${DAUER}s" repeatCount="indefinite" keyTimes="${zt}" values="${werte.join(';')}"/>`;
  const linie = (name, klasse = '') => `<polyline ${klasse ? `class="${klasse}" ` : ''}points="${punkte(bilder[0][name])}">${anim('points', bilder.map((b) => punkte(b[name])))}</polyline>`;
  const kreis = (name, klasse, r) => `<circle class="${klasse}" r="${r}" cx="${f1(px(bilder[0][name])[0])}" cy="${f1(px(bilder[0][name])[1])}">${
    anim('cx', bilder.map((b) => f1(px(b[name])[0])))}${anim('cy', bilder.map((b) => f1(px(b[name])[1])))}</circle>`;
  const rumpf = `<polyline points="${punkte([bilder[0].huefte, bilder[0].schulter])}">${anim('points', bilder.map((b) => punkte([b.huefte, b.schulter])))}</polyline>`;

  // Der Weg der Schlaghand als gestrichelter Pfeil
  const weg = [A, mischen(A, T, 0.5), T, mischen(T, E, 0.5), E].map((p) => koerper(p).arm[2]);

  // Der Ball: fliegt heran, wird getroffen, fliegt weg
  let ball = '';
  if (s.ball !== false) {
    const von = px(s.von || VON_VORN), treff = px(koerper(T).kopfS), nach = px(s.nach || [1.75, 1.2]);
    const bz = `0;${T_START};${T_TREFFEN};${T_ENDE + 0.1};1`;
    const b = (attr, i) => `<animate attributeName="${attr}" dur="${DAUER}s" repeatCount="indefinite" keyTimes="${bz}" values="${[von, von, treff, nach, nach].map((q) => f1(q[i])).join(';')}"/>`;
    ball = `<circle class="sb-ball" r="3.6" cx="${f1(von[0])}" cy="${f1(von[1])}">${b('cx', 0)}${b('cy', 1)}
      <animate attributeName="opacity" dur="${DAUER}s" repeatCount="indefinite" keyTimes="0;${T_START - 0.02};${T_START};${T_ENDE + 0.1};${T_ENDE + 0.12};1" values="0;0;1;1;0;0"/></circle>`;
  }
  return `<svg class="sb-film" viewBox="0 0 220 200" role="img" aria-label="Bewegung: ${s.name}">
    <defs><marker id="sb-pfeil" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>
    <line class="sb-boden" x1="8" y1="${BODEN}" x2="212" y2="${BODEN}"/>
    <polyline class="sb-weg" points="${punkte(weg)}" marker-end="url(#sb-pfeil)"/>
    <g class="sb-fig">${linie('bein1')}${linie('bein2')}${rumpf}${linie('andere', 'sb-hinten')}${kreis('kopf', 'sb-kopf', 8)}${linie('arm')}</g>
    ${linie('schlaeger', 'sb-schl')}${kreis('kopfS', 'sb-schlkopf', 10)}${kreis('uhr', 'sb-uhr', 3.6)}${ball}</svg>`;
}

// ---------------------------------------------------------------
// Die Seiten
// ---------------------------------------------------------------
const kmh = (ms) => Math.round(ms * 3.6);

// Was das Spiel aus diesem Schlag macht – die Zahlen kommen direkt aus js/schlaege.js
function imSpiel(s) {
  if (s.auf) {
    const a = AUFSCHLAEGE[s.auf];
    const tempo = a.tempo ? `${Math.round(a.tempo * 100)} % von deinem schnellsten Aufschlag` : 'ganz langsam (nur so schnell, dass er knapp über das Netz kommt)';
    const drall = [a.top ? `${a.top > 0 ? 'Topspin' : 'Rückwärtsdrall'} ${Math.abs(a.top)}` : '', a.seite ? `Seitendrall ${Math.abs(a.seite)}` : '', a.drall ? `Kick ${a.drall}` : ''].filter(Boolean).join(' · ');
    return `<b>Im Spiel:</b> Aufschlag „${a.name}“ · ${tempo} · ${drall} Umdrehungen pro Minute`;
  }
  if (!s.spiel) return `<b>Im Spiel:</b> ${s.hinweis}`;
  const a = SCHLAEGE[s.spiel];
  const tempo = a.tempo ? (a.tempo[0] === a.tempo[1] ? `${kmh(a.tempo[0])} km/h` : `${kmh(a.tempo[0])} bis ${kmh(a.tempo[1])} km/h`) : 'ganz langsam (nur so schnell, dass er knapp über das Netz kommt)';
  return `<b>Im Spiel:</b> zählt als „${a.name}“ · ${tempo} · ${a.top > 0 ? 'Topspin' : 'Rückwärtsdrall'} ${Math.abs(a.top)} Umdrehungen pro Minute`;
}

const NAMEN = ['Ausholen', 'Treffen', 'Ausschwingen'];

// Die Seite "Schlagarten": oben der gewählte Schlag mit Bildern, darunter alle Schläge zum Antippen
export function schlagbuchHtml(kuerzel) {
  const s = BUCH.find((x) => x.k === kuerzel) || BUCH[0];
  const treff = s.ball === false ? null : koerper(s.posen[1]).kopfS;
  const liste = GRUPPEN.map((g, i) => `<label>${g}</label><div class="row">${BUCH.filter((x) => x.gruppe === i).map((x) =>
    `<button class="${x === s ? 'sel' : ''}" data-a="schlagbuch" data-v="${x.k}">${x.name}</button>`).join('')}</div>`).join('');
  return `
    <div class="panel sb">
      <h3 style="margin-top:0">${s.name}</h3>
      <p>${s.kurz}</p>
      <div class="sb-bilder">
        <div class="sb-gross">${film(s)}<small class="dim">So sieht die ganze Bewegung aus (von der Seite, das Netz ist rechts)</small></div>
        <div class="sb-drei">${s.posen.map((p, i) => `<div><svg viewBox="0 0 220 200">${bild(p, i === 1 ? treff : null)}</svg>
          <b>${i + 1} · ${NAMEN[i]}</b><small>${s.schritte[i]}</small></div>`).join('')}</div>
      </div>
      <p class="sb-legende"><span class="sb-punkt uhr"></span> hier sitzt die Uhr (am Schlagarm)
        <span class="sb-punkt ball"></span> Ball <span class="sb-strich"></span> Weg deiner Hand</p>
      <p>💡 <b>Beim Aufnehmen:</b> ${s.tipp}</p>
      <p class="dim" style="margin-bottom:0">${imSpiel(s)}</p>
    </div>
    <div class="panel"><h3 style="margin-top:0">Alle Schlagarten</h3>${liste}</div>
    <p class="dim" style="font-size:13px">Die Bilder sind ein Vorschlag von uns, damit jede Aufnahme gleich abläuft – kein Tennis-Lehrbuch.
      Sie zeigen einen Rechtshänder von der Seite. Linkshänder machen dasselbe mit dem anderen Arm.</p>`;
}

// Die Seite "Schläge mit der Uhr aufnehmen": Schritt für Schritt
export function uhrHtml() {
  // Ein kleines Bild der Uhr mit ihren Knöpfen. "welcher" wird gelb hervorgehoben.
  const uhr = (zeilen, welcher) => `<svg class="sb-watch" viewBox="0 0 120 150"><rect x="38" y="0" width="44" height="150" rx="10" class="band"/>
    <rect x="10" y="22" width="100" height="106" rx="22" class="gehaeuse"/>
    ${zeilen.map((z, i) => `<rect x="20" y="${34 + i * 22}" width="80" height="18" rx="9" class="${i === welcher ? 'knopf an' : z.startsWith('·') ? 'text' : 'knopf'}"/>
      <text x="60" y="${47 + i * 22}" class="${i === welcher ? 'an' : ''}">${z.replace(/^·/, '')}</text>`).join('')}</svg>`;
  return `
    <div class="panel">
      <p style="margin-top:0">Die Aufnahme startest du <b>auf der Apple Watch</b>, nicht hier im Spiel und nicht auf dem iPhone.
        Die Uhr merkt sich dabei, wie sich dein Handgelenk bei jedem Schlag bewegt.</p>
      <div class="sb-schritte">
        <div>${uhr(['·Powershot', 'Start', '⏺ Aufnehmen', 'Testen'], 2)}<b>1 · Auf der Uhr</b>
          <small>Uhr an den Schlagarm. Powershot auf der Uhr öffnen und <b>„Schläge aufnehmen“</b> antippen (unter „Start“).
          Steht dort „Schwingen!“, erst auf „Stopp“ tippen.</small></div>
        <div>${uhr(['·Welcher Schlag?', 'Vorhand Topspin', 'Vorhand flach', 'Vorhand Slice'], 1)}<b>2 · Schlag wählen</b>
          <small>Die Liste ist lang – mit dem Finger oder der Krone nach unten rollen. Es sind dieselben Schläge wie hier im Schlagbuch.</small></div>
        <div>${uhr(['·⏺ Vorhand Topspin', '·3 / 10', 'Letzten löschen', 'Fertig'], -1)}<b>3 · Zehnmal schlagen</b>
          <small>Still stehen → ein Schlag → still halten, bis die Uhr tippt. Das zehnmal. War einer verpatzt: „Letzten löschen“.
          Nach dem zehnten hört die Aufnahme von selbst auf.</small></div>
        <div><div class="sb-handy">📱<br>📁</div><b>4 · Auf dem iPhone abholen</b>
          <small>Die Uhr schickt die Datei ans iPhone. Dort liegt sie in der App <b>Dateien</b> → „Auf meinem iPhone“ → Powershot → Aufnahmen.
          Von da per AirDrop auf den Computer, in den Ordner <code>aufnahmen</code> im Projekt.</small></div>
      </div>
    </div>
    <div class="panel help"><h3 style="margin-top:0">Damit die Aufnahmen gut werden</h3><ul>
      <li><b>Immer gleich anfangen:</b> Schläger vor dem Körper, zwei Sekunden still stehen. Die Uhr schneidet von selbst aus:
        von kurz vor dem Schlag bis kurz danach (zusammen etwa eine Sekunde).</li>
      <li><b>Ein Schlag in einem Zug:</b> Ausholen, Treffen, Ausschwingen ohne Pause. Wie genau, zeigt das Schlagbuch.</li>
      <li><b>Kräftig genug:</b> Die Uhr zählt erst, wenn du wirklich schwingst. Tippt sie nicht, war es zu sanft.</li>
      <li><b>Mit echtem Schläger</b> und am besten mit Ball. Ohne Ball geht auch, dann aber so tun, als wäre einer da.</li>
      <li><b>Die Uhr sitzt immer gleich:</b> gleicher Arm, gleich fest, Krone auf derselben Seite.</li>
      <li>Lieber mehrere Serien an verschiedenen Tagen als eine einzige.</li></ul></div>
    <div class="panel help"><h3 style="margin-top:0">Was passiert mit den Aufnahmen?</h3><ul>
      <li>Ansehen am Computer: Dateien in den Ordner <code>aufnahmen</code> legen, <code>python tools/server.py</code> starten
        und <code>http://localhost:8765/tools/aufnahmen.html</code> öffnen.</li>
      <li><b>Ehrlich gesagt:</b> Im Spiel ändern die Aufnahmen noch nichts. Sie sind die Sammlung, mit der die Uhr später
        lernen soll, die Schlagarten zu unterscheiden. Bis jetzt erkennt sie nur „Schwung“ und „von oben“.</li>
      <li>Die Uhr misst nur das Handgelenk. Für die Bewegung der ganzen Figur (Beine, Körper) braucht es andere Aufnahmen.</li>
      <li>Die Uhr-App gibt es nur zusammen mit der iPhone-App (TestFlight). Fehlt sie auf der Uhr: auf dem iPhone die App
        „Watch“ öffnen → nach unten zu „Verfügbare Apps“ → Powershot installieren.</li></ul></div>`;
}
