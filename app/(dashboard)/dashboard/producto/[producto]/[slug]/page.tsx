'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PRODUCTOS } from '@/lib/productos/tipos';

/**
 * UN PRODUCTO DENTRO DE GCC WORLD (Fernando, 2026-11-08: «no deben llevar a la página de inicio de
 * sesión… sino mostrar el menú de cada producto como una capa adicional»). El producto se muestra en
 * un marco a la derecha de las dos capas de menú (Accesos y `MenuProducto`). La primera carga entra
 * con un pase de la plataforma (`/api/productos/entrar`), que abre la sesión en el producto; las
 * siguientes solo cambian de módulo dentro del producto.
 */
export default function PaginaProducto() {
  return <Suspense fallback={null}><Producto /></Suspense>;
}

function Producto() {
  const { producto = '', slug = '' } = useParams<{ producto: string; slug: string }>();
  const modulo = (useSearchParams().get('m') || 'panel').replace(/[^a-z0-9-]/g, '');
  const base = PRODUCTOS.find((p) => p.clave === producto)?.url;
  const router = useRouter();
  const entrado = useRef(false);
  const marco = useRef<HTMLIFrameElement>(null);
  /** El módulo al que llegó el marco por su cuenta: la plataforma lo refleja en `?m=` sin recargarlo. */
  const desdeElMarco = useRef<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  /**
   * EL PRODUCTO AVISA EN QUÉ MÓDULO ESTÁ (Fernando, 2026-11-10: al abrir un contacto desde el Panel
   * del producto, el menú seguía en «Panel»). Se navega dentro del marco sin que cambie `?m=`; el
   * producto lo cuenta por `postMessage` (`AvisaModulo`) y aquí se actualiza `?m=` para el menú.
   * Solo del propio marco y del mismo origen.
   */
  useEffect(() => {
    const alMensaje = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || ev.source !== marco.current?.contentWindow) return;
      const d = ev.data as { tipo?: string; modulo?: string };
      if (d?.tipo !== 'gcc:producto:modulo' || !d.modulo) return;
      const nuevo = d.modulo.replace(/[^a-z0-9-]/g, '');
      if (!nuevo || nuevo === modulo) return;
      desdeElMarco.current = nuevo;
      router.replace(`?m=${nuevo}`, { scroll: false });
    };
    window.addEventListener('message', alMensaje);
    return () => window.removeEventListener('message', alMensaje);
  }, [modulo, router]);

  useEffect(() => {
    if (!base) return;
    // El marco ya está en ese módulo (lo avisó él): no se recarga ni se pierde lo que tenía abierto.
    if (desdeElMarco.current === modulo) { desdeElMarco.current = null; return; }
    if (!entrado.current) {
      entrado.current = true;
      setSrc(`/api/productos/entrar?producto=${producto}&slug=${encodeURIComponent(slug)}&destino=${modulo}`);
    } else {
      setSrc(`${base}/${encodeURIComponent(slug)}/${modulo}`);
    }
  }, [base, producto, slug, modulo]);

  return (
    <div className="fixed inset-x-0 bottom-[var(--pie-panel)] top-[calc(3.5rem+var(--seguro-arriba))] lg:top-0 lg:left-32 z-10 bg-digi-card">
      {src && <iframe ref={marco} src={src} title={producto} onLoad={() => setCargando(false)} allow="clipboard-write; publickey-credentials-get"
        className="w-full h-full border-0" />}
      {cargando && <div className="absolute inset-0 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>}
    </div>
  );
}
