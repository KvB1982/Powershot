#!/bin/sh
# Powershot – kopiert das Spiel (HTML, CSS, JavaScript, Modelle, Sounds) in die App.
# Xcode ruft dieses Skript bei jedem Bauen auf. So steckt immer der aktuelle Stand des Spiels in der App.
# Die gekauften Bewegungsaufnahmen: Die Originale (mocap/*.FBX) kommen nie in die App.
# Nur die umgerechnete Datei mocap/bewegungen.json wird mitgenommen – und nur, wenn sie auf diesem Rechner liegt.
# Sie steht nicht auf GitHub. Die App damit darf nur privat bleiben (interne TestFlight-Tester), nicht in den App Store.
set -e
SPIEL="$SRCROOT/.."
ZIEL="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/web"
rm -rf "$ZIEL"
mkdir -p "$ZIEL/vendor"
cp "$SPIEL/index.html" "$ZIEL/"
for ORDNER in css js assets sounds icons; do
  rsync -a --exclude '.DS_Store' "$SPIEL/$ORDNER" "$ZIEL/"
done
rsync -a --exclude '.DS_Store' "$SRCROOT/vendor/three" "$ZIEL/vendor/"
if [ -f "$SPIEL/mocap/bewegungen.json" ]; then
  mkdir -p "$ZIEL/mocap"
  cp "$SPIEL/mocap/bewegungen.json" "$ZIEL/mocap/"
  echo "Bewegungsaufnahmen sind in dieser App enthalten (nur privat verwenden!)."
else
  echo "Keine mocap/bewegungen.json gefunden - die App benutzt die handgebauten Bewegungen."
fi
