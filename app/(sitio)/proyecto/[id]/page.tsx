'use client';

/**
 * EL PROYECTO, VISTO POR EL CLIENTE — la página del enlace que viaja en el correo de la
 * factura (`/proyecto/<id>?token=…`).
 *
 * Vive dentro de `(sitio)`, así que hereda el marco público: cabecera oscura, **cuerpo
 * claro** y pie oscuro, igual que `/soluciones` o `/contacto`. Antes era la última isla de
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
import { CheckCircle2, Clock, Download, FileText, Layers, ShieldCheck } from 'lucide-react';
import { Contenedor, Tarjeta } from '@/components/sitio/piezas';
import { fmt2 } from '@/lib/format';

const ESTADO: Record<string, string> = {
  draft: 'Borrador', open: 'Abierto', in_progress: 'En progreso', review: 'En revisión',
  completed: 'Completado', closed: 'Cerrado', cancelled: 'Cancelado', on_hold: 'En espera',
};

const SRI: Record<string, string> = {
  generated: 'Generada', signed: 'Firmada', sent: 'Enviada al SRI',
  authorized: 'Autorizada por el SRI', rejected: 'Rechazada', error: 'Con error',
};

export default function PaginaProyectoPublico() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [p, setP] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [imagen, setImagen] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}/public${token ? `?token=${token}` : ''}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setP(d.data); })
      .catch(() => setError('No se pudo cargar el proyecto'))
      .finally(() => setCargando(false));
  }, [id, token]);

  if (cargando) {
    return (
      <Contenedor className="py-24">
        <div className="h-6 w-48 rounded bg-[var(--linea)] animate-pulse" />
        <div className="mt-4 h-10 w-2/3 rounded bg-[var(--linea)] animate-pulse" />
        <div className="mt-10 h-40 rounded-xl bg-[var(--linea)]/60 animate-pulse" />
      </Contenedor>
    );
  }

  if (error) {
    return (
      <Contenedor className="py-24">
        <Tarjeta className="max-w-xl mx-auto text-center">
          <ShieldCheck className="w-8 h-8 mx-auto text-[var(--violeta-txt)]" />
          <h1 className="mt-4 text-[22px] font-semibold text-[var(--texto)]">{error}</h1>
          <p className="mt-2 text-[15px] text-[var(--suave)]">
            Si el enlace caducó, pídenos uno nuevo y te lo enviamos al momento.
          </p>
          <a href="/contacto"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--violeta)] px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90">
            Escríbenos
          </a>
        </Tarjeta>
      </Contenedor>
    );
  }

  const etapas: any[] = p.etapas || [];
  const facturas: any[] = p.invoices || [];
  const facturado = facturas.reduce((s, f) => s + Number(f.total || 0), 0);
  const pdf = (f: any) => `/api/projects/${id}/public/invoice?invoice_id=${f.id}${token ? `&token=${token}` : ''}`;

  return (
    <Contenedor className="py-14 sm:py-20">
      {/* ── Encabezado ── */}
      <header className="max-w-3xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--violeta-txt)]">
          {p.client_name || 'Proyecto'}
        </p>
        <h1 className="mt-3 text-[30px] sm:text-[38px] leading-[1.15] font-semibold tracking-tight text-[var(--texto)]">
          {p.title}
        </h1>
        {p.description && (
          <p className="mt-4 text-[16.5px] leading-relaxed text-[var(--suave)]">{p.description}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--linea-fuerte)] bg-[var(--tarjeta)] px-3 py-1 text-[var(--texto)]">
            <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {ESTADO[p.status] || p.status}
          </span>
          {p.deadline && (
            <span className="inline-flex items-center gap-1.5 text-[var(--tenue)]">
              <Clock className="w-4 h-4" /> Entrega prevista: {new Date(p.deadline).toLocaleDateString('es-EC')}
            </span>
          )}
        </div>
      </header>

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
        {/* ── Etapas acordadas ── */}
        {etapas.length > 0 && (
          <Tarjeta>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--texto)]">
                <Layers className="w-[18px] h-[18px] text-[var(--violeta-txt)]" /> Etapas del proyecto
              </h2>
              <span className="text-[15px] font-semibold tabular-nums text-[var(--texto)]">
                ${fmt2(Number(p.totalEtapas || 0))}
              </span>
            </div>
            <ul className="mt-4 divide-y divide-[var(--linea)]">
              {etapas.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0 flex items-center gap-2">
                    {e.facturada
                      ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      : <Clock className="w-4 h-4 shrink-0 text-[var(--apagado)]" />}
                    <span className="truncate text-[15px] text-[var(--texto)]">{e.name}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] text-[var(--tenue)]">
                      {e.facturada ? 'Facturada' : 'Pendiente'}
                    </span>
                    <span className="text-[15px] tabular-nums text-[var(--texto)]">${fmt2(Number(e.amount))}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}

        {/* ── Facturas ── */}
        {facturas.length > 0 && (
          <Tarjeta>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--texto)]">
                <FileText className="w-[18px] h-[18px] text-[var(--violeta-txt)]" /> Facturas
              </h2>
              <span className="text-[15px] font-semibold tabular-nums text-[var(--texto)]">${fmt2(facturado)}</span>
            </div>
            <ul className="mt-4 divide-y divide-[var(--linea)]">
              {facturas.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block text-[15px] text-[var(--texto)]">{f.invoice_number}</span>
                    <span className="block text-[13px] text-[var(--tenue)]">
                      {new Date(f.issue_date).toLocaleDateString('es-EC')}
                      {f.stage_name ? ` · ${f.stage_name}` : ''}
                      {f.sri_status === 'authorized' ? ' · ' + SRI.authorized : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-[15px] tabular-nums text-[var(--texto)]">${fmt2(Number(f.total))}</span>
                    {f.has_pdf && (
                      <a href={pdf(f)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--linea-fuerte)] px-3 py-1.5 text-[13px] font-medium text-[var(--violeta-txt)] hover:border-[var(--violeta-vivo)] transition-colors">
                        <Download className="w-4 h-4" /> PDF
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
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
