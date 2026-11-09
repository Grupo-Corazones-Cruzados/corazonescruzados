import EspacioEnApp from '@/components/espacio/EspacioEnApp';

export const metadata = { robots: { index: false, follow: false } };

/** El Cortador de sprites en las apps: un marco con lo que sirve la Mac por la red privada. */
export default function PaginaSpritesEnApp() {
  return <EspacioEnApp ruta="/sprites" titulo="Cortador de sprites" />;
}
