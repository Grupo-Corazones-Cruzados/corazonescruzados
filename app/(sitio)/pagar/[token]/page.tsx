'use client';

/**
 * CANAL 3 — el enlace que llega por correo, para el cliente que NO tiene cuenta.
 *
 * Toda la pantalla vive en `components/pagos/PantallaPago.tsx`, compartida con el canal 2.
 * Aquí solo se traduce la URL: el token del enlace es la única llave, y el servidor decide
 * a partir de él qué se cobra — no se acepta nada más de esta página.
 */
import { useParams } from 'next/navigation';
import PantallaPago from '@/components/pagos/PantallaPago';

export default function PaginaPagarConEnlace() {
  const { token } = useParams<{ token: string }>();
  const t = String(token);
  return <PantallaPago consulta={`link=${encodeURIComponent(t)}`} link={t} />;
}
