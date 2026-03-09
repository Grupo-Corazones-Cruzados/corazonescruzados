"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { OrderWithItems } from "@/lib/types";
import styles from "./page.module.css";

export default function ConfirmationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/pending-confirmations");
      const json = await res.json();
      setOrders(json.data || []);
    } catch {
      toast("Error al cargar confirmaciones", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!user || (user.role !== "member" && user.role !== "admin")) {
    return (
      <div>
        <PageHeader title="Confirmaciones" description="No tienes acceso a esta sección." />
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/marketplace" className={styles.backLink}>
        &larr; Volver al Marketplace
      </Link>
      <PageHeader
        title="Confirmaciones Pendientes"
        description="Pedidos que requieren tu confirmación antes de proceder."
      />

      {loading ? (
        <div className={styles.loading}><Spinner /></div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="Sin confirmaciones pendientes"
          description="No tienes pedidos pendientes de confirmación."
        />
      ) : (
        <div className={styles.list}>
          {orders.map((order) => (
            <ConfirmationCard
              key={order.id}
              order={order}
              memberId={user.member_id!}
              onResponded={fetchData}
              toast={toast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmationCard({
  order,
  memberId,
  onResponded,
  toast,
}: {
  order: OrderWithItems;
  memberId: number;
  onResponded: () => void;
  toast: (m: string, t: "success" | "error") => void;
}) {
  const [deliveryDate, setDeliveryDate] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Only show items that belong to this member
  const myItems = order.items.filter(
    (i) => i.member_id === memberId && i.requires_confirmation && i.member_confirmed === null
  );

  const handleSubmit = async (confirmed: boolean) => {
    if (confirmed && !deliveryDate) {
      toast("Debes indicar una fecha de entrega", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/member-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed,
          delivery_date: confirmed ? deliveryDate : undefined,
          message: message || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }

      toast(confirmed ? "Pedido confirmado" : "Pedido rechazado", "success");
      onResponded();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al responder", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (myItems.length === 0) return null;

  return (
    <Card>
      <div className={styles.orderHeader}>
        <span className={styles.orderTitle}>Pedido #{order.id}</span>
        <span className={styles.orderMeta}>{formatDate(order.created_at)}</span>
      </div>

      <div className={styles.clientInfo}>
        <div>
          <div className={styles.clientLabel}>Cliente</div>
          <div className={styles.clientName}>{order.user_name || "—"}</div>
        </div>
        <Badge variant="warning">Pendiente</Badge>
      </div>

      <div className={styles.items}>
        {myItems.map((item) => (
          <div key={item.id} className={styles.item}>
            <span className={styles.itemName}>{item.product_name}</span>
            <span className={styles.itemDetail}>
              {item.quantity} x {formatCurrency(item.unit_price)} = {formatCurrency(item.subtotal)}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.form}>
        <div className={styles.formRow}>
          <label>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              Fecha de entrega estimada
            </span>
            <input
              type="date"
              className={styles.dateInput}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </label>
        </div>
        <textarea
          className={styles.textarea}
          placeholder="Mensaje opcional para el cliente..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            isLoading={submitting}
          >
            Rechazar
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            isLoading={submitting}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </Card>
  );
}
