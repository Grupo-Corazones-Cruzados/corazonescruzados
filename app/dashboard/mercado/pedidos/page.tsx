"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useOrders } from "@/lib/hooks/useMarketplace";
import styles from "@/app/styles/Mercado.module.css";

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const PackageIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" x2="12" y1="22" y2="12" />
  </svg>
);

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "pendiente": return "Pendiente";
    case "pagado": return "Pagado";
    case "confirmado": return "Confirmado";
    case "completado": return "Completado";
    case "cancelado": return "Cancelado";
    default: return estado;
  }
};

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "pendiente": return styles.orderStatusPendiente;
    case "pagado": return styles.orderStatusPagado;
    case "confirmado": return styles.orderStatusConfirmado;
    case "completado": return styles.orderStatusCompletado;
    case "cancelado": return styles.orderStatusCancelado;
    default: return "";
  }
};

export default function PedidosPage() {
  const router = useRouter();
  const { orders, loading, error, refetch } = useOrders();
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  const toggleOrder = (orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.bgGlow} />
          <div className={styles.container}>
            <div className={styles.state}>
              <div className={styles.spinner} />
              <p>Cargando pedidos...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.bgGlow} />
        <div className={styles.container}>
          {/* Back button */}
          <button className={styles.backBtn} onClick={() => router.push("/dashboard/mercado")}>
            <ArrowLeftIcon />
            Volver al catálogo
          </button>

          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Mis Pedidos</h1>
              <p className={styles.subtitle}>
                {orders.length === 0
                  ? "No tienes pedidos todavía"
                  : `${orders.length} pedido${orders.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {error && (
            <div className={styles.stateError}>
              <p className={styles.errorText}>{error}</p>
              <button className={styles.retryBtn} onClick={() => refetch()}>
                Reintentar
              </button>
            </div>
          )}

          {orders.length === 0 ? (
            <div className={styles.state}>
              <PackageIcon />
              <h3 style={{ margin: "12px 0 0", color: "#fff" }}>No tienes pedidos</h3>
              <p style={{ margin: "8px 0 16px" }}>
                Cuando realices compras, aparecerán aquí
              </p>
              <button
                className={styles.primaryBtn}
                onClick={() => router.push("/dashboard/mercado")}
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            <div className={styles.ordersList}>
              {orders.map((order) => {
                const isExpanded = expandedOrders.has(order.id);

                return (
                  <div key={order.id} className={styles.orderCard}>
                    <div
                      className={styles.orderHeader}
                      onClick={() => toggleOrder(order.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          toggleOrder(order.id);
                        }
                      }}
                    >
                      <div className={styles.orderHeaderLeft}>
                        <span className={styles.orderId}>Pedido #{order.id}</span>
                        <span className={styles.orderDate}>{formatDate(order.created_at)}</span>
                      </div>
                      <div className={styles.orderHeaderRight}>
                        <span className={`${styles.orderStatus} ${getStatusClass(order.estado)}`}>
                          {getStatusLabel(order.estado)}
                        </span>
                        <span className={styles.orderTotal}>{formatCurrency(order.total)}</span>
                        {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={styles.orderDetails}>
                        {order.notas && (
                          <div className={styles.orderNotes}>
                            <strong>Notas:</strong> {order.notas}
                          </div>
                        )}

                        <div className={styles.orderItems}>
                          <h4 className={styles.orderItemsTitle}>Productos</h4>
                          {order.items?.map((item) => {
                            const image = item.producto?.imagenes?.[0] || item.producto?.imagen;

                            return (
                              <div key={item.id} className={styles.orderItem}>
                                <div className={styles.orderItemImage}>
                                  {image ? (
                                    <img src={image} alt={item.producto?.nombre || "Producto"} />
                                  ) : (
                                    <div className={styles.orderItemPlaceholder} />
                                  )}
                                </div>
                                <div className={styles.orderItemInfo}>
                                  <span
                                    className={styles.orderItemName}
                                    onClick={() => router.push(`/dashboard/mercado/${item.id_producto}`)}
                                  >
                                    {item.producto?.nombre || "Producto"}
                                  </span>
                                  {item.producto?.vendedor_nombre && (
                                    <span className={styles.orderItemVendor}>
                                      por {item.producto.vendedor_nombre}
                                    </span>
                                  )}
                                </div>
                                <div className={styles.orderItemQuantity}>
                                  x{item.cantidad}
                                </div>
                                <div className={styles.orderItemPrice}>
                                  {formatCurrency(item.precio_unitario)}
                                </div>
                                <div className={styles.orderItemSubtotal}>
                                  {formatCurrency(item.subtotal)}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className={styles.orderSummary}>
                          <div className={styles.orderSummaryRow}>
                            <span>Subtotal</span>
                            <span>{formatCurrency(order.total)}</span>
                          </div>
                          <div className={styles.orderSummaryRow}>
                            <span>Envío</span>
                            <span className={styles.freeShipping}>Gratis</span>
                          </div>
                          <div className={styles.orderSummaryTotal}>
                            <span>Total</span>
                            <span>{formatCurrency(order.total)}</span>
                          </div>
                        </div>

                        {order.estado === "pendiente" && (
                          <div className={styles.orderActions}>
                            <p className={styles.paymentNote}>
                              Este pedido está pendiente de pago. Contacta al vendedor para coordinar el pago.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
