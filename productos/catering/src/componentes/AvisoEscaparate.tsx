import { Eye } from 'lucide-react';

/**
 * Franja permanente del modo escaparate.
 *
 * Se dice ANTES de que alguien intente guardar, no después: un visitante que pulsa
 * «Guardar» y no ve nada concluye que la aplicación está rota, que es lo contrario
 * de lo que se le quiere enseñar.
 */
export function AvisoEscaparate() {
  return (
    <div className="flex items-center justify-center gap-2 bg-acento px-4 py-1.5 text-center text-[12px] font-semibold text-acento-contraste">
      <Eye className="h-4 w-4 shrink-0" />
      <span>
        Estás en una demostración: puedes recorrerlo todo y abrir cualquier formulario, pero los
        cambios no se guardan.
      </span>
    </div>
  );
}
