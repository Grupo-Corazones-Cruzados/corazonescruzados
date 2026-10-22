import Foundation
import UIKit

/// Calidades que se ofrecen; el selector de yt-dlp de cada una vive en `gcc_descargador.CALIDADES`.
enum Calidad: String, CaseIterable, Identifiable {
    case mejor, p1080 = "1080", p720 = "720", p480 = "480", audio
    var id: String { rawValue }
    var etiqueta: String {
        switch self {
        case .mejor: "Mejor"
        case .p1080: "1080p"
        case .p720: "720p"
        case .p480: "480p"
        case .audio: "Solo audio"
        }
    }
}

struct InfoVideo {
    let titulo: String
    let detalle: String
    let miniatura: URL?
}

enum Estado {
    case arrancando
    case libre
    case buscando
    case bajando(fase: Int, fases: Int, porcentaje: Double, eta: Int?)
    case guardando
    case listo(titulo: String, audio: URL?)
}

/// El estado de la pantalla. Una descarga a la vez; todo se toca en el hilo principal.
final class Descargas: ObservableObject {
    @Published var estado = Estado.arrancando
    @Published var info: InfoVideo?
    @Published var error: String?
    @Published var avisoMotor: String?
    @Published var versionMotor = ""
    @Published var actualizando = false

    private var urlActual: String?
    private var titulo = ""
    private var carpeta: URL?
    private var tarea: UIBackgroundTaskIdentifier = .invalid
    private var actualizacionPedida = false
    private var prueba: Calidad?
    private let inicio = Date()

    init() {
        Motor.compartido.alRecibir = { [weak self] in self?.recibir($0) }
        Motor.compartido.arrancar { [weak self] ok in
            guard let self else { return }
            if ok {
                estado = .libre
                // Prueba desde la Mac: `devicectl device process launch --console --environment-variables
                // '{"GCC_PRUEBA_URL": "…", "GCC_PRUEBA_CALIDAD": "480"}'` busca y baja solo, contando los eventos.
                if let url = ProcessInfo.processInfo.environment["GCC_PRUEBA_URL"] {
                    prueba = ProcessInfo.processInfo.environment["GCC_PRUEBA_CALIDAD"].flatMap(Calidad.init(rawValue:)) ?? .p480
                    buscar(url)
                } else {
                    actualizarSiToca()
                }
            } else {
                error = "No se pudo arrancar el motor de descarga."
            }
        }
    }

    // MARK: - Acciones de la pantalla

    func buscar(_ texto: String) {
        guard let url = Self.enlace(en: texto) else { error = "Ese enlace no es de un video que se pueda descargar."; return }
        urlActual = url
        info = nil
        estado = .buscando
        Motor.compartido.buscar(url)
    }

    func descargar(_ calidad: Calidad) {
        guard let url = urlActual else { return }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("descarga", isDirectory: true)
        try? FileManager.default.removeItem(at: dir)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        carpeta = dir
        titulo = info?.titulo ?? url
        estado = .bajando(fase: 1, fases: 1, porcentaje: 0, eta: nil)
        mantenerDespierta(true)
        Motor.compartido.descargar(url, calidad: calidad.rawValue, carpeta: dir)
    }

    func cancelar() { Motor.compartido.cancelar() }

    func otra() {
        info = nil
        urlActual = nil
        estado = .libre
    }

    /// Lo compartido o pegado desde YouTube trae a veces texto con el enlace dentro: se saca el primero.
    static func enlace(en texto: String) -> String? {
        guard let r = texto.range(of: #"https?://\S+"#, options: .regularExpression) else { return nil }
        return String(texto[r])
    }

    // MARK: - Eventos de Python

    private func recibir(_ e: [String: Any]) {
        if let prueba {
            if e["tipo"] as? String != "progreso" || Int((e["porcentaje"] as? NSNumber)?.doubleValue ?? 0) % 25 == 0 {
                print("[prueba] \(Date().timeIntervalSince(inicio)) s \(e)")
            }
            if e["tipo"] as? String == "info" { DispatchQueue.main.async { self.descargar(prueba) } }
        }
        switch e["tipo"] as? String {
        case "version":
            versionMotor = e["version"] as? String ?? ""
        case "info":
            let autor = e["autor"] as? String
            let dur = (e["duracion"] as? NSNumber).map { Self.duracion($0.intValue) }
            info = InfoVideo(titulo: e["titulo"] as? String ?? "",
                             detalle: [autor, dur].compactMap { $0 }.joined(separator: " · "),
                             miniatura: (e["miniatura"] as? String).flatMap(URL.init(string:)))
            estado = .libre
        case "progreso":
            estado = .bajando(fase: e["fase"] as? Int ?? 1, fases: e["fases"] as? Int ?? 1,
                              porcentaje: (e["porcentaje"] as? NSNumber)?.doubleValue ?? 0,
                              eta: (e["eta"] as? NSNumber)?.intValue)
        case "listo":
            estado = .guardando
            let video = (e["video"] as? String).map(URL.init(fileURLWithPath:))
            let audio = (e["audio"] as? String).map(URL.init(fileURLWithPath:))
            Task { await guardar(video: video, audio: audio) }
        case "cancelado":
            terminar()
            estado = .libre
        case "error":
            let buscando = if case .buscando = estado { true } else { false }
            terminar()
            estado = .libre
            error = buscando ? "No se encontró el video. Revisa el enlace; si sigue igual, actualiza el motor de descarga."
                : Self.explicar(e["mensaje"] as? String ?? "")
        case "motor":
            let anterior = versionMotor
            versionMotor = e["version"] as? String ?? ""
            limpiarMotoresViejos()
            actualizando = false
            if actualizacionPedida {
                avisoMotor = versionMotor == anterior ? "El motor ya está al día (\(versionMotor))." : "Motor actualizado a \(versionMotor)."
            }
        default:
            break
        }
    }

    @MainActor
    private func guardar(video: URL?, audio: URL?) async {
        do {
            var audioGuardado: URL?
            if let video, let audio {
                let unido = video.deletingLastPathComponent().appendingPathComponent("unido.mp4")
                try await Guardar.unir(video: video, audio: audio, en: unido)
                try await Guardar.aFotos(unido, titulo: titulo)
            } else if let video {
                try await Guardar.aFotos(video, titulo: titulo)
            } else if let audio {
                audioGuardado = try Guardar.aArchivos(audio, titulo: titulo)
            }
            terminar()
            estado = .listo(titulo: titulo, audio: audioGuardado)
            if prueba != nil { print("[prueba] \(Date().timeIntervalSince(inicio)) s guardado") }
        } catch {
            if prueba != nil { print("[prueba] fallo al guardar: \(error)") }
            terminar()
            estado = .libre
            self.error = error.localizedDescription
        }
    }

    private func terminar() {
        if let carpeta { try? FileManager.default.removeItem(at: carpeta) }
        carpeta = nil
        mantenerDespierta(false)
    }

    /// iOS corta el trabajo de una app poco después de salir de ella: mientras baja, la pantalla no
    /// se apaga sola, y si la persona sale se pide el tiempo extra que iOS conceda.
    private func mantenerDespierta(_ si: Bool) {
        UIApplication.shared.isIdleTimerDisabled = si
        if si, tarea == .invalid {
            tarea = UIApplication.shared.beginBackgroundTask(withName: "descarga") { [weak self] in self?.soltarTarea() }
        } else if !si {
            soltarTarea()
        }
    }

    private func soltarTarea() {
        guard tarea != .invalid else { return }
        UIApplication.shared.endBackgroundTask(tarea)
        tarea = .invalid
    }

    static func explicar(_ mensaje: String) -> String {
        let m = mensaje.lowercased()
        if m.contains("private video") || m.contains("privado") { return "El video es privado." }
        if m.contains("sign in to confirm") || m.contains("not a bot") {
            return "YouTube pidió comprobar que no eres un robot. Espera unos minutos o cambia de red (wifi o datos) e inténtalo otra vez."
        }
        if m.contains("unsupported url") { return "Ese enlace no es de un video que se pueda descargar." }
        if m.contains("requested format is not available") {
            return "Ese video no está en esa calidad en un formato que el iPhone pueda guardar. Prueba con otra calidad."
        }
        if m.contains("unable to download") || m.contains("network") || m.contains("timed out") {
            return "Se cortó la conexión. Inténtalo otra vez."
        }
        return "Algo falló al descargar. Actualiza el motor de descarga e inténtalo otra vez."
    }

    static func duracion(_ s: Int) -> String {
        s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60) : String(format: "%d:%02d", s / 60, s % 60)
    }

    // MARK: - Motor de descarga

    /// YouTube cambia cada pocas semanas y un yt-dlp viejo deja de funcionar: se revisa solo una vez
    /// al día al abrir la app (el botón lo fuerza). Sin red, sigue el que hay.
    private func actualizarSiToca() {
        let ultima = UserDefaults.standard.double(forKey: "motor_revisado")
        if Date().timeIntervalSince1970 - ultima < 24 * 3600 { return }
        actualizarMotor(pedido: false)
    }

    func actualizarMotor(pedido: Bool = true) {
        guard !actualizando, case .libre = estado else { return }
        actualizando = true
        actualizacionPedida = pedido
        Task { @MainActor in
            do {
                let tag = try await Self.ultimaVersion()
                UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "motor_revisado")
                if tag == versionMotor {
                    actualizando = false
                    if pedido { avisoMotor = "El motor ya está al día (\(versionMotor))." }
                    return
                }
                try await Self.bajarMotor(tag, a: Motor.compartido.dirMotor)
                Motor.compartido.recargar()  // contesta con el evento «motor»
            } catch {
                actualizando = false
                if pedido { avisoMotor = "No se pudo actualizar el motor. Revisa la conexión." }
            }
        }
    }

    private static func ultimaVersion() async throws -> String {
        var req = URLRequest(url: URL(string: "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")!)
        req.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 15
        let (datos, _) = try await URLSession.shared.data(for: req)
        guard let j = try JSONSerialization.jsonObject(with: datos) as? [String: Any], let tag = j["tag_name"] as? String else {
            throw URLError(.cannotParseResponse)
        }
        return tag
    }

    /// El ejecutable `yt-dlp` de cada versión es un zip de Python: se importa tal cual.
    private static func bajarMotor(_ tag: String, a dir: URL) async throws {
        let url = URL(string: "https://github.com/yt-dlp/yt-dlp/releases/download/\(tag)/yt-dlp")!
        let (tmp, resp) = try await URLSession.shared.download(from: url)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        let destino = dir.appendingPathComponent("yt-dlp-\(tag).zip")
        try? FileManager.default.removeItem(at: destino)
        try FileManager.default.moveItem(at: tmp, to: destino)
    }

    /// Ya cargado el nuevo, los zips de versiones anteriores sobran.
    private func limpiarMotoresViejos() {
        let dir = Motor.compartido.dirMotor
        let actual = "yt-dlp-\(versionMotor).zip"
        for f in (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [] where f.hasPrefix("yt-dlp-") && f != actual {
            try? FileManager.default.removeItem(at: dir.appendingPathComponent(f))
        }
    }
}
