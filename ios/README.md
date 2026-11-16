# Powershot als iOS-App

Die App ist eine dünne Hülle um das Browser-Spiel. Beim Bauen kopiert `spiel-kopieren.sh` den aktuellen Stand
von `index.html`, `css/`, `js/`, `assets/`, `sounds/` und `icons/` in die App. three.js liegt in `vendor/three/`
(Version 0.160.0, MIT-Lizenz), damit die App ohne Internet läuft. Am Spiel selbst ändert die App nichts.

| Datei | Inhalt |
|---|---|
| `Powershot/PowershotApp.swift` | Start der App: ein Fenster, Vollbild |
| `Powershot/SpielView.swift` | Der eingebaute Browser und der „Datei-Ausgeber“ für die Spieldateien |
| `Powershot/Assets.xcassets` | App-Symbol und Akzentfarbe |
| `spiel-kopieren.sh` | Kopiert das Spiel beim Bauen in die App (ohne `mocap/`) |

## Im Simulator starten

`Powershot.xcodeproj` in Xcode öffnen, oben ein Gerät wählen (z. B. „iPhone 18 Pro“), dann ▶ drücken.

Oder im Terminal (im Ordner `ios/`):

```bash
xcodebuild -project Powershot.xcodeproj -scheme Powershot -destination 'platform=iOS Simulator,name=iPhone 18 Pro' -derivedDataPath ~/Library/Developer/Xcode/DerivedData/Powershot-cli build
xcrun simctl install "iPhone 18 Pro" ~/Library/Developer/Xcode/DerivedData/Powershot-cli/Build/Products/Debug-iphonesimulator/Powershot.app
xcrun simctl launch "iPhone 18 Pro" com.von-bleichert.powershot
```

## TestFlight (braucht die bezahlte Developer-Mitgliedschaft)

1. Xcode → Settings → Accounts: Das bezahlte Team muss dort erscheinen (nicht nur „Personal Team“).
2. Im Projekt: Ziel „Powershot“ → Signing & Capabilities → bei „Team“ das bezahlte Team wählen.
3. Auf appstoreconnect.apple.com → Apps → „+“ → Neue App: Plattform iOS, Bundle-ID `com.von-bleichert.powershot`.
4. In Xcode oben als Gerät „Any iOS Device (arm64)“ wählen, dann Product → Archive.
5. Im Fenster „Organizer“: Distribute App → TestFlight & App Store → Upload.
6. In App Store Connect unter TestFlight die Tester eintragen. Interne Tester (bis 100, eigenes Team) brauchen keine Prüfung durch Apple.

Bei jedem neuen Upload muss die Build-Nummer steigen (Ziel „Powershot“ → General → Build).

## Was nicht in die App darf

Die gekauften Bewegungsaufnahmen (`mocap/`) werden nicht mitkopiert. In der App laufen deshalb die handgebauten Bewegungen.
