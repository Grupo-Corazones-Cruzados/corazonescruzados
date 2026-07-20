import Phaser from 'phaser';
import { WorldScene, type WorldSceneInit } from './WorldScene';

/**
 * Arranque del juego. Se importa de forma dinámica desde el cliente para que
 * Phaser nunca entre en el bundle del servidor ni en el resto de la app: solo
 * se descarga al abrir el juego.
 */
export function createGame(parent: HTMLElement, init: WorldSceneInit): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0d0b14',
    // El arte es pixelado: sin esto el escalado lo emborrona.
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        // Ponlo a true para ver las cajas de colisión al depurar.
        debug: false,
      },
    },
    scene: [WorldScene],
  });

  game.scene.start(WorldScene.KEY, init);
  return game;
}

export { WorldScene };
export type { WorldSceneInit };
