import AppKit
import SwiftUI

/// Se queda encima de todo, también de una reunión a pantalla completa, y se puede escribir en él sin
/// quitarle el foco a la app de la reunión.
final class PanelFlotante: NSPanel {
  override var canBecomeKey: Bool { true }
  override var canBecomeMain: Bool { false }
}

@MainActor
final class Delegado: NSObject, NSApplicationDelegate {
  private let modelo = Modelo()
  private var panel: PanelFlotante!
  private var icono: NSStatusItem!
  private var altoAbierto: CGFloat = 480

  func applicationDidFinishLaunching(_ n: Notification) {
    let plegado = Binding<Bool>(
      get: { [weak self] in (self?.panel?.frame.height ?? 480) < 60 },
      set: { [weak self] v in self?.plegar(v) }
    )
    panel = PanelFlotante(
      contentRect: NSRect(x: 0, y: 0, width: 360, height: altoAbierto),
      styleMask: [.titled, .closable, .resizable, .fullSizeContentView, .nonactivatingPanel, .utilityWindow],
      backing: .buffered, defer: false)
    panel.titlebarAppearsTransparent = true
    panel.titleVisibility = .hidden
    panel.isMovableByWindowBackground = true
    panel.level = .floating
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    panel.hidesOnDeactivate = false
    panel.isReleasedWhenClosed = false
    panel.minSize = NSSize(width: 300, height: 38)
    panel.setFrameAutosaveName("CopilotoPanel")
    if panel.frame.origin == .zero, let p = NSScreen.main?.visibleFrame {
      panel.setFrameOrigin(NSPoint(x: p.maxX - 380, y: p.maxY - altoAbierto - 20))
    }
    panel.standardWindowButton(.closeButton)?.isHidden = true
    panel.standardWindowButton(.miniaturizeButton)?.isHidden = true
    panel.standardWindowButton(.zoomButton)?.isHidden = true
    panel.contentView = NSHostingView(rootView: Widget(m: modelo, plegado: plegado, minimizar: { [weak self] in self?.minimizar() }))
    panel.orderFrontRegardless()

    icono = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    let barra = (imagenPersonaje?.copy() as? NSImage) ?? NSImage(systemSymbolName: "waveform.circle", accessibilityDescription: "Gumdramon")
    barra?.size = NSSize(width: 18, height: 18)
    icono.button?.image = barra
    icono.button?.toolTip = "Gumdramon"
    let menu = NSMenu()
    menu.addItem(withTitle: "Mostrar u ocultar", action: #selector(alternarPanel), keyEquivalent: "")
    menu.addItem(withTitle: "Activar o desactivar", action: #selector(alternarActivo), keyEquivalent: "")
    menu.addItem(.separator())
    menu.addItem(withTitle: "Activar o apagar la voz", action: #selector(alternarVoz), keyEquivalent: "")
    menu.addItem(withTitle: "Probar la voz", action: #selector(probarVoz), keyEquivalent: "")
    for t in TonoVoz.allCases {
      let i = menu.addItem(withTitle: "Tono: \(t.nombre)", action: #selector(elegirTono(_:)), keyEquivalent: "")
      i.representedObject = t.rawValue
    }
    menu.addItem(.separator())
    menu.addItem(withTitle: "Salir", action: #selector(salir), keyEquivalent: "q")
    menu.items.forEach { $0.target = self }
    icono.menu = menu

    modelo.conectar()
    if CommandLine.arguments.contains("--activar") { modelo.activar() }
    if CommandLine.arguments.contains("--minimizar") { minimizar() }
    if CommandLine.arguments.contains("--probar-voz") { DispatchQueue.main.asyncAfter(deadline: .now() + 6) { self.modelo.probarVoz() } }
  }

  private func plegar(_ plegar: Bool) {
    var f = panel.frame
    if plegar { altoAbierto = f.height }
    let alto: CGFloat = plegar ? 38 : altoAbierto
    f.origin.y += f.height - alto
    f.size.height = alto
    panel.setFrame(f, display: true, animate: true)
    panel.contentView?.needsLayout = true
    modelo.objectWillChange.send()
  }

  /// Minimizado, el panel se esconde y Gumdramon pasa al Dock; sigue escuchando igual. Mientras se ve
  /// el panel no hay icono en el Dock: así no estorba en la barra cuando se comparte pantalla.
  private func minimizar() {
    panel.orderOut(nil)
    NSApp.setActivationPolicy(.regular)
  }

  private func mostrar() {
    panel.orderFrontRegardless()
    NSApp.setActivationPolicy(.accessory)
  }

  /// Al pulsar el icono del Dock.
  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    mostrar()
    return false
  }

  @objc private func alternarPanel() { panel.isVisible ? minimizar() : mostrar() }
  @objc private func alternarVoz() { modelo.vozActiva.toggle() }
  @objc private func probarVoz() { modelo.probarVoz() }
  @objc private func elegirTono(_ i: NSMenuItem) {
    if let v = i.representedObject as? String, let t = TonoVoz(rawValue: v) { modelo.tonoVoz = t; modelo.probarVoz() }
  }
  @objc private func alternarActivo() { modelo.alternar() }
  @objc private func salir() { modelo.desactivar(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { NSApp.terminate(nil) } }
}

@main
struct Principal {
  @MainActor static func main() {
    let app = NSApplication.shared
    let d = Delegado()
    app.delegate = d
    app.setActivationPolicy(.accessory)
    app.run()
  }
}
