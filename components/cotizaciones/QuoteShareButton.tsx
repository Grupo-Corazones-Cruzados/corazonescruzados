'use client';

import PanelCompartirEnlace from '@/components/ui/PanelCompartirEnlace';

const DURATIONS = [
  { v: 24, l: '1 día' }, { v: 168, l: '1 semana' }, { v: 720, l: '1 mes' }, { v: 2160, l: '3 meses' },
];

/**
 * Modal para compartir la cotización con el cliente externo por token con expiración
 * (enlace de solo lectura + agente + aceptar/rechazar). Puede enviarlo por correo o copiar el link.
 * Controlado: se abre desde el botón "Compartir acceso" del header.
 *
 * El formulario es `PanelCompartirEnlace`, el mismo del enlace de pago.
 */
export default function QuoteShareButton({ projectId, open, onClose }: { projectId: number | string; open: boolean; onClose: () => void }) {
  return (
    <PanelCompartirEnlace
      open={open} onClose={onClose}
      title="Compartir acceso a la cotización"
      intro={<>Genera un enlace de <strong>solo lectura</strong> para el cliente: verá la cotización, podrá <strong>aceptar/rechazar</strong> y pedir cambios al asistente GCC Bot.</>}
      duraciones={DURATIONS} duracionInicial={168}
      generar={async ({ horas, email, enviar }) => {
        const r = await fetch(`/api/quotes/${projectId}/share`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationHours: horas, email: enviar ? email : undefined }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Error');
        return { url: d.data.url, mensaje: d.data.emailed ? 'Cotización enviada al cliente por correo' : 'Enlace generado' };
      }}
    />
  );
}
