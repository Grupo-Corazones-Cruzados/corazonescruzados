'use client';

/**
 * EL DETALLE PÚBLICO DE UN TICKET O UN PROYECTO — las piezas que comparten `/proyecto/<id>` y
 * `/ticket/<id>` (Fernando, 2026-10-30: que desde el enlace de pago se pueda abrir el detalle).
 *
 * Son las mismas que ya pintaba `/proyecto/[id]`, sacadas aquí para que el ticket no repita
 * una versión «parecida». Siguen las reglas vigentes del panel y del sitio:
 *   · el estado es texto con su punto de color, sin cápsula con relleno ni borde;
 *   · ninguna nota de ayuda bajo los controles;
 *   · el botón que lleva al pago, abajo a la derecha de la cabecera.
 */

import type { ReactNode } from 'react';
import { CheckCircle2, Clock, Download, FileText, Layers, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Tarjeta } from '@/components/sitio/piezas';
import { SITIO } from '@/lib/sitio/contenido';
import { fmt2 } from '@/lib/format';

const SRI_AUTORIZADA = 'Autorizada por el SRI';
export const fechaCorta = (v: any) => (v ? new Date(v).toLocaleDateString('es-EC') : '');

/** Botón del sitio, como enlace (mismo aspecto que `BotonPrimario`/`BotonSecundario`). */
export function EnlaceBoton({ href, icon: Icon, children, primario = false }: {
  href: string; icon?: LucideIcon; children: ReactNode; primario?: boolean;
}) {
  return (
    <a href={href}
      className={`inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-[15px] font-medium transition-colors ${
        primario
          ? 'bg-[var(--violeta)] hover:bg-[#3f2578] text-white'
          : 'border border-[var(--linea-fuerte)] hover:border-[var(--violeta)] hover:bg-[#7b5fbf]/[0.06] text-[var(--texto)]'}`}>
      {Icon && <Icon className="w-[18px] h-[18px]" />}
      {children}
    </a>
  );
}

/** Rótulo violeta, título, descripción, una línea de datos y, debajo a la derecha, las acciones. */
export function CabeceraDetalle({ rotulo, titulo, descripcion, datos, acciones }: {
  rotulo: string;
  titulo: string;
  descripcion?: string | null;
  datos?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <header>
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--violeta-txt)]">{rotulo}</p>
      <h1 className="mt-3 text-[30px] sm:text-[38px] leading-[1.15] font-semibold tracking-tight text-[var(--texto)]">
        {titulo}
      </h1>
      {descripcion && <p className="mt-4 max-w-3xl text-[16.5px] leading-relaxed text-[var(--suave)]">{descripcion}</p>}
      {(datos || acciones) && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[14px] text-[var(--suave)]">{datos}</div>
          {acciones && <div className="flex flex-wrap items-center gap-2 ml-auto">{acciones}</div>}
        </div>
      )}
    </header>
  );
}

/** El estado: punto de color y texto. Sin cápsula. */
export function Estado({ texto, hecho }: { texto: string; hecho: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[var(--texto)]">
      <span className={`w-2 h-2 rounded-full ${hecho ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {texto}
    </span>
  );
}

/** Un dato de la cabecera con su icono (p. ej. la fecha de entrega). */
export function Dato({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><Icon className="w-4 h-4 text-[var(--tenue)]" /> {children}</span>;
}

/** Título de una tarjeta, con su cifra a la derecha. */
export function TituloTarjeta({ icon: Icon, children, cifra }: { icon: LucideIcon; children: ReactNode; cifra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--texto)]">
        <Icon className="w-[18px] h-[18px] text-[var(--violeta-txt)]" /> {children}
      </h2>
      {cifra != null && <span className="text-[15px] font-semibold tabular-nums text-[var(--texto)]">{cifra}</span>}
    </div>
  );
}

export function TarjetaEtapas({ etapas, total, titulo = 'Etapas' }: {
  etapas: { id: number; name: string; amount: number; facturada: boolean }[];
  total: number;
  titulo?: string;
}) {
  if (!etapas.length) return null;
  return (
    <Tarjeta>
      <TituloTarjeta icon={Layers} cifra={`$${fmt2(total)}`}>{titulo}</TituloTarjeta>
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
              <span className="text-[13px] text-[var(--tenue)]">{e.facturada ? 'Facturada' : 'Pendiente'}</span>
              <span className="text-[15px] tabular-nums text-[var(--texto)]">${fmt2(Number(e.amount))}</span>
            </span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export function TarjetaFacturas({ facturas, pdf }: { facturas: any[]; pdf: (f: any) => string }) {
  if (!facturas.length) return null;
  const facturado = facturas.reduce((s, f) => s + Number(f.total || 0), 0);
  return (
    <Tarjeta>
      <TituloTarjeta icon={FileText} cifra={`$${fmt2(facturado)}`}>Facturas</TituloTarjeta>
      <ul className="mt-4 divide-y divide-[var(--linea)]">
        {facturas.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block text-[15px] text-[var(--texto)]">{f.invoice_number}</span>
              <span className="block text-[13px] text-[var(--tenue)]">
                {fechaCorta(f.issue_date)}
                {f.stage_name ? ` · ${f.stage_name}` : ''}
                {f.sri_status === 'authorized' ? ` · ${SRI_AUTORIZADA}` : ''}
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
  );
}

/** Enlace inválido o caducado: se contesta por correo, no mandando a leer condiciones legales. */
export function ErrorEnlace({ mensaje }: { mensaje: string }) {
  return (
    <Tarjeta className="max-w-xl mx-auto text-center">
      <ShieldCheck className="w-8 h-8 mx-auto text-[var(--violeta-txt)]" />
      <h1 className="mt-4 text-[22px] font-semibold text-[var(--texto)]">{mensaje}</h1>
      <p className="mt-2 text-[15px] text-[var(--suave)]">
        Si el enlace caducó, pídenos uno nuevo y te lo enviamos al momento.
      </p>
      <div className="mt-6"><EnlaceBoton href={`mailto:${SITIO.correo}`} primario>Escríbenos</EnlaceBoton></div>
    </Tarjeta>
  );
}

export function CargandoDetalle() {
  return (
    <>
      <div className="h-6 w-48 rounded bg-[var(--linea)] animate-pulse" />
      <div className="mt-4 h-10 w-2/3 rounded bg-[var(--linea)] animate-pulse" />
      <div className="mt-10 h-40 rounded-xl bg-[var(--linea)]/60 animate-pulse" />
    </>
  );
}
