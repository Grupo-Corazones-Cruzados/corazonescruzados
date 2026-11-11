'use client';

/**
 * EL ALTA DE CLIENTE EN LA VENTANA DE PASOS (Fernando, 2026-11-11: «en la página de clientes tengamos
 * también el diseño del formulario así como una ventana flotante con este mismo diseño»).
 *
 * La MISMA ventana que la postulación de candidatos (`VentanaRecorrido`): los temas de Clientes
 * (Soluciones · Tickets · Proyectos, con sus textos de `TEMAS_CLIENTES`) se leen y se marcan
 * «Entendido», y el último paso es el alta (`FormularioCliente`, el mismo del diálogo de siempre).
 * Va al `body` con un portal: dentro del sitio, el contenedor de la página la recortaba.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus } from 'lucide-react';
import { TEMAS_CLIENTES } from '@/lib/sitio/contenido';
import { ICONOS, conNegritas } from './piezas';
import { VentanaRecorrido, type PasoVentana } from '@/components/landing/OnboardingSlidersModal';
import { FormularioCliente, CuentaClienteCreada } from '@/components/landing/ClientSignupModal';

/** Los temas de Clientes como pasos de la ventana: su texto, tal cual lo escribió Fernando. */
export const PASOS_CLIENTE: PasoVentana[] = TEMAS_CLIENTES.map((t) => {
  const texto = t.descripcion || t.texto || '';
  return {
    id: t.id,
    title: t.titulo,
    Icon: ICONOS[t.icono] ?? ICONOS.capas,
    Component: function PasoTemaCliente() {
      return <p className="text-[0.9375rem] leading-[1.65] text-digi-text m-0">{conNegritas(texto)}</p>;
    },
  };
});

export default function BotonCrearCuentaCliente() {
  const [abierta, setAbierta] = useState(false);
  const [creada, setCreada] = useState<string | null>(null);

  return (
    <>
      <button type="button" className="postulacion-enviar" onClick={() => setAbierta(true)}>
        <UserPlus aria-hidden />
        Crear mi cuenta
      </button>

      {abierta && createPortal(
        <VentanaRecorrido
          marca="Cuenta de cliente"
          ariaLabel="Conoce lo que ofrecemos y crea tu cuenta de cliente"
          pasos={PASOS_CLIENTE}
          textoUltimoPaso="Crear mi cuenta"
          onClose={() => setAbierta(false)}
          final={{
            label: 'Crear cuenta',
            Icon: UserPlus,
            titulo: 'Crea tu cuenta de cliente',
            contenido: (
              <FormularioCliente
                onCreada={(email) => { setAbierta(false); setCreada(email); }}
              />
            ),
          }}
        />,
        document.body,
      )}

      {creada && createPortal(
        <CuentaClienteCreada email={creada} onClose={() => setCreada(null)} />,
        document.body,
      )}
    </>
  );
}

/** El último paso de la página `/clientes`: el mismo alta, en claro, y su confirmación en el sitio. */
export function AltaClienteEnPagina() {
  const [creada, setCreada] = useState<string | null>(null);
  if (creada) {
    return (
      <div className="postulacion-aviso" role="status">
        <UserPlus aria-hidden />
        <div>
          <p className="postulacion-aviso-titulo">Confirma tu correo</p>
          <p className="m-0 text-[0.9375rem] leading-[1.65] text-digi-text">
            Te enviamos un enlace a <strong>{creada}</strong>. Ábrelo para activar tu cuenta y entrar a tu
            espacio de cliente. Si no lo ves en unos minutos, revisa la carpeta de correo no deseado.
          </p>
        </div>
      </div>
    );
  }
  return <FormularioCliente tema="claro" onCreada={setCreada} />;
}
