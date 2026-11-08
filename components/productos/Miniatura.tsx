'use client';

import { Package } from 'lucide-react';
import { esUrlCloudinary, urlRedimensionada } from '@/lib/cloudinary-url';

/** La portada de un producto en pequeño (la de su ficha del marketplace), o una caja con el icono
 *  si no tiene. La usan Plataformas y la pantalla de accesos de las apps. */
export default function Miniatura({ src, grande = false }: { src: string | null; grande?: boolean }) {
  const t = grande ? 'w-12 h-12' : 'w-7 h-7';
  if (!src) {
    return <span className={`${t} shrink-0 rounded border border-digi-border flex items-center justify-center`}><Package className="w-3.5 h-3.5 text-digi-muted/50" /></span>;
  }
  const url = esUrlCloudinary(src) ? urlRedimensionada(src, grande ? 160 : 96) : src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className={`${t} shrink-0 rounded border border-digi-border object-cover`} />;
}
