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
        #if DEBUG
        // Nur zum Testen im Simulator (Start mit "-testSchwung"): alle 3 Sekunden so tun, als hätte die Uhr geschwungen.
        if ProcessInfo.processInfo.arguments.contains("-testSchwung") {
            var nummer = 0
            Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { _ in
                nummer += 1
                self.angekommen(["schwung": 5000 + nummer, "kraft": 0.7, "hoch": -0.8,
                                 "zeit": Date().timeIntervalSince1970 - 0.08])
            }
        }
        #endif
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

    // Nachrichten kommen auf drei Wegen an: mit Antwort, ohne Antwort oder als nachgeschicktes Päckchen.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        angekommen(message)
        replyHandler(["ok": true])
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { angekommen(message) }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) { angekommen(userInfo) }

    private func angekommen(_ message: [String: Any]) {
        if message["test"] != nil {
            DispatchQueue.main.async { self.anzeige = "⌚ Test-Nachricht von der Uhr ist angekommen" }
            return
        }
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

    /// Zum Fehlersuchen: Wie steht es um die Verbindung zur Uhr?
    func zustand() -> String {
        guard WCSession.isSupported() else { return "Dieses Gerät kann keine Uhr koppeln" }
        let s = WCSession.default
        let bereit = s.activationState == .activated
        return "Funk \(bereit ? "bereit" : "NICHT bereit") · Uhr \(s.isPaired ? "gekoppelt" : "NICHT gekoppelt") · "
            + "Watch-App \(s.isWatchAppInstalled ? "installiert" : "FEHLT") · \(s.isReachable ? "erreichbar" : "nicht erreichbar")"
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        if let error { DispatchQueue.main.async { self.anzeige = "⌚ Fehler beim Start: \(error.localizedDescription)" } }
    }
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
