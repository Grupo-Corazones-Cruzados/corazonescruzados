'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Eye, Search } from 'lucide-react';
import { Ventanita, Cargando } from '@/componentes/ui';
import { candidatosVerComo, verComo, type Candidato } from '@/acciones/vistaComo';

const ROL = { ADMIN: 'Administrador', OPERADOR: 'Operador', CONSULTA: 'Consulta' } as const;

/**
 * «VER COMO OTRO USUARIO», desde el MENÚ, como en GCC World (Fernando, 2026-11-08: «la
 * habíamos implementado en gcc world como una opción dentro del menú, no donde se configuran
 * los usuarios»). Se abre al tocar tu nombre en el pie del menú.
 *
 * ⚠️ Va con un portal al envoltorio del TEMA (`.app-producto`): dentro del menú «Más» del
 * teléfono, que se desliza con `transform`, un `fixed` se colocaría respecto al menú y no a la
 * pantalla; y colgado del <body> perdería el tema.
 */
export function DialogoVerComo({ slug, abierto, alCerrar }: { slug: string; abierto: boolean; alCerrar: () => void }) {
  const [lista, setLista] = useState<Candidato[] | null>(null);
  const [busca, setBusca] = useState('');
  const [enCurso, arranca] = useTransition();
  const [destino, setDestino] = useState<HTMLElement | null>(null);

  useEffect(() => setDestino(document.querySelector<HTMLElement>('.app-producto')), []);
  useEffect(() => {
    if (!abierto) return;
    setBusca('');
    setLista(null);
    candidatosVerComo(slug).then((r) => {
      if (!r.ok) { toast.error(r.error); alCerrar(); return; }
      setLista(r.lista);
    });
  }, [abierto, slug, alCerrar]);

  const t = busca.trim().toLowerCase();
  const filtrados = (lista ?? []).filter((u) => !t || u.nombre.toLowerCase().includes(t) || u.usuario.toLowerCase().includes(t));

  if (!destino) return null;
  return createPortal(
    <Ventanita abierto={abierto} alCerrar={alCerrar} titulo="Ver como">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" autoFocus className="campo pl-8" />
        </div>
        {lista === null ? (
          <Cargando />
        ) : filtrados.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-tenue">Sin usuarios</p>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-borde overflow-y-auto">
            {filtrados.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={enCurso}
                  onClick={() =>
                    arranca(async () => {
                      const r = await verComo(slug, u.id);
                      if (r && !r.ok) toast.error(r.error);
                    })
                  }
                  className="foco-visible flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-realce disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-texto">{u.nombre}</span>
                    <span className="block truncate text-[11.5px] text-tenue">{u.usuario} · {ROL[u.rol]}</span>
                  </span>
                  <Eye className="h-4 w-4 shrink-0 text-tenue" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Ventanita>,
    destino,
  );
}
