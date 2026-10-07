import ActivityKit
import Foundation

/**
 * EL RELOJ DEL TICKET COMO ACTIVIDAD EN VIVO (Fernando, 2026-10-07).
 *
 * Este archivo se compila en la app Y en la extensión del widget: los dos tienen que hablar
 * del mismo tipo. El reloj vive en el servidor (`ticket_actions.timer_started_at`); aquí solo
 * viaja la hora desde la que contar (`inicio`, ya con lo acumulado restado) y el sistema
 * dibuja el cronómetro solo, sin que la app corra.
 */
struct RelojAtributos: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// Desde cuándo cuenta el reloj.
        var inicio: Date
        /// Detenido aquí y aún sin llegar al servidor (sin conexión): el reloj se congela.
        var detenidoEn: Date?
    }

    var registroId: Int
    var ticketId: Int
    var titulo: String
    var cliente: String
    var registro: String
    var tarifa: Double
}

enum FormatoReloj {
    /// `$15,00/h` — miles «.» y decimales «,», como `lib/format.ts`.
    static func tarifa(_ v: Double) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "es_ES")
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        f.usesGroupingSeparator = true
        return "$" + (f.string(from: NSNumber(value: v)) ?? String(format: "%.2f", v)) + "/h"
    }

    /// «1:05:09» para un reloj ya detenido.
    static func duracion(desde: Date, hasta: Date) -> String {
        let s = max(0, Int(hasta.timeIntervalSince(desde)))
        return String(format: "%d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}
