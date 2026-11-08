'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Search, AlertTriangle } from 'lucide-react';
import { CabeceraPagina, type AccionMenu } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Tarjeta, Tabla, Insignia } from '@/componentes/ui';
import { Cifra } from '@/componentes/campos';
import { ETIQUETA_ESTADO_CLIENTE, TONO_ESTADO_CLIENTE } from '@/lib/catalogo';
import { ETIQUETA_SITUACION, TONO_SITUACION, type ResumenServicio } from '@/lib/servicios';
import { fechaCorta } from '@/lib/fechas';
import { numEntero } from '@/lib/formato';
import type { EstadoCliente, EstadoServicio } from '@/generated/prisma/enums';

export type Reporte = {
  desde: string; hasta: string;
  kpis: { clientesActivos: number; serviciosActivos: number; porVencer: number; entregas: number; comidas: number; cancelaciones: number; cancelacionesCliente: number; diasConsumidosTotal: number; diasContratadosTotal: number };
  clientesPorEstado: { estado: EstadoCliente; n: number }[];
  serviciosPorEstado: { estado: EstadoServicio; n: number }[];
  porDia: { dia: string; entregas: number; comidas: number; cancelados: number }[];
  cancelacionesPorDiaSemana: { dia: string; n: number }[];
  clientesPorMotorizado: { motorizado: string; n: number }[];
  topRestricciones: { alimento: string; n: number }[];
  servicios: { cliente: string; estado: EstadoServicio; situacion: ResumenServicio['situacion']; inicio: string; fin: string; consumidos: number; total: number; cancelaciones: number }[];
};

/** Barras horizontales sin librería: una lista con anchos proporcionales. */
function Barras({ datos, titulo, pista }: { datos: { etiqueta: string; n: number }[]; titulo: string; pista?: string }) {
  const max = Math.max(1, ...datos.map((d) => d.n));
  return (
    <Tarjeta className="p-4">
      <h2 className="text-[13px] font-semibold" title={pista}>{titulo}</h2>
      {datos.length === 0 ? <p className="mt-3 text-[12px] text-tenue">Sin datos.</p> : (
        <ul className="mt-3 space-y-1.5">
          {datos.map((d) => (
            <li key={d.etiqueta} className="text-[12px]">
              <div className="flex justify-between"><span className="truncate">{d.etiqueta}</span><span className="font-semibold">{numEntero(d.n)}</span></div>
              <div className="mt-0.5 h-1.5 rounded bg-realce"><div className="h-1.5 rounded bg-acento" style={{ width: `${(d.n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

export default function ReportesCliente({ slug, reporte: r, mesesRetencion }: { slug: string; reporte: Reporte; mesesRetencion: number | null }) {
  const router = useRouter();
  const [f, setF] = useState({ desde: r.desde, hasta: r.hasta });
  const consulta = new URLSearchParams(f).toString();
  const cumplimiento = r.kpis.diasContratadosTotal ? Math.round((r.kpis.diasConsumidosTotal / r.kpis.diasContratadosTotal) * 100) : 0;

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraPagina titulo="Reportes" descripcion="Indicadores del periodo y el detalle de los servicios"
        menu={[{ etiqueta: 'Excel', icono: Download, href: `/${slug}/api/reportes/excel?${consulta}`, descargar: true, titulo: 'Exportar a Excel' }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {mesesRetencion && (
          <p className="flex items-start gap-2 rounded border border-borde bg-aviso-suave px-3 py-2 text-[12px] text-aviso">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
            <span title="Se borran los servicios vencidos, las cancelaciones, los menús y los mensajes anteriores; los clientes, alimentos, motorizados y feriados se conservan">
              Se conserva {mesesRetencion === 1 ? 'un mes' : `${mesesRetencion} meses`} de histórico. <strong>Exporta a Excel lo que quieras guardar.</strong>
            </span>
          </p>
        )}
        {/* El periodo, en una barra (hasta 62 días). */}
        <Tarjeta className="grid grid-cols-2 gap-2 p-2 sm:flex sm:items-end" >
          <Campo etiqueta="Desde" className="sm:w-44"><Entrada type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Campo>
          <Campo etiqueta="Hasta" className="sm:w-44"><Entrada type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} title="Hasta 62 días" /></Campo>
          <Boton icono={Search} tamano="lg" className="col-span-2 w-full sm:w-auto" onClick={() => router.push(`/${slug}/reportes?${consulta}`)}>Consultar</Boton>
        </Tarjeta>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra etiqueta="Entregas" valor={numEntero(r.kpis.entregas)} destacado pista={`${numEntero(r.kpis.comidas)} comidas`} />
          <Cifra etiqueta="Cancelaciones" valor={numEntero(r.kpis.cancelaciones)} pista={`${r.kpis.cancelacionesCliente} por el cliente`} />
          <Cifra etiqueta="Clientes activos" valor={numEntero(r.kpis.clientesActivos)} pista={`${r.kpis.serviciosActivos} con servicio activo`} />
          <Cifra etiqueta="Servicios por vencer" valor={numEntero(r.kpis.porVencer)} pista={`${cumplimiento} % consumido`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Barras titulo="Entregas por día" pista="En el periodo" datos={r.porDia.filter((d) => d.entregas > 0).map((d) => ({ etiqueta: fechaCorta(d.dia), n: d.entregas }))} />
          <Barras titulo="Cancelaciones por día" datos={r.cancelacionesPorDiaSemana.map((d) => ({ etiqueta: d.dia, n: d.n }))} />
          <Barras titulo="Clientes por motorizado" datos={r.clientesPorMotorizado.map((d) => ({ etiqueta: d.motorizado, n: d.n }))} />
          <Barras titulo="Restricciones más frecuentes" pista="Entre los clientes activos" datos={r.topRestricciones.map((d) => ({ etiqueta: d.alimento, n: d.n }))} />
          <Tarjeta className="p-4">
            <h2 className="text-[13px] font-semibold">Clientes por estado</h2>
            <ul className="mt-3 space-y-1.5 text-[12px]">
              {r.clientesPorEstado.map((c) => <li key={c.estado} className="flex items-center justify-between"><Insignia tono={TONO_ESTADO_CLIENTE[c.estado]}>{ETIQUETA_ESTADO_CLIENTE[c.estado]}</Insignia><span className="font-semibold">{c.n}</span></li>)}
            </ul>
          </Tarjeta>
          <Tarjeta className="p-4">
            <h2 className="text-[13px] font-semibold">Servicios por estado</h2>
            <ul className="mt-3 space-y-1.5 text-[12px]">
              {r.serviciosPorEstado.map((s) => <li key={s.estado} className="flex items-center justify-between"><span>{{ ACTIVO: 'Activos', SUSPENDIDO: 'Suspendidos', VENCIDO: 'Vencidos' }[s.estado]}</span><span className="font-semibold">{s.n}</span></li>)}
            </ul>
          </Tarjeta>
        </div>

        {/* El último bloque crece hasta el pie (regla 2026-11-08). */}
        <Tarjeta className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-borde px-4 py-3"><h2 className="text-[13px] font-semibold">Servicios</h2></div>
          <Tabla
            filas={r.servicios}
            claveFila={(s) => `${s.cliente}-${s.inicio}`}
            recuento={`${r.servicios.length} ${r.servicios.length === 1 ? 'servicio' : 'servicios'}`}
            columnas={[
              { clave: 'cliente', titulo: 'Cliente', render: (s) => <span className="font-semibold">{s.cliente}</span> },
              { clave: 'sit', titulo: 'Estado', render: (s) => <Insignia tono={TONO_SITUACION[s.situacion]}>{ETIQUETA_SITUACION[s.situacion]}</Insignia> },
              { clave: 'inicio', titulo: 'Inicio', render: (s) => fechaCorta(s.inicio) },
              { clave: 'fin', titulo: 'Fin', render: (s) => fechaCorta(s.fin) },
              { clave: 'dias', titulo: 'Días', alinear: 'der', render: (s) => `${s.consumidos} / ${s.total}` },
              { clave: 'canc', titulo: 'Cancel.', alinear: 'der', render: (s) => s.cancelaciones },
            ]}
          />
        </Tarjeta>
      </div>
    </div>
  );
}
