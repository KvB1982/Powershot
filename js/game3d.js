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
    const hf = 62 * Math.PI / 180;
    this.camera.fov = clamp(2 * Math.atan(Math.tan(hf / 2) / this.aspect) * 180 / Math.PI, 30, 78);
    this.camera.updateProjectionMatrix();
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
    this.trailN = 14;
    this.trailPts = Array.from({ length: this.trailN }, () => new THREE.Vector3());
    this.trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.trailPts),
      new THREE.LineBasicMaterial({ color: 0xe8ff6a, transparent: true, opacity: 0.45 }));
    this.trail.frustumCulled = false;
    S.add(this.trail);

    this.zoneGroup = new THREE.Group();
    S.add(this.zoneGroup);
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
    this.figur = { bild, av, szene, kamera, stift: bild.getContext('2d'), winkel: 0.5 };
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
        snd.hit(clamp((h.speed - 8) / 40, 0.2, 1), h.type === 'serve');
        if (h.type === 'serve') call('serveSpeed', Math.round(h.speed * 3.6), h.side, h.art);
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
        const sc = self.match.score;
        const w = names[info.winner];
        let head = REASON_TEXT[info.reason] || '';
        if (info.reason === 'winner' && info.rally <= 2) head = 'Nicht erreicht!';
        let sub = 'Punkt ' + w;
        let strength = info.reason === 'ass' || info.reason === 'winner' ? 0.75 : 0.45;
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

  syncMatch(dt, m) {
    const b = m.ball.pos;
    // Training mit der Ballmaschine: Statt des Gegners steht die Maschine da (wenn ihr Modell geladen ist)
    const maschine = this.maschineZeigen(m.mode === 'ballmaschine') && m.mode === 'ballmaschine';
    if (this.avatars[1] && m.state !== 'intro') this.avatars[1].group.visible = !maschine;
    // Figuren
    for (let i = 0; i < 2; i++) {
      const p = m.P[i], av = this.avatars[i];
      if (!av) continue;
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
    this.trailPts.pop();
    this.trailPts.unshift(this.ball.position.clone());
    if (!flying) for (const p of this.trailPts) p.copy(this.ball.position);
    this.trail.geometry.setFromPoints(this.trailPts);
    this.trail.visible = flying;

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

    // Aufschlagfeld aufhellen
    if ((m.state === 'serveReady' || m.state === 'toss') && m.serveBox && m.mode !== 'ballmaschine') {
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
    const tp = new THREE.Vector3(me.x * 0.35, narrow ? 9.5 : 6.4 + 0.6 * breit,
      narrow ? 29 : 23.5 + 3 * breit + Math.max(0, me.z - 13) * 0.6);
    const tl = new THREE.Vector3(me.x * 0.2 + b.x * 0.08, 0.8, narrow ? -1 : 1.5);
    const k = Math.min(1, dt * 3);
    this.camPos.lerp(tp, k); this.camLook.lerp(tl, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  menuCamera(dt) {
    const a = this.time * 0.07;
    const tp = new THREE.Vector3(Math.sin(a) * 30, 13 + Math.sin(a * 0.7) * 2, Math.cos(a) * 36);
    this.camPos.lerp(tp, Math.min(1, dt * 1.5));
    this.camLook.lerp(new THREE.Vector3(0, 1, 0), Math.min(1, dt * 2));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.ball.visible = this.blob.visible = this.trail.visible = false;
    for (const av of this.avatars) if (av) av.group.visible = false;
    if (this.maschine) this.maschine.visible = false;
  }

  showAvatars(on) { for (const av of this.avatars) if (av) av.group.visible = on; }
}
