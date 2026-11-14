import LogoGirando from '@/components/ui/LogoGirando';
import { FONDO_AUTH } from '@/components/landing/authEstilos';

/**
 * MARCO DE LAS PÁGINAS DE ACCESO QUE LLEGAN POR CORREO — confirmar el correo y restablecer la
 * contraseña (Fernando, 2026-11-04: «al estilo aplicado en el formulario de inicio de sesión»).
 *
 * Es el diálogo de acceso de la portada (`ClientLoginModal`) sin la portada detrás: `corp dark`,
 * el logo girando con «GCC WORLD» encima y un panel de 440 px. Las piezas de estilo son las de
 * `components/landing/authEstilos.ts`, las mismas del diálogo: equivalente no es igual.
 * Antes era la piel pixel antigua (estrellas, esquinas, letra Silkscreen, «OK»/«ERR»).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="corp dark min-h-dvh flex items-center justify-center px-4 py-12" style={FONDO_AUTH}>
      {/* Un formulario largo (el alta del candidato, `.alta-ancha`) ensancha el marco; el resto, 440 px. */}
      <div className="w-full max-w-[440px] has-[.alta-ancha]:max-w-[860px] flex flex-col items-center gap-[18px]">
        <div className="flex flex-col items-center gap-2">
          <LogoGirando tamano={40} />
          <span className="text-[0.72rem] tracking-[0.2em] text-white" style={{ fontFamily: 'var(--font-body)' }}>GCC WORLD</span>
        </div>
        {children}
      </div>
    </div>
  );
}
