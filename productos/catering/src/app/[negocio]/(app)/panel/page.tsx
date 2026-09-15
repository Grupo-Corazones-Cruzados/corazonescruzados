import Link from 'next/link';
import { UserPlus, CalendarX2, ShieldAlert, Clock, ChefHat, Tag, Route } from 'lucide-react';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { calcularDia } from '@/lib/despacho';
import { cargarServicios } from '@/lib/servicios-db';
import { hoyEn, sumarDias, fechaLarga } from '@/lib/fechas';
import { ETIQUETA_COMIDA } from '@/lib/catalogo';
import { puede } from '@/lib/permisos';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Cifra } from '@/componentes/campos';
import { Tarjeta, Insignia, EstadoVacio } from '@/componentes/ui';
import { numEntero } from '@/lib/formato';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel' };

/**
 * El tablero del día: cuántas comidas salen hoy y mañana, quién canceló, qué
 * restricciones chocan con el menú y qué necesita atención (registros
 * pendientes, servicios por vencer). Todo sale de `calcularDia`, la misma
 * función que arma etiquetas y rutas: si el panel dice 34 almuerzos, hay 34
 * etiquetas.
 */
export default async function PaginaPanel({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino, sesion } = await exigirContexto(negocio);
  const hoy = hoyEn(inquilino.zonaHoraria);
  const manana = sumarDias(hoy, 1);

  const [diaHoy, diaManana, pendientes, servicios] = await Promise.all([
    calcularDia(inquilino, hoy),
    calcularDia(inquilino, manana),
    prisma.cliente.count({ where: { inquilinoId: inquilino.id, estado: 'PENDIENTE' } }),
    cargarServicios(inquilino, { estado: { in: ['ACTIVO'] } }),
  ]);

  const porComida = (d: typeof diaHoy) =>
    inquilino.tiposComida.map((t) => ({ t, n: d.entregas.filter((e) => e.comidas.includes(t)).length }));
  const porVencer = servicios.filter((s) => s.resumen.diasRestantes > 0 && s.resumen.diasRestantes <= 5);
  const venceHoy = servicios.filter((s) => s.resumen.situacion === 'VENCE_HOY');

  // Restricciones que chocan con el menú de hoy, agrupadas por alimento.
  const choques = new Map<string, number>();
  for (const e of diaHoy.entregas)
    for (const lista of Object.values(e.restriccionesCocina)) for (const r of lista) choques.set(r, (choques.get(r) ?? 0) + 1);

  const sinMotorizado = diaHoy.entregas.filter((e) => !e.motorizado).length;
  const esAdmin = puede(sesion.rol, 'clientes');

  const alertas: { icono: React.ComponentType<{ className?: string }>; texto: string; href?: string; tono: 'aviso' | 'error' | 'info' }[] = [];
  if (pendientes && esAdmin)
    alertas.push({ icono: UserPlus, texto: `${pendientes} registro(s) pendiente(s) de aprobación`, href: `/${negocio}/clientes?estado=PENDIENTE`, tono: 'aviso' });
  if (porVencer.length && puede(sesion.rol, 'servicios'))
    alertas.push({ icono: Clock, texto: `${porVencer.length} servicio(s) con 5 días o menos`, href: `/${negocio}/servicios?filtro=por-vencer`, tono: 'aviso' });
  if (diaHoy.cancelados.length)
    alertas.push({ icono: CalendarX2, texto: `${diaHoy.cancelados.length} cancelación(es) para hoy`, tono: 'info' });
  if (sinMotorizado && puede(sesion.rol, 'despacho'))
    alertas.push({ icono: Route, texto: `${sinMotorizado} entrega(s) de hoy sin motorizado asignado`, href: `/${negocio}/rutas`, tono: 'error' });
  if (!diaHoy.menus.length && diaHoy.entregas.length && puede(sesion.rol, 'cocina'))
    alertas.push({ icono: ChefHat, texto: 'Hoy hay entregas pero todavía no hay menú cargado', href: `/${negocio}/menus`, tono: 'aviso' });
  if (diaHoy.esFeriado)
    alertas.push({ icono: CalendarX2, texto: `Hoy es ${diaHoy.esFeriado.nombre}${diaHoy.esFeriado.esLaborable ? ' (se trabaja)' : ': no hay servicio'}`, tono: 'info' });

  return (
    <>
      <CabeceraPagina titulo="Panel" descripcion={fechaLarga(hoy)} />
      <div className="space-y-4 p-4 sm:p-6">
        {alertas.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {alertas.map((a) => {
              const cuerpo = (
                <span className="flex items-center gap-2.5">
                  <a.icono className="h-4 w-4 shrink-0" />
                  <span className="text-[13px] font-semibold">{a.texto}</span>
                </span>
              );
              const clases = `rounded border border-borde px-3 py-2.5 ${a.tono === 'error' ? 'bg-error-suave text-error' : a.tono === 'aviso' ? 'bg-aviso-suave text-aviso' : 'bg-acento-suave text-acento'}`;
              return a.href ? (
                <Link key={a.texto} href={a.href} className={`${clases} hover:brightness-95`}>{cuerpo}</Link>
              ) : (
                <div key={a.texto} className={clases}>{cuerpo}</div>
              );
            })}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra etiqueta="Entregas hoy" valor={numEntero(diaHoy.entregas.length)} destacado pista={`${diaHoy.cancelados.length} cancelaciones`} />
          <Cifra etiqueta="Entregas mañana" valor={numEntero(diaManana.entregas.length)} pista={`${diaManana.cancelados.length} cancelaciones`} />
          <Cifra etiqueta="Servicios activos" valor={numEntero(servicios.length)} pista={`${venceHoy.length} vencen hoy`} />
          <Cifra etiqueta="Clientes por aprobar" valor={numEntero(pendientes)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta className="p-4">
            <h2 className="text-[13px] font-semibold">Comidas de hoy</h2>
            <p className="text-[11px] text-tenue">Lo que la cocina tiene que sacar</p>
            <ul className="mt-3 divide-y divide-borde">
              {porComida(diaHoy).map(({ t, n }) => (
                <li key={t} className="flex items-center justify-between py-2 text-[13px]">
                  <span>{ETIQUETA_COMIDA[t]}</span>
                  <span className="text-[16px] font-semibold text-acento">{numEntero(n)}</span>
                </li>
              ))}
            </ul>
            {puede(sesion.rol, 'cocina') && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-borde pt-3 text-[12px]">
                <Link href={`/${negocio}/etiquetas?dia=${hoy}`} className="inline-flex items-center gap-1.5 font-semibold text-acento hover:underline"><Tag className="h-3.5 w-3.5" /> Etiquetas de hoy</Link>
                <Link href={`/${negocio}/menus?dia=${hoy}`} className="inline-flex items-center gap-1.5 font-semibold text-acento hover:underline"><ChefHat className="h-3.5 w-3.5" /> Menú de hoy</Link>
              </div>
            )}
          </Tarjeta>

          <Tarjeta className="p-4">
            <h2 className="text-[13px] font-semibold">Comidas de mañana</h2>
            <p className="text-[11px] text-tenue">Para comprar y preparar</p>
            <ul className="mt-3 divide-y divide-borde">
              {porComida(diaManana).map(({ t, n }) => (
                <li key={t} className="flex items-center justify-between py-2 text-[13px]">
                  <span>{ETIQUETA_COMIDA[t]}</span>
                  <span className="text-[16px] font-semibold">{numEntero(n)}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta className="p-4">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold"><ShieldAlert className="h-4 w-4 text-tenue" /> Restricciones con el menú de hoy</h2>
            {choques.size ? (
              <ul className="mt-3 divide-y divide-borde">
                {[...choques.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => (
                  <li key={r} className="flex items-center justify-between py-2 text-[13px]">
                    <span>Sin {r.toLowerCase()}</span>
                    <Insignia tono="error">{n} cliente{n === 1 ? '' : 's'}</Insignia>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[12px] text-tenue">{diaHoy.menus.length ? 'Ningún cliente de hoy tiene restricciones con este menú.' : 'Sin menú cargado para hoy.'}</p>
            )}
          </Tarjeta>

          <Tarjeta className="p-4">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold"><CalendarX2 className="h-4 w-4 text-tenue" /> Cancelaciones de hoy</h2>
            {diaHoy.cancelados.length ? (
              <ul className="mt-3 divide-y divide-borde">
                {diaHoy.cancelados.map((c) => (
                  <li key={c.id} className="py-2 text-[13px]">
                    {esAdmin ? <Link href={`/${negocio}/clientes/${c.id}`} className="font-semibold hover:text-acento">{c.nombre}</Link> : <span className="font-semibold">{c.nombre}</span>}
                    {c.motivo && <span className="text-tenue"> · {c.motivo}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <EstadoVacio titulo="Nadie canceló hoy" />
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
