'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Aviso } from '@/components/ui/Aviso';
import type { EstadoRuc } from '@/lib/facturacion/ruc-obligatorio';

/**
 * El aviso de Tickets, Proyectos y Suscripciones para el miembro o candidato SIN RUC habilitado. Antes del
 * 2026-12-01 avisa de lo que viene; desde ese día dice que no puede crear, tomar ni proponerse. Ver
 * `lib/facturacion/ruc-obligatorio.ts`. A quien ya lo tiene (o no lo necesita) no le aparece nada.
 */
export default function AvisoRucPendiente() {
  const [e, setE] = useState<EstadoRuc | null>(null);
  useEffect(() => { fetch('/api/facturacion/ruc').then((r) => (r.ok ? r.json() : null)).then(setE).catch(() => {}); }, []);
  if (!e || !e.requerido || e.tiene) return null;
  const fecha = new Date(e.desde).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guayaquil' });
  const enlace = <Link href="/dashboard/settings?tab=facturacion" className="text-accent underline">Configuración ▸ Facturación</Link>;
  return (
    <div className="mb-4">
      <Aviso tono={e.bloquea ? 'peligro' : 'info'} titulo="RUC pendiente">
        {e.bloquea
          ? <>Para crear, tomar o proponerte en tickets, proyectos y suscripciones necesitas tu RUC habilitado, ya que las facturas salen a tu nombre. Regístralo en {enlace}.</>
          : <>Desde el {fecha} vas a necesitar tu RUC habilitado para crear, tomar o proponerte en tickets, proyectos y suscripciones, ya que las facturas salen a tu nombre. Regístralo en {enlace}.</>}
      </Aviso>
    </div>
  );
}
