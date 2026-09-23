import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sin conexión', robots: { index: false, follow: false } };

/**
 * La pantalla de «sin conexión». La guarda el service worker en la instalación y la
 * responde cuando una navegación no llega a la red. Es estática a propósito: tiene que
 * poder pintarse sin servidor.
 */
export default function SinConexion() {
  return (
    <main className="corp min-h-screen flex items-center justify-center bg-digi-darker px-4">
      <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm max-w-sm w-full p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-black/[0.04] flex items-center justify-center mx-auto mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-6 h-6 text-digi-muted">
            <path d="M2 2l20 20M8.5 16.5a5 5 0 017 0M5 12.86a10 10 0 015.17-2.7M10.7 5.05A16 16 0 0122 8.8M1.4 8.8a16 16 0 013.6-2.4" />
            <circle cx="12" cy="20" r="1" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-[17px] font-semibold text-digi-text">Sin conexión</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-digi-muted">
          No se pudo alcanzar el servidor. Lo que ves en la aplicación son datos en vivo, así que
          no se guarda una copia: en cuanto vuelva la red, vuelve a intentarlo.
        </p>
      </div>
    </main>
  );
}
