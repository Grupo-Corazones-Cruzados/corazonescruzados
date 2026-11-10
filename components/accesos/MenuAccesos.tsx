'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Eye, LayoutGrid, LogOut, Settings, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/AuthProvider';
import { useMenuMovil } from '@/components/dashboard/MenuMovil';
import FichaUsuario from '@/components/dashboard/FichaUsuario';
import DialogoVerComoOtro from '@/components/dashboard/DialogoVerComoOtro';
import { useConsultaMedia } from '@/lib/hooks/useConsultaMedia';
import { definicionTema } from '@/lib/temas';
import { iconoDeProducto, useAccesos } from './useAccesos';
import { movimientoDelMenu } from './nivelMenu';
import { tinteDe } from './tintes';
import LanzadorAccesos, { claveHerramienta, claveProducto } from './LanzadorAccesos';

/** Sin favoritos elegidos, el menú fija los primeros (productos y luego herramientas). */
const FIJADOS_POR_DEFECTO = 6;

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * EL MENÚ DE ACCESOS (Fernando, 2026-11-08: «mover el header hacia un menú lateral izquierdo que al
 * poner el puntero encima se expanda, o con la hamburguesa en el móvil, con las secciones de Apps,
 * Productos y Herramientas»). Mismo comportamiento y aspecto que el de Progreso (`DashboardSidebar`):
 * raíl estrecho que se despliega encima del contenido al acercar el puntero; en el teléfono lo abre
 * el botón de `CabeceraMovil` y entra ya con su ancho. Arriba la marca; abajo, Salir: en las apps es
 * el único sitio desde el que se cierra sesión.
 */
/**
 * `capa`: es la PRIMERA capa de dos (Fernando, 2026-11-08: «el menú 1 con apps, productos y
 * herramientas; al elegir Progreso, una capa de menú adicional con lo suyo»). Se queda como raíl de
 * iconos a la izquierda de la segunda capa (en el teléfono, también dentro del menú abierto) y
 * marca cuál está abierta (`activo`).
 */
export default function MenuAccesos({ capa = false, activo }: { capa?: boolean; activo?: string }) {
  const pathname = usePathname();
  const { signOut, user, suplantacion } = useAuth();
  // ⚠️ Mientras se mira como otro, la sesión tiene el rol de ESE usuario: el botón se ofrece por
  // `suplantacion` (para volver), no por el rol. Ver `DashboardSidebar`.
  const esAdmin = user?.role === 'admin';
  const [verComoOtro, setVerComoOtro] = useState(false);
  const [volviendo, setVolviendo] = useState(false);
  const volverAMiVista = async () => {
    setVolviendo(true);
    try {
      const r = await fetch('/api/admin/suplantar', { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d.error ?? 'No se pudo volver'); return; }
      // Recarga completa: la sesión cambia de identidad y no queda nada fiable en memoria.
      window.location.href = '/dashboard/accesos';
    } finally { setVolviendo(false); }
  };
  const { abierto, cerrar } = useMenuMovil();
  // En una herramienta, la abierta queda marcada (sin `activo`, lo dice la ruta).
  const herramientaAbierta = useSearchParams().get('herramienta');
  const activoReal = pathname.startsWith('/dashboard/settings') ? 'configuracion' : activo ?? (pathname.startsWith('/dashboard/admin/gumdramon-app') ? 'gumdramon'
    : pathname.startsWith('/dashboard/admin/espacio') ? 'entorno'
    : pathname.startsWith('/dashboard/tools') ? herramientaAbierta ?? undefined : undefined);
  const { apps, productos, herramientas, rutaHerramienta, abrirProducto } = useAccesos();

  // ── FAVORITOS (Fernando, 2026-11-10): el menú enseña solo lo fijado; lo demás, en el lanzador «Todos».
  // Se guardan en la cuenta (`/api/accesos/fijados`) y se copian en el navegador para no parpadear.
  const llaveFijados = user?.id ? `gcc_accesos_fijados:${user.id}` : null;
  const [guardados, setGuardados] = useState<string[] | null | undefined>(undefined);
  const [lanzador, setLanzador] = useState(false);
  useEffect(() => {
    if (!llaveFijados) return;
    try { const c = localStorage.getItem(llaveFijados); if (c) setGuardados(JSON.parse(c)); } catch { /* sin almacenamiento */ }
    fetch('/api/accesos/fijados').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return;
      setGuardados(j.data);
      try { if (j.data) localStorage.setItem(llaveFijados, JSON.stringify(j.data)); else localStorage.removeItem(llaveFijados); } catch { /* sin almacenamiento */ }
    }).catch(() => {});
  }, [llaveFijados]);
  const todas = useMemo(() => [...(productos ?? []).map(claveProducto), ...herramientas.map(claveHerramienta)], [productos, herramientas]);
  // La selección por defecto espera a los productos (`null` = aún cargando): si no, salían seis herramientas.
  const fijados = useMemo(() => new Set(guardados ?? (productos === null ? [] : todas.slice(0, FIJADOS_POR_DEFECTO))), [guardados, todas, productos]);
  const alternar = useCallback((clave: string) => {
    const base = guardados ?? todas.slice(0, FIJADOS_POR_DEFECTO);
    const nuevo = base.includes(clave) ? base.filter((c) => c !== clave) : [...base, clave];
    setGuardados(nuevo);
    try { if (llaveFijados) localStorage.setItem(llaveFijados, JSON.stringify(nuevo)); } catch { /* sin almacenamiento */ }
    fetch('/api/accesos/fijados', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claves: nuevo }) })
      .then((r) => { if (!r.ok) toast.error('No se pudo guardar el favorito'); }).catch(() => toast.error('No se pudo guardar el favorito'));
  }, [guardados, todas, llaveFijados]);
  // Lo abierto se ve aunque no esté fijado (si no, el menú no diría dónde estás).
  const productosMenu = (productos ?? []).filter((p) => fijados.has(claveProducto(p)) || activoReal === `${p.producto}/${p.slug}`);
  const herramientasMenu = herramientas.filter((h) => fijados.has(claveHerramienta(h)) || activoReal === h.id);
  const hayMas = todas.length > 0;
  const [sobreElMenu, setSobreElMenu] = useState(false);
  const telefono = useConsultaMedia('(max-width: 63.99rem)');
  // Con segunda capa, siempre estrecha: desplegada solo en Comunicados (Fernando, 2026-11-08).
  const estrecho = capa ? true : (!telefono && !sobreElMenu && !abierto);
  // Al volver de Progreso, el contenido entra desde la izquierda (`nivelMenu`).
  const [movimiento] = useState(() => movimientoDelMenu('accesos'));

  useEffect(() => { cerrar(); }, [pathname, cerrar]);

  const fila = (id?: string) => `relative flex items-center gap-2.5 rounded-md h-9 w-full text-[13px] font-medium transition-colors ${id && id === activoReal ? (capa ? 'item-capa-activo text-digi-text' : 'bg-accent-light text-accent') : 'text-digi-muted hover:text-digi-text hover:bg-white/[0.06]'} ${estrecho ? 'justify-center px-0' : 'px-2.5'}`;

  const Grupo = ({ titulo, primero, children }: { titulo: string; primero?: boolean; children: ReactNode }) => (
    <div className={primero ? '' : 'mt-2'}>
      {/* Mismo alto en los dos estados: al desplegarse, lo que está bajo el puntero no se mueve. */}
      <div className="h-7 flex items-center">
        {estrecho
          ? (!primero ? <span className="h-px w-full bg-digi-border/60 mx-2" /> : null)
          : <p className="text-[10px] font-semibold uppercase tracking-wide text-digi-muted/70 px-2.5 truncate" style={mf}>{titulo}</p>}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );

  return (
    <>
      {/* Como primera capa, el velo lo pone la segunda (`DashboardSidebar`): uno solo. */}
      <div aria-hidden onClick={cerrar}
        className={`fixed inset-0 bg-black/40 z-40 lg:hidden ${capa ? 'hidden' : ''} transition-opacity duration-200 ease-out ${abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <div aria-hidden
        className={`hidden lg:block fixed inset-0 z-30 bg-black/45 pointer-events-none transition-opacity duration-200 ${sobreElMenu ? 'opacity-100' : 'opacity-0'}`} />

      <aside onMouseEnter={() => !capa && setSobreElMenu(true)} onMouseLeave={() => setSobreElMenu(false)}
        style={capa ? ({ '--tinte': tinteDe(activo) } as React.CSSProperties) : undefined}
        className={`rail ${capa ? 'capa-uno' : ''} fixed top-0 left-0 h-full pt-[var(--seguro-arriba)] pb-[var(--seguro-abajo)] ${abierto || (capa && sobreElMenu) ? 'z-[55]' : 'z-40'} bg-digi-card border-r border-digi-border flex flex-col transition-[width,translate] duration-200 ease-out
          ${estrecho ? 'w-16' : telefono ? 'w-64' : 'w-64 shadow-2xl'}
          ${abierto ? 'translate-x-0 shadow-xl' : '-translate-x-full lg:translate-x-0'}`}>
        <Link href="/dashboard/accesos" className={`flex items-center gap-2.5 h-14 border-b border-digi-border hover:bg-white/[0.05] transition-colors shrink-0 ${estrecho ? 'justify-center px-0' : 'px-4'}`}>
          <Image src="/logo-gcc.png" alt="" width={30} height={30} priority
            className="rounded-full select-none shrink-0 motion-reduce:animate-none" style={{ animation: 'slowSpin 12s linear infinite reverse' }} />
          {!estrecho && <span className="text-[14px] font-bold text-digi-text tracking-tight truncate" style={mf}>GCC WORLD</span>}
        </Link>

        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 ${movimiento}`} style={mf}>
          <Grupo titulo="Apps" primero>
            {apps.map((a) => (
              <button key={a.id} type="button" onClick={a.proximamente ? undefined : a.abrir} aria-disabled={a.proximamente || undefined}
                title={a.proximamente ? `${a.titulo} · Próximamente` : estrecho ? a.titulo : undefined}
                className={`${fila(a.id)} ${a.proximamente ? 'cursor-default opacity-60 hover:bg-transparent hover:text-digi-muted' : ''}`}>
                {/* El color del tema con que se abre cada app. */}
                <span className="w-6 h-6 shrink-0 rounded-md grid place-items-center border border-white/15"
                  style={{ background: definicionTema(a.tema)?.muestra.acento === '#fafafa' ? '#000' : definicionTema(a.tema)?.muestra.acento }}>
                  <a.Icono className="w-[14px] h-[14px] text-white" strokeWidth={2} />
                </span>
                {!estrecho && <span className="truncate">{a.titulo}</span>}
                {!estrecho && a.proximamente && <span className="ml-auto shrink-0 text-[11px] text-digi-muted">Próximamente</span>}
              </button>
            ))}
          </Grupo>

          {productosMenu.length > 0 && (
            <Grupo titulo="Productos">
              {productosMenu.map((p) => (
                <button key={p.url} type="button" onClick={() => abrirProducto(p)} title={estrecho ? p.productoNombre : undefined} className={fila(`${p.producto}/${p.slug}`)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconoDeProducto(p.producto)} alt="" width={24} height={24} decoding="async" className="w-6 h-6 shrink-0 rounded-md" />
                  {!estrecho && <span className="truncate">{p.productoNombre}</span>}
                </button>
              ))}
            </Grupo>
          )}

          {herramientasMenu.length > 0 && (
            <Grupo titulo="Herramientas">
              {herramientasMenu.map((h) => (
                <Link key={h.id} href={rutaHerramienta(h)} title={estrecho ? h.name : undefined} className={fila(h.id)}>
                  <span className="w-6 h-6 shrink-0 grid place-items-center"><h.Icon className="w-[18px] h-[18px]" strokeWidth={2} /></span>
                  {!estrecho && <span className="truncate">{h.name}</span>}
                </Link>
              ))}
            </Grupo>
          )}
          {/* «Todos»: el lanzador con buscador y estrellas para elegir qué queda en el menú. */}
          {hayMas && (
            <div className="mt-2 pt-2 border-t border-digi-border/60">
              <button type="button" onClick={() => { setLanzador(true); setSobreElMenu(false); }} title={estrecho ? 'Todos los productos y herramientas' : undefined}
                aria-label="Todos los productos y herramientas" className={fila(lanzador ? '__lanzador' : undefined)} style={mf}>
                <span className="w-6 h-6 shrink-0 grid place-items-center"><LayoutGrid className="w-[18px] h-[18px]" strokeWidth={2} /></span>
                {!estrecho && <span className="truncate">Todos</span>}
                {!estrecho && <span className="ml-auto text-[11px] text-digi-muted tabular-nums">{todas.length}</span>}
              </button>
            </div>
          )}
        </nav>

        <div className="shrink-0 p-2 border-t border-digi-border">
          {/* «VER», encima de la cuenta y solo para el administrador del grupo (Fernando, 2026-11-08/09). El mismo
              botón, mientras se mira como otra cuenta, es «Volver a mi vista» (antes no había cómo volver desde aquí). */}
          {suplantacion ? (
            <button type="button" onClick={volverAMiVista} disabled={volviendo} title="Volver a mi vista"
              aria-label="Volver a mi vista" className={`${fila()} mb-1 disabled:opacity-60`} style={{ ...mf, color: '#E9C07A', background: 'rgba(224, 176, 90, 0.16)' }}>
              <span className="w-6 h-6 shrink-0 grid place-items-center"><Undo2 className="w-[18px] h-[18px]" strokeWidth={2} /></span>
              {!estrecho && <span className="truncate">Volver a mi vista</span>}
            </button>
          ) : esAdmin && (
            <button type="button" onClick={() => setVerComoOtro(true)} title="Ver la plataforma como otro usuario"
              aria-label="Ver la plataforma como otro usuario" className={`${fila()} mb-1`} style={mf}>
              <span className="w-6 h-6 shrink-0 grid place-items-center"><Eye className="w-[18px] h-[18px]" strokeWidth={2} /></span>
              {!estrecho && <span className="truncate">Ver como otro usuario</span>}
            </button>
          )}
          {/* Configuración, encima de la cuenta (Fernando, 2026-11-10). */}
          <Link href="/dashboard/settings" title={estrecho ? 'Configuración' : undefined}
            className={`${fila('configuracion')} mb-2`} style={mf}>
            <span className="w-6 h-6 shrink-0 grid place-items-center"><Settings className="w-[18px] h-[18px]" strokeWidth={2} /></span>
            {!estrecho && <span className="truncate">Configuración</span>}
          </Link>
          {/* La cuenta, siempre en la primera capa (Fernando, 2026-11-08); la segunda ya no la repite. */}
          <FichaUsuario estrecho={estrecho} />
          <button onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión"
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium transition-[filter] duration-150 hover:brightness-125"
            style={{ ...mf, color: '#F0A6AE', background: 'rgba(224, 90, 106, 0.14)' }}>
            <LogOut className="w-4 h-4" />
            {!estrecho && <span>Salir</span>}
          </button>
        </div>
      </aside>
      <LanzadorAccesos abierto={lanzador} alCerrar={() => setLanzador(false)} productos={productos ?? []} herramientas={herramientas}
        rutaHerramienta={rutaHerramienta} abrirProducto={abrirProducto} fijados={fijados} alternar={alternar} activo={activoReal} />
      {esAdmin && <DialogoVerComoOtro abierto={verComoOtro} alCerrar={() => setVerComoOtro(false)} />}
    </>
  );
}
