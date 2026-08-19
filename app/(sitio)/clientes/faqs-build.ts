/**
 * LAS PREGUNTAS FRECUENTES, TOLERANDO QUE LA BASE NO CONTESTE **DURANTE EL BUILD**.
 *
 * Vivía dentro de `clientes/[necesidad]/page.tsx`. Se sacó aquí el 2026-08-18, cuando la
 * portada `/clientes` pasó a mostrar también el contenido de una sección y necesitó lo
 * mismo: dos copias de esta función se habrían separado a la primera corrección.
 *
 * ── EL PROBLEMA QUE RESUELVE ───────────────────────────────────────────────────
 * Estas páginas se prerenderizan, así que una consulta a Postgres se convierte en
 * **requisito de compilación**: si la base no responde mientras corre `next build`, no se
 * cae la página — se cae el despliegue entero. Ya pasó el 2026-08-04, y de la forma más
 * confusa posible: el servicio `agente-worker`, que comparte repo con la app, heredaba su
 * build y acumuló **20 despliegues fallidos** por no tener `DATABASE_URL`.
 *
 * Un despliegue no debería depender de que la base esté en pie. Así que **solo en el
 * build**, un fallo deja la página sin preguntas en vez de abortar: el `revalidate` de la
 * página la regenera con las preguntas de verdad dentro de los cinco minutos siguientes, de
 * modo que el hueco se cierra solo y sin intervención.
 *
 * ⚠️ **En ejecución no se traga nada.** El error sube, Next sigue sirviendo la última
 * versión buena y reintenta en la siguiente revalidación. Devolver «no hay preguntas»
 * cuando lo que hay es una base caída es exactamente el fallo que ya costó una
 * investigación entera —el `catch` de `/api/projects` que fingía cero proyectos—, y aquí no
 * se repite: el silencio dura lo que dura un build y queda escrito en su registro.
 */

import { faqsDeAcceso, type Faq } from '@/lib/faqs';

export async function faqsTolerantesAlBuild(accesoId: string): Promise<Faq[]> {
  if (process.env.NEXT_PHASE !== 'phase-production-build') return faqsDeAcceso(accesoId);

  try {
    return await faqsDeAcceso(accesoId);
  } catch (e) {
    console.warn(
      `⚠ Las FAQs de «${accesoId}» no se pudieron leer durante el build: ${(e as Error).message}\n` +
        '  La página se prerenderiza sin ellas; la primera revalidación (5 min) las traerá.',
    );
    return [];
  }
}
