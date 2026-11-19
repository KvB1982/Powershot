// Powershot – der Schläger-Bildschirm.
//
// Diesen Bildschirm zeigt das iPhone, wenn es als Schläger für ein anderes Gerät benutzt wird.
// Schwingen = Schlag. Die Richtung kommt vom Timing: früh = links, spät = rechts.
// Unten gibt es Tasten für die besonderen Schläge – und "Schlag", falls man nicht schwingen möchte.

import Combine
import MultipeerConnectivity
import SwiftUI

struct SchlaegerView: View {
    @ObservedObject private var funk = Funk.shared
    @ObservedObject private var uhr = Uhr.shared
    @State private var uhrZustand = ""                  // zum Fehlersuchen: Stand der Verbindung zur Uhr
    private let version = "\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] ?? "?") (\(Bundle.main.infoDictionary?["CFBundleVersion"] ?? "?"))"
    private let sekunde = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    @State private var tasten: Set<String> = []         // gerade gedrückte Tasten: "a", "b", "x", "y"
    private let takt = Timer.publish(every: 1.0 / 60.0, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text(funk.partner.map { "🎾 Verbunden mit \($0)" } ?? "🔎 Suche ein Gerät, auf dem Powershot läuft …")
                    .font(.headline)
                Spacer()
                Button("Beenden") { Spiel.shared.schlaegerModus = false }
                    .buttonStyle(.bordered)
            }

            // Gibt es mehrere Geräte mit Powershot in der Nähe? Dann das richtige antippen.
            if funk.gefunden.count > 1 || (funk.partner == nil && !funk.gefunden.isEmpty) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        Text("Spiel auf:").font(.footnote).foregroundStyle(.secondary)
                        ForEach(funk.gefunden, id: \.self) { geraet in
                            Button(geraet.displayName) { funk.verbinden(mit: geraet, gewaehlt: true) }
                                .buttonStyle(.borderedProminent)
                                .tint(geraet.displayName == funk.partner ? Color(red: 0.91, green: 0.94, blue: 0.29) : Color.white.opacity(0.2))
                                .foregroundStyle(geraet.displayName == funk.partner ? .black : .white)
                        }
                    }
                }
            }

            // Erklärung in der Mitte (die Richtung kommt vom Timing, nicht vom Finger)
            ZStack {
                RoundedRectangle(cornerRadius: 18).fill(Color.white.opacity(0.08))
                Text("iPhone oder Apple Watch schwingen = Schlag\nfrüh = nach links · spät = nach rechts\nAufschlag und Smash: von oben nach unten")
                    .multilineTextAlignment(.center)
                    .font(.title3)
            }

            HStack(spacing: 12) {
                Text(uhr.anzeige).font(.footnote).foregroundStyle(.secondary)
                // Aufgenommene Schlag-Serien von der Uhr weitergeben (AirDrop, „In Dateien sichern“ …)
                if !uhr.aufnahmen.isEmpty {
                    ShareLink(items: uhr.aufnahmen) { Text("📁 \(uhr.aufnahmen.count) Aufnahmen teilen").font(.footnote) }
                } else {
                    Text("Aufnehmen: auf der Uhr „⏺ Schläge aufnehmen“ antippen").font(.footnote).foregroundStyle(.secondary)
                }
            }
            Text("\(uhrZustand) · App-Version \(version)").font(.caption2).foregroundStyle(.secondary)

            HStack(spacing: 10) {
                taste("Schlag", "a"); taste("Slice", "b"); taste("Lob", "x"); taste("Stopp", "y"); taste("Netz ⇄", "netz")
            }
            .frame(height: 64)
        }
        .padding()
        .foregroundStyle(.white)
        .background(Color(red: 0.043, green: 0.063, blue: 0.125).ignoresSafeArea())
        .onAppear { Funk.shared.alsSchlaegerStarten() }
        .onDisappear { Funk.shared.schlaegerBeenden() }
        .onReceive(takt) { _ in senden() }
        .onReceive(sekunde) { _ in uhrZustand = Uhr.shared.zustand() }
    }

    // Eine Taste, die "gedrückt" meldet, solange der Finger darauf liegt
    private func taste(_ text: String, _ name: String) -> some View {
        Text(text)
            .font(.title3.bold())
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(RoundedRectangle(cornerRadius: 14)
                .fill(tasten.contains(name) ? Color(red: 0.91, green: 0.94, blue: 0.29) : Color.white.opacity(0.15)))
            .foregroundStyle(tasten.contains(name) ? .black : .white)
            .gesture(DragGesture(minimumDistance: 0)
                .onChanged { _ in tasten.insert(name) }
                .onEnded { _ in tasten.remove(name) })
    }

    // 60-mal pro Sekunde: Bewegung und Tasten an das Spiel schicken
    private func senden() {
        var zustand: [String: Any] = [:]
        for name in tasten { zustand[name] = true }
        if let bewegung = ControllerBruecke.geraeteBewegung() { zustand["motion"] = bewegung }
        if let schwung = Uhr.shared.aktuell() { zustand["schwung"] = schwung }      // Schwung von der Apple Watch
        if let geste = Uhr.shared.geste() { zustand["geste"] = geste }               // Doppelklopfen von der Apple Watch
        Funk.shared.schicken(zustand)
    }
}
