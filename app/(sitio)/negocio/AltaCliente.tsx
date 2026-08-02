'use client';

/**
 * ALTA DE CLIENTE — la única isla interactiva de la página de negocio.
 *
 * La página es Server Component a propósito: tiene que estar en el HTML crudo para que la
 * lean un buscador y un revisor de Meta sin ejecutar JavaScript. Todo lo que necesita
 * estado vive aquí.
 *
 * Reutiliza `ClientSignupModal`, el mismo formulario de la portada. Es la definición única
 * del alta de cliente y no se duplica por cambiar de página: si mañana cambia lo que se
 * pide, cambia en los dos sitios a la vez.
 */

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import ClientSignupModal from '@/components/landing/ClientSignupModal';

export default function AltaCliente() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-lg
                     bg-[#7B5FBF] hover:bg-[#6b4faf] text-white text-[15.5px] font-medium transition-colors"
        >
          Crear cuenta de cliente <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-[13px] text-white/35">
          ¿Ya tienes cuenta?{' '}
          <a href="/" className="text-white/60 hover:text-white underline transition-colors">
            Inicia sesión
          </a>
        </p>
      </div>

      {abierto && (
        <ClientSignupModal
          onClose={() => setAbierto(false)}
          // El acceso vive en la portada; aquí no se duplica un segundo formulario para
          // algo que se usa una vez.
          onLogin={() => { window.location.href = '/'; }}
        />
      )}
    </>
  );
}
