import GodotGame from '@/components/game/GodotGame';

/**
 * El juego, a pantalla completa.
 *
 * Fuera del layout `(main)` a propósito: un juego no lleva el sidebar de la app
 * encima. `fixed inset-0` evita heredar padding o scroll del body.
 *
 * No hace falta importarlo de forma dinámica: el componente es pequeño y lo
 * pesado (el motor, ~10 MB) se descarga en tiempo de ejecución desde
 * `public/game/`, no forma parte del bundle de JavaScript.
 *
 * A esta ruta se llega desde el botón "Entrar" de la landing, tras validar al
 * usuario y hacer la transición a negro (NIVEL APP). Aquí empieza el NIVEL
 * MOTOR (Godot).
 */
export default function JuegoPage() {
  return (
    <main className="fixed inset-0 overflow-hidden">
      <GodotGame />
    </main>
  );
}
