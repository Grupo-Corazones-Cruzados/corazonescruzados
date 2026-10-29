import { pool } from '@/lib/db';
import { chatJSON, iaConfigurada } from '@/lib/ia/openai';

/**
 * PAGADO ⇒ NOMBRE ESTÁNDAR (Fernando, 2026-10-29).
 *
 * Textual: *«una vez se haya cambiado la factura del ticket a estado completado es decir la
 * factura ya se subió su comprobante de pago, entonces el ticket o proyecto automáticamente
 * mediante una solicitud de ia cambie su nombre visual al estándar […] las facturas que están
 * en los ingresos del dashboard deben seguir relacionadas al proyecto aunque cambie de nombre
 * a través de identificadores internos»*.
 *
 * El estándar se sacó de los registros ya escritos así:
 *   · Ticket  → título como acción de Power Automate (infinitivo + objeto: «Generar reportes de
 *               ventas») y descripción en presente («Genera reportes de ventas con…»).
 *   · Proyecto → título que dice qué sistema es («Portal de consulta de facturas emitidas ante
 *               el SRI») y descripción del sistema; ninguno lleva datos de la empresa cliente.
 *
 * Dos pasos, para que un despliegue a mitad no lo pierda (ver `gcc-after-muere-con-el-despliegue`):
 *   1. `marcarOrigenesDeFactura` — síncrono, en el mismo flujo que pone la factura en 'paid':
 *      deja el ticket/proyecto con `nombre_estandar_pendiente`.
 *   2. `nombrarPendientes` — la llamada a la IA. Se dispara sin esperar tras el pago y, por si
 *      el proceso murió, la repite el paso con freno de `/api/finance`.
 *
 * Se hace UNA vez por registro (`nombre_estandar_at`). El nombre de antes queda en
 * `titulo_original` / `descripcion_original`: el buscador de Tickets y Proyectos sigue
 * encontrándolo por el nombre del cliente. Nada se enlaza por el título: facturas, ingresos
 * (`finance_items.source_type/source_id`) y etapas van por id, y la factura del SRI conserva
 * el texto con el que se autorizó.
 */

type Tipo = 'ticket' | 'project';
const TABLA: Record<Tipo, string> = { ticket: 'tickets', project: 'projects' };

/** Los tickets y proyectos que cobra una factura, por todos los enlaces que existen. */
async function origenesDeFactura(invoiceId: number | string): Promise<{ tipo: Tipo; id: string }[]> {
  const { rows } = await pool.query(
    `SELECT 'ticket' AS tipo, ticket_id::text AS id FROM gcc_world.invoices WHERE id = $1 AND ticket_id IS NOT NULL
     UNION SELECT 'ticket', source_id FROM gcc_world.invoices WHERE id = $1 AND source_type = 'ticket' AND source_id IS NOT NULL
     UNION SELECT 'project', source_id FROM gcc_world.invoices WHERE id = $1 AND source_type = 'project' AND source_id IS NOT NULL
     UNION SELECT 'project', project_id::text FROM gcc_world.invoices WHERE id = $1 AND project_id IS NOT NULL
     UNION SELECT 'project', project_id::text FROM gcc_world.invoice_projects WHERE invoice_id = $1
     UNION SELECT 'project', project_id::text FROM gcc_world.project_stages WHERE invoice_id = $1 AND project_id IS NOT NULL
     UNION SELECT 'ticket', ticket_id::text FROM gcc_world.project_stages WHERE invoice_id = $1 AND ticket_id IS NOT NULL`,
    [invoiceId],
  );
  return rows.filter((r: any) => /^\d+$/.test(String(r.id))) as any;
}

/** Paso 1: la factura quedó pagada → sus orígenes esperan su nombre estándar. */
export async function marcarOrigenesDeFactura(invoiceId: number | string): Promise<number> {
  const { rows: [inv] } = await pool.query(`SELECT status FROM gcc_world.invoices WHERE id = $1`, [invoiceId]);
  if (inv?.status !== 'paid') return 0;
  let marcados = 0;
  for (const o of await origenesDeFactura(invoiceId)) {
    const { rowCount } = await pool.query(
      `UPDATE gcc_world.${TABLA[o.tipo]} SET nombre_estandar_pendiente = true
        WHERE id = ($1)::bigint AND nombre_estandar_at IS NULL AND NOT nombre_estandar_pendiente`,
      [o.id],
    );
    marcados += rowCount ?? 0;
  }
  return marcados;
}

/** Atajo para las rutas: marca y lanza la IA sin hacer esperar al que pagó. */
export async function nombrarTrasPago(invoiceId: number | string): Promise<void> {
  try {
    if (await marcarOrigenesDeFactura(invoiceId)) {
      void nombrarPendientes().catch((e) => console.error('[nombre-estandar]', e.message));
    }
  } catch (e: any) {
    console.error('[nombre-estandar] factura', invoiceId, e.message);
  }
}

// ── El estándar ─────────────────────────────────────────────────────────────────────

const REGLAS: Record<Tipo, string> = {
  ticket: `Es un TICKET: un trabajo puntual. Se escribe como la tarjeta de una acción de Power Automate.
- "titulo": verbo en INFINITIVO + objeto concreto. Mayúscula solo al inicio y en nombres propios de tecnologías. Máximo 60 caracteres, sin punto final.
- "descripcion": UNA frase en presente, tercera persona, que empieza por ese mismo verbo conjugado y dice qué se hace y con qué. Máximo 170 caracteres, con punto final.
Ejemplos del estándar:
· "Generar reportes de gastos y cobros desde Excel" — "Genera, con una función en Python, los reportes de gastos y cobros a partir del archivo de Excel que llega desde SharePoint."
· "Capacitar a los usuarios en el uso de la aplicación" — "Imparte una sesión de capacitación a los usuarios sobre el manejo de la aplicación entregada."
· "Enviar mensajes masivos por WhatsApp" — "Desarrolla y pone en marcha la herramienta de envío masivo de mensajes por WhatsApp."
· "Atender requerimientos adicionales del sistema contable" — "Aplica ajustes y agrega funciones nuevas solicitadas sobre el sistema contable ya entregado."
Si el trabajo son horas de desarrollo o soporte, nombra el trabajo, no las horas: "Dar soporte a la automatización de procesos", no "Hora de desarrollo".`,
  project: `Es un PROYECTO: un sistema construido. El título dice QUÉ SISTEMA ES y cómo es.
- "titulo": tipo de sistema + lo que hace (Sistema de…, Portal de…, Plataforma de…, App móvil de…, Agente de…, Módulo de…). Mayúscula solo al inicio y en nombres propios. Máximo 70 caracteres, sin punto final.
- "descripcion": 2 a 4 frases que describen el sistema: qué resuelve, cómo funciona y qué incluye. Al cliente se le llama "el negocio". Máximo 450 caracteres.
Ejemplos del estándar:
· "Portal de consulta de facturas emitidas ante el SRI" — "Plataforma web para consultar y descargar en un solo listado facturas, notas de crédito y notas de débito emitidas ante el SRI por varias empresas. Incluye sincronización mediante un worker en Node.js y autenticación por código de un solo uso."
· "App móvil de catálogo y pedidos con integración a Odoo" — "Aplicación móvil multiplataforma que consume inventario, productos y precios desde Odoo por API para vender tipo catálogo. Permite filtrar por bodega y categoría, armar el pedido y registrarlo en Odoo."
· "Sitio web informativo con acceso directo a WhatsApp" — "Sitio informativo con diseño adaptable y contenido corporativo, y un botón de acceso rápido para iniciar la conversación por WhatsApp."`,
};

const COMUNES = `Reglas para los dos:
- En español neutro.
- NINGÚN dato de la empresa o persona cliente: ni su nombre, ni su marca, ni personas, correos, RUC, números de factura, montos o fechas. Sí se nombran tecnologías y servicios de terceros (Power Automate, SharePoint, Odoo, WhatsApp, Azure, SRI…).
- No inventes funciones que el texto no diga. Si ya cumple el estándar, devuélvelo igual o con el mínimo retoque.
- Nunca hables de la información que falta ("no se detalla…"): si hay poco, escribe menos.
Responde solo con JSON: {"titulo": "...", "descripcion": "..."}`;

// Palabras de razón social que no identifican a nadie: no se vigilan.
const GENERICAS = new Set(('compania compañia internacional seguros filial grupo servicios import export sociedad anonima '
  + 'limitada empresa corporacion consultores auditores asociados hermanos comercial industrial ecuador '
  + 'gmail hotmail outlook yahoo').split(' '));

function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Lo que identifica al cliente y no puede aparecer en el nombre nuevo. */
function marcasDelCliente(nombres: (string | null | undefined)[]): string[] {
  const fuera = new Set<string>();
  for (const n of nombres) {
    if (!n) continue;
    const base = sinTildes(n.includes('@') ? n.split('@')[0] : n);
    for (const w of base.split(/[^a-z0-9ñ]+/)) {
      if (w.length >= 5 && !GENERICAS.has(w)) fuera.add(w);
    }
  }
  return [...fuera];
}

function filtraciones(texto: string, marcas: string[]): string[] {
  const t = ` ${sinTildes(texto).replace(/[^a-z0-9ñ]+/g, ' ')} `;
  return marcas.filter((m) => t.includes(` ${m} `));
}

interface Registro {
  id: string;
  title: string;
  description: string | null;
  cliente: string | null;
  cliente_email: string | null;
  factura_cliente: string | null;
  detalle: string | null;
}

async function leer(tipo: Tipo, id: string): Promise<Registro | null> {
  const sql = tipo === 'ticket'
    ? `SELECT t.id::text, t.title, t.description, c.name AS cliente, c.email AS cliente_email,
              (SELECT string_agg(DISTINCT i.client_name_sri, ' | ') FROM gcc_world.invoices i
                WHERE i.ticket_id = t.id OR (i.source_type = 'ticket' AND i.source_id = t.id::text)) AS factura_cliente,
              s.name AS detalle
         FROM gcc_world.tickets t
         LEFT JOIN gcc_world.clients c ON c.id = t.client_id
         LEFT JOIN gcc_world.services s ON s.id = t.service_id
        WHERE t.id = ($1)::bigint`
    : `SELECT p.id::text, p.title, p.description, c.name AS cliente, COALESCE(c.email, p.client_email) AS cliente_email,
              (SELECT string_agg(DISTINCT i.client_name_sri, ' | ') FROM gcc_world.invoices i
                WHERE i.project_id = p.id OR (i.source_type = 'project' AND i.source_id = p.id::text)
                   OR i.id IN (SELECT invoice_id FROM gcc_world.invoice_projects WHERE project_id = p.id)
                   OR i.id IN (SELECT invoice_id FROM gcc_world.project_stages WHERE project_id = p.id)) AS factura_cliente,
              (SELECT string_agg(r.title, '; ' ORDER BY r.id) FROM (SELECT id, title FROM gcc_world.project_requirements
                WHERE project_id = p.id ORDER BY id LIMIT 20) r) AS detalle
         FROM gcc_world.projects p
         LEFT JOIN gcc_world.clients c ON c.id = p.client_id
        WHERE p.id = ($1)::bigint`;
  try {
    const { rows: [r] } = await pool.query(sql, [id]);
    return r ?? null;
  } catch (e: any) {
    // `services` no existe en todos los entornos: sin él, el ticket se lee sin su servicio.
    if (tipo !== 'ticket') throw e;
    const { rows: [r] } = await pool.query(
      `SELECT t.id::text, t.title, t.description, c.name AS cliente, c.email AS cliente_email, NULL AS factura_cliente, NULL AS detalle
         FROM gcc_world.tickets t LEFT JOIN gcc_world.clients c ON c.id = t.client_id WHERE t.id = ($1)::bigint`, [id]);
    return r ?? null;
  }
}

/** La propuesta de la IA para un registro, ya validada. Lanza si no cumple. */
export async function proponerNombreEstandar(tipo: Tipo, r: Registro): Promise<{ titulo: string; descripcion: string }> {
  const marcas = marcasDelCliente([r.cliente, r.cliente_email, ...(r.factura_cliente || '').split(' | ')]);
  const datos = [
    `Título actual: ${r.title}`,
    `Descripción actual: ${r.description || '(vacía)'}`,
    r.detalle ? (tipo === 'ticket' ? `Servicio: ${r.detalle}` : `Requerimientos: ${r.detalle}`) : '',
    marcas.length ? `Datos del cliente que NO pueden aparecer: ${[r.cliente, r.factura_cliente].filter(Boolean).join(' | ')}` : '',
  ].filter(Boolean).join('\n');

  let aviso = '';
  for (let intento = 0; intento < 2; intento++) {
    const j = await chatJSON<{ titulo?: string; descripcion?: string }>({
      system: `${REGLAS[tipo]}\n\n${COMUNES}`,
      user: datos + aviso,
      maxTokens: 4000,
      esfuerzo: 'low',
      etiqueta: 'nombre-estandar',
    });
    const titulo = String(j.titulo || '').trim().replace(/\.$/, '');
    const descripcion = String(j.descripcion || '').trim();
    const tope = tipo === 'ticket' ? 70 : 80;
    if (!titulo || titulo.length > tope) { aviso = `\n\nEl título debe tener entre 1 y ${tope} caracteres.`; continue; }
    if (!descripcion || descripcion.length > 600) { aviso = '\n\nLa descripción no puede ir vacía ni pasar de 450 caracteres.'; continue; }
    const fuga = filtraciones(`${titulo} ${descripcion}`, marcas);
    if (fuga.length) { aviso = `\n\nTu respuesta anterior incluía datos del cliente (${fuga.join(', ')}). Quítalos.`; continue; }
    return { titulo, descripcion };
  }
  throw new Error(`La IA no devolvió un nombre que cumpla el estándar${aviso ? `:${aviso.trim()}` : ''}`);
}

let corriendo = false;

/**
 * Paso 2: pone el nombre estándar a lo que quedó pendiente. Un fallo de la API deja el
 * registro pendiente (se reintenta); una respuesta que no cumple lo saca de la cola con el
 * motivo en `nombre_estandar_error`, para no gastar una llamada en cada pasada.
 */
export async function nombrarPendientes(limite = 10): Promise<number> {
  if (corriendo || !iaConfigurada()) return 0;
  corriendo = true;
  let hechos = 0;
  try {
    for (const tipo of ['ticket', 'project'] as Tipo[]) {
      const tabla = TABLA[tipo];
      const { rows } = await pool.query(
        `SELECT id::text FROM gcc_world.${tabla} WHERE nombre_estandar_pendiente ORDER BY id LIMIT $1`, [limite]);
      for (const { id } of rows) {
        const r = await leer(tipo, id);
        if (!r) continue;
        let nuevo: { titulo: string; descripcion: string };
        try {
          nuevo = await proponerNombreEstandar(tipo, r);
        } catch (e: any) {
          if (/^La IA no devolvió/.test(e.message)) {
            await pool.query(
              `UPDATE gcc_world.${tabla} SET nombre_estandar_pendiente = false, nombre_estandar_error = $2 WHERE id = ($1)::bigint`,
              [id, e.message.slice(0, 500)]);
          } else {
            console.error('[nombre-estandar]', tipo, id, e.message);
          }
          continue;
        }
        // El original se guarda una sola vez y solo si el registro no cambió mientras pensaba la IA.
        // `updated_at` no se toca: el relleno de `/api/finance` fecha con él el ingreso de un
        // proyecto completado, y renombrar lo movería de mes.
        const { rowCount } = await pool.query(
          `UPDATE gcc_world.${tabla}
              SET titulo_original = COALESCE(titulo_original, title),
                  descripcion_original = COALESCE(descripcion_original, description),
                  title = $2, description = $3,
                  nombre_estandar_at = NOW(), nombre_estandar_pendiente = false, nombre_estandar_error = NULL
            WHERE id = ($1)::bigint AND nombre_estandar_pendiente AND title = $4`,
          [id, nuevo.titulo, nuevo.descripcion, r.title]);
        hechos += rowCount ?? 0;
      }
    }
  } finally {
    corriendo = false;
  }
  return hechos;
}
