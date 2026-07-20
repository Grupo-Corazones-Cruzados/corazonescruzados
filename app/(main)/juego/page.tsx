import GameClient from '@/components/game/GameClient';

/**
 * Ruta de pruebas del motor nuevo (Phaser 4).
 *
 * Vive aparte a propósito: el juego actual sigue intacto en la landing hasta
 * que este alcance paridad de funciones. Así se puede comparar uno al lado del
 * otro sin romper nada de lo que ya funciona.
 *
 * `?scene=` permite abrir cualquier mapa para probarlo.
 */
export default async function JuegoPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  const { scene } = await searchParams;
  return (
    <main className="h-dvh w-full">
      <GameClient sceneSlug={scene || 'main'} />
    </main>
  );
}
