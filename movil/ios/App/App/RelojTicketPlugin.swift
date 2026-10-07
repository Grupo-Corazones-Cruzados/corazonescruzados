import ActivityKit
import Capacitor
import Foundation
import WebKit

/**
 * El puente con la página (`lib/movil/reloj-nativo.ts`), igual que en Android: la página le
 * pasa la lista de relojes en marcha que le dio el servidor y aquí se arranca, actualiza o
 * termina la Actividad en Vivo de cada uno. La lista manda: lo que no viene se termina.
 */
@objc(RelojTicketPlugin)
public class RelojTicketPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RelojTicketPlugin"
    public let jsName = "RelojTicket"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sincronizar", returnType: CAPPluginReturnPromise),
    ]

    @objc func sincronizar(_ call: CAPPluginCall) {
        let lista = (call.getArray("relojes") as? [[String: Any]]) ?? []
        guardarSesion {
            Task {
                // 1) Las paradas hechas sin conexión salen primero; esos relojes no se vuelven
                //    a enseñar con esta lista, que se pidió antes de que el servidor las supiera.
                let pendientes = ServidorReloj.pendientes()
                var quedan: [ServidorReloj.Pendiente] = []
                for p in pendientes {
                    if case .sinRed = await ServidorReloj.detener(ticketId: p.ticketId, registroId: p.registroId, en: p.en) {
                        quedan.append(p)
                    }
                }
                ServidorReloj.guardarPendientes(quedan)
                let excluir = Set(pendientes.map(\.registroId))
                await Self.aplicar(lista, excluyendo: excluir, congelados: Set(quedan.map(\.registroId)))
                call.resolve(["permitido": ActivityAuthorizationInfo().areActivitiesEnabled])
            }
        }
    }

    /// Copia la cookie de sesión del WebView al llavero, para el botón «Detener».
    private func guardarSesion(_ hecho: @escaping () -> Void) {
        DispatchQueue.main.async {
            WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
                if let c = cookies.first(where: { $0.name == "auth_token" && ServidorReloj.base.host?.hasSuffix($0.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))) == true }) {
                    ServidorReloj.guardarSesion(c.value)
                }
                hecho()
            }
        }
    }

    private static func fecha(_ texto: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: texto) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: texto)
    }

    private static func aplicar(_ lista: [[String: Any]], excluyendo: Set<Int>, congelados: Set<Int>) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        var vistos = Set<Int>()
        for r in lista {
            guard let registroId = (r["registroId"] as? NSNumber)?.intValue,
                  let ticketId = (r["ticketId"] as? NSNumber)?.intValue,
                  let inicio = fecha(r["inicio"] as? String ?? ""),
                  !excluyendo.contains(registroId) else { continue }
            vistos.insert(registroId)
            let estado = RelojAtributos.ContentState(inicio: inicio, detenidoEn: nil)
            if let a = Activity<RelojAtributos>.activities.first(where: { $0.attributes.registroId == registroId }) {
                if a.content.state != estado { await a.update(ActivityContent(state: estado, staleDate: nil)) }
                continue
            }
            let atributos = RelojAtributos(
                registroId: registroId, ticketId: ticketId,
                titulo: r["titulo"] as? String ?? "Ticket #\(ticketId)",
                cliente: r["cliente"] as? String ?? "",
                registro: r["registro"] as? String ?? "",
                tarifa: (r["tarifa"] as? NSNumber)?.doubleValue ?? 0)
            _ = try? Activity.request(attributes: atributos, content: ActivityContent(state: estado, staleDate: nil), pushType: nil)
        }
        for a in Activity<RelojAtributos>.activities
        where !vistos.contains(a.attributes.registroId) && !congelados.contains(a.attributes.registroId) {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }
}
