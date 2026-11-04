'use client';

import { useState } from 'react';
import EspacioEmbebido from '@/components/espacio/EspacioEmbebido';
import { guardarToken, tokenGuardado } from '@/components/espacio/api';
import { SistemaLocal } from '@/components/centralized/systems/GeneracionDeContenidoSystem';

/**
 * Safari no da cookies a un marco de otro dominio, así que la sesión viaja en una cabecera. El sistema
 * y sus selectores hacen decenas de `fetch`: aquí se añade a todos los de esta misma página, y solo
 * en esta página. Si caduca, se vuelve a pedir la contraseña en lugar de mostrar listas vacías.
 */
function firmarPeticiones() {
  const original = window.fetch.bind(window);
  window.fetch = async (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const interna = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
    const token = tokenGuardado();
    if (!interna || !token) return original(entrada, init);
    const headers = new Headers(init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined));
    headers.set('x-espacio-token', token);
    const r = await original(entrada, { ...init, headers });
    if (r.status === 401) { guardarToken(null); window.dispatchEvent(new Event('espacio-sin-sesion')); }
    return r;
  };
}

export default function ContenidoEmbebido() {
  useState(() => { if (typeof window !== 'undefined') firmarPeticiones(); });
  return (
    <EspacioEmbebido titulo="Generación de Contenido">
      <div className="h-full overflow-y-auto p-3 xl:p-4">
        <SistemaLocal enMarco />
      </div>
    </EspacioEmbebido>
  );
}
