import { exigirSesionDelCliente } from '@/lib/inquilino';
import { vistaSuscripcion } from '@/lib/vistaSuscripcion';
import { AplicaMarca } from '@/componentes/Marca';
import PanelSuscripcion from '@/componentes/PanelSuscripcion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suscripción' };

/**
 * LA PANTALLA DEL IMPAGO.
 *
 * Vive FUERA del grupo `(app)` a propósito, y esa es toda su razón de ser: es la única que
 * se puede ver **sin tener la mensualidad al día**. Si estuviera dentro —o si el bloqueo
 * mandara a Configuración, que exige acceso y ser administrador— un cliente bloqueado
 * rebotaría entre dos pantallas sin llegar nunca a la que le deja arreglarlo.
 *
 * Lo que pinta es el MISMO panel de `Configuración → Suscripción`, con los mismos datos:
 * lo que cambia entre las dos pantallas es quién puede llegar, no lo que dicen.
 */
export default async function PaginaSuscripcion({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const ctx = await exigirSesionDelCliente(cliente);

  return (
    <AplicaMarca colorAcento={ctx.inquilino.colorAcento} tema={ctx.inquilino.tema}>
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-1 text-[19px] font-semibold text-texto sm:text-[22px]">Suscripción</h1>
        <p className="mb-5 text-[13px] text-tenue">{ctx.inquilino.nombre}</p>
        <PanelSuscripcion slug={cliente} s={vistaSuscripcion(ctx)} volverAlPanel />
      </div>
    </AplicaMarca>
  );
}
