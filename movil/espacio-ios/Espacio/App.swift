import SwiftUI
import WebKit

/// Lo mismo que abre la app de GCC en Admin ▸ Espacio de trabajo, sin pasar por ella: un acceso directo a la Mac por
/// Tailscale. Toda la interfaz y la contraseña son de la página; aquí solo hay una ventana hacia ella.
private let ENTORNO = URL(string: "https://luiss-macbook-pro-1.tail496c78.ts.net/espacio?oscuro=1")!
private let FONDO = Color(red: 0.05, green: 0.05, blue: 0.09)

@main
struct EntornoApp: App {
  var body: some Scene {
    WindowGroup { Pantalla().preferredColorScheme(.dark) }
  }
}

struct Pantalla: View {
  @State private var error: String?
  @State private var intento = 0
  @State private var cargando = true

  var body: some View {
    ZStack {
      FONDO.ignoresSafeArea()
      Web(intento: intento, alCargar: { cargando = false; error = nil }, alFallar: { cargando = false; error = $0 })
        .opacity(error == nil && !cargando ? 1 : 0)
      if let error {
        VStack(spacing: 14) {
          Image(systemName: "wifi.slash").font(.title2).foregroundStyle(.secondary)
          Text("No se pudo conectar con tu Mac").font(.headline)
          Text("Revisa que Tailscale esté activo aquí y que la Mac esté encendida.").font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
          Text(error).font(.caption2).foregroundStyle(.tertiary).multilineTextAlignment(.center)
          Button("Reintentar") { self.error = nil; cargando = true; intento += 1 }.buttonStyle(.borderedProminent)
        }
        .padding(28)
      } else if cargando {
        ProgressView()
      }
    }
  }
}

struct Web: UIViewRepresentable {
  let intento: Int
  let alCargar: () -> Void
  let alFallar: (String) -> Void

  func makeCoordinator() -> Coordinador { Coordinador(self) }

  func makeUIView(context: Context) -> WKWebView {
    let c = WKWebViewConfiguration()
    c.allowsInlineMediaPlayback = true
    c.mediaTypesRequiringUserActionForPlayback = []
    // El almacén por defecto: la sesión guardada por la página sobrevive al cerrar la app.
    c.websiteDataStore = .default()
    let w = WKWebView(frame: .zero, configuration: c)
    w.navigationDelegate = context.coordinator
    w.uiDelegate = context.coordinator
    w.isOpaque = false
    w.backgroundColor = UIColor(FONDO)
    w.scrollView.backgroundColor = UIColor(FONDO)
    w.allowsBackForwardNavigationGestures = true
    w.load(URLRequest(url: ENTORNO))
    context.coordinator.ultimoIntento = intento
    return w
  }

  func updateUIView(_ w: WKWebView, context: Context) {
    context.coordinator.padre = self
    if context.coordinator.ultimoIntento != intento {
      context.coordinator.ultimoIntento = intento
      w.load(URLRequest(url: ENTORNO))
    }
  }

  final class Coordinador: NSObject, WKNavigationDelegate, WKUIDelegate {
    var padre: Web
    var ultimoIntento = 0
    init(_ p: Web) { padre = p }

    func webView(_ w: WKWebView, didFinish n: WKNavigation!) { padre.alCargar() }
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { fallo(e) }
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { fallo(e) }
    private func fallo(_ e: Error) {
      if (e as NSError).code == NSURLErrorCancelled { return }
      padre.alFallar(e.localizedDescription)
    }
    // Si iOS descarga la página para liberar memoria, al volver quedaría en blanco.
    func webViewWebContentProcessDidTerminate(_ w: WKWebView) { w.reload() }

    // El dictado del compositor: el permiso real lo sigue dando iOS la primera vez.
    func webView(_ w: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame f: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
      decisionHandler(origin.host == ENTORNO.host ? .grant : .prompt)
    }
    // Un enlace que abre otra ventana: lo de fuera, a Safari; lo propio, aquí.
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
      if let u = a.request.url {
        if u.host == ENTORNO.host { w.load(a.request) } else { UIApplication.shared.open(u) }
      }
      return nil
    }
    private func presentar(_ a: UIAlertController) {
      let raiz = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }.first
      raiz?.present(a, animated: true)
    }
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler h: @escaping () -> Void) {
      let a = UIAlertController(title: nil, message: m, preferredStyle: .alert)
      a.addAction(UIAlertAction(title: "Aceptar", style: .default) { _ in h() })
      presentar(a)
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler h: @escaping (Bool) -> Void) {
      let a = UIAlertController(title: nil, message: m, preferredStyle: .alert)
      a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in h(false) })
      a.addAction(UIAlertAction(title: "Aceptar", style: .default) { _ in h(true) })
      presentar(a)
    }
  }
}
