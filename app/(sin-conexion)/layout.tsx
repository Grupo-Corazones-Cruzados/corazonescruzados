/**
 * Pantallas que funcionan SIN CONEXIÓN (2026-10-07). Van fuera del layout del panel a
 * propósito: aquel arranca comprobando la sesión con el servidor y montando el menú, los
 * chats y los avisos, que sin red no cargan. Aquí solo hay lo que la pantalla necesita, y la
 * guarda el service worker (`public/sw.js`) para abrirla sin red.
 */
export default function LayoutSinConexion({ children }: { children: React.ReactNode }) {
  return <div className="corp min-h-screen bg-digi-darker">{children}</div>;
}
