import { AlertTriangle, Info } from 'lucide-react';

/**
 * AVISO SIN CAJA (Fernando, 2026-11-11): un rótulo con icono en el color del aviso y el texto debajo, en el color del
 * párrafo. Nada de fondo de color ni borde alrededor. Estilos: `.aviso-gcc` en globals.css. Una sola pieza para la
 * postulación, los diálogos de acceso y el panel.
 */
export function Aviso({ tono, titulo, children }: { tono: 'peligro' | 'info'; titulo: string; children: React.ReactNode }) {
  const Icono = tono === 'peligro' ? AlertTriangle : Info;
  return (
    <div role="note" className="aviso-gcc" data-tono={tono}>
      <p className="aviso-gcc-titulo"><Icono aria-hidden />{titulo}</p>
      <p className="aviso-gcc-texto">{children}</p>
    </div>
  );
}
