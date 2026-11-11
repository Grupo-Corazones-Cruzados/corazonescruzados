'use client';

/**
 * LOS APARTADOS DEL FORMULARIO DE POSTULACIÓN, COMO UN RECORRIDO — la página Candidatos (Fernando,
 * 2026-11-01: «lo mismo que tiene el formulario de postulación pero en orden para ir revisando todo
 * el contenido desde esta página»). El recorrido es `RecorridoPagina`, el mismo que Clientes.
 *
 * El contenido es **el mismo componente** que pinta el formulario (`SLIDES` de
 * `OnboardingSlidersModal`): cambiar un texto allí lo cambia aquí. El último paso es el formulario
 * de postulación (`PostulacionEnPagina`), con la misma pausa por equipo que tenía en la portada.
 */

import { Send } from 'lucide-react';
import { SLIDES, PostulacionEnPagina } from '@/components/landing/OnboardingSlidersModal';
import { tituloDePaso } from '@/lib/sitio/pasosPostulacion';
import RecorridoPagina from './RecorridoPagina';

const PASOS = [
  ...SLIDES,
  { id: 'postulacion' as const, title: tituloDePaso('postulacion'), Icon: Send, Component: PostulacionEnPagina },
].map(({ id, title, Icon, Component }) => ({
  id,
  title,
  icono: <Icon className="h-4 w-4" />,
  contenido: <div className="paso-candidato"><Component /></div>,
}));

export default function TemasCandidatos({ inicial }: { inicial: string }) {
  return <RecorridoPagina pasos={PASOS} inicial={inicial} base="/candidatos" etiqueta="Apartados de la postulación" />;
}
