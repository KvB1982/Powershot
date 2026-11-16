#!/bin/sh
# Powershot – holt den neuesten Stand von GitHub, baut die App und startet sie im Simulator.
#   Aufruf im Ordner ios/:   ./simulator-starten.sh                (iPad Pro 13 Zoll)
#                            ./simulator-starten.sh "iPhone 18 Pro"
set -e
GERAET="${1:-iPad Pro 13-inch (M5)}"
ORDNER="$HOME/Library/Developer/Xcode/DerivedData/Powershot-cli"
cd "$(dirname "$0")"
git pull --rebase origin main
xcrun simctl boot "$GERAET" 2>/dev/null || true
xcodebuild -project Powershot.xcodeproj -scheme Powershot -configuration Debug \
  -destination "platform=iOS Simulator,name=$GERAET" -derivedDataPath "$ORDNER" build | grep -E "error:|BUILD"
xcrun simctl terminate "$GERAET" com.von-bleichert.powershot 2>/dev/null || true
xcrun simctl install "$GERAET" "$ORDNER/Build/Products/Debug-iphonesimulator/Powershot.app"
xcrun simctl launch "$GERAET" com.von-bleichert.powershot
echo "Fertig: Powershot läuft auf $GERAET."
