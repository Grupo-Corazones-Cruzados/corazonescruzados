'use client';

import { Printer } from 'lucide-react';
import { Boton } from '@/componentes/ui';

/** Imprime la página actual. Los estilos `print:` deciden qué sale y qué no. */
export default function BotonImprimir({ texto = 'Imprimir' }: { texto?: string }) {
  return (
    <Boton icono={Printer} onClick={() => window.print()}>
      {texto}
    </Boton>
  );
}
