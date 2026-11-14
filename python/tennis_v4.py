# Tennis 4 - mit Landepunkt, schnellerer Kraft und einstellbarer Steuerung
# (Ältere Versionen: tennis_v3.py, tennis_v2.py = einfache Version)
#
# Die Steuerung stellst du am Anfang selbst ein (Tasten M, P, T):
#   Mausrad     = zielen (hoch = nach links, runter = nach rechts)
#                 oder vor/zurück laufen
#   Pfeiltasten = hoch/runter zielen und links/rechts laufen,
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
#     Hältst du gedrückt, bis der Ball da ist, schlägst du mit dieser Kraft.
#
#   Aufschlag: Kraft aufladen und loslassen - dann wird aufgeschlagen.
#   Der Ball muss ins schräg gegenüberliegende Aufschlagfeld.
#   Zwei Versuche - danach Doppelfehler.
#
#   1 / 2 / 3 = Schwierigkeit wählen und los (leicht / mittel / schwer)
#   Leertaste = nochmal spielen, E = zurück zu den Einstellungen
#
# Gezählt wird wie beim echten Tennis: 15, 30, 40, Einstand, Vorteil.
# Ein Satz bis 6 Spiele, bei 6:6 Tiebreak.

import copy
import math
import random
import pgzrun

WIDTH = 1100
HEIGHT = 650
TITLE = "Powershot 4"

# Farben
AUSSEN = (30, 105, 55)
PLATZ = (45, 145, 70)
WEISS = (255, 255, 255)
GELB = (230, 255, 60)
ORANGE = (255, 160, 40)
SCHATTEN = (20, 70, 35)
BLAU = (60, 120, 230)
ROT = (220, 60, 60)
GRUEN = (80, 220, 80)

# Das Spielfeld (in Pixeln)
FELD_LINKS = 150      # linke Grundlinie
FELD_RECHTS = 950     # rechte Grundlinie
FELD_OBEN = 125       # obere Seitenauslinie
FELD_UNTEN = 525      # untere Seitenauslinie
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
BALL_RADIUS = 7
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
    "pfeile": [("beides", "Pfeile: hoch/runter = zielen, links/rechts = laufen"),
               ("laufen", "Pfeile: nur laufen (links/rechts)"),
               ("zielen", "Pfeile: nur zielen (hoch/runter)")],
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
# Ein Bereich ist (x_links, x_rechts, y_oben, y_unten)
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

        if self.phase == 2 and not (0 <= self.x <= WIDTH and 0 <= self.y <= HEIGHT):
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
        figur[0] = max(NETZ_X + 25, min(figur[0], WIDTH - 20))
    figur[1] = max(20, min(figur[1], HEIGHT - 20))


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
    # Vor und zurück: Pfeiltasten (Mausrad siehe on_mouse_down)
    if steuerung["pfeile"] in ("beides", "laufen"):
        if keyboard.right:
            spieler[0] += SPIELER_TEMPO
        if keyboard.left:
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

    if linie_aktiv:
        if steuerung["pfeile"] in ("beides", "zielen"):
            if keyboard.up:
                winkel -= DREH_TEMPO
            if keyboard.down:
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
# Malen
# ---------------------------------------------------------------

def linie(x1, y1, x2, y2, dicke=3):
    screen.draw.filled_rect(Rect(min(x1, x2) - dicke // 2, min(y1, y2) - dicke // 2,
                                 abs(x2 - x1) + dicke, abs(y2 - y1) + dicke), WEISS)


def platz_malen():
    screen.fill(AUSSEN)
    screen.draw.filled_rect(Rect(FELD_LINKS, FELD_OBEN, FELD_RECHTS - FELD_LINKS,
                                 FELD_UNTEN - FELD_OBEN), PLATZ)
    # Aufschlagfeld hervorheben, wenn aufgeschlagen wird
    if zustand == "spiel" and phase == "aufschlag":
        feld = aufschlagfeld(1 - aufschlaeger)
        screen.draw.filled_rect(Rect(feld[0], feld[2], feld[1] - feld[0], feld[3] - feld[2]),
                                (60, 170, 90))
    # Seitenauslinien und Grundlinien
    linie(FELD_LINKS, FELD_OBEN, FELD_RECHTS, FELD_OBEN)
    linie(FELD_LINKS, FELD_UNTEN, FELD_RECHTS, FELD_UNTEN)
    linie(FELD_LINKS, FELD_OBEN, FELD_LINKS, FELD_UNTEN)
    linie(FELD_RECHTS, FELD_OBEN, FELD_RECHTS, FELD_UNTEN)
    # Aufschlaglinien und Mittellinie
    linie(NETZ_X - AUFSCHLAG_TIEFE, FELD_OBEN, NETZ_X - AUFSCHLAG_TIEFE, FELD_UNTEN, 2)
    linie(NETZ_X + AUFSCHLAG_TIEFE, FELD_OBEN, NETZ_X + AUFSCHLAG_TIEFE, FELD_UNTEN, 2)
    linie(NETZ_X - AUFSCHLAG_TIEFE, MITTE, NETZ_X + AUFSCHLAG_TIEFE, MITTE, 2)
    # Netz mit Pfosten
    screen.draw.filled_rect(Rect(NETZ_X - 3, FELD_OBEN - 20, 6, FELD_UNTEN - FELD_OBEN + 40),
                            (215, 215, 215))
    screen.draw.filled_circle((NETZ_X, FELD_OBEN - 20), 5, (90, 90, 90))
    screen.draw.filled_circle((NETZ_X, FELD_UNTEN + 20), 5, (90, 90, 90))


def figur_malen(figur, farbe, text):
    screen.draw.filled_circle((figur[0] + 4, figur[1] + 6), 14, SCHATTEN)
    screen.draw.filled_circle((figur[0], figur[1]), 15, farbe)
    screen.draw.circle((figur[0], figur[1]), 15, WEISS)
    screen.draw.text(text, center=(figur[0], figur[1] - 28), fontsize=22, color=WEISS)


def richtungslinie_malen():
    farbe = ORANGE if (laden or kraft_fest or lob) else GELB
    w = math.radians(winkel)
    for abstand in range(20, LINIEN_LAENGE + 1, 12):
        x = spieler[0] + math.cos(w) * abstand
        y = spieler[1] + math.sin(w) * abstand
        screen.draw.filled_circle((x, y), 3, farbe)
    if lob:
        ende = (spieler[0] + math.cos(w) * (LINIEN_LAENGE + 30),
                spieler[1] + math.sin(w) * (LINIEN_LAENGE + 30))
        screen.draw.text("LOB", center=ende, fontsize=26, color=ORANGE,
                         owidth=1, ocolor="black")


def kraftbalken_malen():
    # Balken unter deiner Figur: grün = gut, rot = zu stark (Aus!)
    breite = 70
    links = spieler[0] - breite / 2
    oben = spieler[1] + 24
    grenze = kraft_grenze() / KRAFT_MAX * breite
    screen.draw.filled_rect(Rect(links, oben, breite, 10), (40, 40, 40))
    screen.draw.filled_rect(Rect(links + grenze, oben, breite - grenze, 10), (110, 40, 40))
    voll = min(kraft, KRAFT_MAX) / KRAFT_MAX * breite
    farbe = ROT if kraft > kraft_grenze() else GRUEN
    if voll > 0:
        screen.draw.filled_rect(Rect(links, oben, voll, 10), farbe)
    screen.draw.rect(Rect(links, oben, breite, 10), WEISS)


def ball_malen():
    screen.draw.filled_circle((ball.x, ball.y), BALL_RADIUS - 1, SCHATTEN)
    screen.draw.filled_circle((ball.x, ball.y - ball.z), BALL_RADIUS, GELB)


def anzeige_malen():
    for seite, x in ((0, WIDTH / 4), (1, WIDTH * 3 / 4)):
        text = name(seite)
        if seite == aufschlaeger:
            text = "* " + text
        screen.draw.text(text, center=(x, 30), fontsize=32, color=WEISS)
        screen.draw.text(str(spiele[seite]), center=(x, 75), fontsize=56, color=GELB)
    screen.draw.text("Stufe: " + STUFEN[stufe]["name"], center=(WIDTH / 2, 30),
                     fontsize=24, color=WEISS)
    if phase == "aufschlag" and fehler_anzahl == 1:
        screen.draw.text("2. Aufschlag", center=(WIDTH / 2, 60), fontsize=26, color=ORANGE)

    titel = "Tiebreak" if tiebreak else "Punkte"
    screen.draw.text(titel, center=(WIDTH / 2, 560), fontsize=22, color=WEISS)
    screen.draw.text(punkte_text(), center=(WIDTH / 2, 590), fontsize=42, color=WEISS,
                     owidth=1, ocolor="black")
    screen.draw.text(beschreibung("rad") + "     " + beschreibung("pfeile") + "     "
                     + beschreibung("tasten"),
                     center=(WIDTH / 2, 630), fontsize=18, color=WEISS)


def startbildschirm_malen():
    screen.draw.filled_rect(Rect(170, 150, WIDTH - 340, 400), (20, 60, 30))
    screen.draw.text("TENNIS 4", center=(WIDTH / 2, 95), fontsize=100, color=GELB,
                     owidth=1, ocolor="black")
    screen.draw.text("Steuerung einstellen - Taste drücken zum Ändern:",
                     center=(WIDTH / 2, 185), fontsize=30, color=WEISS)
    for i, art in enumerate(("rad", "pfeile", "tasten")):
        screen.draw.text("[" + TASTE_FUER[art] + "]   " + beschreibung(art),
                         midleft=(230, 235 + i * 42), fontsize=32, color=GELB)

    # Warnung, wenn man so gar nicht vor und zurück laufen kann
    if steuerung["rad"] != "laufen" and steuerung["pfeile"] == "zielen":
        screen.draw.text("Achtung: So kannst du nicht vor und zurück laufen!",
                         center=(WIDTH / 2, 370), fontsize=26, color=ORANGE)
    if steuerung["rad"] != "zielen" and steuerung["pfeile"] == "laufen":
        screen.draw.text("Achtung: So kannst du nicht zielen!",
                         center=(WIDTH / 2, 370), fontsize=26, color=ORANGE)

    screen.draw.text("Schwierigkeit wählen und los:", center=(WIDTH / 2, 430),
                     fontsize=30, color=WEISS)
    screen.draw.text("1 = Leicht     2 = Mittel     3 = Schwer",
                     center=(WIDTH / 2, 475), fontsize=40, color=WEISS)
    screen.draw.text("Linke Maustaste halten = Schlagkraft (zu lang = Aus!)   "
                     "Gelber Ring = hier landet der Ball",
                     center=(WIDTH / 2, 525), fontsize=22, color=WEISS)


def landepunkt_malen():
    # Gelber Ring: hier wird der Ball des Computers aufkommen
    if ball and ball.schlaeger == 1 and ball.phase == 1 and landepunkt:
        screen.draw.circle(landepunkt, 11, GELB)
        screen.draw.circle(landepunkt, 10, GELB)
        screen.draw.filled_circle(landepunkt, 3, GELB)


def draw():
    platz_malen()

    if zustand == "start":
        startbildschirm_malen()
        return

    anzeige_malen()

    if abdruck:
        x, y, zeit, war_aus = abdruck
        screen.draw.filled_circle((x, y), 5, ROT if war_aus else (200, 230, 200))

    landepunkt_malen()
    figur_malen(spieler, BLAU, "Du")
    figur_malen(computer, ROT, "Computer")

    if linie_aktiv:
        richtungslinie_malen()
        kraftbalken_malen()
    if ball:
        ball_malen()

    if meldung:
        screen.draw.text(meldung, center=(WIDTH / 2, 260), fontsize=50, color=GELB,
                         owidth=1.5, ocolor="black", align="center")

    if zustand == "ende":
        if spiele[0] > spiele[1]:
            sieger = "Du gewinnst den Satz!"
        else:
            sieger = "Der Computer gewinnt den Satz!"
        screen.draw.filled_rect(Rect(200, 200, WIDTH - 400, 220), (20, 60, 30))
        screen.draw.text(sieger, center=(WIDTH / 2, 250), fontsize=56, color=GELB)
        screen.draw.text(str(spiele[0]) + " : " + str(spiele[1]), center=(WIDTH / 2, 310),
                         fontsize=50, color=WEISS)
        screen.draw.text("Leertaste = nochmal     1 / 2 / 3 = andere Stufe     E = Einstellungen",
                         center=(WIDTH / 2, 380), fontsize=26, color=WEISS)


pgzrun.go()
