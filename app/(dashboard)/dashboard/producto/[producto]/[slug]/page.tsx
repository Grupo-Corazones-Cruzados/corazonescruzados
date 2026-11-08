'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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
  const entrado = useRef(false);
  const [src, setSrc] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!base) return;
    if (!entrado.current) {
      entrado.current = true;
      setSrc(`/api/productos/entrar?producto=${producto}&slug=${encodeURIComponent(slug)}&destino=${modulo}`);
    } else {
      setSrc(`${base}/${encodeURIComponent(slug)}/${modulo}`);
    }
  }, [base, producto, slug, modulo]);

  return (
    <div className="fixed inset-x-0 bottom-0 top-[calc(3.5rem+var(--seguro-arriba))] lg:top-0 lg:left-32 z-10 bg-digi-card pb-[var(--seguro-abajo)]">
      {src && <iframe src={src} title={producto} onLoad={() => setCargando(false)} allow="clipboard-write; publickey-credentials-get"
        className="w-full h-full border-0" />}
      {cargando && <div className="absolute inset-0 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>}
    </div>
  );
}
