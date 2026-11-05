import AVFoundation
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

/// El micrófono: lo que dice Fernando.
final class CapturaMicrofono {
  private let motor = AVAudioEngine()
  private let conversor = Conversor()
  private var observador: NSObjectProtocol?
  var alAudio: ((Data, Float) -> Void)?

  func iniciar() throws {
    let entrada = motor.inputNode
    let formato = entrada.outputFormat(forBus: 0)
    guard formato.sampleRate > 0 else { throw NSError(domain: "Copiloto", code: 1, userInfo: [NSLocalizedDescriptionKey: "No hay micrófono disponible."]) }
    entrada.installTap(onBus: 0, bufferSize: 4096, format: formato) { [weak self] b, _ in
      guard let self, let (d, nivel) = self.conversor.convertir(b) else { return }
      self.alAudio?(d, nivel)
    }
    try motor.start()
    // Conectar unos audífonos a media reunión cambia el formato y deja el motor parado.
    observador = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: motor, queue: .main) { [weak self] _ in
      guard let self else { return }
      self.detener()
      try? self.iniciar()
    }
  }

  func detener() {
    if let observador { NotificationCenter.default.removeObserver(observador) }
    observador = nil
    motor.inputNode.removeTap(onBus: 0)
    motor.stop()
  }
}

/// El audio del equipo: lo que dice el cliente. Un «tap» global de Core Audio, sin instalar controladores.
final class CapturaSistema {
  private var tap = AudioObjectID(kAudioObjectUnknown)
  private var agregado = AudioObjectID(kAudioObjectUnknown)
  private var proceso: AudioDeviceIOProcID?
  private let cola = DispatchQueue(label: "org.grupocc.copiloto.sistema", qos: .userInitiated)
  private let conversor = Conversor()
  var alAudio: ((Data, Float) -> Void)?

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

  func iniciar() throws {
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
      self.alAudio?(d, nivel)
    }, "No se pudo abrir la captura")
    try comprobar(AudioDeviceStart(agregado, proceso), "No se pudo iniciar la captura")
  }

  func detener() {
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
