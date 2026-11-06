import EspacioEnApp from '@/components/espacio/EspacioEnApp';

export const metadata = { robots: { index: false, follow: false } };

export default function PaginaGumdramonEnApp() {
  return <EspacioEnApp ruta="/gumdramon" titulo="Gumdramon" />;
}
