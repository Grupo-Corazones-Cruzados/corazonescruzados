'use client';

/**
 * Creador de personaje (el de verdad, el de la portada).
 *
 * Sustituye al creador viejo, que componía con una librería descargada (LPC) y
 * por eso el personaje no se parecía al del prólogo. Ahora usa el catálogo
 * propio: piezas generadas con el mismo modelo que las estampas y compuestas con
 * `lib/game/componer.js` — el MISMO módulo que usa el servidor para generar la
 * hoja que consume Godot. Una sola verdad para las dos partes.
 *
 * Lo que el jugador elige va a parar a un objeto pequeño (qué peinado, qué
 * prenda, qué color…), no a una imagen: pesa nada, se puede volver a componer
 * cuando cambie el catálogo y permite editar el personaje más adelante.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { componer, CELDA, VISTAS, POR_DEFECTO } from '@/lib/game/componer.js';
import { RAMPA_PELO, RAMPA_PIEL } from '@/lib/game/recolor.js';
import { OJOS, BOCAS, COLOR_OJOS } from '@/lib/game/sellos.js';
import { COMPLEXIONES } from '@/lib/game/complexion.js';

type Pieza = { id: string; nombre: string; ruta: string | null };
type Catalogo = {
  sexos: Record<string, { base: string; peinado: Pieza[]; accesorio: Pieza[]; arriba: Pieza[]; abajo: Pieza[] }>;
};
export type EleccionPersonaje = typeof POR_DEFECTO & { nombre?: string };

const VISTA_NOMBRES = ['Frente', 'Espalda', 'Izquierda', 'Derecha'];
const bonito = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Carga una imagen y devuelve sus píxeles en crudo, listos para componer. */
function usarPixeles() {
  const cache = useRef(new Map<string, Uint8ClampedArray>());
  return useCallback(async (ruta: string | null): Promise<Uint8ClampedArray | null> => {
    if (!ruta) return null;
    const guardado = cache.current.get(ruta);
    if (guardado) return guardado;
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error(`No se pudo cargar ${ruta}`));
      i.src = ruta;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, img.width, img.height).data;
    cache.current.set(ruta, px);
    return px;
  }, []);
}

export default function CreadorPersonaje({
  onConfirm,
}: {
  onConfirm: (eleccion: EleccionPersonaje) => void;
}) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [e, setE] = useState<EleccionPersonaje>({ ...POR_DEFECTO });
  const [nombre, setNombre] = useState('');
  const lienzos = useRef<(HTMLCanvasElement | null)[]>([]);
  const pixeles = usarPixeles();

  useEffect(() => {
    fetch('/personajes/catalogo.json')
      .then((r) => r.json())
      .then(setCatalogo)
      .catch(() => setCatalogo(null));
  }, []);

  const sexo = catalogo?.sexos?.[e.sexo];

  // Al cambiar de sexo, las piezas del otro no existen: se vuelve a lo básico.
  const cambiarSexo = (s: string) =>
    setE((v) => ({ ...v, sexo: s, peinado: 'base', accesorio: 'ninguno', arriba: 'base', abajo: 'base' }));

  const ruta = useCallback(
    (lista: Pieza[] | undefined, id: string) => lista?.find((p) => p.id === id)?.ruta ?? sexo?.base ?? null,
    [sexo],
  );

  useEffect(() => {
    if (!sexo) return;
    let cancelado = false;
    (async () => {
      const piezas = {
        cabeza: await pixeles(ruta(sexo.peinado, e.peinado)),
        arriba: await pixeles(ruta(sexo.arriba, e.arriba)),
        abajo: await pixeles(ruta(sexo.abajo, e.abajo)),
        accesorio: await pixeles(sexo.accesorio.find((p) => p.id === e.accesorio)?.ruta ?? null),
      };
      if (cancelado || !piezas.cabeza || !piezas.arriba || !piezas.abajo) return;
      const hoja = componer(piezas, e);
      for (let v = 0; v < VISTAS; v++) {
        const c = lienzos.current[v];
        if (!c) continue;
        const g = c.getContext('2d')!;
        const img = g.createImageData(CELDA.ancho, CELDA.alto);
        for (let y = 0; y < CELDA.alto; y++) {
          const desde = (y * CELDA.ancho * VISTAS + v * CELDA.ancho) * 4;
          img.data.set(hoja.subarray(desde, desde + CELDA.ancho * 4), y * CELDA.ancho * 4);
        }
        g.putImageData(img, 0, 0);
      }
    })();
    return () => { cancelado = true; };
  }, [sexo, e, pixeles, ruta]);

  const grupos = useMemo(() => {
    if (!sexo) return [];
    return [
      { titulo: 'Peinado', clave: 'peinado' as const, opciones: sexo.peinado },
      { titulo: 'Accesorio', clave: 'accesorio' as const, opciones: sexo.accesorio },
      { titulo: 'Ropa de arriba', clave: 'arriba' as const, opciones: sexo.arriba },
      { titulo: 'Ropa de abajo', clave: 'abajo' as const, opciones: sexo.abajo },
    ];
  }, [sexo]);

  const listas = [
    { titulo: 'Complexión', clave: 'complexion' as const, ids: Object.keys(COMPLEXIONES) },
    { titulo: 'Color de pelo', clave: 'pelo' as const, ids: Object.keys(RAMPA_PELO) },
    { titulo: 'Tono de piel', clave: 'piel' as const, ids: Object.keys(RAMPA_PIEL) },
    { titulo: 'Ojos', clave: 'ojos' as const, ids: Object.keys(OJOS) },
    { titulo: 'Color de ojos', clave: 'colorOjos' as const, ids: Object.keys(COLOR_OJOS) },
    { titulo: 'Boca', clave: 'boca' as const, ids: Object.keys(BOCAS) },
  ];

  if (!catalogo || !sexo) {
    return (
      <div className="fixed inset-0 z-[9000] grid place-items-center" style={{ background: 'var(--color-void)' }}>
        <p className="pixel-heading text-[11px] text-accent-glow">Preparando el creador…</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9000] overflow-y-auto"
      style={{ background: 'var(--color-void)', fontFamily: 'var(--font-body)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Crea tu personaje"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-7 px-5 py-10">
        <header className="flex flex-col gap-2 text-center">
          <p className="pixel-heading text-[10px] uppercase tracking-[0.22em] text-accent-glow">GCC World</p>
          <h1 className="pixel-heading pixel-glow text-[17px] text-white">Crea tu personaje</h1>
          <p className="text-[12.5px] text-white/45">Tiene 17 años. Todo lo demás lo decides tú.</p>
        </header>

        {/* Las cuatro vistas, como se verá en el juego */}
        <div className="grid grid-cols-2 gap-px border border-accent-dark bg-accent-dark sm:grid-cols-4">
          {VISTA_NOMBRES.map((v, i) => (
            <figure key={v} className="m-0 flex flex-col items-center gap-1 py-4" style={{ background: 'var(--color-void)' }}>
              <canvas
                ref={(el) => { lienzos.current[i] = el; }}
                width={CELDA.ancho}
                height={CELDA.alto}
                className="block"
                style={{ imageRendering: 'pixelated', width: 120, height: 160 }}
              />
              <figcaption className="pixel-heading text-[8px] uppercase tracking-[0.14em] text-white/35">{v}</figcaption>
            </figure>
          ))}
        </div>

        <Grupo titulo="Quién eres">
          {['mujer', 'hombre'].map((s) => (
            <Opcion key={s} activo={e.sexo === s} onClick={() => cambiarSexo(s)}>
              {s === 'mujer' ? 'Chica' : 'Chico'}
            </Opcion>
          ))}
        </Grupo>

        {grupos.map((g) => (
          <Grupo key={g.clave} titulo={g.titulo}>
            {g.opciones.map((p) => (
              <Opcion key={p.id} activo={e[g.clave] === p.id} onClick={() => setE((v) => ({ ...v, [g.clave]: p.id }))}>
                {p.nombre}
              </Opcion>
            ))}
          </Grupo>
        ))}

        {listas.map((l) => (
          <Grupo key={l.clave} titulo={l.titulo}>
            {l.ids.map((id) => (
              <Opcion key={id} activo={e[l.clave] === id} onClick={() => setE((v) => ({ ...v, [l.clave]: id }))}>
                {bonito(id)}
              </Opcion>
            ))}
          </Grupo>
        ))}

        <Grupo titulo="Tu nombre">
          <input
            value={nombre}
            onChange={(ev) => setNombre(ev.target.value.slice(0, 18))}
            placeholder="¿Cómo te llamas?"
            className="w-full max-w-xs border-2 border-accent bg-black/40 px-3 py-2 text-[12px] text-white outline-none focus:border-accent-glow"
            style={{ fontFamily: 'var(--font-display)' }}
          />
        </Grupo>

        <div className="flex justify-center pb-4 pt-2">
          <button
            type="button"
            className="pixel-btn pixel-btn-primary"
            disabled={!nombre.trim()}
            style={!nombre.trim() ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            onClick={() => onConfirm({ ...e, nombre: nombre.trim() })}
          >
            Entrar al mundo
          </button>
        </div>
      </div>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="pixel-heading text-[10px] uppercase tracking-[0.14em] text-accent-glow">{titulo}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Opcion({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="border-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.06em] transition-colors"
      style={{
        fontFamily: 'var(--font-display)',
        borderColor: activo ? 'var(--color-accent-glow)' : 'var(--color-accent-dark)',
        background: activo ? 'var(--color-accent)' : 'transparent',
        color: activo ? '#fff' : 'rgba(255,255,255,.75)',
      }}
    >
      {children}
    </button>
  );
}
