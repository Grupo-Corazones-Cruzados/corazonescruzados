'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Eye, Undo2 } from 'lucide-react';
import { volverAMiCuenta } from '@/acciones/vistaComo';

const ROL = { ADMIN: 'Administrador', OPERADOR: 'Operador', CONSULTA: 'Consulta' } as const;

/**
 * Franja permanente mientras un administrador ve la app como otro usuario (2026-11-08).
 * Se dice SIEMPRE y arriba: quien olvida que está «dentro» de otra cuenta concluye que la app
 * está rota cuando algo no se guarda. Y el botón para volver está a la vista, en todo momento.
 */
export function AvisoVistaComo({
  slug,
  nombre,
  rol,
}: {
  slug: string;
  nombre: string;
  rol: keyof typeof ROL;
}) {
  const [enCurso, arranca] = useTransition();
  return (
    <div className="flex items-center justify-center gap-3 bg-aviso px-4 py-1.5 text-[12px] font-semibold text-acento-contraste">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">
        Viendo la app como {nombre} ({ROL[rol]}). No se guarda ningún cambio.
      </span>
      <button
        type="button"
        disabled={enCurso}
        onClick={() =>
          arranca(async () => {
            const r = await volverAMiCuenta(slug);
            if (r && !r.ok) toast.error(r.error);
          })
        }
        className="foco-visible inline-flex shrink-0 items-center gap-1.5 rounded border border-acento-contraste/60 px-2 py-0.5 hover:bg-black/10 disabled:opacity-60"
      >
        <Undo2 className="h-3.5 w-3.5" /> {enCurso ? 'Volviendo…' : 'Volver a mi cuenta'}
      </button>
    </div>
  );
}
