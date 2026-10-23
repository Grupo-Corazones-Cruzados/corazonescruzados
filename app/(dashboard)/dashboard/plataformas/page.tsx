'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, Package } from 'lucide-react';
import CardMedia from '@/components/marketplace/CardMedia';
import AccesoAlProducto from '@/components/productos/AccesoAlProducto';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { anfitrionDe, type AccesoProducto } from '@/lib/productos/tipos';
import { esUrlCloudinary, urlRedimensionada } from '@/lib/cloudinary-url';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * PLATAFORMAS — los productos a los que la cuenta tiene acceso (Fernando, 2026-10-23).
 *
 * Textual: *«agreguemos un módulo que solo estará habilitado y visible para cuentas que
 * hayan comprado la suscripción a la plataforma. Es el módulo de plataformas en donde se
 * puede ver las plataformas que tienes acceso, y allí deben estar los mismos productos con
 * el botón de entrar a organización»*.
 *
 * Una tarjeta por ORGANIZACIÓN (una cuenta puede tener más de una en el mismo producto),
 * con la portada del producto en el marketplace, su estado de pago en texto de color y el
 * botón de entrar. La regla de acceso es la de siempre (`lib/productos/accesos.ts`):
 * mensualidad pagada con hasta 30 días de retraso, o acceso del grupo.
 *
 * El menú solo enseña el módulo si hay al menos una; si alguien llega por la dirección sin
 * ninguna, ve el camino al marketplace en vez de una página en blanco.
 */
export default function PlataformasPage() {
  const [accesos, setAccesos] = useState<AccesoProducto[] | null>(null);
  const [portadas, setPortadas] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/productos/accesos')
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((j) => setAccesos(Object.values((j.data ?? {}) as Record<string, AccesoProducto[]>).flat()))
      .catch(() => setAccesos([]));
    // La portada sale de la ficha del producto en el marketplace, por su dirección.
    fetch('/api/portfolio/public?type=product')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        const mapa: Record<string, string> = {};
        for (const it of j.data ?? []) {
          const portada = (Array.isArray(it.images) && it.images[0]) || it.image_url;
          const host = anfitrionDe(it.project_url);
          if (host && portada && !mapa[host]) mapa[host] = esUrlCloudinary(portada) ? urlRedimensionada(portada, 640) : portada;
        }
        setPortadas(mapa);
      })
      .catch(() => {});
  }, []);

  if (accesos === null) {
    return <p className="text-[13px] text-digi-muted py-12 text-center" style={mf}>Cargando…</p>;
  }

  if (accesos.length === 0) {
    return (
      <div className="pixel-card text-center py-12 max-w-md mx-auto" style={mf}>
        <LayoutGrid className="w-8 h-8 mx-auto text-digi-muted/40 mb-2" />
        <p className="text-[14px] font-semibold text-digi-text">Aún no tienes plataformas</p>
        <p className="text-[12.5px] text-digi-muted mt-1 mb-4">Cuando te suscribas a un producto, aparecerá aquí.</p>
        <Link href="/dashboard/marketplace" className={BTN_SECONDARY}>Ver el marketplace</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {accesos.map((a) => (
        <div key={a.url} className="flex flex-col bg-digi-card border border-digi-border rounded-xl overflow-hidden shadow-sm">
          <CardMedia src={portadas[anfitrionDe(a.url)] ?? null} placeholder={<Package className="w-9 h-9 text-digi-muted/30" />} />
          <div className="p-4 flex flex-col flex-1 gap-3" style={mf}>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-digi-text leading-snug">{a.productoNombre}</h3>
              <p className="text-[12.5px] text-digi-muted truncate" title={a.nombre}>{a.nombre}</p>
            </div>
            <Situacion a={a} />
            <div className="mt-auto">
              <AccesoAlProducto accesos={[a]} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** El estado del pago, en texto de color (sin píldora ni punto). El retraso lo avisa el botón. */
function Situacion({ a }: { a: AccesoProducto }) {
  if (a.cortesia) return <p className="text-[12px] font-semibold text-accent">Acceso del grupo</p>;
  if (a.diasDeRetraso) return null;
  const hasta = a.pagadoHasta
    ? new Date(a.pagadoHasta + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return <p className={`text-[12px] font-semibold ${TONO.exito.texto}`}>Al día{hasta ? ` · pagado hasta el ${hasta}` : ''}</p>;
}
