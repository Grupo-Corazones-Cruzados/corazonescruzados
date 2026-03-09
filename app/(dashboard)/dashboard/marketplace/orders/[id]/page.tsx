"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import PageHeader from "@/components/layout/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE } from "@/lib/constants";
import type { OrderWithItems, OrderStatus } from "@/lib/types";
import styles from "./page.module.css";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`);
      const json = await res.json();
      setOrder(json.data || null);
    } catch {
      toast("Error al cargar el pedido", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleClientResponse = async (accepted: boolean) => {
    setResponding(true);
    try {
      const res = await fetch(`/api/orders/${id}/client-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }

      toast(accepted ? "Condiciones aceptadas" : "Pedido rechazado", "success");
      fetchOrder();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al responder", "error");
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}><Spinner /></div>;
  }

  if (!order) {
    return (
      <div>
        <Link href="/dashboard/marketplace" className={styles.backLink}>
          &larr; Volver al Marketplace
        </Link>
        <PageHeader title="Pedido no encontrado" description="" />
      </div>
    );
  }

  const confirmedItems = order.items.filter(
    (i) => i.requires_confirmation && i.member_confirmed === true
  );

  return (
    <div>
      <Link href="/dashboard/marketplace" className={styles.backLink}>
        &larr; Volver al Marketplace
      </Link>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Pedido #{order.id}</h1>
          <Badge variant={ORDER_STATUS_BADGE[order.status as OrderStatus] || "default"}>
            {ORDER_STATUS_LABELS[order.status as OrderStatus] || order.status}
          </Badge>
        </div>
        <span className={styles.date}>{formatDate(order.created_at)}</span>
      </div>

      {/* Items table */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Productos</h2>
        <Card padding="none">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.product_name}
                    {item.requires_confirmation && (
                      <div className={styles.confirmationInfo}>
                        {item.member_name && (
                          <span className={styles.memberInfo}>
                            Miembro: {item.member_name}
                          </span>
                        )}
                        {item.member_confirmed === null && (
                          <Badge variant="warning">Pendiente de confirmación</Badge>
                        )}
                        {item.member_confirmed === true && (
                          <Badge variant="success">Confirmado</Badge>
                        )}
                        {item.member_confirmed === false && (
                          <Badge variant="error">Rechazado</Badge>
                        )}
                        {item.delivery_date && (
                          <span className={styles.confirmationDetail}>
                            Entrega: {formatDate(item.delivery_date)}
                          </span>
                        )}
                        {item.member_message && (
                          <span className={styles.confirmationDetail}>
                            &ldquo;{item.member_message}&rdquo;
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unit_price)}</td>
                  <td>{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td colSpan={3}>Total</td>
                <td>{formatCurrency(order.total)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      {/* Awaiting acceptance: show conditions and accept/reject */}
      {order.status === "awaiting_acceptance" && confirmedItems.length > 0 && (
        <div className={styles.section}>
          <div className={styles.acceptanceBox}>
            <h2 className={styles.acceptanceTitle}>Condiciones del Miembro</h2>
            <p className={styles.acceptanceDesc}>
              Los miembros han confirmado tu pedido con las siguientes condiciones.
              Revisa y acepta para proceder con el pago.
            </p>

            <div className={styles.conditionsList}>
              {confirmedItems.map((item) => (
                <div key={item.id} className={styles.conditionItem}>
                  <div className={styles.conditionMember}>
                    {item.product_name} — {item.member_name}
                  </div>
                  {item.delivery_date && (
                    <div className={styles.conditionDate}>
                      Fecha de entrega estimada: {formatDate(item.delivery_date)}
                    </div>
                  )}
                  {item.member_message && (
                    <div className={styles.conditionMessage}>
                      {item.member_message}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.acceptanceActions}>
              <Button
                variant="secondary"
                onClick={() => handleClientResponse(false)}
                isLoading={responding}
              >
                Rechazar
              </Button>
              <Button
                onClick={() => handleClientResponse(true)}
                isLoading={responding}
              >
                Aceptar condiciones
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Awaiting payment placeholder */}
      {order.status === "awaiting_payment" && (
        <div className={styles.section}>
          <div className={styles.paymentPlaceholder}>
            <div className={styles.paymentPlaceholderTitle}>Pendiente de Pago</div>
            <p className={styles.paymentPlaceholderDesc}>
              El sistema de pagos estará disponible próximamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
