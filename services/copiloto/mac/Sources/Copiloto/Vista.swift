import SwiftUI

private let violeta = Color(red: 0.48, green: 0.37, blue: 0.75)
let imagenPersonaje: NSImage? = Bundle.main.url(forResource: "gumdramon", withExtension: "png").flatMap { NSImage(contentsOf: $0) }

struct Medidor: View {
  let nombre: String
  let nivel: Float
  var body: some View {
    HStack(spacing: 5) {
      Text(nombre).font(.system(size: 10.5)).foregroundStyle(.secondary)
      GeometryReader { g in
        ZStack(alignment: .leading) {
          Capsule().fill(.white.opacity(0.1))
          Capsule().fill(nivel > 0.006 ? violeta : .white.opacity(0.25))
            .frame(width: g.size.width * CGFloat(min(1, nivel * 8)))
        }
      }
      .frame(width: 42, height: 3)
    }
  }
}

/// El botón amarillo de las ventanas de macOS, en su sitio: arriba a la izquierda. El área de clic es
/// mayor que el círculo, como en el sistema; un icono suelto solo respondía si se acertaba el trazo.
struct BotonMinimizar: View {
  let accion: () -> Void
  @State private var encima = false
  var body: some View {
    Button(action: accion) {
      ZStack {
        Circle().fill(Color(red: 1, green: 0.74, blue: 0.18))
        Circle().strokeBorder(.black.opacity(0.18), lineWidth: 0.5)
        if encima {
          Image(systemName: "minus").font(.system(size: 7, weight: .black)).foregroundStyle(Color(red: 0.6, green: 0.34, blue: 0))
        }
      }
      .frame(width: 12, height: 12)
      .frame(width: 22, height: 22)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .onHover { encima = $0 }
    .help("Minimizar al Dock")
    .accessibilityLabel("Minimizar al Dock")
  }
}

struct TarjetaConsulta: View {
  let c: Consulta
  let detener: () -> Void
  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(c.pregunta).font(.system(size: 11)).foregroundStyle(.secondary).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
      if c.respuesta.isEmpty && !c.terminada {
        HStack(spacing: 6) {
          ProgressView().controlSize(.mini)
          Text(c.buscando ? (c.detalle ?? "Investigando…") : "Pensando…").font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
          Spacer(minLength: 0)
          Button("Detener", action: detener).controlSize(.small).help("Corta esta investigación para no seguir gastando")
        }
      } else {
        Text(c.respuesta).font(.system(size: 14, weight: .medium)).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
      }
    }
    .padding(10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 9))
  }
}

/// La cuenta atrás: se llena mientras hablas y se vacía cuando callas; al acabar, se envía.
struct TarjetaDictado: View {
  let texto: String
  let restante: Double?
  let total: Double

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack(spacing: 8) {
        ZStack {
          Circle().stroke(.white.opacity(0.15), lineWidth: 3)
          Circle().trim(from: 0, to: CGFloat(min(1, (restante ?? total) / total)))
            .stroke(violeta, style: StrokeStyle(lineWidth: 3, lineCap: .round))
            .rotationEffect(.degrees(-90))
            .animation(.linear(duration: 0.12), value: restante)
          Text(String(Int((restante ?? total).rounded(.up)))).font(.system(size: 11, weight: .semibold)).monospacedDigit()
        }
        .frame(width: 28, height: 28)
        Text(restante == nil ? "Te escucho" : "Envío al llegar a 0. Si sigues hablando, vuelve a empezar.")
          .font(.system(size: 11)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
      }
      if !texto.isEmpty { Text(texto).font(.system(size: 13)).fixedSize(horizontal: false, vertical: true) }
    }
    .padding(10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .overlay(RoundedRectangle(cornerRadius: 9).stroke(violeta, lineWidth: 1))
  }
}

struct Widget: View {
  @ObservedObject var m: Modelo
  @Binding var plegado: Bool
  let minimizar: () -> Void
  @State private var vista = 0
  @State private var texto = ""
  @State private var confirmar = false

  var body: some View {
    VStack(spacing: 0) {
      cabecera
      if !plegado {
        Divider().opacity(0.4)
        if m.activo && m.dispositivo != "mac" { avisoFila("El micrófono lo tiene el iPhone: este Mac no está escuchando.") }
        if let a = m.avisoMic { avisoFila(a) }
        if let a = m.avisoSistema { avisoFila(a) }
        if let a = m.aviso { avisoFila(a) { m.aviso = nil } }
        Picker("", selection: $vista) {
          Text("Respuestas").tag(0)
          Text("Transcripción").tag(1)
        }
        .pickerStyle(.segmented).labelsHidden().padding(.horizontal, 12).padding(.top, 9)
        contenido
        pie
      }
    }
    .frame(minWidth: 300, maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .background(VisualEffect())
    .ignoresSafeArea(.all, edges: .top)
    .preferredColorScheme(.dark)
    .confirmationDialog("¿Terminar la sesión?", isPresented: $confirmar) {
      Button("Terminar y crear el recordatorio") { m.terminar() }
      Button("Seguir", role: .cancel) {}
    } message: {
      Text("La transcripción se guardará en Recordatorios.")
    }
  }

  private var escuchaBien: Bool { m.dispositivo == "mac" && m.avisoMic == nil && m.avisoSistema == nil }

  private func avisoFila(_ texto: String, cerrar: (() -> Void)? = nil) -> some View {
    HStack(alignment: .top, spacing: 6) {
      Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
      Text(texto).font(.system(size: 11.5)).fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 0)
      if let cerrar {
        Button(action: cerrar) { Image(systemName: "xmark").font(.system(size: 9)) }.buttonStyle(.plain).help("Cerrar aviso")
      }
    }
    .padding(.horizontal, 12).padding(.vertical, 7)
  }

  private var cabecera: some View {
    HStack(spacing: 9) {
      BotonMinimizar(accion: minimizar)
      Circle().fill(!m.conectado ? .red : !m.activo ? .gray : escuchaBien ? .green : .orange).frame(width: 8, height: 8)
        .help(!m.conectado ? "El núcleo no responde" : !m.activo ? "Desactivado" : escuchaBien ? "Escuchando" : "No está escuchando bien")
      if let i = imagenPersonaje { Image(nsImage: i).resizable().scaledToFit().frame(width: 20, height: 20) }
      Text(m.dictando != nil ? "Te escucho…" : "Gumdramon").font(.system(size: 13, weight: .semibold))
      if m.activo && !plegado {
        Medidor(nombre: "Tú", nivel: m.nivelMic)
        Medidor(nombre: "Cliente", nivel: m.nivelSistema)
      }
      Spacer(minLength: 0)
      Button { m.vozActiva.toggle() } label: {
        Image(systemName: m.vozActiva ? "speaker.wave.2.fill" : "speaker.slash").font(.system(size: 11))
          .foregroundStyle(m.vozActiva ? violeta : .secondary).frame(width: 18)
      }
      .buttonStyle(.plain)
      .help(m.vozActiva ? "Voz activada: leer las respuestas" : "Voz apagada")
      .accessibilityLabel(m.vozActiva ? "Apagar la voz" : "Activar la voz")
      Toggle("", isOn: Binding(get: { m.activo }, set: { _ in m.alternar() }))
        .toggleStyle(.switch).tint(violeta).controlSize(.mini).labelsHidden().disabled(!m.conectado)
        .help(m.activo ? "Desactivar" : "Activar")
      Button { plegado.toggle() } label: {
        Image(systemName: plegado ? "chevron.down" : "chevron.up").font(.system(size: 10, weight: .semibold))
      }
      .buttonStyle(.plain).help(plegado ? "Mostrar" : "Plegar")
    }
    .padding(.leading, 7).padding(.trailing, 12).frame(height: 38)
  }

  @ViewBuilder private var contenido: some View {
    ScrollViewReader { lector in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 7) {
          if vista == 0 {
            if m.consultas.isEmpty {
              Text(m.activo ? "Escuchando. Aparecerá algo aquí cuando haya una pregunta." : "Actívalo para empezar.")
                .font(.system(size: 12)).foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.top, 34)
            }
            ForEach(m.consultas) { TarjetaConsulta(c: $0, detener: { m.detenerConsulta() }).id($0.id) }
            if let d = m.dictando {
              TarjetaDictado(texto: d, restante: m.restante, total: m.totalEspera).id("dictado")
            }
          } else {
            ForEach(m.lineas) { l in
              (Text("\(l.quien): ").font(.system(size: 11.5, weight: .semibold)).foregroundColor(l.quien == "Cliente" ? violeta : .secondary)
                + Text(l.texto).font(.system(size: 12)))
                .textSelection(.enabled).fixedSize(horizontal: false, vertical: true).id(l.id)
            }
          }
        }
        .padding(12)
      }
      .onChange(of: m.consultas.last?.respuesta) { _, _ in
        if vista == 0, let u = m.consultas.last { withAnimation(.easeOut(duration: 0.2)) { lector.scrollTo(u.id, anchor: .bottom) } }
      }
      .onChange(of: m.dictando) { _, nuevo in
        if vista == 0, nuevo != nil { lector.scrollTo("dictado", anchor: .bottom) }
      }
      .onChange(of: m.lineas.count) { _, _ in
        if vista == 1, let u = m.lineas.last { lector.scrollTo(u.id, anchor: .bottom) }
      }
    }
    .frame(maxHeight: .infinity)
  }

  private var pie: some View {
    VStack(spacing: 7) {
      if let n = m.nota {
        Text(n).font(.system(size: 11.5)).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
      }
      HStack(spacing: 7) {
        TextField(m.activo ? "Pregúntale algo…" : "Actívalo para preguntar", text: $texto)
          .textFieldStyle(.roundedBorder).font(.system(size: 12.5)).disabled(!m.activo)
          .onSubmit {
            let t = texto.trimmingCharacters(in: .whitespacesAndNewlines)
            if !t.isEmpty { m.enviar(t); texto = "" }
          }
        if let u = m.sesionURL {
          Button { NSWorkspace.shared.open(u) } label: { Image(systemName: "arrow.up.right.square") }
            .controlSize(.small).help("Abrir esta sesión en el Espacio de trabajo")
        }
        Button("Terminar") { confirmar = true }.controlSize(.small).disabled(!m.activo && m.lineas.isEmpty)
          .help("Termina la reunión y guarda la transcripción en Recordatorios")
      }
    }
    .padding(12)
  }
}

struct VisualEffect: NSViewRepresentable {
  func makeNSView(context: Context) -> NSVisualEffectView {
    let v = NSVisualEffectView()
    v.material = .hudWindow
    v.blendingMode = .behindWindow
    v.state = .active
    return v
  }
  func updateNSView(_ v: NSVisualEffectView, context: Context) {}
}
