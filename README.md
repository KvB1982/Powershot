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
| **Freies Spiel** | Einen der Top 20 der Weltrangliste wählen (Stand 9. November 2026), Gegner und Stadion aussuchen. |
| **Turnier** | Ein einzelnes Turnier mit einem Profi durchspielen. |
| **Karriere** | Eigenen Spieler erstellen, bei Platz 101 starten, die Saison spielen: 4 Grand Slams, 9 Masters 1000, ATP Finals. Ranglistenpunkte, Preisgeld, Ausrüstung kaufen, Fähigkeiten steigern. |
| **Training** | Ballmaschine (Zielfelder treffen) und Aufschlagtraining. In der Karriere bringt Training Erfahrung. |

Vereinfachungen gegenüber der echten Tour: Grand Slams haben ein 32er-Feld, Masters ein 16er-Feld.
Die ATP Finals laufen wie in echt: zwei Vierergruppen, Halbfinale, Finale. Die Weltrangliste rechnet
wie die echte: Jedes Turnier ersetzt die Punkte desselben Turniers aus dem Vorjahr.

Die Fähigkeitswerte der echten Spieler sind frei geschätzt, die Plätze 21 bis 100 sind erfundene Spieler.

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
| `js/avatar.js` | 3D-Spielerfigur mit Posen und Bewegungen |
| `js/stadium.js` | Stadion: Platz, Netz, Tribünen, Zuschauer, Licht |
| `js/game3d.js` | Kamera, Ball, Markierungen, Verbindung von Match, Figuren und Sound |
| `js/audio.js` | Sound (wird im Browser erzeugt, keine Sounddateien) |
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
