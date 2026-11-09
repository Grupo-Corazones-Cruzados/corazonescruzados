import Cocoa
import WebKit

/// GCC WORLD Y GCC MIEMBROS PARA LA MAC (Fernando, 2026-11-08: «una app de escritorio que no venga de
/// Safari»). Una ventana con la plataforma dentro, como las apps del teléfono: escribe la cookie
/// `gcc_app` antes de cargar (igual que `MainActivity` y `VistaPrincipal`), y la web se comporta como
/// esa app (`lib/sitio/appDeTelefono.ts`). Qué app es sale del Info.plist (`GCCApp`, `GCCNombre`), que
/// pone `construir.sh`. Cada app guarda su sesión aparte (su propio almacén de WebKit).
let BASE = URL(string: "https://app.grupocc.org")!

final class Delegado: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    var ventana: NSWindow!
    var web: WKWebView!

    func applicationDidFinishLaunching(_ aviso: Notification) {
        let nombre = Bundle.main.object(forInfoDictionaryKey: "GCCNombre") as? String ?? "GCC World"
        let config = WKWebViewConfiguration()
        // La web pregunta por este puente para saberse dentro de una app instalada (`esAppInstalada`).
        config.userContentController.add(self, name: "gccEscritorio")
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        if ProcessInfo.processInfo.environment["GCC_DEPURAR"] != nil {
            let js = "window.__errores=[];addEventListener('error',e=>__errores.push(String(e.message||e.target?.src||e.target?.href)),true);addEventListener('unhandledrejection',e=>__errores.push('promesa: '+e.reason))"
            config.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.allowsMagnification = true

        ventana = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1320, height: 860),
                           styleMask: [.titled, .closable, .miniaturizable, .resizable],
                           backing: .buffered, defer: false)
        ventana.title = nombre
        ventana.minSize = NSSize(width: 420, height: 560)
        ventana.contentView = web
        ventana.center()
        ventana.setFrameAutosaveName("ventana")
        ventana.makeKeyAndOrderFront(nil)
        armarMenu(nombre)

        marcarApp { [weak self] in self?.web.load(URLRequest(url: BASE.appendingPathComponent("dashboard"))) }
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    /// La cookie de la app, antes de la primera carga (si no, la primera página sería la de la web).
    private func marcarApp(_ luego: @escaping () -> Void) {
        guard let app = Bundle.main.object(forInfoDictionaryKey: "GCCApp") as? String, !app.isEmpty,
              let cookie = HTTPCookie(properties: [
                  .domain: "app.grupocc.org", .path: "/", .name: "gcc_app", .value: app, .secure: "TRUE",
                  .expires: Date().addingTimeInterval(365 * 24 * 3600),
              ])
        else { return luego() }
        web.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) { luego() }
    }

    func userContentController(_ u: WKUserContentController, didReceive m: WKScriptMessage) {}

    // MARK: Navegación: lo del grupo se queda dentro; lo de fuera, al navegador.

    private func esDelGrupo(_ url: URL?) -> Bool {
        guard let host = url?.host else { return true }
        return host == "grupocc.org" || host.hasSuffix(".grupocc.org") || host.hasSuffix(".ts.net")
    }

    /// EL MICRÓFONO (Gumdramon y el dictado del Espacio, 2026-11-08). Sin esto y sin
    /// `NSMicrophoneUsageDescription`, WebKit esconde `navigator.mediaDevices` y la página creía que le
    /// faltaba HTTPS. Solo para las páginas del grupo por HTTPS; macOS pregunta una vez por la app.
    func webView(_ w: WKWebView, requestMediaCapturePermissionFor origen: WKSecurityOrigin, initiatedByFrame f: WKFrameInfo,
                 type tipo: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let host = origen.host
        let propio = origen.protocol == "https" && (host == "grupocc.org" || host.hasSuffix(".grupocc.org") || host.hasSuffix(".ts.net"))
        decisionHandler(propio && tipo == .microphone ? .grant : .deny)
    }

    /// SI SE CAE EL PROCESO DE LA PÁGINA, SE RECARGA (Fernando, 2026-11-09: la ventana se quedó en negro). Sin
    /// esto WebKit deja la vista vacía hasta cerrar la app; con esto vuelve sola a donde estaba.
    func webViewWebContentProcessDidTerminate(_ w: WKWebView) {
        if w.url == nil || w.url?.scheme == "about" { w.load(URLRequest(url: BASE.appendingPathComponent("dashboard"))) } else { w.reload() }
    }

    func webView(_ w: WKWebView, decidePolicyFor accion: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if accion.shouldPerformDownload { return decisionHandler(.download) }
        let url = accion.request.url
        if let esquema = url?.scheme, !["https", "http", "about", "blob", "data"].contains(esquema) {
            if let url { NSWorkspace.shared.open(url) }
            return decisionHandler(.cancel)
        }
        if accion.targetFrame?.isMainFrame != false, !esDelGrupo(url), let url {
            NSWorkspace.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ w: WKWebView, decidePolicyFor respuesta: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(respuesta.canShowMIMEType ? .allow : .download)
    }

    /// `target=_blank` / `window.open`: lo del grupo en esta misma ventana; lo de fuera, al navegador.
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for accion: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = accion.request.url {
            if esDelGrupo(url) { w.load(URLRequest(url: url)) } else { NSWorkspace.shared.open(url) }
        }
        return nil
    }

    // MARK: Descargas (lo que generan las herramientas) → carpeta Descargas.

    func webView(_ w: WKWebView, navigationAction: WKNavigationAction, didBecome d: WKDownload) { d.delegate = self }
    func webView(_ w: WKWebView, navigationResponse: WKNavigationResponse, didBecome d: WKDownload) { d.delegate = self }

    func download(_ d: WKDownload, decideDestinationUsing r: URLResponse, suggestedFilename nombre: String, completionHandler: @escaping (URL?) -> Void) {
        let carpeta = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
        var destino = carpeta.appendingPathComponent(nombre)
        let base = destino.deletingPathExtension().lastPathComponent, ext = destino.pathExtension
        var n = 2
        while FileManager.default.fileExists(atPath: destino.path) {
            destino = carpeta.appendingPathComponent(ext.isEmpty ? "\(base) \(n)" : "\(base) \(n).\(ext)"); n += 1
        }
        completionHandler(destino)
    }

    func downloadDidFinish(_ d: WKDownload) {
        if let url = d.progress.fileURL { NSWorkspace.shared.activateFileViewerSelecting([url]) }
    }

    // MARK: Elegir archivos y los avisos de la página.

    func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = p.allowsMultipleSelection
        panel.canChooseDirectories = p.allowsDirectories
        panel.beginSheetModal(for: ventana) { r in completionHandler(r == .OK ? panel.urls : nil) }
    }

    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = m; a.addButton(withTitle: "Aceptar")
        a.beginSheetModal(for: ventana) { _ in completionHandler() }
    }

    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = m; a.addButton(withTitle: "Aceptar"); a.addButton(withTitle: "Cancelar")
        a.beginSheetModal(for: ventana) { r in completionHandler(r == .alertFirstButtonReturn) }
    }

    func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt m: String, defaultText t: String?, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = NSAlert(); a.messageText = m; a.addButton(withTitle: "Aceptar"); a.addButton(withTitle: "Cancelar")
        let campo = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24)); campo.stringValue = t ?? ""
        a.accessoryView = campo
        a.beginSheetModal(for: ventana) { r in completionHandler(r == .alertFirstButtonReturn ? campo.stringValue : nil) }
    }

    /// Prueba desde la terminal: `GCC_DEPURAR=/tmp/foto <app>/Contents/MacOS/GCCEscritorio` escribe cada
    /// página cargada y guarda una foto de la ventana (sin pedir permiso de grabar la pantalla).
    func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
        guard let ruta = ProcessInfo.processInfo.environment["GCC_DEPURAR"] else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
            w.evaluateJavaScript("[location.href, document.readyState, document.title, document.documentElement.outerHTML.length, document.querySelector('.corp')?.className || '', document.body.innerText.replace(/\\s+/g,' ').slice(0,160), JSON.stringify(window.__errores||[]).slice(0,1500)].join(' | ')") { r, _ in
                print("[depurar]", r ?? "")
            }
            w.evaluateJavaScript("document.documentElement.outerHTML + '\\n<!--RECURSOS\\n' + performance.getEntries().map(e => [e.entryType, e.name, e.responseStatus, e.transferSize, e.deliveryType].join(' ')).join('\\n') + '\\n-->'") { r, _ in
                try? (r as? String)?.write(toFile: ruta + ".html", atomically: true, encoding: .utf8)
            }
            w.takeSnapshot(with: nil) { img, _ in
                guard let img, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                      let png = rep.representation(using: .png, properties: [:]) else { return }
                try? png.write(to: URL(fileURLWithPath: ruta + "-\(Int(Date().timeIntervalSince1970)).png"))
            }
        }
    }

    /// Una página que no carga (sin red): se avisa y se puede reintentar con ⌘R.
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) {
        let html = "<body style='font:15px -apple-system;display:grid;place-items:center;height:90vh;color:#888'>Sin conexión. Pulsa ⌘R para reintentar.</body>"
        w.loadHTMLString(html, baseURL: nil)
    }

    // MARK: Menú: sin «Editar», ⌘C y ⌘V no funcionan en los campos.

    @objc func recargar() {
        if web.url?.scheme == "about" || web.url == nil { web.load(URLRequest(url: BASE.appendingPathComponent("dashboard"))) } else { web.reload() }
    }
    @objc func atras() { web.goBack() }
    @objc func adelante() { web.goForward() }
    @objc func inicio() { web.load(URLRequest(url: BASE.appendingPathComponent("dashboard/accesos"))) }

    private func armarMenu(_ nombre: String) {
        let barra = NSMenu()
        func menu(_ titulo: String, _ items: [NSMenuItem]) {
            let raiz = NSMenuItem(); let m = NSMenu(title: titulo)
            items.forEach(m.addItem); raiz.submenu = m; barra.addItem(raiz)
        }
        func item(_ t: String, _ s: Selector?, _ k: String, _ mods: NSEvent.ModifierFlags = .command) -> NSMenuItem {
            let i = NSMenuItem(title: t, action: s, keyEquivalent: k); i.keyEquivalentModifierMask = mods; return i
        }
        menu(nombre, [item("Ocultar \(nombre)", #selector(NSApplication.hide(_:)), "h"), .separator(),
                      item("Salir de \(nombre)", #selector(NSApplication.terminate(_:)), "q")])
        menu("Edición", [item("Deshacer", Selector(("undo:")), "z"), item("Rehacer", Selector(("redo:")), "Z"), .separator(),
                         item("Cortar", #selector(NSText.cut(_:)), "x"), item("Copiar", #selector(NSText.copy(_:)), "c"),
                         item("Pegar", #selector(NSText.paste(_:)), "v"), item("Seleccionar todo", #selector(NSText.selectAll(_:)), "a")])
        menu("Ver", [item("Recargar", #selector(recargar), "r"), item("Accesos", #selector(inicio), "1"), .separator(),
                     item("Atrás", #selector(atras), "["), item("Adelante", #selector(adelante), "]"), .separator(),
                     item("Pantalla completa", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control])])
        menu("Ventana", [item("Minimizar", #selector(NSWindow.performMiniaturize(_:)), "m"),
                         item("Cerrar", #selector(NSWindow.performClose(_:)), "w")])
        NSApp.mainMenu = barra
    }
}

let app = NSApplication.shared
let delegado = Delegado()
app.delegate = delegado
app.setActivationPolicy(.regular)
app.run()
