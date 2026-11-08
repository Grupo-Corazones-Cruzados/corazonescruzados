'use client';

import { useAuth } from '@/components/providers/AuthProvider';

/**
 * EL SALUDO DE UNA PORTADA — definición única (extraído el 2026-11-08 del Inicio de Progreso para que
 * la portada de Centralizado diga lo mismo con el mismo estilo; Fernando: «aprende del dashboard de
 * Progreso»). El titular de Space Grotesk (`titulo-progreso`) y el nombre con el degradado de «cruzar
 * al mundo» (`acento-progreso`). Sin frase debajo: bajo el título no se escriben descripciones.
 */
export default function Saludo() {
  const { user } = useAuth();
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const nombre = user?.first_name || user?.email?.split('@')[0] || '';
  return (
    <h1 className="titulo-progreso text-[26px] sm:text-[34px] text-digi-text leading-[1.05] mb-4 sm:mb-5">
      {saludo}{nombre ? <>, <span className="acento-progreso">{nombre}</span></> : ''}
    </h1>
  );
}
