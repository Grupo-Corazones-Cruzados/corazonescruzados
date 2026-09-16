'use client';

import { FileDown } from 'lucide-react';
import { Boton } from '@/componentes/ui';

/**
 * Descargar un PDF generado en el servidor. No se imprime «la página»: se baja
 * un documento con su diseño (Fernando, 2026-09-15). Es un enlace con `download`,
 * como el Excel de reportes: sin JavaScript, sin ventana de impresión.
 */
export default function BotonPdf({ href, texto = 'Descargar PDF', deshabilitado }: { href: string; texto?: string; deshabilitado?: boolean }) {
  if (deshabilitado) return <Boton icono={FileDown} disabled title="No hay nada que descargar">{texto}</Boton>;
  return (
    <a href={href} download>
      <Boton icono={FileDown}>{texto}</Boton>
    </a>
  );
}
