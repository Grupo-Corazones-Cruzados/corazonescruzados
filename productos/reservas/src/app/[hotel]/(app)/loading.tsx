import { Cargando } from '@/componentes/ui';

/**
 * Lo que se ve MIENTRAS llega una pantalla del hotel. Sin esto, tocar un módulo no
 * cambiaba nada hasta que el servidor contestaba y el teléfono parecía colgado.
 */
export default function CargandoApp() {
  return <Cargando texto="Cargando…" />;
}
