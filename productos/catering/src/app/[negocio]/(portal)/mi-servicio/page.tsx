import Link from 'next/link';
import { CalendarX2, MessageSquare, Package } from 'lucide-react';
import { exigirContextoCliente } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cargarServicios, feriadosDelNegocio } from '@/lib/servicios-db';
import { calendarioServicio, ETIQUETA_SITUACION, TONO_SITUACION } from '@/lib/servicios';
import { calcularDia } from '@/lib/despacho';
import { aDia, hoyEn, fechaCorta, fechaLarga, instante, sumarDias } from '@/lib/fechas';
import { ETIQUETA_COMIDA, ETIQUETA_DIA, ETIQUETA_MENSAJE, TONO_MENSAJE } from '@/lib/catalogo';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Tarjeta, Insignia, EstadoVacio } from '@/componentes/ui';
import { Cifra } from '@/componentes/campos';
import { CalendarioServicio, LeyendaCalendario } from '@/componentes/CalendarioServicio';
import MarcarLeidos from './MarcarLeidos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi servicio' };

export default async function PaginaMiServicio({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino, cliente } = await exigirContextoCliente(negocio);
  const hoy = hoyEn(inquilino.zonaHoraria);
  const manana = sumarDias(hoy, 1);

  const [servicios, feriados, mensajes, dHoy, dManana] = await Promise.all([
    cargarServicios(inquilino, { clienteId: cliente.id }),
    feriadosDelNegocio(inquilino.id),
    prisma.mensaje.findMany({ where: { clienteId: cliente.id }, orderBy: { creado: 'desc' }, take: 20 }),
    calcularDia(inquilino, hoy),
    calcularDia(inquilino, manana),
  ]);
  const vigente = servicios.find((s) => s.estado !== 'VENCIDO') ?? null;
  const anteriores = servicios.filter((s) => s.estado === 'VENCIDO').sort((a, b) => b.id - a.id);
  const meHoy = dHoy.entregas.find((e) => e.cliente.id === cliente.id);
  const meManana = dManana.entregas.find((e) => e.cliente.id === cliente.id);
  const noLeidos = mensajes.filter((m) => !m.leido).length;

  return (
    <>
      <CabeceraPagina titulo={`Hola, ${cliente.nombre.split(' ')[0]}`} descripcion={fechaLarga(hoy)} />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Tarjeta className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-tenue">Hoy</p>
            {meHoy ? (
              <p className="mt-1 text-[15px] font-semibold text-acento">Te llega {meHoy.comidas.map((c) => ETIQUETA_COMIDA[c].toLowerCase()).join(' y ')}</p>
            ) : dHoy.cancelados.some((c) => c.id === cliente.id) ? (
              <p className="mt-1 text-[15px] font-semibold text-error">Cancelaste hoy</p>
            ) : (
              <p className="mt-1 text-[15px] font-semibold text-tenue">{dHoy.esFeriado && !dHoy.esFeriado.esLaborable ? `Feriado: ${dHoy.esFeriado.nombre}` : 'Hoy no hay entrega'}</p>
            )}
            {meHoy && <p className="text-[12px] text-tenue">A {meHoy.cliente.direccion}{meHoy.motorizado ? ` · lo lleva ${meHoy.motorizado.nombre}` : ''}</p>}
          </Tarjeta>
          <Tarjeta className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-tenue">Mañana</p>
            {meManana ? (
              <p className="mt-1 text-[15px] font-semibold">Te llega {meManana.comidas.map((c) => ETIQUETA_COMIDA[c].toLowerCase()).join(' y ')}</p>
            ) : dManana.cancelados.some((c) => c.id === cliente.id) ? (
              <p className="mt-1 text-[15px] font-semibold text-error">Cancelaste mañana</p>
            ) : (
              <p className="mt-1 text-[15px] font-semibold text-tenue">Mañana no hay entrega</p>
            )}
            <Link href={`/${negocio}/cancelaciones`} className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-acento hover:underline"><CalendarX2 className="h-3.5 w-3.5" /> Cancelar o reactivar un día</Link>
          </Tarjeta>
        </div>

        {vigente ? (
          <Tarjeta className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold">Tu servicio</h2>
              <Insignia tono={TONO_SITUACION[vigente.resumen.situacion]}>{ETIQUETA_SITUACION[vigente.resumen.situacion]}</Insignia>
            </div>
            <p className="mt-1 text-[12px] text-tenue">{vigente.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(' + ')} · {vigente.diasSemana.map((d) => ETIQUETA_DIA[d]).join(', ')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Cifra etiqueta="Días restantes" valor={vigente.resumen.diasRestantes} destacado pista={`de ${vigente.diasTotales} contratados`} />
              <Cifra etiqueta="Consumidos" valor={vigente.resumen.diasConsumidos} />
              <Cifra etiqueta="Termina" valor={fechaCorta(vigente.resumen.fechaFin)} pista="Se corre si cancelas o hay feriado" />
              <Cifra etiqueta="Cancelaciones" valor={`${vigente.resumen.cancelacionesUsadas} de ${vigente.resumen.maxCancelaciones}`} />
            </div>
            <div className="mt-4"><LeyendaCalendario /></div>
            <div className="mt-2">
              <CalendarioServicio compacto dias={calendarioServicio(vigente, hoy, feriados, vigente.cancelaciones.filter((c) => c.activa).map((c) => ({ id: c.id, dia: aDia(c.fecha), motivo: c.motivo })))} hoy={hoy} />
            </div>
            {vigente.resumen.diasRestantes <= 5 && (
              <p className="mt-4 rounded border border-borde bg-aviso-suave px-3 py-2 text-[12px] text-aviso">Te quedan pocos días. Habla con {inquilino.nombre} para renovar.</p>
            )}
          </Tarjeta>
        ) : (
          <Tarjeta><EstadoVacio icono={Package} titulo="Todavía no tienes un servicio activo" detalle={`Ponte en contacto con ${inquilino.nombre} para contratar tus días.`} /></Tarjeta>
        )}

        {anteriores.length > 0 && (
          <Tarjeta className="p-4">
            <h2 className="text-[13px] font-semibold">Servicios anteriores</h2>
            <ul className="mt-2 divide-y divide-borde text-[12px]">
              {anteriores.map((s) => <li key={s.id} className="py-2">{fechaCorta(s.fechaInicio)} → {fechaCorta(s.terminoEn ?? s.resumen.fechaFin)} · {s.resumen.diasConsumidos} de {s.diasTotales} días · {s.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(', ')}</li>)}
            </ul>
          </Tarjeta>
        )}

        <Tarjeta className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-borde px-4 py-3">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold"><MessageSquare className="h-4 w-4 text-tenue" /> Mensajes de {inquilino.nombre}{noLeidos > 0 && <Insignia tono="aviso">{noLeidos} sin leer</Insignia>}</h2>
            {noLeidos > 0 && <MarcarLeidos slug={negocio} />}
          </div>
          {mensajes.length === 0 ? <EstadoVacio titulo="Sin mensajes" /> : (
            <ul className="divide-y divide-borde">
              {mensajes.map((m) => (
                <li key={m.id} className={`px-4 py-3 ${m.leido ? '' : 'bg-acento-suave/40'}`}>
                  <div className="flex items-center gap-2"><Insignia tono={TONO_MENSAJE[m.tipo]}>{ETIQUETA_MENSAJE[m.tipo]}</Insignia><span className="text-[11px] text-tenue">{instante(m.creado, inquilino.zonaHoraria)}</span></div>
                  <p className="mt-1 text-[13px]">{m.texto}</p>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
