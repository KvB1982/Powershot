# Macht aus der erzeugten Stadion-Schleife (3D AI Studio, generate_sound_effect mit loop) die Datei für das Spiel.
# Aufruf: python3 tools/stadion_bau.py <stadion.wav>      (braucht ffmpeg und numpy)
# Die Roh-Aufnahme ist sehr leise und hat ein paar laute Stellen (Husten). Hier wird sie gleichmäßiger und lauter gemacht,
# laute Spitzen werden weich gedeckelt. Alles im Kreis gerechnet, damit Anfang und Ende weiter zusammenpassen.
import subprocess, sys, os
import numpy as np

ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sounds', 'publikum', 'ki_stadion.mp3')
RATE = 44100
FENSTER = int(0.5 * RATE)    # in so langen Stücken wird die Lautstärke angeglichen
PEGEL = 0.09                 # so laut soll die Schleife im Mittel sein (wie die alte)
DECKEL = 0.4                 # lauter wird keine Spitze

raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', sys.argv[1], '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-'], capture_output=True).stdout
d = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
n = len(d) // FENSTER
pegel = np.array([np.sqrt((d[i * FENSTER:(i + 1) * FENSTER] ** 2).mean()) for i in range(n)])
mitte = (np.arange(n) + 0.5) * FENSTER
d *= np.interp(np.arange(len(d)), mitte, (np.median(pegel) / np.maximum(pegel, 1e-5)) ** 0.7, period=n * FENSTER)[:, None]
for _ in range(3):
    d *= PEGEL / np.sqrt((d ** 2).mean())
    d = DECKEL * np.tanh(d / DECKEL)
subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '96k', ZIEL], input=d.astype(np.float32).tobytes(), check=True)
pegel = [np.sqrt((d[i * FENSTER:(i + 1) * FENSTER] ** 2).mean()) for i in range(n)]
print(f'{len(d) / RATE:.1f} s, {os.path.getsize(ZIEL) / 1024:.0f} KB, Pegel {np.sqrt((d ** 2).mean()):.3f} (leiseste halbe Sekunde {min(pegel):.3f}, lauteste {max(pegel):.3f}), Spitze {np.abs(d).max():.2f}')
