/**
 * EL ICONO DE CADA RED SOCIAL — una sola definición para el CV y el pie del sitio.
 *
 * ⚠️ TikTok NO existe en lucide, así que va como SVG propio. Los demás iconos de marca sí
 * están en la versión que usa el repo (0.468).
 */
import { Facebook, Globe, Instagram, Linkedin, Youtube } from 'lucide-react';
import type { Red } from '@/lib/members/redes';

export default function IconoRed({ red, className = 'w-4 h-4' }: { red: Red; className?: string }) {
  const c = `${className} shrink-0`;
  if (red === 'linkedin') return <Linkedin className={c} aria-hidden />;
  if (red === 'youtube') return <Youtube className={c} aria-hidden />;
  if (red === 'instagram') return <Instagram className={c} aria-hidden />;
  if (red === 'facebook') return <Facebook className={c} aria-hidden />;
  if (red === 'web') return <Globe className={c} aria-hidden />;
  return (
    <svg className={c} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.68 5.68 0 0 0-.77-.05A5.66 5.66 0 1 0 15.54 15.3V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z" />
    </svg>
  );
}
