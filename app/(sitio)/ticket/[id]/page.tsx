'use client';

/**
 * EL TICKET, VISTO POR EL CLIENTE — `/ticket/<id>?token=…` (el enlace del correo de la factura)
 * o `/ticket/<id>?link=…` (el «Ver detalle» de su enlace de pago, Fernando 2026-10-30).
 *
 * Hermana de `/proyecto/[id]`: vive en `(sitio)` y usa las mismas piezas
 * (`components/sitio/DetallePublico.tsx`). Antes era una página suelta en pixel art oscuro con
 * Silkscreen, que no se parecía a nada de lo demás.
 *
 * Enseña lo que el cliente paga —el trabajo registrado con su tiempo e importe, las etapas y las
 * facturas—, no quién lo hizo ni las notas internas.
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Clock, CreditCard, ListChecks, Wrench } from 'lucide-react';
import { Contenedor, Tarjeta } from '@/components/sitio/piezas';
import {
  CabeceraDetalle, CargandoDetalle, Dato, EnlaceBoton, ErrorEnlace, Estado, TarjetaEtapas, TarjetaFacturas,
  TituloTarjeta, fechaCorta,
} from '@/components/sitio/DetallePublico';
import { fmt2 } from '@/lib/format';

const ESTADO: Record<string, string> = {
  draft: 'Borrador', pending: 'Pendiente', confirmed: 'Confirmado', in_progress: 'En progreso',
  completed: 'Completado', cancelled: 'Cancelado', withdrawn: 'Retirado',
};

/** 3725 s → «1 h 02 min»; por debajo de un minuto, «menos de 1 min». */
function duracion(seg: number): string {
  const min = Math.round(seg / 60);
  if (min < 1) return seg > 0 ? 'menos de 1 min' : '';
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}

export default function PaginaTicketPublico() {
  const { id } = useParams();
  const sp = useSearchParams();
  const link = sp.get('link');
  const token = sp.get('token');
  const llave = link ? `link=${encodeURIComponent(link)}` : token ? `token=${encodeURIComponent(token)}` : '';

  const [t, setT] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/tickets/${id}/public${llave ? `?${llave}` : ''}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setT(d.data); })
      .catch(() => setError('No se pudo cargar el ticket'))
      .finally(() => setCargando(false));
  }, [id, llave]);

  if (cargando) return <Contenedor ancho="sitio" className="py-24"><CargandoDetalle /></Contenedor>;
  if (error || !t) return <Contenedor ancho="sitio" className="py-24"><ErrorEnlace mensaje={error || 'Ticket no disponible'} /></Contenedor>;

  const registros: any[] = t.registros || [];
  const etapas: any[] = t.etapas || [];
  const facturas: any[] = t.invoices || [];
  const consumido = registros.reduce((s, r) => s + r.importe, 0);
  const tiempo = registros.reduce((s, r) => s + r.segundos, 0);
  const pdf = (f: any) => `/api/tickets/${id}/public/invoice?invoice_id=${f.id}${llave ? `&${llave}` : ''}`;

  return (
    <Contenedor ancho="sitio" className="py-14 sm:py-20">
      <CabeceraDetalle
        rotulo={t.client_name || 'Ticket'}
        titulo={t.title || `Ticket #${t.id}`}
        descripcion={t.description}
        datos={<>
          <Estado texto={ESTADO[t.status] || t.status} hecho={t.status === 'completed'} />
          {t.servicio && <Dato icon={Wrench}>{t.servicio}</Dato>}
          {t.deadline && <Dato icon={Clock}>Fecha límite: {fechaCorta(t.deadline)}</Dato>}
        </>}
        acciones={link && t.pagable
          ? <EnlaceBoton href={`/pagar/${encodeURIComponent(link)}`} icon={CreditCard} primario>Ir al pago</EnlaceBoton>
          : undefined}
      />

      <div className={`mt-12 grid gap-6 items-start ${etapas.length || facturas.length ? 'lg:grid-cols-2' : ''}`}>
        <Tarjeta>
          <TituloTarjeta icon={ListChecks} cifra={`$${fmt2(consumido)}`}>Trabajo realizado</TituloTarjeta>
          {registros.length ? (
            <ul className="mt-4 divide-y divide-[var(--linea)]">
              {registros.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-[15px] text-[var(--texto)] break-words">{r.descripcion || 'Registro de trabajo'}</span>
                    <span className="block text-[13px] text-[var(--tenue)]">
                      {fechaCorta(r.fecha)}{r.segundos ? ` · ${duracion(r.segundos)}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-[var(--texto)]">${fmt2(r.importe)}</span>
                </li>
              ))}
              {tiempo > 0 && (
                <li className="flex items-center justify-between gap-4 pt-3 text-[14px]">
                  <span className="text-[var(--suave)]">Tiempo total</span>
                  <span className="tabular-nums text-[var(--texto)]">{duracion(tiempo)}</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-4 text-[15px] text-[var(--suave)]">Todavía no hay trabajo registrado.</p>
          )}
        </Tarjeta>

        {(etapas.length > 0 || facturas.length > 0) && (
          <div className="grid gap-6">
            <TarjetaEtapas etapas={etapas} total={etapas.reduce((s, e) => s + Number(e.amount || 0), 0)} titulo="Etapas del ticket" />
            <TarjetaFacturas facturas={facturas} pdf={pdf} />
          </div>
        )}
      </div>
    </Contenedor>
  );
}
