// Powershot – Tageszeit und Wetter auf dem Turniergelände.
// Vorbild: Tageszeiten und Wetter im Schwester-Spiel Reitturnier (KvB1982/Reitturnier, js/wetter.js).
// Hier läuft keine Uhr: Man wählt Tageszeit und Wetter selbst (Knöpfe rechts auf dem Gelände), abends nach dem Match ist es von allein Abend.
// Das Wetter ändert nur das Aussehen (Himmel, Licht, Schatten, Dunst, Regen) – am Spiel ändert es nichts.

import * as THREE from 'three';

// Tageszeiten: Himmel, Farbe und Stärke der Sonne, Helligkeit von überall, wo die Sonne steht (von der Figur aus: [Osten, hoch, Süden])
export const ZEITEN = {
  morgen: { name: 'Morgen', bild: '🌅', himmel: 0xf1c9a8, farbe: 0xffc892, sonne: 1.5, hell: 0.95, ri: [-96, 52, 56] },
  tag:    { name: 'Mittag', bild: '🕛', himmel: 0x8cc0ee, farbe: 0xfff4e0, sonne: 2.3, hell: 1.25, ri: [50, 110, 40] },
  abend:  { name: 'Abend', bild: '🌇', himmel: 0xeea474, farbe: 0xff9a5a, sonne: 1.35, hell: 0.85, ri: [98, 44, 60] },
  nacht:  { name: 'Nacht', bild: '🌙', himmel: 0x1a2748, farbe: 0x9db2ff, sonne: 0.55, hell: 0.42, ri: [-40, 105, 50] },
};
// Wetter: grau = so viel Grau kommt in den Himmel, sonne/hell = mal so viel Licht, nah/fern = so viel näher rückt der Dunst, regen = fallen Tropfen?
export const WETTER = {
  sonne:  { name: 'Sonne', bild: '☀️', grau: 0, ton: 0xb9c3ca, sonne: 1, hell: 1, nah: 1, fern: 1 },
  wolken: { name: 'Wolken', bild: '⛅', grau: 0.6, ton: 0xb9c3ca, sonne: 0.5, hell: 0.95, nah: 1, fern: 1 },
  regen:  { name: 'Regen', bild: '🌧️', grau: 0.82, ton: 0x8d99a3, sonne: 0.3, hell: 0.85, nah: 0.5, fern: 0.6, regen: true },
  nebel:  { name: 'Nebel', bild: '🌫️', grau: 0.88, ton: 0xd5dadb, sonne: 0.45, hell: 0.95, nah: 0.02, fern: 0.13 },
};
export const ZEIT_REIHE = ['tag', 'abend', 'nacht', 'morgen'], WETTER_REIHE = ['sonne', 'wolken', 'regen', 'nebel'];

const TROPFEN = 900, HOCH = 16, WEIT = 26;     // Regen: so viele Striche fallen rund um die Kamera (Meter hoch und weit)
const UMSCHALTEN = 1.6;                        // so schnell blendet das Licht um (größer = schneller)

export class GelaendeWetter {
  // szene = die Szene des Spiels (Himmel und Dunst), gruppe = da kommt der Regen hinein, hemi/sonne = die zwei Lichter des Geländes
  constructor(szene, gruppe, hemi, sonne) {
    this.szene = szene; this.hemi = hemi; this.licht = sonne;
    this.zeit = 'tag'; this.wetter = 'sonne';
    this.nah = 1; this.fern = 1;               // so stark rückt der Dunst gerade heran (liest anlage.js)
    this.ri = new THREE.Vector3(50, 110, 40);
    this.sofort = true;                        // beim ersten Bild nicht überblenden
    this.c = new THREE.Color(); this.c2 = new THREE.Color(); this.v = new THREE.Vector3();
    // Regen: lauter kurze Striche
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TROPFEN * 6), 3));
    this.regen = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd8ecfa, transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
    this.regen.frustumCulled = false; this.regen.visible = false; this.regen.renderOrder = 5;
    this.tropfen = [];
    for (let i = 0; i < TROPFEN; i++) this.tropfen.push([(Math.random() - 0.5) * WEIT * 2, Math.random() * HOCH, (Math.random() - 0.5) * WEIT * 2, 13 + Math.random() * 6]);
    this.staerke = 0;
    gruppe.add(this.regen);
  }

  setze(zeit, wetter) {
    if (ZEITEN[zeit]) this.zeit = zeit;
    if (WETTER[wetter]) this.wetter = wetter;
  }

  // Jedes Bild: Licht und Himmel weich auf die gewählte Stimmung bringen. (mx, mz) = die Stelle, auf die die Kamera schaut.
  schritt(dt, kamera, mx, mz) {
    const Z = ZEITEN[this.zeit], W = WETTER[this.wetter], k = this.sofort || dt >= 1 ? 1 : Math.min(1, dt * UMSCHALTEN);
    this.sofort = false;
    const dunkel = Math.min(1, Z.hell / 1.25);
    const himmel = this.c.set(Z.himmel).lerp(this.c2.set(W.ton).multiplyScalar(dunkel), W.grau);
    const S = this.szene;
    if (S.background && S.background.isColor) { S.background.lerp(himmel, k); S.fog.color.copy(S.background).lerp(this.c2.set(0xffffff), 0.12 * dunkel); }
    this.licht.color.lerp(this.c2.set(Z.farbe), k);
    this.licht.intensity += (Z.sonne * W.sonne - this.licht.intensity) * k;
    this.hemi.color.lerp(this.c2.set(0xffffff).lerp(this.c.set(Z.farbe), 0.5), k);
    this.hemi.intensity += (Z.hell * W.hell - this.hemi.intensity) * k;
    this.nah += (W.nah - this.nah) * k; this.fern += (W.fern - this.fern) * k;
    // Die Sonne wandert mit der Figur mit, damit die Schatten in ihrer Nähe scharf sind
    this.ri.lerp(this.v.set(Z.ri[0], Z.ri[1], Z.ri[2]), k);
    this.licht.position.set(mx + this.ri.x, this.ri.y, mz + this.ri.z);
    this.licht.target.position.set(mx, 0, mz);
    // Regen fällt rund um die Kamera
    this.staerke += ((W.regen ? 1 : 0) - this.staerke) * Math.min(1, dt * 0.8 + (dt >= 1 ? 1 : 0));
    this.regen.visible = this.staerke > 0.03;
    if (!this.regen.visible) return;
    const vor = kamera.getWorldDirection(this.v), px = kamera.position.x + vor.x * 12, pz = kamera.position.z + vor.z * 12, unten = Math.max(0, kamera.position.y - HOCH * 0.7);
    const pos = this.regen.geometry.attributes.position.array, n = Math.round(TROPFEN * this.staerke);
    for (let i = 0; i < n; i++) {
      const t = this.tropfen[i];
      t[1] -= t[3] * dt;
      if (t[1] < 0) { t[1] += HOCH; t[0] = (Math.random() - 0.5) * WEIT * 2; t[2] = (Math.random() - 0.5) * WEIT * 2; }
      const o = i * 6;
      pos[o] = px + t[0]; pos[o + 1] = unten + t[1]; pos[o + 2] = pz + t[2];
      pos[o + 3] = px + t[0] + 0.05; pos[o + 4] = unten + t[1] + 0.6; pos[o + 5] = pz + t[2];
    }
    this.regen.geometry.setDrawRange(0, n * 2);
    this.regen.geometry.attributes.position.needsUpdate = true;
  }
}
