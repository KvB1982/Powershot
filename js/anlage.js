// Powershot – Die Turnieranlage.
//
// Die großen Turniere (Grand Slams, Masters, ATP Finals) haben jedes ihr eigenes Gelände, dem echten nachempfunden.
// Die Lagepläne stehen in gelaende.js, gebaut werden sie in gelaendebau.js, die Wege um die Häuser herum sucht wege.js.
// Kleine Turniere benutzen weiter die einfache Anlage unten in dieser Datei (Häuser im Kreis).
//
// Du läufst frei über die Anlage. Gesteuert und geschaut wird wie auf dem Pferdehof im Spiel „Reitturnier“:
//   Laufen: Tasten W A S D / Pfeile oder mit einem Finger ziehen (wie ein Steuerknüppel). „Oben“ heißt immer: von der Kamera weg.
//           Ein kurzer Tipp auf ein Gebäude lässt die Figur von selbst hinlaufen.
//   Kamera: kreist um die Figur. Knöpfe ⟲ ⟳ ＋ － und 🗺️ (Übersicht), Tasten Q/R drehen, T/G zoomen, M Übersicht,
//           Maus: rechte Taste ziehen und Mausrad, iPad: zwei Finger kneifen = nah/weit, gemeinsam seitlich wischen = rundherum drehen, hoch/runter wischen = Blickwinkel.
//
// Einfache Anlage (kleine Turniere): Alle Gebäude stehen im Kreis um einen Platz in der Mitte, die Türen zeigen zur Mitte.
// So kommt man von jeder Tür geradeaus zu jeder anderen, ohne durch ein Haus zu laufen.
import * as THREE from 'three';
import { requisit } from './requisiten.js';
import { planVon, planAus } from './gelaende.js';
import { baueGelaende, gluecksballBauen, fahrerSetzen, schildBauen, pfeileBauen } from './gelaendebau.js';
import { Besucher } from './besucher.js';
import { gitterBauen, frei, weg, naechsteFreie, hoeheBei } from './wege.js';
import { ladeModelle, fehltNoch } from './gelaendemodelle.js';
import { streckeBauen, ortAuf, TEMPO_KURVE } from './hotelfahrt.js';
import { TIPP_WEIT } from './hotelweg.js';

// ---- Zahlen zum Einstellen ----
const TEMPO = 3.4;            // so schnell läuft die Figur (Meter pro Sekunde)
const TEMPO_GROSS = 4.0;      // auf den großen Geländen joggt sie, die Wege sind dort lang (schneller sähe nach Sprint aus)
const GEH_BIS = 1.9;          // bis zu diesem Tempo wird gegangen, darüber geht das Gehen nach und nach ins Joggen über
// Kamera: w = Drehung um die Figur (0 = von vorn/Süden), e = Neigung (0 flach … 1.5 von oben), d = Abstand in Metern
const KAM_START = { w: 0, e: 0.7, d: 15 }, KAM_WEIT = { e: 1.05, d: 46 };
// Kamera von Hand: wie stark Wischen dreht und neigt (Bogenmaß je Pixel) und wie weit man gehen darf
const DREH_FINGER = 0.009, NEIG_FINGER = 0.007;      // zwei Finger gemeinsam schieben (ein Bildschirm breit ≈ einmal ganz herum)
const DREH_MAUS = 0.008, NEIG_MAUS = 0.006;          // rechte Maustaste ziehen
const NEIG_MIN = 0.04, NEIG_MAX = 1.54;              // fast flach über dem Boden … fast senkrecht von oben
const NAH_MIN = 2.5;                                 // so nah darf die Kamera an die Figur (Meter)
const FERN_MAL = 2.6;                                // so weit weg: 2,6-mal die Übersicht – das ganze Gelände wird klein wie ein Modell
const BESUCHER_MAX = 130;     // so viele Besucher sind höchstens auf einem Gelände unterwegs
const BESUCHER_WENIG = 24;    // … und so viele bei Qualität „niedrig“
const DRINNEN_D = 9, DRINNEN_E = 1.0;      // Kamera in einem Haus: höchstens so weit weg und mindestens so steil von oben
const BALL_NAH = 1.4;         // so nah muss man an den Glücksball heran, um ihn aufzuheben
const TUER_NAH = 1.6;         // so nah an der Tür (Meter) gilt: „du bist da“
const RING_X = 17, RING_Z = 13;   // so groß ist der Kreis, auf dem die Gebäude stehen
const RAND = 24;              // weiter als so kommt man nicht von der Mitte weg

// Die Orte: wo auf dem Kreis (winkel in Grad, 0 = hinten in der Mitte), wie groß (breit, tief, hoch), Farbe und was man dort machen wird
export const ORTE = [
  { id: 'court', name: 'Centre Court', winkel: 0, b: 12, t: 7, h: 5, farbe: 0x1f3a5a, text: 'Hier spielst du dein Match.' },
  { id: 'training', name: 'Trainingsplatz', winkel: 48, b: 8, t: 6, h: 0.1, farbe: 0x2f6aa8, platz: true, text: 'Einschlagen, Aufschlag-Ziele, Beinarbeit – Übung für genau eine Fähigkeit.' },
  { id: 'kraft', name: 'Kraftraum', winkel: 92, b: 6, t: 5, h: 3, farbe: 0x8a3a2a, text: 'Macht deinen Aufschlag schneller und dich ausdauernder – kostet aber Frische.' },
  { id: 'physio', name: 'Physio', winkel: 130, b: 5, t: 4, h: 2.8, farbe: 0x2a8a7a, text: 'Massage, Tapen und Eisbad: Du bekommst Frische zurück.' },
  { id: 'hotel', name: 'Fahrdienst zum Hotel', winkel: 180, b: 4.4, t: 2, h: 1.5, farbe: 0xe8e8ee, auto: true, text: 'Der Tag ist zu Ende. Morgen geht es weiter.' },
  { id: 'essen', name: 'Spieler-Restaurant', winkel: 228, b: 6, t: 4.5, h: 2.8, farbe: 0xc88a2a, text: 'Nudeln vor dem Match geben Kraft für lange Ballwechsel.' },
  { id: 'saiten', name: 'Besaiter', winkel: 268, b: 4.5, t: 4, h: 2.6, farbe: 0x6a4ac8, text: 'Schläger neu bespannen: fester für mehr Kontrolle, lockerer für mehr Kraft.' },
  { id: 'presse', name: 'Pressesaal', winkel: 312, b: 6, t: 5, h: 3.2, farbe: 0x4a5a6a, text: 'Die Reporter haben Fragen. Gute Antworten bringen Fans.' },
];
// Autogramme gibt es am Zaun mitten auf dem Platz
const ZAUN = { id: 'fans', name: 'Autogramm-Zaun', x: -4.5, z: -2.5, text: 'Kinder halten Bälle und Kappen hin. Unterschreiben bringt Fans.' };

const grad = (g) => g * Math.PI / 180;

// Der flachste erlaubte Blickwinkel bei diesem Abstand: nah darf die Kamera ganz flach schauen, weit weg muss sie über den Dächern bleiben
// Beschriftungen: Höhe eines Schilds in Bildpunkten (nah / fern), wie viele Etagen übereinander, ab welchem Kamera-Abstand auch bloße Namen
const SCHILD_GROSS = 30, SCHILD_KLEIN = 19, SCHILD_ETAGEN = 8, NAMEN_AB = 26;
const SCHILD_OBEN = 68, SCHILD_RECHTS = 74;      // oben liegt die Leiste mit „Zurück“, rechts die Kamera-Knöpfe – dort kein Schild
// Freie Kamera: so nah darf sie heran, so hoch schwebt sie mindestens, so weit darf sie über den Zaun hinaus (alles Meter)
const FREI_NAH = 30, FREI_HOCH = 24, FREI_RAND = 160;
const DOPPEL_ZEIT = 380, DOPPEL_WEIT = 44;         // Doppel-Tipp: höchstens so viele Millisekunden und Bildpunkte auseinander
const SCHILDER_MERKEN = 'powershot.schilder.v1';
// Fahrt ins Hotel: so stark gibt der Fahrer Gas und bremst (Meter pro Sekunde, jede Sekunde), so weit hinter dem Wagen fährt die Kamera mit
const GAS = 2.6, BREMSE = 5, FAHRT_KAMERA = { d: 23, e: 0.46, seite: 0.5 };
const WARTEN_HOECHSTENS = 6;      // länger als so viele Sekunden wartet der Fahrer an einer Einmündung nicht auf eine Lücke
const STADT_FERN = 42;            // im Städtchen (zu Fuß zum Hotel) darf die Kamera nur so weit weg – sonst sähe man das Hotel sofort
const ZIEL_SICHTBAR = 26;         // erst so nah am Hotel erscheint dort das Schild „Dein Hotel“

function flachMin(d) {
  const hoch = 30 * Math.max(0, Math.min(1, (d - 25) / 35));
  return Math.asin(Math.min(0.99, hoch / d));
}

export class Anlage {
  constructor(game) {
    this.game = game;
    this.an = false;
    this.gruppe = null;
    this.tasten = {};
    this.zwei = null;          // die zwei Finger im letzten Bild (für Kneifen und Wischen)
    this.finger = {};          // alle Finger (oder die Maus), die gerade aufliegen: id → { x0, y0, x, y, rechts }
    this.knueppel = null;      // id des Fingers, der gerade läuft
    this.kamTaste = null;      // welcher Kamera-Knopf gerade gedrückt ist ('links', 'rechts', 'nah', 'fern')
    this.frei = null;          // freie Kamera: { x, z } = die Stelle am Boden, auf die sie schaut. null = sie folgt der Figur
    this.blick = { x: 0, z: 0 };   // dorthin schaut die Kamera gerade (merken wir uns, damit die freie Kamera ohne Ruck losfährt)
    this.letzterTipp = null;   // der letzte kurze Tipp (für den Doppel-Tipp)
    this.wennFrei = null;      // wird aufgerufen, wenn die Kamera frei wird oder zur Figur zurückkehrt (app.js färbt den Knopf 🎯)
    this.schilderAn = true;    // Beschriftungen zeigen? (Knopf 🏷️ oder Taste B)
    try { this.schilderAn = localStorage.getItem(SCHILDER_MERKEN) !== 'aus'; } catch (e) { /* kein Speicher: einfach an */ }
    this.pfeile = null;        // die Verbindungs-Pfeile von den Schildern zu ihren Orten
    this.kam = { ...KAM_START, zw: KAM_START.w, ze: KAM_START.e, zd: KAM_START.d };    // z… = wohin die Kamera will
    this.amOrt = null;         // der Ort, an dessen Tür die Figur gerade steht
    this.wennDa = null;        // wird aufgerufen, wenn sich amOrt ändert (app.js zeigt dann das Fenster)
    // Tasten, Maus und Finger – hören nur zu, solange die Anlage an ist
    const meins = (e) => this.an && !e.target.closest('button, .panel');
    addEventListener('keydown', (e) => { if (!this.an) return; this.tasten[e.code] = true; if (e.code === 'KeyM') this.uebersicht(); if (e.code === 'KeyF') this.zurFigur(); if (e.code === 'KeyB' && !e.repeat) { this.schilderSchalten(); if (this.wennSchilder) this.wennSchilder(this.schilderAn); } });
    addEventListener('keyup', (e) => { this.tasten[e.code] = false; });
    addEventListener('contextmenu', (e) => { if (meins(e)) e.preventDefault(); });
    addEventListener('wheel', (e) => { if (meins(e)) { this.kam.zd *= Math.exp(e.deltaY * 0.001); this.kamGrenzen(); } }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (!meins(e)) return;
      // Maus: mittlere Taste oder Umschalt + linke Taste = die Ansicht verschieben
      this.finger[e.pointerId] = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, rechts: e.button === 2, schieb: e.button === 1 || (e.button === 0 && e.shiftKey && e.pointerType === 'mouse'), weg: 0 };
      if (e.button === 1) e.preventDefault();
      const n = Object.keys(this.finger).length, f = this.finger[e.pointerId];
      // ein Finger läuft (Steuerknüppel), zwei drehen die Kamera, drei verschieben sie. Ist die Kamera schon frei, verschiebt auch ein Finger.
      if (n === 1 && e.button === 0 && !f.schieb && !this.frei) this.knueppel = e.pointerId; else this.knueppel = null;
    });
    addEventListener('pointermove', (e) => {
      const f = this.finger[e.pointerId];
      if (!f) return;
      const dx = e.clientX - f.x, dy = e.clientY - f.y, k = this.kam;
      f.weg += Math.hypot(dx, dy);
      if (f.rechts) { k.zw -= dx * DREH_MAUS; k.ze += dy * NEIG_MAUS; }
      else if (Object.keys(this.finger).length === 1 && (f.schieb || (this.frei && this.knueppel === null)) && f.weg > 6) this.schieben(dx, dy);
      // (Zwei Finger: Das rechnet zweiFinger() einmal pro Bild aus – dann ist es egal, welcher Finger sich zuerst meldet.)
      f.x = e.clientX; f.y = e.clientY;
      this.kamGrenzen();
    });
    const los = (e) => {
      const f = this.finger[e.pointerId];
      delete this.finger[e.pointerId];
      if (this.knueppel === e.pointerId) this.knueppel = null;
      // Nur ein kurzer Tipp (kaum bewegt)? Dann ist das ein Ziel zum Hinlaufen.
      if (this.an && f && !f.rechts && !f.schieb && f.weg < 12 && e.type === 'pointerup' && !e.target.closest('button, .panel')) {
        const jetzt = performance.now(), l = this.letzterTipp;
        if (l && jetzt - l.zeit < DOPPEL_ZEIT && Math.hypot(e.clientX - l.x, e.clientY - l.y) < DOPPEL_WEIT) {
          // Doppel-Tipp: Die Kamera kehrt zur Figur zurück. Der erste der beiden Tipps soll die Figur dabei nicht losschicken.
          this.letzterTipp = null;
          if (this.frei) { this.ziel = l.ziel; this.pfad = l.pfad; }
          this.zurFigur();
        } else {
          this.letzterTipp = { zeit: jetzt, x: e.clientX, y: e.clientY, ziel: this.ziel, pfad: this.pfad };
          this.tipp(e.clientX, e.clientY);
        }
      }
    };
    // Safari auf dem iPad will beim Kneifen die ganze Seite vergrößern – das soll hier nur die Kamera tun
    for (const n of ['gesturestart', 'gesturechange']) addEventListener(n, (e) => { if (this.an) e.preventDefault(); }, { passive: false });
    addEventListener('touchmove', (e) => { if (this.an && e.touches.length > 1 && meins(e)) e.preventDefault(); }, { passive: false });
    addEventListener('pointerup', los);
    addEventListener('pointercancel', los);
  }

  // Zwei Finger auf dem Bildschirm. Wir schauen auf zwei Dinge: den Abstand der Finger und ihre Mitte.
  //   Abstand wird größer/kleiner (kneifen)  = näher heran / weiter weg
  //   Mitte wandert nach links/rechts        = Kamera dreht sich um die Figur (geht immer weiter rundherum)
  //   Mitte wandert nach oben/unten          = Blickwinkel: flach über den Boden bis fast senkrecht von oben
  zweiFinger() {
    const ff = Object.values(this.finger).filter((f) => !f.rechts);
    // Drei Finger: die Ansicht über das Gelände schieben (links/rechts, vor/zurück) – die Kamera löst sich dabei von der Figur
    if (ff.length >= 3) {
      const x = (ff[0].x + ff[1].x + ff[2].x) / 3, y = (ff[0].y + ff[1].y + ff[2].y) / 3, d = this.drei;
      if (d && d.a === ff[0] && d.b === ff[1] && d.c === ff[2]) this.schieben(x - d.x, y - d.y);
      this.drei = { a: ff[0], b: ff[1], c: ff[2], x, y };
      this.zwei = null;
      return;
    }
    this.drei = null;
    if (ff.length < 2) { this.zwei = null; return; }
    const [a, b] = ff, k = this.kam;
    const jetzt = { a, b, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, weit: Math.hypot(a.x - b.x, a.y - b.y) };
    const z = this.zwei;
    if (z && z.a === a && z.b === b) {      // dieselben zwei Finger wie im Bild davor
      if (z.weit > 8 && jetzt.weit > 8) k.zd *= z.weit / jetzt.weit;
      k.zw -= (jetzt.x - z.x) * DREH_FINGER;
      k.ze += (jetzt.y - z.y) * NEIG_FINGER;
    }
    this.zwei = jetzt;
  }

  // Die Ansicht um (dx, dy) Bildpunkte verschieben – wie eine Landkarte, die man mit dem Finger zieht.
  // Beim ersten Mal löst sich die Kamera von der Figur („freie Kamera“).
  schieben(dx, dy) {
    if (!this.plan || this.zuFuss() || this.fahrt) return;      // nur auf den Geländen mit Lageplan – und nicht im Städtchen (dort soll man den Weg ja suchen)
    const k = this.kam, g = this.game, r = this.plan.g.rand;
    if (!this.frei) {
      this.frei = { x: this.blick.x, z: this.blick.z };
      this.knueppel = null;
      k.zd = Math.max(k.zd, FREI_NAH);
      if (this.wennFrei) this.wennFrei(true);
    }
    // Wie viele Meter ist ein Bildpunkt? Je weiter die Kamera weg ist, desto mehr.
    const H = g.renderer.domElement.clientHeight || 800;
    const m = 2 * k.d * Math.tan(g.camera.fov * Math.PI / 360) / H;
    const tief = m / Math.max(0.35, Math.sin(k.e));      // schräg von der Seite ist der Boden „gestaucht“ – dann geht es nach hinten schneller
    const c = Math.cos(k.w), s = Math.sin(k.w), f = this.frei;
    f.x += -dx * m * c - dy * tief * s;
    f.z += dx * m * s - dy * tief * c;
    f.x = Math.max(r.x0 - FREI_RAND, Math.min(r.x1 + FREI_RAND, f.x));
    f.z = Math.max(r.z0 - FREI_RAND, Math.min(r.z1 + FREI_RAND, f.z));
  }
  // Zurück zur Figur (Doppel-Tipp, Knopf 🎯 oder Taste F)
  zurFigur() {
    if (!this.frei) return;
    this.frei = null;
    if (this.kam.zd > 45) { this.kam.zd = KAM_START.d; this.kam.ze = KAM_START.e; }      // von weit oben wieder nah heran
    if (this.wennFrei) this.wennFrei(false);
  }

  kamGrenzen() {
    const k = this.kam;
    if (this.frei) k.zd = Math.max(FREI_NAH, k.zd);
    k.zd = Math.max(NAH_MIN, Math.min(this.zuFuss() ? STADT_FERN : this.plan ? this.weit * FERN_MAL : 90, k.zd));
    k.ze = Math.max(NEIG_MIN, flachMin(k.zd), Math.min(NEIG_MAX, k.ze));
    if (this.drinnen && !this.frei) { k.zd = Math.min(k.zd, 16); k.ze = Math.max(k.ze, 0.75); }      // im Haus nicht zu weit weg und nicht zu flach, sonst sieht man nur Wand
  }

  // 🗺️ Übersicht: einmal drücken = von weit oben auf die ganze Anlage, noch einmal = zurück zur Figur
  uebersicht() {
    if (this.fahrt) return;                                // während der Fahrt bleibt die Kamera beim Wagen
    const fern = this.zuFuss() ? STADT_FERN : this.plan ? this.weit : KAM_WEIT.d;
    if (this.frei) { this.zurFigur(); this.kam.zd = KAM_START.d; }
    const k = this.kam, weit = k.zd > fern * 0.6;
    k.zd = weit ? KAM_START.d : fern;
    k.ze = weit ? KAM_START.e : KAM_WEIT.e;
    const w0 = this.plan && this.plan.g.kamW || 0;
    if (weit) k.zw = w0 + Math.round((k.zw - w0) / (Math.PI * 2)) * Math.PI * 2;
  }

  // Ein großes Gelände nach Lageplan aufbauen (Grand Slam, Masters, ATP Finals)
  starteGelaende(plan) {
    const g = this.game, r = plan.g.rand;
    this.plan = plan;
    this.gitter = gitterBauen(r, plan.sperren);
    this.mitte = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
    this.weit = Math.max((r.x1 - r.x0) / Math.max(1, Math.min(1.7, g.aspect)) * 1.55, (r.z1 - r.z0) * 1.35);       // so weit weg ist die Kamera in der Übersicht
    this.gruppe = new THREE.Group();                // hier hängt alles dran: das gebaute Gelände, Licht, Besucher, Glücksball
    g.scene.add(this.gruppe);
    this.orte = plan.orte;
    this.hindernisse = [];
    this.drinnen = null;
    this.bauen();
    // Die fertigen 3D-Modelle nachladen. Sind sie da (und das Gelände ist noch offen), wird es mit ihnen neu gebaut.
    if (fehltNoch(this.bau.gewollt)) {
      const gewollt = this.bau.gewollt;
      ladeModelle(gewollt).then(() => { if (this.plan === plan && this.gruppe) { this.bauen(); if (this.bau.gewollt.size > gewollt.size) ladeModelle(this.bau.gewollt).then(() => { if (this.plan === plan && this.gruppe) this.bauen(); }); } });
    }
    // Eigenes Tageslicht (das Licht vom Stadion ist vielleicht Flutlicht bei Nacht)
    this.altesLicht = g.stadium.lights.filter((l) => l.visible);
    for (const l of this.altesLicht) l.visible = false;
    const himmel = new THREE.HemisphereLight(0xffffff, 0x9a9484, 1.25);
    const sonne = this.sonne = new THREE.DirectionalLight(0xfff4e0, 2.3);
    sonne.castShadow = g.quality !== 'niedrig';
    sonne.shadow.mapSize.set(2048, 2048);
    Object.assign(sonne.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 260 });
    sonne.shadow.bias = -0.0008; sonne.shadow.normalBias = 0.05;
    this.gruppe.add(himmel, sonne, sonne.target);
    // Himmel und Dunst: am Tag, auch wenn das Turnier sonst abends gespielt wird
    this.alt = { hintergrund: g.scene.background, nebel: g.scene.fog.color.clone(), nah: g.camera.near, fern: g.camera.far };
    g.scene.background = new THREE.Color(0x8cc0ee);
    g.scene.fog.color.set(0xa8cdea);
    g.scene.fog.near = this.weit * 1.2; g.scene.fog.far = this.weit * 1.2 + 1500;      // weit hinten verschwinden die Berge im Dunst
    g.camera.near = 1; g.camera.far = 4000; g.camera.updateProjectionMatrix();
    // Besucher: Sie gehen von Tür zu Tür, bleiben stehen, schauen sich um und unterhalten sich (siehe besucher.js)
    const n = Math.min(g.quality === 'niedrig' ? BESUCHER_WENIG : BESUCHER_MAX, plan.g.leute ?? 110);
    this.besucher = n ? new Besucher(plan, this.gitter, n, g.quality !== 'niedrig') : null;
    if (this.besucher) this.gruppe.add(this.besucher.gruppe);
  }

  // Das Gelände aus dem Lageplan bauen – beim ersten Mal aus einfachen Formen, später noch einmal mit den geladenen Modellen
  bauen() {
    const g = this.game, plan = this.plan;
    if (this.bau) { this.wegraeumen(this.bau.gruppe); this.drinnen = null; }
    plan.namen = [];
    const namen = { ...Object.fromEntries(ORTE.concat([ZAUN]).map((o) => [o.id, { name: o.name, text: o.text }])), ...(plan.g.orteNamen || {}) };
    const bau = this.bau = baueGelaende(plan, this.gitter, { schatten: g.quality !== 'niedrig', wenig: g.quality === 'niedrig', namen });
    this.gruppe.add(bau.gruppe);
    this.klick = bau.klick;
    this.boden = bau.boden;
    this.namen = plan.namen || [];
  }
  // Alles Selbstgebaute einer Gruppe wieder freigeben (geladene Modelle bleiben, die werden noch gebraucht)
  wegraeumen(gruppe) {
    gruppe.traverse((m) => {
      if (m.userData.nurStoff) m.material.dispose();                       // ein fahrendes Auto: nur seine eigene Lackfarbe freigeben, die Form wird noch gebraucht
      if (!m.userData.eigen || !m.material) return;
      if (m.isMesh) m.geometry.dispose();
      if (m.material.map) m.material.map.dispose();
      m.material.dispose();
    });
    gruppe.removeFromParent();
  }
  // Bin ich in einem Haus? Dann verschwinden Dach und Außenwände dieses Hauses, und man sieht hinein wie in ein Puppenhaus.
  drinnenPruefen() {
    const p = this.p;
    let jetzt = null;
    for (const h of this.bau ? this.bau.raeume : []) if (Math.abs(p.x - h.r.x) < h.r.b / 2 - 0.1 && Math.abs(p.z - h.r.z) < h.r.t / 2 - 0.1) jetzt = h;
    if (jetzt === this.drinnen) return;
    const zeig = (h, innen) => { for (const m of h.aussen) m.visible = !innen; h.innen.visible = innen; for (const o of h.r.tueren) if (o.schild) o.schild.userData.weg = innen; };
    if (this.drinnen) zeig(this.drinnen, false);
    if (jetzt) zeig(jetzt, true);
    const k = this.kam;
    if (jetzt && !this.drinnen) { this.kamDraussen = { d: k.zd, e: k.ze }; k.zd = Math.min(k.zd, DRINNEN_D); k.ze = Math.max(k.ze, DRINNEN_E); }
    else if (!jetzt && this.kamDraussen) { k.zd = this.kamDraussen.d; k.ze = this.kamDraussen.e; this.kamDraussen = null; }
    this.drinnen = jetzt;
  }

  // Den goldenen Glücksball irgendwo auf dem Gelände verstecken (nur auf den Geländen mit Lageplan)
  ballLegen() {
    if (!this.gitter || this.ball) return;
    const r = this.plan.g.rand;
    for (let versuch = 0; versuch < 200; versuch++) {
      const x = r.x0 + 3 + Math.random() * (r.x1 - r.x0 - 6), z = r.z0 + 3 + Math.random() * (r.z1 - r.z0 - 6);
      // frei, nicht direkt an einer Tür und nicht gleich neben dem Start
      if (!frei(this.gitter, x, z) || Math.hypot(x - this.p.x, z - this.p.z) < 18 || this.orte.some((o) => Math.hypot(o.tx - x, o.tz - z) < 4)) continue;
      if (!weg(this.gitter, this.p.x, this.p.z, x, z)) continue;                // man muss auch hinkommen können
      this.ball = gluecksballBauen();
      this.ball.position.set(x, 0, z);
      this.gruppe.add(this.ball);
      return;
    }
  }

  // woher = bei welchem Ort die Figur startet (ohne Angabe: beim Fahrdienst) · gelaende = Kürzel des Turniers (z. B. 'wim'), ohne = einfache Anlage
  start(woher = 'hotel', gelaende = null) {
    this.ende();
    const g = this.game;
    this.an = true;
    this.amOrt = null;
    this.pfad = null;
    this.fahrt = null; this.kamZiel = null; this.schauHoch = 0;      // Fahrt ins Hotel
    this.zeit = 0; this.uhrAn = false; this.angekommen = false;      // Stoppuhr für den Fußweg zum Hotel
    this.gelaendeId = gelaende;
    if (g.stadium.group) g.stadium.group.visible = false;      // das Stadion macht Pause
    const plan = typeof gelaende === 'string' ? planVon(gelaende) : gelaende ? planAus(gelaende) : null;      // Kürzel eines großen Turniers oder ein fertiges Gelände
    if (plan) this.starteGelaende(plan); else this.starteKreis();
    // Die Figur startet beim Fahrdienst und schaut zur Mitte
    const startOrt = this.orte.find((o) => o.id === woher) || this.orte.find((o) => o.id === 'hotel');
    const mx = this.plan ? this.mitte.x : 0, mz = this.plan ? this.mitte.z : 0;
    this.p = { x: startOrt.tx, z: startOrt.tz, vx: 0, vz: 0, blick: Math.atan2(mx - startOrt.tx, mz - startOrt.tz) };     // blick: 0 = schaut nach +z, π = nach −z
    this.ziel = null;
    g.showAvatars(false);
    if (g.avatars[0]) g.avatars[0].group.visible = true;
    g.ball.visible = g.blob.visible = g.trail.visible = false;
    if (g.maschine) g.maschine.visible = false;
    if (!this.plan) { g.scene.fog.near = 60; g.scene.fog.far = 160; }
    Object.assign(this.kam, KAM_START, { zw: KAM_START.w, ze: KAM_START.e, zd: KAM_START.d });
    // Manche Gelände schaut man sich besser von der anderen Seite an (Monte-Carlo: Blick aufs Meer)
    if (this.plan && this.plan.g.kamW) this.kam.w = this.kam.zw = this.plan.g.kamW;
    this.kamera(1);
  }

  // Die einfache Anlage für kleine Turniere: Häuser im Kreis
  starteKreis() {
    const g = this.game;
    this.plan = null; this.gitter = null; this.namen = [];
    const G = this.gruppe = new THREE.Group();
    g.scene.add(G);
    this.orte = [];
    this.klick = [];           // alles, was man antippen kann (für den Strahl von der Kamera)

    const teil = (geo, farbe, x, y, z, opts = {}) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: farbe, roughness: opts.rau ?? 0.85, map: opts.bild || null }));
      m.userData.eigen = true;
      m.position.set(x, y, z);
      m.castShadow = !!opts.schatten;
      m.receiveShadow = true;
      G.add(m);
      return m;
    };
    // Ein Schild mit Text – es schwebt über der Stelle (x, y, z) und zeigt mit einem Pfeil darauf
    const schild = (text, x, y, z) => {
      const m = schildBauen(text, 'ort', new THREE.Vector3(x, y - 1.2, z));
      G.add(m);
      return m;
    };

    // Boden: Rasen, in der Mitte ein gepflasterter Platz
    this.boden = teil(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), 0x4f8a45, 0, 0, 0);
    // Der Rasen wird beim Malen ein kleines Stück nach hinten geschoben. Sonst flackert er aus großer Entfernung durch das Pflaster.
    Object.assign(this.boden.material, { polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 40 });
    teil(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2).scale(RING_X - 2.5, 1, RING_Z - 2.5), 0xc9c2b4, 0, 0.06, 0);
    teil(new THREE.CircleGeometry(2.2, 32).rotateX(-Math.PI / 2), 0x8fb8e0, 0, 0.12, 0);          // Brunnen in der Mitte
    teil(new THREE.CylinderGeometry(2.3, 2.3, 0.35, 32, 1, true), 0xb0a898, 0, 0.17, 0);
    this.hindernisse = [{ x: 0, z: 0, r: 2.6 }];

    for (const o of ORTE) {
      // Der Ort steht auf dem Kreis und schaut zur Mitte
      const a = grad(o.winkel), x = Math.sin(a) * RING_X, z = -Math.cos(a) * RING_Z;
      const dreh = Math.atan2(-x, -z);                   // Richtung zur Mitte
      const vorn = o.t / 2 + 1.1;                        // die Tür liegt ein Stück vor dem Haus
      const ort = { ...o, x, z, tx: x + Math.sin(dreh) * vorn, tz: z + Math.cos(dreh) * vorn };
      let haus;
      if (o.platz) {
        // Trainingsplatz: eine blaue Fläche mit weißen Linien und einem Netz
        haus = teil(new THREE.BoxGeometry(o.b, 0.06, o.t), o.farbe, x, 0.09, z);
        haus.rotation.y = dreh;
        const linien = teil(new THREE.BoxGeometry(o.b * 0.82, 0.07, o.t * 0.82), 0xffffff, x, 0.1, z);
        const feld = teil(new THREE.BoxGeometry(o.b * 0.8, 0.08, o.t * 0.78), o.farbe, x, 0.11, z);
        const netz = teil(new THREE.BoxGeometry(o.b * 0.86, 0.9, 0.05), 0xf0f0f0, x, 0.45, z, { schatten: true });
        for (const m of [linien, feld, netz]) m.rotation.y = dreh;
        const maschine = requisit('ballmaschine');
        if (maschine) { maschine.position.set(x - Math.sin(dreh) * 2, 0, z - Math.cos(dreh) * 2); maschine.rotation.y = dreh; G.add(maschine); }
      } else if (o.auto) {
        // Das Auto vom Fahrdienst: zwei Klötze und vier Räder
        haus = teil(new THREE.BoxGeometry(o.b, 0.8, o.t), o.farbe, x, 0.75, z, { schatten: true });
        teil(new THREE.BoxGeometry(o.b * 0.55, 0.65, o.t * 0.9), 0x9ab8d8, x, 1.45, z, { schatten: true });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) teil(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14).rotateX(Math.PI / 2), 0x1a1a1a, x + sx * o.b * 0.3, 0.36, z + sz * o.t * 0.5);
      } else {
        haus = teil(new THREE.BoxGeometry(o.b, o.h, o.t), o.farbe, x, o.h / 2, z, { schatten: true });
        haus.rotation.y = dreh;
        const dach = teil(new THREE.BoxGeometry(o.b + 0.6, 0.25, o.t + 0.6), 0xf0ece4, x, o.h + 0.12, z, { schatten: true });
        dach.rotation.y = dreh;
        // Tür: ein dunkles Rechteck an der Seite zur Mitte
        const tuer = teil(new THREE.BoxGeometry(1.3, 2.1, 0.1), 0x1a1a22, x + Math.sin(dreh) * o.t / 2, 1.05, z + Math.cos(dreh) * o.t / 2);
        tuer.rotation.y = dreh;
      }
      haus.userData.ort = ort;
      this.klick.push(haus);
      ort.schild = schild(o.name, x, (o.platz ? 2.2 : o.h + 1.3), z);
      // Ein heller Kreis auf dem Boden zeigt, wo man hin muss
      ort.kreis = teil(new THREE.RingGeometry(0.75, 1.0, 28).rotateX(-Math.PI / 2), 0xe8f04a, ort.tx, 0.12, ort.tz);
      // Wo man nicht durchlaufen kann: Ein breites Haus wird mit mehreren Kreisen nebeneinander nachgebaut
      if (!o.platz) {
        const r = Math.min(o.b, o.t) / 2 + 0.1, n = Math.max(1, Math.ceil(o.b / o.t)), lang = Math.max(0, o.b / 2 - r);
        for (let i = 0; i < n; i++) {
          const u = n === 1 ? 0 : -lang + 2 * lang * i / (n - 1);
          this.hindernisse.push({ x: x + Math.cos(dreh) * u, z: z - Math.sin(dreh) * u, r });
        }
      }
      this.orte.push(ort);
    }

    // Autogramm-Zaun mit drei wartenden Kindern (die Ballkinder-Modelle)
    const zaun = { ...ZAUN, tx: ZAUN.x + 1.6, tz: ZAUN.z + 1.2 };
    const gitter = teil(new THREE.BoxGeometry(4, 1.0, 0.08), 0x3a4a5a, ZAUN.x, 0.5, ZAUN.z, { schatten: true });
    gitter.rotation.y = 0.9;
    gitter.userData.ort = zaun;
    this.klick.push(gitter);
    for (let i = 0; i < 3; i++) {
      const kind = requisit('ballkind', { farbe: [0xe8442a, 0xe8f04a, 0x2a8af0][i], hell: [0.3, 0.72] });
      if (!kind) break;
      kind.position.set(ZAUN.x - 1.4 + i * 0.7, 0, ZAUN.z - 0.3 - i * 0.9);
      kind.rotation.y = 0.9;
      G.add(kind);
    }
    zaun.schild = schild(ZAUN.name, ZAUN.x, 2.6, ZAUN.z);
    zaun.kreis = teil(new THREE.RingGeometry(0.75, 1.0, 28).rotateX(-Math.PI / 2), 0xe8f04a, zaun.tx, 0.12, zaun.tz);
    this.hindernisse.push({ x: ZAUN.x, z: ZAUN.z, r: 1.5 });
    this.orte.push(zaun);

    // Ein paar Bäume zwischen den Häusern (Stamm und Kugel)
    for (const w of [24, 70, 111, 155, 205, 248, 290, 336]) {
      const a = grad(w), x = Math.sin(a) * (RING_X + 3.5), z = -Math.cos(a) * (RING_Z + 3.5);
      teil(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 8), 0x6a4a2a, x, 0.8, z, { schatten: true });
      teil(new THREE.SphereGeometry(1.5, 12, 10), 0x2f7a3a, x, 2.7, z, { schatten: true });
    }

  }

  // Ein Ziel setzen. Auf einem großen Gelände wird gleich der Weg um alle Häuser herum gesucht.
  zielSetzen(x, z, ort = null) {
    this.ziel = { x, z, ort };
    this.pfad = null;
    if (this.gitter) {
      this.pfad = weg(this.gitter, this.p.x, this.p.z, x, z);
      if (!this.pfad) { this.ziel = null; return; }
      if (this.zuFuss()) {
        // Im Städtchen läuft die Figur nur kurze Stücke von allein. Den langen Weg zum Hotel muss man selbst finden!
        let lang = 0, px = this.p.x, pz = this.p.z;
        for (const q of this.pfad) { lang += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
        if (lang > TIPP_WEIT) { this.ziel = null; this.pfad = null; if (this.wennZuWeit) this.wennZuWeit(); return; }
      }
      const letzter = this.pfad[this.pfad.length - 1];
      this.ziel.x = letzter.x; this.ziel.z = letzter.z;
    }
  }

  // Auf den Bildschirm getippt: Wohin soll die Figur laufen?
  tipp(px, py) {
    const g = this.game, el = g.renderer.domElement, r = el.getBoundingClientRect();
    const strahl = new THREE.Raycaster();
    strahl.setFromCamera(new THREE.Vector2((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1), g.camera);
    // Zuerst: Wurde ein Gebäude oder sein Schild getroffen? Dann zur Tür laufen.
    // (Schilder liegen im Bild immer obenauf, deshalb werden sie auch zuerst gefragt.)
    const treffer = strahl.intersectObjects(this.orte.map((o) => o.schild).filter((m) => m.visible), false)[0] || strahl.intersectObjects(this.klick, false)[0];
    if (treffer) {
      const ort = treffer.object.userData.ort || this.orte.find((o) => o.schild === treffer.object);
      this.zielSetzen(ort.tx, ort.tz, ort);
      return;
    }
    // Sonst: zu der Stelle auf dem Boden laufen (auf einem großen Gelände: zur nächsten freien Stelle)
    const b = strahl.intersectObject(this.boden, false)[0];
    if (!b) return;
    const stelle = this.gitter ? naechsteFreie(this.gitter, b.point.x, b.point.z) : b.point;
    if (stelle) this.zielSetzen(stelle.x, stelle.z);
  }

  // Wie viele Meter sind es von der Figur bis zu dieser Stelle, wenn man um alle Häuser herumläuft? (für die Soll-Zeit zum Hotel)
  wegLaenge(x, z) {
    const w = this.gitter ? weg(this.gitter, this.p.x, this.p.z, x, z) : null;
    let lang = 0, px = this.p.x, pz = this.p.z;
    for (const q of w || [{ x, z }]) { lang += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
    return lang;
  }

  // Zu einem Ort laufen (z. B. vom Knopf im Menü)
  geheZu(id) {
    const ort = this.orte.find((o) => o.id === id);
    if (ort) this.zielSetzen(ort.tx, ort.tz, ort);
  }

  update(dt) {
    if (this.fahrt) { this.fahrtWeiter(dt); return; }      // Fahrt ins Hotel: Da steuert niemand, der Wagen fährt von allein
    const g = this.game, p = this.p, t = this.tasten, k = this.kam;
    // --- Selbst steuern: Tasten oder ein Finger als Steuerknüppel ---
    let sx = (t.KeyD || t.ArrowRight ? 1 : 0) - (t.KeyA || t.ArrowLeft ? 1 : 0);
    let sz = (t.KeyS || t.ArrowDown ? 1 : 0) - (t.KeyW || t.ArrowUp ? 1 : 0);
    const f = this.finger[this.knueppel];
    if (f) {
      // Der Knüppel sitzt dort, wo der Finger aufgesetzt hat. Je weiter gezogen, desto schneller.
      const dx = (f.x - f.x0) / 70, dz = (f.y - f.y0) / 70;
      if (Math.hypot(dx, dz) > 0.18) { sx = dx; sz = dz; }
    }
    // „Oben“ auf dem Bildschirm ist immer von der Kamera weg, egal wie sie gedreht ist
    const kc = Math.cos(k.w), ks = Math.sin(k.w);
    let ex = sx * kc + sz * ks, ez = -sx * ks + sz * kc;
    const st = Math.min(1, Math.hypot(ex, ez));
    const tempoMax = this.plan ? TEMPO_GROSS : TEMPO;
    if (st > 0.05 && this.frei) this.zurFigur();      // wer mit den Tasten losläuft, will seine Figur auch sehen
    if (st > 0.05) this.ziel = null;           // wer selbst steuert, bricht das Hinlaufen ab
    if (this.ziel && this.pfad) {
      // Großes Gelände: den gefundenen Weg Punkt für Punkt ablaufen
      let n = this.pfad[0];
      while (this.pfad.length > 1 && Math.hypot(n.x - p.x, n.z - p.z) < 0.7) { this.pfad.shift(); n = this.pfad[0]; }
      const dx = n.x - p.x, dz = n.z - p.z, weit = Math.hypot(dx, dz);
      if (this.pfad.length === 1 && weit < 0.15) { p.vx = p.vz = 0; this.ziel = null; this.pfad = null; }
      else {
        const v = this.pfad.length > 1 ? tempoMax : Math.min(tempoMax, weit * 2.5 + 0.4);
        p.vx = dx / (weit || 1) * v; p.vz = dz / (weit || 1) * v;
      }
    } else if (this.ziel) {
      // Von selbst zum angetippten Ziel laufen
      const dx = this.ziel.x - p.x, dz = this.ziel.z - p.z, weit = Math.hypot(dx, dz);
      if (weit < 0.15) { p.vx = p.vz = 0; this.ziel = null; }
      else {
        // Richtung zum Ziel. Steht etwas im Weg (z. B. der Brunnen), biegt die Figur seitlich daran vorbei.
        let rx = dx / weit, rz = dz / weit;
        for (const h of this.hindernisse) {
          const hx = p.x - h.x, hz = p.z - h.z, hd = Math.hypot(hx, hz) || 0.001;
          if (hd > h.r + 1.3 || rx * hx + rz * hz > 0 || weit < hd) continue;      // weit weg, schon vorbei oder das Ziel liegt davor
          const seite = hx * dz - hz * dx >= 0 ? 1 : -1;
          rx += -hz / hd * seite * 1.4; rz += hx / hd * seite * 1.4;
        }
        const rl = Math.hypot(rx, rz) || 1, v = Math.min(TEMPO, weit * 2.5 + 0.4);
        p.vx = rx / rl * v; p.vz = rz / rl * v;
      }
    } else if (st > 0.05) {
      const v = tempoMax * Math.min(1, st * 1.2);
      p.vx = ex / st * v; p.vz = ez / st * v;
    } else { p.vx = p.vz = 0; }
    const tempo = Math.hypot(p.vx, p.vz);
    if (tempo > 0.2) {
      // Die Figur dreht sich weich in die Laufrichtung
      const soll = Math.atan2(p.vx, p.vz), diff = Math.atan2(Math.sin(soll - p.blick), Math.cos(soll - p.blick));
      p.blick += diff * Math.min(1, dt * 12);
    }
    if (this.gitter) {
      // Großes Gelände: Ist die neue Stelle zugebaut, rutscht die Figur an der Wand entlang (nur seitlich oder nur vor/zurück)
      const nx = p.x + p.vx * dt, nz = p.z + p.vz * dt;
      if (frei(this.gitter, nx, nz)) { p.x = nx; p.z = nz; }
      else if (frei(this.gitter, nx, p.z)) p.x = nx;
      else if (frei(this.gitter, p.x, nz)) p.z = nz;
    } else {
      p.x += p.vx * dt; p.z += p.vz * dt;
      // Nicht durch Häuser laufen und nicht vom Gelände herunter
      for (const h of this.hindernisse) {
        const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz) || 0.001;
        if (d < h.r + 0.4) { p.x = h.x + dx / d * (h.r + 0.4); p.z = h.z + dz / d * (h.r + 0.4); }
      }
      const fort = Math.hypot(p.x, p.z);
      if (fort > RAND) { p.x *= RAND / fort; p.z *= RAND / fort; }
    }

    // --- Die Figur ---
    const av = g.avatars[0];
    if (av) {
      av.group.visible = true;
      // (face: Die Figur von Spieler 0 schaut von sich aus nach −z, unser blick zählt ab +z. Darum wird umgerechnet.)
      // Langsam wird gegangen, schnell gejoggt.
      av.update(dt, { x: p.x, z: p.z, vx: p.vx, vz: p.vz, walk: true, jog: Math.max(0, Math.min(1, (tempo - GEH_BIS) / 1.4)), face: Math.PI - p.blick, faceFest: true, ohneSchlaeger: true });
    }
    if (g.avatars[1]) g.avatars[1].group.visible = false;

    if (this.besucher) this.besucher.bewege(Math.min(dt, 0.1));
    if (this.bau) fahrerSetzen(this.bau.fahrer, Math.min(dt, 0.1));                 // die Autos auf den Straßen draußen
    // --- Der Glücksball hüpft auf der Stelle. Wer nah genug ist, hebt ihn auf. ---
    if (this.ball) {
      this.ball.userData.ball.position.y = 0.9 + Math.sin(performance.now() / 300) * 0.18;
      this.ball.rotation.y += dt * 2;
      if (Math.hypot(p.x - this.ball.position.x, p.z - this.ball.position.z) < BALL_NAH) {
        this.ball.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } });
        this.ball.removeFromParent();
        this.ball = null;
        if (this.wennBall) this.wennBall();
      }
    }
    // --- Stehe ich an einer Tür? ---
    let nah = null;
    for (const o of this.orte) if (Math.hypot(p.x - o.tx, p.z - o.tz) < TUER_NAH && tempo < 0.6) nah = o;
    if (nah !== this.amOrt) { this.amOrt = nah; if (this.wennDa) this.wennDa(nah); }
    if (this.plan) this.drinnenPruefen();
    if (this.zuFuss()) {
      // Zu Fuß zum Hotel: Die Stoppuhr läuft ab dem ersten Schritt, und das Schild am Hotel erscheint erst, wenn man nah dran ist
      const z = this.orte.find((o) => o.id === 'ziel');
      if (tempo > 0.3) this.uhrAn = true;
      if (this.uhrAn && !this.angekommen) this.zeit += dt;
      if (z) {
        if (z.schild) z.schild.userData.weg = !!this.drinnen || Math.hypot(p.x - z.tx, p.z - z.tz) > ZIEL_SICHTBAR;
        if (nah === z && !this.angekommen) {
          this.angekommen = true;
          // Geschafft! Die Kamera geht ein Stück zurück und zeigt das Hotel.
          const k = this.kam;
          // (schräg die Gasse entlang – gegenüber stehen ja Häuser im Weg)
          const soll = Math.atan2(z.tx - z.wx, z.tz - z.wz) + (z.tx > 0 ? -1.3 : 1.3);
          k.zd = 21; k.ze = 0.34; k.zw += Math.atan2(Math.sin(soll - k.zw), Math.cos(soll - k.zw));
          if (this.wennAngekommen) this.wennAngekommen(this.zeit);
        }
      }
    }
    this.kamera(dt);
  }

  // Ist das hier das Städtchen, durch das man zu Fuß zum Hotel läuft? (hotelweg.js)
  zuFuss() { return !!(this.plan && this.plan.g.zuFuss); }

  // ---------------------------------------------------------------
  // Fahrt ins Hotel (Turniere mit Fahrdienst): einsteigen, der Wagen fährt über die Straße, vor dem Hotel aussteigen.
  // Wo das Hotel steht und welchen Weg der Wagen nimmt, hat hotelfahrt.js schon ausgerechnet (plan.hotel).
  // ---------------------------------------------------------------
  // Losfahren. Gibt false zurück, wenn es hier keine sichtbare Fahrt gibt (dann zeigt app.js nur ein Fenster).
  hotelFahrt() {
    const h = this.plan && this.plan.hotel;
    if (!h || this.fahrt) return false;
    if (this.frei) this.zurFigur();
    this.ziel = null; this.pfad = null; this.p.vx = this.p.vz = 0;
    // phase: 'hin' = zur Wagentür gehen · 'ein' = einsteigen · 'fahren' · 'aus' = aussteigen und zur Hoteltür gehen · 'da'
    this.fahrt = { h, strecke: streckeBauen(h.start, h.mittel), s: 0, v: 0, w: h.start.w, phase: 'hin', t: 0, ort: { x: h.start.x, z: h.start.z }, vorher: { d: this.kam.zd, e: this.kam.ze } };
    for (const halt of this.fahrt.strecke.halte) { halt.gewartet = 0; halt.durch = false; }
    return true;
  }
  // Die Fahrt abkürzen: gleich vor dem Hotel ankommen
  fahrtSpringen() {
    const f = this.fahrt;
    if (!f || f.phase === 'da') return;
    f.s = f.strecke.lang; f.v = 0; f.w = ortAuf(f.strecke, f.s).w;
    Object.assign(this.p, { x: f.h.tuer.x, z: f.h.tuer.z });
    f.phase = 'aus'; f.t = 0; f.sprung = true;
  }
  // Zurück aufs Gelände: Der Wagen steht wieder an der Haltebucht, die Figur daneben
  fahrtZurueck() {
    const f = this.fahrt, ort = this.orte.find((o) => o.id === 'hotel');
    if (!f) return;
    this.fahrt = null; this.kamZiel = null; this.schauHoch = 0;
    this.wagenSetzen(f.h.start.x, f.h.start.z, f.h.start.w);
    if (ort) Object.assign(this.p, { x: ort.tx, z: ort.tz, vx: 0, vz: 0 });
    Object.assign(this.kam, { zd: KAM_START.d, ze: KAM_START.e, zw: (this.plan.g.kamW || 0) });
    if (this.game.avatars[0]) this.game.avatars[0].group.visible = true;
    this.kamera(1);
  }
  wagenSetzen(x, z, w) {
    const wagen = this.bau && this.bau.dienst;
    if (wagen) { wagen.position.set(x, 0, z); wagen.rotation.y = w; }
  }
  // Steht dem Wagen an dieser Einmündung jemand im Weg? nur = 'alle' (einbiegen) oder 'gegen' (nur der Gegenverkehr, beim Abbiegen)
  haltBesetzt(halt, w) {
    const rx = Math.sin(w), rz = Math.cos(w);
    for (const fa of this.bau.fahrer) {
      const q = fa.wagen.position, r = fa.hin ? 1 : -1, fx = fa.laengs === 'x' ? r : 0, fz = fa.laengs === 'x' ? 0 : r;
      const bis = (halt.x - q.x) * fx + (halt.z - q.z) * fz;                 // so weit hat das Auto noch bis zur Einmündung (negativ = schon vorbei)
      const daneben = Math.abs((halt.x - q.x) * fz - (halt.z - q.z) * fx);
      if (daneben > 6 || bis < -5 || bis > 22) continue;
      if (halt.nur === 'gegen' && fx * rx + fz * rz > -0.5) continue;         // fährt in meine Richtung: der stört beim Abbiegen nicht
      return true;
    }
    return false;
  }
  fahrtWeiter(dt) {
    const g = this.game, f = this.fahrt, h = f.h, p = this.p, k = this.kam, av = g.avatars[0];
    dt = Math.min(dt, 0.1);
    f.t += dt;
    // Die Figur geht ein Stück von allein: zur Wagentür oder zur Hoteltür
    const geh = (zx, zz, tempo) => {
      const dx = zx - p.x, dz = zz - p.z, weit = Math.hypot(dx, dz);
      if (weit < 0.2) { p.vx = p.vz = 0; return true; }
      const v = Math.min(tempo, weit * 3 + 0.5);
      p.vx = dx / weit * v; p.vz = dz / weit * v; p.x += p.vx * dt; p.z += p.vz * dt;
      p.blick = Math.atan2(p.vx, p.vz);
      return false;
    };
    let sichtbar = true, vor = null;
    if (f.phase === 'hin') {
      if (geh(h.start.x, h.start.z + 1.5, 2.4) || f.t > 6) { f.phase = 'ein'; f.t = 0; p.blick = Math.PI; }
    } else if (f.phase === 'ein') {
      p.vx = p.vz = 0;
      sichtbar = f.t < 0.45;                                 // Tür auf, einsteigen, Tür zu – die Figur verschwindet im Wagen
      if (f.t > 1.1) { f.phase = 'fahren'; f.t = 0; k.zd = FAHRT_KAMERA.d; k.ze = FAHRT_KAMERA.e; }
    } else if (f.phase === 'fahren') {
      sichtbar = false;
      const st = f.strecke, da = ortAuf(st, f.s), rest = st.lang - f.s;
      let soll = Math.min(da.tempo || TEMPO_KURVE, Math.sqrt(2 * 2.2 * Math.max(0, rest)) + 0.3);
      // Vorausschauen: Kommt eine Kurve, rechtzeitig vom Gas gehen
      for (const voraus of [4, 8, 13, 19]) { const dann = ortAuf(st, f.s + voraus).tempo || TEMPO_KURVE; soll = Math.min(soll, Math.sqrt(dann * dann + 2 * 2.4 * voraus)); }
      // Einmündungen: anhalten, wenn gerade ein Auto kommt
      for (const halt of st.halte) {
        const bis = halt.s - f.s;
        if (halt.durch || bis > 26) continue;
        if (bis < -0.4 || halt.gewartet > WARTEN_HOECHSTENS || !this.haltBesetzt(halt, da.w)) { if (bis < 0.8) halt.durch = true; continue; }
        soll = Math.min(soll, Math.sqrt(2 * 3 * Math.max(0, bis - 0.3)));
        if (f.v < 0.4) halt.gewartet += dt;
      }
      // Fährt jemand dicht vor mir? Dann nicht auffahren.
      const rx = Math.sin(da.w), rz = Math.cos(da.w);
      for (const fa of this.bau.fahrer) {
        const q = fa.wagen.position, voraus = (q.x - da.x) * rx + (q.z - da.z) * rz, daneben = Math.abs((q.x - da.x) * rz - (q.z - da.z) * rx);
        if (voraus > 0 && voraus < 17 && daneben < 1.7) soll = Math.min(soll, voraus < 8 ? 0 : fa.tempo);
      }
      f.v += Math.max(-BREMSE * dt, Math.min(GAS * dt, soll - f.v));
      f.s = Math.min(st.lang, f.s + Math.max(0, f.v) * dt);
      const jetzt = ortAuf(st, f.s), diff = Math.atan2(Math.sin(jetzt.w - f.w), Math.cos(jetzt.w - f.w));
      f.w += diff * Math.min(1, dt * 7);                     // der Wagen dreht weich in die neue Richtung
      f.ort = { x: jetzt.x, z: jetzt.z };
      vor = f.ort;
      // Die Kamera fährt schräg hinter dem Wagen her
      const kw = f.w + Math.PI + FAHRT_KAMERA.seite, kd = Math.atan2(Math.sin(kw - k.zw), Math.cos(kw - k.zw));
      k.zw += kd * Math.min(1, dt * 1.3);
      if (rest < 0.2 && f.v < 0.4) {
        // Angekommen: aussteigen. Die Kamera geht weit zurück und schaut am Hotel hoch.
        f.phase = 'aus'; f.t = 0;
        Object.assign(p, { x: h.aus.x, z: h.aus.z, vx: 0, vz: 0 });
      }
    } else if (f.phase === 'aus') {
      const teil = h.teil, hoch = teil.h > 40;
      this.schauHoch = teil.h * (hoch ? 0.45 : 0.4);
      k.zd = Math.max(40, hoch ? teil.h * 1.9 : teil.breit * 1.25); k.ze = 0.16;
      // von der Straße aus auf die Vorderseite schauen
      const kw = Math.atan2(h.aus.x - h.tuer.x, h.aus.z - h.tuer.z) + 0.35, kd = Math.atan2(Math.sin(kw - k.zw), Math.cos(kw - k.zw));
      k.zw += kd * Math.min(1, dt * (f.sprung ? 30 : 1.6));
      sichtbar = f.t > 0.5 || !!f.sprung;
      if (sichtbar && (geh(h.tuer.x, h.tuer.z, 2.2) || f.t > 8)) { f.phase = 'da'; f.t = 0; p.vx = p.vz = 0; if (this.wennHotel) this.wennHotel(); }
    } else p.vx = p.vz = 0;
    if (f.phase === 'aus' || f.phase === 'da') { const e = ortAuf(f.strecke, f.strecke.lang); f.ort = { x: e.x, z: e.z }; if (f.sprung) f.w = e.w; }
    this.wagenSetzen(f.ort.x, f.ort.z, f.w);
    this.kamZiel = f.phase === 'fahren' || f.phase === 'ein' ? f.ort : f.phase === 'hin' ? null : h.tuer;
    if (av) {
      av.group.visible = sichtbar;
      const tempo = Math.hypot(p.vx, p.vz);
      av.update(dt, { x: p.x, z: p.z, vx: p.vx, vz: p.vz, walk: true, jog: 0, face: Math.PI - p.blick, faceFest: true, ohneSchlaeger: true });
      if (tempo < 0.01 && f.phase === 'da') p.blick = Math.atan2(h.aus.x - h.tuer.x, h.aus.z - h.tuer.z);      // vor dem Hotel dreht sich die Figur zur Kamera
    }
    if (g.avatars[1]) g.avatars[1].group.visible = false;
    if (this.besucher) this.besucher.bewege(dt);
    if (this.bau) fahrerSetzen(this.bau.fahrer, dt, vor);    // die anderen Autos fahren weiter – und bremsen hinter dem Fahrdienst
    this.kamera(dt);
  }

  // Die Kamera kreist um die Figur: Knöpfe und Tasten drehen und zoomen, dann fährt sie weich an ihre neue Stelle
  kamera(dt) {
    const g = this.game, p = this.kamZiel || this.p, k = this.kam, t = this.tasten;      // kamZiel: bei der Fahrt ins Hotel folgt die Kamera dem Wagen
    const knopf = this.kamTaste;
    this.zweiFinger();
    if (knopf === 'links' || t.KeyQ) k.zw += dt * 1.6; else if (knopf === 'rechts' || t.KeyR) k.zw -= dt * 1.6;
    if (knopf === 'nah' || t.KeyT) k.zd *= Math.exp(-dt * 1.4); else if (knopf === 'fern' || t.KeyG) k.zd *= Math.exp(dt * 1.4);
    this.kamGrenzen();
    const weich = Math.min(1, dt * 8);
    k.w += (k.zw - k.w) * weich; k.e += (k.ze - k.e) * weich; k.d += (k.zd - k.d) * weich;
    // Auf einem hohen, schmalen Bildschirm geht die Kamera etwas weiter weg
    let d = k.d * (g.aspect < 1 ? 1.35 : 1);
    // Weit weg bleibt die Kamera immer ein Stück über den Dächern (sonst hinge sie mitten in einer Tribüne):
    // Ab 25 m Abstand wächst die Mindesthöhe, ab 60 m sind es 30 m über dem Boden.
    // Die freie Kamera schwebt immer mindestens FREI_HOCH Meter über dem Boden – so steckt sie nie in einem Stadion
    const e = Math.max(k.e, flachMin(d), this.frei ? Math.asin(Math.min(0.99, FREI_HOCH / d)) : 0);
    const c = Math.cos(e);
    if (this.gitter && d < 60 && !this.drinnen && !this.frei) {
      // Steht ein Haus oder Stadion zwischen Kamera und Figur? Dann rückt die Kamera so nah heran, dass sie davor bleibt.
      const sx = Math.sin(k.w) * c, sz = Math.cos(k.w) * c, sy = Math.sin(e);
      for (let s = 1.5; s < d; s += 0.7) {
        if (hoeheBei(this.gitter, p.x + sx * s, p.z + sz * s) > 1.4 + sy * s) { d = Math.max(3, s - 1.2); break; }
      }
    }
    // In der Übersicht (weit weg) schaut die Kamera auf die Mitte der Anlage statt auf die Figur
    const ab = this.plan ? this.weit * 0.45 : 22, bis = this.plan ? this.weit * 0.4 : 16, zx = this.plan ? this.mitte.x : 0, zz = this.plan ? this.mitte.z : 0;
    const fern = this.fahrt ? 0 : Math.max(0, Math.min(1, (k.d - ab) / bis));
    let mx = p.x + (zx - p.x) * fern, mz = p.z + (zz - p.z) * fern + (this.plan ? fern * this.weit * 0.1 : 0);     // etwas nach unten schauen: Unten im Bild liegt das Fenster mit dem Text
    if (this.frei) { mx = this.frei.x; mz = this.frei.z; }                  // freie Kamera: schaut auf ihre eigene Stelle
    this.blick.x = mx; this.blick.z = mz;
    const von = new THREE.Vector3(mx + Math.sin(k.w) * c * d, 0.5 + Math.sin(e) * d, mz + Math.cos(k.w) * c * d);
    const nach = new THREE.Vector3(mx, Math.max(this.schauHoch || 0, 0.9 + Math.max(0, 0.6 - e) * 2.2 * Math.min(1, d / 15)), mz);      // flache Kamera schaut etwas höher (ganz nah an der Figur nicht – sonst sähe man nur Himmel)
    // Die Schilder: aus der Ferne groß (sonst kann man sie nicht lesen), aus der Nähe klein
    // (auf den großen Geländen wachsen sie in der Übersicht immer weiter mit)
    if (this.plan) {
      // Der Dunst in der Ferne rückt mit weg, wenn die Kamera weit hinausfährt – sonst wäre von weit oben alles nur hellblau
      const dunst = Math.max(this.weit * 1.2, k.d * 1.3);
      g.scene.fog.near = dunst; g.scene.fog.far = dunst + 520 + k.d;
    }
    if (this.sonne) {
      // Die Sonne wandert mit der Figur mit, damit die Schatten in ihrer Nähe scharf sind
      this.sonne.position.set(mx + 50, 110, mz + 40);
      this.sonne.target.position.set(mx, 0, mz);
    }
    const kk = dt >= 1 ? 1 : 1 - Math.exp(-6 * dt);
    g.camPos.lerp(von, kk); g.camLook.lerp(nach, kk);
    g.camera.position.copy(g.camPos);
    g.camera.lookAt(g.camLook);
    this.schilderOrdnen(dt);
  }

  // Beschriftungen an- oder abschalten (Knopf 🏷️ rechts oder Taste B). Das Spiel merkt sich die Wahl.
  schilderSchalten() {
    this.schilderAn = !this.schilderAn;
    try { localStorage.setItem(SCHILDER_MERKEN, this.schilderAn ? 'an' : 'aus'); } catch (e) { /* ohne Speicher gilt es nur bis zum Neuladen */ }
    return this.schilderAn;
  }

  // Die Schilder sauber ins Bild setzen – in jedem Bild neu, nachdem die Kamera steht.
  // 1. Für jedes Schild ausrechnen, wo sein Anker (Dach oder Tür) auf dem Bildschirm liegt.
  // 2. Das Schild ein Stück darüber schweben lassen. Ist dort schon ein anderes, rückt es eine Etage höher.
  // 3. Ein Pfeil führt vom Schild hinunter zum Anker.
  // Gerechnet wird in Bildpunkten, deshalb sind die Schilder überall gleich gut lesbar und nie halb hinter einem Haus.
  schilderOrdnen(dt) {
    const g = this.game, cam = g.camera, el = g.renderer.domElement, k = this.kam;
    const B = el.clientWidth || 1, H = el.clientHeight || 1;
    const alle = [...this.orte.map((o) => o.schild), ...this.namen].filter(Boolean);
    if (this.pfeile && this.pfeile.parent !== this.gruppe) this.pfeile = null;
    if (!this.pfeile && this.gruppe) { this.pfeile = pfeileBauen(); this.gruppe.add(this.pfeile); }
    if (!this.schilderAn) { for (const m of alle) m.visible = false; if (this.pfeile) this.pfeile.visible = false; return; }
    cam.updateMatrixWorld();
    const tan = Math.tan(cam.fov * Math.PI / 360), v = new THREE.Vector3();
    const dran = [];
    for (const m of alle) {
      const u = m.userData;
      m.visible = false;
      if (u.weg || !u.anker || (u.nurName && k.d < NAMEN_AB)) continue;
      v.copy(u.anker).applyMatrix4(cam.matrixWorldInverse);
      const tief = -v.z;                                     // so weit ist der Anker vor der Kamera
      if (tief < 1.5 || (u.nurName && tief > 900)) continue;
      const x = (v.x / (tief * tan * cam.aspect) + 1) / 2 * B, y = (1 - v.y / (tief * tan)) / 2 * H;
      if (x < 0 || x > B || y < SCHILD_OBEN || y > H + 120) continue;          // der Ort ist nicht im Bild (oder unter der Leiste oben)
      // Nah = groß, fern = kleiner, aber immer lesbar
      const h = Math.max(SCHILD_KLEIN, Math.min(SCHILD_GROSS, SCHILD_GROSS * Math.sqrt(26 / tief))) * u.gross;
      dran.push({ m, u, x, y, tief, h, b: h * u.breit });
    }
    // Die wichtigen zuerst (Türen vor bloßen Namen), dann die nahen – die bekommen den besten Platz
    dran.sort((a, c) => (a.u.nurName - c.u.nurName) || (a.tief - c.tief));
    const belegt = [], pfeile = [];
    const kk = dt >= 1 ? 1 : 1 - Math.exp(-9 * dt);
    const links = 6, rechts = B - SCHILD_RECHTS;
    for (const s of dran) {
      // Plätze durchprobieren: erst gerade darüber, dann Etage für Etage höher, jeweils auch etwas nach rechts und links versetzt
      const erst = s.h * 1.5 + 10, stufe = s.h + 5;
      let platz = null;
      for (let j = 0; j < SCHILD_ETAGEN && !platz; j++) {
        for (const seite of j ? [0, 1, -1] : [0]) {
          const cx = Math.max(links + s.b / 2, Math.min(rechts - s.b / 2, s.x + seite * (s.b * 0.5 + 14)));
          const unten = s.y - (erst + j * stufe), oben = unten - s.h;
          if (oben < SCHILD_OBEN) continue;
          if (belegt.some((r) => cx - s.b / 2 < r.x1 + 4 && cx + s.b / 2 > r.x0 - 4 && oben < r.y1 + 3 && unten > r.y0 - 3)) continue;
          platz = { dx: cx - s.x, hub: erst + j * stufe };
          break;
        }
      }
      // Oben kein Platz (zum Beispiel dicht unter der Leiste)? Dann darf das Schild einer Tür auch unter seinem Ort hängen.
      for (let j = 0; j < 3 && !platz && !s.u.nurName; j++) {
        const oben = s.y + 16 + j * stufe, unten = oben + s.h, cx = Math.max(links + s.b / 2, Math.min(rechts - s.b / 2, s.x));
        if (belegt.some((r) => cx - s.b / 2 < r.x1 + 4 && cx + s.b / 2 > r.x0 - 4 && oben < r.y1 + 3 && unten > r.y0 - 3)) continue;
        platz = { dx: cx - s.x, hub: -(16 + j * stufe) - s.h };
      }
      if (!platz) continue;                                   // nirgends Platz: Dieses Schild bleibt lieber weg, als ein anderes zu verdecken
      belegt.push({ x0: s.x + platz.dx - s.b / 2, x1: s.x + platz.dx + s.b / 2, y0: s.y - platz.hub - s.h, y1: s.y - platz.hub });
      // weich auf den neuen Platz gleiten statt springen
      const neu = s.u.hub === undefined || dt >= 1;
      s.u.hub = neu ? platz.hub : s.u.hub + (platz.hub - s.u.hub) * kk;
      s.u.dx = neu ? platz.dx : s.u.dx + (platz.dx - s.u.dx) * kk;
      const mx = s.x + s.u.dx, my = s.y - s.u.hub - s.h / 2;
      // Zurückrechnen: Bildpunkt → Stelle in der Welt, genauso weit vor der Kamera wie der Anker
      v.set((mx / B * 2 - 1) * s.tief * tan * cam.aspect, (1 - my / H * 2) * s.tief * tan, -s.tief).applyMatrix4(cam.matrixWorld);
      if (s.m.parent) s.m.parent.worldToLocal(v);
      s.m.position.copy(v);
      const hoch = s.h / H * 2 * s.tief * tan;
      s.m.scale.set(hoch * s.u.breit, hoch, 1);
      s.m.visible = true;
      // Der Pfeil beginnt am Rand des Schilds (nicht in der Mitte) und zeigt auf den Ort
      const ax = s.x - mx, ay = s.y - my, t = Math.min((s.h / 2 - 2) / Math.abs(ay || 1), Math.abs(ax) > 0.01 ? (s.b / 2 - 2) / Math.abs(ax) : 9);
      pfeile.push({ x0: mx + ax * t, y0: my + ay * t, x1: s.x, y1: s.y, dick: Math.max(1.8, s.h * 0.1) });
    }
    if (this.pfeile) { this.pfeile.visible = pfeile.length > 0; this.pfeile.userData.eckenSetzen(pfeile, B, H); }
  }

  ende() {
    if (!this.gruppe) { this.an = false; return; }
    const g = this.game;
    this.wegraeumen(this.gruppe);                       // geladene Modelle (Ballkinder, Häuser, Bäume …) bleiben im Speicher
    this.gruppe = null; this.bau = null; this.drinnen = null; this.kamDraussen = null; this.besucher = null;
    if (this.plan) {
      // Licht, Himmel und Kamera wieder so einstellen wie vorher
      for (const l of this.altesLicht) l.visible = true;
      if (this.sonne.shadow.map) this.sonne.shadow.map.dispose();
      g.scene.background = this.alt.hintergrund;
      g.scene.fog.color.copy(this.alt.nebel);
      g.camera.near = this.alt.nah; g.camera.far = this.alt.fern; g.camera.updateProjectionMatrix();
    }
    this.plan = null; this.gitter = null; this.sonne = null; this.pfad = null; this.namen = []; this.ball = null;
    this.fahrt = null; this.kamZiel = null; this.schauHoch = 0;
    this.an = false; this.frei = null; this.drei = null; this.letzterTipp = null;
    this.finger = {};
    this.knueppel = null;
    this.kamTaste = null;
    this.tasten = {};
    if (g.stadium.group) g.stadium.group.visible = true;
    g.scene.fog.near = 70; g.scene.fog.far = 190;
    if (g.avatars[0]) g.avatars[0].m.racket.visible = true;
  }
}
