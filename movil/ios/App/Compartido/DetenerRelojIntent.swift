import ActivityKit
import AppIntents
import Foundation

/**
 * El botón «Detener» de la Actividad en Vivo. Como `LiveActivityIntent`, iOS lo ejecuta en el
 * proceso de la APP (aunque esté cerrada), no en el del widget: por eso puede usar la sesión
 * guardada y la red. Se compila en los dos objetivos porque el widget tiene que nombrarlo.
 */
struct DetenerRelojIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Detener el reloj"
    static var isDiscoverable = false

    @Parameter(title: "Registro") var registroId: Int
    @Parameter(title: "Ticket") var ticketId: Int

    init() {}
    init(registroId: Int, ticketId: Int) {
        self.registroId = registroId
        self.ticketId = ticketId
    }

    func perform() async throws -> some IntentResult {
        let ahora = Date()
        let actividad = Activity<RelojAtributos>.activities.first { $0.attributes.registroId == registroId }
        switch await ServidorReloj.detener(ticketId: ticketId, registroId: registroId, en: ahora) {
        case .hecho, .rechazado:
            await actividad?.end(nil, dismissalPolicy: .immediate)
        case .sinRed:
            // Se congela en lo trabajado y se envía al volver la conexión.
            var lista = ServidorReloj.pendientes().filter { $0.registroId != registroId }
            lista.append(.init(ticketId: ticketId, registroId: registroId, en: ahora))
            ServidorReloj.guardarPendientes(lista)
            if let a = actividad {
                var estado = a.content.state
                estado.detenidoEn = ahora
                await a.update(ActivityContent(state: estado, staleDate: nil))
            }
        }
        return .result()
    }
}
