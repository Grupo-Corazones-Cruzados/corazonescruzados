import SwiftUI

private let violeta = Color(red: 0.55, green: 0.42, blue: 0.85)

@main
struct GumdramonApp: App {
  @StateObject private var m = Modelo()
  var body: some Scene {
    WindowGroup {
      Group {
        if m.token == nil { Acceso(m: m) } else { Principal(m: m) }
      }
      .preferredColorScheme(.dark)
      .tint(violeta)
      .onAppear { m.conectar() }
    }
  }
}

struct Acceso: View {
  @ObservedObject var m: Modelo
  @State private var clave = ""
  @State private var error: String?
  @State private var enviando = false
  var body: some View {
    VStack(spacing: 16) {
      Image(uiImage: UIImage(named: "Personaje") ?? UIImage()).resizable().scaledToFit().frame(width: 90, height: 90)
      Text("Gumdramon").font(.title2.weight(.semibold))
      SecureField("Contraseña del Espacio de trabajo", text: $clave)
        .textContentType(.password).textFieldStyle(.roundedBorder).onSubmit(entrar)
      if let error { Text(error).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center) }
      Button(action: entrar) { Group { if enviando { ProgressView() } else { Text("Entrar") } }.frame(maxWidth: .infinity) }
        .buttonStyle(.borderedProminent).controlSize(.large).disabled(clave.isEmpty || enviando)
    }
    .padding(28)
    .frame(maxHeight: .infinity)
  }
  private func entrar() {
    enviando = true; error = nil
    Task { error = await m.entrar(clave: clave); enviando = false; if error == nil { clave = "" } }
  }
}

struct CuentaAtras: View {
  let restante: Double?
  let total: Double
  var body: some View {
    ZStack {
      Circle().stroke(.white.opacity(0.15), lineWidth: 3)
      Circle().trim(from: 0, to: CGFloat(min(1, (restante ?? total) / total)))
        .stroke(violeta, style: StrokeStyle(lineWidth: 3, lineCap: .round))
        .rotationEffect(.degrees(-90))
        .animation(.linear(duration: 0.12), value: restante)
      Text(String(Int((restante ?? total).rounded(.up)))).font(.caption.weight(.semibold)).monospacedDigit()
    }
    .frame(width: 32, height: 32)
  }
}

struct Principal: View {
  @ObservedObject var m: Modelo
  @State private var vista = 0
  @State private var texto = ""
  @State private var confirmar = false

  private var estado: String {
    if !m.conectado { return "Sin conexión con la Mac" }
    if m.escuchando { return "Escuchando desde este iPhone" }
    if m.activo && m.dispositivo != "telefono" { return "Escuchando desde la Mac" }
    return "Desactivado"
  }

  var body: some View {
    VStack(spacing: 0) {
      HStack(spacing: 10) {
        Image(uiImage: UIImage(named: "Personaje") ?? UIImage()).resizable().scaledToFit().frame(width: 34, height: 34)
        VStack(alignment: .leading, spacing: 1) {
          Text(m.dictando != nil ? "Te escucho…" : "Gumdramon").font(.headline)
          Text(estado).font(.caption).foregroundStyle(.secondary).lineLimit(1)
        }
        Spacer(minLength: 0)
        if m.escuchando {
          GeometryReader { g in
            ZStack(alignment: .leading) {
              Capsule().fill(.white.opacity(0.12))
              Capsule().fill(violeta).frame(width: g.size.width * CGFloat(min(1, m.nivel * 8)))
            }
          }.frame(width: 44, height: 4)
        }
        Menu {
          Button(m.vozActiva ? "Apagar la voz" : "Activar la voz") { m.vozActiva.toggle() }
          Button("Probar la voz") { m.probarVoz() }
          Picker("Tono", selection: $m.tono) { ForEach(TonoVoz.allCases, id: \.self) { Text($0.nombre).tag($0) } }
        } label: {
          Image(systemName: m.vozActiva ? "speaker.wave.2.fill" : "speaker.slash").frame(width: 40, height: 40)
            .foregroundStyle(m.vozActiva ? violeta : .secondary)
        }
        .accessibilityLabel("Voz")
      }
      .padding(.horizontal, 14).padding(.vertical, 8)
      Divider()

      if let a = m.aviso {
        HStack(alignment: .top, spacing: 8) {
          Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
          Text(a).font(.footnote).frame(maxWidth: .infinity, alignment: .leading)
          Button { m.aviso = nil } label: { Image(systemName: "xmark").font(.caption) }.accessibilityLabel("Cerrar aviso")
        }
        .padding(.horizontal, 14).padding(.vertical, 8)
        Divider()
      }

      Picker("Vista", selection: $vista) { Text("Respuestas").tag(0); Text("Transcripción").tag(1) }
        .pickerStyle(.segmented).padding(.horizontal, 14).padding(.top, 10)

      ScrollViewReader { lector in
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 10) {
            if vista == 0 { respuestas } else { transcripcion }
            Color.clear.frame(height: 1).id("fin")
          }
          .padding(14)
        }
        .onChange(of: m.consultas.last?.respuesta) { _, _ in lector.scrollTo("fin") }
        .onChange(of: m.dictando) { _, _ in lector.scrollTo("fin") }
        .onChange(of: m.lineas.count) { _, _ in if vista == 1 { lector.scrollTo("fin") } }
      }
      .frame(maxHeight: .infinity)

      Divider()
      VStack(spacing: 8) {
        if let n = m.nota { Text(n).font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading) }
        HStack(spacing: 8) {
          TextField(m.activo ? "Pregúntale algo…" : "Actívalo para preguntar", text: $texto).textFieldStyle(.roundedBorder).disabled(!m.activo).onSubmit(enviar)
          Button(action: enviar) { Image(systemName: "paperplane") }.disabled(!m.activo || texto.trimmingCharacters(in: .whitespaces).isEmpty).accessibilityLabel("Enviar")
        }
        HStack(spacing: 8) {
          Button { confirmar = true } label: { Text("Terminar").frame(maxWidth: .infinity) }.buttonStyle(.bordered).controlSize(.large).disabled(!m.activo && m.lineas.isEmpty)
          Button { m.alternar() } label: { Text(m.escuchando ? "Desactivar" : (m.activo ? "Usar este iPhone" : "Activar")).frame(maxWidth: .infinity) }
            .buttonStyle(.borderedProminent).controlSize(.large).disabled(!m.conectado)
        }
      }
      .padding(14)
    }
    .confirmationDialog("¿Terminar la sesión?", isPresented: $confirmar, titleVisibility: .visible) {
      Button("Terminar y crear el recordatorio") { m.terminar() }
      Button("Seguir", role: .cancel) {}
    }
  }

  @ViewBuilder private var respuestas: some View {
    if m.consultas.isEmpty && m.dictando == nil {
      Text(m.escuchando ? "Di «GUMDRAMON» y tu pregunta." : "Actívalo para empezar.").font(.subheadline).foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.top, 40)
    }
    ForEach(m.consultas) { c in
      VStack(alignment: .leading, spacing: 6) {
        Text(c.pregunta).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        if c.respuesta.isEmpty && !c.terminada {
          HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text(c.buscando ? (c.detalle ?? "Investigando…") : "Pensando…").font(.footnote).foregroundStyle(.secondary).lineLimit(1)
            Spacer(minLength: 0)
            Button("Detener") { m.detenerConsulta() }.buttonStyle(.bordered).controlSize(.small)
          }
        } else {
          Text(c.respuesta).font(.body.weight(.medium)).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
        }
      }
      .padding(12)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
    }
    if let d = m.dictando {
      VStack(alignment: .leading, spacing: 8) {
        HStack(spacing: 10) {
          CuentaAtras(restante: m.restante, total: m.totalEspera)
          Text(m.restante == nil ? "Te escucho" : "Envío al llegar a 0. Si sigues hablando, vuelve a empezar.").font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
        if !d.isEmpty { Text(d).font(.subheadline).fixedSize(horizontal: false, vertical: true) }
      }
      .padding(12)
      .frame(maxWidth: .infinity, alignment: .leading)
      .overlay(RoundedRectangle(cornerRadius: 12).stroke(violeta, lineWidth: 1))
    }
  }

  @ViewBuilder private var transcripcion: some View {
    if m.lineas.isEmpty { Text("Todavía no hay transcripción.").font(.subheadline).foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.top, 40) }
    ForEach(m.lineas) { l in
      (Text("\(l.quien): ").font(.footnote.weight(.semibold)).foregroundColor(l.quien == "Cliente" ? violeta : .secondary) + Text(l.texto).font(.footnote))
        .textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
    }
  }

  private func enviar() {
    let t = texto.trimmingCharacters(in: .whitespacesAndNewlines)
    if !t.isEmpty { m.enviar(t); texto = "" }
  }
}
