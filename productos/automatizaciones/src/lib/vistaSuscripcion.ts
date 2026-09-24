import type { Contexto } from '@/lib/inquilino';
import { accesoDelContexto, topeUsuarios } from '@/lib/inquilino';
import type { SuscripcionVista } from '@/componentes/PanelSuscripcion';

/**
 * LO QUE SE LE ENSEÑA AL CLIENTE SOBRE SU SUSCRIPCIÓN, CALCULADO UNA VEZ.
 *
 * Lo usan las dos pantallas que la muestran —`Configuración → Suscripción` y la pantalla
 * de impago— para que digan lo mismo. Antes cada una armaba sus datos por su cuenta y el
 * resultado fue el previsible: una tenía el botón de pagar y la otra no.
 *
 * ⚠️ El estado de acceso sale de `accesoDelContexto`, **la misma función que usa la
 * puerta**. Si esta vista lo calculara aparte, podría decir «al día» a alguien a quien la
 * aplicación está bloqueando.
 */
export function vistaSuscripcion(ctx: Contexto): SuscripcionVista {
  const { inquilino, suscripcionGcc: sus } = ctx;
  const local = inquilino.suscripcion;

  // En UTC a propósito: `cubiertoHasta` y `seBloqueaEl` se construyen con `Date.UTC` y el
  // servidor corre en UTC. Formatearlas con la zona del proceso haría que un fin de mes a
  // las 23:59 se leyera como el día anterior.
  const fecha = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString('es-EC', {
          day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
        })
      : null;

  return {
    cortesia: inquilino.cortesia,
    acceso: accesoDelContexto(ctx),
    titulo: sus?.titulo ?? local?.plan.nombre ?? 'Sin plan',
    costoMensual: sus ? sus.costoMensual : Number(local?.plan.precioMensual ?? 0),
    moneda: sus?.moneda ?? local?.plan.moneda ?? 'USD',
    cubiertoHasta: fecha(sus ? sus.cubiertoHasta : local?.pagadoHasta),
    seBloqueaEl: fecha(sus?.seBloqueaEl),
    diasDeRetraso: sus?.diasDeRetraso ?? 0,
    // Sin suscripción de la plataforma no hay nada que cobrar desde aquí: el enlace de
    // pago se crea contra ELLA. Lista vacía = no se ofrece pagar, que es lo honesto.
    pendientes: sus?.pendientes ?? [],
    esperandoConfirmacion: sus?.esperandoConfirmacion
      ? { periodo: sus.esperandoConfirmacion.periodo }
      : null,
    maxUsuarios: topeUsuarios(inquilino),
    mesesRetencion: inquilino.cortesia ? null : (local?.plan.mesesRetencion ?? null),
  };
}
