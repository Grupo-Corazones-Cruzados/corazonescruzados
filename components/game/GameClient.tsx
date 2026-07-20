'use client';

import dynamic from 'next/dynamic';

/**
 * Envoltorio de cliente para cargar el juego.
 *
 * Existe por una razón concreta de Next 15: `ssr: false` **no está permitido en
 * Server Components**. Hace falta este componente `'use client'` intermedio.
 *
 * Además aísla el peso: Phaser (~347 KB comprimidos) solo se descarga al abrir
 * el juego, no en el resto de la app. Phaser no se puede adelgazar por
 * tree-shaking, así que separarlo por ruta es la única mitigación real.
 */
const PhaserGame = dynamic(() => import('./PhaserGame'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#0d0b14] text-sm text-white/60">
      Cargando el mundo…
    </div>
  ),
});

export default function GameClient({ sceneSlug }: { sceneSlug: string }) {
  return <PhaserGame sceneSlug={sceneSlug} />;
}
