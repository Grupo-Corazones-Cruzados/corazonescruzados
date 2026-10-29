'use client';

/**
 * ¿PUEDE ESTE EQUIPO CREAR UN REGISTRO AHORA? — una sola consulta para todas las pantallas que lo
 * necesitan (Fernando, 2026-10-29): las tarjetas de la portada, el formulario de alta de cliente
 * y el de postulación. Los formularios la miran AL ABRIRSE: si hay pausa de 24 h enseñan el aviso
 * en vez del formulario, lleguen por el botón o por un enlace. (El servidor lo vuelve a comprobar
 * al registrar: esto es la cara visible, no la cerradura.) Ver `lib/registro/limite.ts`.
 */

import { useEffect, useState } from 'react';

export interface EstadoRegistro {
  bloqueado: boolean;
  hasta: string | null;
}

export function useEstadoRegistro(): EstadoRegistro | null {
  const [estado, setEstado] = useState<EstadoRegistro | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/registro/estado', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (vivo) setEstado({ bloqueado: !!j?.bloqueado, hasta: j?.hasta ?? null }); })
      .catch(() => { if (vivo) setEstado({ bloqueado: false, hasta: null }); });
    return () => { vivo = false; };
  }, []);
  return estado;
}

/** «30 oct, 07:49» en hora de Ecuador. */
export function horaDeReanudacion(iso: string | null): string {
  if (!iso) return 'mañana';
  return new Date(iso).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
