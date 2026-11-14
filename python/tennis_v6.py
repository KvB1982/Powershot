# Powershot 6 - mit richtigen Tennisspielern, die laufen, ausholen und schlagen
# (Ältere Versionen: tennis_v5.py = 3D mit Kreisen, tennis_v4.py, tennis_v3.py,
#  tennis_v2.py = einfache Version)
#
# Die Steuerung stellst du am Anfang selbst ein (Tasten M, P, T):
#   Mausrad     = zielen (hoch = nach links, runter = nach rechts)
#                 oder vor/zurück laufen
#   Pfeiltasten = links/rechts zielen und hoch/runter laufen (hoch = zum Netz),
#                 oder nur eins davon
#   Maustasten  = links halten = Schlagkraft, Lob mit Doppelklick
#                 oder mit der rechten Maustaste
#   Seitlich läuft deine Figur von allein zum Ball.
#   Der gelbe Ring zeigt, wo der Ball des Computers landen wird.
#
#   Schlagkraft (linke Maustaste gedrückt halten):
#     kurz drücken  -> langsamer, kurzer Ball
#     lang drücken  -> harter, schneller Ball - damit machst du Winner!
#     zu lang       -> der Ball geht ins Aus! (roter Bereich)
#
#   Aufschlag: Kraft aufladen und loslassen - dann wird aufgeschlagen.
#   Der Ball muss ins schräg gegenüberliegende Aufschlagfeld.
#   Zwei Versuche - danach Doppelfehler.
#
#   1 / 2 / 3 = Schwierigkeit wählen und los (leicht / mittel / schwer)
#   Leertaste = nochmal spielen, E = zurück zu den Einstellungen
#
# Wie funktioniert das 3D?
#   Das Spiel rechnet intern weiter auf einem flachen Platz von oben
#   ("Welt-Koordinaten"):  x = Länge des Platzes (bei dir klein, beim Computer groß)
#                          y = Breite des Platzes
#                          z = Höhe über dem Boden
#   Erst beim Malen rechnet die Funktion projektion() jeden Punkt so um,
#   als würde eine Kamera schräg von hinten oben auf den Platz schauen.
#   Was weit weg ist, wird kleiner und rutscht nach oben.
#
# Wie funktionieren die Spielerfiguren?
#   Jede Figur ist ein Skelett aus Gelenken (Schulter, Ellbogen, Hand, Hüfte,
#   Knie, Fuß). Für jede Pose steht in der Tabelle POSEN, wo die Hände sind.
#   Zwischen zwei Posen wird "gemischt" - so entsteht die Bewegung.
#   Ellbogen und Knie rechnet die Funktion gelenk() von allein aus.

import copy
import math
import random
import pygame
import pgzrun

# Größe des Fensters (Bildschirm)
WIDTH = 1100
HEIGHT = 780
TITLE = "Powershot 6"

# Größe der Welt (der flache Platz, auf dem gerechnet wird)
WELT_LAENGE = 1100
WELT_BREITE = 650

# Die Kamera: steht hinter dir, schaut schräg von oben auf den Platz
KAMERA_X = -850       # so weit hinter dem Platz steht die Kamera
KAMERA_HOEHE = 566    # so hoch ist die Kamera
BRENNWEITE = 1750     # Zoom: größer = alles größer
HORIZONT = -350       # wo auf dem Bildschirm der Horizont wäre (oberhalb des Fensters)

# Farben
HINTERGRUND = (20, 55, 40)
AUSSEN = (30, 105, 55)
PLATZ = (45, 145, 70)
WEISS = (255, 255, 255)
GELB = (230, 255, 60)
ORANGE = (255, 160, 40)
SCHATTEN = (20, 70, 35)
BLAU = (60, 120, 230)
ROT = (220, 60, 60)
GRUEN = (80, 220, 80)
HAUT = (240, 200, 160)

# Das Spielfeld (in Welt-Koordinaten)
FELD_LINKS = 150      # deine Grundlinie
FELD_RECHTS = 950     # Grundlinie vom Computer
FELD_OBEN = 125       # eine Seitenauslinie (auf dem Bildschirm links)
FELD_UNTEN = 525      # andere Seitenauslinie (auf dem Bildschirm rechts)
MITTE = (FELD_OBEN + FELD_UNTEN) / 2
NETZ_X = 550
HALBES_FELD = NETZ_X - FELD_LINKS
AUFSCHLAG_TIEFE = HALBES_FELD * 0.55   # Abstand Netz -> Aufschlaglinie
NETZ_HOEHE = 15

HINTER_GRUNDLINIE = 40
GRUND_LINKS = FELD_LINKS - HINTER_GRUNDLINIE
GRUND_RECHTS = FELD_RECHTS + HINTER_GRUNDLINIE
AM_NETZ = 90
ZWEITER_AUFPRALL_HINTEN = 20   # lange Bälle springen erst hier (hinter dir) zum 2. Mal auf
AUFSCHLAEGER_ABSTAND = 50      # so weit von der Mitte steht der Aufschläger
RUECKSCHLAEGER_ABSTAND = 130   # der Rückschläger steht weiter außen

# Ball und Schläger
BALL_RADIUS = 4       # in Welt-Einheiten - auf dem Bildschirm je nach Entfernung größer
START_HOEHE = 20      # so hoch ist der Ball, wenn er geschlagen wird
REICHWEITE = 35       # so weit reicht man mit dem Schläger
REICH_HOEHE = 70      # noch höhere Bälle erreicht man nicht

# Schlagarten des Computers (deine Schläge hängen von der Kraft ab)
SCHLAEGE = {
    "lang": {"tiefe": 0.8, "tempo": 9, "bogen": 70, "nachsprung": 0.45},
    "kurz": {"tiefe": 0.3, "tempo": 6.5, "bogen": 40, "nachsprung": 0.3},
    "lob":  {"tiefe": 0.85, "tempo": 5.5, "bogen": 170, "nachsprung": 0.3},
}

# Deine Steuerung
SPIELER_TEMPO = 6     # so schnell läufst du
RAD_SCHRITT = 30      # so weit bringt dich ein Mausrad-Klick (beim Laufen)
RAD_WINKEL = 5        # so viel Grad dreht ein Mausrad-Klick die Richtungslinie
DREH_TEMPO = 1.5      # so schnell dreht sich die Linie mit den Pfeiltasten (Grad pro Bild)
MAX_WINKEL = 35
LINIEN_LAENGE = 140
KRAFT_PRO_BILD = 1 / 45   # nach ca. 3/4 Sekunde Drücken hast du volle Kraft
KRAFT_MAX = 1.4
DOPPELKLICK = 18          # zwei Klicks innerhalb von 18 Bildern = Doppelklick

# Die Steuerung - einstellbar auf dem Startbildschirm.
# Für jede Einstellung gibt es mehrere Möglichkeiten: (Kürzel, Beschreibung)
EINSTELLUNGEN = {
    "rad": [("zielen", "Mausrad: zielen (hoch = links, runter = rechts)"),
            ("laufen", "Mausrad: vor und zurück laufen"),
            ("aus", "Mausrad: aus")],
    "pfeile": [("beides", "Pfeile: links/rechts = zielen, hoch/runter = laufen"),
               ("laufen", "Pfeile: nur laufen (hoch/runter)"),
               ("zielen", "Pfeile: nur zielen (links/rechts)")],
    "tasten": [("doppelklick", "Maus: links halten = Kraft, Doppelklick = Lob"),
               ("rechts_lob", "Maus: links halten = Kraft, rechte Taste = Lob")],
}
TASTE_FUER = {"rad": "M", "pfeile": "P", "tasten": "T"}
steuerung = {"rad": "zielen", "pfeile": "beides", "tasten": "doppelklick"}

# Seitlich gehen deine Bälle nie ins Aus (zu lang aber schon!).
# Stell das auf False, dann musst du auch seitlich genau zielen.
EIGENE_BAELLE_SEITLICH_DRIN = True

# Ohne Klick kein Schlag: Wer nicht drückt, verpasst den Ball.
KLICK_PFLICHT = True

# Schwierigkeitsstufen:
#   computer_tempo = wie schnell der Computer läuft
#   reaktion       = wie viele Bilder er wartet, bevor er losläuft
#   fehler         = wie oft er ins Aus oder ins Netz schlägt (0.3 = 30 %)
STUFEN = {
    1: {"name": "Leicht", "computer_tempo": 2.5, "reaktion": 25, "fehler": 0.30},
    2: {"name": "Mittel", "computer_tempo": 3.5, "reaktion": 15, "fehler": 0.18},
    3: {"name": "Schwer", "computer_tempo": 4.0, "reaktion": 10, "fehler": 0.08},
}


# ---------------------------------------------------------------
# Felder: Wo darf der Ball landen?
# Ein Bereich ist (x_von, x_bis, y_von, y_bis)
# ---------------------------------------------------------------

def halbes_feld(seite):
    # Das ganze Feld von seite (0 = deins, 1 = Computer)
    if seite == 0:
        return (FELD_LINKS, NETZ_X, FELD_OBEN, FELD_UNTEN)
    return (NETZ_X, FELD_RECHTS, FELD_OBEN, FELD_UNTEN)


def im_bereich(x, y, bereich):
    return bereich[0] <= x <= bereich[1] and bereich[2] <= y <= bereich[3]


def seiten_faktor():
    # Gerade Punktzahl im Spiel: Aufschlag von rechts (Einstand-Seite)
    # Ungerade Punktzahl: Aufschlag von links (Vorteil-Seite)
    return 1 if (punkte[0] + punkte[1]) % 2 == 0 else -1


def aufschlagfeld(empfaenger):
    # Das Aufschlagfeld, schräg gegenüber vom Aufschläger
    f = seiten_faktor()
    if empfaenger == 1:
        oben_unten = (FELD_OBEN, MITTE) if f == 1 else (MITTE, FELD_UNTEN)
        return (NETZ_X, NETZ_X + AUFSCHLAG_TIEFE) + oben_unten
    oben_unten = (MITTE, FELD_UNTEN) if f == 1 else (FELD_OBEN, MITTE)
    return (NETZ_X - AUFSCHLAG_TIEFE, NETZ_X) + oben_unten


# ---------------------------------------------------------------
# Der Ballflug
# ---------------------------------------------------------------

class Flug:
    # Ein Ballflug: vom Schläger bis zum Aufprall - und danach noch ein Stück weiter.
    # x, y = wo der Ball über dem Boden ist (da ist sein Schatten)
    # z    = wie hoch der Ball gerade ist

    def __init__(self, start, ziel, schlaeger, tempo, bogen, nachsprung, bereich,
                 aufschlag=False, zweiter_x=None):
        self.schlaeger = schlaeger   # wer hat geschlagen? 0 = du, 1 = Computer
        self.tempo = tempo
        self.nachsprung = nachsprung
        self.zweiter_x = zweiter_x   # falls gesetzt: hier springt der Ball zum 2. Mal auf
        self.aufschlag = aufschlag
        self.phase = 1               # 1 = vor dem Aufprall, 2 = danach
        self.vorbei = False
        self.verpasst = False        # zu spät geklickt?
        self.schritte = 0
        self.aus = not im_bereich(ziel[0], ziel[1], bereich)
        self.x, self.y, self.z = start[0], start[1], START_HOEHE
        self.strecke(start, ziel, START_HOEHE, bogen)

    def strecke(self, start, ziel, start_hoehe, bogen):
        self.start = start
        self.ziel = ziel
        self.start_hoehe = start_hoehe
        self.bogen = bogen
        self.dauer = max(1, math.dist(start, ziel) / self.tempo)
        self.t = 0

    def schritt(self):
        # Ball ein Bild weiterbewegen. Gibt zurück, was dabei passiert ist.
        self.t += 1
        self.schritte += 1
        s = min(self.t / self.dauer, 1)   # 0 = Anfang, 1 = Ende der Strecke
        alt_x = self.x
        self.x = self.start[0] + (self.ziel[0] - self.start[0]) * s
        self.y = self.start[1] + (self.ziel[1] - self.start[1]) * s
        self.z = self.start_hoehe * (1 - s) + 4 * self.bogen * s * (1 - s)

        # Fliegt der Ball gerade übers Netz - und ist er zu tief?
        ueber_netz = (alt_x < NETZ_X) != (self.x < NETZ_X)
        if self.phase == 1 and ueber_netz and self.z < NETZ_HOEHE:
            self.x = NETZ_X - 6 if alt_x < NETZ_X else NETZ_X + 6
            self.vorbei = True
            return "netz"

        if s >= 1:
            if self.phase == 1:
                if self.aus:
                    self.vorbei = True
                    return "aus"
                # Aufprall im Feld: der Ball springt in dieselbe Richtung weiter
                dx = self.ziel[0] - self.start[0]
                dy = self.ziel[1] - self.start[1]
                if self.zweiter_x is not None and dx != 0:
                    self.nachsprung = max(0.1, (self.zweiter_x - self.ziel[0]) / dx)
                neues_ziel = (self.ziel[0] + dx * self.nachsprung,
                              self.ziel[1] + dy * self.nachsprung)
                self.phase = 2
                self.strecke(self.ziel, neues_ziel, 0, self.bogen * 0.45)
                return "aufprall"
            self.vorbei = True
            return "zweiter_aufprall"

        if self.phase == 2 and not (0 <= self.x <= WELT_LAENGE and 0 <= self.y <= WELT_BREITE):
            self.vorbei = True
            return "zweiter_aufprall"
        return None


def schlagbar(b, seite):
    # Kann seite (0 = du, 1 = Computer) diesen Ball jetzt schlagen?
    if b is None or b.vorbei or b.schlaeger == seite or b.verpasst:
        return False
    if seite == 0 and b.x >= NETZ_X:
        return False
    if seite == 1 and b.x <= NETZ_X:
        return False
    if b.phase == 1 and (b.aus or b.aufschlag):
        return False   # Aus-Bälle lässt man fliegen, Aufschläge müssen aufspringen
    return b.z <= REICH_HOEHE


def abfangpunkt(b, seite, pos, tempo, reaktion, volley):
    # Für den Computer: Wo kann er den Ball rechtzeitig erreichen?
    # Wir spielen den Flug mit einer Kopie des Balls im Voraus durch.
    probe = copy.copy(b)
    letzter = None
    for bild in range(1, 600):
        probe.schritt()
        if probe.vorbei:
            break
        if probe.phase == 1 and not volley:
            continue
        if schlagbar(probe, seite):
            punkt = (probe.x, probe.y)
            letzter = punkt
            weg = math.dist(pos, punkt) - REICHWEITE * 0.6
            if weg <= tempo * max(0, bild - reaktion):
                return punkt
    return letzter


def flugbahn(b):
    # Alle zukünftigen Positionen des Balls - damit du seitlich mitlaufen kannst
    # Gibt außerdem zurück, wie der Flug endet ("netz", "aus" oder "zweiter_aufprall")
    probe = copy.copy(b)
    bahn = []
    while True:
        ereignis = probe.schritt()
        if probe.vorbei:
            return bahn, ereignis
        bahn.append((probe.x, probe.y, probe.z, probe.phase, probe.aus or probe.aufschlag))


# ---------------------------------------------------------------
# Spielzustand
# ---------------------------------------------------------------

stufe = 2
zustand = "start"       # "start", "spiel" oder "ende"
phase = "aufschlag"     # "aufschlag", "ballwechsel" oder "pause"
ball = None
bahn = []
landepunkt = None       # hier wird der Ball des Computers aufkommen
bild_nr = 0

spieler = [GRUND_LINKS, MITTE]
computer = [GRUND_RECHTS, MITTE]
computer_ziel = None
computer_warten = 0
aufschlag_warten = 0
pause_warten = 0
fehler_anzahl = 0       # 1 = es läuft der zweite Aufschlag

# Richtungslinie und Schlag
linie_aktiv = False
winkel = 0
laden = False           # linke Maustaste gerade gedrückt?
kraft = 0
kraft_fest = False      # Maustaste losgelassen - Kraft steht fest
lob = False
letzter_klick = -100

meldung = ""
abdruck = None          # (x, y, wie lange noch, war es aus?)

# Spielstand: Stelle 0 = du, Stelle 1 = Computer
punkte = [0, 0]
spiele = [0, 0]
tiebreak = False
aufschlaeger = 0


def ton(hoehe, dauer=0.05):
    try:
        tone.play(hoehe, dauer)
    except Exception:
        pass


def name(seite):
    return "Du" if seite == 0 else "Computer"


def kraft_grenze():
    # Ab dieser Kraft geht der Ball zu lang (roter Bereich)
    if phase == "aufschlag":
        return (1 - 0.2) / 0.85
    return (1 - 0.25) / 0.68


# ---------------------------------------------------------------
# Schlagen
# ---------------------------------------------------------------

def linie_starten(start_winkel=0):
    global linie_aktiv, winkel, laden, kraft, kraft_fest, lob, letzter_klick
    linie_aktiv = True
    winkel = start_winkel
    laden = False
    kraft = 0
    kraft_fest = False
    lob = False
    letzter_klick = -100


def schlagen(wer, flug):
    global ball, bahn, phase, computer_ziel, computer_warten, linie_aktiv, landepunkt
    ball = flug
    phase = "ballwechsel"
    ton("A4")

    # Die Schlagbewegung der Figur starten
    if flug.aufschlag:
        anim[wer]["schlag"] = "auf"
    elif anim[wer]["art"] == "auf":
        anim[wer]["schlag"] = "vh"
    else:
        anim[wer]["schlag"] = anim[wer]["art"]
    anim[wer]["t"] = 0

    einstellung = STUFEN[stufe]
    if wer == 0:
        # Du hast geschlagen - der Computer überlegt, wo er hinläuft
        linie_aktiv = False
        bahn = []
        computer_warten = einstellung["reaktion"]
        am_netz = computer[0] < NETZ_X + AM_NETZ * 2
        computer_ziel = abfangpunkt(ball, 1, computer, einstellung["computer_tempo"],
                                    einstellung["reaktion"], am_netz and not ball.aufschlag)
    else:
        # Der Computer hat geschlagen - jetzt bist du dran
        computer_ziel = None
        bahn, ende = flugbahn(ball)
        # Landepunkt anzeigen - außer der Ball bleibt sowieso im Netz hängen
        landepunkt = None if ende == "netz" else ball.ziel
        linie_starten()
        # Musst du nach links laufen? Dann wird es eine Rückhand, sonst eine Vorhand
        treff_y = seitlich_ziel()
        if treff_y is not None and treff_y - spieler[1] < -6:
            anim[0]["art"] = "rh"
        else:
            anim[0]["art"] = "vh"


def zielpunkt(ziel_x):
    # Die Richtungslinie verlängern bis ziel_x
    return spieler[1] + math.tan(math.radians(winkel)) * (ziel_x - spieler[0])


def spieler_schlag():
    if lob:
        werte = SCHLAEGE["lob"]
        tiefe, tempo, bogen, nachsprung = (werte["tiefe"], werte["tempo"],
                                           werte["bogen"], werte["nachsprung"])
    else:
        # Mehr Kraft = weiter, schneller, flacher
        k = kraft
        tiefe = 0.25 + 0.68 * k
        tempo = 5 + 10 * k
        bogen = 75 - 35 * k
        nachsprung = 0.3 + 0.2 * k

    ziel_x = NETZ_X + HALBES_FELD * tiefe
    ziel_y = zielpunkt(ziel_x)
    if EIGENE_BAELLE_SEITLICH_DRIN:
        ziel_y = max(FELD_OBEN + 15, min(ziel_y, FELD_UNTEN - 15))
    schlagen(0, Flug((spieler[0], spieler[1]), (ziel_x, ziel_y), 0, tempo, bogen,
                     nachsprung, halbes_feld(1)))


def spieler_aufschlag():
    ziel_x = NETZ_X + AUFSCHLAG_TIEFE * (0.2 + 0.85 * kraft)
    ziel_y = zielpunkt(ziel_x)
    schlagen(0, Flug((spieler[0], spieler[1]), (ziel_x, ziel_y), 0, 6 + 7 * kraft, 55,
                     0.5, aufschlagfeld(1), aufschlag=True))


def computer_schlag():
    if spieler[0] > NETZ_X - 200 and random.random() < 0.35:
        art = "lob"              # Du stehst am Netz - drüber hinweg!
    elif random.random() < 0.25:
        art = "kurz"
    else:
        art = "lang"
    werte = SCHLAEGE[art]
    tiefe = werte["tiefe"] + random.uniform(-0.1, 0.1)
    ziel_x = NETZ_X - HALBES_FELD * tiefe
    ziel_y = random.uniform(FELD_OBEN + 30, FELD_UNTEN - 30)
    bogen = werte["bogen"]

    # Manchmal macht der Computer einen Fehler
    if random.random() < STUFEN[stufe]["fehler"]:
        fehler = random.choice(["zu_lang", "seite", "netz"])
        if fehler == "zu_lang":
            ziel_x = FELD_LINKS - random.uniform(15, 60)
        elif fehler == "seite":
            if random.random() < 0.5:
                ziel_y = FELD_OBEN - random.uniform(15, 50)
            else:
                ziel_y = FELD_UNTEN + random.uniform(15, 50)
        else:
            bogen = 6   # viel zu flach - bleibt im Netz hängen

    # Wo springt der Ball zum zweiten Mal auf? Lange Bälle erst hinter dir,
    # kurze Bälle schon vor der Grundlinie - da musst du nach vorne!
    if art == "kurz":
        zweiter_x = NETZ_X - HALBES_FELD * 0.75
    else:
        zweiter_x = ZWEITER_AUFPRALL_HINTEN
    schlagen(1, Flug((computer[0], computer[1]), (ziel_x, ziel_y), 1, werte["tempo"], bogen,
                     werte["nachsprung"], halbes_feld(0), zweiter_x=zweiter_x))


def computer_aufschlag():
    feld = aufschlagfeld(0)
    ziel_x = random.uniform(feld[0] + 20, feld[1] - 15)
    ziel_y = random.uniform(feld[2] + 15, feld[3] - 15)
    bogen = 50

    # Beim ersten Aufschlag riskiert er mehr als beim zweiten
    fehler_chance = STUFEN[stufe]["fehler"] * (1.5 if fehler_anzahl == 0 else 0.5)
    if random.random() < fehler_chance:
        fehler = random.choice(["zu_lang", "seite", "netz"])
        if fehler == "zu_lang":
            ziel_x = feld[0] - random.uniform(10, 50)
        elif fehler == "seite":
            if feld[2] == MITTE:
                ziel_y = random.choice([MITTE - random.uniform(10, 40),
                                        FELD_UNTEN + random.uniform(10, 40)])
            else:
                ziel_y = random.choice([FELD_OBEN - random.uniform(10, 40),
                                        MITTE + random.uniform(10, 40)])
        else:
            bogen = 6
    schlagen(1, Flug((computer[0], computer[1]), (ziel_x, ziel_y), 1, 10, bogen, 0.5,
                     feld, aufschlag=True, zweiter_x=ZWEITER_AUFPRALL_HINTEN))


# ---------------------------------------------------------------
# Punkte und Spielstand
# ---------------------------------------------------------------

def aufschlag_fehler():
    global fehler_anzahl, phase, pause_warten, meldung
    if fehler_anzahl == 0:
        fehler_anzahl = 1
        meldung = "Fehler!\nZweiter Aufschlag"
        ton("E3", 0.1)
        phase = "pause"
        pause_warten = 60
    else:
        punkt_vergeben(1 - aufschlaeger, "Doppelfehler!")


def punkt_vergeben(gewinner, grund):
    global phase, pause_warten, meldung, fehler_anzahl
    if gewinner == 0:
        meldung = grund + "\nPunkt für dich!"
        ton("C5", 0.15)
    else:
        meldung = grund + "\nPunkt für den Computer"
        ton("C3", 0.2)
    fehler_anzahl = 0
    punkt_fuer(gewinner)
    phase = "pause"
    pause_warten = 90


def punkt_fuer(seite):
    global aufschlaeger
    gegner = 1 - seite
    punkte[seite] += 1

    if tiebreak:
        if punkte[seite] >= 7 and punkte[seite] - punkte[gegner] >= 2:
            spiel_gewonnen(seite)
        elif (punkte[0] + punkte[1]) % 2 == 1:
            aufschlaeger = 1 - aufschlaeger
    else:
        if punkte[seite] >= 4 and punkte[seite] - punkte[gegner] >= 2:
            spiel_gewonnen(seite)


def spiel_gewonnen(seite):
    global punkte, tiebreak, aufschlaeger, zustand, meldung
    gegner = 1 - seite
    spiele[seite] += 1
    punkte = [0, 0]

    if tiebreak or (spiele[seite] >= 6 and spiele[seite] - spiele[gegner] >= 2):
        zustand = "ende"
        return

    if spiele[0] == 6 and spiele[1] == 6:
        tiebreak = True
        meldung += "\nTiebreak!"
    elif seite == 0:
        meldung += "\nSpiel für dich!"
    else:
        meldung += "\nSpiel Computer!"
    aufschlaeger = 1 - aufschlaeger


def punkte_text():
    a, b = punkte
    if tiebreak:
        return str(a) + " : " + str(b)
    if a >= 3 and b >= 3:
        if a == b:
            return "Einstand"
        if a > b:
            return "Vorteil für dich"
        return "Vorteil Computer"
    zahlen = ["0", "15", "30", "40"]
    return zahlen[a] + " : " + zahlen[b]


def neuer_aufschlag():
    # Beide stellen sich auf - je nach Punktestand rechts oder links
    global ball, bahn, phase, spieler, computer, computer_ziel
    global linie_aktiv, aufschlag_warten, meldung
    ball = None
    bahn = []
    phase = "aufschlag"
    if fehler_anzahl == 0:
        meldung = ""
    f = seiten_faktor()
    # Der Aufschläger steht nah an der Mitte, der Rückschläger weiter außen
    if aufschlaeger == 0:
        abstand_spieler, abstand_computer = AUFSCHLAEGER_ABSTAND, RUECKSCHLAEGER_ABSTAND
    else:
        abstand_spieler, abstand_computer = RUECKSCHLAEGER_ABSTAND, AUFSCHLAEGER_ABSTAND
    spieler = [GRUND_LINKS, MITTE + abstand_spieler * f]
    computer = [GRUND_RECHTS, MITTE - abstand_computer * f]
    computer_ziel = None
    if aufschlaeger == 0:
        # Die Richtungslinie zeigt zuerst auf die Mitte des Aufschlagfelds
        feld = aufschlagfeld(1)
        mitte_x = (feld[0] + feld[1]) / 2
        mitte_y = (feld[2] + feld[3]) / 2
        linie_starten(math.degrees(math.atan2(mitte_y - spieler[1], mitte_x - spieler[0])))
    else:
        linie_aktiv = False
        aufschlag_warten = 60


def neues_spiel(neue_stufe):
    global stufe, zustand, punkte, spiele, tiebreak, aufschlaeger, fehler_anzahl
    stufe = neue_stufe
    punkte = [0, 0]
    spiele = [0, 0]
    tiebreak = False
    fehler_anzahl = 0
    aufschlaeger = random.choice([0, 1])
    zustand = "spiel"
    neuer_aufschlag()


# ---------------------------------------------------------------
# Jedes Bild: bewegen, prüfen, schlagen
# ---------------------------------------------------------------

def laufen(figur, ziel, tempo, links_vom_netz):
    dx = ziel[0] - figur[0]
    dy = ziel[1] - figur[1]
    weg = math.hypot(dx, dy)
    if weg <= tempo:
        figur[0], figur[1] = ziel
    else:
        figur[0] += dx / weg * tempo
        figur[1] += dy / weg * tempo
    auf_seite_halten(figur, links_vom_netz)


def auf_seite_halten(figur, links_vom_netz):
    if links_vom_netz:
        figur[0] = max(20, min(figur[0], NETZ_X - 25))
    else:
        figur[0] = max(NETZ_X + 25, min(figur[0], WELT_LAENGE - 20))
    figur[1] = max(20, min(figur[1], WELT_BREITE - 20))


def seitlich_ziel():
    # Wo kommt der Ball auf deiner Höhe (x) an? Dahin läufst du seitlich.
    if ball is None or ball.schlaeger == 0 or ball.verpasst:
        return MITTE
    letzter = None
    for x, y, z, phase_nr, aus in bahn[ball.schritte:]:
        if x >= NETZ_X or z > REICH_HOEHE or (phase_nr == 1 and aus):
            continue
        letzter = y
        if x <= spieler[0] + REICHWEITE * 0.5:
            return y
    return letzter


def spieler_bewegen():
    # Vor und zurück: Pfeil hoch = zum Netz, Pfeil runter = zurück
    # (Mausrad siehe on_mouse_down)
    if steuerung["pfeile"] in ("beides", "laufen"):
        if keyboard.up:
            spieler[0] += SPIELER_TEMPO
        if keyboard.down:
            spieler[0] -= SPIELER_TEMPO
    # Seitlich: automatisch zum Ball
    ziel_y = seitlich_ziel()
    if ziel_y is not None:
        dy = ziel_y - spieler[1]
        spieler[1] += max(-SPIELER_TEMPO, min(dy, SPIELER_TEMPO))
    auf_seite_halten(spieler, True)


def winkel_begrenzen():
    # Beim Aufschlag darf man schräger zielen als im Ballwechsel
    global winkel
    grenze = MAX_WINKEL * 2 if phase == "aufschlag" else MAX_WINKEL
    winkel = max(-grenze, min(winkel, grenze))


def update():
    global pause_warten, aufschlag_warten, computer_warten, abdruck, linie_aktiv
    global winkel, kraft, bild_nr

    bild_nr += 1
    if zustand != "spiel":
        return

    figuren_animieren()

    if linie_aktiv:
        # Zielen: Pfeil links = nach links, Pfeil rechts = nach rechts
        if steuerung["pfeile"] in ("beides", "zielen"):
            if keyboard.left:
                winkel -= DREH_TEMPO
            if keyboard.right:
                winkel += DREH_TEMPO
        winkel_begrenzen()
        if laden:
            kraft = min(kraft + KRAFT_PRO_BILD, KRAFT_MAX)

    if abdruck:
        x, y, zeit, war_aus = abdruck
        abdruck = (x, y, zeit - 1, war_aus) if zeit > 1 else None

    if phase == "pause":
        pause_warten -= 1
        if pause_warten <= 0 and zustand == "spiel":
            neuer_aufschlag()
        return

    if phase == "aufschlag":
        if aufschlaeger == 1:
            aufschlag_warten -= 1
            if aufschlag_warten <= 0:
                computer_aufschlag()
        return

    # --- Ballwechsel ---
    ereignis = ball.schritt()
    if ereignis == "aufprall":
        abdruck = (ball.x, ball.y, 60, False)
        ton("G3", 0.03)
    elif ereignis in ("aus", "netz"):
        if ereignis == "aus":
            abdruck = (ball.x, ball.y, 90, True)
        if ball.aufschlag:
            aufschlag_fehler()
        else:
            punkt_vergeben(1 - ball.schlaeger, "Aus!" if ereignis == "aus" else "Netz!")
        return
    elif ereignis == "zweiter_aufprall":
        if ball.verpasst:
            grund = "Zu spät geklickt!"
        elif ball.aufschlag:
            grund = "Ass!"
        else:
            grund = "Nicht erreicht!"
        punkt_vergeben(ball.schlaeger, grund)
        return

    spieler_bewegen()
    if computer_warten > 0:
        computer_warten -= 1
    else:
        laufen(computer, computer_ziel or (GRUND_RECHTS, MITTE),
               STUFEN[stufe]["computer_tempo"], False)

    # Ist der Ball nah genug zum Schlagen?
    if schlagbar(ball, 0) and math.dist(spieler, (ball.x, ball.y)) <= REICHWEITE:
        if lob or laden or kraft_fest:
            spieler_schlag()
        elif KLICK_PFLICHT:
            ball.verpasst = True     # nicht geklickt - der Ball fliegt vorbei
            linie_aktiv = False
            ton("C3", 0.1)
        else:
            kraft = 0.6
            spieler_schlag()
    elif schlagbar(ball, 1) and math.dist(computer, (ball.x, ball.y)) <= REICHWEITE:
        computer_schlag()


def on_mouse_down(pos, button):
    global laden, kraft, kraft_fest, lob, letzter_klick, winkel
    if zustand != "spiel":
        return

    # Mausrad: je nach Einstellung zielen oder laufen
    if button in (mouse.WHEEL_UP, mouse.WHEEL_DOWN):
        richtung = -1 if button == mouse.WHEEL_UP else 1
        if steuerung["rad"] == "zielen" and linie_aktiv:
            # hochdrehen = nach links zielen, runterdrehen = nach rechts
            winkel += richtung * RAD_WINKEL
            winkel_begrenzen()
        elif steuerung["rad"] == "laufen" and phase == "ballwechsel":
            # hochdrehen = nach vorne, runterdrehen = nach hinten
            spieler[0] -= richtung * RAD_SCHRITT
            auf_seite_halten(spieler, True)
        return

    if not linie_aktiv:
        return
    if button == mouse.RIGHT:
        if steuerung["tasten"] == "rechts_lob" and phase == "ballwechsel":
            lob = True
            laden = False
        return
    if button != mouse.LEFT:
        return
    if (steuerung["tasten"] == "doppelklick" and phase == "ballwechsel"
            and bild_nr - letzter_klick <= DOPPELKLICK):
        lob = True           # Doppelklick!
        laden = False
    else:
        laden = True         # Kraft aufladen, solange gedrückt
        kraft = 0
        kraft_fest = False
        lob = False
    letzter_klick = bild_nr


def on_mouse_up(pos, button):
    global laden, kraft_fest
    if button != mouse.LEFT or not laden:
        return
    laden = False
    kraft_fest = True
    if phase == "aufschlag" and aufschlaeger == 0:
        spieler_aufschlag()      # beim Aufschlag: loslassen = schlagen


def naechste_option(art):
    # Zur nächsten Möglichkeit dieser Einstellung wechseln
    kuerzel = [k for k, beschreibung in EINSTELLUNGEN[art]]
    nummer = kuerzel.index(steuerung[art])
    steuerung[art] = kuerzel[(nummer + 1) % len(kuerzel)]


def beschreibung(art):
    for k, text in EINSTELLUNGEN[art]:
        if k == steuerung[art]:
            return text


def on_key_down(key):
    global zustand
    if zustand == "start":
        if key == keys.M:
            naechste_option("rad")
        elif key == keys.P:
            naechste_option("pfeile")
        elif key == keys.T:
            naechste_option("tasten")
    if zustand == "ende" and key == keys.E:
        zustand = "start"
        return
    if zustand in ("start", "ende"):
        if key == keys.K_1:
            neues_spiel(1)
        elif key == keys.K_2:
            neues_spiel(2)
        elif key == keys.K_3:
            neues_spiel(3)
        elif key == keys.SPACE and zustand == "ende":
            neues_spiel(stufe)


# ---------------------------------------------------------------
# 3D: Welt-Punkte auf den Bildschirm umrechnen
# ---------------------------------------------------------------

def projektion(x, y, z=0):
    # Rechnet einen Punkt der Welt (x, y, z) in einen Bildschirm-Punkt um.
    # Gibt außerdem den Maßstab zurück: wie viele Pixel eine Welt-Einheit dort hat.
    # Je weiter weg (größeres x), desto kleiner der Maßstab.
    abstand = x - KAMERA_X
    massstab = BRENNWEITE / abstand
    bild_x = WIDTH / 2 + (y - MITTE) * massstab
    bild_y = HORIZONT + (KAMERA_HOEHE - z) * massstab
    return (bild_x, bild_y), massstab


def punkt(x, y, z=0):
    return projektion(x, y, z)[0]


def viereck(farbe, x1, x2, y1, y2):
    # Ein Rechteck auf dem Boden - in 3D wird es zum Trapez
    ecken = [punkt(x1, y1), punkt(x1, y2), punkt(x2, y2), punkt(x2, y1)]
    pygame.draw.polygon(screen.surface, farbe, ecken)


def bodenlinie(x1, y1, x2, y2, dicke=2):
    # Eine weiße Linie auf dem Boden, vorne etwas dicker als hinten
    massstab = projektion((x1 + x2) / 2, (y1 + y2) / 2)[1]
    pygame.draw.line(screen.surface, WEISS, punkt(x1, y1), punkt(x2, y2),
                     max(1, round(dicke * massstab)))


def bodenellipse(farbe, x, y, breite, dicke=0):
    # Ein flacher Kreis auf dem Boden (Schatten, Abdruck, Ring)
    (bx, by), m = projektion(x, y)
    w = breite * m
    h = w * 0.45      # flach gedrückt, weil wir schräg draufschauen
    pygame.draw.ellipse(screen.surface, farbe, pygame.Rect(bx - w / 2, by - h / 2, w, h), dicke)


# ---------------------------------------------------------------
# Malen
# ---------------------------------------------------------------

def platz_malen():
    screen.fill(HINTERGRUND)
    viereck(AUSSEN, -200, WELT_LAENGE + 100, -100, WELT_BREITE + 100)
    viereck(PLATZ, FELD_LINKS, FELD_RECHTS, FELD_OBEN, FELD_UNTEN)
    # Aufschlagfeld hervorheben, wenn aufgeschlagen wird
    if zustand == "spiel" and phase == "aufschlag":
        feld = aufschlagfeld(1 - aufschlaeger)
        viereck((60, 170, 90), feld[0], feld[1], feld[2], feld[3])
    # Grundlinien und Seitenauslinien
    bodenlinie(FELD_LINKS, FELD_OBEN, FELD_LINKS, FELD_UNTEN, 3)
    bodenlinie(FELD_RECHTS, FELD_OBEN, FELD_RECHTS, FELD_UNTEN, 3)
    bodenlinie(FELD_LINKS, FELD_OBEN, FELD_RECHTS, FELD_OBEN, 3)
    bodenlinie(FELD_LINKS, FELD_UNTEN, FELD_RECHTS, FELD_UNTEN, 3)
    # Aufschlaglinien und Mittellinie
    for x in (NETZ_X - AUFSCHLAG_TIEFE, NETZ_X + AUFSCHLAG_TIEFE):
        bodenlinie(x, FELD_OBEN, x, FELD_UNTEN)
    bodenlinie(NETZ_X - AUFSCHLAG_TIEFE, MITTE, NETZ_X + AUFSCHLAG_TIEFE, MITTE)


def netz_malen():
    links_y, rechts_y = FELD_OBEN - 20, FELD_UNTEN + 20
    # Netzmaschen: senkrechte dünne Linien
    y = links_y
    while y <= rechts_y:
        pygame.draw.line(screen.surface, (200, 200, 200),
                         punkt(NETZ_X, y, 0), punkt(NETZ_X, y, NETZ_HOEHE), 1)
        y += 12
    pygame.draw.line(screen.surface, (200, 200, 200),
                     punkt(NETZ_X, links_y, NETZ_HOEHE / 2), punkt(NETZ_X, rechts_y, NETZ_HOEHE / 2), 1)
    # Weißes Band oben und die Pfosten
    pygame.draw.line(screen.surface, WEISS, punkt(NETZ_X, links_y, NETZ_HOEHE),
                     punkt(NETZ_X, rechts_y, NETZ_HOEHE), 4)
    for pfosten_y in (links_y, rechts_y):
        pygame.draw.line(screen.surface, (90, 90, 90), punkt(NETZ_X, pfosten_y, 0),
                         punkt(NETZ_X, pfosten_y, NETZ_HOEHE + 3), 5)


# ---------------------------------------------------------------
# Die Spielerfiguren
# ---------------------------------------------------------------

# Die Posen. Für jede Pose drei Angaben:
#   (Schlaghand, Richtung des Schlägers, andere Hand)
# Jede Angabe ist (vor, seite, hoch) aus Sicht der Figur:
#   vor = Richtung Netz, seite = nach rechts, hoch = Höhe über dem Boden
POSEN = {
    "bereit":     ((9, 2, 25),    (0.3, -0.8, 0.5),   (9, -4, 27)),
    # Vorhand: ausholen, treffen, durchschwingen
    "vh_aushol":  ((-8, 14, 30),  (-0.7, 0.5, 0.5),   (8, -6, 30)),
    "vh_treff":   ((12, 13, 24),  (0.3, 0.9, 0.2),    (2, -10, 28)),
    "vh_durch":   ((8, -8, 44),   (-0.3, -0.6, 0.7),  (2, -10, 26)),
    # Rückhand
    "rh_aushol":  ((-6, -10, 28), (-0.7, -0.6, 0.3),  (-3, -10, 29)),
    "rh_treff":   ((12, -8, 24),  (0.3, -0.9, 0.2),   (-2, -9, 27)),
    "rh_durch":   ((6, 14, 42),   (0.2, 0.7, 0.7),    (-4, -10, 26)),
    # Aufschlag: Schläger hinter den Kopf, andere Hand wirft den Ball hoch
    "auf_aushol": ((-6, 8, 44),   (-0.5, 0.1, 0.85),  (6, -5, 58)),
    "auf_treff":  ((4, 5, 58),    (0.15, 0, 1),       (4, -9, 30)),
    "auf_durch":  ((10, -6, 20),  (0.5, -0.5, -0.7),  (2, -10, 26)),
}
SCHLAG_DAUER = 24     # so viele Bilder dauert eine Schlagbewegung
FIGUR_GROESSE = 1.25  # größer = größere Spieler (nur fürs Auge, ändert das Spiel nicht)

# Aussehen: Stelle 0 = du, Stelle 1 = Computer
HEMD = [BLAU, ROT]
HOSE = [(245, 245, 245), (40, 40, 70)]
KAPPE = [(245, 245, 245), (70, 45, 30)]
SCHUH = (250, 250, 250)
RAHMEN = (25, 25, 25)


def neue_animation():
    return {"alt": None,          # Position im letzten Bild
            "lauf": 0.0,          # 0 = steht, 1 = rennt
            "schritt": 0.0,       # wo im Schritt die Beine gerade sind
            "richtung": (1, 0),   # Laufrichtung (vor, seite)
            "aushol": 0.0,        # 0 = bereit, 1 = voll ausgeholt
            "art": "vh",          # "vh" = Vorhand, "rh" = Rückhand, "auf" = Aufschlag
            "schlag": None,       # läuft gerade eine Schlagbewegung?
            "t": 0}               # Bilder seit dem Treffen


anim = [neue_animation(), neue_animation()]


def figuren_animieren():
    # Wird jedes Bild aufgerufen: Beine und Ausholen weiterbewegen
    for i in (0, 1):
        a = anim[i]
        pos = spieler if i == 0 else computer
        d = 1 if i == 0 else -1       # der Computer schaut in die andere Richtung

        # Laufen: Wie weit hat sich die Figur seit dem letzten Bild bewegt?
        if a["alt"] is None:
            a["alt"] = list(pos)
        dx = pos[0] - a["alt"][0]
        dy = pos[1] - a["alt"][1]
        a["alt"] = list(pos)
        weg = math.hypot(dx, dy)
        if weg > 25:
            weg = 0                   # neu aufgestellt - das ist kein Laufen
        if weg > 0.5:
            a["richtung"] = (dx / weg * d, dy / weg * d)
            a["schritt"] += weg / 7
            a["lauf"] = min(1, a["lauf"] + 0.2)
        else:
            a["lauf"] = max(0, a["lauf"] - 0.15)

        # Läuft gerade eine Schlagbewegung? Dann nur die Zeit weiterzählen
        if a["schlag"]:
            a["t"] += 1
            if a["t"] > SCHLAG_DAUER:
                a["schlag"] = None
                a["aushol"] = 0
            continue

        # Ausholen: beim Aufschlag oder wenn der Ball näher kommt
        ziel = 0
        if phase == "aufschlag" and aufschlaeger == i:
            a["art"] = "auf"
            if i == 0:
                ziel = 1 if laden else 0.35
            else:
                ziel = max(0, min(1, 1 - (aufschlag_warten - 10) / 30))
        elif (phase == "ballwechsel" and ball and ball.schlaeger != i and not ball.vorbei
              and not ball.verpasst and not (ball.phase == 1 and ball.aus)):
            abstand = math.dist(pos, (ball.x, ball.y))
            ziel = max(0, min(1, (280 - abstand) / 160))
            if a["aushol"] < 0.3:
                # Vorhand oder Rückhand? Kommt der Ball rechts oder links von mir an?
                # (Für dich wird das schon entschieden, wenn der Computer schlägt -
                #  siehe schlagen() - denn du läufst ja sofort los.)
                if i == 1:
                    treff_y = computer_ziel[1] if computer_ziel else pos[1]
                    a["art"] = "rh" if (treff_y - pos[1]) * d < -6 else "vh"
                elif a["art"] == "auf":
                    a["art"] = "vh"
        a["aushol"] += (ziel - a["aushol"]) * 0.25


def weich(s):
    # Macht aus einer gleichmäßigen Bewegung eine, die sanft anfängt und aufhört
    s = max(0, min(1, s))
    return s * s * (3 - 2 * s)


def mischen(pose_a, pose_b, s):
    # Eine Pose zwischen pose_a (s = 0) und pose_b (s = 1)
    return tuple(tuple(p[k] + (q[k] - p[k]) * s for k in range(3))
                 for p, q in zip(pose_a, pose_b))


def aktuelle_pose(i):
    a = anim[i]
    if a["schlag"]:
        art, t = a["schlag"], a["t"]
        if t < 3:
            return mischen(POSEN[art + "_aushol"], POSEN[art + "_treff"], weich(t / 3))
        if t < 11:
            return mischen(POSEN[art + "_treff"], POSEN[art + "_durch"], weich((t - 3) / 8))
        return mischen(POSEN[art + "_durch"], POSEN["bereit"],
                       weich((t - 11) / (SCHLAG_DAUER - 11)))
    return mischen(POSEN["bereit"], POSEN[a["art"] + "_aushol"], weich(a["aushol"]))


def gelenk(a, b, laenge, beuge):
    # Wo ist das Knie, wenn Hüfte (a) und Fuß (b) feststehen?
    # Beide Knochen sind "laenge" lang, das Gelenk knickt in Richtung "beuge".
    mitte = [(a[k] + b[k]) / 2 for k in range(3)]
    halb = math.dist(a, b) / 2
    if halb >= laenge:
        return tuple(mitte)           # ganz gestreckt
    hoehe = math.sqrt(laenge ** 2 - halb ** 2)
    # Die Knick-Richtung muss senkrecht zur Linie a-b stehen
    linie = [b[k] - a[k] for k in range(3)]
    quadrat = sum(v * v for v in linie) or 1
    anteil = sum(beuge[k] * linie[k] for k in range(3)) / quadrat
    quer = [beuge[k] - anteil * linie[k] for k in range(3)]
    quer_laenge = math.sqrt(sum(v * v for v in quer))
    if quer_laenge < 0.01:
        quer, quer_laenge = [0, 0, 1], 1
    return tuple(mitte[k] + quer[k] / quer_laenge * hoehe for k in range(3))


def begrenzen(a, b, weite):
    # Punkt b näher an a holen, falls er weiter weg ist als "weite" (Armlänge)
    abstand = math.dist(a, b)
    if abstand <= weite:
        return b
    return tuple(a[k] + (b[k] - a[k]) * weite / abstand for k in range(3))


def figur_malen(i):
    a = anim[i]
    fx, fy = spieler if i == 0 else computer
    d = 1 if i == 0 else -1
    g = FIGUR_GROESSE
    m = projektion(fx, fy)[1] * g
    flaeche = screen.surface

    def welt(p):
        # Aus Sicht der Figur (vor, seite, hoch) in Welt-Koordinaten umrechnen
        return (fx + p[0] * d * g, fy + p[1] * d * g, p[2] * g)

    def glied(farbe, p, q, dicke):
        # Ein Körperteil: dicke Linie mit runden Enden
        breite = max(2, round(dicke * m))
        p2, q2 = punkt(*welt(p)), punkt(*welt(q))
        pygame.draw.line(flaeche, farbe, p2, q2, breite)
        pygame.draw.circle(flaeche, farbe, p2, max(1, breite // 2))
        pygame.draw.circle(flaeche, farbe, q2, max(1, breite // 2))

    def zwischen(p, q, s):
        return tuple(p[k] + (q[k] - p[k]) * s for k in range(3))

    # --- Das Skelett ausrechnen ---
    hand_r, richtung, hand_l = aktuelle_pose(i)
    lauf = a["lauf"]
    wippen = math.sin(bild_nr * 0.12 + i * 2) * 0.6 * (1 - lauf)
    hueft_h = 20 + wippen
    schulter_h = hueft_h + 16

    # Oberkörper dreht sich beim Schlag mit
    dreh = max(-0.6, min(0.6, hand_r[0] / 22))
    if hand_r[1] < -4:
        dreh = -dreh * 0.5
    schulter_r = (6 * math.sin(dreh), 6 * math.cos(dreh), schulter_h)
    schulter_l = (-6 * math.sin(dreh), -6 * math.cos(dreh), schulter_h)
    schulter_mitte = (0, 0, schulter_h)
    hueft_mitte = (0, 0, hueft_h)
    hueft_r = (0, 3.5, hueft_h)
    hueft_l = (0, -3.5, hueft_h)
    kopf = (1, 0, schulter_h + 7)

    # Beine: beim Laufen schwingen die Füße vor und zurück
    rv, rs = a["richtung"]
    schwung = math.sin(a["schritt"]) * 9 * lauf
    heben = math.cos(a["schritt"]) * 6 * lauf
    fuss_r = (rv * schwung, 6 + rs * schwung, max(0, heben))
    fuss_l = (-rv * schwung, -6 - rs * schwung, max(0, -heben))
    knie_r = gelenk(hueft_r, fuss_r, 11.5, (1, 0.2, 0.3))
    knie_l = gelenk(hueft_l, fuss_l, 11.5, (1, -0.2, 0.3))

    # Arme
    hand_r = begrenzen(schulter_r, hand_r, 19.5)
    hand_l = begrenzen(schulter_l, hand_l, 19.5)
    ellbogen_r = gelenk(schulter_r, hand_r, 10, (-0.4, 0.6, -1))
    ellbogen_l = gelenk(schulter_l, hand_l, 10, (-0.4, -0.6, -1))

    # Schläger: Griff und ovaler Kopf
    laenge = math.sqrt(sum(v * v for v in richtung)) or 1
    r1 = tuple(v / laenge for v in richtung)
    quer = (0, r1[2], -r1[1])                 # steht senkrecht auf dem Schläger
    quer_laenge = math.hypot(quer[1], quer[2])
    r2 = (0, 1, 0) if quer_laenge < 0.2 else (0, quer[1] / quer_laenge, quer[2] / quer_laenge)
    griff_ende = tuple(hand_r[k] + r1[k] * 6 for k in range(3))
    schlaeger_mitte = tuple(hand_r[k] + r1[k] * 12.5 for k in range(3))
    rand = []
    for n in range(14):
        w = n / 14 * math.tau
        rand.append(tuple(schlaeger_mitte[k] + r1[k] * math.cos(w) * 6.5
                          + r2[k] * math.sin(w) * 5 for k in range(3)))

    # --- Die Körperteile ---
    def bein_malen(huefte, knie, fuss):
        glied(HAUT, huefte, knie, 3.4)
        glied(HOSE[i], huefte, zwischen(huefte, knie, 0.5), 4.4)
        glied(HAUT, knie, fuss, 3)
        zehen = (fuss[0] + 3, fuss[1], fuss[2])
        glied(SCHUH, fuss, zehen, 3.2)

    def rumpf_malen():
        glied(HOSE[i], hueft_l, hueft_r, 5.5)
        glied(HEMD[i], hueft_mitte, schulter_mitte, 9.5)
        glied(HEMD[i], schulter_l, schulter_r, 5)

    def kopf_malen():
        glied(HAUT, schulter_mitte, kopf, 2.6)
        mitte = punkt(*welt(kopf))
        radius = max(3, round(4.6 * m))
        pygame.draw.circle(flaeche, HAUT, mitte, radius)
        # Kappe oder Haare: die obere Hälfte des Kopfes
        pygame.draw.circle(flaeche, KAPPE[i], mitte, radius,
                           draw_top_left=True, draw_top_right=True)

    def arm_malen(schulter, ellbogen, hand):
        glied(HAUT, schulter, ellbogen, 2.8)
        glied(HEMD[i], schulter, zwischen(schulter, ellbogen, 0.45), 3.6)
        glied(HAUT, ellbogen, hand, 2.5)

    def schlagarm_malen():
        arm_malen(schulter_r, ellbogen_r, hand_r)
        glied(RAHMEN, hand_r, griff_ende, 1.6)
        ecken = [punkt(*welt(p)) for p in rand]
        # Saiten: ein paar dünne Linien quer über den Schlägerkopf
        for n in (2, 3, 4, 5):
            pygame.draw.line(flaeche, (235, 235, 235), ecken[n], ecken[14 - n], 1)
        for n in (0, 1, 2, 12, 13):
            pygame.draw.line(flaeche, (235, 235, 235), ecken[n], ecken[(7 - n) % 14], 1)
        pygame.draw.polygon(flaeche, RAHMEN, ecken, max(2, round(1.3 * m)))

    def anderer_arm_malen():
        arm_malen(schulter_l, ellbogen_l, hand_l)
        # Vor dem Aufschlag liegt der Ball in der Hand
        if phase == "aufschlag" and aufschlaeger == i and zustand == "spiel":
            ball_punkt = punkt(*welt((hand_l[0], hand_l[1], hand_l[2] + 3)))
            pygame.draw.circle(flaeche, GELB, ball_punkt, max(3, BALL_RADIUS * m))

    # Von hinten nach vorne malen, damit z. B. der Arm vor dem Körper liegt.
    # "tiefe" sagt, wie weit vorne (aus Sicht der Figur) ein Körperteil ist.
    teile = [
        ((knie_l[0] + fuss_l[0]) / 2, lambda: bein_malen(hueft_l, knie_l, fuss_l)),
        ((knie_r[0] + fuss_r[0]) / 2, lambda: bein_malen(hueft_r, knie_r, fuss_r)),
        (0, rumpf_malen),
        (0.5, kopf_malen),
        ((ellbogen_l[0] + hand_l[0]) / 2, anderer_arm_malen),
        ((ellbogen_r[0] + hand_r[0]) / 2, schlagarm_malen),
    ]
    # Du schaust von der Kamera weg, der Computer zur Kamera hin
    teile.sort(key=lambda teil: -teil[0] * d)

    bodenellipse(SCHATTEN, fx, fy, 30 * g)
    for tiefe, malen in teile:
        malen()


def richtungslinie_malen():
    farbe = ORANGE if (laden or kraft_fest or lob) else GELB
    w = math.radians(winkel)
    for abstand in range(20, LINIEN_LAENGE + 1, 12):
        x = spieler[0] + math.cos(w) * abstand
        y = spieler[1] + math.sin(w) * abstand
        (bx, by), m = projektion(x, y)
        pygame.draw.circle(screen.surface, farbe, (bx, by), max(2, 2 * m))
    if lob:
        ende = punkt(spieler[0] + math.cos(w) * (LINIEN_LAENGE + 30),
                     spieler[1] + math.sin(w) * (LINIEN_LAENGE + 30))
        screen.draw.text("LOB", center=ende, fontsize=26, color=ORANGE,
                         owidth=1, ocolor="black")


def kraftbalken_malen():
    # Balken unter deiner Figur: grün = gut, rot = zu stark (Aus!)
    breite = 70
    fx, fy = punkt(spieler[0], spieler[1])
    links = fx - breite / 2
    oben = fy + 12
    grenze = kraft_grenze() / KRAFT_MAX * breite
    screen.draw.filled_rect(Rect(links, oben, breite, 10), (40, 40, 40))
    screen.draw.filled_rect(Rect(links + grenze, oben, breite - grenze, 10), (110, 40, 40))
    voll = min(kraft, KRAFT_MAX) / KRAFT_MAX * breite
    farbe = ROT if kraft > kraft_grenze() else GRUEN
    if voll > 0:
        screen.draw.filled_rect(Rect(links, oben, voll, 10), farbe)
    screen.draw.rect(Rect(links, oben, breite, 10), WEISS)


def ball_malen():
    (bx, by), m = projektion(ball.x, ball.y, ball.z)
    pygame.draw.circle(screen.surface, GELB, (bx, by), max(3, BALL_RADIUS * m))


def bodensachen_malen():
    # Alles, was flach auf dem Boden liegt: Abdruck, Landepunkt, Ballschatten
    if abdruck:
        x, y, zeit, war_aus = abdruck
        bodenellipse(ROT if war_aus else (200, 230, 200), x, y, 10)
    if ball and ball.schlaeger == 1 and ball.phase == 1 and landepunkt:
        bodenellipse(GELB, landepunkt[0], landepunkt[1], 26, 2)
        bodenellipse(GELB, landepunkt[0], landepunkt[1], 6)
    if ball:
        bodenellipse(SCHATTEN, ball.x, ball.y, 9)


def figuren_malen():
    # Von hinten nach vorne malen: Was weiter weg ist (großes x), zuerst.
    # So verdeckt das Netz den Computer - und du verdeckst das Netz.
    dinge = [(computer[0], lambda: figur_malen(1)),
             (NETZ_X, netz_malen),
             (spieler[0], lambda: figur_malen(0))]
    if ball:
        dinge.append((ball.x, ball_malen))
    dinge.sort(key=lambda ding: -ding[0])
    for x, malen in dinge:
        malen()


def anzeige_malen():
    # Anzeigetafel oben
    screen.draw.filled_rect(Rect(0, 0, WIDTH, 95), (15, 40, 28))
    for seite, x in ((0, 160), (1, WIDTH - 160)):
        text = name(seite)
        if seite == aufschlaeger:
            text = "* " + text
        screen.draw.text(text, center=(x, 25), fontsize=30, color=WEISS)
        screen.draw.text(str(spiele[seite]), center=(x, 65), fontsize=50, color=GELB)
    titel = "Tiebreak" if tiebreak else "Punkte"
    screen.draw.text(titel + "   (Stufe: " + STUFEN[stufe]["name"] + ")",
                     center=(WIDTH / 2, 20), fontsize=22, color=WEISS)
    screen.draw.text(punkte_text(), center=(WIDTH / 2, 55), fontsize=46, color=WEISS,
                     owidth=1, ocolor="black")
    if phase == "aufschlag" and fehler_anzahl == 1:
        screen.draw.text("2. Aufschlag", center=(WIDTH / 2, 85), fontsize=22, color=ORANGE)
    screen.draw.text(beschreibung("rad") + "     " + beschreibung("pfeile") + "     "
                     + beschreibung("tasten"),
                     center=(WIDTH / 2, HEIGHT - 10), fontsize=17, color=WEISS)


def startbildschirm_malen():
    screen.draw.filled_rect(Rect(170, 180, WIDTH - 340, 420), (20, 60, 30))
    screen.draw.text("POWERSHOT 6", center=(WIDTH / 2, 110), fontsize=100, color=GELB,
                     owidth=1, ocolor="black")
    screen.draw.text("Steuerung einstellen - Taste drücken zum Ändern:",
                     center=(WIDTH / 2, 220), fontsize=30, color=WEISS)
    for i, art in enumerate(("rad", "pfeile", "tasten")):
        screen.draw.text("[" + TASTE_FUER[art] + "]   " + beschreibung(art),
                         midleft=(230, 270 + i * 42), fontsize=32, color=GELB)

    # Warnung, wenn man so gar nicht laufen oder zielen kann
    if steuerung["rad"] != "laufen" and steuerung["pfeile"] == "zielen":
        screen.draw.text("Achtung: So kannst du nicht vor und zurück laufen!",
                         center=(WIDTH / 2, 405), fontsize=26, color=ORANGE)
    if steuerung["rad"] != "zielen" and steuerung["pfeile"] == "laufen":
        screen.draw.text("Achtung: So kannst du nicht zielen!",
                         center=(WIDTH / 2, 405), fontsize=26, color=ORANGE)

    screen.draw.text("Schwierigkeit wählen und los:", center=(WIDTH / 2, 465),
                     fontsize=30, color=WEISS)
    screen.draw.text("1 = Leicht     2 = Mittel     3 = Schwer",
                     center=(WIDTH / 2, 510), fontsize=40, color=WEISS)
    screen.draw.text("Linke Maustaste halten = Schlagkraft (zu lang = Aus!)   "
                     "Gelber Ring = hier landet der Ball",
                     center=(WIDTH / 2, 565), fontsize=22, color=WEISS)


def draw():
    platz_malen()

    if zustand == "start":
        startbildschirm_malen()
        return

    bodensachen_malen()
    if linie_aktiv:
        richtungslinie_malen()
    figuren_malen()
    if linie_aktiv:
        kraftbalken_malen()
    anzeige_malen()

    if meldung:
        screen.draw.text(meldung, center=(WIDTH / 2, 380), fontsize=50, color=GELB,
                         owidth=1.5, ocolor="black", align="center")

    if zustand == "ende":
        if spiele[0] > spiele[1]:
            sieger = "Du gewinnst den Satz!"
        else:
            sieger = "Der Computer gewinnt den Satz!"
        screen.draw.filled_rect(Rect(200, 280, WIDTH - 400, 220), (20, 60, 30))
        screen.draw.text(sieger, center=(WIDTH / 2, 330), fontsize=56, color=GELB)
        screen.draw.text(str(spiele[0]) + " : " + str(spiele[1]), center=(WIDTH / 2, 390),
                         fontsize=50, color=WEISS)
        screen.draw.text("Leertaste = nochmal     1 / 2 / 3 = andere Stufe     E = Einstellungen",
                         center=(WIDTH / 2, 460), fontsize=26, color=WEISS)


pgzrun.go()
