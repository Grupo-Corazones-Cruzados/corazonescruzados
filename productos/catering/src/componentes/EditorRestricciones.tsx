'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { Boton, Entrada, EstadoVacio } from '@/componentes/ui';
import { Aviso, Chips } from '@/componentes/campos';
import { ETIQUETA_COMIDA, ETIQUETA_CATEGORIA } from '@/lib/catalogo';
import type { TipoComida, CategoriaAlimento } from '@/generated/prisma/enums';

/**
 * El editor de «lo que no come»: lo usan la ficha del personal y «Mi perfil» del
 * cliente, con la misma lista y la misma regla (sin comidas marcadas = todas).
 */
export function EditorRestricciones({
  alimentos, comidas, inicial, guardar,
}: {
  alimentos: { id: number; nombre: string; categoria: CategoriaAlimento }[];
  comidas: TipoComida[];
  inicial: { alimentoId: number; tiposComida: TipoComida[] }[];
  guardar: (r: { alimentoId: number; tiposComida: string[] }[]) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [lista, setLista] = useState(inicial);
  const [busca, setBusca] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  const marcado = (id: number) => lista.find((r) => r.alimentoId === id);
  const alternar = (id: number) => setLista(marcado(id) ? lista.filter((r) => r.alimentoId !== id) : [...lista, { alimentoId: id, tiposComida: [] }]);
  const q = busca.trim().toLowerCase();
  const porCategoria = new Map<CategoriaAlimento, typeof alimentos>();
  for (const a of alimentos) if (!q || a.nombre.toLowerCase().includes(q)) porCategoria.set(a.categoria, [...(porCategoria.get(a.categoria) ?? []), a]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-tenue">Marca lo que NO come. Si una restricción es solo para algunas comidas, elígelas; sin elegir ninguna, aplica a todas.</p>
        <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar alimento…" className="w-56" />
      </div>
      {alimentos.length === 0 && <EstadoVacio icono={ShieldAlert} titulo="No hay alimentos en el catálogo" detalle="La cocina los carga en «Alimentos»." />}
      {[...porCategoria.entries()].map(([cat, lista2]) => (
        <div key={cat}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">{ETIQUETA_CATEGORIA[cat]}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {lista2.map((a) => {
              const m = marcado(a.id);
              return (
                <div key={a.id} className={`rounded border px-3 py-2 ${m ? 'border-error bg-error-suave/40' : 'border-borde'}`}>
                  <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={!!m} onChange={() => alternar(a.id)} className="h-4 w-4 accent-[var(--color-error)]" />
                    <span className={m ? 'font-semibold' : ''}>{a.nombre}</span>
                  </label>
                  {m && comidas.length > 1 && (
                    <div className="mt-2">
                      <Chips opciones={comidas} etiquetas={ETIQUETA_COMIDA} valor={m.tiposComida} alCambiar={(v) => setLista(lista.map((r) => (r.alimentoId === a.id ? { ...r, tiposComida: v } : r)))} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {error && <Aviso texto={error} />}
      <div className="flex justify-end border-t border-borde pt-4">
        <Boton disabled={enCurso} onClick={() => arranca(async () => { setError(null); const r = await guardar(lista); if (!r.ok) return setError(r.error); toast.success('Restricciones guardadas'); router.refresh(); })}>
          {enCurso ? 'Guardando…' : 'Guardar restricciones'}
        </Boton>
      </div>
    </div>
  );
}

