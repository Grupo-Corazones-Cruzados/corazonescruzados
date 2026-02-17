"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useCart, useOrders } from "@/lib/hooks/useMarketplace";
import styles from "@/app/styles/Mercado.module.css";

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const MinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ShoppingBagIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <line x1="3" x2="21" y1="6" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

export default function CarritoPage() {
  const router = useRouter();
  const { items, total, loading, error, updateQuantity, removeFromCart, clearCart } = useCart();
  const { createOrder } = useOrders();

  const [notas, setNotas] = useState("");
  const [processingOrder, setProcessingOrder] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<number>>(new Set());

  const handleUpdateQuantity = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    setUpdatingItems((prev) => new Set(prev).add(itemId));
    await updateQuantity(itemId, newQuantity);
    setUpdatingItems((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  const handleRemoveItem = async (itemId: number) => {
    setUpdatingItems((prev) => new Set(prev).add(itemId));
    await removeFromCart(itemId);
    setUpdatingItems((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  const handleClearCart = async () => {
    if (!confirm("¿Estás seguro de vaciar el carrito?")) return;
    await clearCart();
  };

  const handleCreateOrder = async () => {
    setProcessingOrder(true);
    const { order, error } = await createOrder(notas || undefined);
    setProcessingOrder(false);

    if (error) {
      alert(error);
    } else if (order) {
      router.push("/dashboard/mercado/pedidos");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.bgGlow} />
          <div className={styles.container}>
            <div className={styles.state}>
              <div className={styles.spinner} />
              <p>Cargando carrito...</p>
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
            Seguir comprando
          </button>

          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Mi Carrito</h1>
              <p className={styles.subtitle}>
                {items.length === 0
                  ? "Tu carrito está vacío"
                  : `${items.length} producto${items.length !== 1 ? "s" : ""} en tu carrito`}
              </p>
            </div>
            {items.length > 0 && (
              <button className={styles.clearCartBtn} onClick={handleClearCart}>
                <TrashIcon />
                Vaciar carrito
              </button>
            )}
          </div>

          {error && (
            <div className={styles.stateError}>
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {items.length === 0 ? (
            <div className={styles.state}>
              <ShoppingBagIcon />
              <h3 style={{ margin: "12px 0 0", color: "#fff" }}>Tu carrito está vacío</h3>
              <p style={{ margin: "8px 0 16px" }}>
                Explora el catálogo y agrega productos
              </p>
              <button
                className={styles.primaryBtn}
                onClick={() => router.push("/dashboard/mercado")}
              >
                Ir al catálogo
              </button>
            </div>
          ) : (
            <div className={styles.cartLayout}>
              {/* Cart Items */}
              <div className={styles.cartItems}>
                {items.map((item) => {
                  const product = item.producto;
                  const image = product?.imagenes?.[0] || product?.imagen;
                  const isUpdating = updatingItems.has(item.id);

                  return (
                    <div key={item.id} className={styles.cartItem}>
                      <div className={styles.cartItemImage}>
                        {image ? (
                          <img src={image} alt={product?.nombre || "Producto"} />
                        ) : (
                          <div className={styles.cartItemPlaceholder} />
                        )}
                      </div>

                      <div className={styles.cartItemInfo}>
                        <h3
                          className={styles.cartItemName}
                          onClick={() => router.push(`/dashboard/mercado/${item.id_producto}`)}
                        >
                          {product?.nombre || "Producto"}
                        </h3>
                        {product?.vendedor_nombre && (
                          <span className={styles.cartItemVendor}>
                            por {product.vendedor_nombre}
                          </span>
                        )}
                        <span className={styles.cartItemPrice}>
                          {formatCurrency(product?.costo)}
                        </span>
                      </div>

                      <div className={styles.cartItemQuantity}>
                        {item.producto?.unico ? (
                          <span className={styles.unicoBadge}>Producto unico</span>
                        ) : (
                          <>
                            <button
                              className={styles.quantityBtn}
                              onClick={() => handleUpdateQuantity(item.id, item.cantidad - 1)}
                              disabled={item.cantidad <= 1 || isUpdating}
                            >
                              <MinusIcon />
                            </button>
                            <span className={styles.quantityValue}>
                              {isUpdating ? "..." : item.cantidad}
                            </span>
                            <button
                              className={styles.quantityBtn}
                              onClick={() => handleUpdateQuantity(item.id, item.cantidad + 1)}
                              disabled={isUpdating}
                            >
                              <PlusIcon />
                            </button>
                          </>
                        )}
                      </div>

                      <div className={styles.cartItemSubtotal}>
                        {formatCurrency((product?.costo || 0) * item.cantidad)}
                      </div>

                      <button
                        className={styles.cartItemRemove}
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isUpdating}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Order Summary */}
              <div className={styles.cartSummary}>
                <h2 className={styles.summaryTitle}>Resumen del pedido</h2>

                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Envío</span>
                    <span className={styles.freeShipping}>Gratis</span>
                  </div>
                </div>

                <div className={styles.summaryTotal}>
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                <div className={styles.notasSection}>
                  <label className={styles.notasLabel}>Notas del pedido (opcional)</label>
                  <textarea
                    className={styles.notasInput}
                    placeholder="Instrucciones especiales, detalles de entrega..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={3}
                  />
                </div>

                <button
                  className={styles.checkoutBtn}
                  onClick={handleCreateOrder}
                  disabled={processingOrder || items.length === 0}
                >
                  {processingOrder ? (
                    <>
                      <div className={styles.btnSpinner} />
                      Procesando...
                    </>
                  ) : (
                    "Confirmar Pedido"
                  )}
                </button>

                <p className={styles.checkoutNote}>
                  Al confirmar, crearás un pedido pendiente de pago
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
