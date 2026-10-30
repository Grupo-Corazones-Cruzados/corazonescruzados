'use client';

import { useSyncExternalStore } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useConsultaMedia, PANTALLA_LG } from '@/lib/hooks/useConsultaMedia';

const mf = { fontFamily: 'var(--font-body)' } as const;
const sinSuscripcion = () => () => {};

/** ¿Teléfono (por debajo de `lg`)? Hasta hidratar responde «no», para no ver el teléfono en el ordenador. */
export function useEnTelefono() {
  const hidratado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const grande = useConsultaMedia(PANTALLA_LG);
  return hidratado && !grande;
}

/**
 * ⭐ UN GRUPO DE UN FORMULARIO DE CONFIGURACIÓN (Fernando, 2026-10-30: «corregir los diseños de
 * formulario para móvil… que la versión sea mejor»).
 *
 * En el teléfono el formulario era una tarjeta grande con todo dentro —y dentro, más cajas—:
 * 16 px de margen de la tarjeta más 16 del cuerpo se comían el ancho de los campos y todo se
 * leía como un bloque. Ahora, como la portada de Configuración (`PortadaSecciones`): cada grupo
 * es SU tarjeta con su nombre encima (11 px, mayúsculas, tenue), y los grupos van separados
 * sobre el fondo. El panel que los contiene deja de ser tarjeta en el teléfono (`SettingsPanel`).
 *
 * En escritorio no cambia nada: el grupo es la franja separada por una línea de siempre, con
 * su título con icono (solo si `tituloEscritorio`; los datos de arriba nunca lo tuvieron).
 */
export default function GrupoForm({ titulo, Icon, tituloEscritorio = true, primero = false, extra, children }: {
  titulo: string;
  Icon?: LucideIcon;
  /** En escritorio, ¿lleva el título? */
  tituloEscritorio?: boolean;
  /** En escritorio, el primero no lleva la línea de arriba. */
  primero?: boolean;
  /** Lo que va a la derecha del título (un contador, «Añadir»…). */
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const enTelefono = useEnTelefono();
  if (enTelefono) {
    return (
      <section style={mf}>
        <div className="flex items-center justify-between gap-2 px-1 mb-1.5 min-h-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-digi-muted">{titulo}</h3>
          {extra}
        </div>
        <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-4 space-y-4">{children}</div>
      </section>
    );
  }
  return (
    <section className={primero ? 'space-y-4' : 'pt-3 border-t border-digi-border space-y-3'}>
      {tituloEscritorio && (
        <div className="flex items-center justify-between gap-2">
          <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text" style={mf}>
            {Icon && <Icon className="w-4 h-4 text-accent" />} {titulo}
          </h4>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}
