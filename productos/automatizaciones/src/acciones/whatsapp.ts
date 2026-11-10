'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import { contextoApi, contextoEscritura } from '@/lib/inquilino';
import { claveMaestraConfigurada } from '@/lib/agente/cifrado';
import {
  type Canal,
  anotarError,
  asegurarCanal,
  copiarAgente,
  guardarSecreto,
  limpiarError,
  secretoDelCanal,
} from '@/lib/agente/canales';
import {
  activarLlamadas,
  appsSuscritas,
  datosDelNumero,
  canjearCodigo,
  estadoDelToken,
  numerosDeWaba,
  pedirSincronizacion,
  registrarNumero,
  suscribirWaba,
  wabasDelToken,
} from '@/lib/agente/meta';

/**
 * CONFIGURACIÓN ▸ WHATSAPP — conectar el número del inquilino (Fernando, 2026-11-07:
 * «hace falta un apartado para configurar la conexión con WhatsApp en el tenant»).
 *
 * Es el alta que vivía en la plataforma (`/api/admin/flows/[id]/agente/conectar`,
 * retirada con el módulo el 2026-10) portada al producto. La lógica es la misma y con
 * las mismas cicatrices; lo que cambia es de quién es:
 *
 *  · **El inquilino sale de la sesión, nunca del navegador.** Desde 2026-11-10 hay VARIOS
 *    números por inquilino y las acciones reciben el id del canal, pero siempre se busca con
 *    `id = … AND inquilino_id = …` (`canalDe`): un id ajeno no encuentra nada.
 *  · **El administrador del inquilino conecta su propio número.** En la plataforma solo
 *    podía el equipo de GCC; aquí el producto se vende por 5 $/mes y el cliente lo monta
 *    él. El paso irreversible de la ventana de Meta se avisa y se confirma antes.
 *  · **Un número ocupado no dice de quién es.** «Ya está conectado al agente X» era útil
 *    dentro de GCC; a un cliente le contaría quién más es cliente nuestro.
 *  · **El número de prueba de Meta solo en el inquilino de cortesía.** Ese camino pone
 *    el token del usuario del sistema de GCC, que da acceso a las cuentas de todos.
 */

export type Resultado = { ok: true; mensaje?: string; aviso?: string } | { ok: false; error: string };

export type EstadoMeta = {
  numero: {
    display_phone_number?: string; verified_name?: string; status?: string;
    platform_type?: string; quality_rating?: string; is_pin_enabled?: boolean;
  } | null;
  suscrita: boolean | null;
  token: { valido: boolean; venceEn: string | null } | null;
  fallos: string[];
};

export type Metodo = 'COEXISTENCIA' | 'CLOUD_API';

/**
 * Un número (canal) DEL inquilino. Con id, ese —y solo si es suyo—; sin id, el primero.
 * Desde 2026-11-10 un inquilino puede tener varios: cada uno con su automatización AGENTE_IA.
 */
async function canalDe(inquilinoId: number, canalId?: number | null): Promise<Canal | null> {
  const { rows } = canalId
    ? await pool.query<Canal>(`SELECT * FROM canales WHERE id = $2 AND inquilino_id = $1`, [inquilinoId, canalId])
    : await pool.query<Canal>(`SELECT * FROM canales WHERE inquilino_id = $1 ORDER BY id LIMIT 1`, [inquilinoId]);
  return rows[0] ?? null;
}

/**
 * El canal en el que se hace un alta.
 *  · Con id: volver a conectar ESE número.
 *  · Sin id: el primer canal que quedó sin número (un alta que no terminó) o, si todos tienen el
 *    suyo, un NÚMERO ADICIONAL: automatización y canal nuevos, con el agente del primero copiado
 *    (apagado). Con cerrojo por inquilino: dos clics no dejan dos canales vacíos.
 */
async function canalParaAlta(inquilinoId: number, canalId?: number | null): Promise<Canal | null> {
  if (canalId) return canalDe(inquilinoId, canalId);
  const primero = await canalDe(inquilinoId);
  if (!primero) return asegurarCanalDelInquilino(inquilinoId);

  const cliente = await pool.connect();
  let nuevaAutomatizacion: number | null = null;
  let libre: Canal | null = null;
  try {
    await cliente.query('BEGIN');
    await cliente.query(`SELECT pg_advisory_xact_lock(hashtext('alta-whatsapp'), $1)`, [inquilinoId]);
    const { rows } = await cliente.query<Canal>(
      `SELECT * FROM canales WHERE inquilino_id = $1 AND phone_number_id IS NULL ORDER BY id LIMIT 1`,
      [inquilinoId],
    );
    libre = rows[0] ?? null;
    if (!libre) {
      const { rows: [nueva] } = await cliente.query<{ id: number }>(
        `INSERT INTO automatizaciones (inquilino_id, nombre, tipo, estado, actualizado_en)
         VALUES ($1, 'Agente de WhatsApp', 'AGENTE_IA', 'ACTIVA', NOW()) RETURNING id`,
        [inquilinoId],
      );
      nuevaAutomatizacion = nueva.id;
    }
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
  if (libre) return libre;
  const nuevo = await asegurarCanal(nuevaAutomatizacion!);
  await copiarAgente(primero.id, nuevo.id);
  return canalDe(inquilinoId, nuevo.id);
}

/**
 * El canal del inquilino, creándolo —con su automatización de agente— si no lo tiene.
 *
 * Un inquilino nuevo no tiene nada montado: el alta es lo que monta el agente, y con él
 * aparecen Conversaciones y Estudio en el menú. Va en una transacción con un cerrojo por
 * inquilino para que dos clics no dejen dos agentes. Con su PROPIO cliente: con
 * `pool.query` el BEGIN se queda en otra conexión.
 */
async function asegurarCanalDelInquilino(inquilinoId: number): Promise<Canal> {
  const yaHay = await canalDe(inquilinoId);
  if (yaHay) return yaHay;

  const cliente = await pool.connect();
  let automatizacionId: number;
  try {
    await cliente.query('BEGIN');
    await cliente.query(`SELECT pg_advisory_xact_lock(hashtext('alta-whatsapp'), $1)`, [inquilinoId]);
    const { rows: [existe] } = await cliente.query<{ id: number }>(
      `SELECT id FROM automatizaciones WHERE inquilino_id = $1 AND tipo = 'AGENTE_IA' ORDER BY id LIMIT 1`,
      [inquilinoId],
    );
    if (existe) automatizacionId = existe.id;
    else {
      const { rows: [nueva] } = await cliente.query<{ id: number }>(
        `INSERT INTO automatizaciones (inquilino_id, nombre, tipo, estado, actualizado_en)
         VALUES ($1, 'Agente de WhatsApp', 'AGENTE_IA', 'ACTIVA', NOW()) RETURNING id`,
        [inquilinoId],
      );
      automatizacionId = nueva.id;
    }
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
  return asegurarCanal(automatizacionId);
}

/** ¿Está ese número en el canal de OTRO inquilino? Sin decir de cuál. */
async function numeroOcupado(phoneNumberId: string, canalId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM canales WHERE phone_number_id = $1 AND id <> $2`,
    [phoneNumberId, canalId],
  );
  return rows.length > 0;
}

const OCUPADO =
  'Ese número ya está conectado a otra cuenta de Automatizaciones. Escríbenos a soporte y lo revisamos contigo.';

function refrescar(slug: string) {
  // 'layout': el alta puede montar el agente, y con él Conversaciones y Estudio en el menú.
  revalidatePath(`/${slug}`, 'layout');
}

/**
 * Cierra el alta del Embedded Signup.
 *
 * ⚠️ EL ORDEN ES LA LECCIÓN DEL 2026-08-28 (Diego Castillo): primero se canjea el código
 * —caduca en segundos y es lo único que no se puede repetir— y la cuenta se deduce del
 * propio token. Lo que trae el navegador del `postMessage` de Meta es una pista.
 */
export async function conectarWhatsApp(
  slug: string,
  datos: { codigo: string; wabaId?: string; phoneNumberId?: string; metodo?: Metodo; canalId?: number | null },
): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  if (!claveMaestraConfigurada())
    return { ok: false, error: 'Falta AGENTE_CLAVE_MAESTRA en el servidor: sin ella no se puede guardar el token.' };

  const codigo = String(datos.codigo || '').trim();
  if (!codigo) return { ok: false, error: 'Meta no devolvió el código del alta.' };
  const pistaWaba = /^\d{6,}$/.test(String(datos.wabaId ?? '')) ? String(datos.wabaId) : null;
  const pistaNumero = /^\d{6,}$/.test(String(datos.phoneNumberId ?? '')) ? String(datos.phoneNumberId) : null;

  const pedido: Metodo = datos.metodo === 'CLOUD_API' ? 'CLOUD_API' : 'COEXISTENCIA';

  const canal = await canalParaAlta(permiso.ctx.inquilino.id, datos.canalId);
  if (!canal) return { ok: false, error: 'Ese número no existe.' };
  if (pistaNumero && (await numeroOcupado(pistaNumero, canal.id))) return { ok: false, error: OCUPADO };

  await pool.query(`UPDATE canales SET estado = 'conectando', actualizado_en = NOW() WHERE id = $1`, [canal.id]);

  try {
    // EL PASO QUE CADUCA, PRIMERO.
    const token = await canjearCodigo(codigo);
    await guardarSecreto(canal.id, 'wa_token', token);

    let cuenta = pistaWaba;
    if (!cuenta) {
      cuenta = (await wabasDelToken(token))[0] ?? null;
      if (!cuenta)
        throw new Error(
          'El alta se completó, pero Meta no dio acceso a ninguna cuenta de WhatsApp. ' +
          'Vuelve a conectar y, en la ventana de Meta, deja marcados todos los permisos.',
        );
    }

    // Sin suscripción no llega ni un mensaje y todo parece correcto: se comprueba.
    await suscribirWaba(cuenta, token);
    const suscrita = (await appsSuscritas(cuenta, token)).length > 0;

    let numero: Awaited<ReturnType<typeof numerosDeWaba>>[number] | null = null;
    try {
      const numeros = await numerosDeWaba(cuenta, token);
      numero = (pistaNumero ? numeros.find((n) => n.id === pistaNumero) : null) ?? numeros[0] ?? null;
    } catch { /* el alta vale igual; el número se puede comprobar después */ }

    const numeroFinal = numero?.id ?? pistaNumero;
    if (numeroFinal && (await numeroOcupado(numeroFinal, canal.id))) {
      await pool.query(`UPDATE canales SET estado = 'error' WHERE id = $1`, [canal.id]);
      await anotarError(canal.id, 'El número del alta ya está conectado a otra cuenta.');
      return { ok: false, error: OCUPADO };
    }

    // ⇒ EL MÉTODO SE MIDE, NO SE SUPONE. Lo pedido es una pista: si se eligió Cloud API y se
    // escribió un número que está en la app, Meta hace coexistencia igual (o al revés).
    let metodo: Metodo = pedido;
    if (numeroFinal) {
      try { metodo = (await datosDelNumero(numeroFinal, token)).is_on_biz_app ? 'COEXISTENCIA' : 'CLOUD_API'; }
      catch { /* sin respuesta se queda lo pedido */ }
    }

    // CLOUD API: el número hay que REGISTRARLO (en coexistencia ya lo está) y se activan las
    // llamadas entrantes. El PIN es la verificación en dos pasos del número: se reutiliza el
    // guardado al volver a conectar, porque con otro distinto Meta rechaza el registro.
    let registroFallido: string | null = null;
    let llamadas: 'NO' | 'ACTIVAS' | 'ERROR' = 'NO';
    let llamadasError: string | null = null;
    if (metodo === 'CLOUD_API' && numeroFinal) {
      const pin = secretoDelCanal(canal, 'pin') ?? String(randomInt(0, 1_000_000)).padStart(6, '0');
      try {
        await registrarNumero(numeroFinal, token, pin);
        await guardarSecreto(canal.id, 'pin', pin);
      } catch (e) {
        registroFallido = e instanceof Error ? e.message : String(e);
      }
      try {
        await activarLlamadas(numeroFinal, token);
        llamadas = 'ACTIVAS';
      } catch (e) {
        llamadas = 'ERROR';
        llamadasError = e instanceof Error ? e.message : String(e);
      }
    }

    // Un alta nueva abre un plazo nuevo de 24 h para la agenda, y la coexistencia hay que
    // volver a comprobarla: puede no ser el mismo número de antes.
    const sano = suscrita && !registroFallido;
    await pool.query(
      `UPDATE canales
          SET waba_id = $2, phone_number_id = $3, numero_visible = $4, nombre_verificado = $5,
              estado = $6, coexistencia_verificada = false, conectado_en = NOW(),
              contactos_sincronizados_en = NULL, historial_sincronizado_en = NULL,
              metodo = $7, llamadas = $8, llamadas_error = $9,
              actualizado_en = NOW()
        WHERE id = $1`,
      [canal.id, cuenta, numeroFinal, numero?.display_phone_number ?? null, numero?.verified_name ?? null,
       sano ? 'conectado' : 'error', metodo, llamadas, llamadasError],
    );

    refrescar(slug);
    if (!suscrita) {
      await anotarError(canal.id, 'El alta terminó pero la app no quedó suscrita a la cuenta: no llegará ningún mensaje.');
      return { ok: false, error: 'El número quedó guardado, pero Meta no suscribió la cuenta: no llegarán mensajes. Pulsa «Comprobar con Meta» o vuelve a conectar.' };
    }
    if (registroFallido) {
      await anotarError(canal.id, `Meta no registró el número en la Cloud API: ${registroFallido}`);
      return { ok: false, error: `El número quedó guardado, pero Meta no lo registró y no podrá enviar mensajes: ${registroFallido}` };
    }
    await limpiarError(canal.id);
    if (metodo === 'COEXISTENCIA') {
      return {
        ok: true,
        mensaje: pedido === 'CLOUD_API' ? 'Número conectado con coexistencia.' : 'Número conectado.',
        aviso: pedido === 'CLOUD_API'
          ? 'Ese número está en la app WhatsApp Business, así que Meta lo conectó con coexistencia: no recibirá llamadas.'
          : 'Abre WhatsApp Web con ese número: si entra, la coexistencia quedó bien y márcala como comprobada.',
      };
    }
    return llamadas === 'ACTIVAS'
      ? { ok: true, mensaje: 'Número conectado por Cloud API.', aviso: 'Llamadas entrantes activadas. Los teléfonos de tus contactos pueden tardar unos días en mostrar el botón de llamar.' }
      : { ok: true, mensaje: 'Número conectado por Cloud API.', aviso: `Meta no activó las llamadas: ${llamadasError}` };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Fallo al cerrar el alta';
    await pool.query(`UPDATE canales SET estado = 'error' WHERE id = $1`, [canal.id]);
    await anotarError(canal.id, mensaje);
    refrescar(slug);
    return { ok: false, error: mensaje };
  }
}

/**
 * El número de PRUEBA de Meta, para ensayar sin cliente. Solo el inquilino de cortesía
 * (el de GCC): usa el token del usuario del sistema, que no sale del servidor.
 *
 * ⚠️ Al número de prueba no lo registra nadie: sin `registrarNumero` todo sale bien y al
 * enviar Meta contesta `(#133010) Account not registered`.
 */
export async function conectarNumeroPrueba(
  slug: string,
  datos: { phoneNumberId: string; wabaId: string },
): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  if (!permiso.ctx.inquilino.cortesia) return { ok: false, error: 'No tienes permiso para hacer este cambio.' };

  const phoneNumberId = String(datos.phoneNumberId ?? '').replace(/\s/g, '');
  const wabaId = String(datos.wabaId ?? '').replace(/\s/g, '');
  if (!/^\d{6,}$/.test(phoneNumberId) || !/^\d{6,}$/.test(wabaId))
    return { ok: false, error: 'Los dos identificadores son números largos; cópialos de la app de Meta.' };
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return { ok: false, error: 'Falta WHATSAPP_TOKEN en el servidor.' };
  if (!claveMaestraConfigurada()) return { ok: false, error: 'Falta AGENTE_CLAVE_MAESTRA en el servidor.' };

  const canal = await canalParaAlta(permiso.ctx.inquilino.id);
  if (!canal) return { ok: false, error: 'No se pudo preparar el número.' };
  if (await numeroOcupado(phoneNumberId, canal.id)) return { ok: false, error: OCUPADO };

  try {
    await guardarSecreto(canal.id, 'wa_token', token);
    const pin = '142536';
    try {
      await registrarNumero(phoneNumberId, token, pin);
      await guardarSecreto(canal.id, 'pin', pin);
    } catch { /* ya registrado: no bloquea */ }

    await suscribirWaba(wabaId, token);
    const suscrita = (await appsSuscritas(wabaId, token)).length > 0;
    let numero: Awaited<ReturnType<typeof numerosDeWaba>>[number] | null = null;
    try {
      const numeros = await numerosDeWaba(wabaId, token);
      numero = numeros.find((n) => n.id === phoneNumberId) ?? null;
    } catch { /* los identificadores los dio Meta en su panel */ }

    await pool.query(
      `UPDATE canales
          SET waba_id = $2, phone_number_id = $3, numero_visible = $4, nombre_verificado = $5,
              estado = $6, coexistencia_verificada = false, conectado_en = NOW(), actualizado_en = NOW()
        WHERE id = $1`,
      [canal.id, wabaId, phoneNumberId, numero?.display_phone_number ?? null,
       numero?.verified_name ?? 'Número de prueba de Meta', suscrita ? 'conectado' : 'error'],
    );
    refrescar(slug);
    if (!suscrita) {
      await anotarError(canal.id, 'El número de prueba quedó guardado pero la app no se suscribió a su cuenta.');
      return { ok: false, error: 'Quedó guardado, pero la cuenta no se suscribió: no llegarán mensajes.' };
    }
    await limpiarError(canal.id);
    return { ok: true, mensaje: 'Número de prueba conectado.', aviso: 'Solo habla con los destinatarios verificados en Meta y caduca a los 90 días.' };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Fallo al conectar el número de prueba';
    await anotarError(canal.id, mensaje);
    return { ok: false, error: mensaje };
  }
}

/** Pregunta a Meta cómo está el número, la suscripción y el token. Solo lee. */
export async function comprobarWhatsApp(
  slug: string,
  canalId: number,
): Promise<{ ok: true; estado: EstadoMeta } | { ok: false; error: string }> {
  const ctx = await contextoApi(slug, 'ADMIN');
  if (!ctx) return { ok: false, error: 'No tienes permiso para ver esto.' };
  const canal = await canalDe(ctx.inquilino.id, canalId);
  if (!canal?.waba_id) return { ok: false, error: 'Todavía no hay un número conectado.' };
  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) return { ok: false, error: 'No hay un token guardado para este número: vuelve a conectarlo.' };

  const fallos: string[] = [];
  const [numeros, suscritas, tokenMeta] = await Promise.all([
    numerosDeWaba(canal.waba_id, token).catch((e) => { fallos.push(`Número: ${e.message}`); return null; }),
    appsSuscritas(canal.waba_id, token).catch((e) => { fallos.push(`Suscripción: ${e.message}`); return null; }),
    estadoDelToken(token).catch((e) => { fallos.push(`Token: ${e.message}`); return null; }),
  ]);
  const numero = numeros ? numeros.find((n) => n.id === canal.phone_number_id) ?? numeros[0] ?? null : null;
  // Con el token muerto, los demás fallos son el mismo dicho en inglés: se dice una vez y claro.
  const avisos = tokenMeta && !tokenMeta.valido
    ? ['El token de este número ya no vale: el agente no puede contestar. Vuelve a conectar el número.']
    : fallos;
  return { ok: true, estado: { numero, suscrita: suscritas ? suscritas.length > 0 : null, token: tokenMeta, fallos: avisos } };
}

/**
 * La coexistencia SOLO la comprueba una persona: que el equipo siga entrando a WhatsApp
 * Web con ese número. Que Meta diga `CLOUD_API` describe el lado de la API, no el teléfono.
 */
export async function marcarCoexistencia(slug: string, canalId: number, comprobada: boolean): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { rowCount } = await pool.query(
    `UPDATE canales SET coexistencia_verificada = $3, actualizado_en = NOW()
      WHERE id = $2 AND inquilino_id = $1 AND phone_number_id IS NOT NULL`,
    [permiso.ctx.inquilino.id, canalId, comprobada],
  );
  if (!rowCount) return { ok: false, error: 'Todavía no hay un número conectado.' };
  refrescar(slug);
  return { ok: true, mensaje: comprobada ? 'Coexistencia marcada como comprobada.' : 'Coexistencia marcada como pendiente.' };
}

/** Las 24 horas que Meta deja para pedir la agenda tras el alta. */
const PLAZO_AGENDA_MS = 24 * 60 * 60 * 1000;

/**
 * Pide a Meta la agenda de contactos del cliente, para que la bandeja enseñe el nombre
 * con que los tiene guardados y no el alias de WhatsApp.
 *
 * ⛔ UN SOLO INTENTO Y DENTRO DE 24 H DESDE EL ALTA. Se anota ANTES de llamar: si Meta lo
 * acepta y la respuesta se pierde, el intento ya está gastado en su lado.
 */
export async function pedirAgenda(slug: string, canalId: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const canal = await canalDe(permiso.ctx.inquilino.id, canalId);
  if (!canal?.phone_number_id) return { ok: false, error: 'Todavía no hay un número conectado.' };
  if (canal.metodo !== 'COEXISTENCIA') return { ok: false, error: 'La agenda solo existe en los números con coexistencia.' };
  if (canal.contactos_sincronizados_en)
    return { ok: false, error: `Ya se pidió el ${new Date(canal.contactos_sincronizados_en).toLocaleString('es-EC')}. Meta solo lo permite una vez por alta.` };
  if (!canal.conectado_en || Date.now() - new Date(canal.conectado_en).getTime() > PLAZO_AGENDA_MS)
    return { ok: false, error: 'Pasaron más de 24 horas desde la conexión: Meta ya no deja pedir la agenda.' };
  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) return { ok: false, error: 'No hay un token guardado para este número: vuelve a conectarlo.' };

  // Se marca con una condición: si dos clics llegan a la vez, solo uno pasa.
  const { rowCount } = await pool.query(
    `UPDATE canales SET contactos_sincronizados_en = NOW(), actualizado_en = NOW()
      WHERE id = $1 AND contactos_sincronizados_en IS NULL`,
    [canal.id],
  );
  if (!rowCount) return { ok: false, error: 'Ya se pidió. Meta solo lo permite una vez por alta.' };

  try {
    await pedirSincronizacion(canal.phone_number_id, token, 'smb_app_state_sync');
  } catch (e) {
    refrescar(slug);
    return {
      ok: false,
      error: `Meta rechazó la petición: ${e instanceof Error ? e.message : e}. El intento queda marcado como usado: si Meta lo aceptó, repetirlo no funcionaría.`,
    };
  }
  refrescar(slug);
  return { ok: true, mensaje: 'Agenda pedida a Meta.', aviso: 'Llega por partes durante las próximas horas.' };
}

/** Vuelve a pedir a Meta que active las llamadas entrantes de un número Cloud API. */
export async function reintentarLlamadas(slug: string, canalId: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const canal = await canalDe(permiso.ctx.inquilino.id, canalId);
  if (!canal?.phone_number_id) return { ok: false, error: 'Ese número no está conectado.' };
  if (canal.metodo !== 'CLOUD_API') return { ok: false, error: 'Meta solo admite llamadas en los números conectados por Cloud API.' };
  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) return { ok: false, error: 'No hay un token guardado para este número: vuelve a conectarlo.' };
  try {
    await activarLlamadas(canal.phone_number_id, token);
    await pool.query(`UPDATE canales SET llamadas = 'ACTIVAS', llamadas_error = NULL, actualizado_en = NOW() WHERE id = $1`, [canal.id]);
    refrescar(slug);
    return { ok: true, mensaje: 'Llamadas entrantes activadas.' };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    await pool.query(`UPDATE canales SET llamadas = 'ERROR', llamadas_error = $2, actualizado_en = NOW() WHERE id = $1`, [canal.id, motivo]);
    refrescar(slug);
    return { ok: false, error: `Meta no activó las llamadas: ${motivo}` };
  }
}
