import Capacitor
import UIKit

/// La vista de Capacitor con los plugins propios registrados (hoy, el reloj del ticket).
class VistaPrincipal: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RelojTicketPlugin())
    }

    /// Abre una ruta de la plataforma (p. ej. el ticket al tocar la Actividad en Vivo).
    func abrir(ruta: String) {
        guard ruta.hasPrefix("/"), let url = URL(string: "https://app.grupocc.org" + ruta) else { return }
        webView?.load(URLRequest(url: url))
    }
}
