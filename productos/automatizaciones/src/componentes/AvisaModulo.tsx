'use client';

import { useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';

/**
 * DENTRO DE GCC WORLD, EL PRODUCTO DICE EN QUÉ MÓDULO ESTÁ (Fernando, 2026-11-10: «selecciono un
 * contacto desde el dashboard y se mantiene seleccionado el módulo de dashboard»).
 *
 * El menú es de la plataforma (`MenuProducto`, segunda capa) y decide el resaltado por su `?m=`. Si
 * se cambia de módulo DENTRO del marco —un enlace del Panel a una conversación—, la plataforma no
 * se entera. Este aviso se lo cuenta con `postMessage`, solo al mismo origen (los productos se
 * sirven bajo app.grupocc.org/p/…), y la plataforma actualiza `?m=` sin recargar el marco.
 */
export function AvisaModulo() {
  const ruta = usePathname();
  const { cliente } = useParams<{ cliente: string }>();
  useEffect(() => {
    if (window.parent === window) return;
    // /<cliente>/<módulo>/… → <módulo>
    const partes = ruta.split('/').filter(Boolean);
    const i = partes.indexOf(cliente);
    const modulo = i >= 0 ? partes[i + 1] : null;
    if (!modulo) return;
    window.parent.postMessage({ tipo: 'gcc:producto:modulo', modulo }, window.location.origin);
  }, [ruta, cliente]);
  return null;
}
