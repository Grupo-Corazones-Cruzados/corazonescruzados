'use client';

/**
 * EL PROYECTO, VISTO POR EL CLIENTE — la página del enlace que viaja en el correo de la
 * factura (`/proyecto/<id>?token=…`).
 *
 * Vive dentro de `(sitio)`, así que hereda el marco público: cabecera oscura, **cuerpo
 * claro** y pie oscuro, igual que `/soluciones` o `/legal`. Antes era la última isla de
 * pixel art oscuro del sitio, con fuentes Silkscreen, y no se parecía a nada de lo demás.
 *
 * ── QUÉ ENSEÑA, Y QUÉ NO (Fernando, 2026-08-19) ───────────────────────────────
 * Enseña el ACUERDO: avance, las etapas pactadas con su importe y su estado, las facturas
 * emitidas con su PDF, y las imágenes del proyecto. **No** enseña los requerimientos, ni
 * quién los hace, ni lo que cuesta cada pieza por dentro: eso es el reparto interno del
 * trabajo y el cliente no tiene por qué verlo.
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Clock, CreditCard } from 'lucide-react';
import { Contenedor } from '@/components/sitio/piezas';
import {
  CabeceraDetalle, CargandoDetalle, Dato, EnlaceBoton, ErrorEnlace, Estado, TarjetaEtapas, TarjetaFacturas, fechaCorta,
} from '@/components/sitio/DetallePublico';

const ESTADO: Record<string, string> = {
  draft: 'Borrador', open: 'Abierto', in_progress: 'En progreso', review: 'En revisión',
  completed: 'Completado', closed: 'Cerrado', cancelled: 'Cancelado', on_hold: 'En espera',
};

export default function PaginaProyectoPublico() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  // ⭐ También se entra con el ENLACE DE PAGO del proyecto (2026-10-30): el «Ver detalle» de
  // `/pagar/<token>` trae aquí, y desde aquí se vuelve al pago.
  const link = searchParams.get('link');
  const llave = link ? `link=${encodeURIComponent(link)}` : token ? `token=${encodeURIComponent(token)}` : '';

  const [p, setP] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [imagen, setImagen] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}/public${llave ? `?${llave}` : ''}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setP(d.data); })
      .catch(() => setError('No se pudo cargar el proyecto'))
      .finally(() => setCargando(false));
  }, [id, llave]);

  if (cargando) return <Contenedor ancho="sitio" className="py-24"><CargandoDetalle /></Contenedor>;
  if (error) return <Contenedor ancho="sitio" className="py-24"><ErrorEnlace mensaje={error} /></Contenedor>;

  const etapas: any[] = p.etapas || [];
  const facturas: any[] = p.invoices || [];
  const pdf = (f: any) => `/api/projects/${id}/public/invoice?invoice_id=${f.id}${llave ? `&${llave}` : ''}`;

  return (
    <Contenedor ancho="sitio" className="py-14 sm:py-20">
      <CabeceraDetalle
        rotulo={p.client_name || 'Proyecto'}
        titulo={p.title}
        descripcion={p.description}
        datos={<>
          <Estado texto={ESTADO[p.status] || p.status} hecho={p.status === 'completed'} />
          {p.deadline && <Dato icon={Clock}>Entrega prevista: {fechaCorta(p.deadline)}</Dato>}
        </>}
        acciones={link && p.pagable
          ? <EnlaceBoton href={`/pagar/${encodeURIComponent(link)}`} icon={CreditCard} primario>Ir al pago</EnlaceBoton>
          : undefined}
      />

      {/* ── Avance ── */}
      {p.avance?.total > 0 && (
        <section className="mt-10 max-w-3xl">
          <div className="flex items-end justify-between mb-2">
            <span className="text-[13px] font-semibold text-[var(--texto)]">Avance del proyecto</span>
            <span className="text-[13px] tabular-nums text-[var(--violeta-txt)] font-semibold">{p.avance.pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--linea)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--violeta)] transition-[width] duration-700"
              style={{ width: `${p.avance.pct}%` }} />
          </div>
        </section>
      )}

      <div className="mt-12 grid gap-6 lg:grid-cols-2 items-start">
        <TarjetaEtapas etapas={etapas} total={Number(p.totalEtapas || 0)} titulo="Etapas del proyecto" />
        <TarjetaFacturas facturas={facturas} pdf={pdf} />
      </div>

      {/* ── Imágenes ── */}
      {p.images?.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[17px] font-semibold text-[var(--texto)]">Imágenes del proyecto</h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {p.images.map((src: string, i: number) => (
              <button key={i} type="button" onClick={() => setImagen(src)}
                className="tarjeta-portafolio overflow-hidden rounded-xl aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${p.title} — imagen ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      {imagen && (
        <div onClick={() => setImagen(null)}
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagen} alt="" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}
    </Contenedor>
  );
}
