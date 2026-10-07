import ActivityKit
import Foundation

/**
 * Escucha los tokens de push de las Actividades en Vivo y se los da al servidor
 * (Fernando, 2026-10-07):
 *
 *  · El token de ARRANQUE (`pushToStartTokenUpdates`): con él el servidor abre el reloj en el
 *    iPhone cuando se inicia en el computador, con la app cerrada.
 *  · El token de CADA actividad (`pushTokenUpdates`): con él el servidor la termina al
 *    detener el reloj en otro sitio.
 *
 * Se arranca en `AppDelegate` y no en el plugin: cuando una push abre un reloj con la app
 * cerrada, iOS despierta la app EN SEGUNDO PLANO para darle el token de la nueva actividad, y
 * en ese arranque no se crea la vista (ni el plugin).
 *
 * Si el reloj se inició desde el propio iPhone con la app abierta, la app abre su actividad
 * y la push abre otra: aquí se queda la primera y se cierra la repetida.
 */
enum ObservadorRelojes {
    private static var observadas = Set<String>()
    private static var tokenArranque: String?
    private static let cola = DispatchQueue(label: "org.grupocc.gccworld.relojes")

    static func iniciar() {
        Task {
            for await datos in Activity<RelojAtributos>.pushToStartTokenUpdates {
                let t = hex(datos)
                cola.sync { tokenArranque = t }
                await ServidorReloj.registrarToken(tipo: "apns_live_start", token: t)
            }
        }
        Task {
            for await actividad in Activity<RelojAtributos>.activityUpdates {
                await observar(actividad)
            }
        }
        Task { for a in Activity<RelojAtributos>.activities { await observar(a) } }
    }

    /// Tras guardar la sesión (la página sincronizó): se vuelven a mandar los tokens, por si
    /// llegaron antes de que hubiera sesión. El servidor los guarda sin duplicar.
    static func reintentar() async {
        if let t = cola.sync(execute: { tokenArranque }) {
            await ServidorReloj.registrarToken(tipo: "apns_live_start", token: t)
        }
        for a in Activity<RelojAtributos>.activities {
            if let d = a.pushToken {
                await ServidorReloj.registrarToken(tipo: "apns_live_update", token: hex(d), registroId: a.attributes.registroId)
            }
        }
    }

    private static func observar(_ a: Activity<RelojAtributos>) async {
        let nueva = cola.sync { observadas.insert(a.id).inserted }
        guard nueva else { return }
        // ¿Repetida? Se queda la más antigua (la primera de la lista con ese registro).
        let mismas = Activity<RelojAtributos>.activities.filter { $0.attributes.registroId == a.attributes.registroId }
        if mismas.count > 1, mismas.first?.id != a.id {
            await a.end(nil, dismissalPolicy: .immediate)
            return
        }
        Task {
            for await datos in a.pushTokenUpdates {
                await ServidorReloj.registrarToken(tipo: "apns_live_update", token: hex(datos), registroId: a.attributes.registroId)
            }
        }
    }

    private static func hex(_ d: Data) -> String { d.map { String(format: "%02x", $0) }.joined() }
}
