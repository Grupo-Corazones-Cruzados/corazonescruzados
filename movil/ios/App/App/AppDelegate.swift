import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Tokens de push de la Actividad en Vivo del reloj (también en arranques en segundo plano).
        ObservadorRelojes.iniciar()
        // Avisos normales (recordatorios, suscripciones…): mostrarlos también con la app abierta
        // y abrir su pantalla al tocarlos.
        UNUserNotificationCenter.current().delegate = self
        // Avisos de chat: «Responder» con texto, sin abrir la app (como WhatsApp).
        let responder = UNTextInputNotificationAction(identifier: "RESPONDER", title: "Responder", options: [],
                                                      textInputButtonTitle: "Enviar", textInputPlaceholder: "Mensaje")
        UNUserNotificationCenter.current().setNotificationCategories([
            UNNotificationCategory(identifier: "CHAT", actions: [responder], intentIdentifiers: [], options: []),
        ])
        return true
    }

    // MARK: Avisos (APNs)

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        ObservadorRelojes.tokenDeAvisos(deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("[reloj] avisos: no se pudo registrar: \(error.localizedDescription)")
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // Con la app a la vista, un mensaje de chat no salta: el chat ya está en pantalla.
        if notification.request.content.categoryIdentifier == "CHAT" {
            completionHandler([])
            return
        }
        completionHandler([.banner, .list, .sound])
    }

    /// Tocar un aviso abre su pantalla de la plataforma (`ruta` en el mensaje).
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        // «Responder» desde el aviso de un chat: se envía sin abrir la app.
        if response.actionIdentifier == "RESPONDER",
           let r = response as? UNTextInputNotificationResponse,
           let chat = response.notification.request.content.userInfo["chat"] as? String {
            let texto = r.userText.trimmingCharacters(in: .whitespacesAndNewlines)
            let tarea = UIApplication.shared.beginBackgroundTask(withName: "responder-chat")
            Task {
                if !texto.isEmpty {
                    let ok = await ServidorReloj.responderChat(chat: chat, texto: texto)
                    if !ok {
                        let aviso = UNMutableNotificationContent()
                        aviso.title = "No se envió tu mensaje"
                        aviso.body = "Abre GCC World para responder."
                        aviso.userInfo = response.notification.request.content.userInfo
                        try? await UNUserNotificationCenter.current().add(
                            UNNotificationRequest(identifier: UUID().uuidString, content: aviso, trigger: nil))
                    }
                }
                UIApplication.shared.endBackgroundTask(tarea)
                completionHandler()
            }
            return
        }
        if let ruta = response.notification.request.content.userInfo["ruta"] as? String {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                let escena = UIApplication.shared.connectedScenes.first as? UIWindowScene
                (escena?.windows.first?.rootViewController as? VistaPrincipal)?.abrir(ruta: ruta)
            }
        }
        completionHandler()
    }
}
