import { CircleUserRound } from 'lucide-react';

/**
 * ¿Tiene cuenta en GCC World? Va a la izquierda del nombre en los selectores de cliente y de
 * miembro: en color si la tiene, gris tenue si no. Una sola definición para que el mismo dato
 * no se pinte de dos maneras (antes `ClientPicker` usaba un `BadgeCheck` verde a la derecha).
 */
export default function IconoCuenta({ conCuenta }: { conCuenta: boolean }) {
  return (
    <CircleUserRound className={`w-4 h-4 ${conCuenta ? 'text-accent' : 'text-digi-muted/50'}`}
      aria-label={conCuenta ? 'Tiene cuenta en GCC World' : 'Sin cuenta en GCC World'} />
  );
}
