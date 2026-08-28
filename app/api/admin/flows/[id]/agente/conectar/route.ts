/**
 * Cierra el alta de un cliente: canjea el código, guarda sus datos y suscribe la cuenta.
 *
 * El navegador solo manda el código y los identificadores que Meta le devolvió. El canje
 * necesita el `app_secret`, que no sale nunca de aquí.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { pool } from '@/lib/db';
import { asegurarCanal, canalPublico, guardarSecreto, anotarError, limpiarError } from '@/lib/agente/canales';
import { claveMaestraConfigurada } from '@/lib/agente/cifrado';
import { canjearCodigo, suscribirWaba, appsSuscritas, numerosDeWaba, registrarNumero, wabasDelToken } from '@/lib/agente/meta';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const flujo = await flujoPermitido(user, id);
  if (!flujo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (flujo.type !== 'ai_agent') return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  if (!claveMaestraConfigurada()) {
    return NextResponse.json(
      { error: 'Falta AGENTE_CLAVE_MAESTRA en el servidor: sin ella no se puede guardar el token del cliente.' },
      { status: 500 },
    );
  }

  const canal = await asegurarCanal(flujo.id);
  const { codigo, waba_id, phone_number_id, modo } = await req.json();

  /**
   * ── ALTA DEL NÚMERO DE PRUEBA DE META (`modo: 'prueba'`) ──────────────────────
   *
   * Toda app con el producto WhatsApp trae un número de prueba gratuito, propiedad de la
   * propia app. No pasa por el Embedded Signup —no hay cliente que comparta nada, ni
   * código que canjear— así que se conecta a mano con sus dos identificadores.
   *
   * Por qué existe este camino:
   *  · **Es la única forma de probar la cadena entera sin tocar el número de un cliente.**
   *    El portafolio dueño de la app NO puede darse de alta a sí mismo por Embedded
   *    Signup: sale en gris con «es propiedad de este portafolio».
   *  · El **App Review** exige que la app haya usado con éxito cada permiso que pide. Un
   *    alta real con este número los ejercita los dos.
   *
   * ⚠️ El token NO viaja desde el navegador: se toma el del usuario del sistema que ya
   * está en el entorno del servidor. Es el mismo secreto, y así no pasa por el chat, ni
   * por la red, ni por el historial de nadie.
   */
  if (modo === 'prueba') {
    if (!phone_number_id || !waba_id) {
      return NextResponse.json(
        { error: 'Para el número de prueba hacen falta su identificador de número y el de la cuenta de WhatsApp.' },
        { status: 400 },
      );
    }
    const token = process.env.WHATSAPP_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'Falta WHATSAPP_TOKEN en el servidor: es el token del usuario del sistema de GCC.' },
        { status: 500 },
      );
    }
    try {
      await guardarSecreto(canal.id, 'wa_token', token);

      // ⚠️ EL PASO QUE NO ESTÁ EN EL ALTA NORMAL Y SIN EL CUAL NO SALE NI UN MENSAJE.
      // El Embedded Signup registra el número del cliente por su cuenta; al de prueba no
      // lo registra nadie. Sin esto, todo lo demás sale bien —la app se suscribe, el canal
      // queda conectado, Meta devuelve el número— y al enviar contesta
      // `(#133010) Account not registered`. Comprobado contra la API real, 2026-08-03.
      // Si ya estaba registrado, Meta responde con error y no pasa nada: se sigue.
      const pin = '142536';
      try {
        await registrarNumero(String(phone_number_id), token, pin);
        await guardarSecreto(canal.id, 'pin', pin);
      } catch { /* ya registrado, o el número no admite registro: no bloquea el alta */ }

      await suscribirWaba(String(waba_id), token);
      const suscritas = await appsSuscritas(String(waba_id), token);
      const suscrita = suscritas.length > 0;

      let numero: any = null;
      try {
        const numeros = await numerosDeWaba(String(waba_id), token);
        numero = numeros.find((n) => n.id === String(phone_number_id)) ?? numeros[0] ?? null;
      } catch { /* el alta vale igual: los identificadores los dio Meta en su panel */ }

      await pool.query(
        `UPDATE gcc_world.agente_canales
            SET waba_id = $2, phone_number_id = $3, numero_visible = $4, nombre_verificado = $5,
                estado = $6, coexistencia_verificada = false, updated_at = NOW()
          WHERE id = $1`,
        [canal.id, String(waba_id), String(phone_number_id),
         numero?.display_phone_number ?? null, numero?.verified_name ?? 'Número de prueba de Meta',
         suscrita ? 'conectado' : 'error'],
      );
      if (!suscrita) await anotarError(canal.id, 'El número de prueba quedó guardado pero la app no se suscribió a su cuenta: no llegará ningún mensaje.');
      else await limpiarError(canal.id);

      const { rows: [fresco] } = await pool.query(`SELECT * FROM gcc_world.agente_canales WHERE id = $1`, [canal.id]);
      return NextResponse.json({
        data: canalPublico(fresco), suscrita, numero, prueba: true,
        aviso: 'Número de PRUEBA de Meta: solo habla con los destinatarios verificados en el panel, y caduca a los 90 días. No sirve para atender clientes.',
      });
    } catch (e: any) {
      await anotarError(canal.id, e?.message ?? 'Fallo al conectar el número de prueba');
      return NextResponse.json({ error: e?.message ?? 'Fallo al conectar el número de prueba' }, { status: 500 });
    }
  }

  if (!codigo) return NextResponse.json({ error: 'Falta el código del alta' }, { status: 400 });

  /**
   * ⚠️ AQUÍ SE PERDÍA UN ALTA ENTERA, Y PASÓ DE VERDAD (Diego Castillo, 2026-08-28).
   *
   * Este sitio exigía que el navegador trajera el `waba_id` del `postMessage` de Meta y,
   * si no venía, cortaba con «Meta no devolvió la cuenta de WhatsApp» ANTES de canjear el
   * código. Pero el alta se había completado: Meta devolvió `status: connected` y un
   * código válido, y el cliente ya veía a Grupo Corazones Cruzados entre sus proveedores
   * de tecnología. Lo único que faltaba era un dato del navegador — y el código de Meta
   * caduca en segundos, así que el alta ya no se podía recuperar: hubo que repetirla.
   *
   * La causa: en el flujo de coexistencia el evento NO se llama `FINISH`, sino
   * `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`, y su `data` trae SOLO `waba_id` (nunca
   * `phone_number_id`). Se corrigió también en el navegador, pero eso no basta: **no se
   * puede volver a hacer que un dato de Meta en el navegador sea obligatorio**, porque el
   * día que Meta lo renombre otra vez se vuelve a perder un alta.
   *
   * Así que el orden se invierte: **primero se canjea el código** —el paso que caduca— y
   * la cuenta se deduce del propio token, que siempre sabe a cuál pertenece. Lo que traiga
   * el navegador es una pista, no un requisito.
   */
  const yaOcupado = async (numero: string) => {
    const { rows: [ocupado] } = await pool.query(
      `SELECT c.id, f.name FROM gcc_world.agente_canales c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.phone_number_id = $1 AND c.id <> $2`,
      [numero, canal.id],
    );
    return ocupado ? (ocupado.name as string) : null;
  };

  // Un número solo puede estar en un canal. Si ya está en otro, avisar en vez de
  // romper con un error de índice único. Se comprueba aquí si el navegador lo trajo, para
  // no llegar a canjear un código que no vamos a poder usar.
  if (phone_number_id) {
    const dueno = await yaOcupado(String(phone_number_id));
    if (dueno) {
      return NextResponse.json(
        { error: `Ese número ya está conectado al agente «${dueno}». Desconéctalo de ahí primero.` },
        { status: 409 },
      );
    }
  }

  await pool.query(
    `UPDATE gcc_world.agente_canales SET estado = 'conectando', updated_at = NOW() WHERE id = $1`, [canal.id],
  );

  try {
    // EL PRIMER PASO ES EL QUE CADUCA. Todo lo demás se puede reintentar; esto no.
    const tokenCliente = await canjearCodigo(String(codigo));
    await guardarSecreto(canal.id, 'wa_token', tokenCliente);

    // La cuenta: la del navegador si vino, y si no, la que declare el propio token.
    let cuenta = waba_id ? String(waba_id) : null;
    if (!cuenta) {
      const cuentas = await wabasDelToken(tokenCliente);
      cuenta = cuentas[0] ?? null;
      if (!cuenta) {
        throw new Error(
          'El alta se completó y el código se canjeó, pero el token no da acceso a ninguna cuenta de WhatsApp. ' +
          'Revisa en el panel de Meta que la app tenga los permisos whatsapp_business_management y ' +
          'whatsapp_business_messaging concedidos para esa cuenta.',
        );
      }
    }

    // Suscribir la app a la cuenta del cliente, y COMPROBARLO. Sin esto no llega ni un
    // mensaje y todo parece correcto.
    await suscribirWaba(cuenta, tokenCliente);
    const suscritas = await appsSuscritas(cuenta, tokenCliente);
    const suscrita = suscritas.length > 0;

    // Datos del número, para poder enseñarlos y para saber si hace falta más trabajo.
    // En coexistencia el navegador NUNCA trae el número: sale de aquí.
    let numero: any = null;
    try {
      const numeros = await numerosDeWaba(cuenta, tokenCliente);
      numero = phone_number_id ? numeros.find((n) => n.id === String(phone_number_id)) ?? numeros[0] : numeros[0];
    } catch { /* el alta sigue siendo válida aunque esta consulta falle */ }

    // El número puede no ser el que se comprobó arriba —o no haberse comprobado ninguno—,
    // así que se vuelve a mirar antes de guardarlo: el índice único no perdona.
    const numeroFinal = numero?.id ?? (phone_number_id ? String(phone_number_id) : null);
    if (numeroFinal) {
      const dueno = await yaOcupado(numeroFinal);
      if (dueno) {
        await pool.query(`UPDATE gcc_world.agente_canales SET estado = 'error' WHERE id = $1`, [canal.id]);
        await anotarError(canal.id, `El número del alta ya está conectado al agente «${dueno}».`);
        return NextResponse.json(
          { error: `Ese número ya está conectado al agente «${dueno}». Desconéctalo de ahí primero.` },
          { status: 409 },
        );
      }
    }

    await pool.query(
      `UPDATE gcc_world.agente_canales
          SET waba_id = $2, phone_number_id = $3, numero_visible = $4, nombre_verificado = $5,
              estado = $6, updated_at = NOW()
        WHERE id = $1`,
      [
        canal.id, cuenta, numeroFinal,
        numero?.display_phone_number ?? null, numero?.verified_name ?? null,
        suscrita ? 'conectado' : 'error',
      ],
    );

    if (!suscrita) {
      await anotarError(canal.id, 'El alta terminó pero la app no quedó suscrita a la cuenta: no llegará ningún mensaje.');
    } else {
      await limpiarError(canal.id);
    }

    const { rows: [fresco] } = await pool.query(`SELECT * FROM gcc_world.agente_canales WHERE id = $1`, [canal.id]);
    return NextResponse.json({
      data: canalPublico(fresco),
      suscrita,
      numero,
      // `platform_type: CLOUD_API` NO demuestra coexistencia: describe el lado API. La
      // única comprobación válida es abrir WhatsApp Web, y eso lo hace una persona.
      avisoCoexistencia: 'Comprueba con el cliente que su equipo sigue entrando a WhatsApp Web. Es la única forma de saber que la coexistencia quedó bien.',
    });
  } catch (err: any) {
    await pool.query(`UPDATE gcc_world.agente_canales SET estado = 'error' WHERE id = $1`, [canal.id]);
    await anotarError(canal.id, err?.message ?? 'Fallo al cerrar el alta');
    return NextResponse.json({ error: err?.message ?? 'Fallo al cerrar el alta' }, { status: 502 });
  }
}

/** Vuelve a consultar el estado del número contra Meta. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const flujo = await flujoPermitido(user, id);
  if (!flujo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (flujo.type !== 'ai_agent') return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const canal = await asegurarCanal(flujo.id);
  if (!canal.waba_id) return NextResponse.json({ error: 'Este agente todavía no tiene número conectado' }, { status: 409 });

  const { secretoDelCanal } = await import('@/lib/agente/canales');
  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) return NextResponse.json({ error: 'No se pudo descifrar el token del cliente' }, { status: 409 });

  try {
    const [numeros, suscritas] = await Promise.all([
      numerosDeWaba(canal.waba_id, token),
      appsSuscritas(canal.waba_id, token),
    ]);
    const numero = numeros.find((n) => n.id === canal.phone_number_id) ?? numeros[0] ?? null;
    return NextResponse.json({ data: { numero, suscrita: suscritas.length > 0, numeros } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'No se pudo consultar a Meta' }, { status: 502 });
  }
}
