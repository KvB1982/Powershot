// Powershot – der Schläger-Bildschirm.
//
// Diesen Bildschirm zeigt das iPhone, wenn es als Schläger für ein anderes Gerät benutzt wird.
// Schwingen = Schlag. Die große Fläche ist zum Zielen (Daumen links, Mitte oder rechts halten).
// Unten gibt es Tasten für die besonderen Schläge – und "Schlag", falls man nicht schwingen möchte.

import Combine
import SwiftUI

struct SchlaegerView: View {
    @ObservedObject private var funk = Funk.shared
    @State private var ziel = 0.0                       // -1 = links, 0 = Mitte, +1 = rechts
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

            // Fläche zum Zielen
            GeometryReader { flaeche in
                ZStack {
                    RoundedRectangle(cornerRadius: 18).fill(Color.white.opacity(0.08))
                    Text(ziel < -0.3 ? "⬅︎ links" : ziel > 0.3 ? "rechts ➡︎" : "Daumen hier halten zum Zielen\nSchwingen = Schlag")
                        .multilineTextAlignment(.center)
                        .font(.title3)
                }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0)
                    .onChanged { finger in
                        ziel = min(1, max(-1, (finger.location.x / flaeche.size.width - 0.5) * 2.4))
                    }
                    .onEnded { _ in ziel = 0 })
            }

            HStack(spacing: 10) {
                taste("Schlag", "a"); taste("Slice", "b"); taste("Lob", "x"); taste("Stopp", "y")
            }
            .frame(height: 64)
        }
        .padding()
        .foregroundStyle(.white)
        .background(Color(red: 0.043, green: 0.063, blue: 0.125).ignoresSafeArea())
        .onAppear { Funk.shared.alsSchlaegerStarten() }
        .onDisappear { Funk.shared.schlaegerBeenden() }
        .onReceive(takt) { _ in senden() }
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

    // 60-mal pro Sekunde: Bewegung, Ziel und Tasten an das Spiel schicken
    private func senden() {
        var zustand: [String: Any] = ["ziel": ziel]
        for name in tasten { zustand[name] = true }
        if let bewegung = ControllerBruecke.geraeteBewegung() { zustand["motion"] = bewegung }
        Funk.shared.schicken(zustand)
    }
}
