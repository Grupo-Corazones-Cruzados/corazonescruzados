import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = VistaPrincipal()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        if let url = connectionOptions.urlContexts.first?.url { abrirEnlace(url) }
    }

    /// `gccworld://ticket/<id>`: al tocar la Actividad en Vivo del reloj se abre su ticket.
    private func abrirEnlace(_ url: URL) {
        guard url.scheme == "gccworld", url.host == "ticket", let id = Int(url.lastPathComponent) else { return }
        // Tras arrancar, la vista tarda un instante en tener su WebView.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            (self.window?.rootViewController as? VistaPrincipal)?.abrir(ruta: "/dashboard/tickets/\(id)")
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
        if let url = URLContexts.first?.url { abrirEnlace(url) }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
