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

struct TarjetaConsulta: View {
  let c: Consulta
  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(c.pregunta).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(2)
      if c.respuesta.isEmpty && !c.terminada {
        HStack(spacing: 6) {
          ProgressView().controlSize(.mini)
          Text(c.buscando ? "Buscando…" : "Pensando…").font(.system(size: 12)).foregroundStyle(.secondary)
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

struct Widget: View {
  @ObservedObject var m: Modelo
  @Binding var plegado: Bool
  @State private var vista = 0
  @State private var texto = ""
  @State private var confirmar = false

  var body: some View {
    VStack(spacing: 0) {
      cabecera
      if !plegado {
        Divider().opacity(0.4)
        if let a = m.aviso {
          HStack(alignment: .top, spacing: 6) {
            Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
            Text(a).font(.system(size: 11.5)).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button { m.aviso = nil } label: { Image(systemName: "xmark").font(.system(size: 9)) }.buttonStyle(.plain).help("Cerrar aviso")
          }
          .padding(.horizontal, 12).padding(.vertical, 7)
        }
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

  private var cabecera: some View {
    HStack(spacing: 9) {
      Circle().fill(!m.conectado ? .red : m.activo ? .green : .gray).frame(width: 8, height: 8)
        .help(!m.conectado ? "El núcleo no responde" : m.activo ? "Escuchando" : "Desactivado")
      if let i = imagenPersonaje { Image(nsImage: i).resizable().scaledToFit().frame(width: 20, height: 20) }
      Text(m.dictando != nil ? "Te escucho…" : "Gumdramon").font(.system(size: 13, weight: .semibold))
      if m.activo && !plegado {
        Medidor(nombre: "Tú", nivel: m.nivelMic)
        Medidor(nombre: "Cliente", nivel: m.nivelSistema)
      }
      Spacer(minLength: 0)
      Toggle("", isOn: Binding(get: { m.activo }, set: { _ in m.alternar() }))
        .toggleStyle(.switch).tint(violeta).controlSize(.mini).labelsHidden().disabled(!m.conectado)
        .help(m.activo ? "Desactivar" : "Activar")
      Button { plegado.toggle() } label: {
        Image(systemName: plegado ? "chevron.down" : "chevron.up").font(.system(size: 10, weight: .semibold))
      }
      .buttonStyle(.plain).help(plegado ? "Mostrar" : "Plegar")
    }
    .padding(.horizontal, 12).frame(height: 38)
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
            ForEach(m.consultas) { TarjetaConsulta(c: $0).id($0.id) }
            if let d = m.dictando {
              VStack(alignment: .leading, spacing: 5) {
                Label("Te escucho. Cuando termines, haz una pausa.", systemImage: "waveform").font(.system(size: 11)).foregroundStyle(.secondary)
                if !d.isEmpty { Text(d).font(.system(size: 13)).fixedSize(horizontal: false, vertical: true) }
              }
              .padding(10)
              .frame(maxWidth: .infinity, alignment: .leading)
              .overlay(RoundedRectangle(cornerRadius: 9).stroke(violeta, lineWidth: 1))
              .id("dictado")
            }
          } else {
            ForEach(m.lineas) { l in
              (Text("\(l.quien): ").font(.system(size: 11.5, weight: .semibold)).foregroundColor(l.quien == "Cliente" ? violeta : .secondary)
                + Text(l.texto).font(.system(size: 12)))
                .textSelection(.enabled).id(l.id)
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
