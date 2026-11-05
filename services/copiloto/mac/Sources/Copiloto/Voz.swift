import AVFoundation

/// Los tonos de la voz. La letra sigue nítida en todos: medido con Whisper hasta el 1,9.
enum TonoVoz: String, CaseIterable {
  case normal, agudo, muyAgudo
  var nombre: String { self == .normal ? "Normal" : self == .agudo ? "Agudo" : "Muy agudo" }
  var pitch: Float { self == .normal ? 1.25 : self == .agudo ? 1.55 : 1.85 }
}

/// LA VOZ DE GUMDRAMON. Gratis y local: el sintetizador del Mac con el tono subido; es una voz propia, no imita a
/// ningún actor. Se sintetiza a memoria y se reproduce AQUÍ, no con `speak()`: `speak()` sonaría en otro proceso,
/// y la captura del equipo solo puede excluir a este. Si no, se oiría como si fuera el cliente.
final class VozGumdramon {
  private let sintetizador = AVSpeechSynthesizer()
  private let motor = AVAudioEngine()
  private let jugador = AVAudioPlayerNode()
  private var conectadoA: AVAudioFormat?
  private var turno = 0

  var tono: TonoVoz = .agudo

  /// Paulina (México) es la más cercana al español de Ecuador.
  private let voz = AVSpeechSynthesisVoice.speechVoices().first { $0.language == "es-MX" && $0.name == "Paulina" }
    ?? AVSpeechSynthesisVoice(language: "es-MX")

  init() { motor.attach(jugador) }

  /// Lo que un sintetizador leería mal: markdown y símbolos.
  static func paraLeer(_ texto: String) -> String {
    texto
      .replacingOccurrences(of: "[*_`#>]", with: "", options: .regularExpression)
      .replacingOccurrences(of: #"\$\s*([0-9.,]+)"#, with: "$1 dólares", options: .regularExpression)
      .replacingOccurrences(of: #"([0-9.,]+)\s*\$"#, with: "$1 dólares", options: .regularExpression)
      .replacingOccurrences(of: "/mes", with: " al mes")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  func decir(_ texto: String) {
    callar()
    let limpio = Self.paraLeer(texto)
    guard !limpio.isEmpty else { return }
    let u = AVSpeechUtterance(string: limpio)
    u.voice = voz
    u.pitchMultiplier = tono.pitch
    u.rate = 0.5
    turno += 1
    let mio = turno
    sintetizador.write(u) { [weak self] b in
      guard let self, mio == self.turno, let p = b as? AVAudioPCMBuffer, p.frameLength > 0 else { return }
      self.reproducir(p)
    }
  }

  private func reproducir(_ p: AVAudioPCMBuffer) {
    if conectadoA != p.format {
      motor.stop()
      motor.disconnectNodeOutput(jugador)
      motor.connect(jugador, to: motor.mainMixerNode, format: p.format)
      conectadoA = p.format
    }
    if !motor.isRunning {
      motor.prepare()
      guard (try? motor.start()) != nil else { return }
    }
    jugador.scheduleBuffer(p, completionHandler: nil)
    if !jugador.isPlaying { jugador.play() }
  }

  func callar() {
    turno += 1
    sintetizador.stopSpeaking(at: .immediate)
    jugador.stop()
  }
}
