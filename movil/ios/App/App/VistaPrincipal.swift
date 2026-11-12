import Capacitor
import UIKit
import WebKit

/// La vista de Capacitor con los plugins propios registrados (hoy, el reloj del ticket).
class VistaPrincipal: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RelojTicketPlugin())
        #if MIEMBROS
        bridge?.registerPluginInstance(ControlPsicosocialPlugin())
        #endif
        marcarApp()
        // Los productos se abren dentro (Accesos); deslizar desde el borde vuelve, como en Android con «atrás».
        webView?.allowsBackForwardNavigationGestures = true
    }

    /// Qué app es (`progreso`, `centralizado`…), como la cookie `gcc_app` que Android escribe antes de
    /// cargar (`lib/sitio/appDeTelefono.ts`). Sale del ajuste `GCC_APP` del build; vacío = GCC World.
    /// La cookie se guarda sin esperar a la WebView: si la primera carga salió antes, se repite.
    private func marcarApp() {
        guard let app = Bundle.main.object(forInfoDictionaryKey: "GCCApp") as? String, !app.isEmpty,
              let cookie = HTTPCookie(properties: [
                  .domain: "app.grupocc.org", .path: "/", .name: "gcc_app", .value: app, .secure: "TRUE",
                  .expires: Date().addingTimeInterval(365 * 24 * 3600), .sameSitePolicy: HTTPCookieStringPolicy.sameSiteLax,
              ])
        else { return }
        WKWebsiteDataStore.default().httpCookieStore.setCookie(cookie) { [weak self] in
            if let web = self?.webView, web.url != nil { web.reload() }
        }
    }

    /// Abre una ruta de la plataforma (p. ej. el ticket al tocar la Actividad en Vivo).
    func abrir(ruta: String) {
        guard ruta.hasPrefix("/"), let url = URL(string: "https://app.grupocc.org" + ruta) else { return }
        webView?.load(URLRequest(url: url))
    }
}
