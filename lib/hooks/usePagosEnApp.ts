'use client';

import { useEffect, useState } from 'react';
import { appDeTelefono } from '@/lib/sitio/appDeTelefono';

/**
 * ¿Se puede pagar con PayPhone aquí? En GCC Progreso, no: dentro de una app de tienda lo digital se
 * cobra con la compra de la tienda, que aún no está. Empieza en `true` por la web, que es lo común.
 * `middleware.ts` cierra además la ruta `/pagar` en esa app.
 */
export function usePagosEnApp(): boolean {
  const [si, setSi] = useState(true);
  useEffect(() => { setSi(appDeTelefono() !== 'progreso'); }, []);
  return si;
}
