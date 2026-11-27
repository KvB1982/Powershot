# Zerlegt eine Aufnahme an den langen Pausen in einzelne Stücke und zeigt, wie lang jedes ist.
import subprocess, sys, numpy as np
SR = 44100
def lade(datei):
    roh = subprocess.run(['ffmpeg', '-v', 'error', '-i', datei, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(roh, dtype=np.int16).astype(np.float32) / 32768
def stuecke(x, pause=0.7, schwelle=0.012):
    # Lautstärke in Fenstern von 10 ms
    n = SR // 100
    h = np.abs(x[:len(x) // n * n]).reshape(-1, n).max(axis=1)
    laut = h > schwelle
    out, start, still = [], None, 0
    for i, l in enumerate(laut):
        if l:
            if start is None: start = i
            still = 0
        elif start is not None:
            still += 1
            if still >= pause * 100:
                out.append((start, i - still + 1)); start = None; still = 0
    if start is not None: out.append((start, len(laut) - still))
    return [(a / 100, b / 100) for a, b in out if b - a >= 8]
def luecken(x, a, b, schwelle=0.012):
    # längste stille Stelle innerhalb eines Stücks
    n = SR // 100
    seg = x[int(a * SR):int(b * SR)]
    h = np.abs(seg[:len(seg) // n * n]).reshape(-1, n).max(axis=1) > schwelle
    best = run = 0
    for l in h:
        run = 0 if l else run + 1; best = max(best, run)
    return best / 100
if __name__ == '__main__':
    for d in sys.argv[1:]:
        x = lade(d); s = stuecke(x)
        print(d, len(s), 'Stücke:', ' '.join(f'{b - a:.2f}({luecken(x, a, b):.2f})' for a, b in s))
