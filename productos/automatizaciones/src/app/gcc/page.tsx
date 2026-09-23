import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { prisma } from '@/lib/db';
import { leerSesionOperador } from '@/lib/sesion';
import { evaluarAcceso } from '@/lib/inquilino';
import { Tarjeta, Insignia } from '@/componentes/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clientes' };

/**
 * EL ÁREA DEL EQUIPO. Sin ella el producto no se puede vender: es donde se dan de alta
 * los clientes y se registran los cobros.
 */
export default async function PaginaGcc() {
  const op = await leerSesionOperador();
  if (!op) redirect('/gcc/acceso');

  const inquilinos = await prisma.inquilino.findMany({
    orderBy: [{ cortesia: 'desc' }, { nombre: 'asc' }],
    include: {
      suscripcion: { include: { plan: true } },
      _count: { select: { usuarios: true, automatizaciones: true, conversaciones: true } },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-[19px] font-semibold text-texto sm:text-[22px]">Clientes</h1>
        <p className="text-[12px] text-tenue">{op.nombre}</p>
      </div>

      <div className="space-y-2.5">
        {inquilinos.map((i) => {
          const acceso = evaluarAcceso(i);
          return (
            <Tarjeta key={i.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-medium text-texto">
                    <span className="truncate">{i.nombre}</span>
                    {i.cortesia && <Insignia tono="info">Del grupo</Insignia>}
                    {i.soloLectura && <Insignia tono="aviso">Escaparate</Insignia>}
                  </p>
                  <p className="text-[12px] text-tenue">
                    /{i.slug} · {i.contactoEmail ?? 'sin contacto'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Insignia tono={acceso === 'ok' ? 'exito' : acceso === 'suspendido' ? 'error' : 'aviso'}>
                    {acceso === 'ok' ? 'Al día' : acceso === 'suspendido' ? 'Suspendido' : acceso === 'vencido' ? 'Vencido' : 'Sin pago'}
                  </Insignia>
                  <Link
                    href={`/${i.slug}/acceso`}
                    className="flex h-11 items-center gap-1.5 rounded px-2.5 text-[12.5px] text-tenue hover:bg-realce hover:text-texto"
                  >
                    Abrir <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
                <Dato etiqueta="Plan">{i.cortesia ? 'Cortesía' : (i.suscripcion?.plan.nombre ?? '—')}</Dato>
                <Dato etiqueta="Pagado hasta">
                  {i.cortesia ? '—' : i.suscripcion?.pagadoHasta?.toLocaleDateString('es-EC') ?? 'nunca'}
                </Dato>
                <Dato etiqueta="Cuentas">{i._count.usuarios}</Dato>
                <Dato etiqueta="Automatizaciones">{i._count.automatizaciones}</Dato>
                <Dato etiqueta="Conversaciones">{i._count.conversaciones}</Dato>
              </dl>
            </Tarjeta>
          );
        })}
      </div>
    </main>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-tenue">{etiqueta}:</dt>
      <dd className="font-medium text-texto">{children}</dd>
    </div>
  );
}
