"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useInvoice } from "@/lib/hooks/useInvoices";
import { useAuth } from "@/lib/AuthProvider";
import ticketStyles from "@/app/styles/Tickets.module.css";
import styles from "@/app/styles/Invoices.module.css";

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" x2="11" y1="2" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "pendiente":
      return styles.statusPendiente;
    case "enviada":
      return styles.statusEnviada;
    case "pagada":
      return styles.statusPagada;
    case "cancelada":
      return styles.statusCancelada;
    default:
      return styles.statusPendiente;
  }
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "enviada":
      return "Enviada";
    case "pagada":
      return "Pagada";
    case "cancelada":
      return "Cancelada";
    default:
      return estado;
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const { profile } = useAuth();
  const invoiceId = params?.id ? parseInt(params.id as string, 10) : null;
  const { invoice, items, loading, error, updateInvoice } = useInvoice(invoiceId);
  const [updating, setUpdating] = useState(false);

  const userRole = profile?.rol || "cliente";
  const isMember = userRole === "miembro" || userRole === "admin";

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    const result = await updateInvoice({ estado: newStatus });
    if (result.error) {
      alert(result.error);
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className={ticketStyles.loadingState}>
          <div className={ticketStyles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando factura...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !invoice) {
    return (
      <DashboardLayout>
        <div className={styles.detailPage}>
          <Link href="/dashboard/invoices" className={ticketStyles.backButton}>
            <ArrowLeftIcon />
            Volver a facturas
          </Link>
          <div className={ticketStyles.emptyState}>
            <h3 className={ticketStyles.emptyTitle}>Factura no encontrada</h3>
            <p className={ticketStyles.emptyText}>
              {error || "La factura que buscas no existe o no tienes acceso."}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.detailPage}>
        {/* Back Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <Link href="/dashboard/invoices" className={ticketStyles.backButton}>
            <ArrowLeftIcon />
            Volver a facturas
          </Link>
          <span className={`${styles.invoiceStatus} ${getStatusClass(invoice.estado)}`} style={{ fontSize: "0.9rem" }}>
            {getStatusLabel(invoice.estado)}
          </span>
        </div>

        {/* Invoice Document */}
        <div className={styles.invoiceDocument}>
          {/* Header */}
          <div className={styles.invoiceHeader}>
            <div className={styles.invoiceLogo}>
              <img src="/favicon.ico" alt="Logo" className={styles.logoImage} />
              <span className={styles.companyName}>Corazones Cruzados</span>
            </div>
            <div className={styles.invoiceHeaderRight}>
              <div className={styles.invoiceLabel}>Factura</div>
              <div className={styles.invoiceTitle}>{invoice.numero_factura}</div>
            </div>
          </div>

          {/* Body */}
          <div className={styles.invoiceBody}>
            {/* Parties */}
            <div className={styles.invoiceParties}>
              <div className={styles.party}>
                <div className={styles.partyLabel}>Facturar a</div>
                <div className={styles.partyName}>{invoice.cliente?.nombre}</div>
                <div className={styles.partyEmail}>{invoice.cliente?.correo_electronico}</div>
              </div>
              <div className={styles.party}>
                <div className={styles.partyLabel}>Fechas</div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Emisión: </span>
                  <span style={{ color: "var(--text-primary)" }}>{formatDate(invoice.created_at)}</span>
                </div>
                {invoice.fecha_envio && (
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Envío: </span>
                    <span style={{ color: "var(--text-primary)" }}>{formatDate(invoice.fecha_envio)}</span>
                  </div>
                )}
                {invoice.fecha_pago && (
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Pago: </span>
                    <span style={{ color: "var(--text-primary)" }}>{formatDate(invoice.fecha_pago)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reference */}
            {(invoice.ticket || invoice.project) && (
              <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Referencia: </span>
                <span style={{ color: "var(--text-primary)" }}>
                  {invoice.ticket
                    ? `Ticket #${invoice.ticket.id} - ${invoice.ticket.titulo || "Sin título"}`
                    : `Proyecto: ${invoice.project?.titulo}`}
                </span>
              </div>
            )}

            {/* Items Table */}
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th className={styles.itemQuantity}>Cantidad</th>
                  <th className={styles.itemPrice}>Precio Unit.</th>
                  <th className={styles.itemSubtotal}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.itemDescription}>{item.descripcion}</td>
                      <td className={styles.itemQuantity}>{item.cantidad}</td>
                      <td className={styles.itemPrice}>{formatCurrency(item.precio_unitario)}</td>
                      <td className={styles.itemSubtotal}>{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      No hay items en esta factura
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className={styles.invoiceTotals}>
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Subtotal</span>
                <span className={styles.totalValue}>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Impuestos</span>
                <span className={styles.totalValue}>{formatCurrency(invoice.impuestos)}</span>
              </div>
              <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                <span className={styles.totalLabel}>Total</span>
                <span className={styles.totalValue}>{formatCurrency(invoice.total)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notas && (
              <div className={styles.invoiceNotes}>
                <div className={styles.notesLabel}>Notas</div>
                <p className={styles.notesText}>{invoice.notas}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={styles.invoiceFooter}>
            Gracias por su preferencia
          </div>
        </div>

        {/* Actions */}
        {isMember && invoice.estado !== "pagada" && invoice.estado !== "cancelada" && (
          <div className={styles.actionsSidebar}>
            <div className={styles.actionsCard}>
              <div className={styles.actionsTitle}>Acciones</div>

              {invoice.estado === "pendiente" && (
                <button
                  className={`${styles.actionButton} ${styles.primaryAction}`}
                  onClick={() => handleStatusChange("enviada")}
                  disabled={updating}
                >
                  <SendIcon />
                  {updating ? "Enviando..." : "Marcar como Enviada"}
                </button>
              )}

              {(invoice.estado === "pendiente" || invoice.estado === "enviada") && (
                <button
                  className={`${styles.actionButton} ${styles.primaryAction}`}
                  onClick={() => handleStatusChange("pagada")}
                  disabled={updating}
                >
                  <CheckIcon />
                  {updating ? "Procesando..." : "Marcar como Pagada"}
                </button>
              )}

              <button
                className={`${styles.actionButton} ${styles.secondaryAction}`}
                onClick={() => window.print()}
              >
                <DownloadIcon />
                Imprimir / Descargar PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
