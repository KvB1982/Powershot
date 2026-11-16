// Powershot – die Brücke zwischen einem Spiele-Controller und dem Spiel.
//
// iOS kennt Switch-Controller (Joy-Con, Pro Controller) von Haus aus: Man koppelt sie in den
// Einstellungen unter Bluetooth. Diese Datei fragt 60-mal pro Sekunde ab, was der Controller gerade
// macht (Stick, Tasten, Bewegung), und schickt das als kleine Nachricht an das Spiel.
// Im Spiel kommt die Nachricht in js/controls.js bei setPad(...) an.

import GameController
import QuartzCore
import WebKit

final class ControllerBruecke: NSObject {
    private weak var web: WKWebView?
    private var takt: CADisplayLink?
    private var warVerbunden = false
    // Falls der Controller Erdanziehung und Handbewegung nicht getrennt meldet, schätzen wir "unten" selbst.
    private var unten = (x: 0.0, y: -1.0, z: 0.0)

    init(web: WKWebView) {
        self.web = web
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(neuerController(_:)),
                                               name: .GCControllerDidConnect, object: nil)
        GCController.controllers().forEach(einschalten)
        let takt = CADisplayLink(target: self, selector: #selector(senden))
        takt.preferredFramesPerSecond = 60
        takt.add(to: .main, forMode: .common)
        self.takt = takt
    }

    deinit { takt?.invalidate() }

    @objc private func neuerController(_ meldung: Notification) {
        if let c = meldung.object as? GCController { einschalten(c) }
    }

    // Die Bewegungs-Sensoren sind bei manchen Controllern aus, bis man sie einschaltet (spart Strom).
    private func einschalten(_ c: GCController) {
        if let bewegung = c.motion, bewegung.sensorsRequireManualActivation { bewegung.sensorsActive = true }
    }

    @objc private func senden() {
        guard let web else { return }
        // Den Controller nehmen, der zuletzt benutzt wurde (oder irgendeinen verbundenen).
        guard let c = GCController.current ?? GCController.controllers().first else {
            if warVerbunden {
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

        guard let daten = try? JSONSerialization.data(withJSONObject: nachricht),
              let text = String(data: daten, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.__powershotPad && window.__powershotPad(\(text))")
    }
}
