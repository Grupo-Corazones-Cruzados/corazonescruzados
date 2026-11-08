'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useMenuMovil } from '@/components/dashboard/MenuMovil';
import FichaUsuario from '@/components/dashboard/FichaUsuario';
import { useConsultaMedia } from '@/lib/hooks/useConsultaMedia';
import { definicionTema } from '@/lib/temas';
import { iconoDeProducto, useAccesos } from './useAccesos';
import { movimientoDelMenu } from './nivelMenu';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * EL MENÚ DE ACCESOS (Fernando, 2026-11-08: «mover el header hacia un menú lateral izquierdo que al
 * poner el puntero encima se expanda, o con la hamburguesa en el móvil, con las secciones de Apps,
 * Productos y Herramientas»). Mismo comportamiento y aspecto que el de Progreso (`DashboardSidebar`):
 * raíl estrecho que se despliega encima del contenido al acercar el puntero; en el teléfono lo abre
 * el botón de `CabeceraMovil` y entra ya con su ancho. Arriba la marca; abajo, Salir: en las apps es
 * el único sitio desde el que se cierra sesión.
 */
export default function MenuAccesos() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { abierto, cerrar } = useMenuMovil();
  const { apps, productos, herramientas, rutaHerramienta, abrirProducto, entrandoAlJuego } = useAccesos();
  const [sobreElMenu, setSobreElMenu] = useState(false);
  const telefono = useConsultaMedia('(max-width: 63.99rem)');
  const estrecho = !telefono && !sobreElMenu && !abierto;
  // Al volver de Progreso, el contenido entra desde la izquierda (`nivelMenu`).
  const [movimiento] = useState(() => movimientoDelMenu('accesos'));

  useEffect(() => { cerrar(); }, [pathname, cerrar]);

  const fila = `relative flex items-center gap-2.5 rounded-md h-9 w-full text-[13px] font-medium transition-colors text-digi-muted hover:text-digi-text hover:bg-white/[0.06] ${estrecho ? 'justify-center px-0' : 'px-2.5'}`;

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
      <div aria-hidden onClick={cerrar}
        className={`fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity duration-200 ease-out ${abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <div aria-hidden
        className={`hidden lg:block fixed inset-0 z-30 bg-black/45 pointer-events-none transition-opacity duration-200 ${sobreElMenu ? 'opacity-100' : 'opacity-0'}`} />

      <aside onMouseEnter={() => setSobreElMenu(true)} onMouseLeave={() => setSobreElMenu(false)}
        className={`rail fixed top-0 left-0 h-full pt-[var(--seguro-arriba)] pb-[var(--seguro-abajo)] ${abierto ? 'z-50' : 'z-40'} bg-digi-card border-r border-digi-border flex flex-col transition-[width,translate] duration-200 ease-out
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
              <button key={a.id} type="button" onClick={a.abrir} title={estrecho ? a.titulo : undefined} className={fila}>
                {/* El color del tema con que se abre cada app. */}
                <span className="w-6 h-6 shrink-0 rounded-md grid place-items-center border border-white/15"
                  style={{ background: definicionTema(a.tema)?.muestra.acento === '#fafafa' ? '#000' : definicionTema(a.tema)?.muestra.acento }}>
                  <a.Icono className="w-[14px] h-[14px] text-white" strokeWidth={2} />
                </span>
                {!estrecho && <span className="truncate">{a.id === 'aventura' && entrandoAlJuego ? 'Entrando…' : a.titulo}</span>}
              </button>
            ))}
          </Grupo>

          {(productos?.length ?? 0) > 0 && (
            <Grupo titulo="Productos">
              {productos!.map((p) => (
                <button key={p.url} type="button" onClick={() => abrirProducto(p.url)} title={estrecho ? p.productoNombre : undefined} className={fila}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconoDeProducto(p.producto)} alt="" width={24} height={24} decoding="async" className="w-6 h-6 shrink-0 rounded-md" />
                  {!estrecho && <span className="truncate">{p.productoNombre}</span>}
                </button>
              ))}
            </Grupo>
          )}

          {herramientas.length > 0 && (
            <Grupo titulo="Herramientas">
              {herramientas.map((h) => (
                <Link key={h.id} href={rutaHerramienta(h)} title={estrecho ? h.name : undefined} className={fila}>
                  <span className="w-6 h-6 shrink-0 grid place-items-center"><h.Icon className="w-[18px] h-[18px]" strokeWidth={2} /></span>
                  {!estrecho && <span className="truncate">{h.name}</span>}
                </Link>
              ))}
            </Grupo>
          )}
        </nav>

        <div className="shrink-0 p-2 border-t border-digi-border">
          <FichaUsuario estrecho={estrecho} />
          <button onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión"
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium transition-[filter] duration-150 hover:brightness-125"
            style={{ ...mf, color: '#F0A6AE', background: 'rgba(224, 90, 106, 0.14)' }}>
            <LogOut className="w-4 h-4" />
            {!estrecho && <span>Salir</span>}
          </button>
        </div>
      </aside>
      {entrandoAlJuego && <div aria-hidden className="cambio-tema entra" style={{ background: '#000' }} />}
    </>
  );
}
