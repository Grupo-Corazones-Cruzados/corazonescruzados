/**
 * IDENTIDAD DEL NEGOCIO — el bloque público que dice quién está detrás de esto.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────────
 * Meta rechazó la verificación del negocio (2026-08-02) con este motivo:
 *
 *   «Este portfolio no superó el proceso de verificación del negocio, lo que significa que
 *    Meta **no puede determinar que pertenezca a un negocio real**.»
 *
 * No era el documento —el certificado de RUC estaba bien— sino que **la web no acreditaba
 * nada**: se abría y no decía ni el nombre legal, ni el identificador fiscal, ni la
 * dirección, ni un contacto. Un revisor que la abre no encuentra con qué contrastar el
 * documento que se le acaba de enviar.
 *
 * Este bloque pone esos cuatro datos donde cualquiera —revisor, cliente, autoridad— pueda
 * verlos sin entrar en la aplicación.
 *
 * ── LA REGLA ───────────────────────────────────────────────────────────────────
 * Los valores salen de `app/legal/datos.ts`, la **definición única** de identidad legal, y
 * esa a su vez del certificado del SRI. **No se escriben a mano aquí.** Si algún día
 * cambian, cambian en un sitio y llegan a la web, a las dos páginas legales y a cualquier
 * trámite que los consulte.
 *
 * Debe verse **sin JavaScript y sin iniciar sesión**: es contenido estático a propósito.
 */

import { RAZON_SOCIAL, NOMBRE_COMERCIAL, RUC, DIRECCION, CONTACTO } from '@/app/legal/datos';

export default function IdentidadNegocio() {
  return (
    <div
      // `itemScope` en microdatos: le da a un rastreador —y a quien revise— la lectura
      // estructurada de que esto es una organización con nombre, dirección y contacto.
      itemScope
      itemType="https://schema.org/Organization"
      style={{
        maxWidth: 820,
        margin: '28px auto 0',
        paddingTop: 20,
        borderTop: '1px solid rgba(255,255,255,0.12)',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontSize: '0.78rem',
        lineHeight: 1.7,
        color: '#9b95b3',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, color: '#d9d4ea', fontWeight: 600 }}>
        <span itemProp="name">{NOMBRE_COMERCIAL}</span>
      </p>
      <p style={{ margin: '2px 0 0' }}>
        <span itemProp="legalName">{RAZON_SOCIAL}</span> · RUC{' '}
        <span itemProp="taxID">{RUC}</span>
      </p>
      <p
        style={{ margin: '2px 0 0' }}
        itemProp="address"
        itemScope
        itemType="https://schema.org/PostalAddress"
      >
        <span itemProp="streetAddress">{DIRECCION}</span>
      </p>
      <p style={{ margin: '2px 0 0' }}>
        <a href={`mailto:${CONTACTO}`} itemProp="email" style={{ color: '#7B5FBF', textDecoration: 'none' }}>
          {CONTACTO}
        </a>
      </p>
      <p style={{ margin: '10px 0 0', fontSize: '0.74rem' }}>
        <a href="/negocio" style={{ color: '#7B5FBF', textDecoration: 'underline' }}>
          Sobre el negocio
        </a>
        {'  ·  '}
        <a href="/legal" style={{ color: '#9b95b3', textDecoration: 'underline' }}>
          Términos y privacidad
        </a>
        {'  ·  '}
        <a href="/legal/whatsapp" style={{ color: '#9b95b3', textDecoration: 'underline' }}>
          Agente IA en WhatsApp
        </a>
        {'  ·  '}
        <a href="/legal/whatsapp#eliminar-datos" style={{ color: '#9b95b3', textDecoration: 'underline' }}>
          Eliminar mis datos
        </a>
      </p>
    </div>
  );
}
