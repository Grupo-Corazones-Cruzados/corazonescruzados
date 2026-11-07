import type { ReactNode } from 'react';
import AgentePresupuestos from '@/components/sitio/AgentePresupuestos';

/** La página de Clientes y sus secciones: el agente está siempre a mano, como burbuja. */
export default function ClientesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AgentePresupuestos />
    </>
  );
}
