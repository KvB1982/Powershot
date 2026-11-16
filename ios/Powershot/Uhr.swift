// Powershot – die Verbindung zur Apple Watch.
//
// Die Uhr erkennt den Schwung selbst (siehe PowershotWatch/Schlaeger.swift) und schickt eine kleine
// Nachricht hierher. Diese Datei merkt sich den letzten Schwung, damit er ans Spiel weitergegeben werden kann.

import Foundation
import WatchConnectivity

final class Uhr: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = Uhr()

    /// Für die Anzeige auf dem Schläger-Bildschirm: Was kam zuletzt von der Uhr an?
    @Published var anzeige = "⌚ Noch kein Schwung von der Apple Watch"
    private var empfangen = 0

    private var letzter: [String: Any]?
    private let schloss = NSLock()

    func starten() {
        guard WCSession.isSupported() else { return }      // ein iPad hat keine Uhr
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    /// Der letzte Schwung von der Uhr – aber nur, wenn er höchstens zwei Sekunden alt ist.
    /// "alter" sagt dem Spiel, wie viele Sekunden der Schwung schon her ist (wichtig fürs Timing).
    func aktuell() -> [String: Any]? {
        schloss.lock(); defer { schloss.unlock() }
        guard let s = letzter, let zeit = s["zeit"] as? Double else { return nil }
        let alter = Date().timeIntervalSince1970 - zeit
        guard alter < 2.0 else { return nil }
        return ["id": s["schwung"] ?? 0, "kraft": s["kraft"] ?? 0.5, "hoch": s["hoch"] ?? 0,
                "alter": min(0.5, max(0, alter))]
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard message["schwung"] != nil else { return }
        schloss.lock()
        letzter = message
        schloss.unlock()
        let unterwegs = Date().timeIntervalSince1970 - (message["zeit"] as? Double ?? 0)
        let kraft = Int(((message["kraft"] as? Double) ?? 0) * 100)
        DispatchQueue.main.async {
            self.empfangen += 1
            self.anzeige = "⌚ Schwung \(self.empfangen) von der Uhr · Kraft \(kraft) % · \(Int(unterwegs * 1000)) ms unterwegs"
        }
    }

    // Diese drei braucht Apple, wir benutzen sie nicht.
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
