// Powershot – die 3D-Anzeige: Kamera, Ball, Markierungen, Verbindung von Match, Figuren und Sound

import * as THREE from 'three';
import { Stadium } from './stadium.js';
import { Avatar } from './avatar.js';
import { TOSS_TIME, TOSS_FLIGHT } from './match.js';
import { COURT as C } from './physics.js';
import { ladeRequisiten, requisit } from './requisiten.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const REASON_TEXT = { aus: 'Aus!', netz: 'Netz!', doppelfehler: 'Doppelfehler!', ass: 'Ass!', winner: 'Winner!' };

import { Siegerehrung } from './siegerehrung.js';
import { Anlage } from './anlage.js';

// Blick auf den Platz im Match. Platz, Figur, Schläger und Netz haben die echten Maße in Metern (nachgemessen) –
// wie groß die Spieler im Vergleich zum Platz AUSSEHEN, bestimmt allein die Kamera.
//   tv:  wie im Fernsehen. Die Kamera steht sehr weit hinten (mitten in der Tribüne) und schaut mit einem engen Winkel,
//        wie durch ein Fernrohr. Dadurch wird der Platz in der Länge "zusammengeschoben": Er sieht kurz aus,
//        und die Spieler wirken im Vergleich dazu groß. Der Spieler hinten ist nur wenig kleiner als der vorn.
//   nah: wie früher. Die Kamera schwebt dicht hinter dir und schaut mit einem weiten Winkel. Du bist groß,
//        der Gegner winzig, und der Platz wirkt sehr lang.
// winkel = Blickwinkel in der Breite (Grad), hoch/hinten = wo die Kamera steht (Meter über dem Boden / hinter dem Netz),
// mitX = wie stark sie seitlich mit dir mitgeht.
// Nur beim TV-Blick: unten = der untere Bildrand liegt so viele Meter hinter dem Netz auf dem Boden (knapp hinter deiner Grundlinie),
// schwenk = wie stark die Kamera dir seitlich nachschaut, hochMax = so viel Grad darf das Bild höchstens in der Höhe zeigen,
// ab = alles, was weiter hinten als so viele Meter hinter dem Netz steht (die Tribüne, in der die Kamera sitzt), wird nicht gezeichnet.
// Die TV-Zahlen sind an vier echten Fernsehbildern ausgemessen (Melbourne, Cincinnati, Paris, Barcelona):
// Die Grundlinie vorn ist dort 1,5- bis 1,9-mal so breit wie die hinten und füllt fast das ganze Bild.
const BLICK = {
  tv:  { winkel: 23, hoch: 12, hinten: 46, unten: 15.6, mitX: 0.1, schwenk: 0.35, hochMax: 14.8, ab: 19.2 },
  nah: { winkel: 62, hoch: 6.4, hinten: 23.5, zielZ: 1.5, mitX: 0.35 },
};

// Action im Bild (seit 21.11.2026). Alle Zahlen geschätzt – einfach ändern und ausprobieren!
const SCHWEIF_AB = 15, SCHWEIF_VOLL = 40;   // Schweif hinter dem Ball: ab diesem Tempo (m/s) fängt er an, ab dem zweiten leuchtet er voll
const SCHWEIF_BREIT = 0.075;                // so breit ist der Schweif direkt am Ball (Meter)
const WUCHT_AB = 29, WUCHT_VOLL = 47;       // harter Schlag: ab diesem Tempo (m/s) gibt es Blitz und Ruck, ab dem zweiten in voller Stärke
const RUCK = 0.2, RUCK_ZEIT = 0.25;         // Kamera-Ruck: so weit wackelt sie höchstens (Meter) und so lange (Sekunden)
const BLITZ_ZEIT = 0.22;                    // so lange sieht man den Ring am Treffpunkt (Sekunden)
const BREMS_AB = 4.0;        // ab diesem Tempo (Meter pro Sekunde) quietscht es beim scharfen Abbremsen

export class Game3D {
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.sound = sound;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.3, 400);
    this.stadium = new Stadium(this.scene);
    this.avatars = [null, null];
    this.match = null;
    this.hud = null;
    this.tossK = [0, 0];
    this.time = 0;
    this.camPos = new THREE.Vector3(0, 9, 30);
    this.camLook = new THREE.Vector3(0, 1, 0);
    this.quality = 'hoch';
    this.blick = 'tv';              // Blick im Match: 'tv' (wie im Fernsehen) oder 'nah' (dicht hinter dir), siehe BLICK oben
    this.winkel = 62;               // Blickwinkel in der Breite, den die Kamera gerade hat
    this.winkelHoch = 78; this.winkelBreitMin = 0;      // Grenzen dazu, siehe setWinkel
    this.realFigures = true;        // realistisches Spielermodell statt der einfachen Figur
    this.venueKey = '';
    this.buildProps();
    this.ehrung = new Siegerehrung(this);      // Siegerehrung nach einem gewonnenen Finale
    this.anlage = new Anlage(this);            // Turnieranlage zum Herumlaufen (Probe)
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'niedrig' ? 1.25 : 2));
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    // Blickwinkel so wählen, dass der Platz in der Breite immer ganz zu sehen ist
    const hf = this.winkel * Math.PI / 180, rad = Math.PI / 180;
    const hochAus = (breitGrad) => 2 * Math.atan(Math.tan(breitGrad * rad / 2) / this.aspect) / rad;   // Breite → Höhe des Blickwinkels
    let fov = Math.min(hochAus(this.winkel), this.winkelHoch);      // nicht höher als erlaubt (sonst sieht man beim TV-Blick die Tribüne unter der Kamera) …
    fov = Math.max(fov, hochAus(this.winkelBreitMin));               // … aber der Platz muss in der Breite immer ganz zu sehen sein
    this.camera.fov = clamp(fov, 12, 78);
    this.camera.updateProjectionMatrix();
  }

  // Blickwinkel in der Breite ändern (im Match je nach Blick, im Menü immer 62 Grad)
  // hochMax = höchstens so viel Grad in der Höhe, breitMin = mindestens so viel Grad in der Breite.
  setWinkel(grad, hochMax = 78, breitMin = 0) {
    if (grad === this.winkel && hochMax === this.winkelHoch && breitMin === this.winkelBreitMin) return;
    this.winkel = grad; this.winkelHoch = hochMax; this.winkelBreitMin = breitMin;
    this.resize();
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.venueKey = '';
    this.resize();
  }

  // Ball, Schatten, Markierungen
  buildProps() {
    const S = this.scene;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8f03a, emissive: 0x6a7a10, roughness: 0.6 }));
    this.ball.castShadow = true;
    S.add(this.ball);

    const flatMesh = (geo, color, opacity) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      S.add(m);
      return m;
    };
    this.blob = flatMesh(new THREE.CircleGeometry(0.11, 14), 0x000000, 0.35);
    this.landing = flatMesh(new THREE.RingGeometry(0.3, 0.44, 28), 0xf6f04a, 0.95);
    this.landingDot = flatMesh(new THREE.CircleGeometry(0.09, 12), 0xf6f04a, 0.95);
    this.aimRing = flatMesh(new THREE.RingGeometry(0.34, 0.5, 28), 0xffa024, 0.95);
    this.boxGlow = flatMesh(new THREE.PlaneGeometry(1, 1), 0xffffff, 0.16);
    this.marks = [];
    for (let i = 0; i < 8; i++) {
      const m = flatMesh(new THREE.CircleGeometry(0.1, 12), 0xffffff, 0.8);
      m.userData.life = 0;
      this.marks.push(m);
    }
    this.markI = 0;

    // Ziellinie vom Spieler zum Ziel
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
    this.aimLine = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xf6f04a, dashSize: 0.35, gapSize: 0.3, transparent: true, opacity: 0.9 }));
    this.aimLine.visible = false;
    S.add(this.aimLine);

    // Leuchtspur hinter dem Ball
    // Sie ist ein schmales Band aus Dreiecken: am Ball breit und hell, nach hinten wird es dünn und durchsichtig.
    // Je schneller der Ball, desto kräftiger leuchtet es – so sieht man, wie hart ein Schlag war.
    this.trailN = 16;
    this.trailPts = Array.from({ length: this.trailN }, () => new THREE.Vector3());
    this.trailStark = new Array(this.trailN).fill(0);        // wie schnell war der Ball an dieser Stelle? (0 bis 1)
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.trailN * 2 * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.trailN * 2 * 4), 4));     // Farbe und Durchsichtigkeit je Ecke
    const ti = [];
    for (let i = 0; i < this.trailN - 1; i++) { const a = i * 2; ti.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(ti);
    this.trail = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.trail.frustumCulled = false;
    this.trail.renderOrder = 5;
    S.add(this.trail);
    // Blitz: ein heller Ring, der am Treffpunkt eines harten Schlags kurz aufgeht
    this.blitz = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false }));
    this.blitz.visible = false; this.blitz.renderOrder = 6;
    this.blitz.userData = { t: 9, w: 0 };
    S.add(this.blitz);
    this.ruck = { t: 9, w: 0 };       // Kamera-Ruck: t = so lange ist der Schlag her, w = wie stark (0 bis 1)

    this.zoneGroup = new THREE.Group();
    S.add(this.zoneGroup);

    // Spielzug-Training: grünes Zielfeld für den nächsten Schlag (zwei Stück, falls beide Ecken richtig sind)
    // und eine gestrichelte Linie vom Ball dorthin
    this.zugFeld = [flatMesh(new THREE.PlaneGeometry(1, 1), 0x35e06a, 0.4), flatMesh(new THREE.PlaneGeometry(1, 1), 0x35e06a, 0.4)];
    this.zugLinie = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineDashedMaterial({ color: 0x35e06a, dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.9 }));
    this.zugLinie.visible = false;
    S.add(this.zugLinie);
    this.zugZeit = 0;
  }

  // Die Ballmaschine fürs Training. Sie steht dort, von wo die Bälle kommen (siehe feed() in match.js).
  maschineZeigen(an) {
    if (an && !this.maschine) {
      this.maschine = requisit('ballmaschine');
      if (this.maschine) { this.maschine.position.set(0.5, 0, -(C.L + 0.5)); this.scene.add(this.maschine); }
    }
    if (this.maschine) this.maschine.visible = an;
    return !!this.maschine;
  }

  // ---------------------------------------------------------------
  // Pokal im Menü
  // ---------------------------------------------------------------
  // Zeigt nach einem Turniersieg einen Pokal, der sich langsam dreht.
  // bild = ein <canvas> aus dem Menü, art = 'silber' (Grand Slam), 'gold' (Masters und kleine Turniere), 'stern' (ATP Finals).
  // Der Pokal wird in einer eigenen kleinen Szene gezeichnet und dann in dieses Bild kopiert.
  pokalZeigen(bild, art) {
    this.pokal = null;
    ladeRequisiten().then(() => {
      const mesh = requisit('pokal_' + art, { rau: 0.35, metall: 0.15, schatten: false });
      if (!mesh || !bild.isConnected) return;
      const szene = new THREE.Scene();
      szene.background = new THREE.Color(0x16203a);
      szene.add(mesh, new THREE.HemisphereLight(0xffffff, 0x404858, 1.6));
      const licht = new THREE.DirectionalLight(0xfff4d8, 2.6); licht.position.set(1.5, 2.5, 2); szene.add(licht);
      const kamera = new THREE.PerspectiveCamera(30, bild.width / bild.height, 0.1, 10);
      kamera.position.set(0, 0.42, 1.45); kamera.lookAt(0, 0.3, 0);
      this.pokal = { bild, mesh, szene, kamera, stift: bild.getContext('2d') };
    });
  }

  pokalZeichnen(dt) {
    const p = this.pokal;
    if (!p.bild.isConnected) { p.mesh.material.dispose(); this.pokal = null; return; }    // das Menü ist schon wieder weg
    p.mesh.rotation.y += dt * 0.9;
    const r = this.renderer, pr = r.getPixelRatio(), w = 200, h = 250;       // kleine Ecke unten links im großen Bild
    r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.setScissorTest(true);
    r.render(p.szene, p.kamera);
    r.setScissorTest(false);
    const el = r.domElement;
    p.stift.drawImage(el, 0, el.height - h * pr, w * pr, h * pr, 0, 0, p.bild.width, p.bild.height);
    r.setViewport(0, 0, el.width / pr, el.height / pr);
  }

  // ---------------------------------------------------------------
  // Anprobe im Shop: deine Figur in einem kleinen Bild, sie dreht sich langsam
  // ---------------------------------------------------------------
  // bild = ein <canvas> aus dem Menü, look = Aussehen (Farben von Hemd, Hose, Schuhen, Schläger, Kappe …)
  // Gleiche Technik wie beim Pokal: eigene kleine Szene, dann ins Bild kopieren.
  figurZeigen(bild, look, hand = 1) {
    if (this.figur) this.figur.av.dispose();
    const szene = new THREE.Scene();
    szene.background = new THREE.Color(0x16203a);
    const av = new Avatar(look, 0, hand, this.realFigures);
    const boden = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.9 }));
    boden.rotation.x = -Math.PI / 2;
    szene.add(av.group, boden, new THREE.HemisphereLight(0xffffff, 0x404858, 1.7));
    const licht = new THREE.DirectionalLight(0xfff4d8, 2.2); licht.position.set(1.5, 3, 2.5); szene.add(licht);
    const kamera = new THREE.PerspectiveCamera(30, bild.width / bild.height, 0.1, 20);
    kamera.position.set(0, 1.25, 4.3); kamera.lookAt(0, 0.95, 0);
    this.figur = { bild, av, szene, kamera, stift: bild.getContext('2d'), winkel: Math.PI + 0.45 };     // fängt von vorn an (π = Gesicht zur Kamera) und dreht sich dann weiter
  }

  figurZeichnen(dt) {
    const f = this.figur;
    if (!f.bild.isConnected) { f.av.dispose(); this.figur = null; return; }    // das Menü ist schon wieder weg
    f.winkel += dt * 0.7;
    f.av.update(dt, { x: 0, z: 0, vx: 0, vz: 0, face: f.winkel, faceFest: true });
    const r = this.renderer, pr = r.getPixelRatio(), w = 200, h = 250;
    r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.setScissorTest(true);
    r.render(f.szene, f.kamera);
    r.setScissorTest(false);
    const el = r.domElement;
    f.stift.drawImage(el, 0, el.height - h * pr, w * pr, h * pr, 0, 0, f.bild.width, f.bild.height);
    r.setViewport(0, 0, el.width / pr, el.height / pr);
  }

  // ---------------------------------------------------------------
  // Deine Schlägertasche neben der Bank (Karriere). farbe = Farbe der Tasche, null = keine Tasche
  // ---------------------------------------------------------------
  // Aus einfachen Formen gebaut: eine lange Rolle, zwei dunkle Enden, ein Tragegurt und ein Schlägergriff, der herausschaut.
  tascheZeigen(farbe) {
    if (this.tasche) { this.scene.remove(this.tasche); this.tasche.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); this.tasche = null; }
    if (farbe == null) return;
    const G = this.tasche = new THREE.Group();
    const teil = (geo, col, x, y, z, rz = 0, rx = 0) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
      m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; G.add(m); return m;
    };
    teil(new THREE.CapsuleGeometry(0.17, 0.5, 6, 14), farbe, 0, 0.17, 0, 0, Math.PI / 2);                 // die Tasche selbst, liegt längs
    teil(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 14), 0x1a1a22, 0, 0.17, 0.2, 0, Math.PI / 2);      // dunkler Streifen
    teil(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 14), 0x1a1a22, 0, 0.17, -0.2, 0, Math.PI / 2);
    teil(new THREE.TorusGeometry(0.13, 0.015, 6, 16, Math.PI), 0x1a1a22, 0, 0.33, 0, 0, 0).rotation.y = Math.PI / 2;   // Tragegurt
    teil(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), 0xf2f2f2, 0.02, 0.36, -0.36, 0, -0.9);          // Schlägergriff schaut heraus
    G.position.set(-(C.NET_W + 1.3), 0, 6.3);        // neben der Bank auf deiner Seite
    this.scene.add(G);
  }

  loadVenue(def) {
    const key = def.id + this.quality;
    if (key === this.venueKey) return;
    this.venueKey = key;
    this.venue = def;
    this.stadium.build(def, this.quality);
  }

  setPlayers(a, b) {
    for (const av of this.avatars) if (av) av.dispose();
    this.avatars = [new Avatar(a.look, 0, a.hand || 1, this.realFigures), new Avatar(b.look, 1, b.hand || 1, this.realFigures)];
    for (const av of this.avatars) this.scene.add(av.group);
  }

  attach(match, hud) {
    this.match = match;
    this.hud = hud;
    this.tossK = [0, 0];
    this.clearZones();
    this.landing.visible = this.landingDot.visible = false;
    for (const m of this.marks) m.visible = false;
  }

  detach() {
    this.match = null;
    this.clearZones();
    this.landing.visible = this.landingDot.visible = this.aimRing.visible = this.aimLine.visible = this.boxGlow.visible = false;
    this.zugFeld[0].visible = this.zugFeld[1].visible = this.zugLinie.visible = false;
  }

  clearZones() {
    for (const z of [...this.zoneGroup.children]) { z.geometry.dispose(); z.material.dispose(); this.zoneGroup.remove(z); }
  }

  // ---------------------------------------------------------------
  // Meldungen aus dem Match
  // ---------------------------------------------------------------
  makeFx(names) {
    const snd = this.sound, self = this;
    const hud = () => self.hud || {};
    const call = (f, ...a) => { const h = hud(); if (h[f]) h[f](...a); };
    return {
      serveSetup(info) {
        self.landing.visible = self.landingDot.visible = false;
        snd.setCrowd(0.035);
        call('update');
        // Wichtiger Punkt? Dann steht es oben: Breakball, Satzball, Matchball (im Finale: Championship Point)
        const wichtig = self.match && self.match.mode === 'match' ? self.match.score.wichtigText(names, self.match.cfg.finale) : '';
        if (wichtig) call('message', wichtig + (info.serveNo === 2 ? ' · 2. Aufschlag' : ''), 'wichtig');
        else if (info.serveNo === 2) call('message', '2. Aufschlag', 'info');
      },
      toss(side, k) { self.tossK[side] = k; },
      prell() { snd.bounce(3, self.venue ? self.venue.surface : 'hard'); },      // Ball prellen vor dem Aufschlag
      swing(side, kind, y, type) {
        self.tossK[side] = 0; self.avatars[side].swing(kind, y, type);
        // Show-Schlag? Dann erfährt es das Spiel (app.js zeigt den Namen an)
        const show = self.avatars[side].a.show;
        if (show && self.wennShow) self.wennShow(side, show);
      },
      hit(h) {
        snd.hit(clamp((h.speed - 8) / 40, 0.2, 1), h.type);      // die Schlagart bestimmt, welche Aufnahme kommt
        if (h.type === 'serve') call('serveSpeed', Math.round(h.speed * 3.6), h.side, h.art);
        const w = self.wucht(h);
        if (w > 0) call('schlagTempo', Math.round(h.speed * 3.6), w);      // dein harter Schlag: Tempo anzeigen
        snd.setCrowd(0.02);
      },
      bounce(b) {
        if (!b.wall) snd.bounce(b.speed, self.venue ? self.venue.surface : 'hard');
        if (b.n === 1 && !b.wall) {
          const m = self.marks[self.markI++ % self.marks.length];
          m.position.set(b.x, 0.012, b.z);
          m.material.color.setHex(b.in ? 0xffffff : 0xff4a3a);
          m.userData.life = 2.2;
          m.visible = true;
          self.landing.visible = self.landingDot.visible = false;
        }
      },
      net(type) { if (type === 'net') snd.net(); else snd.bounce(8); },
      landing(p) {
        const on = !!p;
        self.landing.visible = self.landingDot.visible = on;
        if (on) {
          self.landing.position.set(p.x, 0.02, p.z);
          self.landingDot.position.set(p.x, 0.02, p.z);
          const c = p.in ? 0xf6f04a : 0xff5a4a;
          self.landing.material.color.setHex(c); self.landingDot.material.color.setHex(c);
        }
      },
      fault(n, why) {
        call('message', why === 'netz' ? 'Netz – Fehler!' : 'Fehler!', 'warn');
        snd.say('Fehler');
        snd.ooh();
      },
      point(info) {
        if (self.match.cfg.lernen) {
          // Spielzug-Training: Hier zählt nicht der Punkt, sondern ob der Spielzug geklappt hat
          const gut = self.match.punktGeschafft, tr = self.match.training;
          snd.applause(gut ? 0.7 : 0.25, gut);
          if (gut) snd.coin();
          const zm = self.match.zugMeldung;
          call('point', gut ? 'Spielzug geschafft!' : 'Noch nicht ganz', !gut && zm && zm.text ? zm.text : `Versuch ${tr.done} von ${tr.balls}`, info);
          return;
        }
        const sc = self.match.score;
        const w = names[info.winner];
        let head = REASON_TEXT[info.reason] || '';
        if (info.reason === 'winner' && info.rally <= 2) head = 'Nicht erreicht!';
        let sub = 'Punkt ' + w;
        let strength = info.reason === 'ass' || info.reason === 'winner' ? 0.75 : 0.45;
        if (strength > 0.7 && info.rally >= 5) snd.staunen();       // toller Gewinnschlag nach langem Ballwechsel: das Publikum staunt
        let say = REASON_TEXT[info.reason] && info.reason !== 'winner' ? head.replace('!', '') + '. ' : '';
        if (info.events.includes('match')) { sub = 'Spiel, Satz und Sieg ' + w; strength = 1; say += sub; }
        else if (info.events.includes('set')) { sub = 'Satz ' + w; strength = 0.95; say += sub; }
        else if (info.events.includes('game')) { sub = 'Spiel ' + w; strength = 0.8; say += sub + (info.events.includes('tiebreak') ? '. Tiebreak' : ''); }
        else {
          say += sc.callText(names);
          // Der Schiedsrichter sagt auch an, wenn jetzt ein wichtiger Punkt kommt
          const wichtig = sc.wichtigText(names, self.match.cfg.finale);
          if (wichtig) say += '. ' + wichtig;
        }
        if (info.rally >= 9) strength = Math.min(1, strength + 0.25);
        snd.applause(strength, strength > 0.7);
        self.stadium.jubel(strength);
        snd.setCrowd(0.06);
        setTimeout(() => snd.say(say), 500);
        call('point', head, sub, info);
        call('update');
        self.stadium.setBoard([names[0] + '  ' + sc.sets.map((s) => s[0]).join(' ') + ' ' + sc.games[0], names[1] + '  ' + sc.sets.map((s) => s[1]).join(' ') + ' ' + sc.games[1]], sc.pointLabels().join(' : '));
      },
      message(text, kind) { call('message', text, kind); },
      // Ein Spielzug ist fertig geworden (im Match): Das Publikum merkt es, app.js zeigt den Namen an
      spielzug(info) { if (!info.durchschaut) snd.applause(0.3); call('spielzug', info); },
      matchOver(score) { call('matchOver', score); },
      zones(zs) {
        self.clearZones();
        for (const z of zs) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(z.x1 - z.x0, z.z1 - z.z0),
            new THREE.MeshBasicMaterial({ color: z.pts >= 5 ? 0xffd02a : 0x4ad0ff, transparent: true, opacity: 0.42, depthWrite: false }));
          m.rotation.x = -Math.PI / 2;
          m.position.set((z.x0 + z.x1) / 2, 0.015, (z.z0 + z.z1) / 2);
          self.zoneGroup.add(m);
        }
      },
      trainingUpdate(tr, pts, ok) {
        call('training', tr, pts, ok);
        if (pts >= 3) { snd.coin(); snd.applause(0.4); }
      },
      trainingOver(tr) { call('trainingOver', tr); },
    };
  }

  // ---------------------------------------------------------------
  // Jedes Bild
  // ---------------------------------------------------------------
  frame(dt) {
    this.time += dt;
    const m = this.match;
    if (!m) {
      this.setWinkel(62);             // außerhalb des Matches gilt immer der weite Blickwinkel
      this.blitz.visible = false;
      if (this.nahVorher != null) { this.camera.near = this.nahVorher; this.nahVorher = null; this.camera.updateProjectionMatrix(); }
    }
    if (m) this.syncMatch(dt, m); else if (this.ehrung.an) this.ehrung.update(dt); else if (this.anlage.an) this.anlage.update(dt); else this.menuCamera(dt);
    for (const mk of this.marks) {
      if (!mk.visible) continue;
      mk.userData.life -= dt;
      mk.material.opacity = clamp(mk.userData.life / 1.2, 0, 0.8);
      if (mk.userData.life <= 0) mk.visible = false;
    }
    this.stadium.update(dt);
    if (this.pokal) this.pokalZeichnen(dt);          // zuerst der kleine Pokal, danach übermalt das Stadion das ganze Bild
    if (this.figur) this.figurZeichnen(dt);
    this.renderer.render(this.scene, this.camera);
  }

  // Ein harter Schlag soll sich auch hart anfühlen: Am Treffpunkt geht kurz ein heller Ring auf, und die Kamera ruckt ein wenig.
  // Bei deinen eigenen harten Schlägen steht außerdem das Tempo da.
  wucht(h) {
    const m = this.match;
    if (!m) return 0;
    const w = clamp((h.speed - WUCHT_AB) / (WUCHT_VOLL - WUCHT_AB), 0, 1);
    if (w <= 0) return 0;
    const meiner = m.P[h.side] && m.P[h.side].isHuman;
    const stark = w * (h.side === 0 ? 1 : 0.5);         // der Gegner ist weit weg: bei ihm fällt alles kleiner aus
    this.ruck.t = 0; this.ruck.w = stark;
    const b = m.ball.pos;
    this.blitz.position.set(b.x, b.y, b.z);
    this.blitz.userData.t = 0; this.blitz.userData.w = stark;
    this.blitz.visible = true;
    return meiner && h.type !== 'serve' ? w : 0;
  }

  // Den Schweif hinter dem Ball neu zeichnen (einmal pro Bild)
  schweifZeichnen(flying, tempo) {
    const P = this.trailPts, K = this.trailStark, n = this.trailN;
    P.unshift(P.pop().copy(this.ball.position));
    K.pop(); K.unshift(flying ? clamp((tempo - SCHWEIF_AB) / (SCHWEIF_VOLL - SCHWEIF_AB), 0, 1) : 0);
    if (!flying) { for (const p of P) p.copy(this.ball.position); K.fill(0); }
    this.trail.visible = flying;
    if (!flying) return;
    const pos = this.trail.geometry.attributes.position, col = this.trail.geometry.attributes.color;
    const quer = this._quer || (this._quer = new THREE.Vector3()), lang = this._lang || (this._lang = new THREE.Vector3()), blick = this._blick || (this._blick = new THREE.Vector3());
    for (let i = 0; i < n; i++) {
      const p = P[i], a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      // Das Band soll immer flach zur Kamera liegen: quer = senkrecht zur Flugrichtung und zur Blickrichtung
      lang.subVectors(a, b); blick.subVectors(this.camera.position, p);
      quer.crossVectors(lang, blick);
      const l = quer.length();
      const k = 1 - i / (n - 1);                           // 1 am Ball, 0 am Ende
      const breit = l > 1e-6 ? SCHWEIF_BREIT * (0.35 + 0.65 * K[i]) * k / l : 0;
      pos.setXYZ(i * 2, p.x + quer.x * breit, p.y + quer.y * breit, p.z + quer.z * breit);
      pos.setXYZ(i * 2 + 1, p.x - quer.x * breit, p.y - quer.y * breit, p.z - quer.z * breit);
      // Farbe: gelb wie der Ball, bei sehr schnellen Bällen fast weiß. Nach hinten wird das Band durchsichtig.
      const hell = K[i], alpha = (0.18 + 0.67 * hell) * k * k;
      col.setXYZW(i * 2, 0.93 + 0.07 * hell, 1, 0.42 + 0.5 * hell, alpha);
      col.setXYZW(i * 2 + 1, 0.93 + 0.07 * hell, 1, 0.42 + 0.5 * hell, alpha);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  // Rennt ein Spieler schnell und bleibt plötzlich stehen, quietschen die Schuhe (auf Sand rutscht er)
  bremsTon(i, p, dt, m) {
    const tempo = Math.hypot(p.vx || 0, p.vz || 0);
    const b = this.brems || (this.brems = [{ v: 0, pause: 0 }, { v: 0, pause: 0 }]);
    const e = b[i];
    e.pause -= dt;
    if (m.state === 'rally' && e.pause <= 0 && e.v > BREMS_AB && tempo < e.v * 0.4) {
      this.sound.bremsen(this.venue ? this.venue.surface : 'hard', (i === 0 ? 1 : 0.6) * clamp(e.v / 6, 0.5, 1.2));   // der Gegner ist weiter weg, also leiser
      e.pause = 1.5;
    }
    e.v += (tempo - e.v) * Math.min(1, dt * 3.5);     // ungefähr das Tempo von vor einer Drittelsekunde
  }

  syncMatch(dt, m) {
    const b = m.ball.pos;
    // Training mit der Ballmaschine: Statt des Gegners steht die Maschine da (wenn ihr Modell geladen ist)
    const maschine = this.maschineZeigen(m.mode === 'ballmaschine') && m.mode === 'ballmaschine';
    if (this.avatars[1] && m.state !== 'intro') this.avatars[1].group.visible = !maschine;
    // Figuren
    for (let i = 0; i < 2; i++) {
      const p = m.P[i], av = this.avatars[i];
      if (!av) continue;
      this.bremsTon(i, p, dt, m);
      const amAufschlag = (m.state === 'toss' || m.state === 'serveReady') && m.server === i && m.mode !== 'ballmaschine';
      const vonUnten = amAufschlag && m.state === 'toss' && m.serveUnten;
      const tossing = amAufschlag && !vonUnten;
      const st = { x: p.x, z: p.z, vx: p.vx, vz: p.vz, prep: p.prep, stroke: p.stroke, mood: m.state === 'pointOver' ? p.mood : null, ball: b };
      st.walk = m.state === 'changeover';       // beim Seitenwechsel wird aufrecht gegangen
      if (tossing) {
        // Aufschlag: der Ballwurf steuert die Bewegung
        st.stroke = 'sv';
        st.serveK = m.state === 'toss' ? this.tossK[i] : 0;
        st.serveT = TOSS_TIME;
        if (m.state === 'serveReady' && m.prellK != null) st.prellK = m.prellK;      // der Ball wird gerade geprellt
      } else if (vonUnten) {
        // Aufschlag von unten: ausholen wie zu einem Vorhand-Slice, der Ball fällt aus der Hand
        st.stroke = 'fh'; st.prep = 1; st.hint = 'slice';
        st.tHit = m.tossDauer - m.tossT; st.planY = 0.75; st.volley = false;
      } else if (p.plan && m.state === 'rally') {
        // Wann und wie hoch kommt der Ball? Danach richten sich Ausholen und Schwung.
        st.tHit = p.plan.t - m.sinceHit;
        st.planY = p.plan.y;
        st.volley = p.plan.b === 0;
        // Spielsituation für die Wahl des Schlags: steht der Spieler im Feld (Angriff) oder kommt er kaum an den Ball (Abwehr)?
        st.inside = Math.abs(p.plan.sz) < C.L - 1.5;
        st.defend = p.plan.lack > 0.12;
        st.weg = p.vz * p.dz > 2;          // rennt vom Netz weg (z. B. einem Lob hinterher) – für Show-Schläge
        if (!p.isHuman && p.plan.lack > 0.45) st.hint = 'slice';      // in großer Not spielt der Computer meist Slice
        if (p.isHuman && m.controls) { const raw = m.controls.peek(); if (raw && raw.type) st.hint = raw.type; }
      }
      av.update(dt, st);
    }

    // Ball
    // Beim Aufschlag liegt der Ball in der Hand, bis er hochgeworfen wird
    const release = TOSS_TIME - TOSS_FLIGHT;
    const holding = m.state === 'serveReady' || (m.state === 'toss' && !m.serveUnten && m.tossT < release + 0.12);
    if (holding && this.avatars[m.server]) {
      const h = this.avatars[m.server].handLWorld;
      const u = m.state === 'toss' ? clamp((m.tossT - release) / 0.12, 0, 1) : 0;     // kurzer Übergang Hand → Flug
      this.ball.position.set(h.x + (b.x - h.x) * u, h.y + 0.07 + (b.y - h.y - 0.07) * u, h.z + (b.z - h.z) * u);
      // Ball prellen: Er fällt aus der Hand bis auf den Boden und springt zurück
      if (m.state === 'serveReady' && m.prellK != null) this.ball.position.y = 0.033 + (h.y - 0.04 - 0.033) * m.prellK;
    } else {
      this.ball.position.set(b.x, b.y, b.z);
    }
    this.ball.visible = m.state !== 'intro';
    this.blob.visible = this.ball.visible;
    this.blob.position.set(this.ball.position.x, 0.011, this.ball.position.z);
    const hs = clamp(1 + this.ball.position.y * 0.25, 1, 2.2);
    this.blob.scale.setScalar(hs);
    this.blob.material.opacity = clamp(0.4 - this.ball.position.y * 0.05, 0.12, 0.4);

    // Leuchtspur
    const flying = m.ball.live && (m.state === 'rally' || m.state === 'pointOver');
    this.schweifZeichnen(flying, Math.hypot(m.ball.vel.x, m.ball.vel.y, m.ball.vel.z));

    // Ziel-Anzeige
    const pv = m.previewTarget();
    const me = m.P[0];
    if (pv) {
      this.aimRing.visible = true;
      this.aimRing.position.set(pv.x, 0.022, pv.z);
      this.aimRing.material.color.setHex(pv.committed ? 0xffa024 : 0xf6f04a);
      const from = new THREE.Vector3(me.x, 0.05, me.z - 0.5);
      const to = new THREE.Vector3(pv.x, 0.05, pv.z);
      this.aimLine.geometry.setFromPoints([from, to]);
      this.aimLine.computeLineDistances();
      this.aimLine.material.color.setHex(pv.committed ? 0xffa024 : 0xf6f04a);
      this.aimLine.visible = true;
    } else {
      this.aimRing.visible = this.aimLine.visible = false;
    }

    // Spielzug-Training: Zielfeld für den nächsten Schritt zeigen (es blinkt sanft)
    const zs = m.zugStand ? m.zugStand() : null, zo = zs && zs.zone;
    this.zugZeit += dt;
    this.zugFeld.forEach((f, i) => {
      f.visible = !!zo && (i === 0 || zo.beide);
      if (!f.visible) return;
      const sp = i === 1 ? -1 : 1;            // das zweite Feld liegt gespiegelt in der anderen Ecke
      f.scale.set(zo.x1 - zo.x0, zo.z1 - zo.z0, 1);
      f.position.set(sp * (zo.x0 + zo.x1) / 2, 0.016, (zo.z0 + zo.z1) / 2);
      f.material.opacity = 0.32 + 0.14 * Math.sin(this.zugZeit * 5);
    });
    this.zugLinie.visible = !!zo;
    if (zo) {
      const von = m.state === 'rally' && me.plan ? new THREE.Vector3(me.plan.x, 0.06, me.plan.z) : new THREE.Vector3(me.x, 0.06, me.z - 0.5);
      this.zugLinie.geometry.setFromPoints([von, new THREE.Vector3((zo.x0 + zo.x1) / 2, 0.06, (zo.z0 + zo.z1) / 2)]);
      this.zugLinie.computeLineDistances();
    }

    // Aufschlagfeld aufhellen
    if ((m.state === 'serveReady' || m.state === 'toss') && m.serveBox && m.mode !== 'ballmaschine' && !zo) {
      const sb = m.serveBox;
      this.boxGlow.visible = true;
      this.boxGlow.scale.set(C.W, C.SL, 1);
      this.boxGlow.position.set((sb.x0 + sb.x1) / 2, 0.011, sb.zs * C.SL / 2);
    } else {
      this.boxGlow.visible = false;
    }

    // Kamera hinter dir, folgt dir leicht
    const narrow = this.aspect < 1;
    // Sehr breite Bildschirme (iPhone quer) zeigen oben und unten weniger. Damit deine Figur nicht
    // am unteren Rand abgeschnitten wird, geht die Kamera dort etwas höher und weiter zurück.
    // breit = 0 bei normalen Bildschirmen (16:9 und schmaler), 1 bei sehr breiten.
    const breit = clamp((this.aspect - 1.78) / 0.4, 0, 1);
    const B = BLICK[this.blick] || BLICK.tv;
    let tp, tl, nah = 0.3;
    if (B === BLICK.tv) {
      // Wie im Fernsehen: weit hinten, hoch oben, enger Blickwinkel. Die Kamera geht nur wenig mit dir mit.
      this.setWinkel(B.winkel + 4 * breit, B.hochMax, 18);
      tp = new THREE.Vector3(me.x * B.mitX, B.hoch, B.hinten + Math.max(0, me.z - 14.5) * 0.8);
      // Die Kamera neigt sich so, dass der untere Bildrand knapp hinter deiner Grundlinie liegt – egal wie hoch der Bildschirm ist.
      // Fliegt der Ball sehr hoch (Lob), schaut sie ein wenig mit nach oben.
      const halb = this.camera.fov / 2 * Math.PI / 180;
      const runter = Math.max(0.03, Math.atan2(B.hoch, B.hinten - B.unten) - halb - clamp((b.y - 4) * 0.008, 0, 0.05));   // so steil schaut die Kamera nach unten
      // Schwenk: Die Kamera dreht sich dir ein Stück nach, wenn du zur Seite läufst (wie der Kameramann im Fernsehen)
      tl = new THREE.Vector3(me.x * B.schwenk + b.x * 0.05, tp.y - Math.tan(runter) * 40, tp.z - 40);
      // Die Tribüne zwischen Kamera und Platz ausblenden: Die Kamera zeichnet erst ab einer bestimmten Entfernung.
      nah = (tp.z - B.ab) * Math.cos(runter) + B.hoch * Math.sin(runter);
    } else {
      this.setWinkel(B.winkel);
      tp = new THREE.Vector3(me.x * B.mitX, narrow ? 9.5 : B.hoch + 0.6 * breit,
        narrow ? 29 : B.hinten + 3 * breit + Math.max(0, me.z - 13) * 0.6);
      tl = new THREE.Vector3(me.x * 0.2 + b.x * 0.08, 0.8, narrow ? -1 : B.zielZ);
    }
    const k = Math.min(1, dt * 3);
    this.camPos.lerp(tp, k); this.camLook.lerp(tl, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    // Kamera-Ruck nach einem harten Schlag: Sie zittert kurz und kommt sofort wieder zur Ruhe.
    const R = this.ruck;
    R.t += dt;
    if (R.t < RUCK_ZEIT) {
      const weit = RUCK * R.w * (1 - R.t / RUCK_ZEIT) * (B === BLICK.tv ? 1 : 0.4);    // die nahe Kamera wackelt weniger, sonst wird einem schwindelig
      this.camera.position.x += Math.sin(R.t * 85) * weit;
      this.camera.position.y += Math.cos(R.t * 67) * weit * 0.7;
    }
    // Blitz am Treffpunkt: Der Ring wird schnell größer und verblasst dabei. Er schaut immer zur Kamera.
    const bz = this.blitz, bu = bz.userData;
    bu.t += dt;
    if (bz.visible) {
      const u = bu.t / BLITZ_ZEIT;
      if (u >= 1) bz.visible = false;
      else {
        bz.scale.setScalar((0.25 + 1.1 * u) * (0.6 + 0.6 * bu.w));
        bz.material.opacity = (1 - u) * (0.35 + 0.5 * bu.w);
        bz.quaternion.copy(this.camera.quaternion);
      }
    }
    // Ab welcher Entfernung gezeichnet wird (nur beim TV-Blick). Am Anfang fährt die Kamera erst nach hinten in die Tribüne.
    // Damit man dabei nicht auf eine blaue Wand schaut, rechnen wir mit der Stelle, an der die Kamera JETZT gerade ist:
    // Wie weit ist es in Blickrichtung bis zum Boden vor der Tribüne (z = ab)? Alles davor wird weggelassen.
    if (B === BLICK.tv && this.camPos.distanceTo(tp) > 0.05) {
      const blick = new THREE.Vector3(); this.camera.getWorldDirection(blick);
      const boden = new THREE.Vector3(this.camPos.x, 0, B.ab).sub(this.camPos);
      nah = this.camPos.z > B.ab ? Math.max(0.3, boden.dot(blick)) : 0.3;
    }
    if (this.nahVorher == null) this.nahVorher = this.camera.near;      // merken, wie es vor dem Match war
    if (this.camera.near !== nah) { this.camera.near = nah; this.camera.updateProjectionMatrix(); }
  }

  menuCamera(dt) {
    const a = this.time * 0.07;
    const tp = new THREE.Vector3(Math.sin(a) * 30, 13 + Math.sin(a * 0.7) * 2, Math.cos(a) * 36);
    this.camPos.lerp(tp, Math.min(1, dt * 1.5));
    this.camLook.lerp(new THREE.Vector3(0, 1, 0), Math.min(1, dt * 2));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.ball.visible = this.blob.visible = this.trail.visible = this.blitz.visible = false;
    for (const av of this.avatars) if (av) av.group.visible = false;
    if (this.maschine) this.maschine.visible = false;
  }

  showAvatars(on) { for (const av of this.avatars) if (av) av.group.visible = on; }
}
