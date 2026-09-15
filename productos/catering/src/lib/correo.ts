/**
 * Correos al cliente final. Van con Resend si hay clave; si no la hay, no se
 * envía nada y NO falla: el mensaje queda igualmente en el portal del cliente,
 * que es la fuente de verdad. El correo es un aviso, no el registro.
 *
 * El remitente es del grupo; el negocio aparece en el nombre y en el asunto.
 */
const CLAVE = process.env.RESEND_API_KEY;
const DE = process.env.EMAIL_FROM || 'Gestión de Catering <noreply@grupocc.org>';

export const hayCorreo = Boolean(CLAVE);

export async function enviarCorreo(a: string, asunto: string, html: string): Promise<boolean> {
  if (!CLAVE) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: DE, to: [a], subject: asunto, html }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function plantilla(negocio: string, titulo: string, parrafos: string[], enlace?: { texto: string; url: string }) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#242424">
  <p style="font-size:12px;color:#616161;margin:0 0 16px">${escapar(negocio)}</p>
  <h1 style="font-size:20px;margin:0 0 12px">${escapar(titulo)}</h1>
  ${parrafos.map((p) => `<p style="font-size:14px;line-height:1.5;margin:0 0 12px">${escapar(p)}</p>`).join('')}
  ${enlace ? `<p style="margin:20px 0"><a href="${enlace.url}" style="background:#4B2D8E;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;font-weight:600;font-size:14px">${escapar(enlace.texto)}</a></p>` : ''}
  <p style="font-size:11px;color:#616161;margin-top:24px">Un producto del Grupo Corazones Cruzados.</p>
</div>`;
}

export function correoBienvenida(negocio: string, nombre: string, urlAcceso: string) {
  return {
    asunto: `Tu cuenta en ${negocio} está aprobada`,
    html: plantilla(
      negocio,
      `¡Bienvenido/a, ${nombre}!`,
      [
        'Tu registro fue aprobado. Ya puedes entrar al portal para ver tu servicio, tus días y tus datos de entrega.',
        'Entra con el correo y la contraseña que elegiste al registrarte.',
      ],
      { texto: 'Entrar al portal', url: urlAcceso },
    ),
  };
}

export function correoSolicitudInfo(negocio: string, nombre: string, mensaje: string, urlAcceso: string) {
  return {
    asunto: `${negocio} necesita un dato más de tu registro`,
    html: plantilla(negocio, `Hola, ${nombre}`, [
      'Revisamos tu registro y nos falta algo para aprobarlo:',
      `«${mensaje}»`,
      'Responde a este correo o ponte en contacto con el negocio para completarlo.',
    ], { texto: 'Ver mi registro', url: urlAcceso }),
  };
}

export function correoRechazo(negocio: string, nombre: string, motivo: string | null) {
  return {
    asunto: `Sobre tu registro en ${negocio}`,
    html: plantilla(negocio, `Hola, ${nombre}`, [
      'Lamentamos decirte que tu registro no fue aprobado.',
      ...(motivo ? [`Motivo: «${motivo}»`] : []),
    ]),
  };
}
