/**
 * PIE DEL SITIO PÚBLICO — solo lo que es suyo.
 *
 * ── QUÉ LLEVA ──────────────────────────────────────────────────────────────────
 * Los **enlaces legales** y el **copyright**. Nada más.
 *
 * ── QUÉ NO LLEVA, Y POR QUÉ ────────────────────────────────────────────────────
 * · **La navegación.** La versión anterior repetía Inicio · Soluciones · Desarrollo Humano ·
 *   Contacto, que es **exactamente** lo que hay en la cabecera — y la cabecera está fija
 *   arriba, siempre visible. Repetir cuatro enlaces a sesenta píxeles del original no ayuda
 *   a nadie: solo hace el pie más alto. Lo vio Fernando en una captura donde las dos filas
 *   quedaban una encima de otra, casi idénticas.
 *
 * · **El logo y el nombre.** Mismo caso: ya presiden la cabecera.
 *
 * · **La identidad legal** —razón social, RUC, dirección—. Estuvo aquí a raíz del rechazo
 *   de verificación de Meta y no hacía falta: **esa dirección es la casa de Fernando** —al
 *   ser persona natural, el domicilio tributario es el particular— y **Meta no la busca en
 *   el pie**, la busca en la página que se le declara.
 *
 * Dónde sí va la identidad, porque hace falta:
 *   · `/clientes` y `/contacto` — las declaradas a Meta (la primera, como `/negocio`) y las que abre quien quiere contratar.
 *   · `/legal` y `/legal/whatsapp` — la **LOPDP exige** que el responsable del tratamiento
 *     sea identificable con su dirección. Ahí no es opcional.
 *
 * El resultado: una sola línea. La cabecera lleva a cualquier sitio; el pie solo tiene que
 * cerrar la página y dejar a mano lo legal, que no cabe arriba.
 */

import Link from 'next/link';
import { SITIO } from '@/lib/sitio/contenido';
import { Contenedor } from './piezas';

export default function PieSitio() {
  return (
    <footer
      /*
       * FIJO ABAJO EN TODAS LAS PÁGINAS (Fernando, 2026-08-18).
       *
       * Antes iba en el flujo, al final de la página, y por eso **aparecía a una altura
       * distinta en cada una**: en las cortas lo empujaba `flex-1` al borde inferior, en la
       * portada quedaba 24 px por debajo del pliegue —mide 35 px más que la pantalla— y en
       * las largas ni se veía. Cambiar de pestaña lo movía. Medido antes de tocar: el pie es
       * idéntico en las cinco páginas; lo que cambiaba era **dónde caía**.
       *
       * `fixed` lo clava al mismo punto de la pantalla en todas, que es lo que se pidió.
       *
       * ⚠️ Al salir del flujo **ya no empuja**: cada página le reserva el hueco con
       * `--alto-pie` (`app/globals.css`). Si algún día se le cambia el relleno o el tamaño
       * de letra, hay que actualizar esa variable — no está calculada sola.
       *
       * `z-50`: por debajo de la cabecera (`z-[60]`) y muy por debajo de los diálogos de
       * acceso (`z-[220]`), que deben taparlo.
       */
      className="fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.07] bg-[#080a10] py-5"
      itemScope
      itemType="https://schema.org/Organization"
    >
      <Contenedor className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between sm:gap-6">
        {/* El `itemProp="name"` viaja aquí: sin él, el microdato de Organization se queda
            sin nombre, y eso lo leen los buscadores. */}
        <p className="text-[12px] text-white/25 whitespace-nowrap">
          © {new Date().getFullYear()} <span itemProp="name">{SITIO.nombre}</span>
        </p>

        {/* UN SOLO enlace, no cuatro (decisión de Fernando, 2026-08-02). Antes había uno
            por documento —términos, agente de WhatsApp, eliminar datos, datos del negocio—
            y son cuatro entradas para un mismo tema. `/legal` los indexa todos arriba, así
            que desde aquí se llega a cualquiera con un clic más.
            ⚠️ Las URLs concretas NO desaparecen: `/legal/whatsapp#eliminar-datos` y
            `#condiciones` están declaradas en Meta y siguen funcionando. Lo que cambia es
            cuántas puertas hay en el pie, no cuántas páginas existen. */}
        <Link
          href="/legal"
          className="text-[12px] text-white/40 hover:text-white transition-colors whitespace-nowrap"
        >
          Legal y privacidad
        </Link>
      </Contenedor>
    </footer>
  );
}
