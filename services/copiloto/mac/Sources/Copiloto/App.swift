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
    panel.contentView = NSHostingView(rootView: Widget(m: modelo, plegado: plegado))
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
    menu.addItem(withTitle: "Salir", action: #selector(salir), keyEquivalent: "q")
    menu.items.forEach { $0.target = self }
    icono.menu = menu

    modelo.conectar()
    if CommandLine.arguments.contains("--activar") { modelo.activar() }
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

  @objc private func alternarPanel() { panel.isVisible ? panel.orderOut(nil) : panel.orderFrontRegardless() }
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
