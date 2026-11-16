// Powershot – die Funkverbindung zwischen zwei Geräten.
//
// Damit wird ein iPhone zum Schläger für das Spiel auf dem iPad (oder auf einem anderen iPhone):
//   • Das Gerät mit dem Spiel sagt in die Runde: "Hier läuft Powershot!"
//   • Das Gerät im Schläger-Modus sucht danach und verbindet sich von selbst.
//   • Dann schickt der Schläger 60-mal pro Sekunde, wie er bewegt wird und welche Taste gedrückt ist.
// Das geht über WLAN oder Bluetooth, ganz ohne Internet (Apples "Multipeer Connectivity").

import Foundation
import MultipeerConnectivity
import UIKit

final class Funk: NSObject, ObservableObject {
    static let shared = Funk()

    /// Name des verbundenen Geräts – oder nil, wenn keines verbunden ist
    @Published var partner: String?

    private let ich = MCPeerID(displayName: UIDevice.current.name)
    private let dienst = "powershot"
    private lazy var sitzung: MCSession = neueSitzung()

    /// Eine frische Verbindung. Nach einem Abbruch nehmen wir immer eine neue – die alte lässt sich nicht gut wiederverwenden.
    private func neueSitzung() -> MCSession {
        let s = MCSession(peer: ich, securityIdentity: nil, encryptionPreference: .required)
        s.delegate = self
        return s
    }
    private lazy var rufer = MCNearbyServiceAdvertiser(peer: ich, discoveryInfo: nil, serviceType: dienst)
    private lazy var sucher = MCNearbyServiceBrowser(peer: ich, serviceType: dienst)

    // Das Letzte, was der Schläger geschickt hat, und wann
    private var letzte: [String: Any] = [:]
    private var letzteZeit = Date.distantPast
    private let schloss = NSLock()
    // (Schläger) Welches Spiel-Gerät haben wir gerade eingeladen? Jedes nur einmal, sonst kommt die Verbindung durcheinander.
    private var eingeladen: MCPeerID?

    /// Dieses Gerät zeigt das Spiel: auf einen Schläger warten.
    func alsSpielStarten() {
        sucher.stopBrowsingForPeers()
        rufer.delegate = self
        rufer.startAdvertisingPeer()
    }

    /// Dieses Gerät ist der Schläger: ein Spiel in der Nähe suchen.
    func alsSchlaegerStarten() {
        rufer.stopAdvertisingPeer()
        sitzung.disconnect()
        sitzung = neueSitzung()
        eingeladen = nil
        sucher.delegate = self
        sucher.startBrowsingForPeers()
    }

    /// Schläger-Modus beenden, wieder normales Spiel-Gerät sein.
    func schlaegerBeenden() {
        sitzung.disconnect()
        sitzung = neueSitzung()
        alsSpielStarten()
    }

    /// (Schläger) Den aktuellen Zustand an das Spiel schicken.
    func schicken(_ zustand: [String: Any]) {
        guard !sitzung.connectedPeers.isEmpty,
              let daten = try? JSONSerialization.data(withJSONObject: zustand) else { return }
        // "unreliable" = schnell statt sicher: Geht ein Päckchen verloren, kommt gleich das nächste.
        try? sitzung.send(daten, toPeers: sitzung.connectedPeers, with: .unreliable)
    }

    /// (Spiel) Was hat der Schläger zuletzt gemeldet? nil, wenn seit einer halben Sekunde nichts kam.
    func vomSchlaeger() -> [String: Any]? {
        schloss.lock(); defer { schloss.unlock() }
        return Date().timeIntervalSince(letzteZeit) < 0.5 ? letzte : nil
    }
}

extension Funk: MCSessionDelegate {
    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            guard session === self.sitzung else { return }       // Meldungen einer alten Verbindung überhören
            self.partner = session.connectedPeers.first?.displayName
            // Hat es nicht geklappt oder ist die Verbindung weg? Dann mit frischer Verbindung von vorn anfangen.
            guard state == .notConnected, session.connectedPeers.isEmpty else { return }
            self.sitzung = self.neueSitzung()
            self.eingeladen = nil
            if Spiel.shared.schlaegerModus {                     // Schläger: neu suchen
                self.sucher.stopBrowsingForPeers()
                self.sucher.startBrowsingForPeers()
            } else {                                             // Spiel: wieder auf einen Schläger warten
                self.rufer.stopAdvertisingPeer()
                self.rufer.startAdvertisingPeer()
            }
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let zustand = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        schloss.lock()
        letzte = zustand
        letzteZeit = Date()
        schloss.unlock()
    }

    // Diese drei braucht Apple, wir benutzen sie nicht.
    func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

extension Funk: MCNearbyServiceAdvertiserDelegate {
    // (Spiel) Ein Schläger will sich verbinden: annehmen, wenn noch keiner da ist.
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                    withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        invitationHandler(sitzung.connectedPeers.isEmpty, sitzung)
    }
}

extension Funk: MCNearbyServiceBrowserDelegate {
    // (Schläger) Ein Spiel gefunden: verbinden.
    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        guard sitzung.connectedPeers.isEmpty, eingeladen == nil else { return }
        eingeladen = peerID
        browser.invitePeer(peerID, to: sitzung, withContext: nil, timeout: 15)
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        if peerID == eingeladen { eingeladen = nil }
    }
}
