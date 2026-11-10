import { exigirContexto, topeUsuarios } from '@/lib/inquilino';
import { urlLogo } from '@/lib/marca';
import { perfilGcc } from '@/lib/cuentaGcc';
import { EXIGE_ROL } from '@/lib/modulos';
import { prisma } from '@/lib/db';
import { miOrigen } from '@/acciones/configuracion';
import { vistaSuscripcion } from '@/lib/vistaSuscripcion';
import { pool } from '@/lib/db';
import ConfiguracionCliente, { type NegocioVista, type PagoVista } from './ConfiguracionCliente';
import type { UsuarioVista } from './SeccionUsuarios';
import type { ConexionVista } from './SeccionWhatsApp';
import { conBase } from '@/lib/base';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const ctx = await exigirContexto(cliente, EXIGE_ROL.configuracion, 'configuracion');
  const { inquilino } = ctx;

  const pagos = await prisma.pagoMensual.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: { periodo: 'desc' },
    take: 12,
  });

  // Los datos de la cuenta de GCC World de quien mira, si entra con ella (solo lectura).
  const yo = await prisma.usuario.findUnique({ where: { id: ctx.sesion.uid }, select: { origen: true, email: true, usuario: true } });
  const perfil = yo?.origen === 'GCC' ? await perfilGcc(yo.email ?? yo.usuario) : null;

  const negocio: NegocioVista = {
    nombre: inquilino.nombre,
    logoUrl: urlLogo(inquilino),
    zonaHoraria: inquilino.zonaHoraria,
    razonSocial: inquilino.razonSocial,
    identificacion: inquilino.identificacion,
    direccion: inquilino.direccion,
    correoFacturacion: inquilino.correoFacturacion,
    contactoNombre: inquilino.contactoNombre,
    contactoEmail: inquilino.contactoEmail,
    contactoTelefono: inquilino.contactoTelefono,
  };

  // Los usuarios del negocio: antes, la página «Cuentas» (2026-11-08).
  const filas = await prisma.usuario.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ activo: 'desc' }, { rol: 'asc' }, { nombre: 'asc' }],
  });
  const lista: UsuarioVista[] = filas.map((u) => ({
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    rol: u.rol,
    origen: u.origen,
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso ? u.ultimoAcceso.toISOString() : null,
    esYo: u.id === ctx.sesion.uid,
  }));

  // El mismo objeto que recibe la pantalla de impago: una sola forma de contar lo que
  // se debe, y por tanto un solo sitio donde aparece el botón de pagar.
  const suscripcion = vistaSuscripcion(ctx);

  // Los números del inquilino, sin secretos: solo si existe el token (varios desde 2026-11-10).
  const { rows: canales } = await pool.query(
    `SELECT id, metodo, llamadas, llamadas_error, estado, numero_visible, nombre_verificado, waba_id, phone_number_id,
            wa_token_cifrado IS NOT NULL AS tiene_token, coexistencia_verificada,
            conectado_en, contactos_sincronizados_en, ultimo_error, ultimo_error_en
       FROM canales WHERE inquilino_id = $1 ORDER BY id`,
    [inquilino.id],
  );
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  const numeros: ConexionVista[] = canales.filter((c) => c.phone_number_id).map((c) => ({
    id: c.id,
    metodo: c.metodo,
    llamadas: c.llamadas,
    llamadasError: c.llamadas_error,
    estado: c.estado,
    numero: c.numero_visible,
    nombreVerificado: c.nombre_verificado,
    wabaId: c.waba_id,
    phoneNumberId: c.phone_number_id,
    tieneToken: c.tiene_token,
    coexistencia: c.coexistencia_verificada,
    conectadoEn: iso(c.conectado_en),
    agendaPedidaEn: iso(c.contactos_sincronizados_en),
    ultimoError: c.ultimo_error,
    ultimoErrorEn: iso(c.ultimo_error_en),
  }));
  // Un alta que no terminó deja un canal sin número: su fallo se enseña encima de la lista.
  const sinTerminar = canales.find((c) => !c.phone_number_id && c.estado === 'error' && c.ultimo_error);
  const falloAlta = sinTerminar ? { texto: sinTerminar.ultimo_error as string, en: iso(sinTerminar.ultimo_error_en) } : null;

  const historial: PagoVista[] = pagos.map((p) => ({
    id: p.id,
    periodo: p.periodo,
    monto: Number(p.monto),
    moneda: p.moneda,
    estado: p.estado,
    metodo: p.metodo,
    pagadoEn: p.pagadoEn ? p.pagadoEn.toLocaleDateString('es-EC') : null,
  }));

  return (
    <ConfiguracionCliente
      slug={cliente}
      negocio={negocio}
      usuarios={{ lista, tope: topeUsuarios(inquilino), activas: filas.filter((u) => u.activo).length }}
      suscripcion={suscripcion}
      pagos={historial}
      miOrigen={await miOrigen(cliente)}
      perfil={perfil ? { ...perfil, foto: perfil.tieneFoto ? conBase(`/${cliente}/foto?u=${ctx.sesion.uid}`) : null } : null}
      numeros={numeros}
      falloAlta={falloAlta}
      meta={{ appId: process.env.WHATSAPP_APP_ID || null, configId: process.env.WHATSAPP_ES_CONFIG_ID || null }}
      esCortesia={inquilino.cortesia}
    />
  );
}
