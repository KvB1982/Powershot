// Powershot – die Kamera selbst: Bild holen, Körper erkennen, Vorschau zeichnen.
//
// Die Körpererkennung heißt "MediaPipe" (von Google, kostenlos). Sie läuft komplett auf deinem Gerät –
// das Kamerabild wird nirgendwohin geschickt und nicht gespeichert.
// Das Programm dazu kommt wie three.js von jsDelivr, das "Gehirn" (Modell) liegt in assets/koerper_lite.task.
// Beides wird erst geladen, wenn man die Kamera wirklich einschaltet.
//
// Das Rechnen (wo steht der Spieler?) macht kamera.js – diese Datei liefert nur die Körperpunkte dorthin.

const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3';
const MODELL = new URL('../assets/koerper_lite.task', import.meta.url).href;

// Diese Punkte verbinden wir in der Vorschau mit Linien (Nummern der Körperpunkte)
const LINIEN = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28]];

export class KameraBild {
  // lauf: das KameraLauf-Objekt aus kamera.js, das die Körperpunkte bekommt
  constructor(lauf) {
    this.lauf = lauf;
    this.status = 'aus';            // 'aus' | 'startet' | 'an' | 'fehler'
    this.fehler = '';               // Text, falls etwas nicht geklappt hat
    this.punkte = null;             // die zuletzt erkannten Körperpunkte (für die Vorschau)
    this.bilder = 0;                // wie viele Bilder schon ausgewertet wurden
    this.proSek = 0;                // wie viele Bilder pro Sekunde die Erkennung schafft
    this.kameras = [];              // alle Kameras am Gerät (eingebaute, Webcam …)
    this.kameraId = '';             // welche davon gerade läuft
    this.video = document.createElement('video');
    this.video.playsInline = true;  // wichtig auf iPad/iPhone: sonst springt das Video in den Vollbild-Modus
    this.video.muted = true;
    this.erkenner = null;
    this.strom = null;
    this.takt = null;
  }

  // Gibt es an diesem Gerät überhaupt einen Weg zur Kamera?
  // (Der Browser erlaubt die Kamera nur auf sicheren Seiten: https:// oder localhost.)
  static moeglich() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  // Kamera einschalten. kameraId: eine bestimmte Kamera (sonst die vordere bzw. die erste).
  async start(kameraId = '') {
    if (this.status === 'startet') return;
    this.stop();
    this.status = 'startet'; this.fehler = '';
    try {
      if (!KameraBild.moeglich()) throw new Error('keinZugang');
      const bild = { width: { ideal: 640 }, height: { ideal: 480 } };      // ein kleines Bild reicht und rechnet schneller
      this.strom = await navigator.mediaDevices.getUserMedia({
        audio: false, video: kameraId ? { ...bild, deviceId: { exact: kameraId } } : { ...bild, facingMode: 'user' },
      });
      this.video.srcObject = this.strom;
      await this.video.play();
      const spur = this.strom.getVideoTracks()[0];
      this.kameraId = (spur.getSettings && spur.getSettings().deviceId) || kameraId;
      this.kameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      if (!this.erkenner) this.erkenner = await this.ladeErkenner();
      this.status = 'an';
      this.schleife();
    } catch (e) {
      this.stop();
      this.status = 'fehler';
      this.fehler = e.message === 'keinZugang' ? 'Dieser Browser gibt die Kamera hier nicht frei (nur auf https-Seiten oder localhost).'
        : e.name === 'NotAllowedError' ? 'Die Kamera wurde nicht erlaubt. Bitte im Browser erlauben und noch einmal versuchen.'
          : e.name === 'NotFoundError' || e.name === 'OverconstrainedError' ? 'Keine Kamera gefunden.'
            : 'Die Körpererkennung konnte nicht geladen werden (Internet an?). ' + (e.message || e);
    }
  }

  // Das Erkennungs-Programm laden. Erst probieren wir die Grafikkarte (schnell), sonst rechnet der Prozessor.
  async ladeErkenner() {
    const { FilesetResolver, PoseLandmarker } = await import(MEDIAPIPE + '/vision_bundle.mjs');
    const dateien = await FilesetResolver.forVisionTasks(MEDIAPIPE + '/wasm');
    const bauen = (rechner) => PoseLandmarker.createFromOptions(dateien, {
      baseOptions: { modelAssetPath: MODELL, delegate: rechner }, runningMode: 'VIDEO', numPoses: 1,
    });
    if (new URLSearchParams(location.search).get('kamera') === 'cpu') return bauen('CPU');     // zum Testen
    try { return await bauen('GPU'); } catch (e) { return bauen('CPU'); }
  }

  // Läuft, solange die Kamera an ist: Bild für Bild den Körper suchen und an kamera.js melden.
  schleife() {
    let zuletztBild = -1, zaehler = 0, zaehlerSeit = performance.now();
    const einBild = () => {
      if (this.status !== 'an') return;
      const v = this.video, jetzt = performance.now();
      if (v.readyState >= 2 && v.videoWidth > 0 && v.currentTime !== zuletztBild) {
        zuletztBild = v.currentTime;
        let ergebnis = null;
        try { ergebnis = this.erkenner.detectForVideo(v, jetzt); } catch (e) { /* dieses Bild auslassen */ }
        this.punkte = ergebnis && ergebnis.landmarks && ergebnis.landmarks[0] ? ergebnis.landmarks[0] : null;
        this.lauf.update(this.punkte, v.videoWidth / v.videoHeight, jetzt / 1000);
        this.bilder++; zaehler++;
        if (jetzt - zaehlerSeit >= 1000) { this.proSek = Math.round(zaehler * 1000 / (jetzt - zaehlerSeit)); zaehler = 0; zaehlerSeit = jetzt; }
      }
    };
    // 30-mal pro Sekunde nachsehen, ob ein neues Kamerabild da ist. (Ein Zeit-Takt läuft auch dann weiter,
    // wenn der Browser das Zeichnen drosselt.)
    this.takt = setInterval(einBild, 33);
  }

  stop() {
    if (this.takt) clearInterval(this.takt);
    this.takt = null;
    if (this.strom) this.strom.getTracks().forEach((s) => s.stop());      // Kamera-Lämpchen geht aus
    this.strom = null;
    this.video.srcObject = null;
    this.punkte = null;
    this.status = 'aus';
  }

  // Zur nächsten Kamera wechseln (z. B. von der eingebauten zur Webcam)
  async naechste() {
    if (this.kameras.length < 2) return;
    const i = this.kameras.findIndex((k) => k.deviceId === this.kameraId);
    await this.start(this.kameras[(i + 1) % this.kameras.length].deviceId);
  }

  // Zeichnet die Vorschau in eine Zeichenfläche: das Kamerabild wie im Spiegel und darüber das erkannte "Strichmännchen".
  zeichne(flaeche) {
    const g = flaeche.getContext('2d'), w = flaeche.width, h = flaeche.height, v = this.video;
    g.fillStyle = '#0b1020';
    g.fillRect(0, 0, w, h);
    if (this.status !== 'an' || !v.videoWidth) return;
    g.save();
    g.translate(w, 0); g.scale(-1, 1);                 // spiegeln: Hebst du die rechte Hand, hebt sie sich auch rechts im Bild
    g.drawImage(v, 0, 0, w, h);
    const P = this.punkte;
    if (P) {
      const da = (p) => p && (p.visibility === undefined || p.visibility >= 0.5);
      g.strokeStyle = '#ffd34a'; g.lineWidth = Math.max(2, w / 160); g.lineCap = 'round';
      for (const [a, b] of LINIEN) {
        if (!da(P[a]) || !da(P[b])) continue;
        g.beginPath(); g.moveTo(P[a].x * w, P[a].y * h); g.lineTo(P[b].x * w, P[b].y * h); g.stroke();
      }
      if (da(P[0])) { g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(P[0].x * w, P[0].y * h, w / 40, 0, 7); g.fill(); }
    }
    g.restore();
  }
}
