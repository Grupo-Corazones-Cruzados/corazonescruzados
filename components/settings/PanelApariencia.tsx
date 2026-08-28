'use client';

/**
 * APARIENCIA — el tema del panel, claro u oscuro.
 *
 * Vivía como un botón en el pie del menú lateral. Se movió aquí (2026-08-28) por dos
 * motivos: el pie del menú se quedó con lo imprescindible, y esto **no es una herramienta
 * de uso diario sino una preferencia** — se elige una vez y no se vuelve a tocar. Las
 * preferencias se buscan en Configuración; el menú es para navegar.
 *
 * Se recuerda **por navegador**, no en la cuenta: es cómo se ve la pantalla en ESTE equipo.
 * Quien entre desde otro ordenador empieza en claro, y está bien.
 */

import { useTemaPanel } from '@/components/providers/TemaPanel';
import { Sun, Moon } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

const OPCIONES = [
  { oscuro: false, label: 'Claro', Icon: Sun },
  { oscuro: true, label: 'Oscuro', Icon: Moon },
] as const;

export default function PanelApariencia() {
  const { oscuro, poner } = useTemaPanel();

  return (
    <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-4">
      <h3 className="text-[14px] font-semibold text-digi-text" style={mf}>Apariencia</h3>
      <p className="text-[12px] text-digi-muted mt-0.5 mb-3" style={mf}>
        Cómo se ve el panel en este equipo. Se recuerda en este navegador.
      </p>

      <div className="flex gap-2">
        {OPCIONES.map(({ oscuro: valor, label, Icon }) => {
          const activo = oscuro === valor;
          return (
            <button
              key={label}
              type="button"
              onClick={() => poner(valor)}
              aria-pressed={activo}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[12.5px] font-medium border transition-colors ${
                activo
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-digi-border text-digi-muted hover:text-digi-text hover:border-accent/40'
              }`}
              style={mf}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
