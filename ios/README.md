# Powershot als iOS-App

Die App ist eine dünne Hülle um das Browser-Spiel. Beim Bauen kopiert `spiel-kopieren.sh` den aktuellen Stand
von `index.html`, `css/`, `js/`, `assets/`, `sounds/` und `icons/` in die App. three.js liegt in `vendor/three/`
(Version 0.160.0, MIT-Lizenz), damit die App ohne Internet läuft. Am Spiel selbst ändert die App nichts.

| Datei | Inhalt |
|---|---|
| `Powershot/PowershotApp.swift` | Start der App: ein Fenster, Vollbild |
| `Powershot/SpielView.swift` | Der eingebaute Browser und der „Datei-Ausgeber“ für die Spieldateien |
| `Powershot/Assets.xcassets` | App-Symbol und Akzentfarbe |
| `Powershot/ControllerBruecke.swift` | Liest Switch-Controller (Stick, Tasten, Bewegung) und meldet sie dem Spiel |
| `Powershot/Fernseher.swift` | Zieht das Spiel auf den Fernseher um (AirPlay), wenn ein Controller gekoppelt ist |
| `Powershot/Funk.swift` | Funkverbindung zwischen zwei Geräten (iPhone als Schläger für das iPad) |
| `Powershot/SchlaegerView.swift` | Der Schläger-Bildschirm auf dem iPhone |
| `spiel-kopieren.sh` | Kopiert das Spiel beim Bauen in die App (ohne `mocap/`) |

## Im Simulator starten

`Powershot.xcodeproj` in Xcode öffnen, oben ein Gerät wählen (z. B. „iPhone 18 Pro“), dann ▶ drücken.

Oder im Terminal (im Ordner `ios/`):

```bash
xcodebuild -project Powershot.xcodeproj -scheme Powershot -destination 'platform=iOS Simulator,name=iPhone 18 Pro' -derivedDataPath ~/Library/Developer/Xcode/DerivedData/Powershot-cli build
xcrun simctl install "iPhone 18 Pro" ~/Library/Developer/Xcode/DerivedData/Powershot-cli/Build/Products/Debug-iphonesimulator/Powershot.app
xcrun simctl launch "iPhone 18 Pro" com.von-bleichert.powershot
```

## Controller und Fernseher

- **Controller koppeln:** iPad-Einstellungen → Bluetooth, am Joy-Con die kleine runde Taste an der Schiene gedrückt halten.
  Im Spiel unter Einstellungen → Steuerung „Controller (Switch)“ wählen. Dort steht auch, ob Schwingen erkannt wird.
- **iPhone als Schläger:** Auf dem iPad bei Steuerung „Controller / iPhone-Schläger“ wählen und ein Match starten. Auf dem iPhone
  Powershot öffnen → Einstellungen → „Dieses Gerät als Schläger für ein anderes benutzen“. Beide Geräte brauchen WLAN oder Bluetooth
  und müssen beim ersten Mal „Lokales Netzwerk“ erlauben. Der Joy-Con liefert unter iOS keine Bewegung, nur Tasten und Stick.
- **Fernseher:** Kontrollzentrum → Bildschirmsynchronisierung → Apple TV wählen. Ist ein Controller gekoppelt, füllt das Spiel
  den Fernseher ganz aus und das iPad zeigt nur einen Hinweis. Ohne Controller spiegelt der Fernseher einfach das iPad.
- Noch nicht am echten Gerät erprobt: Schwingen mit dem Joy-Con und der Umzug auf den Fernseher.

## TestFlight (braucht die bezahlte Developer-Mitgliedschaft)

1. Xcode → Settings → Accounts: Das bezahlte Team muss dort erscheinen (nicht nur „Personal Team“).
2. Im Projekt: Ziel „Powershot“ → Signing & Capabilities → bei „Team“ das bezahlte Team wählen.
3. Auf appstoreconnect.apple.com → Apps → „+“ → Neue App: Plattform iOS, Bundle-ID `com.von-bleichert.powershot`.
4. In Xcode oben als Gerät „Any iOS Device (arm64)“ wählen, dann Product → Archive.
5. Im Fenster „Organizer“: Distribute App → TestFlight & App Store → Upload.
6. In App Store Connect unter TestFlight die Tester eintragen. Interne Tester (bis 100, eigenes Team) brauchen keine Prüfung durch Apple.

Dasselbe im Terminal (im Ordner `ios/`), wenn die App in App Store Connect schon angelegt ist:

```bash
xcodebuild -project Powershot.xcodeproj -scheme Powershot -configuration Release -destination 'generic/platform=iOS' -archivePath ~/Library/Developer/Xcode/Archives/Powershot.xcarchive -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath ~/Library/Developer/Xcode/Archives/Powershot.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath ~/Library/Developer/Xcode/Archives/Powershot-export -allowProvisioningUpdates
```

Bei jedem neuen Upload muss die Build-Nummer steigen (Ziel „Powershot“ → General → Build).

## Bewegungsaufnahmen (nur privat)

Liegt auf diesem Mac die Datei `mocap/bewegungen.json` (sie steht nicht auf GitHub), kopiert `spiel-kopieren.sh` sie mit in die App.
Dann spielen die Figuren mit den aufgenommenen Bewegungen. Die Originale (`mocap/*.FBX`) kommen nie in die App.
So eine App darf nur privat bleiben: interne TestFlight-Tester ja, externe Tester oder App Store nein (Lizenz „Privat“).
Fehlt die Datei, laufen die handgebauten Bewegungen.
