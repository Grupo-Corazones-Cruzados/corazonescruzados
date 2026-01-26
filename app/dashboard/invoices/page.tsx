"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useInvoices, Invoice } from "@/lib/hooks/useInvoices";
import { useAuth } from "@/lib/AuthProvider";
import ticketStyles from "@/app/styles/Tickets.module.css";
import styles from "@/app/styles/Invoices.module.css";

// Icons
const FileTextIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
  </svg>
);

const EmptyInvoiceIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
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

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const router = useRouter();

  return (
    <article
      className={styles.invoiceCard}
      onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push(`/dashboard/invoices/${invoice.id}`);
        }
      }}
    >
      <div className={styles.invoiceInfo}>
        <div className={styles.invoiceIcon}>
          <FileTextIcon />
        </div>
        <div className={styles.invoiceDetails}>
          <span className={styles.invoiceNumber}>{invoice.numero_factura}</span>
          <span className={styles.invoiceClient}>{invoice.cliente?.nombre}</span>
          <span className={styles.invoiceDate}>{formatDate(invoice.created_at)}</span>
        </div>
      </div>

      <div className={styles.invoiceRight}>
        <span className={styles.invoiceTotal}>{formatCurrency(invoice.total)}</span>
        <span className={`${styles.invoiceStatus} ${getStatusClass(invoice.estado)}`}>
          {getStatusLabel(invoice.estado)}
        </span>
      </div>
    </article>
  );
}

export default function InvoicesPage() {
  const { profile } = useAuth();
  const { invoices, loading, error, refetch } = useInvoices();
  const [filters, setFilters] = useState({
    search: "",
    estado: "todos",
  });

  const userRole = profile?.rol || "cliente";

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        invoice.numero_factura.toLowerCase().includes(searchLower) ||
        invoice.cliente?.nombre.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    if (filters.estado !== "todos" && invoice.estado !== filters.estado) {
      return false;
    }

    return true;
  });

  // Calculate totals
  const totalPendiente = invoices
    .filter((i) => i.estado === "pendiente" || i.estado === "enviada")
    .reduce((sum, i) => sum + i.total, 0);
  const totalPagado = invoices
    .filter((i) => i.estado === "pagada")
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={ticketStyles.pageHeader}>
          <div>
            <h1 className={ticketStyles.pageTitle}>Facturas</h1>
            <p className={ticketStyles.pageSubtitle}>
              {userRole === "cliente"
                ? "Historial de facturas y pagos"
                : "Gestiona tus facturas generadas"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className={ticketStyles.statsGrid}>
          <div className={ticketStyles.statCard}>
            <div className={`${ticketStyles.statIcon} ${ticketStyles.statIconTotal}`}>
              <FileTextIcon />
            </div>
            <div className={ticketStyles.statContent}>
              <div className={ticketStyles.statValue}>{invoices.length}</div>
              <div className={ticketStyles.statLabel}>Total Facturas</div>
            </div>
          </div>

          <div className={ticketStyles.statCard}>
            <div className={`${ticketStyles.statIcon} ${ticketStyles.statIconPending}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className={ticketStyles.statContent}>
              <div className={ticketStyles.statValue}>{formatCurrency(totalPendiente)}</div>
              <div className={ticketStyles.statLabel}>Por Cobrar</div>
            </div>
          </div>

          <div className={ticketStyles.statCard}>
            <div className={`${ticketStyles.statIcon} ${ticketStyles.statIconCompleted}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className={ticketStyles.statContent}>
              <div className={ticketStyles.statValue}>{formatCurrency(totalPagado)}</div>
              <div className={ticketStyles.statLabel}>Cobrado</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={ticketStyles.filtersBar}>
          <input
            type="text"
            placeholder="Buscar por número de factura..."
            className={ticketStyles.searchInput}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />

          <select
            className={ticketStyles.filterSelect}
            value={filters.estado}
            onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="enviada">Enviada</option>
            <option value="pagada">Pagada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className={ticketStyles.loadingState}>
            <div className={ticketStyles.spinner} />
            <p style={{ color: "var(--text-muted)" }}>Cargando facturas...</p>
          </div>
        ) : error ? (
          <div className={ticketStyles.emptyState}>
            <p style={{ color: "var(--primary-red)" }}>{error}</p>
            <button className={ticketStyles.secondaryButton} onClick={() => refetch()}>
              Reintentar
            </button>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className={ticketStyles.emptyState}>
            <EmptyInvoiceIcon />
            <h3 className={ticketStyles.emptyTitle}>
              {filters.search || filters.estado !== "todos"
                ? "No se encontraron facturas"
                : "No hay facturas"}
            </h3>
            <p className={ticketStyles.emptyText}>
              {filters.search || filters.estado !== "todos"
                ? "Intenta con otros filtros de búsqueda"
                : "Las facturas aparecerán aquí cuando se generen"}
            </p>
          </div>
        ) : (
          <div className={styles.invoicesList}>
            {filteredInvoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
