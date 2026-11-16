// Powershot – die Brücke zwischen einem Spiele-Controller und dem Spiel.
//
// iOS kennt Switch-Controller (Joy-Con, Pro Controller) von Haus aus: Man koppelt sie in den
// Einstellungen unter Bluetooth. Diese Datei fragt 60-mal pro Sekunde ab, was der Controller gerade
// macht (Stick, Tasten, Bewegung), und schickt das als kleine Nachricht an das Spiel.
// Im Spiel kommt die Nachricht in js/controls.js bei setPad(...) an.

import CoreMotion
import GameController
import QuartzCore
import UIKit
import WebKit

final class ControllerBruecke: NSObject {
    private weak var web: WKWebView?
    private var takt: CADisplayLink?
    private var warVerbunden = false
    // Falls der Controller Erdanziehung und Handbewegung nicht getrennt meldet, schätzen wir "unten" selbst.
    private var unten = (x: 0.0, y: -1.0, z: 0.0)
    // Die Bewegungssensoren des iPhones/iPads selbst. Damit wird das Gerät zum Schläger,
    // wenn kein Controller da ist oder der Controller (wie der Joy-Con unter iOS) keine Bewegung meldet.
    private static let geraet = CMMotionManager()

    init(web: WKWebView) {
        self.web = web
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(neuerController(_:)),
                                               name: .GCControllerDidConnect, object: nil)
        GCController.controllers().forEach(einschalten)
        if Self.geraet.isDeviceMotionAvailable {
            Self.geraet.deviceMotionUpdateInterval = 1.0 / 60.0
            Self.geraet.startDeviceMotionUpdates()
        }
        UIApplication.shared.isIdleTimerDisabled = true      // der Bildschirm soll beim Spielen nicht ausgehen
        let takt = CADisplayLink(target: self, selector: #selector(senden))
        takt.preferredFramesPerSecond = 60
        takt.add(to: .main, forMode: .common)
        self.takt = takt
    }

    deinit { takt?.invalidate() }

    /// Die Bewegung des Geräts selbst, in derselben Form wie die eines Controllers.
    static func geraeteBewegung() -> [String: Double]? {
        guard let m = geraet.deviceMotion else { return nil }
        return ["ax": m.userAcceleration.x, "ay": m.userAcceleration.y, "az": m.userAcceleration.z,
                "gx": m.gravity.x, "gy": m.gravity.y, "gz": m.gravity.z]
    }

    @objc private func neuerController(_ meldung: Notification) {
        if let c = meldung.object as? GCController { einschalten(c) }
    }

    // Die Bewegungs-Sensoren sind bei manchen Controllern aus, bis man sie einschaltet (spart Strom).
    private func einschalten(_ c: GCController) {
        if let bewegung = c.motion, bewegung.sensorsRequireManualActivation { bewegung.sensorsActive = true }
    }

    @objc private func senden() {
        guard let web else { return }
        // Ist ein iPhone als Schläger verbunden? Dann zählt, was es schickt (Schwung, Ziel, Tasten).
        if let fern = Funk.shared.vomSchlaeger() {
            warVerbunden = true
            var nachricht = fern
            nachricht["name"] = "Schläger: \(Funk.shared.partner ?? "iPhone")"
            nachricht["lx"] = 0
            nachricht["ly"] = 0
            schicken(nachricht, an: web)
            return
        }
        // Den Controller nehmen, der zuletzt benutzt wurde (oder irgendeinen verbundenen).
        guard let c = GCController.current ?? GCController.controllers().first else {
            // Kein Controller: Dann ist das Gerät selbst der Schläger (nur Schwingen, keine Tasten).
            if let bewegung = Self.geraeteBewegung() {
                let name = UIDevice.current.userInterfaceIdiom == .phone ? "iPhone als Schläger" : "iPad als Schläger"
                schicken(["name": name, "lx": 0, "ly": 0, "motion": bewegung], an: web)
            } else if warVerbunden {
                warVerbunden = false
                web.evaluateJavaScript("window.__powershotPadWeg && window.__powershotPadWeg()")
            }
            return
        }
        warVerbunden = true
        let eingabe = c.physicalInputProfile

        // Stick: der linke, sonst der rechte, sonst das Steuerkreuz (ein einzelner Joy-Con hat nur eines davon).
        let stick = eingabe.dpads[GCInputLeftThumbstick] ?? eingabe.dpads[GCInputRightThumbstick]
            ?? eingabe.dpads[GCInputDirectionPad]
        func taste(_ namen: String...) -> Bool { namen.contains { eingabe.buttons[$0]?.isPressed == true } }

        var nachricht: [String: Any] = [
            "name": c.vendorName ?? "Controller",
            "lx": Double(stick?.xAxis.value ?? 0),
            "ly": Double(stick?.yAxis.value ?? 0),
            // Die Schultertasten schlagen auch – praktisch, wenn man den Joy-Con wie einen Griff hält.
            "a": taste(GCInputButtonA, GCInputRightShoulder, GCInputRightTrigger, GCInputLeftShoulder, GCInputLeftTrigger),
            "b": taste(GCInputButtonB),
            "x": taste(GCInputButtonX),
            "y": taste(GCInputButtonY),
            "pause": taste(GCInputButtonMenu, GCInputButtonOptions),
        ]

        if let m = c.motion {
            var hand = (x: 0.0, y: 0.0, z: 0.0)
            if m.hasGravityAndUserAcceleration {
                hand = (m.userAcceleration.x, m.userAcceleration.y, m.userAcceleration.z)
                unten = (m.gravity.x, m.gravity.y, m.gravity.z)
            } else {
                // Nur ein Gesamtwert: "unten" ist der langsame Durchschnitt, der Rest ist die Handbewegung.
                let a = m.acceleration
                unten = (unten.x * 0.95 + a.x * 0.05, unten.y * 0.95 + a.y * 0.05, unten.z * 0.95 + a.z * 0.05)
                hand = (a.x - unten.x, a.y - unten.y, a.z - unten.z)
            }
            let laenge = max(0.001, (unten.x * unten.x + unten.y * unten.y + unten.z * unten.z).squareRoot())
            nachricht["motion"] = ["ax": hand.x, "ay": hand.y, "az": hand.z,
                                   "gx": unten.x / laenge, "gy": unten.y / laenge, "gz": unten.z / laenge]
        }

        // Meldet der Controller keine Bewegung (Joy-Con unter iOS), nehmen wir die des Geräts:
        // Controller in der einen Hand für die Tasten, iPhone in der anderen als Schläger.
        if nachricht["motion"] == nil, let bewegung = Self.geraeteBewegung() {
            nachricht["motion"] = bewegung
            nachricht["name"] = "\(c.vendorName ?? "Controller") + Gerät als Schläger"
        }
        schicken(nachricht, an: web)
    }

    private func schicken(_ nachricht: [String: Any], an web: WKWebView) {
        var nachricht = nachricht
        // Hat die Apple Watch gerade einen Schwung gemeldet? Dann kommt er mit.
        if nachricht["schwung"] == nil, let schwung = Uhr.shared.aktuell() { nachricht["schwung"] = schwung }
        guard let daten = try? JSONSerialization.data(withJSONObject: nachricht),
              let text = String(data: daten, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.__powershotPad && window.__powershotPad(\(text))")
    }
}
