import AVFoundation
import Foundation
import Security

/// La Mac, por la red privada de Tailscale. Fuera de esa red no lleva a ningún sitio.
let MAC = URL(string: "https://luiss-macbook-pro-1.tail496c78.ts.net")!

struct Consulta: Identifiable {
  let id: Int
  var pregunta: String
  var respuesta = ""
  var buscando = false
  var detalle: String?
  var terminada = false
}
struct Linea: Identifiable { let id = UUID(); let quien: String; let texto: String }

enum TonoVoz: String, CaseIterable {
  case normal, agudo, muyAgudo
  var nombre: String { self == .normal ? "Normal" : self == .agudo ? "Agudo" : "Muy agudo" }
  var pitch: Float { self == .normal ? 1.25 : self == .agudo ? 1.55 : 1.85 }
}

/// La sesión de la Mac (30 días), en el llavero del teléfono.
enum Llavero {
  private static let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: "espacio_token", kSecAttrService as String: "org.grupocc.gumdramon"]
  static func leer() -> String? {
    var q = base; q[kSecReturnData as String] = true
    var r: AnyObject?
    guard SecItemCopyMatching(q as CFDictionary, &r) == errSecSuccess, let d = r as? Data else { return nil }
    return String(data: d, encoding: .utf8)
  }
  static func guardar(_ t: String?) {
    SecItemDelete(base as CFDictionary)
    guard let t else { return }
    var q = base; q[kSecValueData as String] = Data(t.utf8); q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    SecItemAdd(q as CFDictionary, nil)
  }
}

/// El micrófono, también con la app en segundo plano o la pantalla bloqueada (`UIBackgroundModes: audio`).
final class Microfono {
  private var motor = AVAudioEngine()
  private var conversor: AVAudioConverter?
  private var entrada: AVAudioFormat?
  private let salida = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!
  var alAudio: ((Data, Float) -> Void)?
  private(set) var abierto = false

  func iniciar() throws {
    let s = AVAudioSession.sharedInstance()
    try s.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothHFP])
    try s.setActive(true)
    motor = AVAudioEngine()
    let nodo = motor.inputNode
    let formato = nodo.outputFormat(forBus: 0)
    guard formato.sampleRate > 0 else { throw NSError(domain: "Gumdramon", code: 1, userInfo: [NSLocalizedDescriptionKey: "No hay micrófono disponible."]) }
    nodo.installTap(onBus: 0, bufferSize: 4096, format: formato) { [weak self] b, _ in self?.procesar(b) }
    try motor.start()
    abierto = true
  }

  func detener() {
    guard abierto else { return }
    motor.inputNode.removeTap(onBus: 0)
    motor.stop()
    abierto = false
    conversor = nil
    entrada = nil
  }

  private func procesar(_ b: AVAudioPCMBuffer) {
    if entrada != b.format { entrada = b.format; conversor = AVAudioConverter(from: b.format, to: salida) }
    guard let conversor else { return }
    let capacidad = AVAudioFrameCount(Double(b.frameLength) * 16000 / b.format.sampleRate) + 32
    guard let out = AVAudioPCMBuffer(pcmFormat: salida, frameCapacity: capacidad) else { return }
    var dado = false
    var error: NSError?
    conversor.convert(to: out, error: &error) { _, estado in
      if dado { estado.pointee = .noDataNow; return nil }
      dado = true; estado.pointee = .haveData; return b
    }
    guard error == nil, out.frameLength > 0, let datos = out.int16ChannelData?[0] else { return }
    let n = Int(out.frameLength)
    var suma: Float = 0
    for i in 0..<n { let v = Float(datos[i]) / 32768; suma += v * v }
    alAudio?(Data(bytes: datos, count: n * 2), (suma / Float(n)).squareRoot())
  }
}

/// Junta el audio y lo manda en orden cada medio segundo. Un corte de red pierde ese trozo, no atrasa lo demás.
final class Enviador: @unchecked Sendable {
  private let cola = DispatchQueue(label: "org.grupocc.gumdramon.envio")
  private var buffer = Data()
  private var enviando = false
  private var reloj: DispatchSourceTimer?
  var peticion: () -> URLRequest? = { nil }

  func iniciar() {
    cola.async {
      self.reloj?.cancel()
      self.buffer = Data()
      self.enviando = false
      let t = DispatchSource.makeTimerSource(queue: self.cola)
      t.schedule(deadline: .now() + 0.5, repeating: 0.5)
      t.setEventHandler { [weak self] in self?.vaciar() }
      t.resume()
      self.reloj = t
    }
  }
  func detener() { cola.async { self.reloj?.cancel(); self.reloj = nil; self.buffer = Data() } }
  func agregar(_ d: Data) { cola.async { self.buffer.append(d) } }

  private func vaciar() {
    guard !enviando, !buffer.isEmpty, var r = peticion() else { return }
    r.httpBody = buffer
    buffer = Data()
    enviando = true
    URLSession.shared.dataTask(with: r) { [weak self] _, _, _ in self?.cola.async { self?.enviando = false } }.resume()
  }
}

@MainActor
final class Modelo: NSObject, ObservableObject {
  @Published var token: String? = Llavero.leer()
  @Published var activo = false
  @Published var dispositivo = "mac"
  @Published var conectado = false
  @Published var escuchando = false
  @Published var consultas: [Consulta] = []
  @Published var lineas: [Linea] = []
  @Published var dictando: String?
  @Published var restante: Double?
  @Published var totalEspera: Double = 4
  @Published var nivel: Float = 0
  @Published var aviso: String?
  @Published var nota: String?
  @Published var vozActiva = UserDefaults.standard.bool(forKey: "vozActiva") {
    didSet { UserDefaults.standard.set(vozActiva, forKey: "vozActiva"); if !vozActiva { voz.stopSpeaking(at: .immediate) } }
  }
  @Published var tono = TonoVoz(rawValue: UserDefaults.standard.string(forKey: "tonoVoz") ?? "") ?? .agudo {
    didSet { UserDefaults.standard.set(tono.rawValue, forKey: "tonoVoz") }
  }

  private let mic = Microfono()
  private let envio = Enviador()
  private let voz = AVSpeechSynthesizer()
  private var tareaEventos: Task<Void, Never>?
  private let locutora = AVSpeechSynthesisVoice.speechVoices().first { $0.language == "es-MX" && $0.name == "Paulina" } ?? AVSpeechSynthesisVoice(language: "es-MX")

  override init() {
    super.init()
    let envio = self.envio
    mic.alAudio = { [weak self] d, n in
      envio.agregar(d)
      Task { @MainActor in self?.nivel = n }
    }
    envio.peticion = { [weak self] in self?.peticionAudio() }
    let nc = NotificationCenter.default
    // Una llamada o Siri cortan el micrófono: al acabar, se vuelve a abrir solo.
    nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] n in
      let tipo = (n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt).flatMap(AVAudioSession.InterruptionType.init)
      Task { @MainActor in
        guard let self else { return }
        if tipo == .began { self.mic.detener() } else if tipo == .ended { self.reabrir() }
      }
    }
    nc.addObserver(forName: .AVAudioEngineConfigurationChange, object: nil, queue: .main) { [weak self] _ in
      Task { @MainActor in self?.reabrir() }
    }
    nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
      Task { @MainActor in self?.reabrir() }
    }
  }

  private nonisolated func tokenGuardado() -> String? { Llavero.leer() }

  private nonisolated func peticionAudio() -> URLRequest? {
    guard let t = tokenGuardado() else { return nil }
    var c = URLComponents(url: MAC.appendingPathComponent("api/copiloto/nucleo/audio"), resolvingAgainstBaseURL: false)!
    c.queryItems = [URLQueryItem(name: "canal", value: "mic"), URLQueryItem(name: "dispositivo", value: "telefono")]
    var r = URLRequest(url: c.url!)
    r.httpMethod = "POST"
    r.setValue(t, forHTTPHeaderField: "x-espacio-token")
    r.setValue(MAC.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forHTTPHeaderField: "Origin")
    return r
  }

  private func peticion(_ ruta: String, metodo: String = "POST", cuerpo: Data? = nil) -> URLRequest {
    var r = URLRequest(url: URL(string: ruta, relativeTo: MAC)!)
    r.httpMethod = metodo
    if let token { r.setValue(token, forHTTPHeaderField: "x-espacio-token") }
    r.setValue(MAC.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forHTTPHeaderField: "Origin")
    r.setValue("application/json", forHTTPHeaderField: "Content-Type")
    r.httpBody = cuerpo
    return r
  }

  func entrar(clave: String) async -> String? {
    let d = try? JSONSerialization.data(withJSONObject: ["accion": "token", "clave": clave])
    do {
      let (datos, res) = try await URLSession.shared.data(for: peticion("api/espacio-trabajo/acceso", cuerpo: d))
      let j = (try? JSONSerialization.jsonObject(with: datos)) as? [String: Any]
      if (res as? HTTPURLResponse)?.statusCode == 200, let t = j?["token"] as? String {
        Llavero.guardar(t)
        token = t
        conectar()
        return nil
      }
      return j?["error"] as? String ?? "No se pudo entrar."
    } catch {
      return "No se pudo conectar con la Mac. Revisa que Tailscale esté activo y la Mac encendida."
    }
  }

  private func salirDeSesion() {
    Llavero.guardar(nil)
    token = nil
    apagarCaptura()
    tareaEventos?.cancel()
  }

  @discardableResult
  private func llamar(_ ruta: String, cuerpo: Data? = nil) async -> Bool {
    do {
      let (d, res) = try await URLSession.shared.data(for: peticion("api/copiloto/nucleo/\(ruta)", cuerpo: cuerpo))
      let codigo = (res as? HTTPURLResponse)?.statusCode ?? 0
      if codigo == 401 { salirDeSesion(); return false }
      if codigo != 200 {
        let j = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any]
        aviso = j?["error"] as? String ?? (codigo == 404 ? "La Mac aún no tiene esta función instalada." : "La Mac respondió \(codigo).")
        return false
      }
      return true
    } catch {
      aviso = "No se pudo conectar con la Mac. Revisa que Tailscale esté activo y la Mac encendida."
      return false
    }
  }

  func alternar() { escuchando ? desactivar() : activar() }

  func activar() {
    aviso = nil; nota = nil
    Task {
      let permitido = await AVAudioApplication.requestRecordPermission()
      guard permitido else { aviso = "Falta el permiso del micrófono en Ajustes ▸ Gumdramon."; return }
      guard await llamar("activar?dispositivo=telefono") else { return }
      abrirCaptura()
    }
  }

  private func abrirCaptura() {
    do { try mic.iniciar(); envio.iniciar(); escuchando = true }
    catch { aviso = error.localizedDescription; escuchando = false }
  }
  private func reabrir() {
    guard escuchando else { return }
    mic.detener()
    do { try mic.iniciar() } catch { aviso = "El micrófono se cortó: \(error.localizedDescription)" }
  }
  private func apagarCaptura() {
    mic.detener(); envio.detener(); escuchando = false; nivel = 0
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  func desactivar() {
    voz.stopSpeaking(at: .immediate)
    apagarCaptura()
    Task { await llamar("desactivar") }
  }
  func terminar() {
    voz.stopSpeaking(at: .immediate)
    apagarCaptura()
    nota = "Guardando la transcripción…"
    Task { await llamar("terminar") }
  }
  func detenerConsulta() { Task { await llamar("detener") } }
  func enviar(_ texto: String) {
    guard let d = try? JSONSerialization.data(withJSONObject: ["texto": texto]) else { return }
    Task { await llamar("consulta", cuerpo: d) }
  }

  func decir(_ texto: String) {
    voz.stopSpeaking(at: .immediate)
    let limpio = texto
      .replacingOccurrences(of: "[*_`#>]", with: "", options: .regularExpression)
      .replacingOccurrences(of: #"\$\s*([0-9.,]+)"#, with: "$1 dólares", options: .regularExpression)
      .replacingOccurrences(of: #"([0-9.,]+)\s*\$"#, with: "$1 dólares", options: .regularExpression)
      .replacingOccurrences(of: "/mes", with: " al mes")
    guard !limpio.isEmpty else { return }
    let s = AVAudioSession.sharedInstance()
    if !mic.abierto {
      try? s.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      try? s.setActive(true)
    }
    let u = AVSpeechUtterance(string: limpio)
    u.voice = locutora
    u.pitchMultiplier = tono.pitch
    u.rate = 0.5
    voz.speak(u)
  }
  func probarVoz() { decir("Hola, soy Gumdramon. Gestión de Reservas cuesta 5 dólares al mes.") }

  func conectar() {
    tareaEventos?.cancel()
    guard token != nil else { return }
    tareaEventos = Task { await bucleEventos() }
  }

  private func bucleEventos() async {
    while !Task.isCancelled {
      do {
        var r = peticion("api/copiloto/nucleo/eventos", metodo: "GET")
        r.timeoutInterval = 3600
        let (bytes, res) = try await URLSession.shared.bytes(for: r)
        let codigo = (res as? HTTPURLResponse)?.statusCode ?? 0
        if codigo == 401 { salirDeSesion(); return }
        guard codigo == 200 else { throw URLError(.badServerResponse) }
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

  private func indice(_ j: [String: Any]) -> Int? {
    guard let id = j["id"] as? Int else { return nil }
    return consultas.firstIndex { $0.id == id }
  }

  private func recibir(_ e: String, _ j: [String: Any]) {
    switch e {
    case "estado":
      activo = j["activo"] as? Bool ?? false
      dispositivo = j["dispositivo"] as? String ?? "mac"
      if escuchando && (!activo || dispositivo != "telefono") { apagarCaptura() }
    case "transcripcion":
      lineas.append(Linea(quien: j["quien"] as? String ?? "", texto: j["texto"] as? String ?? ""))
      if lineas.count > 400 { lineas.removeFirst(lineas.count - 400) }
    case "escuchando":
      let sigue = j["activo"] as? Bool ?? false
      dictando = sigue ? (j["texto"] as? String ?? "") : nil
      restante = sigue ? (j["restante"] as? Double ?? (j["restante"] as? Int).map(Double.init)) : nil
      if let t = j["total"] as? Double ?? (j["total"] as? Int).map(Double.init) { totalEspera = t }
    case "consulta":
      dictando = nil
      if let id = j["id"] as? Int { consultas.append(Consulta(id: id, pregunta: j["pregunta"] as? String ?? "")) }
    case "buscando":
      if let i = indice(j) { consultas[i].buscando = true; consultas[i].respuesta = ""; consultas[i].detalle = j["detalle"] as? String }
    case "parcial":
      if let i = indice(j) { consultas[i].respuesta = j["texto"] as? String ?? ""; consultas[i].buscando = false }
    case "respuesta":
      if let i = indice(j) {
        consultas[i].respuesta = j["texto"] as? String ?? ""
        consultas[i].buscando = false
        consultas[i].terminada = true
        if vozActiva { decir(consultas[i].respuesta) }
      }
    case "descartada":
      if let i = indice(j) { consultas.remove(at: i) }
    case "terminada":
      apagarCaptura()
      nota = (j["conTranscripcion"] as? Bool ?? false) ? "Sesión terminada. Creando el recordatorio…" : "Sesión terminada, sin nada que guardar."
    case "recordatorio":
      nota = "Recordatorio creado: \(j["titulo"] as? String ?? "")"
    case "error":
      if let i = indice(j) { consultas.remove(at: i) }
      let m = j["mensaje"] as? String ?? "Error"
      aviso = m.lowercased().contains("limit") ? "Se alcanzó el límite de Claude: no habrá respuestas hasta que se libere." : m
    default: break
    }
  }
}
