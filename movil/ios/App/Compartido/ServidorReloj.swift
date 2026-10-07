import Foundation
import Security

/**
 * Lo que el teléfono hace con el servidor SIN la página: el botón «Detener» de la Actividad
 * en Vivo. Va con la MISMA sesión que la página (la cookie `auth_token`), que el plugin copia
 * al llavero del sistema cada vez que la página sincroniza. No hay un segundo tipo de sesión.
 *
 * Una parada sin conexión se guarda con la hora en que se pulsó y se envía en la siguiente
 * sincronización (`en`): se cobra lo trabajado, no lo que tardó en volver la red.
 */
enum ServidorReloj {
    static let base = URL(string: "https://app.grupocc.org")!
    private static let servicio = "org.grupocc.gccworld.sesion"
    private static let clavePendientes = "relojes.pendientes"

    // MARK: Sesión en el llavero

    static func guardarSesion(_ valor: String) {
        let consulta: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                       kSecAttrService as String: servicio]
        SecItemDelete(consulta as CFDictionary)
        var alta = consulta
        alta[kSecValueData as String] = Data(valor.utf8)
        alta[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(alta as CFDictionary, nil)
    }

    static func sesion() -> String? {
        let consulta: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                       kSecAttrService as String: servicio,
                                       kSecReturnData as String: true,
                                       kSecMatchLimit as String: kSecMatchLimitOne]
        var dato: AnyObject?
        guard SecItemCopyMatching(consulta as CFDictionary, &dato) == errSecSuccess,
              let d = dato as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }

    // MARK: Paradas pendientes (sin conexión)

    struct Pendiente: Codable { let ticketId: Int; let registroId: Int; let en: Date }

    static func pendientes() -> [Pendiente] {
        guard let d = UserDefaults.standard.data(forKey: clavePendientes) else { return [] }
        return (try? JSONDecoder().decode([Pendiente].self, from: d)) ?? []
    }

    static func guardarPendientes(_ lista: [Pendiente]) {
        UserDefaults.standard.set(try? JSONEncoder().encode(lista), forKey: clavePendientes)
    }

    // MARK: Detener

    enum Resultado { case hecho, sinRed, rechazado(String) }

    static func detener(ticketId: Int, registroId: Int, en: Date) async -> Resultado {
        var req = URLRequest(url: base.appendingPathComponent("api/tickets/\(ticketId)/actions/\(registroId)"))
        req.httpMethod = "PATCH"
        req.timeoutInterval = 15
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let s = sesion() { req.setValue("auth_token=\(s)", forHTTPHeaderField: "Cookie") }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["accion": "detener", "en": iso.string(from: en)])
        do {
            let (datos, resp) = try await URLSession.shared.data(for: req)
            let codigo = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if (200..<300).contains(codigo) { return .hecho }
            if codigo >= 500 { return .sinRed }
            if codigo == 401 { return .rechazado("Tu sesión caducó: abre GCC World y detén el reloj desde el ticket.") }
            let msg = (try? JSONSerialization.jsonObject(with: datos) as? [String: Any])?["error"] as? String
            return .rechazado(msg ?? "El servidor no aceptó la parada (\(codigo)).")
        } catch {
            return .sinRed
        }
    }
}

extension ServidorReloj {
    /// `sandbox` instalada desde Xcode; `production` en TestFlight (compilación Release).
    static var entorno: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    /// Registra un token de push con la sesión guardada. Sin sesión no hace nada: se
    /// reintenta en la siguiente sincronización de la página.
    @discardableResult
    static func registrarToken(tipo: String, token: String, registroId: Int? = nil) async -> Bool {
        guard let s = sesion() else { print("[reloj] registrarToken \(tipo): sin sesión en el llavero"); return false }
        var req = URLRequest(url: base.appendingPathComponent("api/dispositivos"))
        req.httpMethod = "POST"
        req.timeoutInterval = 15
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("auth_token=\(s)", forHTTPHeaderField: "Cookie")
        var cuerpo: [String: Any] = ["tipo": tipo, "token": token, "entorno": entorno]
        if let r = registroId { cuerpo["registroId"] = r }
        req.httpBody = try? JSONSerialization.data(withJSONObject: cuerpo)
        guard let (datos, resp) = try? await URLSession.shared.data(for: req) else { print("[reloj] registrarToken \(tipo): sin red"); return false }
        let codigo = (resp as? HTTPURLResponse)?.statusCode ?? 0
        print("[reloj] registrarToken \(tipo) → \(codigo) \(String(data: datos, encoding: .utf8) ?? "")")
        return codigo == 200
    }
}
