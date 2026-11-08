import { exigirContexto } from '@/lib/inquilino';
import { EXIGE_ROL } from '@/lib/modulos';
import { prisma } from '@/lib/db';
import { hayCloudinary } from '@/lib/imagenes';
import { miOrigen } from '@/acciones/configuracion';
import { vistaSuscripcion } from '@/lib/vistaSuscripcion';
import { pool } from '@/lib/db';
import ConfiguracionCliente, { type MarcaVista, type PagoVista, type Seccion } from './ConfiguracionCliente';
import type { ConexionVista } from './SeccionWhatsApp';

const SECCIONES: Seccion[] = ['marca', 'whatsapp', 'suscripcion', 'cuenta'];

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({
  params,
  searchParams,
}: {
  params: Promise<{ cliente: string }>;
  searchParams: Promise<{ seccion?: string }>;
}) {
  const { cliente } = await params;
  const { seccion } = await searchParams;
  const ctx = await exigirContexto(cliente, EXIGE_ROL.configuracion, 'configuracion');
  const { inquilino } = ctx;

  const pagos = await prisma.pagoMensual.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: { periodo: 'desc' },
    take: 12,
  });

  const marca: MarcaVista = {
    nombre: inquilino.nombre,
    colorAcento: inquilino.colorAcento,
    tema: inquilino.tema,
    logoUrl: inquilino.logoUrl,
    zonaHoraria: inquilino.zonaHoraria,
  };

  // El mismo objeto que recibe la pantalla de impago: una sola forma de contar lo que
  // se debe, y por tanto un solo sitio donde aparece el botón de pagar.
  const suscripcion = vistaSuscripcion(ctx);

  // El canal del inquilino, sin secretos: solo si existe el token.
  const { rows: [c] } = await pool.query(
    `SELECT estado, numero_visible, nombre_verificado, waba_id, phone_number_id,
            wa_token_cifrado IS NOT NULL AS tiene_token, coexistencia_verificada,
            conectado_en, contactos_sincronizados_en, ultimo_error, ultimo_error_en
       FROM canales WHERE inquilino_id = $1 ORDER BY id LIMIT 1`,
    [inquilino.id],
  );
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  const conexion: ConexionVista | null = c ? {
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
  } : null;

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
      marca={marca}
      suscripcion={suscripcion}
      pagos={historial}
      hayCloudinary={hayCloudinary}
      miOrigen={await miOrigen(cliente)}
      conexion={conexion}
      meta={{ appId: process.env.WHATSAPP_APP_ID || null, configId: process.env.WHATSAPP_ES_CONFIG_ID || null }}
      esCortesia={inquilino.cortesia}
      seccionInicial={SECCIONES.includes(seccion as Seccion) ? (seccion as Seccion) : 'marca'}
    />
  );
}
