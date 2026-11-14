# Unser Tennisspiel - Schritt 1: Das Spielfeld
# Alles, was hinter einem # steht, ist ein Kommentar.
# Der Computer ignoriert das - es ist nur für uns Menschen!

import pgzrun

# So groß ist unser Fenster (in Pixeln)
WIDTH = 800    # Breite
HEIGHT = 500   # Höhe

TITLE = "Unser Tennisspiel"


# draw() wird ganz oft pro Sekunde aufgerufen
# und malt alles neu auf den Bildschirm.
def draw():
    # Den ganzen Bildschirm grün anmalen (wie ein Tennisplatz)
    # Farben bestehen aus Rot, Grün und Blau - jeweils 0 bis 255
    screen.fill((0, 0, 139))

    # Eine weiße Linie in der Mitte (das Netz)
    # Von Punkt (x, y) oben bis Punkt (x, y) unten
    screen.draw.line((400, 0), (400, 500), "white")
    screen.draw.line((0, 70), (800, 70), "white")
    screen.draw.line((0, 430), (800, 430), "white")

    # Ein Text oben in der Mitte
    screen.draw.text("----Powershot----", center=(400, 30), fontsize=100, color="red")


pgzrun.go()
