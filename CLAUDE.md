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
node tools/logic.mjs            # Turnier, Karriere (3 Jahre, Ranglisten-Regeln, Freilose) und Saison (ATP Race) durchrechnen – dauert etwa eine halbe Minute
node tools/rookie.mjs           # Neuling gegen Profi auf jeder Schwierigkeit
node tools/seitenwechsel.mjs hard 10   # Seitenwechsel prüfen: nur nach ungeraden Spielen, nie nach einem Aufschlagfehler
node tools/wichtig.mjs          # Hinweise Breakball, Satzball, Matchball, Championship Point prüfen (`wichtigerPunkt` in `js/rules.js`)
node tools/kamera.mjs           # Laufen mit der Kamera: Rechnung prüfen (ohne Kamera, mit künstlichen Körperpunkten)
node tools/ballflug.mjs hard     # Flugbahn und Absprung jeder Schlag- und Aufschlagart messen und prüfen (auch clay, grass, indoor)
node tools/gelaende.mjs         # Lagepläne aller Turniergelände prüfen: alle neun Orte da, nichts steht ineinander, jede Tür zu Fuß erreichbar
node tools/mocap.mjs            # Aufnahmen aus mocap/*.FBX in mocap/bewegungen.json umrechnen (--info zeigt nur an)
```

Im eingebauten Browser der App ist `requestAnimationFrame` gedrosselt. Das Spiel deshalb über
`window.__powershot.step(n)` vorspulen (`__powershot` enthält `game`, `controls`, `settings`, `match`, `career`, `season`, `actions`).
Für Bilder die Szene selbst rendern und per `canvas.toDataURL()` in ein Overlay legen – Screenshots der Seite sind oft veraltet.

## Aufbau

Koordinaten: Meter, x seitlich, y hoch, z längs; Netz bei z = 0; der Mensch spielt Seite 0 (z > 0), die Kamera steht hinter ihm.
Die Figur rechnet intern in `[vor, seite, hoch]` (seite: + = Schlaghand); Linkshänder werden gespiegelt.

| Datei | Inhalt |
|---|---|
| `js/data.js` | Top 200 (Stand 16.11.2026, Werte geschätzt; ab Platz 21 aus der Textliste `REST` berechnet), Turniere, Shop, Schwierigkeit, `EINHAND`, `STIL` (Größe, Statur, Figur, Ball prellen, Jubel der Top 20) |
| `js/physics.js`, `js/rules.js` | Ballflug (Luftwiderstand, Magnus-Kraft, Reibung beim Aufprall), Zählweise – ohne three.js, in node testbar |
| `js/faehigkeiten.js` | Die acht Fähigkeiten (`STAT_NAMES`: Aufschlag `s`, Vorhand `vh`, Rückhand `rh`, Volley `v`, Beinarbeit `b`, Ausdauer `a`, Mental `m`, Taktik `k`), Erklärtexte, `achtWerte` (rechnet die fünf alten Werte um), `gesamt` (Gesamtstärke) – ohne three.js und ohne andere Dateien |
| `js/schlaege.js` | Tabelle aller Schlagarten (`SCHLAEGE`) und Aufschlagarten (`AUFSCHLAEGE`): Tempo, Drall in U/min (`top`, `seite`, `drall`), Höhe über dem Netz – ohne three.js |
| `js/match.js` | Zustände: intro → serveReady → toss → rally → pointOver → (changeover) → over; Computergegner |
| `js/controls.js` | Steuerung: `klassik` (Maus), `touch` (iPad), `profi` (Tastatur), `controller` (Switch-Controller; Schwung-Zahlen `SWING_…` oben in der Datei) |
| `js/kamera.js` | Laufen mit der Kamera: Körperpunkte → Position auf dem Platz, Einmessen, Zahlen zum Einstellen oben – ohne three.js und ohne Browser testbar |
| `js/kamerabild.js` | Webcam (`getUserMedia`) und Körpererkennung MediaPipe Pose (`@mediapipe/tasks-vision` von jsDelivr, Modell `assets/koerper_lite.task`), Vorschau |
| `js/figur.js` | Sechs Spielermodelle (`assets/spieler_a…f.glb`), Skinning auf 13 Knochen, Umfärben im Shader |
| `js/posen.js` | Handgebaute Posen und Schlagbewegungen (Rückfall, wenn es keine Aufnahme gibt), Jubel-Arten (`JUBEL`), Ball prellen (`sv_prell`) |
| `js/mocap.js` | Lädt `mocap/bewegungen.json`, falls vorhanden |
| `js/avatar.js` | Skelett: Posen/Aufnahmen → Gelenke → Knochen; `pickStroke` wählt den Schlag nach Spielsituation |
| `js/game3d.js`, `js/stadium.js`, `js/audio.js` | Darstellung, Stadion, Sound (Aufnahmen aus `sounds/`) |
| `js/siegerehrung.js` | Siegerehrung nach einem gewonnenen Finale (nicht Liga): Tisch, Pokal, Teller für den Zweiten, Scheck, Konfetti, Siegerfoto. Schritte in `SCHRITTE`, Kamera in `KAMERA`; das Fenster mit Text und Knöpfen baut `app.js` (`siegerehrung`, `ehrung…`). In der Karriere: Rede (`REDEN` in `career.js`) und Pokalschrank (`c.pokale`, höchstens 10 Fotos) |
| `js/anlage.js` | Turniergelände zum Herumlaufen (Hauptmenü → „Turniergelände“, in der Karriere „Erst auf die Anlage“). Jedes Turnier hat sein eigenes Gelände (`start(woher, gelaende)`). Steuerung und Kamera wie auf dem Pferdehof im Schwester-Spiel Reitturnier (`KvB1982/Reitturnier`, `js/hof.js`): Laufen in Bildschirm-Richtung (Tasten, ein Finger als Steuerknüppel, Tipp auf ein Gebäude oder Knopf „Hinlaufen“ = von selbst hinlaufen), Kamera kreist um die Figur und bleibt vor Gebäuden. Dazu laufende Besucher (`LAEUFER`), der goldene Glücksball (`ballLegen`, `wennBall`) und als Rückfall die alte Anlage mit Häusern im Kreis (`starteKreis`, `ORTE`) |
| `js/gelaende.js` | Lagepläne der 14 großen Turniere (`GELAENDE`: 4 Grand Slams, 9 Masters, ATP Finals), den echten Anlagen nachempfunden (Stand 2026, auf etwa ein Drittel verkleinert) – ohne three.js. Bausteine: `stadion`, `plaetze`, `haus`, `flaeche`, `baeume`, Wahrzeichen (`kugel`, `bogen`, `statuen`, `obelisk` …). Ein Baustein mit `ort` ist eine Tür für den Turniertag (`PFLICHT_ORTE`), einer mit `info` eine Sehenswürdigkeit mit Erklärtext. `planAus` rechnet Türen, Sperrflächen und Baum-Stellen aus; `gelaendeFuer(def)` liefert das Gelände zu einem Turnier |
| `js/gelaendeklein.js` | Baut die Gelände der kleinen Turniere selbst zusammen (ohne three.js): nach Stufe (ITF = Tennisclub oder Urlaubshotel, Challenger = Club mit Stahlrohr-Tribünen, ATP 250/500 = Stadion mit Fan-Dorf), Belag (Halle = Glasdach, im Winter Schnee), Landschaft der Stadt (`ORTE_BESONDERS`: Meer, Alpen, Wüste, Großstadt, echte Besonderheiten bekannter Turniere) und einem festen Zufall aus dem Stadtnamen. Die Pläne sind erfunden |
| `js/gelaendebau.js` | Baut ein Gelände in 3D aus einfachen Formen; Plätze, Bäume, Autos, Besucher als `InstancedMesh` (etwa 80–130 Zeichen-Aufrufe, 50.000–75.000 Dreiecke je Gelände) |
| `js/wege.js` | Gitter aus 1-Meter-Kästchen (frei/zu, Höhe für die Kamera) und Wegsuche A* um Gebäude herum – ohne three.js |
| `js/turniertag.js` | Der Tag vor einem Karriere-Match (ohne three.js): `ZEIT_FENSTER` freie Zeitfenster, Tätigkeiten je Ort (`TAETIGKEITEN`: Einschlagen, Kraftraum, Physio, Essen, Bespannen, Presse, Autogramme), was es bei welcher Turnier-Stufe gibt (`stufeVon`). Pluspunkte gelten nur für das nächste Match (`c.tag.bonus`), Fan-Sterne bleiben (`c.tagFans`). Der Trainingsplatz ist ein Minispiel (`UEBUNGEN`: Ballmaschine 10 Bälle oder 8 Aufschläge, gespielt im Stadion des Turniers; Treffer bestimmen die Pluspunkte). Kraftraum = Geschicklichkeitsspiel im Fenster (`KRAFT_SPIEL`, Zeiger im grünen Feld; `kraftSpiel` in `app.js`), Restaurant = Essen auswählen (`ESSEN`), Presse = Reporterfrage mit netter, witziger oder patziger Antwort (`FRAGEN`). Zufälle am Morgen (`EREIGNISSE`, etwa jeder zweite Tag, mit Auswahl), ein Zeitfenster mehr bei Turnieren über zwei Wochen (`fensterVon`), nach einem Sieg die Abend-Auswahl in der Turnier-Ansicht (`ABEND`, `c.abendOffen`, Pluspunkt in `c.abend`). Alle Zahlen geschätzt. Einstieg: Turnier-Ansicht → „Erst auf die Anlage“ |
| `js/ausbau.js` | Profi-Service der Karriere (ohne three.js, ohne andere Dateien): Ausbaustufen (`BEREICHE`: Bespanner, Schläger-Werkstatt, Ärzte; je 4 Stufen mit `abPlatz` und `preis`), Spezial-Trainer (`SPEZIAL`, `TRAINER_STUFEN`: heben die Grenze einer Fähigkeit von `GRENZE_OHNE` 70 auf 80/88/95), Profi-Schläge (`TECHNIKEN`: nehmen Zahlen aus `schlaege.js` mal; `match.js` → `mitTechnik`), Körper (`koerperWoche`: erst Beschwerden, wer damit weiterspielt riskiert eine Verletzung mit `fehler`-Liste als Erklärung; `AUSFALL_WOCHEN`). Alle Zahlen geschätzt |
| `js/showschlaege.js` | Vorbereitung für Show-Schläge (`SHOW`: Tweener, Sprung-Rückhand, Lasso-Vorhand, Hechtvolley; ohne three.js). Es gibt dafür noch keine Bewegungen: Der Nutzer nimmt sie selbst auf. Liegt eine Aufnahme `show_…` in `mocap/bewegungen.json` (Dateinamen in `tools/mocap.mjs`), ersetzt sie in der passenden Spielsituation den normalen Schlag (`pickStroke`/`clipFor` in `avatar.js`, `st.weg` aus `game3d.js`, Meldung über `game.wennShow`). Mit einer echten Aufnahme nicht erprobt |
| `js/requisiten.js` | Fertige 3D-Modelle aus 3D AI Studio (`assets/*.glb`): Schiedsrichterstuhl, Bank, Ballkind, Linienrichter, Ballmaschine, drei Pokale, Schläger. Einmal laden, mehrfach hinstellen; `requisit(name, { farbe })` färbt graue Stellen um |
| `assets/zuschauer.webp` | 48 erfundene Zuschauer in einem Bild (8 × 6, je 128 × 192 Pixel; 32 von vorn, 16 von der Seite); `stadium.js` zeigt sie als flache Bildtafeln |
| `js/tournament.js`, `js/career.js`, `js/app.js` | Turnierbaum, Karriere (localStorage), Menüs |
| `js/kalender.js` | Tour-Kalender der Karriere: 52 Wochen nach dem echten ATP-Kalender 2026 (`WOCHEN`: großes Turnier, zweite Woche, Off-Season, kleine Turniere je Woche), Regeln der Weltrangliste (`ZAEHLT_HOECHSTENS` 18, `PFLICHT_MASTERS`), Datum einer Woche, Phasen der Saison (`PHASEN`, `phaseVon`: Australien-Sommer, Februar-Tour, Sunshine Double, Sandplatz, Rasen, Sommer-Sand, US-Hartplatz, Asien, Halle, Off-Season – Einteilung von uns, Beläge echt), `monatVon`, `kw` – ohne three.js und ohne andere Dateien |
| `js/planer.js` | Saison-Planer der Karriere (ohne three.js): eigener Turnierplan `c.plan = { jahr, wochen: { woche: Turnier-Kürzel \| 'liga' \| 'stunden' \| 'pause' \| 'vorbereitung' } }`, `optionen`, `setzen`, `vorschau` (Kosten und sichere Einnahmen je Woche und Monat, Kontostand im schlimmsten Fall = überall Niederlage in Runde 1, Einkaufszettel für fehlende Schuhe/Weiß, Hinweise des Trainers mit Sterne-Note), `autoPlan` mit drei Trainer-Typen (`AUTO`). Der Plan verpflichtet zu nichts; die Übersicht zeigt nur „📌 in deinem Plan“. Ansicht: `planerHtml` in `app.js` (Reiter „Saison-Planer“, ersetzt den alten Kalender-Reiter) |
| `js/kleinetour.js` | Kleine Tour für die Karriere: Stufen (`STUFEN`: ITF M15/M25, Challenger, ATP 250/500, echte Feldgrößen), die kleinen Turniere aus dem Kalender, Flugpreise, Liga-Spiel, 400 erfundene Nachwuchsspieler (`NACHWUCHS`), `KURVE` (Punkte → Platz hinter den Top 200) – ohne three.js |
| `js/ausruestung.js` | Shop mit echten Marken und Modellreihen (nur Namen als Text), Trainer, Physios, Reise-Arten, Ausrüster-Verträge, Geldgeber – ohne three.js |
| `js/season.js` | Saison mit einem echten Profi: ATP Race (alle starten bei 0), Finals-Qualifikation (Top 8, Grand-Slam-Regel), localStorage – ohne three.js |
| `js/saisonansicht.js` | Baut HTML für Turnierbaum, Saison-Zeitleiste, Race-Tabelle und Punkte-Erklärung (Aussehen in `css/style.css`) |
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

## iOS-App (Ordner `ios/`)

- `ios/Powershot.xcodeproj`: dünne Hülle (WKWebView) um das Spiel, Anleitung und TestFlight-Schritte in `ios/README.md`.
- `ios/Powershot/ControllerBruecke.swift` liest Switch-Controller (GameController-Framework) und ruft 60-mal pro Sekunde
  `window.__powershotPad({...})` auf; das landet in `Controls.setPad`. Im Browser fragt `Controls.pollPad` die Gamepad-Schnittstelle ab (nur Tasten/Stick).
- Schwingen mit echtem Joy-Con ist noch nicht am Gerät erprobt; die Schwellen sind geschätzt.

## Apple Watch, iPhone-Schläger, Aufnahmen

- `ios/PowershotWatch/`: Watch-App. Erkennt Schwünge und Doppelklopfen selbst und meldet sie dem iPhone (`ios/Powershot/Uhr.swift`);
  von dort gehen sie ins Spiel oder per Funk ans iPad (`Funk.swift`, `SchlaegerView.swift`). Im Spiel: `Controls.setPad` (`schwung`, `geste`).
- Aufnahme-Modus auf der Uhr schreibt Serien als `schlag_<schlagart>_<zeit>.json`. Zum Ansehen: Dateien in den Ordner `aufnahmen/`
  legen (wird nicht ins Repository übernommen), `python3 tools/server.py`, dann `http://localhost:8765/tools/aufnahmen.html`.
- Simulatoren funken auf einem eigenen Kanal (`powershot-sim`). Trotzdem Simulator-Apps nach dem Testen beenden.

## Laufen mit der Kamera

- Einstellungen → „Laufen mit der Kamera“ (`settings.kamera`: `aus`, `seite`, `voll`). Die Kamera ersetzt nur das Laufen; geschlagen wird mit der gewählten Steuerung.
  `Controls.kameraZiel()` liefert `{ x, vor }` oder `null`, `match.js` läuft dorthin (`KAMERA_HILFE`: letzter Schritt zum Ball von allein).
- Die Kamera geht im Browser nur auf https oder localhost – also nicht über `http://192.168…:8765` vom iPad aus, dort GitHub Pages nehmen.
- In der iOS-App (Adresse `powershot://`) gibt der eingebaute Browser die Kamera vermutlich nicht frei (nicht erprobt). Geplant: Apple Vision in Swift, das die Körperpunkte an `kameraLauf.update` meldet.
- Bisher nur mit einer künstlichen Kamera geprüft (Foto, das verschoben und vergrößert wird), nicht mit einem echten Menschen vor einer Webcam.
- Testen ohne Kamera: `__powershot.kameraLauf` und `__powershot.kameraBild`; `?kamera=cpu` erzwingt Rechnen ohne Grafikkarte.

## Was nicht ins Repository darf

- `aufnahmen/` – eure eigenen Bewegungsaufnahmen von der Apple Watch.
- `mocap/` – gekaufte Bewegungsaufnahmen (Fab, Lizenz „Privat“, „Verwendung mit KI: Nein“ beachten) und die daraus erzeugte
  `bewegungen.json`. Bleibt lokal; auf GitHub Pages laufen deshalb die handgebauten Bewegungen.
- `3d models/` – eine 41-MB-Vorlage des Nutzers.
- Die E-Mail-Adresse des Nutzers (deshalb die noreply-Adresse für Commits).

## Schlagarten und Drall

- Der Drall eines Balls ist `{ top, seite, drall }` in Umdrehungen pro Minute: `top` + = Topspin, − = Slice; `seite` + = Kurve nach rechts
  (in Flugrichtung); `drall` + = springt beim Aufprall nach rechts weg (Kick). Die Tabelle gilt für Rechtshänder, `match.js` spiegelt für Linkshänder.
- Eine Steuerung gibt beim Schlag `type` an (`drive`, `flach`, `topspin`, `slice`, `drop`, `lob`), beim Aufschlag `art`
  (`gerade`, `slice`, `kick`, `unten`; ohne Angabe: erster gerade, zweiter Kick). Zusätzlich darf sie in `schlag` eigene Zahlen mitgeben,
  die über die Tabelle gelegt werden, z. B. `{ type: 'drive', schlag: { top: 3400, tempo: [28, 28] } }` – gedacht für die Apple Watch.
- Stoppball und Aufschlag von unten haben kein festes Tempo, sondern `bogen` (Höhe über dem Netz); `solveBogen` sucht das Tempo dazu.

## Karriere: Geld, Reisen, Ausrüstung

- Start ungefähr auf Platz 2000 mit 4.000 $. Das Jahr hat 52 Wochen (`js/kalender.js`, echter ATP-Kalender 2026). Jede Woche wählt man: ein Turnier der Woche, Liga-Spiel, Tennisstunden geben, Pause/Urlaub oder (nur in der Off-Season im Dezember) Saisonvorbereitung.
  `career.js`: `angebot`, `zugang` (Platz-Grenzen, Wildcards), `reiseKosten`, `sponsorGeld`, `startTournament`, `matchGespielt`, `finishTournament`, `wocheOhneTurnier`.
- Weltrangliste nach ATP-Regelbuch 2026: Jeder Spieler hat eine Liste von Ergebnissen `c.erg[id] = [{ a, p, k }]` (`a` = Woche durchgezählt, `k` 1 = Pflichtturnier, 2 = ATP Finals). `zaehlen` rechnet: 52 Wochen, höchstens 18 Turniere, Pflichtturniere (4 Grand Slams, 8 Masters) zählen immer – auch mit 0 Punkten, wenn man mitspielen dürfte und nicht antritt –, Finals obendrauf. `race` zählt nur das laufende Jahr; `finalsFeld` = Top 8 des Race (mit Grand-Slam-Regel). Nicht eingebaut: die Pflicht der Top 30, vier ATP-500-Turniere zu spielen.
- Die Welt spielt mit (`wochenFelder`, `weltWoche`): Jede Woche verteilen sich die 200 echten Profis und 400 erfundenen Nachwuchsspieler auf die Turniere der Woche (plus ein paar unsichtbare Challenger/ITF-Turniere), alle Turniere werden ausgerechnet, alle bekommen Punkte. Zum Start werden die echten Punkte jedes Profis auf Turniere der letzten 52 Wochen verteilt (`vorjahr`). Geschätzt: wie oft jemand spielt (`SPIELT_OFT`), Tagesform (`FORM`), `CHALLENGER_DAZU`.
- Turnier über zwei Wochen (Grand Slam, großes Masters): wird in der ersten Woche ausgespielt; wer weit kommt (`ZWEITE_WOCHE`), überspringt die zweite Woche.
- Hinter den Top 200 wird die Platznummer aus den Punkten geschätzt (`KURVE` in `kleinetour.js`) – für den Spieler und die Nachwuchsspieler gleich.
- Alte Spielstände (14 Wochen, `c.points`) rechnet `vonAltemKalender` um.
- Acht Fähigkeiten statt fünf (`js/faehigkeiten.js`). Im Match (`mkPlayer` in `match.js`): Vorhand und Rückhand haben je eigene Härte und Genauigkeit (`p.p`/`p.c` gelten für den Schlag, der gerade gemacht wird); Beinarbeit = Lauftempo; Ausdauer: gerannte Meter machen müde (`MUEDE_…`, langsamer und ungenauer, nur in langen Matches spürbar) und ein Match kostet weniger Frische; Mental: bei Breakball, Satzball, Matchball streut der Schlag mehr oder weniger (`NERVEN`); Taktik: der Computergegner reagiert später (`TAKTIK_TARNT`), und der Computer selbst spielt klüger. Alle diese Zahlen sind geschätzt und nicht von Hand erspielt.
- Ausrüstung behält ihre Eigenschaften Kraft (`p`), Präzision (`c`), Tempo (`t`): `effectiveStats` legt Tempo auf die Beinarbeit und gibt Kraft/Präzision als `kraft`/`praez` mit, die im Match auf Vorhand und Rückhand wirken. Die Werte der Profis für Vorhand/Rückhand, Ausdauer, Mental, Taktik sind aus den alten fünf Werten berechnet (mit kleinen ausgedachten Unterschieden), nicht einzeln recherchiert. Alte Spielstände rechnet `vonFuenfAufAcht` um.
- Körper: `matchGespielt` zählt Matches und die niedrigste Frische der Woche, `wocheFertig` fragt `koerperWoche` (Beschwerden `c.koerper`, Verletzung `c.verletzung`, Turnierwochen am Stück `c.serie`). Eine Woche ohne Match oder der Physio auf der Anlage heilt Beschwerden. Verletzt geht nur `wocheOhneTurnier(c, 'reha')`; Pflichtturniere zählen dann nicht als verpasst (vereinfacht). Ansicht: Karriere-Reiter „Profi-Service“.
- Schuhe und Belag: Am Anfang hat man nur alte Turnschuhe (gehen auf Hartplatz und in der Halle). Für Sand und Rasen braucht man einen gekauften Schuh mit mindestens +2 Tempo auf dem Belag (`schuhePassen`, `fehltFuer`), sonst startet `startTournament` nicht (Liga ausgenommen). Wimbledon: Weiß ist Pflicht, ohne weißes Outfit kostet es weiter die Leihgebühr. `ausruestungJetzt` listet die Ausrüstung samt Sachen vom Anfang (Kasten „Das hast du gerade“ in der Übersicht).
- Frische (0–100): Matches kosten, Wochen erholen (Physio); unter 70 gibt es Abzüge. Saiten halten nur ein paar Matches und werden automatisch neu bespannt.
- Sammlung (`ausruestung.js`): Seltenheit `selten` 0–3 (`SELTEN`; macht nicht stärker), Turnier-Editionen (`EDITIONEN`, erfundene Outfits ohne Marke, nur in der Turnierwoche und mit Startrecht zu kaufen: `editionDa`), Sonderstücke für Erfolge (`SONDER`, `sonderPruefen` in `wocheFertig`), Turnier-Handtücher (`c.handtuecher`). Shop: Anprobe der eigenen Figur in 3D (`game.figurZeigen`, `CA.anprobeLook`), Reiter „Sammlung“. Im Match steht die eigene Tasche neben der Bank (`game.tascheZeigen`, aus einfachen Formen).
- Echt sind Marken, Modellreihen, Punkte pro Runde und die Turnierorte. Geschätzt sind alle Pluspunkte, Preisgelder (Größenordnung), Platz-Grenzen, Flugpreise, Löhne und Sponsorengeld.
- Marken nur als Text, keine Logos; das Spiel ist für den Privatgebrauch.

## Stil der Top 20 (Wiedererkennen ohne echte Gesichter)

- `STIL` in `js/data.js`: je Spieler `groesse` (cm), `statur`, `modell` (a–f), `prellen`, `jubel`, `merkmal`, `unsicher`. Die Werte wandern in `look`
  (`groesse`, `statur`, `jubel`) und in `p.stil`. `avatar.js` zeichnet die Figur entsprechend größer/kräftiger (`gross`, `breit`) und wählt den Jubel.
- `match.js`: Der Computer prellt den Ball vor dem Aufschlag (`prellK`, `PRELL_TIME`); große Spieler treffen den Aufschlag höher (`gross` in `tossPos`).
  Der Mensch prellt nicht (er schlägt auf, sobald er drückt).
- Größen sind öffentliche Angaben; Prell-Zahlen, viele Jubel-Arten und manche Kopfbedeckung sind geschätzt (Feld `unsicher`). Kleiderfarben sind frei gewählt.
- Weiterhin gilt: keine Gesichter oder Körper echter Spieler nachbauen, keine Fotos als Vorlage.

## Stadion und Requisiten

- `stadium.js` baut zuerst Klötze und tauscht sie gegen die Modelle aus `requisiten.js`, sobald diese geladen sind. Ballkinder, Linienrichter und
  Tribünendach gibt es nur bei großen Turnieren (`def.zuschauer` ab 0,6) und nicht bei Qualität „niedrig“.
- Bodenbelag: graue Bilder `assets/boden_sand|rasen|hart.jpg`, die Farbe kommt aus `theme`. Himmel: `assets/himmel_tag|abend.jpg` auf einem großen Zylinder.
- Bandenwerbung (`WERBUNG` in `stadium.js`) ist erfunden. Sitzschalen, Geländer, Dach, Flutlicht und Hallendecke sind aus einfachen Formen gebaut.
- Pokal nach eigenem Turniersieg: `game.pokalZeigen(canvas, 'silber' | 'gold' | 'stern')`. Ballmaschine im Training: `game.maschineZeigen`.
- Neue Modelle vor dem Einbau verkleinern (Richtwert 2.000–7.000 Dreiecke, nur Farbbild, 512 oder 1024 Pixel). Wunschliste: Projektdatei `docs/3d_wunschliste.md`.
- Bisher nur im Test-Browser ohne Grafikkarte als Standbild geprüft, nicht auf einem echten iPad (Tempo dort noch unbekannt).

## Bekannte Grenzen

- Turniergelände: Lage der Stadien, Zuschauerzahlen und Umgebung der großen Turniere sind recherchiert, aber vereinfacht (alles rechtwinklig, flach – auch Monte-Carlo ohne echte Terrassen; die Lage kleiner Häuser wie Kraftraum oder Besaiter ist geschätzt). Die Gelände der kleinen Turniere sind erfunden. Geprüft mit `tools/gelaende.mjs` und als Standbilder im Test-Browser ohne Grafikkarte; nicht von Hand gespielt, Tempo auf dem iPad unbekannt. Stempelheft liegt in `localStorage` (`powershot.stempel.v1`), der Glücksball gibt +1 Mental für das Match des Tages (`GLUECKSBALL` in `turniertag.js`, Zahl geschätzt).

- Saison-Planer, Phasen-Anzeige und Schuh-Regel: nur mit `tools/logic.mjs` und als Standbilder im Test-Browser geprüft, nicht von Hand gespielt, nicht auf dem iPad (die Planer-Tabelle ist breit).
- Profi-Service, Verletzungen, Turniertag-Zufälle, Kraftraum-Spiel, Abend-Auswahl, Sammlung, Anprobe und Tasche: nur mit `tools/logic.mjs` und als Standbilder im Test-Browser geprüft, nicht von Hand gespielt, nicht auf dem iPad. Die Gebäude der Anlage sind weiter Klötze (keine neuen 3D-Modelle erzeugt). Turniertage gibt es nur in der Karriere, nicht im Saison-Modus.

- Siegerehrung: nur im Test-Browser als Standbilder geprüft (Australian Open und eine kleine Ehrung), nicht auf dem iPad und nicht in Bewegung angesehen. Wirkung der Reden ist geschätzt.

- Die Spielermodelle kommen aus 3D AI Studio (nur starre T-Pose-Modelle); das Skelett rechnet das Spiel selbst. Keine Finger.
- Gesichter sind erfunden – keine Abbilder echter Spieler erzeugen.
- Die Seiten werden nicht getauscht; beim Seitenwechsel gehen die Spieler nur zur Bank.
- Laufen mit der Kamera: nur eine Person im Bild; vor und zurück wird aus der Größe im Bild geschätzt und ist ungenauer als links und rechts.
- Laufen ist ein gebauter Schrittzyklus, keine Aufnahme. Das Gehen beim Seitenwechsel auch (Zahlen: `GANG` oben in `js/avatar.js`);
  liegt in `mocap/bewegungen.json` eine Aufnahme `walk` (Eintrag in `tools/mocap.mjs`, mit einer echten Datei noch nicht erprobt), ersetzt sie den gebauten Gang. Slice-Topspin-Unterschiede bei einhändigen Spielern fehlen.
- Spielstärke und Ballwechsel-Länge sind nur grob eingestellt.
- Drall: Der Schlag des Gegners nimmt den Drall des ankommenden Balls nicht auf. Die Figur hat für die neuen Schlagarten und den Aufschlag von unten keine eigenen Bewegungen (Topspin- bzw. Vorhand-Slice-Bewegung).
- Turnierfelder wie in echt (auch im Turnier- und Saison-Modus): Grand Slam 128, Masters 96 mit 32 Freilosen (Monte-Carlo und Paris 56 mit 8), ATP 500 32, ATP 250 28 mit 4 Freilosen, Challenger und ITF 32. Nur die Gesetzten (`def.setz`) stehen fest im Baum, der Rest wird gelost (`createTournament`). Wer nach einem Freilos sein erstes Match verliert, bekommt die Punkte der ersten Runde. Vereinfacht: alle ATP-500-Turniere haben 32 Spieler, keine Qualifikation zum Mitspielen, Grand Slams nur zwei Gewinnsätze. Große Bäume zeigt `bracketHtml` in 8 Teilen plus Endrunde.
- Kalender: ATP-Turniere in ihrer echten Woche 2026; Challenger- und ITF-Orte gibt es wirklich, ihre Woche stimmt nur ungefähr. Jedes Jahr hat denselben Kalender. Der Saison-Modus hat weiter nur die 14 großen Turniere.
