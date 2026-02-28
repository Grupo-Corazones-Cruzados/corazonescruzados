"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, Spinner, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { INVOICE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";
import styles from "./page.module.css";

interface InvoiceDetail {
  id: number;
  invoice_number: string | null;
  client_id: number | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  member_name: string | null;
  ticket_id: number | null;
  project_id: number | null;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  notes: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  items: {
    id: number;
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "sent", label: "Enviada" },
  { value: "paid", label: "Pagada" },
  { value: "cancelled", label: "Cancelada" },
];

const BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  sent: "info",
  paid: "success",
  cancelled: "error",
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const invoiceId = Number(params.id);

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editStatus, setEditStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setInvoice(json.data);
      setEditStatus(json.data.status);
    } catch {
      toast("Error al cargar factura", "error");
      router.push("/dashboard/invoices");
    } finally {
      setLoading(false);
    }
  }, [invoiceId, toast, router]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleStatusChange = async () => {
    if (!invoice || editStatus === invoice.status) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus }),
      });
      if (!res.ok) throw new Error();
      toast("Estado actualizado", "success");
      fetchInvoice();
    } catch {
      toast("Error", "error");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta factura?")) return;
    try {
      await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      toast("Factura eliminada", "success");
      router.push("/dashboard/invoices");
    } catch {
      toast("Error", "error");
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div>
      <PageHeader
        title={`Factura ${invoice.invoice_number || `#${invoice.id}`}`}
        description={`Para ${invoice.client_name || "—"}`}
        action={
          <div className={styles.headerActions}>
            <Button variant="ghost" onClick={() => router.push("/dashboard/invoices")}>
              Volver
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        }
      />

      <div className={styles.grid}>
        <div className={styles.main}>
          {/* Status */}
          <Card>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Estado</h3>
              <Badge variant={BADGE_VARIANT[invoice.status] || "default"}>
                {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
              </Badge>
            </div>
            <div className={styles.statusRow}>
              <Select
                options={STATUS_OPTIONS}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleStatusChange}
                isLoading={savingStatus}
                disabled={editStatus === invoice.status}
              >
                Actualizar
              </Button>
            </div>
          </Card>

          {/* Items */}
          <Card>
            <h3 className={styles.cardTitle}>Conceptos</h3>
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Cant.</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td>{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Subtotal</td>
                  <td>{formatCurrency(invoice.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>Impuesto</td>
                  <td>{formatCurrency(invoice.tax)}</td>
                </tr>
                <tr className={styles.totalRow}>
                  <td colSpan={3}>Total</td>
                  <td>{formatCurrency(invoice.total)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <h3 className={styles.cardTitle}>Notas</h3>
              <p className={styles.notes}>{invoice.notes}</p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <Card>
            <h3 className={styles.cardTitle}>Detalles</h3>
            <div className={styles.detailList}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Cliente</span>
                <span className={styles.detailValue}>{invoice.client_name || "—"}</span>
              </div>
              {invoice.client_email && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Email</span>
                  <span className={styles.detailValue}>{invoice.client_email}</span>
                </div>
              )}
              {invoice.client_company && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Empresa</span>
                  <span className={styles.detailValue}>{invoice.client_company}</span>
                </div>
              )}
              {invoice.member_name && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Miembro</span>
                  <span className={styles.detailValue}>{invoice.member_name}</span>
                </div>
              )}
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Creada</span>
                <span className={styles.detailValue}>{formatDate(invoice.created_at)}</span>
              </div>
              {invoice.sent_at && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Enviada</span>
                  <span className={styles.detailValue}>{formatDate(invoice.sent_at)}</span>
                </div>
              )}
              {invoice.paid_at && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Pagada</span>
                  <span className={styles.detailValue}>{formatDate(invoice.paid_at)}</span>
                </div>
              )}
            </div>
          </Card>

          {invoice.ticket_id && (
            <Card>
              <h3 className={styles.cardTitle}>Vinculada a</h3>
              <Button
                variant="secondary"
                size="sm"
                style={{ width: "100%" }}
                onClick={() => router.push(`/dashboard/tickets/${invoice.ticket_id}`)}
              >
                Ver Ticket #{invoice.ticket_id}
              </Button>
            </Card>
          )}

          {invoice.project_id && (
            <Card>
              <h3 className={styles.cardTitle}>Vinculada a</h3>
              <Button
                variant="secondary"
                size="sm"
                style={{ width: "100%" }}
                onClick={() => router.push(`/dashboard/projects/${invoice.project_id}`)}
              >
                Ver Proyecto #{invoice.project_id}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
