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

// Notificar al cliente externo cuando se crea un proyecto
export async function sendProjectCreatedToExternalClient(
  email: string,
  clienteNombre: string,
  project: {
    id: number;
    titulo: string;
    descripcion?: string;
  },
  shareUrl: string,
  creadorNombre: string
) {
  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(59, 130, 246, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">📋</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Nuevo proyecto creado
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      ${creadorNombre} ha creado un proyecto para ti
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      Se ha creado un nuevo proyecto para ti en <strong style="color: #dc2626;">Corazones Cruzados</strong>. Puedes ver todos los detalles y seguir el progreso usando el enlace a continuacion.
    </p>

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
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Creado por</span>
          <div style="color: #e5e7eb; font-size: 14px;">${creadorNombre}</div>
        </div>
      </div>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${shareUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver Proyecto
      </a>
    </div>

    <!-- Info adicional -->
    <div style="background: rgba(59, 130, 246, 0.08); border-radius: 10px; padding: 16px 20px; margin-top: 32px; border: 1px solid rgba(59, 130, 246, 0.2);">
      <p style="color: #93c5fd; font-size: 13px; margin: 0 0 8px;">
        <span>💡</span> <strong>Nota:</strong>
      </p>
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        Este enlace te permite ver el proyecto sin necesidad de crear una cuenta. Guarda este correo para acceder cuando lo necesites.
      </p>
    </div>

    <!-- Link alternativo -->
    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05);">
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px;">
        Si el boton no funciona, copia y pega este enlace:
      </p>
      <p style="margin: 0;">
        <a href="${shareUrl}" style="color: #60a5fa; font-size: 12px; word-break: break-all; text-decoration: none;">${shareUrl}</a>
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `📋 Nuevo proyecto: ${project.titulo} — Corazones Cruzados`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending project created email to external client:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending project created email to external client:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Notificar al cliente externo cuando cambia el estado del proyecto
export async function sendProjectStateChangeEmail(
  email: string,
  clienteNombre: string,
  project: {
    id: number;
    titulo: string;
  },
  estadoAnterior: string,
  nuevoEstado: string,
  shareUrl: string
) {
  // Mapeo de estados a labels en español
  const estadoLabels: Record<string, string> = {
    borrador: "Borrador",
    publicado: "Publicado",
    planificado: "Planificado",
    iniciado: "Iniciado",
    en_progreso: "En Progreso",
    en_implementacion: "En Implementación",
    en_pruebas: "En Pruebas",
    completado: "Completado",
    completado_parcial: "Completado Parcial",
    no_completado: "No Completado",
    cancelado: "Cancelado",
    cancelado_sin_acuerdo: "Cancelado - Sin Acuerdo",
    cancelado_sin_presupuesto: "Cancelado - Sin Presupuesto",
  };

  const estadoAnteriorLabel = estadoLabels[estadoAnterior] || estadoAnterior;
  const nuevoEstadoLabel = estadoLabels[nuevoEstado] || nuevoEstado;

  // Determinar icono y color según el nuevo estado
  let icon = "🔄";
  let iconBg = "rgba(59, 130, 246, 0.15)";
  if (nuevoEstado === "completado") {
    icon = "✅";
    iconBg = "rgba(16, 185, 129, 0.15)";
  } else if (nuevoEstado.startsWith("cancelado") || nuevoEstado === "no_completado") {
    icon = "⚠️";
    iconBg = "rgba(251, 191, 36, 0.15)";
  } else if (nuevoEstado === "en_implementacion" || nuevoEstado === "en_pruebas") {
    icon = "⚙️";
    iconBg = "rgba(139, 92, 246, 0.15)";
  }

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: ${iconBg}; border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">${icon}</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Actualizacion de proyecto
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      El estado de tu proyecto ha cambiado
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      El proyecto <strong style="color: #ffffff;">${project.titulo}</strong> ha cambiado de estado.
    </p>

    <!-- Cambio de estado -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <div style="display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap;">
        <div style="text-align: center;">
          <span style="color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Estado anterior</span>
          <span style="background: rgba(107, 114, 128, 0.2); color: #9ca3af; padding: 6px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">${estadoAnteriorLabel}</span>
        </div>
        <span style="color: #6b7280; font-size: 20px;">→</span>
        <div style="text-align: center;">
          <span style="color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Nuevo estado</span>
          <span style="background: rgba(220, 38, 38, 0.2); color: #fca5a5; padding: 6px 16px; border-radius: 6px; font-size: 14px; font-weight: 600;">${nuevoEstadoLabel}</span>
        </div>
      </div>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${shareUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver Proyecto
      </a>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${icon} Proyecto actualizado: ${project.titulo} — ${nuevoEstadoLabel}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending project state change email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending project state change email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Notificar al cliente externo cuando se completa un requerimiento
export async function sendRequirementCompletedToExternalClient(
  email: string,
  clienteNombre: string,
  project: {
    id: number;
    titulo: string;
  },
  requirement: {
    titulo: string;
    costo?: number;
  },
  completadoPorNombre: string,
  shareUrl: string
) {
  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">✓</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Requerimiento completado
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Se ha completado un entregable de tu proyecto
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      Se ha completado un requerimiento en tu proyecto <strong style="color: #ffffff;">${project.titulo}</strong>.
    </p>

    <!-- Detalle del requerimiento -->
    <div style="background: rgba(16, 185, 129, 0.08); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(16, 185, 129, 0.2);">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <span style="color: #10b981; font-size: 20px;">✓</span>
        <div style="flex: 1;">
          <h3 style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 8px;">${requirement.titulo}</h3>
          <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            <span style="color: #9ca3af; font-size: 13px;">
              Completado por: <strong style="color: #e5e7eb;">${completadoPorNombre}</strong>
            </span>
            ${requirement.costo ? `<span style="color: #9ca3af; font-size: 13px;">Costo: <strong style="color: #10b981;">$${Number(requirement.costo).toFixed(2)}</strong></span>` : ""}
          </div>
        </div>
      </div>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${shareUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver Proyecto
      </a>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `✓ Requerimiento completado: ${requirement.titulo} — ${project.titulo}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending requirement completed email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending requirement completed email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Notificar a un miembro que fue removido del proyecto
export async function sendParticipantRemovedEmail(
  email: string,
  miembroNombre: string,
  project: {
    id: number;
    titulo: string;
  },
  motivo: string,
  removidoPorNombre: string
) {
  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(239, 68, 68, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">⚠️</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Remocion de proyecto
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Has sido removido de un proyecto
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${miembroNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      Lamentamos informarte que has sido removido del proyecto <strong style="color: #ffffff;">${project.titulo}</strong>.
    </p>

    <!-- Detalle -->
    <div style="background: rgba(239, 68, 68, 0.08); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(239, 68, 68, 0.2);">
      <div style="margin-bottom: 16px;">
        <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Proyecto</span>
        <div style="color: #e5e7eb; font-size: 15px; font-weight: 600;">${project.titulo}</div>
      </div>
      <div style="margin-bottom: 16px;">
        <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Removido por</span>
        <div style="color: #e5e7eb; font-size: 14px;">${removidoPorNombre}</div>
      </div>
      <div>
        <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Motivo</span>
        <div style="color: #fca5a5; font-size: 14px; margin-top: 4px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 6px; line-height: 1.6;">${motivo}</div>
      </div>
    </div>

    <!-- Info adicional -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 16px 20px; margin-top: 32px; border: 1px solid rgba(255,255,255,0.05);">
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        Si crees que esto es un error o tienes alguna pregunta, por favor contacta con el soporte de Corazones Cruzados.
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `⚠️ Has sido removido del proyecto: ${project.titulo}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending participant removed email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending participant removed email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// ================================================
// PACKAGE SYSTEM EMAILS
// ================================================

// Email 1: Confirmacion de compra de paquete al cliente
export async function sendPackagePurchaseConfirmation(
  email: string,
  clienteNombre: string,
  paquete: {
    id: number;
    nombre: string;
    horas: number;
    descripcion?: string;
  },
  miembroNombre: string
) {
  const packageUrl = `${APP_URL}/dashboard/mis-paquetes/${paquete.id}`;

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">📦</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      ¡Compra registrada!
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Tu solicitud de paquete ha sido enviada
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      Hemos recibido tu solicitud de compra del paquete <strong style="color: #ffffff;">${paquete.nombre}</strong> con <strong style="color: #10b981;">${miembroNombre}</strong>.
    </p>

    <!-- Detalle del paquete -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <h3 style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 12px;">${paquete.nombre}</h3>
      ${paquete.descripcion ? `<p style="color: #9ca3af; font-size: 14px; margin: 0 0 12px;">${paquete.descripcion}</p>` : ""}
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Horas incluidas</span>
          <div style="color: #10b981; font-size: 18px; font-weight: 700;">${paquete.horas}h</div>
        </div>
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Miembro</span>
          <div style="color: #e5e7eb; font-size: 14px;">${miembroNombre}</div>
        </div>
      </div>
    </div>

    <!-- Proximos pasos -->
    <div style="background: rgba(251, 191, 36, 0.08); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(251, 191, 36, 0.2);">
      <p style="color: #fbbf24; font-size: 13px; margin: 0 0 8px;">
        <span>⏳</span> <strong>Proximos pasos:</strong>
      </p>
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        ${miembroNombre} revisara tu solicitud y te confirmara la disponibilidad. Te notificaremos cuando haya una respuesta.
      </p>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${packageUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver mi paquete
      </a>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `📦 Compra registrada: ${paquete.nombre} — Corazones Cruzados`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending package purchase confirmation:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending package purchase confirmation:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Email 2: Notificacion de nueva solicitud al miembro
export async function sendPackageRequestToMember(
  email: string,
  miembroNombre: string,
  paquete: {
    id: number;
    nombre: string;
    horas: number;
  },
  clienteNombre: string,
  notasCliente?: string
) {
  const packageUrl = `${APP_URL}/dashboard/miembro/mis-paquetes`;

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(59, 130, 246, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">🔔</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Nueva solicitud de paquete
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Un cliente quiere trabajar contigo
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${miembroNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      <strong style="color: #ffffff;">${clienteNombre}</strong> ha solicitado el paquete <strong style="color: #10b981;">${paquete.nombre}</strong> (${paquete.horas}h).
    </p>

    ${notasCliente ? `
    <!-- Notas del cliente -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Notas del cliente</span>
      <p style="color: #e5e7eb; font-size: 14px; margin: 8px 0 0; line-height: 1.6;">${notasCliente}</p>
    </div>
    ` : ""}

    <!-- Acciones -->
    <div style="background: rgba(16, 185, 129, 0.08); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(16, 185, 129, 0.2);">
      <p style="color: #10b981; font-size: 13px; margin: 0 0 8px;">
        <strong>Responde a la solicitud:</strong>
      </p>
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        Ingresa a "Mis Paquetes" para aprobar, rechazar o poner en espera esta solicitud.
      </p>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${packageUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver Mis Paquetes
      </a>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `🔔 Nueva solicitud: ${paquete.nombre} de ${clienteNombre}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending package request to member:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending package request to member:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Email 3: Paquete aprobado - notificacion al cliente
export async function sendPackageApprovedToClient(
  email: string,
  clienteNombre: string,
  paquete: { id: number; nombre: string },
  miembroNombre: string
) {
  const packageUrl = `${APP_URL}/dashboard/mis-paquetes/${paquete.id}`;

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">✅</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      ¡Paquete aprobado!
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Ya puedes agendar tus sesiones
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      <strong style="color: #10b981;">${miembroNombre}</strong> ha aprobado tu solicitud del paquete <strong style="color: #ffffff;">${paquete.nombre}</strong>.
    </p>

    <!-- Proximos pasos -->
    <div style="background: rgba(16, 185, 129, 0.08); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(16, 185, 129, 0.2);">
      <p style="color: #10b981; font-size: 13px; margin: 0 0 8px;">
        <strong>¡Ya puedes comenzar!</strong>
      </p>
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        Ingresa a tu paquete para ver la disponibilidad del miembro y agendar tus sesiones.
      </p>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${packageUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
        Agendar Sesiones
      </a>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `✅ Paquete aprobado: ${paquete.nombre} — Corazones Cruzados`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending package approved email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending package approved email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Email 4: Paquete rechazado - notificacion al cliente
export async function sendPackageRejectedToClient(
  email: string,
  clienteNombre: string,
  paquete: { id: number; nombre: string },
  miembroNombre: string,
  motivo?: string
) {
  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(239, 68, 68, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">❌</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Solicitud no aprobada
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      El miembro no puede atender tu solicitud en este momento
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      Lamentamos informarte que <strong style="color: #ffffff;">${miembroNombre}</strong> no ha podido aprobar tu solicitud del paquete <strong style="color: #ffffff;">${paquete.nombre}</strong>.
    </p>

    ${motivo ? `
    <!-- Motivo -->
    <div style="background: rgba(239, 68, 68, 0.08); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(239, 68, 68, 0.2);">
      <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Motivo</span>
      <p style="color: #fca5a5; font-size: 14px; margin: 8px 0 0; line-height: 1.6;">${motivo}</p>
    </div>
    ` : ""}

    <!-- Sugerencia -->
    <div style="background: rgba(59, 130, 246, 0.08); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(59, 130, 246, 0.2);">
      <p style="color: #93c5fd; font-size: 13px; margin: 0;">
        <span>💡</span> Te sugerimos explorar otros miembros disponibles que puedan ayudarte con tu proyecto.
      </p>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${APP_URL}/dashboard/paquetes/comprar" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver otros miembros
      </a>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `❌ Solicitud no aprobada: ${paquete.nombre} — Corazones Cruzados`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending package rejected email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending package rejected email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Email 5: Paquete en espera - notificacion al cliente
export async function sendPackageOnHoldToClient(
  email: string,
  clienteNombre: string,
  paquete: { id: number; nombre: string },
  miembroNombre: string,
  motivo?: string
) {
  const packageUrl = `${APP_URL}/dashboard/mis-paquetes/${paquete.id}`;

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(251, 191, 36, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">⏸️</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Solicitud en espera
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Tu solicitud esta siendo revisada
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      <strong style="color: #ffffff;">${miembroNombre}</strong> ha puesto en espera tu solicitud del paquete <strong style="color: #ffffff;">${paquete.nombre}</strong>.
    </p>

    ${motivo ? `
    <!-- Motivo -->
    <div style="background: rgba(251, 191, 36, 0.08); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(251, 191, 36, 0.2);">
      <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Motivo</span>
      <p style="color: #fbbf24; font-size: 14px; margin: 8px 0 0; line-height: 1.6;">${motivo}</p>
    </div>
    ` : ""}

    <!-- Info -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        Te notificaremos cuando el miembro actualice el estado de tu solicitud. No necesitas hacer nada por ahora.
      </p>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${packageUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver mi paquete
      </a>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `⏸️ Solicitud en espera: ${paquete.nombre} — Corazones Cruzados`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending package on hold email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending package on hold email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Email 6: Sesion agendada - notificacion al miembro
export async function sendSessionScheduledToMember(
  email: string,
  miembroNombre: string,
  session: {
    id: number;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    duracion_horas: number;
  },
  clienteNombre: string,
  paqueteNombre: string
) {
  const packageUrl = `${APP_URL}/dashboard/miembro/mis-paquetes`;
  const fechaFormateada = new Date(session.fecha).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(59, 130, 246, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">📅</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Nueva sesion agendada
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Un cliente ha programado una sesion contigo
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${miembroNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      <strong style="color: #ffffff;">${clienteNombre}</strong> ha agendado una sesion para el paquete <strong style="color: #10b981;">${paqueteNombre}</strong>.
    </p>

    <!-- Detalle de sesion -->
    <div style="background: rgba(59, 130, 246, 0.08); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(59, 130, 246, 0.2);">
      <div style="display: flex; gap: 24px; flex-wrap: wrap;">
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Fecha</span>
          <div style="color: #e5e7eb; font-size: 15px; font-weight: 600;">${fechaFormateada}</div>
        </div>
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Horario</span>
          <div style="color: #e5e7eb; font-size: 15px; font-weight: 600;">${session.hora_inicio.slice(0, 5)} - ${session.hora_fin.slice(0, 5)}</div>
        </div>
        <div>
          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Duracion</span>
          <div style="color: #93c5fd; font-size: 15px; font-weight: 600;">${session.duracion_horas}h</div>
        </div>
      </div>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${packageUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver mis paquetes
      </a>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `📅 Nueva sesion: ${fechaFormateada} — ${clienteNombre}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending session scheduled email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending session scheduled email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Email 7: Sesion completada - notificacion al cliente
export async function sendSessionCompletedToClient(
  email: string,
  clienteNombre: string,
  session: {
    id: number;
    fecha: string;
    duracion_horas: number;
  },
  miembroNombre: string,
  paqueteNombre: string,
  horasRestantes: number,
  notas?: string
) {
  const packageUrl = `${APP_URL}/dashboard/mis-paquetes`;
  const fechaFormateada = new Date(session.fecha).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
  });

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">✓</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Sesion completada
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Tu trabajo ha sido registrado
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      <strong style="color: #10b981;">${miembroNombre}</strong> ha marcado como completada la sesion del <strong>${fechaFormateada}</strong> del paquete <strong>${paqueteNombre}</strong>.
    </p>

    <!-- Resumen -->
    <div style="background: rgba(16, 185, 129, 0.08); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(16, 185, 129, 0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="color: #9ca3af; font-size: 14px;">Horas de esta sesion</span>
        <span style="color: #10b981; font-size: 16px; font-weight: 700;">${session.duracion_horas}h</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #9ca3af; font-size: 14px;">Horas restantes del paquete</span>
        <span style="color: #ffffff; font-size: 18px; font-weight: 700;">${horasRestantes.toFixed(2)}h</span>
      </div>
    </div>

    ${notas ? `
    <!-- Notas del miembro -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Notas del miembro</span>
      <p style="color: #e5e7eb; font-size: 14px; margin: 8px 0 0; line-height: 1.6;">${notas}</p>
    </div>
    ` : ""}

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${packageUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Ver mi paquete
      </a>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `✓ Sesion completada: ${paqueteNombre} — ${fechaFormateada}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending session completed email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending session completed email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Email 8: Solicitud de cambio de fecha - notificacion al cliente
export async function sendDateChangeRequestToClient(
  email: string,
  clienteNombre: string,
  session: {
    id: number;
    fecha_original: string;
    hora_original: string;
    nueva_fecha: string;
    nueva_hora: string;
  },
  miembroNombre: string,
  paqueteNombre: string,
  motivo: string
) {
  const packageUrl = `${APP_URL}/dashboard/mis-paquetes`;
  const fechaOriginal = new Date(session.fecha_original).toLocaleDateString("es-EC", { day: "numeric", month: "long" });
  const fechaNueva = new Date(session.nueva_fecha).toLocaleDateString("es-EC", { day: "numeric", month: "long" });

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(251, 191, 36, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">🔄</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      Solicitud de cambio de fecha
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      El miembro necesita reprogramar una sesion
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      <strong style="color: #ffffff;">${miembroNombre}</strong> solicita cambiar la fecha de una sesion del paquete <strong>${paqueteNombre}</strong>.
    </p>

    <!-- Cambio propuesto -->
    <div style="background: rgba(251, 191, 36, 0.08); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(251, 191, 36, 0.2);">
      <div style="display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap;">
        <div style="text-align: center;">
          <span style="color: #6b7280; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Fecha original</span>
          <span style="background: rgba(107, 114, 128, 0.2); color: #9ca3af; padding: 6px 16px; border-radius: 6px; font-size: 14px;">${fechaOriginal} ${session.hora_original.slice(0, 5)}</span>
        </div>
        <span style="color: #fbbf24; font-size: 20px;">→</span>
        <div style="text-align: center;">
          <span style="color: #6b7280; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Nueva fecha propuesta</span>
          <span style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; padding: 6px 16px; border-radius: 6px; font-size: 14px; font-weight: 600;">${fechaNueva} ${session.nueva_hora.slice(0, 5)}</span>
        </div>
      </div>
    </div>

    <!-- Motivo -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Motivo</span>
      <p style="color: #e5e7eb; font-size: 14px; margin: 8px 0 0; line-height: 1.6;">${motivo}</p>
    </div>

    <!-- Boton -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${packageUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        Responder solicitud
      </a>
    </div>

    <!-- Info -->
    <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
      Ingresa a tu paquete para aceptar o rechazar el cambio de fecha.
    </p>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `🔄 Solicitud de cambio: ${paqueteNombre} — ${miembroNombre}`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending date change request email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending date change request email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Email 9: Paquete completado con reporte - notificacion al cliente
export async function sendPackageCompletedReport(
  email: string,
  clienteNombre: string,
  paquete: {
    id: number;
    nombre: string;
    descripcion?: string;
    horas_totales: number;
    horas_consumidas: number;
  },
  miembroNombre: string,
  sessions: {
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    duracion_horas: number;
  }[],
  reporte?: string
) {
  const sessionsHtml = sessions.length > 0
    ? sessions.map((s) => {
        const fecha = new Date(s.fecha).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
        return `<span style="display: inline-block; background: rgba(16, 185, 129, 0.12); color: #6ee7b7; padding: 4px 10px; border-radius: 6px; font-size: 12px; margin: 2px 4px;">${fecha} ${s.hora_inicio.slice(0, 5)}-${s.hora_fin.slice(0, 5)} (${s.duracion_horas}h)</span>`;
      }).join("")
    : `<span style="color: #6b7280; font-size: 13px;">Sin sesiones registradas</span>`;

  const content = `
    <!-- Icono -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; line-height: 64px;">
        <span style="font-size: 28px;">🎉</span>
      </div>
    </div>

    <!-- Titulo -->
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 8px;">
      ¡Paquete completado!
    </h1>
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 32px;">
      Reporte final de tu paquete
    </p>

    <!-- Saludo -->
    <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 24px;">
      Hola <strong style="color: #ffffff;">${clienteNombre}</strong>,
    </p>

    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      Tu paquete <strong style="color: #ffffff;">${paquete.nombre}</strong> con <strong style="color: #10b981;">${miembroNombre}</strong> ha sido completado.
    </p>

    <!-- Resumen de horas -->
    <div style="background: rgba(16, 185, 129, 0.08); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(16, 185, 129, 0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="color: #9ca3af; font-size: 14px;">Horas contratadas</span>
        <span style="color: #e5e7eb; font-size: 16px;">${paquete.horas_totales}h</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #9ca3af; font-size: 14px;">Horas utilizadas</span>
        <span style="color: #10b981; font-size: 20px; font-weight: 700;">${Number(paquete.horas_consumidas).toFixed(2)}h</span>
      </div>
    </div>

    <!-- Sesiones -->
    <div style="margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 15px; font-weight: 600; margin: 0 0 12px;">Sesiones realizadas</h3>
      <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 12px 16px; border: 1px solid rgba(255,255,255,0.05);">
        ${sessionsHtml}
      </div>
    </div>

    ${reporte ? `
    <!-- Reporte del miembro -->
    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
      <h3 style="color: #ffffff; font-size: 15px; font-weight: 600; margin: 0 0 12px;">Reporte del miembro</h3>
      <p style="color: #d1d5db; font-size: 14px; line-height: 1.7; margin: 0; white-space: pre-wrap;">${reporte}</p>
    </div>
    ` : ""}

    <!-- Nota final -->
    <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center; margin: 32px 0 0;">
      Gracias por confiar en <strong style="color: #dc2626;">Corazones Cruzados</strong>. Esperamos volver a trabajar contigo pronto.
    </p>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `🎉 Paquete completado: ${paquete.nombre} — Corazones Cruzados`,
      html: getEmailTemplate(content),
    });

    if (error) {
      console.error("Error sending package completed report:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending package completed report:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}
