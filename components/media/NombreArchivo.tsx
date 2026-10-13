'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { QuickEditDialog, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { partirNombre } from '@/lib/media/ref';

/**
 * El nombre de un archivo guardado en el Drive de la empresa, con un lápiz para renombrarlo.
 *
 * Renombrar cambia el nombre en Drive Y en la plataforma (primero Drive; si falla, no cambia
 * nada). Se edita solo el nombre: la extensión se muestra pero no se toca.
 *
 * `renombrar` recibe el nombre base y devuelve el nombre final. Por defecto llama a
 * `PATCH /api/media/<fileId>`; un producto (que no habla con la plataforma desde el
 * navegador) pasa su propia acción.
 */
export async function renombrarEnPlataforma(fileId: string, base: string): Promise<string> {
  const res = await fetch(`/api/media/${fileId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: base }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'No se pudo renombrar');
  return j.nombre as string;
}

export default function NombreArchivo({
  nombre, puedeEditar, renombrar, onRenombrado, className = '',
}: {
  nombre: string;
  puedeEditar: boolean;
  renombrar: (base: string) => Promise<string>;
  onRenombrado?: (nombreFinal: string) => void;
  className?: string;
}) {
  const { base, ext } = partirNombre(nombre);
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(base);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrir = () => { setValor(base); setError(null); setAbierto(true); };
  const guardar = async () => {
    setGuardando(true); setError(null);
    try {
      const final = await renombrar(valor.trim());
      onRenombrado?.(final);
      setAbierto(false);
    } catch (e: any) {
      setError(e?.message || 'No se pudo renombrar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className={`flex items-center gap-1 min-w-0 ${className}`}>
        <span className="truncate text-[11px] text-digi-muted" title={nombre}>{nombre}</span>
        {puedeEditar && (
          <button type="button" onClick={abrir} title="Renombrar" aria-label={`Renombrar ${nombre}`}
            className="shrink-0 p-0.5 rounded text-digi-muted hover:text-digi-text hover:bg-digi-border/40 transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
      <QuickEditDialog open={abierto} title="Renombrar archivo" onClose={() => !guardando && setAbierto(false)}
        onSave={guardar} saving={guardando} canSave={!!valor.trim() && valor.trim() !== base}>
        <EditField label="Nombre">
          <div className="flex items-center gap-2">
            <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)} maxLength={150}
              onKeyDown={(e) => { if (e.key === 'Enter' && valor.trim() && valor.trim() !== base && !guardando) guardar(); }}
              className={EDIT_INPUT} />
            {ext && <span className="shrink-0 text-sm text-digi-muted">.{ext}</span>}
          </div>
        </EditField>
        {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      </QuickEditDialog>
    </>
  );
}
