import { Bot, Mail, MessageCircle } from 'lucide-react';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { Tarjeta, Insignia, EstadoVacio } from '@/componentes/ui';
import { CabeceraPagina } from '@/componentes/Navegacion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automatizaciones' };

const PINTA = {
  AGENTE_IA: { icono: Bot, etiqueta: 'Agente de IA' },
  CORREO: { icono: Mail, etiqueta: 'Correo' },
  WHATSAPP: { icono: MessageCircle, etiqueta: 'WhatsApp' },
} as const;

const TONO_ESTADO = { ACTIVA: 'exito', PAUSADA: 'aviso', BORRADOR: 'neutro' } as const;
const ETIQUETA_ESTADO = { ACTIVA: 'Activa', PAUSADA: 'Pausada', BORRADOR: 'Borrador' } as const;

export default async function PaginaAutomatizaciones({
  params,
}: {
  params: Promise<{ cliente: string }>;
}) {
  const { cliente } = await params;
  const { inquilino } = await exigirContexto(cliente);

  const automatizaciones = await prisma.automatizacion.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ estado: 'asc' }, { nombre: 'asc' }],
    include: {
      canales: { select: { numeroVisible: true, estado: true, botActivo: true } },
      _count: { select: { listas: true, campanas: true } },
    },
  });

  return (
    <>
      <CabeceraPagina
        titulo="Automatizaciones"
        descripcion={`${automatizaciones.length} en total`}
      />
      <div className="px-4 py-5 sm:px-6">
      {automatizaciones.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay automatizaciones"
          detalle="Cuando GCC conecte tu número o prepare una campaña, aparecerá aquí."
        />
      ) : (
        <div className="space-y-2.5">
          {automatizaciones.map((a) => {
            const pinta = PINTA[a.tipo];
            const Icono = pinta.icono;
            const canal = a.canales[0];
            return (
              <Tarjeta key={a.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Icono className="mt-0.5 h-[18px] w-[18px] shrink-0 text-acento" />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-texto">{a.nombre}</p>
                      <p className="text-[12px] text-tenue">{pinta.etiqueta}</p>
                    </div>
                  </div>
                  <Insignia tono={TONO_ESTADO[a.estado]}>{ETIQUETA_ESTADO[a.estado]}</Insignia>
                </div>

                {a.descripcion && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-tenue">{a.descripcion}</p>
                )}

                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
                  {canal?.numeroVisible && (
                    <div className="flex items-center gap-1.5">
                      <dt className="text-tenue">Número:</dt>
                      <dd className="font-medium text-texto">{canal.numeroVisible}</dd>
                      {canal.estado === 'conectado' && <Insignia tono="exito">Conectado</Insignia>}
                      {canal.botActivo === false && <Insignia tono="aviso">Agente apagado</Insignia>}
                    </div>
                  )}
                  {a._count.listas > 0 && (
                    <div className="flex items-center gap-1.5">
                      <dt className="text-tenue">Listas:</dt>
                      <dd className="font-medium text-texto">{a._count.listas}</dd>
                    </div>
                  )}
                  {a._count.campanas > 0 && (
                    <div className="flex items-center gap-1.5">
                      <dt className="text-tenue">Campañas:</dt>
                      <dd className="font-medium text-texto">{a._count.campanas}</dd>
                    </div>
                  )}
                </dl>
              </Tarjeta>
            );
          })}
        </div>
      )}
      </div>
    </>
  );
}
