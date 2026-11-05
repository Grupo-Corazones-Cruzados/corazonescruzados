import AVFoundation
import AudioToolbox
import Capacitor
import CoreLocation
import Security
import Speech
import UIKit
import UserNotifications

/**
 * CONTROL PSICOSOCIAL en el iPhone: la ubicación y la frase de auxilio. El sistema enseña siempre
 * que están en uso (indicador azul de ubicación y punto naranja de micrófono). El audio se procesa
 * solo dentro del teléfono: `requiresOnDeviceRecognition` impide que salga, y si este iPhone no
 * puede hacerlo así, la voz no se enciende.
 *
 * Límites de iOS: si la persona cierra la app a mano, el micrófono no vuelve hasta abrirla (la
 * ubicación sí, con los cambios significativos). Una llamada interrumpe la escucha.
 */
final class Proteccion: NSObject, CLLocationManagerDelegate {
    static let compartida = Proteccion()
    static let categoriaCancelar = "AUXILIO_CANCELAR"
    private static let intervaloNormal: TimeInterval = 60
    private static let base = URL(string: "https://app.grupocc.org/api/centralized/control-psicosocial")!

    private let ubicacion = CLLocationManager()
    private let motor = AVAudioEngine()
    private var reconocedor: SFSpeechRecognizer?
    private var peticion: SFSpeechAudioBufferRecognitionRequest?
    private var tarea: SFSpeechRecognitionTask?
    private var relevo: Timer?
    private var escuchando = false
    private var cuentaAtras: DispatchWorkItem?
    private var intervalo = Proteccion.intervaloNormal
    private var ultimoEnvio = Date.distantPast
    private var ultima: CLLocation?
    private var cola: [[String: Any]] = []
    private var enviando = false
    private var alResponder: ((CLAuthorizationStatus) -> Void)?
    private(set) var problemaVoz = ""

    private override init() {
        super.init()
        ubicacion.delegate = self
        UIDevice.current.isBatteryMonitoringEnabled = true
        let nc = NotificationCenter.default
        nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] n in
            guard let tipo = (n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt).flatMap(AVAudioSession.InterruptionType.init), tipo == .ended else { return }
            self?.reiniciarVoz()
        }
        nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in self?.reiniciarVoz() }
        nc.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.reanudar() }
    }

    // MARK: Configuración

    private var ajustes: UserDefaults { .standard }
    var quiereUbicacion: Bool { ajustes.bool(forKey: "cp.ubicacion") }
    var quiereVoz: Bool { ajustes.bool(forKey: "cp.voz") }
    var userId: String? { ajustes.string(forKey: "cp.userId") }
    private var frase: String { ajustes.string(forKey: "cp.frase") ?? "" }
    private var segundos: Int { max(ajustes.integer(forKey: "cp.segundos"), 1) }
    private var auxilioPendiente: Bool {
        get { ajustes.bool(forKey: "cp.auxilioPendiente") }
        set { ajustes.set(newValue, forKey: "cp.auxilioPendiente") }
    }
    var activa: Bool { token != nil && (quiereUbicacion || quiereVoz) }

    private static let servicioLlave = "org.grupocc.gccworld.proteccion"
    private var consultaLlave: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: Self.servicioLlave]
    }
    var token: String? {
        var q = consultaLlave
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var dato: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &dato) == errSecSuccess, let d = dato as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
    private func guardarLlave(_ valor: String?) {
        SecItemDelete(consultaLlave as CFDictionary)
        guard let valor else { return }
        var alta = consultaLlave
        alta[kSecValueData as String] = Data(valor.utf8)
        // Disponible con el teléfono bloqueado, pero no sale en copias ni pasa a otro iPhone.
        alta[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(alta as CFDictionary, nil)
    }

    func configurar(token nuevo: String?, userId: String, ubicacion: Bool, voz: Bool, frase: String, segundos: Int) {
        if let nuevo { guardarLlave(nuevo) }
        ajustes.set(userId, forKey: "cp.userId")
        ajustes.set(ubicacion, forKey: "cp.ubicacion")
        ajustes.set(voz, forKey: "cp.voz")
        ajustes.set(frase, forKey: "cp.frase")
        ajustes.set(segundos, forKey: "cp.segundos")
        aplicar()
    }

    /// Al arrancar y al volver a primer plano: levanta lo que el sistema haya cerrado.
    func reanudar() { if activa { aplicar() } }

    private func aplicar() {
        if quiereUbicacion { encenderUbicacion() } else { apagarUbicacion() }
        if quiereVoz { encenderVoz() } else { apagarVoz() }
        if auxilioPendiente { enviarAuxilio() }
    }

    /// Apaga y olvida. Devuelve la llave para entregarla al servidor.
    @discardableResult
    func olvidar() -> String? {
        let llave = token
        cancelarCuenta()
        apagarUbicacion()
        apagarVoz()
        guardarLlave(nil)
        for k in ["cp.userId", "cp.ubicacion", "cp.voz", "cp.frase", "cp.segundos", "cp.auxilioPendiente"] { ajustes.removeObject(forKey: k) }
        cola = []
        problemaVoz = ""
        return llave
    }

    // MARK: Permisos

    func pedirPermisoUbicacion() async -> String {
        func esperar(_ pedir: @escaping () -> Void) async -> CLAuthorizationStatus {
            await withCheckedContinuation { (c: CheckedContinuation<CLAuthorizationStatus, Never>) in
                DispatchQueue.main.async {
                    var hecho = false
                    let acabar: (CLAuthorizationStatus) -> Void = { s in
                        if hecho { return }
                        hecho = true
                        self.alResponder = nil
                        c.resume(returning: s)
                    }
                    self.alResponder = acabar
                    pedir()
                    // iOS no responde si ya no va a enseñar el diálogo.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 30) { acabar(self.ubicacion.authorizationStatus) }
                }
            }
        }
        var estado = await MainActor.run { ubicacion.authorizationStatus }
        if estado == .notDetermined { estado = await esperar { self.ubicacion.requestWhenInUseAuthorization() } }
        if estado == .authorizedWhenInUse {
            // Solo se pide una vez; si ya la negó, no hay diálogo y no conviene esperar.
            await MainActor.run { self.ubicacion.requestAlwaysAuthorization() }
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            estado = await MainActor.run { ubicacion.authorizationStatus }
        }
        switch estado {
        case .authorizedAlways: return "siempre"
        case .authorizedWhenInUse: return "en_uso"
        default: return "denegado"
        }
    }

    func pedirPermisoVoz() async -> String {
        let micro = await AVAudioApplication.requestRecordPermission()
        let habla: SFSpeechRecognizerAuthorizationStatus = await withCheckedContinuation { c in
            SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0) }
        }
        return micro && habla == .authorized ? "concedido" : "denegado"
    }

    func estadoPermisoVoz() -> String {
        AVAudioApplication.shared.recordPermission == .granted && SFSpeechRecognizer.authorizationStatus() == .authorized ? "concedido" : "denegado"
    }

    func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        if m.authorizationStatus != .notDetermined { alResponder?(m.authorizationStatus) }
        if quiereUbicacion { encenderUbicacion() }
    }

    // MARK: Ubicación

    private func encenderUbicacion() {
        let e = ubicacion.authorizationStatus
        guard e == .authorizedAlways || e == .authorizedWhenInUse else { return }
        ubicacion.desiredAccuracy = kCLLocationAccuracyHundredMeters
        ubicacion.distanceFilter = kCLDistanceFilterNone
        ubicacion.pausesLocationUpdatesAutomatically = false
        ubicacion.allowsBackgroundLocationUpdates = true
        ubicacion.showsBackgroundLocationIndicator = true
        ubicacion.startUpdatingLocation()
        // Es lo que vuelve a despertar la app si se cierra a mano.
        if e == .authorizedAlways { ubicacion.startMonitoringSignificantLocationChanges() }
    }

    private func apagarUbicacion() {
        ubicacion.stopUpdatingLocation()
        ubicacion.stopMonitoringSignificantLocationChanges()
    }

    func locationManager(_ m: CLLocationManager, didUpdateLocations lista: [CLLocation]) {
        guard let l = lista.last else { return }
        ultima = l
        guard Date().timeIntervalSince(ultimoEnvio) >= intervalo else { return }
        ultimoEnvio = Date()
        encolar(l)
    }

    private func encolar(_ l: CLLocation) {
        let nivel = UIDevice.current.batteryLevel
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var p: [String: Any] = ["lat": l.coordinate.latitude, "lng": l.coordinate.longitude,
                                "precision": l.horizontalAccuracy, "en": iso.string(from: l.timestamp)]
        if nivel >= 0 { p["bateria"] = Int(nivel * 100) }
        cola.append(p)
        // Sin red se acumula para enviar al volver; un corte muy largo descarta lo más viejo.
        if cola.count > 100 { cola.removeFirst(cola.count - 100) }
        vaciarCola()
    }

    /// Tras un auxilio: manda ya la última posición y deja que el servidor acorte el intervalo.
    func enviarAhora() {
        DispatchQueue.main.async {
            self.ubicacion.desiredAccuracy = kCLLocationAccuracyBest
            if let l = self.ultima { self.ultimoEnvio = Date(); self.encolar(l) } else { self.ubicacion.requestLocation() }
        }
    }

    func locationManager(_ m: CLLocationManager, didFailWithError e: Error) {
        print("[proteccion] ubicación: \(e.localizedDescription)")
    }

    private func vaciarCola() {
        guard !enviando, !cola.isEmpty, let token else { return }
        enviando = true
        let lote = cola
        Task { @MainActor in
            defer { self.enviando = false }
            guard let (codigo, j) = await Self.llamar("POST", "posicion", token: token, cuerpo: ["puntos": lote]) else { return }
            if codigo == 401 || codigo == 403 { self.olvidar(); return }
            guard codigo < 300 else { return }
            self.cola.removeFirst(min(lote.count, self.cola.count))
            let nuevo = (j["intervalo_s"] as? NSNumber)?.doubleValue ?? Self.intervaloNormal
            self.intervalo = nuevo
            self.ubicacion.desiredAccuracy = nuevo < Self.intervaloNormal ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
            if (j["voz"] as? Bool) == false, self.quiereVoz {
                self.ajustes.set(false, forKey: "cp.voz")
                self.apagarVoz()
            }
        }
    }

    private static func llamar(_ metodo: String, _ ruta: String, token: String, cuerpo: [String: Any]?) async -> (Int, [String: Any])? {
        var req = URLRequest(url: base.appendingPathComponent(ruta))
        req.httpMethod = metodo
        req.timeoutInterval = 20
        req.setValue(token, forHTTPHeaderField: "x-cp-dispositivo")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let cuerpo { req.httpBody = try? JSONSerialization.data(withJSONObject: cuerpo) }
        guard let (datos, resp) = try? await URLSession.shared.data(for: req), let h = resp as? HTTPURLResponse else { return nil }
        return (h.statusCode, (try? JSONSerialization.jsonObject(with: datos)) as? [String: Any] ?? [:])
    }

    static func entregarLlave(_ token: String) async {
        _ = await llamar("DELETE", "dispositivo", token: token, cuerpo: nil)
    }

    // MARK: Voz

    private func encenderVoz() {
        guard !escuchando else { return }
        guard estadoPermisoVoz() == "concedido" else { problemaVoz = "Falta el permiso de micrófono o de reconocimiento de voz."; return }
        let idiomas = ["es-EC", "es-419", "es-MX", "es-ES", "es-US"]
        guard let r = idiomas.lazy.compactMap({ SFSpeechRecognizer(locale: Locale(identifier: $0)) }).first(where: { $0.supportsOnDeviceRecognition }) else {
            problemaVoz = "Activa el dictado en español en Ajustes para usar la voz: este iPhone aún no lo tiene descargado."
            return
        }
        reconocedor = r
        do {
            let sesion = AVAudioSession.sharedInstance()
            // Mezcla con lo que suene: escuchar no debe cortar la música de la persona.
            try sesion.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .defaultToSpeaker])
            try sesion.setActive(true)
            let entrada = motor.inputNode
            entrada.removeTap(onBus: 0)
            entrada.installTap(onBus: 0, bufferSize: 2048, format: entrada.outputFormat(forBus: 0)) { [weak self] buffer, _ in
                self?.peticion?.append(buffer)
            }
            motor.prepare()
            try motor.start()
            escuchando = true
            problemaVoz = ""
            nuevaTarea()
        } catch {
            motor.inputNode.removeTap(onBus: 0)
            vozDetenida("La detección de voz no pudo iniciar. Vuelve a abrir la app.")
        }
    }

    private func nuevaTarea() {
        tarea?.cancel()
        peticion?.endAudio()
        relevo?.invalidate()
        guard escuchando, let reconocedor else { return }
        let p = SFSpeechAudioBufferRecognitionRequest()
        p.requiresOnDeviceRecognition = true
        p.shouldReportPartialResults = true
        p.taskHint = .dictation
        p.contextualStrings = [frase]
        peticion = p
        tarea = reconocedor.recognitionTask(with: p) { [weak self] resultado, error in
            guard let self else { return }
            if let resultado, self.contieneFrase(resultado.bestTranscription.formattedString) {
                DispatchQueue.main.async { self.alDetectar(); self.nuevaTarea() }
                return
            }
            if error != nil || resultado?.isFinal == true {
                DispatchQueue.main.async { if self.escuchando, self.peticion === p { self.nuevaTarea() } }
            }
        }
        // Una tarea no puede crecer sin fin: se releva cada minuto.
        let t = Timer(timeInterval: 60, repeats: false) { [weak self] _ in self?.nuevaTarea() }
        RunLoop.main.add(t, forMode: .common)
        relevo = t
    }

    private func normalizar(_ s: String) -> String {
        s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es"))
            .components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.joined(separator: " ")
    }

    private func contieneFrase(_ texto: String) -> Bool {
        let f = normalizar(frase)
        return !f.isEmpty && " \(normalizar(texto)) ".contains(" \(f) ")
    }

    private func apagarVoz() {
        escuchando = false
        relevo?.invalidate()
        tarea?.cancel()
        peticion?.endAudio()
        tarea = nil
        peticion = nil
        if motor.isRunning { motor.stop() }
        motor.inputNode.removeTap(onBus: 0)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func reiniciarVoz() {
        guard quiereVoz else { return }
        apagarVoz()
        encenderVoz()
    }

    /// Que la persona sepa que dejó de estar protegida: no hay nada peor que creer que sí.
    private func vozDetenida(_ motivo: String) {
        problemaVoz = motivo
        escuchando = false
        let c = UNMutableNotificationContent()
        c.title = "Control Psicosocial"
        c.body = "La detección de voz se detuvo. Abre GCC World para activarla."
        c.userInfo = ["ruta": "/dashboard/centralized/colaborador/implementacion/control-psicosocial"]
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "voz-detenida", content: c, trigger: nil))
    }

    // MARK: Auxilio

    private func alDetectar() {
        guard cuentaAtras == nil, !auxilioPendiente else { return }
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        // Texto discreto a propósito: la pantalla puede estar a la vista de quien amenaza.
        let c = UNMutableNotificationContent()
        c.title = "GCC World"
        c.body = "Procesando aviso"
        c.categoryIdentifier = Self.categoriaCancelar
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "auxilio-cuenta", content: c, trigger: nil))
        let w = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.cuentaAtras = nil
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["auxilio-cuenta"])
            self.auxilioPendiente = true
            self.enviarAuxilio()
        }
        cuentaAtras = w
        DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(segundos), execute: w)
    }

    func cancelarCuenta() {
        cuentaAtras?.cancel()
        cuentaAtras = nil
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["auxilio-cuenta"])
    }

    /// Se reintenta hasta que el servidor lo reciba: sin red, el aviso sale en cuanto vuelva.
    private func enviarAuxilio() {
        guard let token, auxilioPendiente else { return }
        let c = ultima?.coordinate
        Task { @MainActor in
            let cuerpo: [String: Any] = ["origen": "voz", "lat": c?.latitude ?? NSNull(), "lng": c?.longitude ?? NSNull()]
            guard let (codigo, _) = await Self.llamar("POST", "alertas", token: token, cuerpo: cuerpo), codigo < 500 else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 15) { self.enviarAuxilio() }
                return
            }
            if codigo >= 400 { self.olvidar(); return }
            self.auxilioPendiente = false
            self.intervalo = 15
            self.enviarAhora()
        }
    }
}

/// El puente con la página (`lib/movil/control-psicosocial.ts`). Nada pide permisos ni escucha
/// hasta que un miembro acepta en la pantalla de Control Psicosocial.
@objc(ControlPsicosocialPlugin)
public class ControlPsicosocialPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ControlPsicosocialPlugin"
    public let jsName = "ControlPsicosocial"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "estado", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pedirPermisos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configurar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enviarAhora", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "apagar", returnType: CAPPluginReturnPromise),
    ]
    private var p: Proteccion { .compartida }

    @objc func estado(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "activo": self.p.activa, "ubicacion": self.p.quiereUbicacion, "voz": self.p.quiereVoz,
                "userId": self.p.userId ?? NSNull(), "tieneLlave": self.p.token != nil, "problemaVoz": self.p.problemaVoz,
            ])
        }
    }

    @objc func pedirPermisos(_ call: CAPPluginCall) {
        let quiereUbicacion = call.getBool("ubicacion") ?? false
        let quiereVoz = call.getBool("voz") ?? false
        Task {
            // Sin permiso de avisos no se vería el «Cancelar» de la detección ni un auxilio ajeno.
            _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
            let u = quiereUbicacion ? await p.pedirPermisoUbicacion() : "denegado"
            let v = quiereVoz ? await p.pedirPermisoVoz() : p.estadoPermisoVoz()
            call.resolve(["ubicacion": u, "voz": v])
        }
    }

    @objc func configurar(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else { call.reject("Falta la persona"); return }
        DispatchQueue.main.async {
            let token = call.getString("token")
            guard token != nil || self.p.token != nil else { call.reject("Falta la llave de este teléfono"); return }
            self.p.configurar(token: token, userId: userId, ubicacion: call.getBool("ubicacion") ?? false,
                              voz: call.getBool("voz") ?? false, frase: call.getString("frase") ?? "",
                              segundos: call.getInt("segundos") ?? 10)
            call.resolve()
        }
    }

    @objc func enviarAhora(_ call: CAPPluginCall) {
        if p.activa { p.enviarAhora() }
        call.resolve()
    }

    @objc func apagar(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let llave = self.p.olvidar()
            Task {
                if let llave { await Proteccion.entregarLlave(llave) }
                call.resolve()
            }
        }
    }
}
