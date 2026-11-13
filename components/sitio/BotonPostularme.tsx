'use client';

/**
 * «POSTULARME» EN LA PÁGINA CANDIDATOS: abre EL LIBRO (Fernando, 2026-11-12: «la idea era que este sea el
 * nuevo formulario y no un libro aparte»), la postulación contada como un cuento, con su formulario en la
 * última página. La ventana de pasos de antes (`OnboardingSlidersModal`) queda en el código como respaldo.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Send } from 'lucide-react';
import LibroHistoria from '@/components/libro/LibroHistoria';
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
      {/* Al `body` con un portal: el libro ocupa la pantalla entera y trae su isla `.corp dark`. */}
      {abierto && createPortal(
        <LibroHistoria
          onClose={() => setAbierto(false)}
          onEnviada={(email) => {
            setAbierto(false);
            setEnviada(email);
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
