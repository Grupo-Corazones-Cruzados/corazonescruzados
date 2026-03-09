"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { Badge, Button, Card, Input, Tabs, Spinner, DataTable } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE } from "@/lib/constants";
import type { OrderStatus, PortfolioItemWithMember } from "@/lib/types";
import styles from "./page.module.css";

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  stock: number;
  is_active: boolean;
  allow_quantities: boolean;
}

interface CartItemFull {
  id: number;
  product_id: number;
  quantity: number;
  product: Product;
}

interface OrderRow {
  id: number;
  total: number;
  status: string;
  created_at: string;
}

type TabValue = "projects" | "products" | "cart" | "orders" | "confirmations";
type PortfolioType = "project" | "product";

export default function MarketplacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabValue>("projects");
  const [cartItems, setCartItems] = useState<CartItemFull[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      const json = await res.json();
      setCartItems(json.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0);

  const onCartChange = () => fetchCart();

  return (
    <div>
      {/* Header with cart button */}
      <div className={styles.headerRow}>
        <PageHeader
          title="Marketplace"
          description="Explora proyectos y productos de nuestro equipo."
        />
        <button
          className={styles.cartButton}
          onClick={() => {
            if (window.innerWidth <= 768) {
              setPreviewOpen((o) => !o);
            } else {
              setTab("cart");
            }
          }}
          aria-label="Carrito"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
          </svg>
          {cartCount > 0 && (
            <span className={styles.cartBadge}>{cartCount}</span>
          )}
        </button>
      </div>

      {/* Tabs (without cart) */}
      <Tabs
        tabs={[
          { value: "projects", label: "Proyectos" },
          { value: "products", label: "Productos" },
          { value: "orders", label: "Mis Pedidos" },
          ...(user?.role === "member" || user?.role === "admin"
            ? [{ value: "confirmations", label: "Confirmaciones" }]
            : []),
        ]}
        active={tab}
        onChange={(v) => setTab(v as TabValue)}
      />

      <div className={styles.mainLayout}>
        {/* Content area */}
        <div className={styles.content}>
          {tab === "projects" && (
            <PortfolioGallery type="project" toast={toast} onCartChange={onCartChange} cartItems={cartItems} />
          )}
          {tab === "products" && (
            <PortfolioGallery type="product" toast={toast} onCartChange={onCartChange} cartItems={cartItems} />
          )}
          {tab === "cart" && (
            <CartView toast={toast} items={cartItems} onCartChange={onCartChange} />
          )}
          {tab === "orders" && <OrdersView toast={toast} />}
          {tab === "confirmations" && <ConfirmationsRedirect />}
        </div>

        {/* Cart preview sidebar — desktop always, mobile as drawer */}
        {tab !== "cart" && tab !== "orders" && (
          <aside className={`${styles.preview} ${previewOpen ? styles.previewOpen : ""}`}>
            {/* Mobile backdrop */}
            {previewOpen && (
              <div className={styles.previewBackdrop} onClick={() => setPreviewOpen(false)} />
            )}
            <div className={styles.previewPanel}>
              <div className={styles.previewHeader}>
                <h3 className={styles.previewTitle}>Tu pedido</h3>
                <button
                  className={styles.previewClose}
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Cerrar"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {cartItems.length === 0 ? (
                <p className={styles.previewEmpty}>Tu carrito está vacío</p>
              ) : (
                <>
                  <div className={styles.previewItems}>
                    {cartItems.map((item) => (
                      <div key={item.id} className={styles.previewItem}>
                        <div className={styles.previewItemInfo}>
                          <span className={styles.previewItemName}>{item.product.name}</span>
                          <span className={styles.previewItemMeta}>
                            {item.quantity} x {formatCurrency(item.product.price)}
                          </span>
                        </div>
                        <span className={styles.previewItemTotal}>
                          {formatCurrency(item.product.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.previewFooter}>
                    <div className={styles.previewTotal}>
                      <span>Total</span>
                      <strong>{formatCurrency(cartTotal)}</strong>
                    </div>
                    <Button
                      style={{ width: "100%" }}
                      onClick={() => { setTab("cart"); setPreviewOpen(false); }}
                    >
                      Ir al carrito
                    </Button>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Mobile floating cart button */}
      {tab !== "cart" && tab !== "orders" && cartCount > 0 && (
        <button
          className={styles.floatingCart}
          onClick={() => setPreviewOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
          </svg>
          <span>{cartCount} - {formatCurrency(cartTotal)}</span>
        </button>
      )}
    </div>
  );
}

// ---- Portfolio Gallery (projects & products) ----

function PortfolioGallery({
  type,
  toast,
  onCartChange,
  cartItems,
}: {
  type: PortfolioType;
  toast: (m: string, t: "success" | "error") => void;
  onCartChange: () => void;
  cartItems: CartItemFull[];
}) {
  const [items, setItems] = useState<PortfolioItemWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);

  const addToCart = async (portfolioItemId: number) => {
    setAddingId(portfolioItemId);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio_item_id: portfolioItemId }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Error al agregar";
        try { msg = JSON.parse(text).error || msg; } catch { /* not JSON */ }
        throw new Error(msg);
      }
      toast("Agregado al carrito", "success");
      onCartChange();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al agregar", "error");
    } finally {
      setAddingId(null);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (search) params.set("search", search);
      const res = await fetch(`/api/portfolio?${params}`);
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast(`Error al cargar ${type === "project" ? "proyectos" : "productos"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [type, search, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className={styles.loading}><Spinner /></div>;
  }

  const isProject = type === "project";
  const placeholder = isProject ? "Buscar proyectos..." : "Buscar productos...";
  const emptyMsg = isProject ? "No hay proyectos disponibles." : "No hay productos disponibles.";

  return (
    <>
      <div className={styles.toolbar}>
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
      </div>
      <div className={styles.productGrid}>
        {items.map((item) => (
          <Card key={item.id} hover padding="none">
            {item.image_url && (
              <div className={styles.productImage}>
                <img src={item.image_url} alt={item.title} />
              </div>
            )}
            <div className={styles.productBody}>
              <h3 className={styles.productName}>{item.title}</h3>
              {item.description && (
                <p className={styles.productDesc}>{item.description}</p>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className={styles.tags}>
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="default">{tag}</Badge>
                  ))}
                </div>
              )}
              <div className={styles.memberChip}>
                {item.member_photo_url ? (
                  <img src={item.member_photo_url} alt="" className={styles.memberAvatar} />
                ) : (
                  <span className={styles.memberAvatarFallback}>
                    {item.member_name[0]}
                  </span>
                )}
                <span className={styles.memberLabel}>{item.member_name}</span>
                {item.project_url && (
                  <a href={item.project_url} target="_blank" rel="noopener noreferrer" className={styles.projectLink}>
                    Ver proyecto
                  </a>
                )}
              </div>
              <div className={styles.productFooter}>
                {item.cost != null ? (
                  <>
                    <span className={styles.productPrice}>{formatCurrency(item.cost)}</span>
                    {!item.allow_quantities && cartItems.some(
                      (ci) => ci.product.name === item.title
                    ) ? (
                      <Badge variant="info">En carrito</Badge>
                    ) : (
                      <Button size="sm" onClick={() => addToCart(item.id)} isLoading={addingId === item.id}>
                        Agregar
                      </Button>
                    )}
                  </>
                ) : (
                  <span className={styles.noPrice}>Sin precio</span>
                )}
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && <p className={styles.empty}>{emptyMsg}</p>}
      </div>
    </>
  );
}

// ---- Cart View (full) ----

function CartView({
  toast,
  items,
  onCartChange,
}: {
  toast: (m: string, t: "success" | "error") => void;
  items: CartItemFull[];
  onCartChange: () => void;
}) {
  const [ordering, setOrdering] = useState(false);

  const updateQty = async (itemId: number, quantity: number) => {
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, quantity }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }
      onCartChange();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  const placeOrder = async () => {
    setOrdering(true);
    try {
      const res = await fetch("/api/orders", { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
      toast("Pedido creado", "success");
      onCartChange();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear pedido", "error");
    } finally {
      setOrdering(false);
    }
  };

  if (items.length === 0) {
    return <p className={styles.emptyCart}>Tu carrito está vacío.</p>;
  }

  const total = items.reduce((s, i) => s + i.product.price * i.quantity, 0);

  return (
    <div className={styles.cartContainer}>
      <div className={styles.cartItems}>
        {items.map((item) => (
          <div key={item.id} className={styles.cartItem}>
            <div className={styles.cartItemInfo}>
              <span className={styles.cartItemName}>{item.product.name}</span>
              <span className={styles.cartItemPrice}>{formatCurrency(item.product.price)} c/u</span>
            </div>
            <div className={styles.cartItemActions}>
              {item.product.allow_quantities ? (
                <>
                  <button className={styles.qtyBtn} onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                  <span className={styles.qtyValue}>{item.quantity}</span>
                  <button className={styles.qtyBtn} onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                </>
              ) : (
                <>
                  <button className={styles.qtyBtn} onClick={() => updateQty(item.id, 0)} title="Eliminar">×</button>
                  <span className={styles.qtyValue}>1</span>
                </>
              )}
              <span className={styles.cartItemSubtotal}>{formatCurrency(item.product.price * item.quantity)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.cartTotal}>
        <span>Total: <strong>{formatCurrency(total)}</strong></span>
        <Button onClick={placeOrder} isLoading={ordering}>Realizar pedido</Button>
      </div>
    </div>
  );
}

// ---- Orders View ----

function OrdersView({ toast }: { toast: (m: string, t: "success" | "error") => void }) {
  const router = useRouter();
  const [data, setData] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      const res = await fetch(`/api/orders?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      toast("Error al cargar pedidos", "error");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deleteOrder = async (id: number) => {
    if (!confirm("¿Eliminar este pedido? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }
      toast("Pedido eliminado", "success");
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al eliminar", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const columns: Column<OrderRow>[] = [
    { key: "id", header: "#", width: "60px", render: (r) => `#${r.id}` },
    { key: "total", header: "Total", render: (r) => <strong>{formatCurrency(r.total)}</strong> },
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <Badge variant={ORDER_STATUS_BADGE[r.status as OrderStatus] || "default"}>
          {ORDER_STATUS_LABELS[r.status as OrderStatus] || r.status}
        </Badge>
      ),
    },
    { key: "date", header: "Fecha", render: (r) => formatDate(r.created_at) },
    {
      key: "actions",
      header: "",
      width: "50px",
      render: (r) => (
        <button
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); deleteOrder(r.id); }}
          disabled={deletingId === r.id}
          title="Eliminar pedido"
          aria-label="Eliminar pedido"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path
              d="M6 4V3a1 1 0 011-1h6a1 1 0 011 1v1M3 6h14M5 6v10a2 2 0 002 2h6a2 2 0 002-2V6M8 9v5M12 9v5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ),
    },
  ];

  if (loading) {
    return <div className={styles.loading}><Spinner /></div>;
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      keyExtractor={(r) => r.id}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      onRowClick={(r) => router.push(`/dashboard/marketplace/orders/${r.id}`)}
      emptyTitle="Sin pedidos"
      emptyDescription="No has realizado ningún pedido."
    />
  );
}

// ---- Confirmations redirect ----

function ConfirmationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.push("/dashboard/marketplace/confirmations");
  }, [router]);
  return <div className={styles.loading}><Spinner /></div>;
}
