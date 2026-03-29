import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || "");
  return _resend;
}

const FROM_EMAIL =
  process.env.EMAIL_FROM || "GCC World <noreply@gccworld.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:'Courier New',monospace;background-color:#0A0E17;margin:0;padding:40px 20px;color:#e5e5e5;">
<div style="max-width:560px;margin:0 auto;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-family:'Courier New',monospace;font-size:24px;font-weight:bold;color:#7B5FBF;letter-spacing:0.1em;">GCC WORLD</span>
  </div>
  <div style="background:#131923;overflow:hidden;border:2px solid #2a2a3a;">
    <div style="height:3px;background:#4B2D8E;"></div>
    <div style="padding:36px 32px;">${content}</div>
    <div style="padding:20px 32px;background:#0f1320;border-top:1px solid #2a2a3a;">
      <p style="color:#737373;font-size:12px;margin:0;text-align:center;">
        Este correo fue enviado por GCC World.
      </p>
    </div>
  </div>
  <p style="text-align:center;margin-top:24px;color:#737373;font-size:11px;">
    &copy; ${new Date().getFullYear()} GCC World. Todos los derechos reservados.
  </p>
</div></body></html>`;
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  name?: string
) {
  const url = `${APP_URL}/auth/verify?token=${token}`;
  const html = emailShell(`
    <h1 style="color:#e5e5e5;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Verifica tu cuenta</h1>
    <p style="color:#94A3B8;font-size:14px;text-align:center;margin:0 0 24px;">Solo un paso m&aacute;s para comenzar</p>
    <p style="color:#CBD5E1;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola${name ? ` <strong>${name}</strong>` : ""},<br/>
      Gracias por registrarte en <strong style="color:#7B5FBF;">GCC World</strong>.
      Haz clic en el bot&oacute;n para activar tu cuenta:
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;font-weight:600;font-size:15px;border:2px solid #7B5FBF;">
        Verificar mi cuenta
      </a>
    </div>
    <p style="color:#737373;font-size:12px;margin:24px 0 0;">Este enlace expira en 24 horas.</p>
  `);
  return getResend().emails.send({ from: FROM_EMAIL, to: email, subject: "Verifica tu cuenta — GCC World", html });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  name?: string
) {
  const url = `${APP_URL}/auth/reset-password?token=${token}`;
  const html = emailShell(`
    <h1 style="color:#e5e5e5;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Restablecer contrase&ntilde;a</h1>
    <p style="color:#CBD5E1;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola${name ? ` <strong>${name}</strong>` : ""},<br/>
      Recibimos una solicitud para restablecer tu contrase&ntilde;a.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;font-weight:600;font-size:15px;border:2px solid #7B5FBF;">
        Restablecer contrase&ntilde;a
      </a>
    </div>
    <p style="color:#737373;font-size:12px;margin:24px 0 0;">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
  `);
  return getResend().emails.send({ from: FROM_EMAIL, to: email, subject: "Restablecer contraseña — GCC World", html });
}
