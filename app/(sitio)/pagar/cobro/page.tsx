'use client';

/**
 * CANAL 2 — el cliente CON sesión paga su propio proyecto o ticket.
 *
 * «un usuario de tipo cliente ingrese a su ticket o proyecto y realice el proceso de pago
 * directamente» (Fernando, 2026-08-25).
 *
 * Es la MISMA pantalla que el enlace del correo: cambia la llave, no lo que se ve. Aquí no
 * hay token — manda la sesión, y `autorizarCobro` comprueba que eso sea suyo antes de
 * decir cuánto cuesta.
 *
 * ⚠️ La ruta es `/pagar/cobro`, un segmento ESTÁTICO bajo `/pagar`. No puede ser
 * `/pagar/[tipo]/[id]`: Next no admite dos slugs distintos en el mismo nivel, y ese nivel
 * ya lo ocupa `[token]`. Next resuelve antes lo estático, así que las dos conviven.
 */
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Contenedor } from '@/components/sitio/piezas';
import PantallaPago from '@/components/pagos/PantallaPago';

function Contenido() {
  const sp = useSearchParams();
  const bruto = sp.get('tipo');
  const tipo: 'project' | 'ticket' | 'subscription' | 'product' =
    bruto === 'ticket' ? 'ticket'
    : bruto === 'subscription' ? 'subscription'
    : bruto === 'product' ? 'product'
    : 'project';
  const id = sp.get('id') || '';
  const etapa = sp.get('etapa');
  const periodo = sp.get('periodo') || '';

  const consulta =
    tipo === 'product' ? `producto_id=${encodeURIComponent(id)}`
    : tipo === 'subscription' ? `sub_id=${encodeURIComponent(id)}&periodo=${encodeURIComponent(periodo)}`
    : tipo === 'ticket' ? `ticket_id=${encodeURIComponent(id)}`
    : `project_id=${encodeURIComponent(id)}&stage_id=${encodeURIComponent(etapa || '')}`;

  return (
    <PantallaPago
      consulta={consulta}
      sourceType={tipo}
      sourceId={id}
      stageId={etapa ? Number(etapa) : null}
      periodo={periodo || undefined}
    />
  );
}

export default function PaginaPagarConSesion() {
  return (
    <Suspense fallback={<Contenedor className="py-24"><div className="h-64 rounded-xl bg-[var(--linea)]/60 animate-pulse" /></Contenedor>}>
      <Contenido />
    </Suspense>
  );
}
