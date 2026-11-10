'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Selector } from '@/componentes/ui';
import type { NumeroOpcion } from '@/lib/agente/numeros';

/**
 * Elegir el número sobre el que se trabaja (Estudio, Envíos), cuando el inquilino tiene más de
 * uno (2026-11-10). Va en `?numero=`, así que se comparte el enlace y sobrevive a recargar. Con
 * un solo número no se pinta.
 */
export function SelectorNumero({ numeros, actual }: { numeros: NumeroOpcion[]; actual: number | null }) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  if (numeros.length < 2) return null;
  return (
    <Selector
      aria-label="Número"
      value={actual ?? ''}
      className="w-auto max-w-[280px]"
      onChange={(e) => {
        const q = new URLSearchParams(params.toString());
        q.set('numero', e.target.value);
        router.replace(`${ruta}?${q.toString()}`, { scroll: false });
      }}
    >
      {numeros.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
    </Selector>
  );
}
