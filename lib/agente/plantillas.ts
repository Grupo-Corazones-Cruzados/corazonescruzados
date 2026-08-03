/**
 * PLANTILLAS: sincronizar con Meta, y enviar a una lista de contactos.
 *
 * ── LAS DOS MITADES ────────────────────────────────────────────────────────────
 * · `sincronizarPlantillas()` — trae de Meta el estado real de cada plantilla. Meta manda:
 *   una aprobada puede caerse a `PAUSED` por baja calidad sin que nadie la toque, así que
 *   lo guardado aquí es un espejo y nunca la última palabra.
 * · `enviarAListado()` — manda una plantilla a los contactos de una lista, rellenando sus
 *   variables con los datos de cada contacto.
 */

import { pool } from '@/lib/db';
import { secretoDelCanal, anotarError } from './canales';
import { plantillasDeWaba, enviarPlantilla } from './meta';

/** Las columnas de `flow_contacts` que pueden alimentar una variable. */
export const COLUMNAS_CONTACTO = [
  { clave: 'name', etiqueta: 'Nombre' },
  { clave: 'position', etiqueta: 'Puesto' },
  { clave: 'email', etiqueta: 'Correo' },
  { clave: 'phone', etiqueta: 'Teléfono' },
] as const;

export type ClaveColumna = (typeof COLUMNAS_CONTACTO)[number]['clave'];

/** Solo estas se pueden enviar. Lo demás está en revisión, rechazado o pausado. */
export function sePuedeEnviar(estado: string): boolean {
  return estado === 'APPROVED';
}

/** El cuerpo de una plantilla, sacado de los componentes que devuelve Meta. */
function cuerpoDe(componentes: any[] | undefined): { encabezado: string | null; cuerpo: string; pie: string | null } {
  const busca = (tipo: string) => componentes?.find((c) => String(c?.type).toUpperCase() === tipo);
  return {
    encabezado: busca('HEADER')?.text ?? null,
    cuerpo: busca('BODY')?.text ?? '',
    pie: busca('FOOTER')?.text ?? null,
  };
}

/**
 * Trae de Meta el estado de todas las plantillas del canal y actualiza el espejo.
 *
 * ── POR QUÉ NO BORRA LAS QUE NO VUELVEN ───────────────────────────────────────
 * Una plantilla que estaba y ya no viene puede haberse borrado en Meta… o puede que la
 * respuesta viniera cortada, o que el token perdiera permiso sobre esa cuenta. Borrar por
 * ausencia perdería el mapeo de variables —que es lo único nuestro y no se puede
 * recuperar de Meta—. Se marcan como `ausente` y quien mire decide.
 */
export async function sincronizarPlantillas(canal: any): Promise<{ total: number; nuevas: number }> {
  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) throw new Error('El canal no tiene token de WhatsApp: conéctalo primero.');
  if (!canal.waba_id) throw new Error('El canal no tiene cuenta de WhatsApp asociada.');

  const deMeta = await plantillasDeWaba(String(canal.waba_id), token);
  let nuevas = 0;

  for (const p of deMeta) {
    const { encabezado, cuerpo, pie } = cuerpoDe(p.components);
    const { rowCount } = await pool.query(
      `INSERT INTO gcc_world.agente_plantillas
         (canal_id, meta_id, nombre, idioma, categoria, estado, motivo_rechazo,
          encabezado, cuerpo, pie, sincronizado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (canal_id, nombre, idioma) DO UPDATE
          SET meta_id = EXCLUDED.meta_id,
              categoria = EXCLUDED.categoria,
              estado = EXCLUDED.estado,
              motivo_rechazo = EXCLUDED.motivo_rechazo,
              encabezado = EXCLUDED.encabezado,
              cuerpo = EXCLUDED.cuerpo,
              pie = EXCLUDED.pie,
              sincronizado_en = NOW(),
              updated_at = NOW()
        WHERE gcc_world.agente_plantillas.meta_id IS DISTINCT FROM EXCLUDED.meta_id
           OR gcc_world.agente_plantillas.estado  IS DISTINCT FROM EXCLUDED.estado
           OR gcc_world.agente_plantillas.cuerpo  IS DISTINCT FROM EXCLUDED.cuerpo`,
      [canal.id, p.id, p.name, p.language, p.category, p.status,
       p.rejected_reason ?? null, encabezado, cuerpo, pie],
    );
    if (rowCount) nuevas++;
  }

  // Las que ya estaban en Meta y hoy no vienen. No se borran: se señalan.
  const nombres = deMeta.map((p) => `${p.name}|${p.language}`);
  await pool.query(
    `UPDATE gcc_world.agente_plantillas
        SET estado = 'ausente', updated_at = NOW()
      WHERE canal_id = $1 AND meta_id IS NOT NULL AND estado <> 'ausente'
        AND (nombre || '|' || idioma) <> ALL($2::text[])`,
    [canal.id, nombres.length ? nombres : ['']],
  );

  return { total: deMeta.length, nuevas };
}

/** Cuántas variables usa un cuerpo: el mayor {{n}} que aparece. */
export function cuantasVariables(cuerpo: string): number {
  let max = 0;
  for (const m of cuerpo.matchAll(/\{\{(\d+)\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

/** Sustituye {{1}}, {{2}}… por los valores dados. Para la previsualización y el envío. */
export function rellenar(cuerpo: string, valores: string[]): string {
  return cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n) => valores[Number(n) - 1] ?? `{{${n}}}`);
}

/**
 * Los valores de un contacto, en el orden que pide la plantilla.
 *
 * ⚠️ Nunca devuelve una cadena vacía. Meta **rechaza** el mensaje entero si un parámetro
 * viene vacío, así que un contacto sin puesto tumbaría su envío. Se sustituye por un
 * guion: es feo, pero llega — y que llegue con un guion es mejor que no llegar.
 */
export function valoresDe(contacto: any, variables: string[]): string[] {
  return variables.map((col) => {
    const v = contacto?.[col];
    const texto = v == null ? '' : String(v).trim();
    return texto || '—';
  });
}

/**
 * Manda una plantilla a todos los contactos de una lista.
 *
 * ── EN SERIE, A PROPÓSITO ─────────────────────────────────────────────────────
 * Se envía uno detrás de otro y no en paralelo. Un envío masivo en paralelo se come el
 * límite de velocidad del número del cliente de golpe, y lo que Meta devuelve entonces no
 * es «espera un poco» sino errores que se cuentan contra la calidad del número. Un envío
 * lento es un incordio; un número degradado es un cliente sin servicio.
 *
 * ── UN FALLO NO DETIENE EL ENVÍO ──────────────────────────────────────────────
 * Si un contacto falla —número mal escrito, bloqueado— se anota y se sigue con el
 * siguiente. Detener todo por uno dejaría el envío a medias sin forma de saber dónde.
 */
export async function enviarAListado(
  canal: any,
  plantilla: any,
  listaId: number,
  lanzadoPor: string | null,
): Promise<{ envioId: number; enviados: number; fallidos: number }> {
  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) throw new Error('El canal no tiene token de WhatsApp.');
  if (!canal.phone_number_id) throw new Error('El canal no tiene número conectado.');
  if (!sePuedeEnviar(plantilla.estado)) {
    throw new Error(`La plantilla está en «${plantilla.estado}». Solo se puede enviar una aprobada por Meta.`);
  }

  const { rows: contactos } = await pool.query(
    `SELECT id, name, email, phone, position FROM gcc_world.flow_contacts
      WHERE list_id = $1 AND phone IS NOT NULL AND TRIM(phone) <> '' ORDER BY id`,
    [listaId],
  );

  const { rows: [envio] } = await pool.query(
    `INSERT INTO gcc_world.agente_envios (canal_id, plantilla_id, lista_id, total, lanzado_por)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [canal.id, plantilla.id, listaId, contactos.length, lanzadoPor],
  );

  const variables: string[] = Array.isArray(plantilla.variables) ? plantilla.variables : [];
  let enviados = 0, fallidos = 0;

  for (const c of contactos) {
    const para = String(c.phone).replace(/[^\d]/g, '');
    const valores = valoresDe(c, variables);
    let waId: string | null = null, error: string | null = null;

    try {
      const r: any = await enviarPlantilla(String(canal.phone_number_id), token, {
        para, nombre: plantilla.nombre, idioma: plantilla.idioma, valores,
      });
      waId = r?.messages?.[0]?.id ?? null;
      enviados++;
    } catch (e: any) {
      error = e?.message ?? 'Fallo al enviar';
      fallidos++;
    }

    // El mensaje se guarda SIEMPRE, salga o no. Un envío fallido que no deja rastro es un
    // cliente preguntando «¿le llegó?» sin nadie que pueda responder.
    await registrarSaliente(canal.id, para, c.name, {
      texto: rellenar(plantilla.cuerpo, valores),
      waMessageId: waId, envioId: envio.id, error,
    });

    await pool.query(
      `UPDATE gcc_world.agente_envios SET enviados = $2, fallidos = $3 WHERE id = $1`,
      [envio.id, enviados, fallidos],
    );
  }

  await pool.query(
    `UPDATE gcc_world.agente_envios
        SET estado = $2, terminado_en = NOW() WHERE id = $1`,
    [envio.id, fallidos && !enviados ? 'error' : 'terminado'],
  );

  if (fallidos && !enviados) {
    await anotarError(canal.id, `El envío de «${plantilla.nombre}» falló en los ${fallidos} contactos.`);
  }

  return { envioId: envio.id, enviados, fallidos };
}

/**
 * Guarda el saliente en la conversación de ese contacto, creándola si hace falta.
 *
 * Así el mensaje de plantilla aparece **en la bandeja, en su hilo**, junto a lo que dijo
 * el agente y lo que escribió una persona — que es donde alguien lo va a buscar cuando el
 * contacto conteste. `herramienta = 'plantilla'` es lo que la bandeja usa para etiquetarlo.
 */
async function registrarSaliente(
  canalId: number, waId: string, nombre: string | null,
  { texto, waMessageId, envioId, error }:
    { texto: string; waMessageId: string | null; envioId: number; error: string | null },
) {
  const { rows: [contacto] } = await pool.query(
    `INSERT INTO gcc_world.agente_contactos (canal_id, wa_id, nombre_perfil)
       VALUES ($1,$2,$3)
     ON CONFLICT (canal_id, wa_id) DO UPDATE SET nombre_perfil = COALESCE(gcc_world.agente_contactos.nombre_perfil, EXCLUDED.nombre_perfil)
     RETURNING id`,
    [canalId, waId, nombre],
  );

  const { rows: [conv] } = await pool.query(
    `INSERT INTO gcc_world.agente_conversaciones (canal_id, contacto_id, ultimo_mensaje_en)
       VALUES ($1,$2,NOW())
     ON CONFLICT (canal_id, contacto_id) DO UPDATE SET ultimo_mensaje_en = NOW()
     RETURNING id`,
    [canalId, contacto.id],
  );

  await pool.query(
    `INSERT INTO gcc_world.agente_mensajes
       (conversacion_id, direccion, wa_message_id, tipo, texto, herramienta,
        enviado_ok, error_envio, envio_id)
     VALUES ($1,'saliente',$2,'template',$3,'plantilla',$4,$5,$6)`,
    [conv.id, waMessageId, texto, !error, error, envioId],
  );
}
