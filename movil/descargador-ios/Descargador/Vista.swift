import SwiftUI

@main
struct DescargadorApp: App {
    @StateObject private var descargas = Descargas()

    var body: some Scene {
        WindowGroup {
            Vista().environmentObject(descargas).tint(Color("Acento"))
        }
    }
}

/// La misma pantalla que en Android: enlace → tarjeta con calidades → progreso → resultado.
struct Vista: View {
    @EnvironmentObject private var d: Descargas
    @State private var texto = ""
    @State private var calidad = Calidad.mejor
    @AppStorage("aviso_aceptado") private var avisoAceptado = false
    @FocusState private var enfocado: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    switch d.estado {
                    case .arrancando:
                        HStack(spacing: 12) { ProgressView(); Text("Preparando el motor…").foregroundStyle(.secondary) }
                    case .libre, .buscando:
                        formulario
                    case let .bajando(fase, fases, porcentaje, eta):
                        progreso(fase: fase, fases: fases, porcentaje: porcentaje, eta: eta)
                    case .guardando:
                        progresoGuardando
                    case let .listo(titulo, audio):
                        resultado(titulo: titulo, audio: audio)
                    }
                    Spacer(minLength: 24)
                    motor
                }
                .padding(16)
            }
            .navigationTitle("Descargador GCC")
            .background(Color(.systemGroupedBackground))
        }
        .alert("Uso responsable", isPresented: .constant(!avisoAceptado)) {
            Button("Entendido") { avisoAceptado = true }
        } message: {
            Text("Descarga solo videos tuyos, de autores que te dieron permiso o con licencia libre (por ejemplo, Creative Commons). Respeta los derechos de autor y las condiciones de cada plataforma.")
        }
        .alert("No se pudo descargar", isPresented: Binding(get: { d.error != nil }, set: { if !$0 { d.error = nil } })) {
            Button("Entendido", role: .cancel) {}
        } message: { Text(d.error ?? "") }
        .alert(d.avisoMotor ?? "", isPresented: Binding(get: { d.avisoMotor != nil }, set: { if !$0 { d.avisoMotor = nil } })) {
            Button("Entendido", role: .cancel) {}
        }
    }

    private var buscando: Bool { if case .buscando = d.estado { true } else { false } }

    @ViewBuilder private var formulario: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                TextField("Enlace del video", text: $texto)
                    .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .submitLabel(.search).focused($enfocado)
                    .onSubmit(buscar)
                    .padding(12)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
                PasteButton(payloadType: String.self) { textos in
                    guard let t = textos.first, let url = Descargas.enlace(en: t) else { return }
                    DispatchQueue.main.async { texto = url; buscar() }
                }
                .labelStyle(.iconOnly).buttonBorderShape(.roundedRectangle(radius: 10))
            }
            Button(action: buscar) {
                Text("Buscar").frame(maxWidth: .infinity).padding(.vertical, 6)
            }
            .buttonStyle(.bordered).disabled(buscando || texto.isEmpty)
            if buscando { ProgressView().progressViewStyle(.linear) }
        }
        if let info = d.info { tarjeta(info) }
    }

    private func tarjeta(_ info: InfoVideo) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            AsyncImage(url: info.miniatura) { img in img.resizable().aspectRatio(16 / 9, contentMode: .fill) } placeholder: {
                Color(.tertiarySystemFill)
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            Text(info.titulo).font(.headline)
            if !info.detalle.isEmpty { Text(info.detalle).font(.subheadline).foregroundStyle(.secondary) }
            Text("Calidad").font(.subheadline.weight(.semibold))
            Picker("Calidad", selection: $calidad) {
                ForEach(Calidad.allCases) { Text($0.etiqueta).tag($0) }
            }
            .pickerStyle(.segmented)
            Button { d.descargar(calidad) } label: {
                Text("Descargar").frame(maxWidth: .infinity).padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    private func progreso(fase: Int, fases: Int, porcentaje: Double, eta: Int?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(d.info?.titulo ?? "").font(.headline)
            if porcentaje <= 0 {
                ProgressView().progressViewStyle(.linear)
                Text("Preparando…").font(.subheadline).foregroundStyle(.secondary)
            } else {
                ProgressView(value: porcentaje, total: 100)
                let parte = fases > 1 ? (fase == 1 ? "Video · " : "Audio · ") : ""
                let quedan = (eta ?? 0) > 0 ? " · quedan \(Descargas.duracion(eta!))" : ""
                Text("\(parte)\(Int(porcentaje)) %\(quedan)").font(.subheadline).foregroundStyle(.secondary).monospacedDigit()
            }
            Text("Deja la app abierta hasta que termine.").font(.footnote).foregroundStyle(.secondary)
            Button("Cancelar", role: .cancel) { d.cancelar() }.buttonStyle(.bordered)
        }
    }

    private var progresoGuardando: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(d.info?.titulo ?? "").font(.headline)
            ProgressView().progressViewStyle(.linear)
            Text("Guardando…").font(.subheadline).foregroundStyle(.secondary)
        }
    }

    private func resultado(titulo: String, audio: URL?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Descarga lista", systemImage: "checkmark.circle.fill").font(.title3.weight(.semibold)).foregroundStyle(Color("Acento"))
            Text(titulo).font(.headline)
            if let audio {
                Text("Guardado en Archivos ▸ En mi iPhone ▸ Descargador GCC.").foregroundStyle(.secondary)
                ShareLink(item: audio) { Label("Compartir", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity).padding(.vertical, 6) }
                    .buttonStyle(.borderedProminent)
            } else {
                Text("Guardado en Fotos.").foregroundStyle(.secondary)
                Button {
                    if let url = URL(string: "photos-redirect://") { UIApplication.shared.open(url) }
                } label: { Text("Abrir Fotos").frame(maxWidth: .infinity).padding(.vertical, 6) }
                    .buttonStyle(.borderedProminent)
            }
            Button {
                texto = ""
                d.otra()
            } label: { Text("Descargar otro").frame(maxWidth: .infinity).padding(.vertical, 6) }
                .buttonStyle(.bordered)
        }
    }

    private var motor: some View {
        VStack(spacing: 6) {
            Button(d.actualizando ? "Actualizando…" : "Actualizar motor de descarga") { d.actualizarMotor() }
                .disabled(d.actualizando || { if case .libre = d.estado { false } else { true } }())
            if !d.versionMotor.isEmpty { Text("yt-dlp \(d.versionMotor)").font(.caption).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity)
    }

    private func buscar() {
        enfocado = false
        d.buscar(texto.trimmingCharacters(in: .whitespacesAndNewlines))
    }
}
