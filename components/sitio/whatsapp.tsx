/**
 * WHATSAPP EN LAS TARJETAS DEL SITIO (Fernando, 2026-10-31: «un botón de WhatsApp… para que al hacer
 * clic se abra un chat en WhatsApp para iniciar conversación con ese talento»). Lo usan la tarjeta de un
 * talento (`TarjetaMiembro`) y la de un proyecto o ticket (`TarjetaTrabajo`, junto al correo y el teléfono).
 */

/**
 * `https://wa.me/<número>` con el número en formato internacional y solo cifras. Un número local de
 * Ecuador (`09…`) se pasa a `5939…`. Sin un número usable, `null` y no se pinta el botón.
 */
export function enlaceWhatsApp(telefono: string | null): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.length === 10 && d.startsWith('0')) d = `593${d.slice(1)}`;
  return d.length >= 8 && d.length <= 15 ? `https://wa.me/${d}` : null;
}

/** El logotipo de WhatsApp (lucide no trae marcas). */
export function IconoWhatsApp({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.43 9.43zm8.03-17.46A11.28 11.28 0 0 0 12.05.7C5.8.7.72 5.78.72 12.03c0 2 .52 3.95 1.52 5.67L.62 23.3l5.73-1.5a11.3 11.3 0 0 0 5.7 1.45h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.32-8.01z" />
    </svg>
  );
}
