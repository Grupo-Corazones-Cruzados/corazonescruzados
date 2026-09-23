import Link from 'next/link';
import { MessagesSquare, Users2, Workflow, Bot, Send } from 'lucide-react';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { Tarjeta, Insignia } from '@/componentes/ui';

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
  const { inquilino } = await exigirContexto(cliente);
  const donde = { inquilinoId: inquilino.id };

  const [conversaciones, sinLeer, contactos, automatizaciones, delMes, plan] = await Promise.all([
    prisma.conversacion.count({ where: donde }),
    prisma.conversacion.count({ where: { ...donde, botActivo: false, tomadaPorId: null } }),
    prisma.contacto.count({ where: donde }),
    prisma.automatizacion.count({ where: { ...donde, estado: 'ACTIVA' } }),
    prisma.conversacion.count({ where: { ...donde, ultimoMensajeEn: { gte: inicioDeMes() } } }),
    Promise.resolve(inquilino.suscripcion?.plan ?? null),
  ]);

  const recientes = await prisma.conversacion.findMany({
    where: donde,
    orderBy: { ultimoMensajeEn: 'desc' },
    take: 8,
    include: { contacto: { select: { nombreAgenda: true, nombrePerfil: true, waId: true } } },
  });

  const tope = plan?.maxConversacionesMes ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
      <h1 className="mb-4 text-[19px] font-semibold text-texto sm:text-[22px]">Panel</h1>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Cifra icono={MessagesSquare} etiqueta="Conversaciones" valor={conversaciones} />
        <Cifra icono={Bot} etiqueta="Esperando a una persona" valor={sinLeer} tono={sinLeer > 0 ? 'aviso' : 'neutro'} />
        <Cifra icono={Users2} etiqueta="Contactos" valor={contactos} />
        <Cifra icono={Workflow} etiqueta="Automatizaciones activas" valor={automatizaciones} />
      </div>

      {/* El tope del plan se ENSEÑA antes de estorbar: quien lo ve venir no se
          encuentra un botón apagado sin explicación. */}
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
    </div>
  );
}

function Cifra({
  icono: Icono,
  etiqueta,
  valor,
  tono = 'neutro',
}: {
  icono: React.ComponentType<{ className?: string }>;
  etiqueta: string;
  valor: number;
  tono?: 'neutro' | 'aviso';
}) {
  return (
    <Tarjeta className="p-3 sm:p-4">
      <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-tenue sm:text-[11px]">
        <Icono className={tono === 'aviso' ? 'h-3.5 w-3.5 shrink-0 text-aviso' : 'h-3.5 w-3.5 shrink-0 text-acento'} />
        <span className="truncate">{etiqueta}</span>
      </p>
      <p className="mt-0.5 text-[19px] font-semibold tabular-nums leading-tight text-texto sm:text-[21px]">
        {valor}
      </p>
    </Tarjeta>
  );
}
