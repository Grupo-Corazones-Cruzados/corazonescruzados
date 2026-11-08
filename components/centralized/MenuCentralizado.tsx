'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Network } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMenuMovil } from '@/components/dashboard/MenuMovil';
import Mapa4P, { type SistemaMapa } from '@/components/centralized/Mapa4P';
import { useConsultaMedia } from '@/lib/hooks/useConsultaMedia';
import { TINTE_CENTRALIZADO } from '@/components/accesos/tintes';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * LA SEGUNDA CAPA DE CENTRALIZADO (Fernando, 2026-11-08: «lo del menú 1 y menú 2 también en
 * Centralizado», con la misma hamburguesa). A la derecha del raíl de Accesos (`MenuAccesos capa`), con
 * el tinte orquídea de `.capa-dos`: el MAPA 4P, los sistemas de la cuenta en su celda piso × paso. Es
 * una tabla, así que no se encoge a iconos: en escritorio se ve fija; en el teléfono la abre la
 * hamburguesa junto con la primera capa. Antes era un cajón propio con la marca de GCC World.
 */
export default function MenuCentralizado() {
  const pathname = usePathname();
  const { abierto, cerrar } = useMenuMovil();
  const [sistemas, setSistemas] = useState<SistemaMapa[] | null>(null);

  // En escritorio se ve siempre; en el teléfono, se piden al abrirla por primera vez.
  const telefono = useConsultaMedia('(max-width: 63.99rem)');
  useEffect(() => {
    if ((telefono && !abierto) || sistemas !== null) return;
    fetch('/api/centralized/systems')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setSistemas(j.data ?? []))
      .catch(() => setSistemas([]));
  }, [abierto, sistemas, telefono]);
  // Al llegar a otra página el cajón se cierra, como el de Progreso.
  useEffect(() => { cerrar(); }, [pathname, cerrar]);

  return (
    <>
      <div aria-hidden onClick={cerrar}
        className={`fixed inset-0 z-40 bg-black/40 lg:hidden transition-opacity duration-200 ease-out ${abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside aria-label="Centralizado" style={{ '--tinte': TINTE_CENTRALIZADO } as React.CSSProperties}
        className={`rail capa-dos fixed top-0 left-16 z-40 h-full w-[18rem] max-w-[calc(100vw-4rem)] pt-[var(--seguro-arriba)] pb-[var(--seguro-abajo)] bg-digi-card border-r border-digi-border flex flex-col transition-[translate] duration-200 ease-out ${
          abierto ? 'translate-x-0 shadow-xl z-50' : '-translate-x-[calc(100%+4rem)] lg:translate-x-0'}`}>
        <Link href="/dashboard/centralized" className="flex items-center gap-2.5 h-14 px-4 border-b border-digi-border shrink-0">
          <span className="w-[30px] h-[30px] shrink-0 rounded-lg grid place-items-center border border-white/15" style={{ background: TINTE_CENTRALIZADO }}>
            <Network className="w-4 h-4 text-white" strokeWidth={2} />
          </span>
          <span className="text-[14px] font-bold text-digi-text tracking-tight truncate" style={mf}>CENTRALIZADO</span>
        </Link>

        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3">
          <Mapa4P sistemas={sistemas} rutaActual={pathname} />
        </div>

      </aside>
    </>
  );
}
