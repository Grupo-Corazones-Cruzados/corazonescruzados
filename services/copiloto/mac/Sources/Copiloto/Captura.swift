import AVFoundation
import CapturaObjC
import CoreAudio

/// Lo que espera el núcleo: PCM de 16 bits, 16 kHz, un canal.
let formatoNucleo = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!

/// Pasa cualquier formato de entrada al del núcleo.
final class Conversor {
  private var conversor: AVAudioConverter?
  private var entrada: AVAudioFormat?

  func convertir(_ buffer: AVAudioPCMBuffer) -> (Data, Float)? {
    if entrada != buffer.format {
      entrada = buffer.format
      conversor = AVAudioConverter(from: buffer.format, to: formatoNucleo)
    }
    guard let conversor else { return nil }
    let capacidad = AVAudioFrameCount(Double(buffer.frameLength) * 16000 / buffer.format.sampleRate) + 32
    guard let salida = AVAudioPCMBuffer(pcmFormat: formatoNucleo, frameCapacity: capacidad) else { return nil }
    var entregado = false
    var error: NSError?
    conversor.convert(to: salida, error: &error) { _, estado in
      if entregado { estado.pointee = .noDataNow; return nil }
      entregado = true
      estado.pointee = .haveData
      return buffer
    }
    guard error == nil, salida.frameLength > 0, let datos = salida.int16ChannelData?[0] else { return nil }
    let n = Int(salida.frameLength)
    var suma: Float = 0
    for i in 0..<n { let v = Float(datos[i]) / 32768; suma += v * v }
    return (Data(bytes: datos, count: n * 2), (suma / Float(n)).squareRoot())
  }
}

/// Mantiene viva una captura. Teams y otras apps de llamadas cambian el dispositivo o su formato en
/// cualquier momento, también mientras la captura está parada; reabrirla puede fallar un instante
/// después del cambio. Por eso nada se da por hecho: lo que manda es si sigue llegando audio.
final class Supervisor {
  /// Ni con silencio dejan de llegar búferes: su ausencia significa que la captura murió.
  private static let sinAudio: TimeInterval = 3
  private static let avisarTras: TimeInterval = 5
  private static let entreIntentos: TimeInterval = 2

  private let nombre: String
  private let abrir: () throws -> Void
  private let cerrar: () -> Void
  private let cerrojo = NSLock()
  private var ultimoAudio = Date()
  private var ultimoIntento = Date.distantPast
  private var vigia: Timer?
  private var reapertura: DispatchWorkItem?
  private var ultimoError: String?
  private var avisando = false
  var alEstado: ((String?) -> Void)?

  init(nombre: String, abrir: @escaping () throws -> Void, cerrar: @escaping () -> Void) {
    self.nombre = nombre
    self.abrir = abrir
    self.cerrar = cerrar
  }

  private var silencio: TimeInterval {
    cerrojo.lock(); defer { cerrojo.unlock() }
    return Date().timeIntervalSince(ultimoAudio)
  }

  /// Desde el hilo de audio.
  func latido() {
    cerrojo.lock(); ultimoAudio = Date(); cerrojo.unlock()
  }

  func iniciar() {
    guard vigia == nil else { return }
    latido()
    intentar()
    let t = Timer(timeInterval: 1, repeats: true) { [weak self] _ in self?.vigilar() }
    RunLoop.main.add(t, forMode: .common)
    vigia = t
  }

  func detener() {
    vigia?.invalidate()
    vigia = nil
    reapertura?.cancel()
    reapertura = nil
    cerrar()
    ultimoError = nil
    if avisando { avisando = false; alEstado?(nil) }
  }

  /// Los cambios llegan en ráfaga: se espera a que pase antes de reabrir.
  func reabrirPronto() {
    reapertura?.cancel()
    let tarea = DispatchWorkItem { [weak self] in
      guard let self, self.vigia != nil else { return }
      self.intentar()
    }
    reapertura = tarea
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: tarea)
  }

  private func intentar() {
    ultimoIntento = Date()
    cerrar()
    do {
      try abrir()
      ultimoError = nil
    } catch {
      ultimoError = error.localizedDescription
      cerrar()
    }
  }

  private func vigilar() {
    let s = silencio
    if s < Self.sinAudio {
      if avisando { avisando = false; alEstado?(nil) }
      return
    }
    if s >= Self.avisarTras && !avisando {
      avisando = true
      alEstado?("No llega audio de \(nombre). Reintentando…" + (ultimoError.map { " (\($0))" } ?? ""))
    }
    if Date().timeIntervalSince(ultimoIntento) >= Self.entreIntentos { intentar() }
  }
}

/// El micrófono: lo que dice Fernando.
final class CapturaMicrofono {
  /// Un motor nuevo cada vez: el anterior guarda el formato del dispositivo de cuando arrancó y, si
  /// cambió mientras estaba parado, `installTap` lanza una excepción («Format mismatch»).
  private var motor: AVAudioEngine?
  private let conversor = Conversor()
  private var observador: NSObjectProtocol?
  private lazy var supervisor = Supervisor(nombre: "tu micrófono", abrir: { [unowned self] in try self.abrir() }, cerrar: { [unowned self] in self.cerrar() })
  var alAudio: ((Data, Float) -> Void)?
  var alEstado: ((String?) -> Void)? { didSet { supervisor.alEstado = alEstado } }

  func iniciar() { supervisor.iniciar() }
  func detener() { supervisor.detener() }

  private func abrir() throws {
    let nuevo = AVAudioEngine()
    motor = nuevo
    // Se escucha antes de arrancar: si no, un arranque fallido dejaba de enterarse de los cambios siguientes.
    observador = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: nuevo, queue: .main) { [weak self] _ in
      self?.supervisor.reabrirPronto()
    }
    let entrada = nuevo.inputNode
    let formato = entrada.outputFormat(forBus: 0)
    guard formato.sampleRate > 0, formato.channelCount > 0 else {
      throw NSError(domain: "Copiloto", code: 1, userInfo: [NSLocalizedDescriptionKey: "No hay micrófono disponible."])
    }
    try Proteger.ejecutar {
      entrada.installTap(onBus: 0, bufferSize: 4096, format: nil) { [weak self] b, _ in
        guard let self, let (d, nivel) = self.conversor.convertir(b) else { return }
        self.supervisor.latido()
        self.alAudio?(d, nivel)
      }
    }
    try nuevo.start()
  }

  private func cerrar() {
    if let observador { NotificationCenter.default.removeObserver(observador) }
    observador = nil
    guard let actual = motor else { return }
    try? Proteger.ejecutar {
      actual.inputNode.removeTap(onBus: 0)
      actual.stop()
    }
    motor = nil
  }
}

/// El audio del equipo: lo que dice el cliente. Un «tap» global de Core Audio, sin instalar controladores.
final class CapturaSistema {
  private var tap = AudioObjectID(kAudioObjectUnknown)
  private var agregado = AudioObjectID(kAudioObjectUnknown)
  private var proceso: AudioDeviceIOProcID?
  private let cola = DispatchQueue(label: "org.grupocc.copiloto.sistema", qos: .userInitiated)
  private let conversor = Conversor()
  private var cambioSalida: AudioObjectPropertyListenerBlock?
  private var cambioFormato: AudioObjectPropertyListenerBlock?
  private lazy var supervisor = Supervisor(nombre: "la reunión (audio del equipo)", abrir: { [unowned self] in try self.abrir() }, cerrar: { [unowned self] in self.cerrar() })
  var alAudio: ((Data, Float) -> Void)?
  var alEstado: ((String?) -> Void)? { didSet { supervisor.alEstado = alEstado } }

  func iniciar() { supervisor.iniciar() }
  func detener() { supervisor.detener() }

  private static var direccionSalida = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
  private static var direccionFormato = AudioObjectPropertyAddress(mSelector: kAudioTapPropertyFormat, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)

  private func comprobar(_ estado: OSStatus, _ que: String) throws {
    if estado != noErr { throw NSError(domain: "Copiloto", code: Int(estado), userInfo: [NSLocalizedDescriptionKey: "\(que) (\(estado))"]) }
  }

  private func procesoPropio() -> AudioObjectID? {
    var pid = getpid()
    var objeto = AudioObjectID(kAudioObjectUnknown)
    var t = UInt32(MemoryLayout<AudioObjectID>.size)
    var dir = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyTranslatePIDToProcessObject, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    let e = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &dir, UInt32(MemoryLayout<pid_t>.size), &pid, &t, &objeto)
    return e == noErr && objeto != kAudioObjectUnknown ? objeto : nil
  }

  private func salidaPorDefecto() throws -> String {
    var d = AudioDeviceID(0)
    var t = UInt32(MemoryLayout<AudioDeviceID>.size)
    var dir = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    try comprobar(AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &dir, 0, nil, &t, &d), "No se encontró la salida de audio")
    var uid: Unmanaged<CFString>?
    t = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    dir.mSelector = kAudioDevicePropertyDeviceUID
    try comprobar(AudioObjectGetPropertyData(d, &dir, 0, nil, &t, &uid), "No se pudo leer la salida de audio")
    return uid!.takeRetainedValue() as String
  }

  private func abrir() throws {
    // Sin la voz de la propia app: se oiría como si fuera el cliente y podría responderse a sí misma.
    let descripcion = CATapDescription(stereoGlobalTapButExcludeProcesses: procesoPropio().map { [$0] } ?? [])
    descripcion.uuid = UUID()
    descripcion.muteBehavior = .unmuted
    descripcion.isPrivate = true
    descripcion.name = "Copiloto"
    try comprobar(AudioHardwareCreateProcessTap(descripcion, &tap), "No se pudo escuchar el audio del equipo")

    let salida = try salidaPorDefecto()
    let ajustes: [String: Any] = [
      kAudioAggregateDeviceNameKey: "Copiloto",
      kAudioAggregateDeviceUIDKey: UUID().uuidString,
      kAudioAggregateDeviceMainSubDeviceKey: salida,
      kAudioAggregateDeviceIsPrivateKey: true,
      kAudioAggregateDeviceIsStackedKey: false,
      kAudioAggregateDeviceTapAutoStartKey: true,
      kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: salida]],
      kAudioAggregateDeviceTapListKey: [[kAudioSubTapDriftCompensationKey: true, kAudioSubTapUIDKey: descripcion.uuid.uuidString]],
    ]
    try comprobar(AudioHardwareCreateAggregateDevice(ajustes as CFDictionary, &agregado), "No se pudo preparar la captura")

    var asbd = AudioStreamBasicDescription()
    var t = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
    var dir = AudioObjectPropertyAddress(mSelector: kAudioTapPropertyFormat, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    try comprobar(AudioObjectGetPropertyData(tap, &dir, 0, nil, &t, &asbd), "No se pudo leer el formato")
    guard let formato = AVAudioFormat(streamDescription: &asbd) else {
      throw NSError(domain: "Copiloto", code: 2, userInfo: [NSLocalizedDescriptionKey: "Formato de audio desconocido."])
    }

    try comprobar(AudioDeviceCreateIOProcIDWithBlock(&proceso, agregado, cola) { [weak self] _, datos, _, _, _ in
      guard let self, let b = AVAudioPCMBuffer(pcmFormat: formato, bufferListNoCopy: datos, deallocator: nil) else { return }
      guard let (d, nivel) = self.conversor.convertir(b) else { return }
      self.supervisor.latido()
      self.alAudio?(d, nivel)
    }, "No se pudo abrir la captura")
    try comprobar(AudioDeviceStart(agregado, proceso), "No se pudo iniciar la captura")

    // El agregado queda atado a la salida y al formato con que nació: si cambian, se rehace.
    let reabrir: AudioObjectPropertyListenerBlock = { [weak self] _, _ in self?.supervisor.reabrirPronto() }
    cambioSalida = reabrir
    cambioFormato = reabrir
    AudioObjectAddPropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &Self.direccionSalida, .main, reabrir)
    AudioObjectAddPropertyListenerBlock(tap, &Self.direccionFormato, .main, reabrir)
  }

  private func cerrar() {
    if let cambioSalida { AudioObjectRemovePropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &Self.direccionSalida, .main, cambioSalida) }
    if let cambioFormato, tap != kAudioObjectUnknown { AudioObjectRemovePropertyListenerBlock(tap, &Self.direccionFormato, .main, cambioFormato) }
    cambioSalida = nil
    cambioFormato = nil
    if let proceso {
      AudioDeviceStop(agregado, proceso)
      AudioDeviceDestroyIOProcID(agregado, proceso)
    }
    proceso = nil
    if agregado != kAudioObjectUnknown { AudioHardwareDestroyAggregateDevice(agregado) }
    agregado = AudioObjectID(kAudioObjectUnknown)
    if tap != kAudioObjectUnknown { AudioHardwareDestroyProcessTap(tap) }
    tap = AudioObjectID(kAudioObjectUnknown)
  }
}
