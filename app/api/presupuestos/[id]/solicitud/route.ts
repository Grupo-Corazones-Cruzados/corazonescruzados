import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { verificarCaptcha } from '@/lib/registro/captcha';
import { estadoRegistro, mensajeBloqueo } from '@/lib/registro/limite';
import { sesionDeEsteEquipo, type Presupuesto } from '@/lib/presupuestos/db';
import {
  clientePorIdentificacion, comprobarCodigo, enmascarar, enviarCodigo, hashDeClave, limpiarId, publicarPresupuesto, resolverCuenta, type Pendiente,
} from '@/lib/presupuestos/solicitud';
import { ensureUserClientAccount } from '@/lib/tickets/clientAccount';

/**
 * ACEPTAR Y ENVIAR, por pasos: `identificar` → (`codigo-existente` | `codigo-alta`) → `confirmar`.
 * Con sesión iniciada basta `con-sesion`. El presupuesto que se publica es siempre el guardado en la
 * sesión, nunca uno que llegue del navegador.
 */
export const dynamic = 'force-dynamic';

const mal = (error: string, status = 400, extra: object = {}) => NextResponse.json({ error, ...extra }, { status });

/** Solo una publicación: dos peticiones a la vez no pueden crear dos proyectos. */
async function publicar(id: string, presupuesto: Presupuesto, cuenta: { userId: string | null; clientId: number | null }, correo: string) {
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.presupuesto_sesiones SET enviada_tipo = 'enviando' WHERE id = $1 AND enviada_tipo IS NULL`, [id],
  );
  if (!rowCount) return mal('Este presupuesto ya se envió.', 409);
  try {
    const r = await publicarPresupuesto(presupuesto, cuenta, correo);
    await pool.query(
      `UPDATE gcc_world.presupuesto_sesiones SET enviada_tipo = $2, enviada_id = $3, solicitud = NULL WHERE id = $1`, [id, r.tipo, r.id],
    );
    return NextResponse.json({ enviada: r });
  } catch (e) {
    await pool.query(`UPDATE gcc_world.presupuesto_sesiones SET enviada_tipo = NULL WHERE id = $1`, [id]);
    throw e;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sesion = await sesionDeEsteEquipo(id);
    if (!sesion) return mal('Sesión no encontrada', 404);
    if (sesion.enviada_tipo) return mal('Este presupuesto ya se envió.', 409);
    const presupuesto = sesion.presupuesto as Presupuesto | null;
    if (!presupuesto) return mal('Todavía no hay presupuesto.');
    const b = await req.json().catch(() => ({}));
    const anterior = (sesion.solicitud ?? null) as Pendiente | null;

    if (b.paso === 'identificar') {
      const usuario = await getCurrentUser();
      if (usuario) return NextResponse.json({ conSesion: usuario.email });
      // Sin esto, se podría probar RUC tras RUC para saber quién es cliente.
      const { rows: [c] } = await pool.query(
        `UPDATE gcc_world.presupuesto_sesiones SET busquedas = busquedas + 1 WHERE id = $1 RETURNING busquedas`, [id],
      );
      if (c.busquedas > 10) return mal('Demasiados intentos en esta sesión.', 429);
      const cliente = await clientePorIdentificacion(limpiarId(b.identificacion));
      return NextResponse.json(cliente ? { existe: true, correo: enmascarar(cliente.correo) } : { existe: false });
    }

    if (b.paso === 'con-sesion') {
      const usuario = await getCurrentUser();
      if (!usuario) return mal('Tu sesión terminó.', 401);
      const clientId = await ensureUserClientAccount(usuario.userId);
      return await publicar(id, presupuesto, { userId: usuario.userId, clientId: clientId ?? null }, String(usuario.email).toLowerCase());
    }

    if (b.paso === 'codigo-existente') {
      const cliente = await clientePorIdentificacion(limpiarId(b.identificacion));
      if (!cliente) return mal('No encontramos esa identificación.', 404);
      await enviarCodigo(id, { correo: cliente.correo, nombre: cliente.nombre, clientId: cliente.clientId }, anterior);
      return NextResponse.json({ correo: enmascarar(cliente.correo) });
    }

    if (b.paso === 'codigo-alta') {
      const fallo = await verificarCaptcha(b.altcha);
      if (fallo) return mal(fallo, 400, { captcha: true });
      const estado = await estadoRegistro();
      if (estado.bloqueado) return mal(mensajeBloqueo(estado.hasta), 429);
      const correo = String(b.correo ?? '').trim().toLowerCase();
      const nombre = String(b.nombre ?? '').trim().slice(0, 150);
      const identificacion = limpiarId(b.identificacion);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return mal('Escribe un correo válido.');
      if (nombre.length < 3 || identificacion.length < 5) return mal('Faltan tu nombre o tu identificación.');
      if (String(b.telefono ?? '').trim().length < 7 || !String(b.direccion ?? '').trim() || String(b.pais ?? '').trim().length < 2) return mal('Completa país, teléfono y dirección.');
      if (String(b.clave ?? '').length < 8) return mal('La contraseña debe tener al menos 8 caracteres.');
      if (b.terminos !== true) return mal('Debes aceptar los términos.');
      const idType = /^\d{13}$/.test(identificacion) ? 'ruc' : /^\d{10}$/.test(identificacion) ? 'cedula' : 'pasaporte';
      await enviarCodigo(id, {
        correo, nombre, clientId: null,
        alta: {
          identificacion, idType, telefono: String(b.telefono).trim(), pais: String(b.pais).trim(), direccion: String(b.direccion).trim(),
          hash: await hashDeClave(String(b.clave)),
        },
      }, anterior);
      return NextResponse.json({ correo: enmascarar(correo) });
    }

    if (b.paso === 'confirmar') {
      if (!anterior) return mal('Primero pide el código.');
      const fallo = await comprobarCodigo(id, anterior, b.codigo);
      if (fallo) return mal(fallo);
      const cuenta = await resolverCuenta(anterior);
      return await publicar(id, presupuesto, cuenta, anterior.correo);
    }

    return mal('Paso no válido.');
  } catch (e) {
    console.error('[presupuestos] solicitud', (e as Error).message);
    return mal((e as Error).message.startsWith('Espera') ? (e as Error).message : 'No se pudo completar. Inténtalo otra vez.', 500);
  }
}
