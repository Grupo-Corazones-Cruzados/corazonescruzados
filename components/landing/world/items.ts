// Catálogo de items disponibles en el mundo. Cada item tiene un id
// estable (no cambies después de poblar mapas), un label en español,
// una categoría para agrupar en el editor, y un dataURL SVG que se
// usa tanto como tile en el mundo como icono en el inventario.
//
// El "icon" se renderiza a 32x32 (tamaño tile) en el mapa y se reutiliza
// escalado en el inventario. Los SVG son simples para mantenerlos
// consistentes; se pueden reemplazar por sprites reales más adelante.

export type ItemCategory =
  | 'arma'
  | 'herramienta'
  | 'consumible'
  | 'objeto'
  | 'mueble'
  | 'ciudad'
  | 'naturaleza';

export type ItemDef = {
  id: string;
  label: string;
  category: ItemCategory;
  icon: string; // SVG markup
};

const SHEET_BG = '#1a1f2e';

function svg(inner: string): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'>${inner}</svg>`;
}

export const ITEMS: ItemDef[] = [
  {
    id: 'sword',
    label: 'Espada',
    category: 'arma',
    icon: svg(`
      <rect x='7' y='1' width='2' height='9' fill='#cdd5e0'/>
      <rect x='6' y='2' width='1' height='8' fill='#8a91a0'/>
      <rect x='9' y='2' width='1' height='8' fill='#fff'/>
      <rect x='7' y='10' width='2' height='1' fill='#666'/>
      <rect x='4' y='11' width='8' height='1' fill='#5a3a1a'/>
      <rect x='7' y='12' width='2' height='3' fill='#5a3a1a'/>
      <rect x='6' y='14' width='4' height='1' fill='#3a2812'/>
    `),
  },
  {
    id: 'axe',
    label: 'Hacha',
    category: 'arma',
    icon: svg(`
      <rect x='4' y='3' width='6' height='5' fill='#cdd5e0'/>
      <rect x='10' y='4' width='1' height='3' fill='#8a91a0'/>
      <rect x='3' y='4' width='1' height='3' fill='#8a91a0'/>
      <rect x='6' y='8' width='2' height='7' fill='#5a3a1a'/>
      <rect x='5' y='8' width='1' height='6' fill='#3a2812'/>
    `),
  },
  {
    id: 'pistol',
    label: 'Pistola',
    category: 'arma',
    icon: svg(`
      <rect x='3' y='6' width='9' height='3' fill='#3a3a40'/>
      <rect x='12' y='7' width='1' height='1' fill='#cdd5e0'/>
      <rect x='5' y='9' width='3' height='4' fill='#3a3a40'/>
      <rect x='4' y='9' width='1' height='3' fill='#5a5a60'/>
      <rect x='7' y='8' width='1' height='1' fill='#cdd5e0'/>
    `),
  },
  {
    id: 'bow',
    label: 'Arco',
    category: 'arma',
    icon: svg(`
      <rect x='4' y='2' width='1' height='2' fill='#5a3a1a'/>
      <rect x='3' y='3' width='1' height='3' fill='#5a3a1a'/>
      <rect x='2' y='5' width='1' height='6' fill='#5a3a1a'/>
      <rect x='3' y='10' width='1' height='3' fill='#5a3a1a'/>
      <rect x='4' y='12' width='1' height='2' fill='#5a3a1a'/>
      <rect x='5' y='3' width='1' height='10' fill='#cdd5e0'/>
      <rect x='6' y='7' width='8' height='1' fill='#cdd5e0'/>
      <rect x='13' y='6' width='1' height='3' fill='#fff'/>
    `),
  },
  {
    id: 'hammer',
    label: 'Martillo',
    category: 'herramienta',
    icon: svg(`
      <rect x='3' y='3' width='10' height='4' fill='#7a7a82'/>
      <rect x='3' y='3' width='1' height='4' fill='#cdd5e0'/>
      <rect x='12' y='3' width='1' height='4' fill='#3a3a40'/>
      <rect x='7' y='7' width='2' height='8' fill='#5a3a1a'/>
      <rect x='6' y='7' width='1' height='7' fill='#3a2812'/>
    `),
  },
  {
    id: 'pickaxe',
    label: 'Pico',
    category: 'herramienta',
    icon: svg(`
      <rect x='2' y='2' width='12' height='1' fill='#5a5a60'/>
      <rect x='3' y='3' width='10' height='1' fill='#7a7a82'/>
      <rect x='4' y='4' width='8' height='1' fill='#5a5a60'/>
      <rect x='7' y='5' width='2' height='10' fill='#5a3a1a'/>
    `),
  },
  {
    id: 'key',
    label: 'Llave',
    category: 'objeto',
    icon: svg(`
      <rect x='3' y='6' width='5' height='4' fill='#d9b380'/>
      <rect x='4' y='7' width='3' height='2' fill='#1a1f2e'/>
      <rect x='8' y='7' width='6' height='2' fill='#d9b380'/>
      <rect x='13' y='9' width='1' height='2' fill='#d9b380'/>
      <rect x='11' y='9' width='1' height='2' fill='#d9b380'/>
    `),
  },
  {
    id: 'potion_red',
    label: 'Poción roja',
    category: 'consumible',
    icon: svg(`
      <rect x='6' y='2' width='4' height='1' fill='#666'/>
      <rect x='6' y='3' width='4' height='2' fill='#a8a8a8'/>
      <rect x='5' y='5' width='6' height='9' fill='#cdd5e0' opacity='0.4'/>
      <rect x='5' y='8' width='6' height='6' fill='#c0392b'/>
      <rect x='6' y='9' width='1' height='3' fill='#e0594a'/>
    `),
  },
  {
    id: 'potion_blue',
    label: 'Poción azul',
    category: 'consumible',
    icon: svg(`
      <rect x='6' y='2' width='4' height='1' fill='#666'/>
      <rect x='6' y='3' width='4' height='2' fill='#a8a8a8'/>
      <rect x='5' y='5' width='6' height='9' fill='#cdd5e0' opacity='0.4'/>
      <rect x='5' y='8' width='6' height='6' fill='#2980b9'/>
      <rect x='6' y='9' width='1' height='3' fill='#5dade2'/>
    `),
  },
  {
    id: 'apple',
    label: 'Manzana',
    category: 'consumible',
    icon: svg(`
      <rect x='8' y='3' width='1' height='2' fill='#3a6b1a'/>
      <rect x='6' y='5' width='6' height='1' fill='#c92e2e'/>
      <rect x='5' y='6' width='8' height='6' fill='#c92e2e'/>
      <rect x='5' y='12' width='8' height='1' fill='#a01010'/>
      <rect x='6' y='13' width='6' height='1' fill='#7a0808'/>
      <rect x='6' y='6' width='2' height='2' fill='#e85a5a'/>
    `),
  },
  {
    id: 'coin',
    label: 'Moneda',
    category: 'objeto',
    icon: svg(`
      <rect x='5' y='4' width='6' height='1' fill='#d9b380'/>
      <rect x='4' y='5' width='8' height='6' fill='#f0c878'/>
      <rect x='5' y='11' width='6' height='1' fill='#d9b380'/>
      <rect x='6' y='6' width='4' height='4' fill='#d9b380'/>
      <rect x='7' y='7' width='2' height='2' fill='#fff' opacity='0.8'/>
    `),
  },
  {
    id: 'shield',
    label: 'Escudo',
    category: 'arma',
    icon: svg(`
      <rect x='4' y='2' width='8' height='1' fill='#7a5dbe'/>
      <rect x='3' y='3' width='10' height='6' fill='#7a5dbe'/>
      <rect x='4' y='9' width='8' height='2' fill='#7a5dbe'/>
      <rect x='5' y='11' width='6' height='2' fill='#5a3d8e'/>
      <rect x='6' y='13' width='4' height='1' fill='#3a1d6e'/>
      <rect x='7' y='5' width='2' height='4' fill='#fff'/>
    `),
  },
  {
    id: 'lantern',
    label: 'Linterna',
    category: 'herramienta',
    icon: svg(`
      <rect x='7' y='1' width='2' height='1' fill='#888'/>
      <rect x='6' y='2' width='4' height='1' fill='#444'/>
      <rect x='5' y='3' width='6' height='1' fill='#666'/>
      <rect x='5' y='4' width='1' height='8' fill='#444'/>
      <rect x='10' y='4' width='1' height='8' fill='#444'/>
      <rect x='6' y='4' width='4' height='8' fill='#fff7c2'/>
      <rect x='7' y='6' width='2' height='4' fill='#ffd97a'/>
      <rect x='5' y='12' width='6' height='1' fill='#666'/>
      <rect x='6' y='13' width='4' height='1' fill='#444'/>
    `),
  },

  // ── Muebles (casas / interiores) ──────────────────────────────────
  {
    id: 'chair',
    label: 'Silla',
    category: 'mueble',
    icon: svg(`
      <rect x='4' y='2' width='8' height='1' fill='#7a4a1f'/>
      <rect x='4' y='2' width='1' height='7' fill='#7a4a1f'/>
      <rect x='11' y='2' width='1' height='7' fill='#7a4a1f'/>
      <rect x='4' y='8' width='8' height='2' fill='#9a6a3a'/>
      <rect x='4' y='8' width='8' height='1' fill='#b58a55'/>
      <rect x='5' y='10' width='1' height='4' fill='#7a4a1f'/>
      <rect x='10' y='10' width='1' height='4' fill='#7a4a1f'/>
    `),
  },
  {
    id: 'armchair',
    label: 'Sillón',
    category: 'mueble',
    icon: svg(`
      <rect x='2' y='5' width='12' height='8' fill='#7a1f1f'/>
      <rect x='2' y='4' width='12' height='2' fill='#9b2c2c'/>
      <rect x='2' y='6' width='3' height='7' fill='#6a1818'/>
      <rect x='11' y='6' width='3' height='7' fill='#6a1818'/>
      <rect x='5' y='7' width='6' height='5' fill='#c44d4d'/>
      <rect x='5' y='7' width='6' height='1' fill='#d96a6a'/>
      <rect x='3' y='13' width='2' height='2' fill='#3a2812'/>
      <rect x='11' y='13' width='2' height='2' fill='#3a2812'/>
    `),
  },
  {
    id: 'table',
    label: 'Mesa',
    category: 'mueble',
    icon: svg(`
      <rect x='2' y='5' width='12' height='2' fill='#9a6a3a'/>
      <rect x='2' y='5' width='12' height='1' fill='#b58a55'/>
      <rect x='2' y='7' width='12' height='1' fill='#5a3a1a'/>
      <rect x='3' y='8' width='2' height='6' fill='#7a4a1f'/>
      <rect x='11' y='8' width='2' height='6' fill='#7a4a1f'/>
    `),
  },
  {
    id: 'bed',
    label: 'Cama',
    category: 'mueble',
    icon: svg(`
      <rect x='2' y='4' width='12' height='10' fill='#6a4a2a'/>
      <rect x='3' y='5' width='10' height='8' fill='#dfe6f0'/>
      <rect x='3' y='5' width='4' height='8' fill='#fff'/>
      <rect x='3' y='5' width='3' height='3' fill='#f0c8d0'/>
      <rect x='7' y='7' width='6' height='6' fill='#5a7fb5'/>
      <rect x='7' y='7' width='6' height='1' fill='#7a9fd5'/>
    `),
  },
  {
    id: 'bookshelf',
    label: 'Estantería',
    category: 'mueble',
    icon: svg(`
      <rect x='3' y='2' width='10' height='12' fill='#6a4a2a'/>
      <rect x='4' y='3' width='8' height='3' fill='#2a1c10'/>
      <rect x='4' y='3' width='2' height='3' fill='#9b2c2c'/>
      <rect x='7' y='3' width='1' height='3' fill='#2c6e9b'/>
      <rect x='9' y='3' width='2' height='3' fill='#2c9b4e'/>
      <rect x='4' y='7' width='8' height='3' fill='#2a1c10'/>
      <rect x='5' y='7' width='1' height='3' fill='#c9a227'/>
      <rect x='7' y='7' width='2' height='3' fill='#9b2c2c'/>
      <rect x='10' y='7' width='1' height='3' fill='#2c6e9b'/>
      <rect x='4' y='11' width='8' height='2' fill='#2a1c10'/>
    `),
  },
  {
    id: 'wardrobe',
    label: 'Armario',
    category: 'mueble',
    icon: svg(`
      <rect x='3' y='2' width='10' height='12' fill='#7a4a1f'/>
      <rect x='4' y='3' width='4' height='10' fill='#9a6a3a'/>
      <rect x='8' y='3' width='4' height='10' fill='#9a6a3a'/>
      <rect x='8' y='3' width='1' height='10' fill='#5a3a1a'/>
      <rect x='7' y='7' width='1' height='2' fill='#3a2812'/>
      <rect x='9' y='7' width='1' height='2' fill='#3a2812'/>
    `),
  },
  {
    id: 'dresser',
    label: 'Cómoda',
    category: 'mueble',
    icon: svg(`
      <rect x='3' y='4' width='10' height='10' fill='#7a4a1f'/>
      <rect x='4' y='5' width='8' height='2' fill='#9a6a3a'/>
      <rect x='4' y='8' width='8' height='2' fill='#9a6a3a'/>
      <rect x='4' y='11' width='8' height='2' fill='#9a6a3a'/>
      <rect x='7' y='5' width='2' height='1' fill='#3a2812'/>
      <rect x='7' y='8' width='2' height='1' fill='#3a2812'/>
      <rect x='7' y='11' width='2' height='1' fill='#3a2812'/>
    `),
  },
  {
    id: 'floor_lamp',
    label: 'Lámpara',
    category: 'mueble',
    icon: svg(`
      <rect x='5' y='2' width='6' height='4' fill='#f0d060'/>
      <rect x='5' y='2' width='6' height='1' fill='#f7e69a'/>
      <rect x='6' y='6' width='4' height='1' fill='#888'/>
      <rect x='7' y='7' width='2' height='6' fill='#6a6a72'/>
      <rect x='5' y='13' width='6' height='2' fill='#4a4a52'/>
    `),
  },
  {
    id: 'rug',
    label: 'Alfombra',
    category: 'mueble',
    icon: svg(`
      <rect x='2' y='5' width='12' height='7' fill='#9b2c2c'/>
      <rect x='3' y='6' width='10' height='5' fill='#c44d4d'/>
      <rect x='5' y='7' width='6' height='3' fill='#c9a227'/>
      <rect x='6' y='8' width='4' height='1' fill='#f0d060'/>
    `),
  },
  {
    id: 'wall_clock',
    label: 'Reloj',
    category: 'mueble',
    icon: svg(`
      <rect x='4' y='3' width='8' height='8' fill='#7a4a1f'/>
      <rect x='5' y='4' width='6' height='6' fill='#f0ead8'/>
      <rect x='7' y='5' width='1' height='3' fill='#2a2a2a'/>
      <rect x='8' y='7' width='2' height='1' fill='#2a2a2a'/>
      <rect x='7' y='11' width='1' height='2' fill='#5a3a1a'/>
    `),
  },
  {
    id: 'painting',
    label: 'Cuadro',
    category: 'mueble',
    icon: svg(`
      <rect x='3' y='3' width='10' height='9' fill='#c9a227'/>
      <rect x='4' y='4' width='8' height='7' fill='#7fb5e0'/>
      <rect x='4' y='8' width='8' height='3' fill='#3a7a3a'/>
      <rect x='9' y='5' width='2' height='2' fill='#f0d060'/>
    `),
  },
  {
    id: 'indoor_plant',
    label: 'Planta interior',
    category: 'mueble',
    icon: svg(`
      <rect x='6' y='2' width='1' height='4' fill='#3a7a3a'/>
      <rect x='5' y='3' width='1' height='3' fill='#5aa05a'/>
      <rect x='9' y='2' width='1' height='4' fill='#3a7a3a'/>
      <rect x='10' y='3' width='1' height='3' fill='#5aa05a'/>
      <rect x='7' y='1' width='2' height='6' fill='#5aa05a'/>
      <rect x='5' y='6' width='6' height='1' fill='#2c5e2c'/>
      <rect x='6' y='7' width='4' height='2' fill='#9a5a2a'/>
      <rect x='5' y='9' width='6' height='5' fill='#c47a3a'/>
      <rect x='5' y='9' width='6' height='1' fill='#d99a5a'/>
    `),
  },
  {
    id: 'fireplace',
    label: 'Chimenea',
    category: 'mueble',
    icon: svg(`
      <rect x='2' y='3' width='12' height='11' fill='#8a8a92'/>
      <rect x='2' y='3' width='12' height='2' fill='#6a6a72'/>
      <rect x='4' y='6' width='8' height='8' fill='#3a3a40'/>
      <rect x='5' y='10' width='6' height='3' fill='#e0702a'/>
      <rect x='6' y='8' width='4' height='4' fill='#f0a83a'/>
      <rect x='7' y='7' width='2' height='3' fill='#f7d060'/>
    `),
  },
  {
    id: 'stove',
    label: 'Cocina',
    category: 'mueble',
    icon: svg(`
      <rect x='3' y='3' width='10' height='11' fill='#c8c8d0'/>
      <rect x='4' y='4' width='8' height='2' fill='#5a5a62'/>
      <rect x='5' y='4' width='2' height='2' fill='#2a2a2a'/>
      <rect x='9' y='4' width='2' height='2' fill='#2a2a2a'/>
      <rect x='4' y='7' width='8' height='6' fill='#9a9aa2'/>
      <rect x='5' y='8' width='6' height='4' fill='#3a3a40'/>
      <rect x='5' y='12' width='6' height='1' fill='#6a6a72'/>
    `),
  },

  // ── Ciudad (calles / mobiliario urbano) ───────────────────────────
  {
    id: 'street_lamp',
    label: 'Farola',
    category: 'ciudad',
    icon: svg(`
      <rect x='5' y='2' width='6' height='4' fill='#f7e69a'/>
      <rect x='6' y='2' width='4' height='3' fill='#fff7c2'/>
      <rect x='5' y='6' width='6' height='1' fill='#3a3a40'/>
      <rect x='7' y='7' width='2' height='6' fill='#4a4a52'/>
      <rect x='5' y='13' width='6' height='2' fill='#3a3a40'/>
    `),
  },
  {
    id: 'bench',
    label: 'Banca',
    category: 'ciudad',
    icon: svg(`
      <rect x='3' y='4' width='10' height='1' fill='#9a6a3a'/>
      <rect x='3' y='6' width='10' height='1' fill='#9a6a3a'/>
      <rect x='3' y='8' width='10' height='2' fill='#9a6a3a'/>
      <rect x='3' y='4' width='1' height='6' fill='#5a5a60'/>
      <rect x='12' y='4' width='1' height='6' fill='#5a5a60'/>
      <rect x='4' y='10' width='1' height='4' fill='#5a5a60'/>
      <rect x='11' y='10' width='1' height='4' fill='#5a5a60'/>
    `),
  },
  {
    id: 'fountain',
    label: 'Fuente',
    category: 'ciudad',
    icon: svg(`
      <rect x='2' y='8' width='12' height='5' fill='#8a8a92'/>
      <rect x='3' y='9' width='10' height='3' fill='#4d7fc4'/>
      <rect x='3' y='9' width='10' height='1' fill='#7fb5e0'/>
      <rect x='7' y='3' width='2' height='6' fill='#8a8a92'/>
      <rect x='6' y='7' width='4' height='1' fill='#a8a8b0'/>
      <rect x='6' y='3' width='1' height='2' fill='#7fb5e0'/>
      <rect x='9' y='3' width='1' height='2' fill='#7fb5e0'/>
      <rect x='7' y='1' width='2' height='2' fill='#a8d0f0'/>
    `),
  },
  {
    id: 'fence',
    label: 'Valla',
    category: 'ciudad',
    icon: svg(`
      <rect x='2' y='5' width='2' height='8' fill='#9a6a3a'/>
      <rect x='7' y='5' width='2' height='8' fill='#9a6a3a'/>
      <rect x='12' y='5' width='2' height='8' fill='#9a6a3a'/>
      <rect x='1' y='7' width='14' height='1' fill='#7a4a1f'/>
      <rect x='1' y='10' width='14' height='1' fill='#7a4a1f'/>
      <rect x='2' y='4' width='2' height='1' fill='#7a4a1f'/>
      <rect x='7' y='4' width='2' height='1' fill='#7a4a1f'/>
      <rect x='12' y='4' width='2' height='1' fill='#7a4a1f'/>
    `),
  },
  {
    id: 'sign_post',
    label: 'Letrero',
    category: 'ciudad',
    icon: svg(`
      <rect x='3' y='3' width='10' height='5' fill='#9a6a3a'/>
      <rect x='3' y='3' width='10' height='1' fill='#b58a55'/>
      <rect x='4' y='5' width='8' height='1' fill='#5a3a1a'/>
      <rect x='5' y='6' width='5' height='1' fill='#5a3a1a'/>
      <rect x='7' y='8' width='2' height='6' fill='#7a4a1f'/>
    `),
  },
  {
    id: 'mailbox',
    label: 'Buzón',
    category: 'ciudad',
    icon: svg(`
      <rect x='4' y='4' width='8' height='6' fill='#2c5e9b'/>
      <rect x='4' y='4' width='8' height='2' fill='#4d7fc4'/>
      <rect x='5' y='7' width='6' height='1' fill='#1a3a6a'/>
      <rect x='11' y='4' width='1' height='3' fill='#c0392b'/>
      <rect x='7' y='10' width='2' height='4' fill='#5a5a60'/>
    `),
  },
  {
    id: 'trash_can',
    label: 'Basurero',
    category: 'ciudad',
    icon: svg(`
      <rect x='7' y='2' width='2' height='1' fill='#6a8a5a'/>
      <rect x='4' y='3' width='8' height='1' fill='#6a8a5a'/>
      <rect x='4' y='4' width='8' height='2' fill='#5a7a4a'/>
      <rect x='5' y='6' width='6' height='8' fill='#3a5a2a'/>
      <rect x='5' y='6' width='6' height='1' fill='#4a6a3a'/>
      <rect x='6' y='7' width='1' height='6' fill='#2a4a1a'/>
      <rect x='9' y='7' width='1' height='6' fill='#2a4a1a'/>
    `),
  },
  {
    id: 'fire_hydrant',
    label: 'Hidrante',
    category: 'ciudad',
    icon: svg(`
      <rect x='6' y='3' width='4' height='2' fill='#c0392b'/>
      <rect x='5' y='5' width='6' height='6' fill='#e0492b'/>
      <rect x='4' y='7' width='2' height='2' fill='#c0392b'/>
      <rect x='10' y='7' width='2' height='2' fill='#c0392b'/>
      <rect x='7' y='6' width='2' height='2' fill='#f0d060'/>
      <rect x='5' y='11' width='6' height='3' fill='#c0392b'/>
      <rect x='4' y='13' width='8' height='1' fill='#8a1f1f'/>
    `),
  },
  {
    id: 'traffic_cone',
    label: 'Cono',
    category: 'ciudad',
    icon: svg(`
      <rect x='7' y='2' width='2' height='3' fill='#e0702a'/>
      <rect x='6' y='5' width='4' height='3' fill='#f08a3a'/>
      <rect x='5' y='8' width='6' height='2' fill='#fff'/>
      <rect x='5' y='10' width='6' height='2' fill='#f08a3a'/>
      <rect x='4' y='12' width='8' height='2' fill='#e0702a'/>
    `),
  },
  {
    id: 'barrel',
    label: 'Barril',
    category: 'ciudad',
    icon: svg(`
      <rect x='4' y='3' width='8' height='11' fill='#9a6a3a'/>
      <rect x='4' y='3' width='8' height='1' fill='#b58a55'/>
      <rect x='3' y='5' width='10' height='1' fill='#5a3a1a'/>
      <rect x='3' y='10' width='10' height='1' fill='#5a3a1a'/>
      <rect x='4' y='13' width='8' height='1' fill='#5a3a1a'/>
      <rect x='6' y='4' width='1' height='9' fill='#7a4a1f'/>
      <rect x='9' y='4' width='1' height='9' fill='#7a4a1f'/>
    `),
  },
  {
    id: 'crate',
    label: 'Caja',
    category: 'ciudad',
    icon: svg(`
      <rect x='3' y='3' width='10' height='11' fill='#9a6a3a'/>
      <rect x='3' y='3' width='10' height='1' fill='#b58a55'/>
      <rect x='3' y='13' width='10' height='1' fill='#5a3a1a'/>
      <rect x='3' y='3' width='1' height='11' fill='#7a4a1f'/>
      <rect x='12' y='3' width='1' height='11' fill='#7a4a1f'/>
      <rect x='4' y='4' width='8' height='8' fill='#8a5a2a'/>
      <rect x='4' y='4' width='8' height='1' fill='#7a4a1f'/>
      <rect x='4' y='8' width='8' height='1' fill='#7a4a1f'/>
    `),
  },
  {
    id: 'well',
    label: 'Pozo',
    category: 'ciudad',
    icon: svg(`
      <rect x='3' y='1' width='10' height='2' fill='#9b2c2c'/>
      <rect x='3' y='3' width='10' height='1' fill='#7a1f1f'/>
      <rect x='4' y='2' width='1' height='6' fill='#7a4a1f'/>
      <rect x='11' y='2' width='1' height='6' fill='#7a4a1f'/>
      <rect x='7' y='4' width='2' height='3' fill='#5a3a1a'/>
      <rect x='3' y='8' width='10' height='6' fill='#7a7a82'/>
      <rect x='3' y='8' width='10' height='1' fill='#9a9aa2'/>
      <rect x='4' y='9' width='8' height='4' fill='#2a3a4a'/>
    `),
  },
  {
    id: 'street_sign',
    label: 'Señal',
    category: 'ciudad',
    icon: svg(`
      <rect x='7' y='7' width='2' height='7' fill='#8a8a92'/>
      <rect x='4' y='2' width='8' height='6' fill='#c0392b'/>
      <rect x='5' y='3' width='6' height='4' fill='#fff'/>
      <rect x='6' y='4' width='4' height='2' fill='#c0392b'/>
    `),
  },
  {
    id: 'flag_pole',
    label: 'Asta de bandera',
    category: 'ciudad',
    icon: svg(`
      <rect x='7' y='1' width='1' height='1' fill='#f0d060'/>
      <rect x='7' y='2' width='1' height='12' fill='#9a9aa2'/>
      <rect x='8' y='2' width='6' height='5' fill='#c0392b'/>
      <rect x='8' y='2' width='6' height='2' fill='#e0492b'/>
      <rect x='8' y='5' width='6' height='1' fill='#8a1f1f'/>
      <rect x='6' y='13' width='3' height='1' fill='#5a5a60'/>
    `),
  },

  // ── Naturaleza (paisaje / vegetación) ─────────────────────────────
  {
    id: 'tree',
    label: 'Árbol',
    category: 'naturaleza',
    icon: svg(`
      <rect x='5' y='2' width='6' height='2' fill='#3a7a3a'/>
      <rect x='4' y='2' width='8' height='1' fill='#5aa05a'/>
      <rect x='3' y='3' width='10' height='4' fill='#3a7a3a'/>
      <rect x='3' y='4' width='3' height='2' fill='#5aa05a'/>
      <rect x='4' y='7' width='8' height='2' fill='#2c5e2c'/>
      <rect x='6' y='9' width='1' height='5' fill='#4a3018'/>
      <rect x='7' y='9' width='2' height='5' fill='#6a4a2a'/>
    `),
  },
  {
    id: 'pine_tree',
    label: 'Pino',
    category: 'naturaleza',
    icon: svg(`
      <rect x='7' y='1' width='2' height='2' fill='#2c5e2c'/>
      <rect x='6' y='3' width='4' height='2' fill='#3a7a3a'/>
      <rect x='5' y='5' width='6' height='2' fill='#2c5e2c'/>
      <rect x='4' y='7' width='8' height='2' fill='#3a7a3a'/>
      <rect x='3' y='9' width='10' height='2' fill='#2c5e2c'/>
      <rect x='7' y='11' width='2' height='3' fill='#6a4a2a'/>
    `),
  },
  {
    id: 'palm_tree',
    label: 'Palmera',
    category: 'naturaleza',
    icon: svg(`
      <rect x='3' y='3' width='4' height='2' fill='#3a7a3a'/>
      <rect x='9' y='3' width='4' height='2' fill='#3a7a3a'/>
      <rect x='5' y='2' width='3' height='2' fill='#5aa05a'/>
      <rect x='8' y='2' width='3' height='2' fill='#5aa05a'/>
      <rect x='6' y='4' width='4' height='2' fill='#2c5e2c'/>
      <rect x='7' y='5' width='1' height='9' fill='#7a4a1f'/>
      <rect x='8' y='5' width='1' height='9' fill='#9a6a3a'/>
      <rect x='6' y='13' width='4' height='1' fill='#5a3a1a'/>
    `),
  },
  {
    id: 'bush',
    label: 'Arbusto',
    category: 'naturaleza',
    icon: svg(`
      <rect x='5' y='5' width='3' height='2' fill='#5aa05a'/>
      <rect x='9' y='5' width='3' height='2' fill='#3a7a3a'/>
      <rect x='4' y='6' width='8' height='2' fill='#5aa05a'/>
      <rect x='3' y='7' width='10' height='5' fill='#3a7a3a'/>
      <rect x='3' y='11' width='10' height='1' fill='#2c5e2c'/>
      <rect x='6' y='8' width='1' height='1' fill='#c44d4d'/>
      <rect x='10' y='9' width='1' height='1' fill='#c44d4d'/>
    `),
  },
  {
    id: 'flowers_red',
    label: 'Flores rojas',
    category: 'naturaleza',
    icon: svg(`
      <rect x='3' y='10' width='10' height='1' fill='#2c5e2c'/>
      <rect x='4' y='6' width='1' height='5' fill='#3a7a3a'/>
      <rect x='8' y='5' width='1' height='6' fill='#3a7a3a'/>
      <rect x='12' y='7' width='1' height='4' fill='#3a7a3a'/>
      <rect x='3' y='5' width='3' height='2' fill='#c0392b'/>
      <rect x='4' y='4' width='1' height='1' fill='#e0492b'/>
      <rect x='7' y='3' width='3' height='3' fill='#c0392b'/>
      <rect x='8' y='4' width='1' height='1' fill='#f0d060'/>
      <rect x='11' y='5' width='3' height='2' fill='#c0392b'/>
    `),
  },
  {
    id: 'flowers_yellow',
    label: 'Flores amarillas',
    category: 'naturaleza',
    icon: svg(`
      <rect x='3' y='10' width='10' height='1' fill='#2c5e2c'/>
      <rect x='4' y='6' width='1' height='5' fill='#3a7a3a'/>
      <rect x='8' y='5' width='1' height='6' fill='#3a7a3a'/>
      <rect x='12' y='7' width='1' height='4' fill='#3a7a3a'/>
      <rect x='3' y='5' width='3' height='2' fill='#f0d060'/>
      <rect x='4' y='4' width='1' height='1' fill='#f7e69a'/>
      <rect x='7' y='3' width='3' height='3' fill='#f0d060'/>
      <rect x='8' y='4' width='1' height='1' fill='#e0702a'/>
      <rect x='11' y='5' width='3' height='2' fill='#f0d060'/>
    `),
  },
  {
    id: 'flowers_blue',
    label: 'Flores azules',
    category: 'naturaleza',
    icon: svg(`
      <rect x='3' y='10' width='10' height='1' fill='#2c5e2c'/>
      <rect x='4' y='6' width='1' height='5' fill='#3a7a3a'/>
      <rect x='8' y='5' width='1' height='6' fill='#3a7a3a'/>
      <rect x='12' y='7' width='1' height='4' fill='#3a7a3a'/>
      <rect x='3' y='5' width='3' height='2' fill='#4d7fc4'/>
      <rect x='4' y='4' width='1' height='1' fill='#7fb5e0'/>
      <rect x='7' y='3' width='3' height='3' fill='#4d7fc4'/>
      <rect x='8' y='4' width='1' height='1' fill='#f0d060'/>
      <rect x='11' y='5' width='3' height='2' fill='#4d7fc4'/>
    `),
  },
  {
    id: 'rock',
    label: 'Roca',
    category: 'naturaleza',
    icon: svg(`
      <rect x='5' y='6' width='5' height='2' fill='#9a9aa2'/>
      <rect x='5' y='7' width='2' height='2' fill='#b8b8c0'/>
      <rect x='4' y='7' width='8' height='6' fill='#7a7a82'/>
      <rect x='3' y='9' width='10' height='4' fill='#6a6a72'/>
      <rect x='3' y='13' width='10' height='1' fill='#4a4a52'/>
    `),
  },
  {
    id: 'stump',
    label: 'Tocón',
    category: 'naturaleza',
    icon: svg(`
      <rect x='4' y='7' width='8' height='2' fill='#9a6a3a'/>
      <rect x='5' y='7' width='6' height='1' fill='#b58a55'/>
      <rect x='7' y='7' width='2' height='1' fill='#5a3a1a'/>
      <rect x='4' y='8' width='8' height='5' fill='#7a4a1f'/>
      <rect x='3' y='10' width='1' height='2' fill='#9a6a3a'/>
      <rect x='12' y='10' width='1' height='2' fill='#9a6a3a'/>
      <rect x='4' y='12' width='8' height='1' fill='#5a3a1a'/>
    `),
  },
  {
    id: 'mushroom',
    label: 'Hongo',
    category: 'naturaleza',
    icon: svg(`
      <rect x='4' y='4' width='8' height='4' fill='#c0392b'/>
      <rect x='4' y='4' width='8' height='1' fill='#e0492b'/>
      <rect x='6' y='5' width='2' height='2' fill='#fff'/>
      <rect x='9' y='6' width='2' height='1' fill='#fff'/>
      <rect x='5' y='6' width='1' height='1' fill='#fff'/>
      <rect x='6' y='8' width='4' height='5' fill='#e8e0d0'/>
      <rect x='6' y='8' width='1' height='5' fill='#d0c8b8'/>
    `),
  },
  {
    id: 'cactus',
    label: 'Cactus',
    category: 'naturaleza',
    icon: svg(`
      <rect x='7' y='3' width='2' height='11' fill='#3a7a3a'/>
      <rect x='7' y='3' width='1' height='11' fill='#5aa05a'/>
      <rect x='4' y='6' width='2' height='4' fill='#3a7a3a'/>
      <rect x='4' y='6' width='1' height='4' fill='#5aa05a'/>
      <rect x='5' y='9' width='2' height='1' fill='#3a7a3a'/>
      <rect x='10' y='5' width='2' height='4' fill='#3a7a3a'/>
      <rect x='9' y='8' width='2' height='1' fill='#3a7a3a'/>
      <rect x='7' y='3' width='2' height='1' fill='#f0d060'/>
    `),
  },
  {
    id: 'tall_grass',
    label: 'Hierba alta',
    category: 'naturaleza',
    icon: svg(`
      <rect x='3' y='12' width='10' height='1' fill='#2c5e2c'/>
      <rect x='4' y='6' width='1' height='6' fill='#3a7a3a'/>
      <rect x='5' y='8' width='1' height='4' fill='#5aa05a'/>
      <rect x='7' y='4' width='1' height='8' fill='#3a7a3a'/>
      <rect x='8' y='6' width='1' height='6' fill='#5aa05a'/>
      <rect x='10' y='7' width='1' height='5' fill='#3a7a3a'/>
      <rect x='11' y='9' width='1' height='3' fill='#5aa05a'/>
    `),
  },
  {
    id: 'lily_pad',
    label: 'Nenúfar',
    category: 'naturaleza',
    icon: svg(`
      <rect x='3' y='8' width='10' height='4' fill='#2c5e9b'/>
      <rect x='3' y='8' width='10' height='1' fill='#4d7fc4'/>
      <rect x='5' y='6' width='6' height='4' fill='#3a7a3a'/>
      <rect x='5' y='6' width='6' height='1' fill='#5aa05a'/>
      <rect x='8' y='6' width='3' height='2' fill='#2c5e2c'/>
      <rect x='7' y='4' width='2' height='2' fill='#f0e0f0'/>
      <rect x='7' y='4' width='2' height='1' fill='#fff'/>
    `),
  },
  {
    id: 'fallen_log',
    label: 'Tronco caído',
    category: 'naturaleza',
    icon: svg(`
      <rect x='6' y='5' width='2' height='1' fill='#3a7a3a'/>
      <rect x='9' y='5' width='2' height='1' fill='#3a7a3a'/>
      <rect x='2' y='6' width='12' height='4' fill='#7a4a1f'/>
      <rect x='2' y='6' width='12' height='1' fill='#9a6a3a'/>
      <rect x='2' y='9' width='12' height='1' fill='#5a3a1a'/>
      <rect x='2' y='6' width='3' height='4' fill='#9a6a3a'/>
      <rect x='3' y='7' width='1' height='2' fill='#5a3a1a'/>
    `),
  },
];

// Items that, when equipped, attach a glowing light to the player.
// Map an item id to the synthetic LightSource template (id is filled
// in by the renderer with a stable negative number so it never
// collides with a real /api/world/lights row).
export const EQUIPPED_LIGHT_TEMPLATES: Record<
  string,
  {
    radius: number;
    color: string;
    mode: 'steady' | 'flicker';
    periodMs: number;
    intensity: number;
  }
> = {
  lantern: {
    radius: 5,
    color: '#ffd27a',
    mode: 'flicker',
    periodMs: 700,
    intensity: 1,
  },
};

export function itemDataUrl(item: ItemDef): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(item.icon)}`;
}

export function findItem(id: string): ItemDef | null {
  return ITEMS.find((i) => i.id === id) ?? null;
}

export const ITEM_CATEGORIES: { id: ItemCategory; label: string }[] = [
  { id: 'arma', label: 'Armas' },
  { id: 'herramienta', label: 'Herramientas' },
  { id: 'consumible', label: 'Consumibles' },
  { id: 'objeto', label: 'Objetos' },
  { id: 'mueble', label: 'Muebles' },
  { id: 'ciudad', label: 'Ciudad' },
  { id: 'naturaleza', label: 'Naturaleza' },
];

// Suppresses an unused-vars lint when SHEET_BG isn't referenced elsewhere.
// Kept available in case we want to add a tile background frame later.
export const __SHEET_BG = SHEET_BG;
