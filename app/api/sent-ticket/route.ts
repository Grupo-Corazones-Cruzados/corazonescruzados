import { Resend } from 'resend';

// Usamos la variable de entorno en lugar de poner la clave en el código
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { nombreCliente, correoCliente, detalleTicket, correoMiembro} = await req.json();

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h1>Hola ${nombreCliente}</h1>
        <p>Tu ticket ha sido registrado correctamente:</p>
        <p><b>${detalleTicket}</b></p>
      </div>
    `;

 console.log("📨 Iniciando envío de correo...");

const data = await resend.emails.send({
  from: 'Luis <lfgonzalezm0@grupocc.org>',
  to: [correoCliente, correoMiembro],
  subject: 'Tu ticket ha sido recibido',
  html,
});

console.log("✅ Respuesta de Resend:", data);

    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  } catch (error: any) {
    console.error('Error enviando correo:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || error }), { status: 500 });
  }
}