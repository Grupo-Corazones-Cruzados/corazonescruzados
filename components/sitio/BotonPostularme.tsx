'use client';

/**
 * «POSTULARME» EN LA PÁGINA CANDIDATOS (Fernando, 2026-11-11): abre la misma ventana flotante de la
 * postulación (`OnboardingSlidersModal`: el camino de pasos, «Entendido» y Siguiente), que hasta
 * ahora solo se abría desde la portada. Envía con `enviarPostulacion`, la misma del formulario de la
 * página, y al terminar confirma que la postulación quedó en revisión.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Send } from 'lucide-react';
import OnboardingSlidersModal, { enviarPostulacion } from '@/components/landing/OnboardingSlidersModal';
import { AuthDialog, BotonAuth } from '@/components/landing/AuthSurface';

export default function BotonPostularme() {
  const [abierto, setAbierto] = useState(false);
  const [enviada, setEnviada] = useState<string | null>(null);

  return (
    <>
      <button type="button" className="postulacion-enviar" onClick={() => setAbierto(true)}>
        <Send aria-hidden />
        Postularme
      </button>

      {/* Al `body` con un portal: dentro del sitio, el contenedor de la página recortaba la ventana
          y sus estilos claros teñían la tabla del Modelo 4P. La ventana trae su isla `.corp dark`. */}
      {abierto && createPortal(
        <OnboardingSlidersModal
          onClose={() => setAbierto(false)}
          onComplete={async (postulacion) => {
            const error = await enviarPostulacion(postulacion);
            if (error) return error;
            setAbierto(false);
            setEnviada(postulacion.email);
            return null;
          }}
        />,
        document.body,
      )}

      {enviada && createPortal(
        <AuthDialog
          Icon={Send}
          titulo="Tu postulación está en revisión"
          onClose={() => setEnviada(null)}
          ancho="sm"
          pie={<BotonAuth onClick={() => setEnviada(null)}>Entendido</BotonAuth>}
        >
          <p className="text-[13.5px] leading-relaxed text-digi-text">
            Tu propuesta quedó registrada y está{' '}
            <strong className="font-semibold">en espera de aprobación</strong> por parte del
            administrador del proyecto. Te avisaremos a{' '}
            <strong className="font-semibold">{enviada}</strong> cuando sea aprobada.
          </p>
        </AuthDialog>,
        document.body,
      )}
    </>
  );
}
