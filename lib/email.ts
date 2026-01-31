import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "Corazones Cruzados <noreply@corazonescruzados.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Template base en modo oscuro
const getEmailTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #0a0a0f; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    <!-- Header con logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${APP_URL}/LogoCC.png" alt="Corazones Cruzados" style="width: 60px; height: 60px; border-radius: 12px;" />
    </div>

    <!-- Card principal -->
    <div style="background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
      <!-- Barra decorativa superior -->
      <div style="height: 4px; background: linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #dc2626 100%);"></div>

      <!-- Contenido -->
      <div style="padding: 40px 32px;">
        ${content}
      </div>

      <!-- Footer del card -->
      <div style="padding: 24px 32px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05);">
        <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
          Este correo fue enviado por Corazones Cruzados.<br>
          Si tienes alguna pregunta, contactanos en soporte.
        </p>
      </div>
    </div>

    <!-- Footer externo -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="color: #4b5563; font-size: 11px; margin: 0;">
        © ${new Date().getFullYear()} Corazones Cruzados. Todos los derechos reservados.
      </p>
    </div>
  </div>
</body>
</html>
`;

export async function sendVerificationEmail(email: string, token: string, nombre?: string) {
  const verificationUrl = `${APP_URL}/auth/verify?token=${token}`;

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(220, 38, 38, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">✉️</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Verifica tu cuenta
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Solo un paso mas para comenzar
    </p>

    <!-- Mensaje -->
    <p style="color: #e5e7eb; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
      Hola${nombre ? ` <strong style="color: #ffffff;">${nombre}</strong>` : ""},
    </p>
    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 32px;">
      Gracias por registrarte en <strong style="color: #dc2626;">Corazones Cruzados</strong>. Para completar tu registro y activar tu cuenta, haz clic en el siguiente boton:
    </p>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        ✓ Verificar mi cuenta
      </a>
    </div>

    <!-- Info adicional -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 16px 20px; margin-top: 32px; border: 1px solid rgba(255,255,255,0.05);">
      <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px;">
        <span style="color: #fbbf24;">⏱</span> Este enlace expira en <strong style="color: #e5e7eb;">24 horas</strong>
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        Si no creaste esta cuenta, puedes ignorar este correo.
      </p>
    </div>

    <!-- Link alternativo -->
    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05);">
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px;">
        Si el boton no funciona, copia y pega este enlace:
      </p>
      <p style="margin: 0;">
        <a href="${verificationUrl}" style="color: #60a5fa; font-size: 12px; word-break: break-all; text-decoration: none;">${verificationUrl}</a>
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "✉️ Verifica tu cuenta - Corazones Cruzados",
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending verification email:", error);
      return { success: false, error: error.message };
    }

    console.log("Verification email sent:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Error sending verification email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

export async function sendPasswordResetEmail(email: string, token: string, nombre?: string) {
  const resetUrl = `${APP_URL}/auth/reset?token=${token}`;

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(251, 191, 36, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">🔐</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Restablecer contraseña
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Solicitud de cambio de contraseña
    </p>

    <!-- Mensaje -->
    <p style="color: #e5e7eb; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
      Hola${nombre ? ` <strong style="color: #ffffff;">${nombre}</strong>` : ""},
    </p>
    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 32px;">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong style="color: #dc2626;">Corazones Cruzados</strong>. Haz clic en el siguiente boton para crear una nueva contraseña:
    </p>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        🔑 Restablecer contraseña
      </a>
    </div>

    <!-- Info adicional -->
    <div style="background: rgba(251, 191, 36, 0.08); border-radius: 10px; padding: 16px 20px; margin-top: 32px; border: 1px solid rgba(251, 191, 36, 0.2);">
      <p style="color: #fbbf24; font-size: 13px; margin: 0 0 8px;">
        <span>⚠️</span> <strong>Importante:</strong>
      </p>
      <p style="color: #9ca3af; font-size: 13px; margin: 0 0 4px;">
        • Este enlace expira en <strong style="color: #e5e7eb;">1 hora</strong>
      </p>
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        • Si no solicitaste este cambio, ignora este correo
      </p>
    </div>

    <!-- Link alternativo -->
    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05);">
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px;">
        Si el boton no funciona, copia y pega este enlace:
      </p>
      <p style="margin: 0;">
        <a href="${resetUrl}" style="color: #60a5fa; font-size: 12px; word-break: break-all; text-decoration: none;">${resetUrl}</a>
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "🔐 Restablecer contraseña - Corazones Cruzados",
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending password reset email:", error);
      return { success: false, error: error.message };
    }

    console.log("Password reset email sent:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Reporte de ticket completado al cliente
export async function sendTicketReportEmail(
  email: string,
  ticket: {
    id: number;
    titulo: string;
    detalle?: string;
    fecha_creacion?: string;
    fecha_fin?: string;
  },
  miembro: { nombre: string; puesto?: string },
  acciones: { nombre: string; horas_asignadas?: number; costo_hora?: number }[],
  slots: { fecha: string; hora_inicio?: string; hora_fin?: string; estado?: string }[]
) {
  const fechaCreacion = ticket.fecha_creacion
    ? new Date(ticket.fecha_creacion).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })
    : "—";
  const fechaFin = ticket.fecha_fin
    ? new Date(ticket.fecha_fin).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" });

  const totalHoras = acciones.reduce((sum, a) => sum + Number(a.horas_asignadas || 0), 0);
  const totalCosto = acciones.reduce((sum, a) => sum + Number(a.horas_asignadas || 0) * Number(a.costo_hora || 0), 0);

  const accionesHtml = acciones.length > 0
    ? acciones.map((a) => `
        <tr>
          <td style="padding: 10px 12px; color: #e5e7eb; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05);">${a.nombre}</td>
          <td style="padding: 10px 12px; color: #e5e7eb; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">${Number(a.horas_asignadas || 0)}h</td>
          <td style="padding: 10px 12px; color: #e5e7eb; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;">$${(Number(a.horas_asignadas || 0) * Number(a.costo_hora || 0)).toFixed(2)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="3" style="padding: 10px 12px; color: #6b7280; font-size: 14px; text-align: center;">Sin servicios registrados</td></tr>`;

  const slotsCompletados = slots.filter((s) => s.estado === "completado");
  const slotsHtml = slotsCompletados.length > 0
    ? slotsCompletados.map((s) => {
        const fecha = new Date(s.fecha).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
        const inicio = s.hora_inicio ? s.hora_inicio.slice(0, 5) : "";
        const fin = s.hora_fin ? s.hora_fin.slice(0, 5) : "";
        return `<span style="display: inline-block; background: rgba(220, 38, 38, 0.12); color: #fca5a5; padding: 4px 10px; border-radius: 6px; font-size: 12px; margin: 2px 4px;">${fecha}${inicio ? ` ${inicio}` : ""}${fin ? `–${fin}` : ""}</span>`;
      }).join("")
    : `<span style="color: #6b7280; font-size: 13px;">Sin sesiones registradas</span>`;

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">✅</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Ticket completado
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Reporte final de tu solicitud
    </p>

    <!-- Info del ticket -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <h2 style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 8px;">${ticket.titulo}</h2>
      ${ticket.detalle ? `<p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${ticket.detalle}</p>` : ""}
      <div style="display: flex; gap: 24px; flex-wrap: wrap;">
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Ticket</span>
          <div style="color: #e5e7eb; font-size: 14px; font-weight: 600;">#${ticket.id}</div>
        </div>
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Creado</span>
          <div style="color: #e5e7eb; font-size: 14px;">${fechaCreacion}</div>
        </div>
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Completado</span>
          <div style="color: #10b981; font-size: 14px; font-weight: 600;">${fechaFin}</div>
        </div>
      </div>
    </div>

    <!-- Responsable -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Responsable</span>
      <div style="color: #ffffff; font-size: 15px; font-weight: 600; margin-top: 4px;">${miembro.nombre}</div>
      ${miembro.puesto ? `<div style="color: #9ca3af; font-size: 13px;">${miembro.puesto}</div>` : ""}
    </div>

    <!-- Servicios -->
    <div style="margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 15px; font-weight: 600; margin: 0 0 12px;">Servicios realizados</h3>
      <table style="width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
        <thead>
          <tr style="background: rgba(255,255,255,0.05);">
            <th style="padding: 10px 12px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">Servicio</th>
            <th style="padding: 10px 12px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">Horas</th>
            <th style="padding: 10px 12px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Costo</th>
          </tr>
        </thead>
        <tbody>
          ${accionesHtml}
        </tbody>
      </table>
    </div>

    <!-- Totales -->
    <div style="background: rgba(220, 38, 38, 0.08); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(220, 38, 38, 0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="color: #d1d5db; font-size: 14px;">Total horas</span>
        <span style="color: #ffffff; font-size: 16px; font-weight: 700;">${totalHoras}h</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #d1d5db; font-size: 14px;">Total costo</span>
        <span style="color: #ffffff; font-size: 20px; font-weight: 700;">$${totalCosto.toFixed(2)}</span>
      </div>
    </div>

    <!-- Sesiones -->
    <div style="margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 15px; font-weight: 600; margin: 0 0 12px;">Sesiones completadas</h3>
      <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 12px 16px; border: 1px solid rgba(255,255,255,0.05);">
        ${slotsHtml}
      </div>
    </div>

    <!-- Nota final -->
    <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center; margin: 32px 0 0;">
      Gracias por confiar en <strong style="color: #dc2626;">Corazones Cruzados</strong>. Si tienes alguna pregunta sobre este reporte, no dudes en contactarnos.
    </p>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `✅ Ticket #${ticket.id} completado — ${ticket.titulo}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending ticket report email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending ticket report email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Reporte de proyecto completado al cliente
export async function sendProjectCompletedEmail(
  email: string,
  project: {
    id: number;
    titulo: string;
    descripcion?: string;
  },
  requirements: {
    titulo: string;
    descripcion?: string;
    costo?: number;
    completado: boolean;
    creador?: { nombre: string; tipo: string };
    miembro_completado?: { nombre: string };
  }[],
  teamMembers: {
    nombre: string;
    monto_acordado?: number;
  }[],
  clienteNombre?: string
) {
  const projectUrl = `${APP_URL}/dashboard/projects/${project.id}`;

  const totalCosto = requirements.reduce((sum, r) => sum + Number(r.costo || 0), 0);
  const totalReqs = requirements.length;
  const completedReqs = requirements.filter(r => r.completado).length;

  const requirementsHtml = requirements.length > 0
    ? requirements.map((r) => `
        <tr>
          <td style="padding: 12px; color: #e5e7eb; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div style="font-weight: 600;">${r.titulo}</div>
            ${r.descripcion ? `<div style="color: #9ca3af; font-size: 13px; margin-top: 4px;">${r.descripcion}</div>` : ""}
            <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
              ${r.creador ? `<span style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Creado por: ${r.creador.nombre}</span>` : ""}
              ${r.completado && r.miembro_completado ? `<span style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Completado por: ${r.miembro_completado.nombre}</span>` : ""}
            </div>
          </td>
          <td style="padding: 12px; color: #e5e7eb; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">
            ${r.completado
              ? '<span style="color: #10b981;">✓ Completado</span>'
              : '<span style="color: #fbbf24;">Pendiente</span>'}
          </td>
          <td style="padding: 12px; color: #e5e7eb; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;">
            ${r.costo ? `$${Number(r.costo).toFixed(2)}` : "—"}
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="3" style="padding: 12px; color: #6b7280; font-size: 14px; text-align: center;">Sin requerimientos</td></tr>`;

  const teamHtml = teamMembers.length > 0
    ? teamMembers.map((m) => `
        <div style="display: inline-flex; align-items: center; background: rgba(255,255,255,0.05); padding: 8px 16px; border-radius: 8px; margin: 4px;">
          <span style="color: #e5e7eb; font-size: 14px; font-weight: 500;">${m.nombre}</span>
          ${m.monto_acordado ? `<span style="color: #10b981; font-size: 13px; margin-left: 8px;">$${Number(m.monto_acordado).toFixed(2)}</span>` : ""}
        </div>
      `).join("")
    : `<span style="color: #6b7280; font-size: 14px;">Sin equipo asignado</span>`;

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">🎉</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      ¡Proyecto Completado!
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Tu proyecto ha sido finalizado exitosamente
    </p>

    <!-- Saludo -->
    ${clienteNombre ? `<p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,</p>` : ""}

    <!-- Info del proyecto -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <h2 style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 8px;">${project.titulo}</h2>
      ${project.descripcion ? `<p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${project.descripcion}</p>` : ""}
      <div style="display: flex; gap: 24px; flex-wrap: wrap;">
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Proyecto</span>
          <div style="color: #e5e7eb; font-size: 14px; font-weight: 600;">#${project.id}</div>
        </div>
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Estado</span>
          <div style="color: #10b981; font-size: 14px; font-weight: 600;">Completado</div>
        </div>
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Requerimientos</span>
          <div style="color: #e5e7eb; font-size: 14px;">${completedReqs}/${totalReqs} completados</div>
        </div>
      </div>
    </div>

    <!-- Equipo -->
    <div style="margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 15px; font-weight: 600; margin: 0 0 12px;">Equipo de Trabajo</h3>
      <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 12px 16px; border: 1px solid rgba(255,255,255,0.05);">
        ${teamHtml}
      </div>
    </div>

    <!-- Requerimientos -->
    <div style="margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 15px; font-weight: 600; margin: 0 0 12px;">Requerimientos del Proyecto</h3>
      <table style="width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
        <thead>
          <tr style="background: rgba(255,255,255,0.05);">
            <th style="padding: 12px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">Requerimiento</th>
            <th style="padding: 12px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">Estado</th>
            <th style="padding: 12px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Costo</th>
          </tr>
        </thead>
        <tbody>
          ${requirementsHtml}
        </tbody>
      </table>
    </div>

    <!-- Total -->
    ${totalCosto > 0 ? `
    <div style="background: rgba(16, 185, 129, 0.08); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(16, 185, 129, 0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #d1d5db; font-size: 14px;">Costo total de requerimientos</span>
        <span style="color: #ffffff; font-size: 20px; font-weight: 700;">$${totalCosto.toFixed(2)}</span>
      </div>
    </div>
    ` : ""}

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${projectUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver Proyecto Completo
      </a>
    </div>

    <!-- Nota final -->
    <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center; margin: 32px 0 0;">
      Gracias por confiar en <strong style="color: #dc2626;">Corazones Cruzados</strong>. Esperamos volver a trabajar contigo pronto.
    </p>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `🎉 Proyecto #${project.id} completado — ${project.titulo}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending project completed email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending project completed email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Función genérica para enviar notificaciones
export async function sendNotificationEmail(
  email: string,
  subject: string,
  title: string,
  message: string,
  buttonText?: string,
  buttonUrl?: string,
  icon: string = "📬"
) {
  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(220, 38, 38, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">${icon}</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 32px;">
      ${title}
    </h1>

    <!-- Mensaje -->
    <div style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 32px;">
      ${message}
    </div>

    ${buttonText && buttonUrl ? `
    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${buttonUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        ${buttonText}
      </a>
    </div>
    ` : ""}
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${icon} ${subject}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending notification email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending notification email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}
