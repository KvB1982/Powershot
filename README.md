# Powershot Tennis

Ein 3D-Tennisspiel für den Browser (PC, Mac, iPad). Entstanden als Vater-Sohn-Projekt:
angefangen mit einem kleinen Python-Spiel (siehe Ordner `python/`), jetzt als HTML-Version mit
Stadion, 3D-Spielern, Turnieren und Karriere.

## Spielen

Das Spiel besteht nur aus HTML, CSS und JavaScript. Es gibt keinen Build-Schritt.
Es braucht aber einen kleinen Webserver (ein Doppelklick auf `index.html` reicht nicht,
weil der Browser JavaScript-Module nur über `http` lädt) und beim Start eine Internetverbindung
(die 3D-Bibliothek three.js wird von jsDelivr geladen).

```bash
python -m http.server 8765
```

Dann im Browser `http://localhost:8765` öffnen.

Für das iPad am einfachsten: GitHub Pages für dieses Repository einschalten
(Settings → Pages → Branch `main`, Ordner `/`). Dann läuft das Spiel unter
`https://kvb1982.github.io/Powershot/`. In Safari über „Teilen → Zum Home-Bildschirm“
bekommt man es als Vollbild-App.

## Spielmodi

| Modus | Was |
|---|---|
| **Freies Spiel** | Einen der Top 100 der Weltrangliste wählen (Stand 9. November 2026), Gegner und Stadion aussuchen. |
| **Turnier** | Ein einzelnes Turnier mit einem Profi durchspielen. |
| **Karriere** | Eigenen Spieler erstellen, bei Platz 101 starten, die Saison spielen: 4 Grand Slams, 9 Masters 1000, ATP Finals. Ranglistenpunkte, Preisgeld, Ausrüstung kaufen, Fähigkeiten steigern. |
| **Training** | Ballmaschine (Zielfelder treffen) und Aufschlagtraining. In der Karriere bringt Training Erfahrung. |

Vereinfachungen gegenüber der echten Tour: Grand Slams haben ein 32er-Feld, Masters ein 16er-Feld.
Die ATP Finals laufen wie in echt: zwei Vierergruppen, Halbfinale, Finale. Die Weltrangliste rechnet
wie die echte: Jedes Turnier ersetzt die Punkte desselben Turniers aus dem Vorjahr.

Alle 100 Spieler tragen die echten Namen, Plätze und Punkte der Weltrangliste vom 9. November 2026.
Die Fähigkeitswerte und das Aussehen sind frei geschätzt (Platz 1 bis 20 von Hand, der Rest nach Platz und Spielertyp berechnet).

## Die Spielerfiguren

Sechs Figuren (`assets/spieler_a.glb` bis `spieler_f.glb`) wurden mit 3D AI Studio erzeugt: neutrale, erfundene
Gesichter mit verschiedenen Frisuren und Kleidungsschnitten (T-Shirt, Polo, ärmellos, Kappe, Stirnband, Bart, Haarknoten),
je rund 9.000 Dreiecke. Der Generator liefert nur starre Modelle in T-Pose, ohne Skelett und ohne Animationen.
Das Skelett kommt deshalb aus dem Spiel selbst:

- `js/figur.js` lädt die Modelle, verteilt die Oberfläche auf 13 Knochen und färbt Hemd, Hose, Haut und Haare je Spieler um.
  Dazu gibt es fünf Kleidungsmuster (einfarbig, Bruststreifen, farbige Ärmel, Seitenstreifen, Schulterpartie). Linkshänder werden gespiegelt.
- `js/posen.js` enthält alle Posen und Schlagbewegungen als Zahlen: Vorhand und Rückhand jeweils als Topspin (mit Schleife:
  ausholen, Schläger fallen lassen, treffen, durchschwingen) und als Slice (von oben nach unten), Volley, Aufschlag
  (Ball hochwerfen, Pokal-Pose, Schläger hinter den Rücken, strecken, durchschwingen) und Schmetterball.
  Wer eine Bewegung ändern will, ändert dort die Zahlen.
- `js/avatar.js` rechnet daraus das Skelett aus (Ellbogen, Knie, Drehung von Schultern und Hüfte, Schrittstellung, Sprung).
  Der Schwung beginnt schon bevor der Ball da ist, damit der Schläger genau im Treffpunkt ankommt.

Unter „Einstellungen → Spielerfiguren“ kann man auf die einfache Figur zurückschalten.

## Aufgezeichnete Bewegungen (Motion Capture)

Für einige Schläge kann das Spiel echte, aufgezeichnete Bewegungen benutzen. Die Aufnahmen sind gekauft
(„Tennis Animation Pack“ von Ailive auf fab.com, FBX mit Unreal-Skelett) und dürfen nicht weitergegeben werden.
Sie liegen deshalb nur lokal im Ordner `mocap/`, der nicht in dieses Repository hochgeladen wird.
Ohne den Ordner läuft das Spiel ganz normal mit den Bewegungen aus `js/posen.js`.

So kommen neue Aufnahmen ins Spiel:

1. Die FBX-Dateien in den Ordner `mocap/` legen.
2. Einmal `npm install` ausführen (holt three.js für das Werkzeug).
3. In `tools/mocap.mjs` oben eintragen, welche Datei welcher Schlag ist, dann:

```bash
node tools/mocap.mjs
```

Das Werkzeug liest 60-mal pro Sekunde die Gelenkpositionen aus, findet den Treffpunkt (schnellste Schlägerspitze),
dreht die Bewegung zum Netz und schreibt `mocap/bewegungen.json`. Mit `--info` zeigt es nur, was in den Dateien steckt.
`js/mocap.js` lädt diese Datei, `js/avatar.js` setzt die Gelenke auf das Skelett der Figur.

Im Moment eingebaut: Aufschlag, Rückhand (einhändig) und hohe Rückhand (beidhändig, im Sprung).
Vorhand, Slice, Volley und Schmetterball kommen weiter aus `js/posen.js`.

## Sound

Schlag, Aufprall, Applaus und Stadion-Atmosphäre kommen aus den Aufnahmen im Ordner `sounds/` (Dateien von Pixabay / Freesound-Community).
In `js/audio.js` steht oben, welche Stelle welcher Aufnahme wofür benutzt wird – die Zeiten kann man dort anpassen.
Solange die Aufnahmen laden, erzeugt der Browser die Geräusche selbst. Der Schiedsrichter spricht über die Sprachausgabe des Geräts.

## Steuerung

Einstellbar unter „Einstellungen“. Auf Geräten mit Touchscreen ist „Touch“ voreingestellt.

### Touch (iPad / Handy) – erster Entwurf zum Testen

- **Linke Bildschirmhälfte:** Finger auflegen und ziehen = laufen (Joystick erscheint unter dem Finger).
  Ohne Finger läuft der Spieler von allein zum Ball (Laufhilfe „Voll“).
- **Rechte Hälfte, nach oben wischen:** Schlag. Richtung des Wischs = Richtung des Balls,
  Länge des Wischs = Härte und Tiefe. Sehr lange Wischer gehen ins Aus.
- **Nach unten wischen:** Stoppball. **Zur Seite wischen:** Slice. **Doppelt tippen:** Lob. **Einmal tippen:** sicherer Ball.
- **Aufschlag:** nach oben wischen.
- Solange der Finger noch auf dem Bildschirm ist, zeigt ein Ring auf dem Platz, wo der Ball hingehen würde.
- Gewischt wird, sobald der Gegner geschlagen hat. Der Schlag passiert, wenn der Ball da ist.

### Klassik (Maus) – wie in der Python-Version

- Mausrad oder ← → zielen, linke Maustaste halten = Kraft (roter Bereich = Aus), Doppelklick oder rechte Taste = Lob,
  ↑ ↓ = ans Netz / zurück.

### Profi (Tastatur)

- WASD oder Pfeile laufen, Leertaste/J Topspin, K Slice, L Lob, I Stoppball (halten = mehr Kraft).
- Die Richtungstasten, die man beim Treffen hält, bestimmen das Ziel.

### Schwierigkeit

| Stufe | Hilfe für dich |
|---|---|
| Leicht | Deine Bälle bleiben immer im Feld, automatischer Rückschlag ohne Eingabe |
| Mittel | Seitlich bleiben deine Bälle drin, kaum Netzfehler |
| Schwer | Volle Streuung, Aus und Netz möglich |
| Profi | Wie Schwer, stärkster Gegner, kein Landepunkt-Ring |

## Aufbau des Codes

| Datei | Inhalt |
|---|---|
| `js/data.js` | Spieler (Top 20 + erfundene), Turnierkalender, Ausrüstung, Schwierigkeitsstufen |
| `js/physics.js` | Ballflug in Metern: Schwerkraft, Luftwiderstand, Spin, Aufprall je Belag, Netz |
| `js/rules.js` | Zählweise: Punkte, Spiele, Sätze, Tiebreak, Aufschlagwechsel |
| `js/match.js` | Das laufende Match: Aufschlag, Ballwechsel, Regeln, Computergegner, Training |
| `js/controls.js` | Die drei Steuerungsarten |
| `js/avatar.js` | Skelett der Spielerfigur |
| `js/posen.js` | Posen und Schlagbewegungen |
| `js/mocap.js` | Lädt aufgezeichnete Bewegungen, falls vorhanden |
| `js/figur.js` | Lädt das realistische Spielermodell, verbindet es mit dem Skelett, färbt es um |
| `js/stadium.js` | Stadion: Platz, Netz, Tribünen, Zuschauer, Licht |
| `js/game3d.js` | Kamera, Ball, Markierungen, Verbindung von Match, Figuren und Sound |
| `js/audio.js` | Sound (Aufnahmen aus `sounds/`, Rest wird im Browser erzeugt) |
| `js/tournament.js` | Turnierbaum und ATP-Finals-Format |
| `js/career.js` | Karriere: Rangliste, Geld, Ausrüstung, Fähigkeiten, Speichern |
| `js/app.js` | Menüs und Abläufe |
| `tools/` | Testläufe ohne Grafik (`node tools/sim.mjs`, `node tools/logic.mjs`) |
| `python/` | Die ursprünglichen Python-Versionen (Pygame Zero) |

Die Karriere und die Einstellungen werden im Browser gespeichert (localStorage), also pro Gerät.

## Ideen für später

- Seitenwechsel, Zeitlupe, Challenge (Hawk-Eye)
- Aufschlag mit Timing, Ermüdung, Doppel
- Kleinere Turniere (ATP 250/500), Qualifikation
- Zweiter Spieler am selben Gerät oder online
