'use client';

/**
 * ALTA DE CLIENTE desde la página de negocio.
 *
 * La página de negocio es un Server Component a propósito —tiene que estar en el HTML
 * crudo para que la lea un revisor sin JavaScript—, así que la parte interactiva vive
 * aquí, en una isla de cliente.
 *
 * Reutiliza `ClientSignupModal`, el mismo formulario que la portada: es la definición
 * única del alta de cliente y no se duplica solo por cambiar de página. Si mañana cambia
 * lo que se pide en el alta, cambia en los dos sitios a la vez.
 *
 * Para iniciar sesión se manda a la portada, donde vive el diálogo de acceso. No se
 * duplica aquí un segundo formulario para algo que se usa una vez.
 */

import { useState } from 'react';
import ClientSignupModal from '@/components/landing/ClientSignupModal';
import { link } from '../legal/estilos';

export default function AltaCliente() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <div
        style={{
          border: '1px solid rgba(123,95,191,0.35)',
          background: 'rgba(123,95,191,0.08)',
          borderRadius: 10,
          padding: '20px 22px',
          margin: '28px 0 8px',
        }}
      >
        <p style={{ margin: 0, color: '#f1eefb', fontSize: '1.02rem', fontWeight: 600 }}>
          ¿Quieres trabajar con nosotros?
        </p>
        <p style={{ margin: '6px 0 0', color: '#9b95b3', lineHeight: 1.65 }}>
          Crea una cuenta de cliente y tendrás acceso a tu espacio: <strong style={{ color: '#d9d4ea' }}>
          pedir una cotización</strong> y ver su alcance y su precio, el estado de tus proyectos,
          tus tickets de soporte y tus facturas.
        </p>
        <p style={{ margin: '6px 0 0', color: '#9b95b3', lineHeight: 1.65 }}>
          Abrir la cuenta <strong style={{ color: '#d9d4ea' }}>no cuesta nada y no compromete a
          nada</strong>: el precio sale después, cotizado según lo que necesites.
        </p>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          style={{
            marginTop: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 6,
            border: 'none',
            background: '#7B5FBF',
            color: '#fff',
            fontSize: '0.92rem',
            fontWeight: 600,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            cursor: 'pointer',
          }}
        >
          Crear cuenta de cliente
        </button>
        <p style={{ margin: '10px 0 0', color: '#9b95b3', fontSize: '0.82rem' }}>
          ¿Ya tienes cuenta?{' '}
          <a href="/" style={link}>
            Inicia sesión
          </a>
          .
        </p>
      </div>

      {abierto && (
        <ClientSignupModal
          onClose={() => setAbierto(false)}
          // El acceso vive en la portada; aquí no se duplica un segundo formulario.
          onLogin={() => { window.location.href = '/'; }}
        />
      )}
    </>
  );
}
