import AVFoundation
import Foundation
import SwiftUI

struct Consulta: Identifiable {
  let id: Int
  var pregunta: String
  var modo: String
  var respuesta: String = ""
  var buscando = false
  var detalle: String?
  var terminada = false
  var ms: Int?
}

struct Linea: Identifiable {
  let id = UUID()
  let quien: String
  let texto: String
}

@MainActor
final class Modelo: ObservableObject {
  @Published var activo = false
  @Published var conectado = false
  @Published var consultas: [Consulta] = []
  @Published var lineas: [Linea] = []
  @Published var aviso: String?
  @Published var nota: String?
  /// Lo que lleva dicho Fernando tras la palabra clave; nil si no está dictando.
  @Published var dictando: String?
  /// Segundos que faltan para enviar la pregunta; nil mientras sigue hablando.
  @Published var restante: Double?
  @Published var totalEspera: Double = 4
  /// La sesión de Claude Code de esta reunión, para abrirla en el Espacio de trabajo.
  @Published var sesionURL: URL?
  @Published var nivelMic: Float = 0
  @Published var nivelSistema: Float = 0
  @Published var sinAudioSistema = false

  private let base = URL(string: ProcessInfo.processInfo.environment["COPILOTO_URL"] ?? "http://127.0.0.1:3793")!
  private let mic = CapturaMicrofono()
  private let sistema = CapturaSistema()
  private var tareaEventos: Task<Void, Never>?
  private let envio = Enviador()
  let voz = VozGumdramon()
  /// Apagada al instalar: una voz inesperada en plena reunión la oiría también el cliente por altavoces.
  @Published var vozActiva = UserDefaults.standard.bool(forKey: "vozActiva") {
    didSet {
      UserDefaults.standard.set(vozActiva, forKey: "vozActiva")
      if !vozActiva { voz.callar() }
    }
  }
  @Published var tonoVoz = TonoVoz(rawValue: UserDefaults.standard.string(forKey: "tonoVoz") ?? "") ?? .agudo {
    didSet { UserDefaults.standard.set(tonoVoz.rawValue, forKey: "tonoVoz"); voz.tono = tonoVoz }
  }

  private var token: String {
    let ruta = ProcessInfo.processInfo.environment["COPILOTO_TOKEN"].map { URL(fileURLWithPath: $0) }
      ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".gcc-copiloto/token")
    return (try? String(contentsOf: ruta, encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }

  func conectar() {
    voz.tono = tonoVoz
    tareaEventos?.cancel()
    tareaEventos = Task { await bucleEventos() }
  }

  private func peticion(_ ruta: String, metodo: String = "POST", cuerpo: Data? = nil) -> URLRequest {
    var r = URLRequest(url: base.appendingPathComponent(ruta))
    r.httpMethod = metodo
    r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    r.httpBody = cuerpo
    return r
  }

  @discardableResult
  private func llamar(_ ruta: String, cuerpo: Data? = nil) async -> Bool {
    do {
      let (d, res) = try await URLSession.shared.data(for: peticion(ruta, cuerpo: cuerpo))
      if let h = res as? HTTPURLResponse, h.statusCode != 200 {
        let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any]
        aviso = j?["error"] as? String ?? "El núcleo respondió \(h.statusCode)."
        return false
      }
      return true
    } catch {
      aviso = "El núcleo de Gumdramon no responde."
      return false
    }
  }

  func alternar() { activo ? desactivar() : activar() }

  func activar() {
    aviso = nil
    nota = nil
    Task {
      let permitido = await AVCaptureDevice.requestAccess(for: .audio)
      guard permitido else { aviso = "Falta el permiso del micrófono en Ajustes del Sistema ▸ Privacidad."; return }
      guard await llamar("activar") else { return }
      iniciarCaptura()
    }
  }

  private func iniciarCaptura() {
    let peticionAudio: (String) -> URLRequest = { [weak self] canal in
      var c = URLComponents(url: self!.base.appendingPathComponent("audio"), resolvingAgainstBaseURL: false)!
      c.queryItems = [URLQueryItem(name: "canal", value: canal)]
      var r = URLRequest(url: c.url!)
      r.httpMethod = "POST"
      r.setValue("Bearer \(self!.token)", forHTTPHeaderField: "Authorization")
      return r
    }
    let rMic = peticionAudio("mic")
    let rSis = peticionAudio("sistema")
    let envio = self.envio
    mic.alAudio = { [weak self] d, n in
      envio.agregar(d, a: rMic)
      Task { @MainActor in self?.nivelMic = n }
    }
    sistema.alAudio = { [weak self] d, n in
      envio.agregar(d, a: rSis)
      Task { @MainActor in self?.nivelSistema = n }
    }
    do { try mic.iniciar() } catch { aviso = error.localizedDescription }
    do { try sistema.iniciar(); sinAudioSistema = false } catch {
      sinAudioSistema = true
      aviso = "Sin audio del equipo: \(error.localizedDescription)"
    }
  }

  private func detenerCaptura() {
    mic.detener()
    sistema.detener()
    nivelMic = 0
    nivelSistema = 0
  }

  /// Para oír la voz sin gastar una consulta.
  func probarVoz() { voz.decir("Hola, soy Gumdramon. Gestión de Reservas cuesta 5 dólares al mes.") }

  func desactivar() {
    voz.callar()
    detenerCaptura()
    Task { await llamar("desactivar") }
  }

  func terminar() {
    detenerCaptura()
    nota = "Guardando la transcripción…"
    Task { await llamar("terminar") }
  }

  /// Corta la investigación en curso: cada búsqueda de más gasta la suscripción.
  func detenerConsulta() { Task { await llamar("detener") } }

  func enviar(_ texto: String) {
    guard let d = try? JSONSerialization.data(withJSONObject: ["texto": texto]) else { return }
    Task { await llamar("consulta", cuerpo: d) }
  }

  private func bucleEventos() async {
    while !Task.isCancelled {
      do {
        var r = peticion("eventos", metodo: "GET")
        r.timeoutInterval = 3600
        let (bytes, res) = try await URLSession.shared.bytes(for: r)
        guard (res as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        conectado = true
        var evento = ""
        for try await linea in bytes.lines {
          if linea.hasPrefix("event: ") { evento = String(linea.dropFirst(7)) }
          else if linea.hasPrefix("data: ") {
            let j = (try? JSONSerialization.jsonObject(with: Data(linea.dropFirst(6).utf8))) as? [String: Any] ?? [:]
            recibir(evento, j)
          }
        }
      } catch { /* se reintenta abajo */ }
      conectado = false
      try? await Task.sleep(for: .seconds(2))
    }
  }

  private func consultaIndice(_ j: [String: Any]) -> Int? {
    guard let id = j["id"] as? Int else { return nil }
    return consultas.firstIndex { $0.id == id }
  }

  private func recibir(_ evento: String, _ j: [String: Any]) {
    switch evento {
    case "estado":
      let nuevo = j["activo"] as? Bool ?? false
      if !nuevo && activo { detenerCaptura() }
      activo = nuevo
    case "transcripcion":
      lineas.append(Linea(quien: j["quien"] as? String ?? "", texto: j["texto"] as? String ?? ""))
      if lineas.count > 400 { lineas.removeFirst(lineas.count - 400) }
    case "escuchando":
      let sigue = j["activo"] as? Bool ?? false
      dictando = sigue ? (j["texto"] as? String ?? "") : nil
      restante = sigue ? (j["restante"] as? Double ?? (j["restante"] as? Int).map(Double.init)) : nil
      if let t = j["total"] as? Double ?? (j["total"] as? Int).map(Double.init) { totalEspera = t }
    case "sesion":
      if let id = j["id"] as? String, let p = j["proyecto"] as? String {
        sesionURL = URL(string: "http://localhost:3792/dashboard/admin/espacio?p=\(p)&s=\(id)")
      }
    case "consulta":
      guard let id = j["id"] as? Int else { return }
      consultas.append(Consulta(id: id, pregunta: j["pregunta"] as? String ?? "", modo: j["modo"] as? String ?? ""))
    case "buscando":
      if let i = consultaIndice(j) { consultas[i].buscando = true; consultas[i].respuesta = ""; consultas[i].detalle = j["detalle"] as? String }
    case "parcial":
      if let i = consultaIndice(j) { consultas[i].respuesta = j["texto"] as? String ?? ""; consultas[i].buscando = false }
    case "respuesta":
      if let i = consultaIndice(j) {
        consultas[i].respuesta = j["texto"] as? String ?? ""
        consultas[i].buscando = false
        consultas[i].terminada = true
        consultas[i].ms = j["ms"] as? Int
        if vozActiva { voz.decir(consultas[i].respuesta) }
      }
    case "descartada":
      if let i = consultaIndice(j) { consultas.remove(at: i) }
    case "terminada":
      voz.callar()
      detenerCaptura()
      activo = false
      nota = (j["conTranscripcion"] as? Bool ?? false) ? "Sesión terminada. Creando el recordatorio…" : "Sesión terminada, sin nada que guardar."
    case "recordatorio":
      let titulo = j["titulo"] as? String ?? ""
      nota = "Recordatorio creado: \(titulo)"
    case "error":
      let mensaje = j["mensaje"] as? String ?? "Error"
      if let i = consultaIndice(j) { consultas.remove(at: i) }
      aviso = mensaje.lowercased().contains("limit") ? "Se alcanzó el límite de Claude: no habrá respuestas hasta que se libere. La transcripción sigue guardándose." : mensaje
    default: break
    }
  }
}

/// Junta el audio y lo manda cada medio segundo, en orden.
final class Enviador: @unchecked Sendable {
  private let cola = DispatchQueue(label: "org.grupocc.copiloto.envio")
  private var buffers: [URL: (URLRequest, Data)] = [:]
  private var temporizador: DispatchSourceTimer?

  init() {
    let t = DispatchSource.makeTimerSource(queue: cola)
    t.schedule(deadline: .now() + 0.5, repeating: 0.5)
    t.setEventHandler { [weak self] in self?.vaciar() }
    t.resume()
    temporizador = t
  }

  func agregar(_ d: Data, a r: URLRequest) {
    cola.async {
      var actual = self.buffers[r.url!] ?? (r, Data())
      actual.1.append(d)
      self.buffers[r.url!] = actual
    }
  }

  private func vaciar() {
    for (url, (r, d)) in buffers where !d.isEmpty {
      buffers[url] = (r, Data())
      var p = r
      p.httpBody = d
      URLSession.shared.dataTask(with: p).resume()
    }
  }
}
