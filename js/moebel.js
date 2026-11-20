// Powershot – selbst gebaute Möbel für die begehbaren Häuser auf dem Turniergelände.
//
// Jedes Möbelstück ist aus einfachen Formen zusammengesetzt: Kisten (K), stehende Rollen (Z), liegende Rollen (L)
// und Kugeln (S). Maße in Metern. Bei jedem Stück gilt: x = Breite, y = Höhe, z = Tiefe; die Rückseite (−z) steht an der Wand.
// Damit das iPad nicht hunderte Einzelteile zeichnen muss, werden am Ende alle Teile mit derselben Farbe
// zu EINER Form verschmolzen – ein ganzer Raum besteht dann nur aus etwa 20 Formen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const HOLZ = 0x9a744a, HOLZ_HELL = 0xc9a876, HOLZ_DUNKEL = 0x5e4630, STAHL = 0xb4b8be, EISEN = 0x2a2c30, WEISS = 0xf2f0ea, GRAU = 0x8a8e94;
const POLSTER = 0x2e4a78, GRUEN = 0x3f8a48, TOPF = 0xb8643c, GLAS = 0xa8cfe0, GUMMI = 0x1c1c1e;
const BUNT = [0xd84a3a, 0xf0c030, 0x3a7ad8, 0x3aa85a, 0xe8843a, 0x8a5ac8, 0xf2f0ea, 0x30b8c0];
const TEPPICH = { kraft: 0x3a3e46, physio: 0x7aa8c0, essen: 0x9a3a36, saiten: 0x6a4ac8, presse: 0x2e4a78, hotel: 0x8a2e3a };

// Der Bauplan jedes Möbelstücks. b = { K, Z, L, S } sind die vier Bau-Befehle, n = eine laufende Nummer (für bunte Abwechslung)
const PLAENE = {
  hantelregal(b, n) {
    for (const x of [-0.85, 0.85]) b.K(EISEN, 0.06, 1.0, 0.5, x, 0.5, -0.1);
    for (const [y, z] of [[0.3, 0.05], [0.62, -0.08], [0.94, -0.2]]) {
      b.K(EISEN, 1.76, 0.04, 0.3, 0, y, z);
      for (let i = 0; i < 5; i++) { const x = -0.68 + i * 0.34, r = 0.055 + (i % 3) * 0.012; b.L(GUMMI, r, 0.07, x - 0.07, y + r + 0.02, z); b.L(GUMMI, r, 0.07, x + 0.07, y + r + 0.02, z); b.L(STAHL, 0.016, 0.2, x, y + r + 0.02, z); }
    }
  },
  spiegel(b) {
    b.K(0xc6dbe6, 1.8, 1.9, 0.04, 0, 1.0, -0.32, { metall: 0.75, rau: 0.12 });
    b.K(HOLZ_HELL, 1.86, 0.06, 0.06, 0, 1.98, -0.31); b.K(HOLZ_HELL, 1.86, 0.06, 0.06, 0, 0.04, -0.31);
    b.L(HOLZ_HELL, 0.022, 1.7, 0, 0.95, -0.14); for (const x of [-0.8, 0.8]) b.K(STAHL, 0.03, 0.03, 0.18, x, 0.95, -0.23);       // Stange zum Festhalten
  },
  rad(b) {
    b.K(EISEN, 0.12, 0.06, 1.1, 0, 0.03, 0); b.K(EISEN, 0.5, 0.05, 0.08, 0, 0.03, 0.5); b.K(EISEN, 0.5, 0.05, 0.08, 0, 0.03, -0.5);
    b.L(0x3a3e46, 0.25, 0.07, 0, 0.36, 0.3); b.L(0xd84a3a, 0.2, 0.08, 0, 0.36, 0.3);                                              // Schwungrad
    b.K(EISEN, 0.07, 0.75, 0.07, 0, 0.5, -0.22); b.K(GUMMI, 0.2, 0.06, 0.28, 0, 0.9, -0.24);                                       // Sattel
    b.K(EISEN, 0.07, 0.95, 0.07, 0, 0.56, 0.42); b.L(GUMMI, 0.02, 0.5, 0, 1.06, 0.42); b.K(0x20262e, 0.18, 0.12, 0.03, 0, 1.16, 0.45);   // Lenker und Anzeige
    b.L(STAHL, 0.03, 0.34, 0, 0.3, 0);                                                                                             // Pedale
  },
  gymbaelle(b, n) {
    b.S(BUNT[n % 8], 0.32, -0.5, 0.32, -0.02); b.S(BUNT[(n + 2) % 8], 0.27, 0.15, 0.27, 0.08); b.S(BUNT[(n + 5) % 8], 0.3, 0.6, 0.3, -0.1);
    for (const [x, f] of [[-0.75, 0], [-0.55, 3]]) b.Z(BUNT[(n + f + 1) % 8], 0.075, 0.6, x + 0.9, 0.3, 0.32);                       // zwei aufgerollte Matten
  },
  sprossen(b) {
    for (const x of [-0.5, 0.5]) b.K(HOLZ_HELL, 0.08, 2.3, 0.12, x, 1.15, -0.3);
    for (let i = 0; i < 10; i++) b.L(HOLZ, 0.022, 1.0, 0, 0.25 + i * 0.21, -0.28);
    b.K(0x3a7ad8, 0.9, 0.05, 0.6, 0, 0.03, 0.12);
  },
  wasser(b) {
    b.K(WEISS, 0.36, 1.0, 0.36, 0, 0.5, -0.18); b.Z(0x7ab8e8, 0.13, 0.36, 0, 1.2, -0.18, { durch: 0.6 }); b.K(GRAU, 0.2, 0.12, 0.05, 0, 0.72, 0.02);
    b.K(HOLZ, 0.7, 0.45, 0.4, 0.7, 0.23, -0.16); for (let i = 0; i < 3; i++) b.K(WEISS, 0.2, 0.07 + i * 0.03, 0.3, 0.48 + i * 0.22, 0.5 + i * 0.015, -0.16);   // Handtücher
  },
  hantelbank(b) {
    b.K(GUMMI, 0.34, 0.08, 1.25, 0, 0.46, 0.1); b.K(EISEN, 0.08, 0.42, 0.08, 0, 0.21, 0.6); b.K(EISEN, 0.5, 0.05, 0.08, 0, 0.03, 0.6); b.K(EISEN, 0.5, 0.05, 0.08, 0, 0.03, -0.4); b.K(EISEN, 0.08, 0.42, 0.08, 0, 0.21, -0.4);
    for (const x of [-0.55, 0.55]) { b.K(EISEN, 0.07, 1.1, 0.07, x, 0.55, -0.42); b.K(EISEN, 0.07, 0.05, 0.5, x, 0.03, -0.42); }
    b.L(STAHL, 0.018, 1.8, 0, 1.08, -0.42);
    for (const x of [-0.8, 0.8]) { b.L(GUMMI, 0.21, 0.05, x, 1.08, -0.42); b.L(0xd84a3a, 0.17, 0.05, x + Math.sign(x) * 0.06, 1.08, -0.42); }
  },
  matte(b, n) { b.K(BUNT[(n + 2) % 6], 0.75, 0.035, 1.8, -0.45, 0.09, 0); b.K(BUNT[(n + 5) % 6], 0.75, 0.035, 1.8, 0.45, 0.09, 0); b.S(BUNT[n % 8], 0.11, 0.45, 0.2, 0.5); },
  regal(b, n) {
    b.K(HOLZ, 1.7, 1.8, 0.04, 0, 0.9, -0.36); for (const x of [-0.84, 0.84]) b.K(HOLZ, 0.04, 1.8, 0.38, x, 0.9, -0.18);
    for (let e = 0; e < 5; e++) {
      const y = 0.06 + e * 0.43; b.K(HOLZ, 1.7, 0.04, 0.38, 0, y, -0.18);
      if (e < 4) for (let i = 0; i < 4; i++) { const h = 0.16 + ((n + e * 3 + i * 5) % 4) * 0.05; b.K((e + i + n) % 3 ? BUNT[(n + e * 2 + i) % 8] : WEISS, 0.3, h, 0.26, -0.6 + i * 0.4, y + 0.02 + h / 2, -0.17); }
    }
  },
  liege(b) {
    b.K(POLSTER, 1.85, 0.1, 0.66, 0, 0.72, 0); b.K(WEISS, 0.7, 0.03, 0.6, 0.3, 0.785, 0); b.K(WEISS, 0.3, 0.09, 0.36, -0.72, 0.8, 0);
    for (const x of [-0.8, 0.8]) for (const z of [-0.26, 0.26]) b.K(STAHL, 0.05, 0.67, 0.05, x, 0.335, z);
    b.K(STAHL, 1.6, 0.04, 0.04, 0, 0.25, -0.26); b.K(STAHL, 1.6, 0.04, 0.04, 0, 0.25, 0.26);
  },
  eiswanne(b) {
    b.K(STAHL, 1.6, 0.75, 0.8, 0, 0.375, -0.02, { metall: 0.6, rau: 0.35 }); b.K(0x8fd0ee, 1.46, 0.02, 0.66, 0, 0.74, -0.02, { rau: 0.15 });
    for (let i = 0; i < 6; i++) b.K(WEISS, 0.1, 0.06, 0.1, -0.55 + i * 0.22, 0.76, -0.15 + (i % 3) * 0.14);                           // Eiswürfel
    b.K(HOLZ, 0.5, 0.2, 0.4, 0.55, 0.1, 0.62 - 0.02);                                                                              // Tritt zum Einsteigen
  },
  schrank(b) { b.K(WEISS, 1.5, 1.9, 0.5, 0, 0.95, -0.12); for (const x of [-0.5, 0, 0.5]) { b.K(GRAU, 0.02, 1.8, 0.02, x + 0.24, 0.95, 0.135); b.K(STAHL, 0.03, 0.16, 0.03, x - 0.17, 1.0, 0.15); } b.K(0xd8483c, 0.22, 0.22, 0.02, 0.5, 1.5, 0.14); b.K(WEISS, 0.14, 0.05, 0.03, 0.5, 1.5, 0.15); b.K(WEISS, 0.05, 0.14, 0.03, 0.5, 1.5, 0.15); },
  hocker(b) { b.Z(GUMMI, 0.19, 0.07, 0, 0.5, 0); b.Z(STAHL, 0.03, 0.42, 0, 0.26, 0); b.Z(EISEN, 0.24, 0.04, 0, 0.03, 0); b.K(STAHL, 0.5, 0.75, 0.4, 0.75, 0.375, 0); b.K(WEISS, 0.4, 0.1, 0.3, 0.75, 0.8, 0); },
  theke(b, n) {
    b.K(HOLZ_DUNKEL, 1.9, 0.9, 0.62, 0, 0.45, -0.05); b.K(0xe8e2d4, 1.96, 0.05, 0.7, 0, 0.925, -0.05);
    b.K(GLAS, 1.8, 0.4, 0.03, 0, 1.2, 0.22, { durch: 0.35, rau: 0.1 }); b.K(STAHL, 1.86, 0.03, 0.34, 0, 1.4, 0.06);
    for (let i = 0; i < 5; i++) { b.Z(STAHL, 0.15, 0.07, -0.72 + i * 0.36, 0.985, -0.08); b.Z([0xd84a3a, 0x6aa84a, 0xf0c030, 0xe8843a, 0xf2ead0][(i + n) % 5], 0.13, 0.03, -0.72 + i * 0.36, 1.03, -0.08); }
  },
  kuehlschrank(b, n) {
    b.K(STAHL, 0.9, 1.95, 0.6, -0.45, 0.975, -0.1, { metall: 0.5, rau: 0.4 }); b.K(0x1c2228, 0.78, 1.6, 0.02, -0.45, 1.05, 0.21);
    for (let e = 0; e < 4; e++) for (let i = 0; i < 5; i++) b.Z(BUNT[(e * 2 + i + n) % 8], 0.045, 0.22, -0.75 + i * 0.15, 0.46 + e * 0.38, 0.14);
    b.K(HOLZ, 0.8, 0.9, 0.55, 0.5, 0.45, -0.1); b.K(EISEN, 0.3, 0.32, 0.3, 0.42, 1.06, -0.1); b.Z(WEISS, 0.04, 0.09, 0.72, 0.95, 0.02); b.Z(WEISS, 0.04, 0.09, 0.82, 0.95, -0.08);   // Kaffeemaschine und Tassen
  },
  eckbank(b, n) {
    const f = [0x9a3a36, 0x2e4a78, 0x3f6a48][n % 3];
    b.K(HOLZ_DUNKEL, 1.9, 0.42, 0.5, 0, 0.21, -0.12); b.K(f, 1.86, 0.08, 0.48, 0, 0.46, -0.11); b.K(f, 1.86, 0.5, 0.1, 0, 0.75, -0.32);
    b.Z(HOLZ_HELL, 0.33, 0.04, 0, 0.74, 0.38 - 0.2); b.Z(EISEN, 0.035, 0.72, 0, 0.36, 0.18); b.Z(EISEN, 0.2, 0.03, 0, 0.02, 0.18);
  },
  pflanze(b, n) {
    b.Z(TOPF, 0.2, 0.36, 0, 0.18, 0, { oben: 0.24 }); b.Z(0x3a2a1c, 0.21, 0.02, 0, 0.36, 0); b.Z(0x5a4630, 0.025, 0.5, 0, 0.6, 0);
    for (const [x, y, z, r] of [[0, 1.0, 0, 0.26], [0.16, 0.82, 0.08, 0.2], [-0.15, 0.88, -0.06, 0.2], [0.02, 1.26, -0.04, 0.18], [-0.06, 0.76, 0.16, 0.17]]) b.S(n % 2 ? GRUEN : 0x2e7a40, r, x, y, z);
  },
  tisch4(b, n) {
    b.Z(HOLZ_HELL, 0.56, 0.04, 0, 0.74, 0); b.Z(EISEN, 0.04, 0.7, 0, 0.36, 0); b.Z(EISEN, 0.26, 0.03, 0, 0.02, 0);
    b.Z(WEISS, 0.05, 0.12, 0, 0.82, 0); b.S(BUNT[n % 6], 0.05, 0, 0.92, 0);                                                         // kleine Vase
    for (let i = 0; i < 4; i++) {
      const w = i * Math.PI / 2 + Math.PI / 4, sx = Math.sin(w), cz = Math.cos(w);
      b.Z(WEISS, 0.13, 0.015, sx * 0.34, 0.77, cz * 0.34);
      b.K(HOLZ, 0.4, 0.05, 0.4, sx * 0.82, 0.45, cz * 0.82, { dreh: w }); b.K(HOLZ, 0.4, 0.45, 0.05, sx * 1.0, 0.7, cz * 1.0, { dreh: w });
      b.K(EISEN, 0.34, 0.43, 0.34, sx * 0.82, 0.215, cz * 0.82, { dreh: w, hohl: true });
    }
  },
  werkbank(b, n) {
    b.K(HOLZ_HELL, 1.9, 0.06, 0.7, 0, 0.9, -0.05); for (const x of [-0.85, 0.85]) b.K(EISEN, 0.06, 0.88, 0.6, x, 0.44, -0.05); b.K(HOLZ, 1.7, 0.04, 0.55, 0, 0.3, -0.05);
    b.K(HOLZ, 1.9, 0.9, 0.03, 0, 1.45, -0.38);                                                                                     // Lochwand mit Werkzeug
    for (let i = 0; i < 6; i++) b.K([STAHL, 0xd84a3a, EISEN, 0xf0c030][i % 4], 0.05, 0.22 + (i % 3) * 0.06, 0.03, -0.7 + i * 0.28, 1.5, -0.35);
    for (let i = 0; i < 4; i++) b.L(BUNT[(i * 3 + n) % 8], 0.09, 0.07, -0.6 + i * 0.3, 0.42, -0.05);                                 // Saitenrollen
    b.K(EISEN, 0.3, 0.14, 0.2, 0.55, 1.0, -0.1); b.K(0x3a7ad8, 0.36, 0.1, 0.26, -0.5, 0.98, -0.05);
  },
  schlaegerwand(b, n) {
    b.K(0x3a3e46, 1.9, 1.5, 0.04, 0, 1.25, -0.36);
    for (let i = 0; i < 5; i++) {
      const x = -0.76 + i * 0.38, f = BUNT[(i * 2 + n) % 8];
      b.Z(f, 0.13, 0.022, x, 1.55, -0.31, { kipp: true, oval: 1.3 }); b.Z(0xe8e8e0, 0.108, 0.026, x, 1.55, -0.31, { kipp: true, oval: 1.3 });   // Rahmen und Saiten
      b.K(f, 0.035, 0.2, 0.025, x, 1.29, -0.31); b.K(GUMMI, 0.04, 0.24, 0.035, x, 1.08, -0.31);                                       // Hals und Griff
    }
    b.K(HOLZ, 1.9, 0.5, 0.45, 0, 0.25, -0.14); for (let i = 0; i < 4; i++) b.Z(0xd8e84a, 0.04, 0.22, -0.6 + i * 0.4, 0.61, -0.1);   // Balldosen
  },
  rollen(b, n) {
    b.K(HOLZ, 1.8, 1.7, 0.04, 0, 0.85, -0.36); for (const x of [-0.89, 0.89]) b.K(HOLZ, 0.04, 1.7, 0.3, x, 0.85, -0.22);
    for (let e = 0; e < 4; e++) { b.K(HOLZ, 1.8, 0.03, 0.3, 0, 0.1 + e * 0.42, -0.22); for (let i = 0; i < 6; i++) b.Z(BUNT[(e * 3 + i + n) % 8], 0.11, 0.07, -0.7 + i * 0.28, 0.24 + e * 0.42, -0.2, { kipp: true }); }
  },
  werktisch(b, n) {
    b.K(HOLZ_HELL, 1.6, 0.06, 0.8, 0, 0.8, 0); for (const x of [-0.7, 0.7]) for (const z of [-0.32, 0.32]) b.K(EISEN, 0.06, 0.78, 0.06, x, 0.39, z);
    b.K(EISEN, 0.5, 0.1, 0.3, -0.3, 0.88, 0); b.Z(STAHL, 0.03, 0.3, -0.3, 1.05, 0); b.K(STAHL, 0.8, 0.03, 0.05, -0.3, 1.2, 0);
    b.Z(BUNT[n % 8], 0.14, 0.02, -0.3, 1.24, 0, { oval: 1.3 }); b.Z(0xe8e8e0, 0.115, 0.024, -0.3, 1.24, 0, { oval: 1.3 });
    for (let i = 0; i < 3; i++) b.L(BUNT[(i * 3 + n + 1) % 8], 0.08, 0.06, 0.35 + i * 0.16, 0.91, 0.1);
    b.Z(GUMMI, 0.18, 0.06, 0, 0.5, 0.75); b.Z(STAHL, 0.03, 0.46, 0, 0.25, 0.75);                                                     // Hocker
  },
  stellwand(b, n) {
    b.K(0x2e4a78, 1.9, 2.0, 0.06, 0, 1.1, -0.3); for (const x of [-0.8, 0.8]) b.K(EISEN, 0.08, 0.1, 0.6, x, 0.05, -0.3);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) if ((i + k) % 2) b.K(0x4a6aa0, 0.36, 0.36, 0.01, -0.69 + i * 0.46, 0.42 + k * 0.46, -0.265);       // Karo-Muster statt Werbung
    b.K(HOLZ_DUNKEL, 1.2, 0.74, 0.45, 0, 0.37, 0.12); b.Z(EISEN, 0.012, 0.2, -0.2, 0.84, 0.12); b.S(EISEN, 0.035, -0.2, 0.96, 0.14); b.Z(0x7ab8e8, 0.035, 0.2, 0.3, 0.84, 0.1);   // Tisch mit Mikrofon und Wasserflasche
  },
  schreibtisch(b, n) {
    b.K(WEISS, 1.5, 0.04, 0.6, 0, 0.74, -0.08); for (const x of [-0.7, 0.7]) b.K(GRAU, 0.04, 0.72, 0.55, x, 0.36, -0.08);
    b.K(0x3a3e46, 0.34, 0.02, 0.24, -0.2, 0.77, -0.02); b.K(0x20262e, 0.34, 0.22, 0.02, -0.2, 0.88, -0.15); b.K(0x9cc0e4, 0.3, 0.18, 0.01, -0.2, 0.88, -0.138);   // Laptop
    b.K(WEISS, 0.2, 0.01, 0.28, 0.3, 0.765, -0.05); b.Z(BUNT[n % 8], 0.04, 0.09, 0.55, 0.8, -0.2);
    b.K(EISEN, 0.42, 0.06, 0.42, 0, 0.46, 0.38 - 0.1); b.K(EISEN, 0.42, 0.42, 0.05, 0, 0.72, 0.5 - 0.1); b.Z(STAHL, 0.03, 0.4, 0, 0.23, 0.28); b.Z(EISEN, 0.22, 0.03, 0, 0.02, 0.28);   // Drehstuhl
  },
  stativ(b) {
    for (const w of [0, 2.094, 4.189]) b.K(EISEN, 0.035, 1.3, 0.035, Math.sin(w) * 0.2, 0.62, Math.cos(w) * 0.2 - 0.05, { neig: [Math.cos(w) * 0.32, -Math.sin(w) * 0.32] });
    b.K(0x20262e, 0.22, 0.2, 0.42, 0, 1.38, -0.05); b.Z(EISEN, 0.07, 0.16, 0, 1.38, 0.24, { kipp: true }); b.K(0x20262e, 0.08, 0.1, 0.16, 0.14, 1.5, -0.15);
    b.K(EISEN, 0.5, 0.36, 0.34, 0.6, 0.18, -0.15); b.K(STAHL, 0.5, 0.02, 0.02, 0.6, 0.37, 0.02);                                     // Gerätekoffer
  },
  stuhlreihe(b, n) {
    for (const x of [-0.62, 0, 0.62]) for (const z of [-0.45, 0.45]) {
      b.K(POLSTER, 0.46, 0.06, 0.44, x, 0.46, z); b.K(POLSTER, 0.46, 0.44, 0.05, x, 0.74, z - 0.21);
      b.K(EISEN, 0.4, 0.43, 0.38, x, 0.215, z, { hohl: true });
    }
  },
  sofa2(b, n) {
    const f = [0x6a6e74, 0x2e4a78, 0x8a2e3a, 0xb8a888][n % 4];
    b.K(f, 1.9, 0.3, 0.8, 0, 0.27, -0.03); b.K(f, 1.9, 0.5, 0.2, 0, 0.62, -0.33); for (const x of [-0.86, 0.86]) b.K(f, 0.18, 0.3, 0.8, x, 0.52, -0.03);
    for (const x of [-0.42, 0.42]) b.K(f, 0.78, 0.12, 0.56, x, 0.47, 0.04, { hell: 0.12 }); b.K(BUNT[(n + 1) % 6], 0.34, 0.3, 0.12, -0.55, 0.7, -0.18, { neig: [-0.25, 0] });
    for (const x of [-0.85, 0.85]) for (const z of [-0.35, 0.3]) b.K(HOLZ_DUNKEL, 0.06, 0.12, 0.06, x, 0.06, z);
  },
  koffer(b, n) {
    b.K(STAHL, 1.2, 0.04, 0.6, 0, 0.2, -0.08); for (const x of [-0.58, 0.58]) b.Z(STAHL, 0.016, 1.5, x, 0.95, -0.34); b.L(STAHL, 0.016, 1.16, 0, 1.7, -0.34);
    for (const x of [-0.5, 0.5]) for (const z of [-0.3, 0.15]) b.S(GUMMI, 0.06, x, 0.07, z);
    b.K(BUNT[n % 6], 0.5, 0.7, 0.3, -0.3, 0.57, -0.1); b.K(0x30343c, 0.44, 0.55, 0.26, 0.28, 0.5, -0.1); b.L(BUNT[(n + 3) % 8], 0.15, 0.75, 0, 1.0, -0.08);   // Koffer und eine Tennistasche obendrauf
    b.Z(HOLZ_DUNKEL, 0.25, 0.5, 0.75 + 0.1, 0.25, 0.25 - 0.1); b.Z(0xf0e2b8, 0.2, 0.3, 0.85, 1.25, 0.15, { oben: 0.12 }); b.Z(EISEN, 0.012, 0.6, 0.85, 0.8, 0.15);      // Tischchen mit Lampe
  },
  lampe(b, n) {
    b.Z(EISEN, 0.16, 0.03, -0.5, 0.02, -0.1); b.Z(EISEN, 0.015, 1.5, -0.5, 0.77, -0.1); b.Z(0xf4e6bc, 0.2, 0.3, -0.5, 1.6, -0.1, { oben: 0.13, leucht: true });
    b.K(HOLZ_DUNKEL, 0.9, 0.45, 0.4, 0.35, 0.225, -0.12); b.K(HOLZ, 0.96, 0.03, 0.46, 0.35, 0.465, -0.12);
    for (let i = 0; i < 3; i++) b.K(BUNT[(i * 2 + n) % 8], 0.22, 0.03, 0.3, 0.2 + i * 0.02, 0.5 + i * 0.03, -0.12);                 // ein Stapel Zeitschriften
    b.S(0xd8e84a, 0.033, 0.62, 0.51, -0.1); b.S(0xd8e84a, 0.033, 0.69, 0.51, -0.05);                                               // zwei Tennisbälle
  },
  sessel(b, n) {
    const f = [0x8a2e3a, 0x2e4a78, 0x6a6e74, 0x3f6a48][n % 4];
    for (const [x, w] of [[-0.62, Math.PI / 2 - 0.25], [0.62, -Math.PI / 2 + 0.25]]) {
      b.K(f, 0.7, 0.3, 0.7, x, 0.28, 0, { dreh: w }); b.K(f, 0.7, 0.45, 0.16, x - Math.sin(w) * 0.3, 0.6, -Math.cos(w) * 0.3, { dreh: w });
      for (const s of [-1, 1]) b.K(f, 0.14, 0.2, 0.6, x + Math.cos(w) * 0.32 * s, 0.5, -Math.sin(w) * 0.32 * s, { dreh: w });
    }
    b.Z(HOLZ, 0.26, 0.03, 0, 0.5, 0.25); b.Z(EISEN, 0.025, 0.48, 0, 0.25, 0.25); b.Z(EISEN, 0.16, 0.02, 0, 0.01, 0.25); b.Z(WEISS, 0.04, 0.08, 0.05, 0.555, 0.25);
  },
  bank(b) { b.K(HOLZ, 1.8, 0.06, 0.42, 0, 0.46, -0.1); b.K(HOLZ, 1.8, 0.3, 0.05, 0, 0.8, -0.3); for (const x of [-0.75, 0.75]) { b.K(EISEN, 0.06, 0.44, 0.4, x, 0.22, -0.1); b.K(EISEN, 0.06, 0.5, 0.05, x, 0.7, -0.3); } },
  teppich(b, n, s) { const f = TEPPICH[s.farbe] || 0x6a6e74; b.K(f, 3.6, 0.03, 2.2, 0, 0.1, 0, { hell: -0.05 }); b.K(f, 3.2, 0.03, 1.8, 0, 0.104, 0, { hell: 0.12 }); },
};

// Baut alle Sachen eines Raums und gibt sie als eine Gruppe zurück. sachen = [{ art, x, z, dreh }, …] aus gelaende.js
export function moebelBauen(sachen) {
  const gruppe = new THREE.Group(), haufen = new Map();         // je Farbe (und Art des Materials) ein Haufen Formen
  const stueck = new THREE.Matrix4(), teil = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), eins = new THREE.Vector3(1, 1, 1), ort = new THREE.Vector3(), c = new THREE.Color();
  const rein = (geo, farbe, x, y, z, o = {}) => {
    if (o.hell) farbe = c.setHex(farbe).offsetHSL(0, 0, o.hell).getHex();
    e.set(o.neig ? o.neig[0] : 0, o.dreh || 0, o.neig ? o.neig[1] : 0);
    teil.compose(ort.set(x, y, z), q.setFromEuler(e), eins).premultiply(stueck);
    geo.applyMatrix4(teil);
    const art = farbe + (o.durch ? 'd' + o.durch : '') + (o.metall ? 'm' : '') + (o.leucht ? 'l' : '');
    if (!haufen.has(art)) haufen.set(art, { farbe, o, formen: [] });
    haufen.get(art).formen.push(geo);
  };
  const b = {
    // Kiste: Farbe, Breite, Höhe, Tiefe, dann wo ihre Mitte ist (hohl = nur ein Gestell aus vier Beinen)
    K(farbe, br, h, t, x, y, z, o = {}) {
      if (o.hohl) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = o.dreh || 0, lx = sx * (br / 2 - 0.02), lz = sz * (t / 2 - 0.02); rein(new THREE.BoxGeometry(0.035, h, 0.035), farbe, x + lx * Math.cos(w) + lz * Math.sin(w), y, z - lx * Math.sin(w) + lz * Math.cos(w)); } return; }
      rein(new THREE.BoxGeometry(br, h, t), farbe, x, y, z, o);
    },
    // Stehende Rolle: Farbe, Radius, Höhe, Mitte (kipp = sie liegt mit der flachen Seite nach vorn, oval = in die Höhe gezogen)
    Z(farbe, r, h, x, y, z, o = {}) {
      const geo = new THREE.CylinderGeometry(o.oben ?? r, r, h, 12);
      if (o.kipp) geo.rotateX(Math.PI / 2);
      if (o.oval) geo.scale(1, o.kipp ? o.oval : 1, o.kipp ? 1 : o.oval);
      rein(geo, farbe, x, y, z, o);
    },
    // Liegende Rolle (quer, entlang der Breite): Farbe, Radius, Länge, Mitte
    L(farbe, r, lang, x, y, z, o = {}) { rein(new THREE.CylinderGeometry(r, r, lang, 10).rotateZ(Math.PI / 2), farbe, x, y, z, o); },
    // Kugel: Farbe, Radius, Mitte
    S(farbe, r, x, y, z, o = {}) { rein(new THREE.SphereGeometry(r, 10, 7), farbe, x, y, z, o); },
  };
  sachen.forEach((s, n) => {
    const plan = PLAENE[s.art];
    if (!plan) return;
    stueck.makeRotationY(s.dreh || 0).setPosition(s.x, 0, s.z);
    plan(b, n, s);
  });
  for (const { farbe, o, formen } of haufen.values()) {
    const geo = mergeGeometries(formen);
    for (const f of formen) f.dispose();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: farbe, roughness: o.rau ?? 0.82, metalness: o.metall ?? 0, transparent: !!o.durch, opacity: o.durch ?? 1, emissive: o.leucht ? 0xf4d890 : 0x000000, emissiveIntensity: o.leucht ? 0.6 : 0 }));
    m.userData.eigen = true; m.receiveShadow = true;
    gruppe.add(m);
  }
  return gruppe;
}
// Welche Möbel gibt es? (für das Prüfwerkzeug tools/gelaende.mjs wäre das zu viel – three.js läuft dort nicht)
export const MOEBEL_ARTEN = Object.keys(PLAENE);
