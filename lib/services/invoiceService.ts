"use client";

export async function generateInvoiceFromTicket(ticketId: number) {
  try {
    const response = await fetch("/api/invoices/generate-from-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error al generar la factura");
    }

    return { invoice: data.invoice, error: null };
  } catch (err) {
    console.error("Error generating invoice from ticket:", err);
    return { invoice: null, error: "Error al generar la factura" };
  }
}

export async function generateInvoiceFromProject(projectId: number) {
  try {
    const response = await fetch("/api/invoices/generate-from-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error al generar la factura");
    }

    return { invoice: data.invoice, error: null };
  } catch (err) {
    console.error("Error generating invoice from project:", err);
    return { invoice: null, error: "Error al generar la factura" };
  }
}

export async function sendInvoiceEmail(invoiceId: number) {
  try {
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "enviada" }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error al enviar la factura");
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("Error sending invoice email:", err);
    return { success: false, error: "Error al enviar la factura" };
  }
}

export async function createCalendarEvent(ticketId: number, userId: string) {
  try {
    // This still uses the Google Calendar API route which we're keeping
    const response = await fetch("/api/google/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, userId }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "Error al crear el evento");
    }

    return { eventId: data.eventId, meetLink: data.hangoutLink, error: null };
  } catch (err) {
    console.error("Error creating calendar event:", err);
    return { eventId: null, meetLink: null, error: "Error al crear el evento" };
  }
}
