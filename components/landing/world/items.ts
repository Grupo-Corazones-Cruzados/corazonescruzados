// Catálogo de items disponibles en el mundo. Cada item tiene un id
// estable (no cambies después de poblar mapas), un label en español,
// una categoría para agrupar en el editor, y un dataURL SVG que se
// usa tanto como tile en el mundo como icono en el inventario.
//
// El "icon" se renderiza a 32x32 (tamaño tile) en el mapa y se reutiliza
// escalado en el inventario. Los SVG son simples para mantenerlos
// consistentes; se pueden reemplazar por sprites reales más adelante.

export type ItemCategory = 'arma' | 'herramienta' | 'consumible' | 'objeto';

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
];

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
];

// Suppresses an unused-vars lint when SHEET_BG isn't referenced elsewhere.
// Kept available in case we want to add a tile background frame later.
export const __SHEET_BG = SHEET_BG;
