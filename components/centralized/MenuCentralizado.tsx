'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LayoutDashboard, Network } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMenuMovil } from '@/components/dashboard/MenuMovil';
import type { SistemaMapa } from '@/components/centralized/Mapa4P';
import { ICONO_CELDA, ICONO_PISO, ICONO_SISTEMA } from '@/components/centralized/iconos4P';
import { PISOS, PASOS, systemPath } from '@/lib/centralized/systems';
import { useConsultaMedia } from '@/lib/hooks/useConsultaMedia';
import { TINTE_CENTRALIZADO } from '@/components/accesos/tintes';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * LA SEGUNDA CAPA DE CENTRALIZADO (Fernando, 2026-11-08: «lo del menú 1 y menú 2 también en
 * Centralizado», con la misma hamburguesa). A la derecha del raíl de Accesos (`MenuAccesos capa`), con
 * el tinte orquídea de `.capa-dos`: el MAPA 4P, los sistemas de la cuenta en su celda piso × paso. Es
 * una tabla, así que no se encoge a iconos: en escritorio se ve fija; en el teléfono la abre la
 * hamburguesa junto con la primera capa. Antes era un cajón propio con la marca de GCC World.
 *
 * ⇒ PLEGADA EN ESCRITORIO MIENTRAS NO SE SEÑALA (Fernando, 2026-11-08), como la segunda capa de los
 * productos (`MenuProducto`): 4 rem con los cuatro PISOS del 4P en iconos, cada uno con cuántos
 * sistemas tiene la cuenta en él y marcado el del sistema abierto. Al pasar el puntero se despliega el
 * mapa entero ENCIMA del contenido, sin moverlo (el layout reserva solo el ancho plegado). En el
 * teléfono no cambia nada: oculta hasta tocar la hamburguesa.
 */
export default function MenuCentralizado() {
  const pathname = usePathname();
  const { abierto, cerrar } = useMenuMovil();
  const [sistemas, setSistemas] = useState<SistemaMapa[] | null>(null);

  // En escritorio se ve siempre; en el teléfono, se piden al abrirla por primera vez.
  const telefono = useConsultaMedia('(max-width: 63.99rem)');
  const [sobreElMenu, setSobreElMenu] = useState(false);
  const estrecho = !telefono && !sobreElMenu && !abierto;
  const porPiso = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sistemas ?? []) m[s.piso] = (m[s.piso] ?? 0) + 1;
    return m;
  }, [sistemas]);
  const pisoAbierto = pathname.split('/')[3];
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
        onMouseEnter={() => setSobreElMenu(true)} onMouseLeave={() => setSobreElMenu(false)}
        className={`rail capa-dos fixed top-0 left-16 z-40 h-full ${estrecho ? 'w-16' : telefono ? 'w-[18rem]' : 'w-[18rem] shadow-2xl'} max-w-[calc(100vw-4rem)] pt-[var(--seguro-arriba)] pb-[var(--seguro-abajo)] bg-digi-card border-r border-digi-border flex flex-col overflow-hidden transition-[width,translate] duration-200 ease-out motion-reduce:transition-none ${
          abierto ? 'translate-x-0 shadow-xl z-50' : '-translate-x-[calc(100%+4rem)] lg:translate-x-0'}`}>
        <Link href="/dashboard/centralized" title={estrecho ? 'Centralizado' : undefined}
          className={`flex items-center gap-2.5 h-14 border-b border-digi-border shrink-0 ${estrecho ? 'justify-center px-0' : 'px-4'}`}>
          <span className="w-[30px] h-[30px] shrink-0 rounded-lg grid place-items-center border border-white/15" style={{ background: TINTE_CENTRALIZADO }}>
            <Network className="w-4 h-4 text-white" strokeWidth={2} />
          </span>
          {!estrecho && <span className="text-[14px] font-bold text-digi-text tracking-tight truncate" style={mf}>CENTRALIZADO</span>}
        </Link>

        {estrecho ? (
          // Plegada: los pisos del 4P, como entradas de menú solo con icono.
          <nav aria-label="Pisos del Modelo 4P" className="flex-1 py-2 px-2 space-y-0.5" style={mf}>
            {PISOS.map((p) => {
              const Icono = ICONO_PISO[p.key];
              const n = porPiso[p.key] ?? 0;
              const activo = p.key === pisoAbierto;
              return (
                <span key={p.key} title={`${p.label}: ${n} sistema${n === 1 ? '' : 's'}`}
                  className={`relative flex items-center justify-center rounded-md h-11 ${
                    activo ? 'bg-accent-light text-accent' : n ? 'text-digi-muted' : 'text-digi-muted/40'}`}>
                  {activo && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />}
                  <Icono className="w-[18px] h-[18px]" strokeWidth={2} />
                  {n > 0 && <span className={`absolute top-1 right-1.5 text-[9.5px] font-bold leading-none tabular-nums ${activo ? 'text-accent' : 'text-digi-muted'}`}>{n}</span>}
                </span>
              );
            })}
          </nav>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 lg:min-w-[18rem]">
            <ListaVertical sistemas={sistemas} pathname={pathname} />
          </div>
        )}

      </aside>
    </>
  );
}

const LLAVE_CERRADOS = 'gcc_menu_centralizado_cerrados';

/**
 * EL MENÚ 2 EN VERTICAL (Fernando, 2026-11-11: «que el menú sea más vertical, ya no tipo tabla o
 * modelo 4P»). Antes era la tabla piso × paso. Ahora: «Resumen» (el dashboard) y debajo cada PISO
 * como una sección que se abre y se cierra, con sus sistemas uno debajo de otro —su icono, su nombre
 * y el paso en pequeño—, ordenados por paso. El del sistema abierto se marca y su piso se abre solo.
 * Lo que se cierra se recuerda en el navegador.
 */
function ListaVertical({ sistemas, pathname }: { sistemas: SistemaMapa[] | null; pathname: string }) {
  const [cerrados, setCerrados] = useState<string[]>([]);
  useEffect(() => {
    try { const c = localStorage.getItem(LLAVE_CERRADOS); if (c) setCerrados(JSON.parse(c)); } catch { /* sin almacenamiento */ }
  }, []);
  const alternar = (piso: string) => setCerrados((c) => {
    const nuevo = c.includes(piso) ? c.filter((x) => x !== piso) : [...c, piso];
    try { localStorage.setItem(LLAVE_CERRADOS, JSON.stringify(nuevo)); } catch { /* sin almacenamiento */ }
    return nuevo;
  });

  const ordenPaso = (k: string) => PASOS.findIndex((p) => p.key === k);
  const pisoAbierto = pathname.split('/')[3];
  const fila = (activo: boolean) =>
    `relative flex items-center gap-2.5 rounded-md px-2.5 w-full text-left transition-colors ${activo ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text hover:bg-white/[0.06]'}`;

  return (
    <nav aria-label="Sistemas de Centralizado" className="space-y-1" style={mf}>
      <Link href="/dashboard/centralized" className={`${fila(pathname === '/dashboard/centralized')} h-9 text-[13px] font-medium`}>
        <LayoutDashboard className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
        <span className="truncate">Resumen</span>
      </Link>

      {sistemas === null ? (
        <p className="px-2.5 py-3 text-[12px] text-digi-muted">Cargando…</p>
      ) : !sistemas.length ? (
        <p className="px-2.5 py-3 text-[12px] text-digi-muted">Aún no tienes acceso a ningún sistema.</p>
      ) : PISOS.map((p) => {
        const delPiso = sistemas.filter((s) => s.piso === p.key).sort((a, b) => ordenPaso(a.paso) - ordenPaso(b.paso) || a.name.localeCompare(b.name));
        if (!delPiso.length) return null;
        const IconoPiso = ICONO_PISO[p.key];
        const abierto = !cerrados.includes(p.key) || p.key === pisoAbierto;
        return (
          <div key={p.key} className="pt-1">
            <button type="button" onClick={() => alternar(p.key)} aria-expanded={abierto}
              className="w-full h-8 flex items-center gap-2 px-2.5 rounded-md text-[11px] font-semibold uppercase tracking-wide text-digi-muted/80 hover:text-digi-text transition-colors">
              <IconoPiso className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{p.label}</span>
              <span className="ml-auto tabular-nums font-medium normal-case">{delPiso.length}</span>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${abierto ? '' : '-rotate-90'}`} />
            </button>
            {abierto && (
              <div className="mt-0.5 space-y-0.5">
                {delPiso.map((s) => {
                  const ruta = systemPath(s);
                  const activo = pathname === ruta || pathname.startsWith(ruta + '/');
                  const Icono = ICONO_SISTEMA[s.slug] ?? ICONO_CELDA[s.piso]?.[s.paso] ?? Network;
                  const paso = PASOS.find((x) => x.key === s.paso)?.label ?? s.paso;
                  return (
                    <Link key={s.id} href={ruta} title={`${s.name} · ${p.label} · ${paso}`} className={`${fila(activo)} py-1.5`}>
                      {activo && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />}
                      <Icono className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                      <span className="min-w-0">
                        <span className={`block truncate text-[13px] font-medium ${activo ? '' : 'text-digi-text'}`}>{s.name}</span>
                        <span className="block truncate text-[11px] text-digi-muted">{paso}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
