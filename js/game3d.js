// Powershot – die 3D-Anzeige: Kamera, Ball, Markierungen, Verbindung von Match, Figuren und Sound

import * as THREE from 'three';
import { Stadium } from './stadium.js';
import { Avatar } from './avatar.js';
import { COURT as C } from './physics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const REASON_TEXT = { aus: 'Aus!', netz: 'Netz!', doppelfehler: 'Doppelfehler!', ass: 'Ass!', winner: 'Winner!' };

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
        if (info.serveNo === 2) call('message', '2. Aufschlag', 'info');
      },
      toss(side, k) { self.tossK[side] = k; },
      swing(side, kind, y) { self.tossK[side] = 0; self.avatars[side].swing(kind, y); },
      hit(h) {
        snd.hit(clamp((h.speed - 8) / 40, 0.2, 1), h.type === 'serve');
        if (h.type === 'serve') call('serveSpeed', Math.round(h.speed * 3.6), h.side);
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
        else say += sc.callText(names);
        if (info.rally >= 9) strength = Math.min(1, strength + 0.25);
        snd.applause(strength, strength > 0.7);
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
    if (m) this.syncMatch(dt, m); else this.menuCamera(dt);
    for (const mk of this.marks) {
      if (!mk.visible) continue;
      mk.userData.life -= dt;
      mk.material.opacity = clamp(mk.userData.life / 1.2, 0, 0.8);
      if (mk.userData.life <= 0) mk.visible = false;
    }
    this.renderer.render(this.scene, this.camera);
  }

  syncMatch(dt, m) {
    const b = m.ball.pos;
    // Figuren
    for (let i = 0; i < 2; i++) {
      const p = m.P[i], av = this.avatars[i];
      if (!av) continue;
      const tossing = (m.state === 'toss' || m.state === 'serveReady') && m.server === i && m.mode !== 'ballmaschine';
      let prep = p.prep, stroke = p.stroke;
      if (tossing) {
        stroke = 'sv';
        prep = m.state === 'toss' ? Math.min(1, this.tossK[i] * 1.5) : (p.isHuman && m.controls && m.controls.charging ? 0.5 : 0.12);
      }
      av.update(dt, { x: p.x, z: p.z, vx: p.vx, vz: p.vz, prep, stroke, mood: m.state === 'pointOver' ? p.mood : null, ball: b });
    }

    // Ball
    const holding = m.state === 'serveReady';
    if (holding && this.avatars[m.server]) {
      const h = this.avatars[m.server].handLWorld;
      this.ball.position.set(h.x, h.y + 0.07, h.z);
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
    const tp = new THREE.Vector3(me.x * 0.35, narrow ? 9.5 : 6.4, narrow ? 29 : 23.5 + Math.max(0, me.z - 13) * 0.6);
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
  }

  showAvatars(on) { for (const av of this.avatars) if (av) av.group.visible = on; }
}
