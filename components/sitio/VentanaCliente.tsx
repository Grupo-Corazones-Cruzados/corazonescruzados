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

/**
 * Los tres temas de Clientes en UN SOLO paso (Fernando, 2026-11-11: «elimina que sean diferentes pasos
 * y solo muestra lo que se da para los 3 puntos en uno solo»): cada uno con su icono, su nombre y su
 * texto de `TEMAS_CLIENTES`, tal cual. Después, el alta.
 */
export const PASOS_CLIENTE: PasoVentana[] = [{
  id: 'propuestas',
  title: 'Soluciones, Tickets y Proyectos',
  Icon: ICONOS.capas,
  Component: function PasoPropuestas() {
    return (
      <div className="flex flex-col gap-6">
        {TEMAS_CLIENTES.map((t) => {
          const Icono = ICONOS[t.icono] ?? ICONOS.capas;
          const texto = t.descripcion || t.texto || '';
          return (
            <section key={t.id} className="flex flex-col gap-2">
              <h3 className="m-0 flex items-center gap-2 text-[1rem] font-semibold text-digi-text">
                <Icono className="h-4 w-4 text-accent" aria-hidden />
                {t.titulo}
              </h3>
              <p className="m-0 text-[0.9375rem] leading-[1.65] text-digi-text">{conNegritas(texto)}</p>
            </section>
          );
        })}
      </div>
    );
  },
}];

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

