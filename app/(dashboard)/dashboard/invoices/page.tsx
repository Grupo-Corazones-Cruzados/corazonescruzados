"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, DataTable, Tabs, Input, Spinner, Modal, Select } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { INVOICE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";
import styles from "./page.module.css";

interface InvoiceRow {
  id: number;
  invoice_number: string | null;
  client_name: string | null;
  member_name: string | null;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
}

const STATUS_TABS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "sent", label: "Enviadas" },
  { value: "paid", label: "Pagadas" },
  { value: "cancelled", label: "Canceladas" },
];

const BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  sent: "info",
  paid: "success",
  cancelled: "error",
};

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/invoices?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const columns: Column<InvoiceRow>[] = [
    {
      key: "number",
      header: "Factura",
      render: (r) => (
        <span className={styles.invoiceNumber}>
          {r.invoice_number || `#${r.id}`}
        </span>
      ),
    },
    {
      key: "client",
      header: "Cliente",
      render: (r) => r.client_name || "—",
    },
    {
      key: "total",
      header: "Total",
      render: (r) => <strong>{formatCurrency(r.total)}</strong>,
    },
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <Badge variant={BADGE_VARIANT[r.status] || "default"}>
          {INVOICE_STATUS_LABELS[r.status] || r.status}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      render: (r) => formatDate(r.created_at),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Facturas"
        description="Consulta y gestiona tus facturas."
        action={
          <Button onClick={() => setShowCreate(true)}>Nueva Factura</Button>
        }
      />

      <Tabs
        tabs={STATUS_TABS}
        active={statusFilter}
        onChange={(v) => setStatusFilter(v)}
      />

      <div className={styles.toolbar}>
        <Input
          placeholder="Buscar facturas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          keyExtractor={(r) => r.id}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(r) => router.push(`/dashboard/invoices/${r.id}`)}
          emptyTitle="Sin facturas"
          emptyDescription="No hay facturas que mostrar."
        />
      )}

      <CreateInvoiceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchData();
        }}
        toast={toast}
      />
    </div>
  );
}

// ---- Create Invoice Modal ----

function CreateInvoiceModal({
  open,
  onClose,
  onCreated,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  toast: (m: string, t: "success" | "error") => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<{ value: string; label: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [tax, setTax] = useState("0");
  const [items, setItems] = useState([{ description: "", quantity: "1", unit_price: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/clients?per_page=200")
        .then((r) => r.json())
        .then((json) => {
          setClients(
            (json.data || []).map((c: { id: number; name: string }) => ({
              value: String(c.id),
              label: c.name,
            }))
          );
        })
        .catch(() => {});
    }
  }, [open]);

  const addItem = () => {
    setItems([...items, { description: "", quantity: "1", unit_price: "" }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: string) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || items.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Number(clientId),
          notes: notes || undefined,
          tax: tax ? Number(tax) : 0,
          items: items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
          })),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Factura creada", "success");
      setClientId("");
      setNotes("");
      setTax("0");
      setItems([{ description: "", quantity: "1", unit_price: "" }]);
      onCreated();
    } catch {
      toast("Error al crear factura", "error");
    } finally {
      setSaving(false);
    }
  };

  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );

  return (
    <Modal open={open} onClose={onClose} title="Nueva Factura" size="lg">
      <form onSubmit={handleSubmit} className={styles.form}>
        <Select
          label="Cliente *"
          options={clients}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Seleccionar cliente"
          required
        />

        <div className={styles.itemsSection}>
          <div className={styles.itemsHeader}>
            <span className={styles.itemsTitle}>Conceptos</span>
            <button type="button" className={styles.addItemBtn} onClick={addItem}>
              + Agregar
            </button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className={styles.itemRow}>
              <Input
                placeholder="Descripción *"
                value={item.description}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
                required
              />
              <Input
                placeholder="Qty"
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                required
                className={styles.qtyInput}
              />
              <Input
                placeholder="Precio"
                type="number"
                step="0.01"
                min="0"
                value={item.unit_price}
                onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                required
                className={styles.priceInput}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  className={styles.removeItemBtn}
                  onClick={() => removeItem(idx)}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>

        <div className={styles.totalsRow}>
          <Input
            label="Impuesto"
            type="number"
            step="0.01"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            className={styles.taxInput}
          />
          <div className={styles.totals}>
            <span>Subtotal: {formatCurrency(subtotal)}</span>
            <span>Impuesto: {formatCurrency(Number(tax) || 0)}</span>
            <strong>Total: {formatCurrency(subtotal + (Number(tax) || 0))}</strong>
          </div>
        </div>

        <Input
          label="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear Factura
        </Button>
      </form>
    </Modal>
  );
}
