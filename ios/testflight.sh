#!/bin/sh
# Powershot – baut die App und lädt sie zu TestFlight hoch.
#
#   Aufruf im Ordner ios/:   ./testflight.sh            (baut neu und lädt hoch)
#                            ./testflight.sh --nur-upload   (lädt das zuletzt gebaute Archiv noch einmal hoch)
#
# Der Upload läuft über einen "App Store Connect API-Schlüssel". Das ist ein Schlüssel von Apple, mit dem
# ein Programm Builds hochladen darf, ohne dass sich jemand in Xcode anmelden muss. Er läuft nicht ab.
#
# Der Schlüssel selbst (Datei AuthKey_….p8) ist geheim und liegt NIE hier im Projekt, sondern im
# Benutzerordner unter ~/.appstoreconnect/private_keys/. Hier im Projekt steht nur, WELCHER Schlüssel
# gemeint ist – in der Datei ios/testflight.env (die wird nicht zu GitHub übertragen):
#
#   ASC_KEY_ID=ABC123DEFG                               ← Schlüssel-ID (10 Zeichen)
#   ASC_ISSUER_ID=12345678-1234-1234-1234-123456789012  ← Issuer-ID (Aussteller)
#
# Fehlt diese Datei, versucht das Skript den Upload mit der Anmeldung aus Xcode (wie früher).
set -e
cd "$(dirname "$0")"

ARCHIVE="$HOME/Library/Developer/Xcode/Archives"
DATEN="$HOME/Library/Developer/Xcode/DerivedData/Powershot-cli"
NUMMER=$(grep -m1 -o "CURRENT_PROJECT_VERSION = [0-9]*" Powershot.xcodeproj/project.pbxproj | grep -o "[0-9]*$")
ARCHIV="$ARCHIVE/Powershot-1.0-$NUMMER.xcarchive"

# Den Schlüssel suchen (nur wenn testflight.env da ist)
SCHLUESSEL=""
if [ -f testflight.env ]; then
  . ./testflight.env
  DATEI="$HOME/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8"
  if [ -z "$ASC_KEY_ID" ] || [ -z "$ASC_ISSUER_ID" ]; then
    echo "In testflight.env fehlt ASC_KEY_ID oder ASC_ISSUER_ID."; exit 1
  fi
  if [ ! -f "$DATEI" ]; then
    echo "Die Schlüssel-Datei fehlt: $DATEI"; exit 1
  fi
  SCHLUESSEL="-authenticationKeyPath $DATEI -authenticationKeyID $ASC_KEY_ID -authenticationKeyIssuerID $ASC_ISSUER_ID"
  echo "Upload mit API-Schlüssel $ASC_KEY_ID."
else
  echo "Keine testflight.env gefunden – Upload mit der Anmeldung aus Xcode."
fi

if [ "$1" != "--nur-upload" ]; then
  echo "Baue Build $NUMMER …"
  rm -rf "$ARCHIV"
  # shellcheck disable=SC2086
  xcodebuild -project Powershot.xcodeproj -scheme Powershot -configuration Release \
    -destination 'generic/platform=iOS' -derivedDataPath "$DATEN" -archivePath "$ARCHIV" \
    -allowProvisioningUpdates $SCHLUESSEL archive | grep -E "error|ARCHIVE" || true
fi
[ -d "$ARCHIV" ] || { echo "Es gibt kein Archiv für Build $NUMMER."; exit 1; }

echo "Lade Build $NUMMER hoch …"
rm -rf "$ARCHIVE/Powershot-export"
# shellcheck disable=SC2086
xcodebuild -exportArchive -archivePath "$ARCHIV" -exportOptionsPlist ExportOptions.plist \
  -exportPath "$ARCHIVE/Powershot-export" -allowProvisioningUpdates $SCHLUESSEL \
  | grep -iE "error|access|Upload succeeded|EXPORT" || true
