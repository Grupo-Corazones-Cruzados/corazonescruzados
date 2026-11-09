'use client';

import { useEffect, useState } from 'react';

/**
 * Opciones de talento para los formularios, del catálogo ÚNICO (`gd_talentos`, vía
 * `/api/talentos`): lo que se ofrece es exactamente lo que la API acepta. Se pide una vez por
 * carga de página y se comparte entre los formularios que la usen.
 */
let enMemoria: Promise<string[]> | null = null;

function cargar(): Promise<string[]> {
  enMemoria ??= fetch('/api/talentos')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) => (Array.isArray(j?.data) ? j.data.map(String) : []))
    .catch((e) => { enMemoria = null; throw e; });
  return enMemoria;
}

export function useTalentosCatalogo(activo = true): { value: string; label: string }[] {
  const [opciones, setOpciones] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    cargar().then((lista) => { if (vivo) setOpciones(lista.map((t) => ({ value: t, label: t }))); }).catch(() => {});
    return () => { vivo = false; };
  }, [activo]);
  return opciones;
}
