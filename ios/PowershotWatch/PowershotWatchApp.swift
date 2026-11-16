// Powershot – die App auf der Apple Watch.
//
// Die Uhr am Handgelenk ist der Schläger: Sie merkt, wenn du schwingst, und meldet das dem iPhone.
// Das iPhone gibt es an das Spiel weiter (auf dem iPhone selbst oder auf dem iPad).

import SwiftUI

@main
struct PowershotWatchApp: App {
    @StateObject private var schlaeger = Schlaeger()

    var body: some Scene {
        WindowGroup {
            VStack(spacing: 6) {
                if schlaeger.laeuft {
                    Text("🎾 Schwingen!").font(.headline)
                    Text("Schläge: \(schlaeger.anzahl)")
                    Text(schlaeger.erreichbar ? "iPhone verbunden" : "iPhone nicht erreichbar")
                        .font(.footnote)
                        .foregroundStyle(schlaeger.erreichbar ? .green : .orange)
                    Button("Stopp") { schlaeger.stoppen() }
                } else {
                    Text("Powershot").font(.headline)
                    Text("Uhr als Schläger").font(.footnote).foregroundStyle(.secondary)
                    Button("Start") { schlaeger.starten() }
                        .tint(.yellow)
                }
                if let fehler = schlaeger.fehler {
                    Text(fehler).font(.footnote).foregroundStyle(.red)
                }
            }
            .padding()
        }
    }
}
