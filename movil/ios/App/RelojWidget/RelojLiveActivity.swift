import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

/**
 * Cómo se ve el reloj del ticket en la pantalla de bloqueo y en la isla dinámica (ficha
 * acordada con Fernando, 2026-10-06): logo GCC, ticket, cliente, el reloj grande, la tarifa y
 * un solo botón «Detener». Tocarla abre el ticket en la app.
 *
 * El morado es el de marca (`#4B2D8E`, `app/globals.css`); aquí no llega el CSS, así que va
 * escrito — si cambia el acento, cambiarlo también aquí (ver `Diseño.md`).
 */
private let morado = Color(red: 0x4B / 255, green: 0x2D / 255, blue: 0x8E / 255)

private struct Logo: View {
    var lado: CGFloat
    var body: some View {
        RoundedRectangle(cornerRadius: lado * 0.28, style: .continuous)
            .fill(morado)
            .frame(width: lado, height: lado)
            .overlay(
                Image("LogoGCC").resizable().renderingMode(.template).scaledToFit()
                    .foregroundStyle(.white).padding(lado * 0.16)
            )
    }
}

private struct Reloj: View {
    let estado: RelojAtributos.ContentState
    var body: some View {
        if let fin = estado.detenidoEn {
            Text(FormatoReloj.duracion(desde: estado.inicio, hasta: fin))
        } else {
            Text(timerInterval: estado.inicio...Date.distantFuture, countsDown: false)
        }
    }
}

private func enlace(_ ticketId: Int) -> URL? { URL(string: "gccworld://ticket/\(ticketId)") }

struct RelojLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RelojAtributos.self) { ctx in
            // Pantalla de bloqueo / banner.
            let a = ctx.attributes
            HStack(alignment: .center, spacing: 12) {
                Logo(lado: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.titulo).font(.headline).lineLimit(1)
                    Text([a.cliente, a.registro].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    if a.tarifa > 0 {
                        Text(FormatoReloj.tarifa(a.tarifa)).font(.caption2).foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 6) {
                    Reloj(estado: ctx.state)
                        .font(.system(size: 26, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 120, alignment: .trailing)
                    if ctx.state.detenidoEn == nil {
                        Button(intent: DetenerRelojIntent(registroId: a.registroId, ticketId: a.ticketId)) {
                            Label("Detener", systemImage: "stop.fill").font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(morado)
                    } else {
                        Text("Se enviará al volver la conexión").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            .padding(14)
            .activityBackgroundTint(Color(.systemBackground).opacity(0.85))
            .widgetURL(enlace(a.ticketId))
        } dynamicIsland: { ctx in
            let a = ctx.attributes
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Logo(lado: 34).padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Reloj(estado: ctx.state)
                        .font(.system(size: 24, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 110, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(a.titulo).font(.subheadline.weight(.semibold)).lineLimit(1)
                        Text(a.cliente).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if ctx.state.detenidoEn == nil {
                        Button(intent: DetenerRelojIntent(registroId: a.registroId, ticketId: a.ticketId)) {
                            Label("Detener", systemImage: "stop.fill").font(.caption.weight(.semibold))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(morado)
                    }
                }
            } compactLeading: {
                Logo(lado: 22)
            } compactTrailing: {
                Reloj(estado: ctx.state)
                    .monospacedDigit()
                    .frame(maxWidth: 56)
                    .foregroundStyle(Color(red: 0.75, green: 0.68, blue: 1))
            } minimal: {
                Logo(lado: 22)
            }
            .widgetURL(enlace(a.ticketId))
            .keylineTint(morado)
        }
    }
}
