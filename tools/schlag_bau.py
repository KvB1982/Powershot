# Schneidet einzelne Schläge aus den erzeugten Aufnahmen (3D AI Studio, generate_sound_effect) für das Spiel zurecht.
# Aufruf: python3 tools/schlag_bau.py <Ordner, in dem roh/ und roh2/ liegen>      (braucht ffmpeg und numpy)
# Eine erzeugte Aufnahme ist ein bis anderthalb Sekunden lang, der Schlag selbst nur einen Bruchteil davon – und längst nicht jede
# Aufnahme ist brauchbar (viele waren fast still oder nur ein dumpfes Wummern). In STUECKE steht, welches Stück genommen wird:
# Das Werkzeug sucht ab der genannten Sekunde den Anfang des Schlags selbst (die erste laute Stelle).
import subprocess, sys, os
import numpy as np

ROH = sys.argv[1]
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sounds', 'match')
RATE = 44100
SPITZE = 0.85
VOR = 0.008          # so viele Sekunden vor dem Schlag fängt die Datei an
# Name im Spiel: (Roh-Datei, suchen ab Sekunde, Länge in Sekunden)
STUECKE = {
    'ki_aufprall_1': ('roh2/aufprall_1.wav', 0.1, 0.16),
    'ki_aufprall_2': ('roh2/aufprall_3.wav', 0.15, 0.16),
    'ki_aufprall_3': ('roh2/aufprall_4.wav', 0.1, 0.07),
    'ki_aufprall_4': ('roh/aufprall_3.wav', 0.0, 0.16),
    'ki_aufprall_5': ('roh/aufprall_4.wav', 0.1, 0.16),
    'ki_netz_1': ('roh2/netz_1.wav', 0.0, 0.35),
    'ki_netz_2': ('roh2/netz_2.wav', 0.3, 0.40),
    'ki_netz_3': ('roh2/netz_3.wav', 0.4, 0.25),
    'ki_netz_4': ('roh2/netz_4.wav', 0.7, 0.45),
}
for name, (datei, ab, lang) in STUECKE.items():
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', os.path.join(ROH, datei), '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-'], capture_output=True).stdout
    d = np.frombuffer(raw, dtype=np.float32).copy()
    a = int(ab * RATE)
    laut = np.abs(d[a:a + int(0.5 * RATE)])
    los = a + int(np.argmax(laut > 0.1 * laut.max()))          # hier beginnt der Schlag
    start = max(0, los - int(VOR * RATE))
    d = d[start:start + int(lang * RATE)]
    ein, aus = int(0.003 * RATE), int(min(0.08, lang / 3) * RATE)
    d[:ein] *= np.linspace(0, 1, ein)
    d[-aus:] *= np.linspace(1, 0, aus) ** 2
    d *= SPITZE / np.abs(d).max()
    ziel = os.path.join(ZIEL, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '96k', ziel], input=d.astype(np.float32).tobytes(), check=True)
    print(f'{name:16s} ab {start / RATE:.3f} s  {len(d) / RATE:.2f} s  {os.path.getsize(ziel) / 1024:.1f} KB  Pegel {np.sqrt((d ** 2).mean()):.3f}')
