'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info, type LucideIcon } from 'lucide-react';
import { usarBurbuja, Burbuja } from './burbuja';
import MenuMas, { type AccionMenu } from './MenuMas';
import { BTN_SECONDARY } from './Button';
import { EnBarraAcciones } from '@/components/dashboard/BarraAcciones';

const mf = { fontFamily: 'var(--font-body)' } as const;

/** Un dato secundario del registro (cliente, importe, fecha…), dentro de la burbuja (i). */
export interface Detalle {
  icono: LucideIcon;
  etiqueta: string;
  valor: ReactNode;
  /** `mailto:`, `tel:` o una ruta: el valor se vuelve enlace. */
  href?: string;
}

interface DetailHeaderProps {
  /** A dónde vuelve la flecha que va antes del título. */
  breadcrumb: { label: string; href: string };
  title: string;
  /** UNA línea de estado bajo el título. */
  status?: ReactNode;
  /** Datos secundarios: van en la burbuja (i) junto al título, no bajo él. */
  detalles?: Detalle[];
  /** @deprecated Usar `detalles`. Si llega, se pinta dentro de la burbuja (i). */
  chips?: ReactNode;
  /**
   * Acciones PRINCIPALES (las que deciden: Descargar el PDF, Resolver, Aprobar…). En
   * escritorio, a la derecha de la cabecera; en el teléfono, en la barra de abajo.
   */
  actions?: ReactNode;
  /** Acciones SECUNDARIAS: botones en escritorio y dentro del «⋯» en el teléfono. */
  secundarias?: AccionMenu[];
  /** Acciones que van SIEMPRE en el «⋯» (también en escritorio). */
  overflow?: AccionMenu[];
  /** Botón(es) de solo icono a la DERECHA del «⋯» (p. ej. "Compartir acceso"). */
  trailing?: ReactNode;
  /**
   * `true` cuando las principales son botones de SOLO ICONO (Ticket y Proyecto, Fernando
   * 2026-09-29): caben junto al título y no amontonan texto, así que se quedan en la
   * cabecera también en el teléfono en vez de bajar a la barra.
   */
  soloIconos?: boolean;
}

/**
 * Cabecera de un registro (Fluent/M365) — definición ÚNICA.
 *
 * ── LAS REGLAS DEL TELÉFONO (Fernando, 2026-10-22; en GCC World el 2026-10-23) ──────────
 *  · «Volver» es una flecha ANTES del título, no una fila de texto encima.
 *  · Bajo el título solo va una línea de estado. Lo demás (cliente, importe, fecha) va en
 *    un botón (i) con burbuja: *«ocupan espacio y rellenan de forma innecesaria»*.
 *  · Las principales bajan a la barra de abajo (`EnBarraAcciones`); las secundarias, al «⋯».
 *    Antes se amontonaban en dos filas bajo el título (Facturas: «Descargar PDF», «Reenviar»
 *    y «Detalle de servicios»).
 *  · En escritorio todo sigue en la cabecera: secundarias primero, principales a la derecha.
 * Regla general en `/diseno` §4-quater.
 */
export default function DetailHeader({
  breadcrumb, title, status, detalles, chips, actions, secundarias = [], overflow = [], trailing, soloIconos = false,
}: DetailHeaderProps) {
  const hayDetalles = (detalles?.length ?? 0) > 0 || !!chips;
  const menuMovil = [...secundarias, ...overflow];

  // Lo que va a la derecha en el TELÉFONO: los iconos que se quedan en la cabecera y el «⋯».
  const derechaMovil = (soloIconos && actions) || menuMovil.length > 0 || trailing;

  return (
    <div className="mb-5">
      <div className="pb-3 border-b border-digi-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Link
              href={breadcrumb.href}
              aria-label={`Volver a ${breadcrumb.label}`}
              title={`Volver a ${breadcrumb.label}`}
              className="destino-tactil shrink-0 -ml-1.5 w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-accent hover:bg-accent-light transition-colors"
            >
              <ArrowLeft className="w-[18px] h-[18px]" />
            </Link>
            {/* ⚠️ `truncate` SOLO desde `sm`. En un teléfono el título de un registro es lo
                que dice de qué registro se trata: aquí envuelve. */}
            <h1 className="page-title pixel-heading text-digi-text sm:truncate leading-tight min-w-0">{title}</h1>
            {hayDetalles && <BotonDetalles titulo={title} detalles={detalles} chips={chips} />}
          </div>

          {/* Escritorio: secundarias como botones, principales a la derecha y el «⋯». */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {secundarias.map((s, i) => (
              <button key={i} type="button" onClick={s.onClick} disabled={s.disabled} title={s.disabled ? s.hint : undefined}
                className={`${BTN_SECONDARY} ${s.danger ? '!text-red-600' : ''}`}>
                {s.icon && <s.icon className="w-4 h-4" />} {s.label}
              </button>
            ))}
            {actions}
            {overflow.length > 0 && <MenuMas items={overflow} />}
            {trailing}
          </div>
        </div>

        {/* La línea de estado. En el TELÉFONO lleva a su derecha los iconos y el «⋯»: junto al
            título le robaban el ancho y un título de tres palabras salía en cuatro líneas
            (ticket, medido a 390 px el 2026-10-23). */}
        {(status || derechaMovil) && (
          <div className={`flex items-center justify-between gap-2 mt-1.5 ${status ? '' : 'lg:hidden'}`}>
            <div className="flex items-center flex-wrap gap-2 min-w-0 pl-[26px]">{status}</div>
            {derechaMovil && (
              <div className="lg:hidden flex items-center gap-1.5 shrink-0">
                {soloIconos && actions}
                {menuMovil.length > 0 && <MenuMas items={menuMovil} />}
                {trailing}
              </div>
            )}
          </div>
        )}
      </div>

      {actions && !soloIconos && <EnBarraAcciones>{actions}</EnBarraAcciones>}
    </div>
  );
}

/** El botón (i) y su burbuja con los datos secundarios del registro. */
function BotonDetalles({ titulo, detalles, chips }: { titulo: string; detalles?: Detalle[]; chips?: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement | null>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  const { burbujaRef, caja } = usarBurbuja(abierto, cerrar, botonRef, 'derecha');

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Detalles"
        aria-expanded={abierto}
        title="Detalles"
        className={`destino-tactil shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
          abierto ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-accent hover:bg-accent-light'
        }`}
      >
        <Info className="w-4 h-4" />
      </button>
      {abierto && caja && (
        <Burbuja caja={caja} burbujaRef={burbujaRef} lado="derecha" etiqueta={`Detalles de ${titulo}`} ancho={288}
          contenedor={botonRef.current?.closest('dialog')}>
          <div className="p-1.5" style={mf}>
            {detalles?.map((d, i) => {
              const fila = (
                <>
                  <d.icono className="w-4 h-4 mt-0.5 shrink-0 text-digi-muted" />
                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wide text-digi-muted">{d.etiqueta}</span>
                    <span className={`block text-[13px] break-words ${d.href ? 'text-accent' : 'text-digi-text'}`}>{d.valor}</span>
                  </span>
                </>
              );
              return d.href ? (
                <a key={i} href={d.href} className="flex items-start gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent/10 transition-colors">{fila}</a>
              ) : (
                <div key={i} className="flex items-start gap-2.5 px-2 py-1.5">{fila}</div>
              );
            })}
            {chips && <div className="flex flex-col items-start gap-1.5 px-2 py-1.5">{chips}</div>}
          </div>
        </Burbuja>
      )}
    </>
  );
}

/** Small meta chip for the header (cliente, costo, fecha…). */
export function HeaderChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-digi-muted bg-[#f3f2f1] border border-digi-border px-2 py-0.5 rounded"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {children}
    </span>
  );
}
