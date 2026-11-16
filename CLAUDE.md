# Powershot Tennis – Hinweise für Claude

3D-Tennisspiel für den Browser (PC und iPad), entstanden als Vater-Sohn-Lernprojekt.
Repository: https://github.com/KvB1982/Powershot · läuft auf GitHub Pages unter https://kvb1982.github.io/Powershot/

## Arbeitsweise

- Antworten, Code-Kommentare und Texte im Spiel auf **Deutsch**. Kommentare so schreiben, dass ein Kind mitlesen kann.
- Kein Build-Schritt: reines HTML/CSS/JavaScript (ES-Module), three.js r160 über eine Import-Map von jsDelivr.
- Commits als `KvB1982 <KvB1982@users.noreply.github.com>` auf `main`, danach pushen. `gh` ist nicht installiert.
- Nach Änderungen im Browser prüfen, nicht nur mit den Testwerkzeugen. Ehrlich sagen, was nur als Standbild geprüft wurde.

## Starten und testen

```bash
python tools/server.py          # http://localhost:8765, ohne Zwischenspeicher
node tools/sim.mjs 0 1 mittel hard 3    # Computer gegen Computer, ohne Grafik
node tools/logic.mjs            # Turnier und Karriere durchrechnen
node tools/rookie.mjs           # Neuling gegen Profi auf jeder Schwierigkeit
node tools/mocap.mjs            # Aufnahmen aus mocap/*.FBX in mocap/bewegungen.json umrechnen (--info zeigt nur an)
```

Im eingebauten Browser der App ist `requestAnimationFrame` gedrosselt. Das Spiel deshalb über
`window.__powershot.step(n)` vorspulen (`__powershot` enthält `game`, `controls`, `settings`, `match`, `career`, `actions`).
Für Bilder die Szene selbst rendern und per `canvas.toDataURL()` in ein Overlay legen – Screenshots der Seite sind oft veraltet.

## Aufbau

Koordinaten: Meter, x seitlich, y hoch, z längs; Netz bei z = 0; der Mensch spielt Seite 0 (z > 0), die Kamera steht hinter ihm.
Die Figur rechnet intern in `[vor, seite, hoch]` (seite: + = Schlaghand); Linkshänder werden gespiegelt.

| Datei | Inhalt |
|---|---|
| `js/data.js` | Top 100 (Stand 9.11.2026, Werte geschätzt), Turniere, Shop, Schwierigkeit, `EINHAND` |
| `js/physics.js`, `js/rules.js` | Ballflug, Zählweise – ohne three.js, in node testbar |
| `js/match.js` | Zustände: intro → serveReady → toss → rally → pointOver → (changeover) → over; Computergegner |
| `js/controls.js` | Steuerung: `klassik` (Maus), `touch` (iPad), `profi` (Tastatur) |
| `js/figur.js` | Sechs Spielermodelle (`assets/spieler_a…f.glb`), Skinning auf 13 Knochen, Umfärben im Shader |
| `js/posen.js` | Handgebaute Posen und Schlagbewegungen (Rückfall, wenn es keine Aufnahme gibt) |
| `js/mocap.js` | Lädt `mocap/bewegungen.json`, falls vorhanden |
| `js/avatar.js` | Skelett: Posen/Aufnahmen → Gelenke → Knochen; `pickStroke` wählt den Schlag nach Spielsituation |
| `js/game3d.js`, `js/stadium.js`, `js/audio.js` | Darstellung, Stadion, Sound (Aufnahmen aus `sounds/`) |
| `assets/zuschauer.webp` | 48 erfundene Zuschauer in einem Bild (8 × 6, je 128 × 192 Pixel; 32 von vorn, 16 von der Seite); `stadium.js` zeigt sie als flache Bildtafeln |
| `js/tournament.js`, `js/career.js`, `js/app.js` | Turnierbaum, Karriere (localStorage), Menüs |
| `python/` | Die ursprünglichen Pygame-Zero-Versionen (mit `pythoncore-3.14-64`, pgzero + pygame-ce) |

## iPad und iPhone (Home-Bildschirm-App)

- Das Spiel ist eine „Web-App“: In Safari https://kvb1982.github.io/Powershot/ öffnen → Teilen → „Zum Home-Bildschirm“.
  Dann startet es im Vollbild mit eigenem Symbol (`manifest.webmanifest`, `icons/`).
- `sw.js` merkt sich alle Dateien, damit es nach dem ersten Start auch ohne Internet läuft. Programm-Dateien kommen
  zuerst aus dem Netz, Modelle/Sounds/three.js zuerst aus dem Speicher. Wird ein Modell oder Sound unter gleichem
  Namen ersetzt: `VERSION` in `sw.js` erhöhen.
- Auf `localhost` ist `sw.js` abgeschaltet; zum Testen `http://localhost:8765/?offline` aufrufen.
- Symbol neu erzeugen (Mac): `cd icons && for s in 180 192 512; do sips -s format png -z $s $s icon.svg --out icon-$s.png; done`
- Auf dem Mac heißt der Startbefehl `python3 tools/server.py`.

## Was nicht ins Repository darf

- `mocap/` – gekaufte Bewegungsaufnahmen (Fab, Lizenz „Privat“, „Verwendung mit KI: Nein“ beachten) und die daraus erzeugte
  `bewegungen.json`. Bleibt lokal; auf GitHub Pages laufen deshalb die handgebauten Bewegungen.
- `3d models/` – eine 41-MB-Vorlage des Nutzers.
- Die E-Mail-Adresse des Nutzers (deshalb die noreply-Adresse für Commits).

## Bekannte Grenzen

- Die Spielermodelle kommen aus 3D AI Studio (nur starre T-Pose-Modelle); das Skelett rechnet das Spiel selbst. Keine Finger.
- Gesichter sind erfunden – keine Abbilder echter Spieler erzeugen.
- Die Seiten werden nicht getauscht; beim Seitenwechsel gehen die Spieler nur zur Bank.
- Laufen ist ein gebauter Schrittzyklus, keine Aufnahme. Slice-Topspin-Unterschiede bei einhändigen Spielern fehlen.
- Spielstärke und Ballwechsel-Länge sind nur grob eingestellt.
