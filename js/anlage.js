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
import { baueGelaende, laeuferBauen, gluecksballBauen } from './gelaendebau.js';
import { gitterBauen, frei, weg, naechsteFreie, hoeheBei } from './wege.js';
import { ladeModelle, fehltNoch } from './gelaendemodelle.js';

// ---- Zahlen zum Einstellen ----
const TEMPO = 3.4;            // so schnell läuft die Figur (Meter pro Sekunde)
const TEMPO_GROSS = 5.4;      // auf den großen Geländen joggt sie schneller, die Wege sind dort lang
const GEH_BIS = 2.0;          // bis zu diesem Tempo wird gegangen, darüber gejoggt
// Kamera: w = Drehung um die Figur (0 = von vorn/Süden), e = Neigung (0 flach … 1.5 von oben), d = Abstand in Metern
const KAM_START = { w: 0, e: 0.7, d: 15 }, KAM_WEIT = { e: 1.05, d: 46 };
// Kamera von Hand: wie stark Wischen dreht und neigt (Bogenmaß je Pixel) und wie weit man gehen darf
const DREH_FINGER = 0.009, NEIG_FINGER = 0.007;      // zwei Finger gemeinsam schieben (ein Bildschirm breit ≈ einmal ganz herum)
const DREH_MAUS = 0.008, NEIG_MAUS = 0.006;          // rechte Maustaste ziehen
const NEIG_MIN = 0.04, NEIG_MAX = 1.54;              // fast flach über dem Boden … fast senkrecht von oben
const NAH_MIN = 2.5;                                 // so nah darf die Kamera an die Figur (Meter)
const FERN_MAL = 2.6;                                // so weit weg: 2,6-mal die Übersicht – das ganze Gelände wird klein wie ein Modell
const LAEUFER = 26;           // so viele Besucher laufen höchstens über ein großes Gelände (die übrigen stehen)
const DRINNEN_D = 9, DRINNEN_E = 1.0;      // Kamera in einem Haus: höchstens so weit weg und mindestens so steil von oben
const LAEUFER_TEMPO = 1.3;    // Meter pro Sekunde – gemütliches Schlendern
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
    this.kam = { ...KAM_START, zw: KAM_START.w, ze: KAM_START.e, zd: KAM_START.d };    // z… = wohin die Kamera will
    this.amOrt = null;         // der Ort, an dessen Tür die Figur gerade steht
    this.wennDa = null;        // wird aufgerufen, wenn sich amOrt ändert (app.js zeigt dann das Fenster)
    // Tasten, Maus und Finger – hören nur zu, solange die Anlage an ist
    const meins = (e) => this.an && !e.target.closest('button, .panel');
    addEventListener('keydown', (e) => { if (!this.an) return; this.tasten[e.code] = true; if (e.code === 'KeyM') this.uebersicht(); });
    addEventListener('keyup', (e) => { this.tasten[e.code] = false; });
    addEventListener('contextmenu', (e) => { if (meins(e)) e.preventDefault(); });
    addEventListener('wheel', (e) => { if (meins(e)) { this.kam.zd *= Math.exp(e.deltaY * 0.001); this.kamGrenzen(); } }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (!meins(e)) return;
      this.finger[e.pointerId] = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, rechts: e.button === 2, weg: 0 };
      const n = Object.keys(this.finger).length;
      if (n === 1 && e.button !== 2) this.knueppel = e.pointerId; else this.knueppel = null;     // ein Finger läuft, zwei drehen die Kamera
    });
    addEventListener('pointermove', (e) => {
      const f = this.finger[e.pointerId];
      if (!f) return;
      const dx = e.clientX - f.x, dy = e.clientY - f.y, k = this.kam;
      f.weg += Math.hypot(dx, dy);
      if (f.rechts) { k.zw -= dx * DREH_MAUS; k.ze += dy * NEIG_MAUS; }
      // (Zwei Finger: Das rechnet zweiFinger() einmal pro Bild aus – dann ist es egal, welcher Finger sich zuerst meldet.)
      f.x = e.clientX; f.y = e.clientY;
      this.kamGrenzen();
    });
    const los = (e) => {
      const f = this.finger[e.pointerId];
      delete this.finger[e.pointerId];
      if (this.knueppel === e.pointerId) this.knueppel = null;
      // Nur ein kurzer Tipp (kaum bewegt)? Dann ist das ein Ziel zum Hinlaufen.
      if (this.an && f && !f.rechts && f.weg < 12 && e.type === 'pointerup' && !e.target.closest('button, .panel')) this.tipp(e.clientX, e.clientY);
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

  kamGrenzen() {
    const k = this.kam;
    k.zd = Math.max(NAH_MIN, Math.min(this.plan ? this.weit * FERN_MAL : 90, k.zd));
    k.ze = Math.max(NEIG_MIN, flachMin(k.zd), Math.min(NEIG_MAX, k.ze));
    if (this.drinnen) { k.zd = Math.min(k.zd, 16); k.ze = Math.max(k.ze, 0.75); }      // im Haus nicht zu weit weg und nicht zu flach, sonst sieht man nur Wand
  }

  // 🗺️ Übersicht: einmal drücken = von weit oben auf die ganze Anlage, noch einmal = zurück zur Figur
  uebersicht() {
    const fern = this.plan ? this.weit : KAM_WEIT.d;
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
    g.scene.fog.near = this.weit * 1.2; g.scene.fog.far = this.weit * 1.2 + 520;
    g.camera.near = 1; g.camera.far = 4000; g.camera.updateProjectionMatrix();
    // Besucher, die herumlaufen: Jeder sucht sich eine Tür als Ziel, schlendert hin und sucht sich dann die nächste aus
    const n = g.quality === 'niedrig' ? 0 : Math.min(LAEUFER, Math.round((plan.g.leute ?? 110) / 4));
    this.laeufer = [];
    if (n) {
      this.laeuferNeu(n);
      for (let i = 0; i < n; i++) { const o = plan.orte[(i * 7 + 3) % plan.orte.length]; this.laeufer.push({ x: o.tx + (i % 3) - 1, z: o.tz + ((i * 5) % 3) - 1, pfad: null, warte: i * 0.4, dreh: 0, tempo: LAEUFER_TEMPO * (0.8 + (i % 5) * 0.1) }); }
    }
  }

  // Das Gelände aus dem Lageplan bauen – beim ersten Mal aus einfachen Formen, später noch einmal mit den geladenen Modellen
  bauen() {
    const g = this.game, plan = this.plan;
    if (this.bau) { this.wegraeumen(this.bau.gruppe); this.drinnen = null; }
    plan.namen = [];
    const namen = Object.fromEntries(ORTE.concat([ZAUN]).map((o) => [o.id, { name: o.name, text: o.text }]));
    const bau = this.bau = baueGelaende(plan, this.gitter, { schatten: g.quality !== 'niedrig', wenig: g.quality === 'niedrig', namen });
    this.gruppe.add(bau.gruppe);
    this.klick = bau.klick;
    this.boden = bau.boden;
    this.namen = plan.namen || [];
    if (this.laeufer && this.laeufer.length) this.laeuferNeu(this.laeufer.length);
  }
  // Die Formen für die laufenden Besucher (neu) anlegen
  laeuferNeu(n) {
    if (this.laeuferForm) for (const m of this.laeuferForm.teile) { m.removeFromParent(); if (m.userData.eigen) { m.geometry.dispose(); m.material.dispose(); } }
    this.laeuferForm = laeuferBauen(n, this.game.quality !== 'niedrig');
    this.gruppe.add(...this.laeuferForm.teile);
  }
  // Alles Selbstgebaute einer Gruppe wieder freigeben (geladene Modelle bleiben, die werden noch gebraucht)
  wegraeumen(gruppe) {
    gruppe.traverse((m) => {
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
    const zeig = (h, innen) => { for (const m of h.aussen) m.visible = !innen; h.innen.visible = innen; for (const o of h.r.tueren) if (o.schild) o.schild.visible = !innen; };
    if (this.drinnen) zeig(this.drinnen, false);
    if (jetzt) zeig(jetzt, true);
    const k = this.kam;
    if (jetzt && !this.drinnen) { this.kamDraussen = { d: k.zd, e: k.ze }; k.zd = Math.min(k.zd, DRINNEN_D); k.ze = Math.max(k.ze, DRINNEN_E); }
    else if (!jetzt && this.kamDraussen) { k.zd = this.kamDraussen.d; k.ze = this.kamDraussen.e; this.kamDraussen = null; }
    this.drinnen = jetzt;
  }

  // Die laufenden Besucher ein Stück weiterbewegen
  laeuferBewegen(dt) {
    if (!this.laeufer || !this.laeufer.length) return;
    const o3 = this.hilfe3 || (this.hilfe3 = new THREE.Object3D()), orte = this.plan.orte;
    let gesucht = false;
    this.laeufer.forEach((l, i) => {
      if (l.warte > 0) l.warte -= dt;
      else if (!l.pfad) {
        // neues Ziel suchen – aber pro Bild nur für EINEN Besucher, das Suchen kostet Rechenzeit
        if (!gesucht) {
          gesucht = true;
          const ziel = orte[Math.floor(Math.random() * orte.length)], w = Math.random() * 6.28, r = 2.5 + Math.random() * 4;
          const stelle = naechsteFreie(this.gitter, ziel.tx + Math.sin(w) * r, ziel.tz + Math.cos(w) * r);
          l.pfad = stelle ? weg(this.gitter, l.x, l.z, stelle.x, stelle.z) : null;
          if (!l.pfad) l.warte = 2;
        }
      } else {
        const n = l.pfad[0], dx = n.x - l.x, dz = n.z - l.z, weit = Math.hypot(dx, dz);
        if (weit < 0.3) { l.pfad.shift(); if (!l.pfad.length) { l.pfad = null; l.warte = 3 + Math.random() * 9; } }       // angekommen: eine Weile stehen bleiben
        else { l.x += dx / weit * l.tempo * dt; l.z += dz / weit * l.tempo * dt; l.dreh = Math.atan2(dx, dz); }
      }
      o3.position.set(l.x, l.pfad ? Math.abs(Math.sin(performance.now() / 160 + i)) * 0.06 : 0, l.z);
      o3.rotation.set(0, l.dreh, 0);
      o3.updateMatrix();
      this.laeuferForm.setze(i, o3.matrix);
    });
    for (const m of this.laeuferForm.teile) m.instanceMatrix.needsUpdate = true;
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
    // Ein Schild mit Text (wird auf ein kleines Bild gemalt)
    const schild = (text, x, y, z) => {
      const bild = document.createElement('canvas');
      bild.width = 512; bild.height = 96;
      const s = bild.getContext('2d');
      s.fillStyle = '#fdfdf6'; s.fillRect(0, 0, 512, 96);
      s.fillStyle = '#16203a'; s.font = 'bold 50px sans-serif'; s.textAlign = 'center'; s.textBaseline = 'middle';
      s.fillText(text, 256, 50, 490);
      const tex = new THREE.CanvasTexture(bild);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
      m.userData.eigen = true;
      m.scale.set(4.6, 0.86, 1);
      m.position.set(x, y, z);
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
    const treffer = strahl.intersectObjects([...this.klick, ...this.orte.map((o) => o.schild)], false)[0];
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

  // Zu einem Ort laufen (z. B. vom Knopf im Menü)
  geheZu(id) {
    const ort = this.orte.find((o) => o.id === id);
    if (ort) this.zielSetzen(ort.tx, ort.tz, ort);
  }

  update(dt) {
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
      av.update(dt, { x: p.x, z: p.z, vx: p.vx, vz: p.vz, walk: tempo < GEH_BIS, face: Math.PI - p.blick, faceFest: true, ohneSchlaeger: true });
    }
    if (g.avatars[1]) g.avatars[1].group.visible = false;

    this.laeuferBewegen(dt);
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
    this.kamera(dt);
  }

  // Die Kamera kreist um die Figur: Knöpfe und Tasten drehen und zoomen, dann fährt sie weich an ihre neue Stelle
  kamera(dt) {
    const g = this.game, p = this.p, k = this.kam, t = this.tasten;
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
    const e = Math.max(k.e, flachMin(d));
    const c = Math.cos(e);
    if (this.gitter && d < 60 && !this.drinnen) {
      // Steht ein Haus oder Stadion zwischen Kamera und Figur? Dann rückt die Kamera so nah heran, dass sie davor bleibt.
      const sx = Math.sin(k.w) * c, sz = Math.cos(k.w) * c, sy = Math.sin(e);
      for (let s = 1.5; s < d; s += 0.7) {
        if (hoeheBei(this.gitter, p.x + sx * s, p.z + sz * s) > 1.4 + sy * s) { d = Math.max(3, s - 1.2); break; }
      }
    }
    // In der Übersicht (weit weg) schaut die Kamera auf die Mitte der Anlage statt auf die Figur
    const ab = this.plan ? this.weit * 0.45 : 22, bis = this.plan ? this.weit * 0.4 : 16, zx = this.plan ? this.mitte.x : 0, zz = this.plan ? this.mitte.z : 0;
    const fern = Math.max(0, Math.min(1, (k.d - ab) / bis)), mx = p.x + (zx - p.x) * fern, mz = p.z + (zz - p.z) * fern + (this.plan ? fern * this.weit * 0.1 : 0);     // etwas nach unten schauen: Unten im Bild liegt das Fenster mit dem Text
    const von = new THREE.Vector3(mx + Math.sin(k.w) * c * d, 0.5 + Math.sin(e) * d, mz + Math.cos(k.w) * c * d);
    const nach = new THREE.Vector3(mx, 0.9 + Math.max(0, 0.6 - e) * 2.2 * Math.min(1, d / 15), mz);      // flache Kamera schaut etwas höher (ganz nah an der Figur nicht – sonst sähe man nur Himmel)
    // Die Schilder: aus der Ferne groß (sonst kann man sie nicht lesen), aus der Nähe klein
    // (auf den großen Geländen wachsen sie in der Übersicht immer weiter mit)
    if (this.plan) {
      // Der Dunst in der Ferne rückt mit weg, wenn die Kamera weit hinausfährt – sonst wäre von weit oben alles nur hellblau
      const dunst = Math.max(this.weit * 1.2, k.d * 1.3);
      g.scene.fog.near = dunst; g.scene.fog.far = dunst + 520 + k.d;
    }
    let gross = Math.max(0.7, Math.min(2.2, k.d / 16));
    if (this.plan && k.d > 35) gross = 2.2 * Math.pow(k.d / 35, 0.6);
    for (const o of this.orte) o.schild.scale.set(4.6 * gross, 0.86 * gross, 1);
    for (const s of this.namen) { s.scale.set(4.6 * gross * 0.72, 0.86 * gross * 0.72, 1); s.visible = k.d > 26; }
    if (this.sonne) {
      // Die Sonne wandert mit der Figur mit, damit die Schatten in ihrer Nähe scharf sind
      this.sonne.position.set(mx + 50, 110, mz + 40);
      this.sonne.target.position.set(mx, 0, mz);
    }
    const kk = dt >= 1 ? 1 : 1 - Math.exp(-6 * dt);
    g.camPos.lerp(von, kk); g.camLook.lerp(nach, kk);
    g.camera.position.copy(g.camPos);
    g.camera.lookAt(g.camLook);
  }

  ende() {
    if (!this.gruppe) { this.an = false; return; }
    const g = this.game;
    this.wegraeumen(this.gruppe);                       // geladene Modelle (Ballkinder, Häuser, Bäume …) bleiben im Speicher
    this.gruppe = null; this.bau = null; this.drinnen = null; this.kamDraussen = null; this.laeuferForm = null;
    if (this.plan) {
      // Licht, Himmel und Kamera wieder so einstellen wie vorher
      for (const l of this.altesLicht) l.visible = true;
      if (this.sonne.shadow.map) this.sonne.shadow.map.dispose();
      g.scene.background = this.alt.hintergrund;
      g.scene.fog.color.copy(this.alt.nebel);
      g.camera.near = this.alt.nah; g.camera.far = this.alt.fern; g.camera.updateProjectionMatrix();
    }
    this.plan = null; this.gitter = null; this.sonne = null; this.pfad = null; this.namen = []; this.laeufer = null; this.ball = null;
    this.an = false;
    this.finger = {};
    this.knueppel = null;
    this.kamTaste = null;
    this.tasten = {};
    if (g.stadium.group) g.stadium.group.visible = true;
    g.scene.fog.near = 70; g.scene.fog.far = 190;
    if (g.avatars[0]) g.avatars[0].m.racket.visible = true;
  }
}
