# Baut die Hintergrund-Schleife „Stadion“ (leises Murmeln der Zuschauer) aus den erzeugten Murmel-Klängen.
# Aufruf: python3 tools/stadion_bau.py <Ordner mit gemurmel_1.mp3 und gemurmel_2.mp3>      (braucht ffmpeg und numpy)
# Die Stücke werden gleich laut gemacht, etwas dumpfer (klingt weiter weg) und weich ineinander geblendet –
# auch das Ende in den Anfang, damit man beim Wiederholen keinen Sprung hört.
import subprocess, sys, os
import numpy as np

ROH = sys.argv[1]
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sounds', 'publikum', 'ki_stadion.mp3')
RATE = 44100
BLENDE = int(0.6 * RATE)     # so lang gehen zwei Stücke ineinander über
RAND = int(0.35 * RATE)      # so viel wird vorn und hinten weggeschnitten (dort blendet die Aufnahme ein und aus)
FENSTER = int(0.5 * RATE)    # in so langen Stücken wird die Lautstärke angeglichen

def lade(name):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', os.path.join(ROH, name), '-af', 'lowpass=f=2800', '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-'], capture_output=True).stdout
    d = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()[RAND:-RAND]
    # Lautstärke glätten: laute Stellen etwas leiser, leise etwas lauter
    n = len(d) // FENSTER
    pegel = np.array([np.sqrt((d[i * FENSTER:(i + 1) * FENSTER] ** 2).mean()) for i in range(n)])
    mal = np.interp(np.arange(len(d)), (np.arange(n) + 0.5) * FENSTER, (pegel.mean() / np.maximum(pegel, 1e-4)) ** 0.7)
    d *= mal[:, None]
    return d / np.sqrt((d ** 2).mean())

teile = [lade('gemurmel_1.mp3'), lade('gemurmel_2.mp3'), lade('gemurmel_1.mp3')[::-1], lade('gemurmel_2.mp3')[::-1]]   # rückwärts klingt Murmeln genauso – so wird die Schleife doppelt so lang
auf = np.sin(np.linspace(0, np.pi / 2, BLENDE))[:, None]
ab = np.cos(np.linspace(0, np.pi / 2, BLENDE))[:, None]
aus = teile[0]
for t in teile[1:]:
    aus = np.concatenate([aus[:-BLENDE], aus[-BLENDE:] * ab + t[:BLENDE] * auf, t[BLENDE:]])
# das Ende in den Anfang blenden
aus = np.concatenate([aus[-BLENDE:] * ab + aus[:BLENDE] * auf, aus[BLENDE:-BLENDE]])
# noch einmal über die ganze Schleife gleich laut machen (im Kreis gerechnet, damit Anfang und Ende zusammenpassen)
n = len(aus) // FENSTER
pegel = np.array([np.sqrt((aus[i * FENSTER:(i + 1) * FENSTER] ** 2).mean()) for i in range(n)])
mitte = (np.arange(n) + 0.5) * FENSTER
aus *= np.interp(np.arange(len(aus)), mitte, pegel.mean() / np.maximum(pegel, 1e-4), period=n * FENSTER)[:, None]
aus *= 0.5 / np.abs(aus).max()
subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '96k', ZIEL], input=aus.astype(np.float32).tobytes(), check=True)
n = len(aus) // FENSTER
pegel = [np.sqrt((aus[i * FENSTER:(i + 1) * FENSTER] ** 2).mean()) for i in range(n)]
print(f'{len(aus) / RATE:.1f} s, {os.path.getsize(ZIEL) / 1024:.0f} KB, Pegel {np.sqrt((aus ** 2).mean()):.3f} (leiseste halbe Sekunde {min(pegel):.3f}, lauteste {max(pegel):.3f})')
