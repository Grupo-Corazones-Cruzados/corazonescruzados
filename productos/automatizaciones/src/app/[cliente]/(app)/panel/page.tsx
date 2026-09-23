import Link from 'next/link';
import { MessagesSquare, Users2, Bot, Coins } from 'lucide-react';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { Tarjeta, Insignia } from '@/componentes/ui';
import { costoEnDolares, costoLegible, PRECIOS_COMPROBADOS_EN } from '@/lib/ia/precios';
import { CabeceraPagina } from '@/componentes/Navegacion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel' };

/** Inicio del mes natural en curso: es la ventana del tope del plan. */
function inicioDeMes() {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), 1));
}

/**
 * EL PANEL EN UN TELÉFONO MANDA EL DATO, NO EL CONTENEDOR (Diseño.md, 2026-09-21).
 * Las cifras van en DOS columnas en teléfono y en cuatro desde `lg`: las mismas cinco
 * se leen de una vez en vez de costar 600 px de desplazamiento.
 */
export default async function PaginaPanel({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const { inquilino, montados } = await exigirContexto(cliente);
  const donde = { inquilinoId: inquilino.id };

  const [conversaciones, sinLeer, contactos, delMes] = await Promise.all([
    prisma.conversacion.count({ where: donde }),
    prisma.conversacion.count({ where: { ...donde, botActivo: false, tomadaPorId: null } }),
    prisma.contacto.count({ where: donde }),
    prisma.conversacion.count({ where: { ...donde, ultimoMensajeEn: { gte: inicioDeMes() } } }),
  ]);

  /**
   * LO QUE LLEVA CONSUMIDO EL AGENTE (Fernando, 2026-09-23).
   *
   * Se suman los dos periodos en UNA consulta —el total y el mes en curso— porque son la
   * misma tabla y dos viajes a la base para dos números de la misma tarjeta es un viaje
   * de más.
   */
  const [gasto] = await prisma.$queryRaw<
    { entrada: number; salida: number; cache: number; corridas: number;
      entrada_mes: number; salida_mes: number; cache_mes: number; corridas_mes: number }[]
  >`
    SELECT COALESCE(SUM(tokens_entrada), 0)::int        AS entrada,
           COALESCE(SUM(tokens_salida), 0)::int         AS salida,
           COALESCE(SUM(tokens_cache_lectura), 0)::int  AS cache,
           COUNT(*)::int                                AS corridas,
           COALESCE(SUM(tokens_entrada)       FILTER (WHERE creado_en >= date_trunc('month', now())), 0)::int AS entrada_mes,
           COALESCE(SUM(tokens_salida)        FILTER (WHERE creado_en >= date_trunc('month', now())), 0)::int AS salida_mes,
           COALESCE(SUM(tokens_cache_lectura) FILTER (WHERE creado_en >= date_trunc('month', now())), 0)::int AS cache_mes,
           COUNT(*)                           FILTER (WHERE creado_en >= date_trunc('month', now()))::int     AS corridas_mes
      FROM uso_modelo WHERE inquilino_id = ${inquilino.id}`;

  const consumido = costoEnDolares({
    tokensEntrada: gasto?.entrada ?? 0,
    tokensSalida: gasto?.salida ?? 0,
    tokensCacheLectura: gasto?.cache ?? 0,
  });
  const consumidoMes = costoEnDolares({
    tokensEntrada: gasto?.entrada_mes ?? 0,
    tokensSalida: gasto?.salida_mes ?? 0,
    tokensCacheLectura: gasto?.cache_mes ?? 0,
  });

  const plan = inquilino.suscripcion?.plan ?? null;

  const recientes = !montados.includes('AGENTE_IA') ? [] : await prisma.conversacion.findMany({
    where: donde,
    orderBy: { ultimoMensajeEn: 'desc' },
    take: 8,
    include: { contacto: { select: { nombreAgenda: true, nombrePerfil: true, waId: true } } },
  });

  const tope = inquilino.cortesia ? null : (plan?.maxConversacionesMes ?? null);
  // Las cifras del agente solo salen si hay un agente montado: un «0 conversaciones» a
  // quien no tiene ninguno no informa, desorienta.
  const conAgente = montados.includes('AGENTE_IA');

  return (
    <>
      <CabeceraPagina titulo={inquilino.nombre} descripcion="Panel de control" />
      <div className="px-4 py-5 sm:px-6">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {conAgente && (
          <>
            <Cifra icono={MessagesSquare} etiqueta="Conversaciones" valor={conversaciones} />
            <Cifra icono={Bot} etiqueta="Esperando a una persona" valor={sinLeer} tono={sinLeer > 0 ? 'aviso' : 'neutro'} />
            <Cifra icono={Users2} etiqueta="Contactos" valor={contactos} />
            {/* Lo que cuesta el agente, en dinero. El total responde «cuánto llevo» y el
                mes es el que sirve para decidir, porque la suscripción es mensual. */}
            <Cifra
              icono={Coins}
              etiqueta="Consumido en IA"
              valor={costoLegible(consumido)}
              detalle={`${costoLegible(consumidoMes)} este mes · ${(gasto?.corridas ?? 0).toLocaleString('es-ES')} respuestas`}
              titulo={`Tarifa comprobada el ${PRECIOS_COMPROBADOS_EN}. ${(gasto?.entrada ?? 0).toLocaleString('es-ES')} tokens de entrada (${(gasto?.cache ?? 0).toLocaleString('es-ES')} leídos de caché) y ${(gasto?.salida ?? 0).toLocaleString('es-ES')} de salida.`}
            />
          </>
        )}
      </div>

      {/* El tope del plan se ENSEÑA antes de estorbar: quien lo ve venir no se
          encuentra un botón apagado sin explicación. */}
      {conAgente && (
      <Tarjeta className="mt-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[12px] uppercase tracking-wide text-tenue">Conversaciones este mes</p>
          <p className="text-[13px] text-tenue">
            {tope === null ? (
              <>Sin límite en tu plan</>
            ) : (
              <>
                {delMes} de {tope}
              </>
            )}
          </p>
        </div>
        {tope !== null && (
          <div className="mt-2 h-2 overflow-hidden rounded bg-realce">
            <div
              className="h-full rounded bg-acento transition-[width]"
              style={{ width: `${Math.min(100, Math.round((delMes / tope) * 100))}%` }}
            />
          </div>
        )}
      </Tarjeta>
      )}

      {conAgente && (
      <>
      <h2 className="mb-2 mt-6 text-[15px] font-semibold text-texto">Últimas conversaciones</h2>
      <Tarjeta className="divide-y divide-borde">
        {recientes.length === 0 && (
          <p className="px-4 py-6 text-center text-[13px] text-tenue">Todavía no hay conversaciones.</p>
        )}
        {recientes.map((c) => (
          <Link
            key={c.id}
            href={`/${cliente}/conversaciones?c=${c.id}`}
            className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2.5 hover:bg-realce"
          >
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-texto">
                {c.contacto.nombreAgenda || c.contacto.nombrePerfil || c.contacto.waId}
              </p>
              <p className="text-[11.5px] text-tenue">
                {c.ultimoMensajeEn ? c.ultimoMensajeEn.toLocaleString('es-EC') : 'Sin mensajes'}
              </p>
            </div>
            {!c.botActivo && <Insignia tono="aviso">Atendida a mano</Insignia>}
          </Link>
        ))}
      </Tarjeta>
      </>
      )}
      </div>
    </>
  );
}

function Cifra({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  titulo,
  tono = 'neutro',
}: {
  icono: React.ComponentType<{ className?: string }>;
  etiqueta: string;
  /** Texto además de número: una cifra de dinero ya viene formateada. */
  valor: number | string;
  /** Una línea pequeña debajo, para el matiz que no cabe en la cifra. */
  detalle?: string;
  titulo?: string;
  tono?: 'neutro' | 'aviso';
}) {
  return (
    <Tarjeta className="p-3 sm:p-4">
      <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-tenue sm:text-[11px]">
        <Icono className={tono === 'aviso' ? 'h-3.5 w-3.5 shrink-0 text-aviso' : 'h-3.5 w-3.5 shrink-0 text-acento'} />
        <span className="truncate">{etiqueta}</span>
      </p>
      <p
        title={titulo}
        className="mt-0.5 text-[19px] font-semibold tabular-nums leading-tight text-texto sm:text-[21px]"
      >
        {valor}
      </p>
      {detalle && <p className="mt-0.5 truncate text-[11px] text-tenue">{detalle}</p>}
    </Tarjeta>
  );
}
