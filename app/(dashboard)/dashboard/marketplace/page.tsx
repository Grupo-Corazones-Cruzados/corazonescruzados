"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, Input, Tabs, Spinner, DataTable, Modal } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
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

type TabValue = "products" | "cart" | "orders";

const ORDER_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  paid: "success",
  shipped: "info",
  delivered: "success",
  cancelled: "error",
};

export default function MarketplacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabValue>("products");

  return (
    <div>
      <PageHeader
        title="Marketplace"
        description="Explora productos y servicios."
      />

      <Tabs
        tabs={[
          { value: "products", label: "Productos" },
          { value: "cart", label: "Carrito" },
          { value: "orders", label: "Mis Pedidos" },
        ]}
        active={tab}
        onChange={(v) => setTab(v as TabValue)}
      />

      {tab === "products" && <ProductGrid toast={toast} isAdmin={user?.role === "admin"} />}
      {tab === "cart" && <CartView toast={toast} />}
      {tab === "orders" && <OrdersView toast={toast} />}
    </div>
  );
}

// ---- Product Grid ----

function ProductGrid({ toast, isAdmin }: { toast: (m: string, t: "success" | "error") => void; isAdmin: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!isAdmin) params.set("active_only", "true");
      if (search) params.set("search", search);
      const res = await fetch(`/api/products?${params}`);
      const json = await res.json();
      setProducts(json.data || []);
    } catch {
      toast("Error al cargar productos", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, search, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addToCart = async (productId: number) => {
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      if (!res.ok) throw new Error();
      toast("Agregado al carrito", "success");
    } catch {
      toast("Error al agregar", "error");
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Input
          placeholder="Buscar productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
      </div>
      <div className={styles.productGrid}>
        {products.map((p) => (
          <Card key={p.id} hover padding="none">
            {p.image_url && (
              <div className={styles.productImage}>
                <img src={p.image_url} alt={p.name} />
              </div>
            )}
            <div className={styles.productBody}>
              <h3 className={styles.productName}>{p.name}</h3>
              {p.description && <p className={styles.productDesc}>{p.description}</p>}
              <div className={styles.productFooter}>
                <span className={styles.productPrice}>{formatCurrency(p.price)}</span>
                {p.stock > 0 ? (
                  <Button size="sm" onClick={() => addToCart(p.id)}>
                    Agregar
                  </Button>
                ) : (
                  <Badge variant="error">Agotado</Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
        {products.length === 0 && (
          <p className={styles.empty}>No hay productos disponibles.</p>
        )}
      </div>
    </>
  );
}

// ---- Cart View ----

function CartView({ toast }: { toast: (m: string, t: "success" | "error") => void }) {
  const [items, setItems] = useState<CartItemFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);

  const fetchCart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cart");
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast("Error al cargar carrito", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const updateQty = async (itemId: number, quantity: number) => {
    try {
      await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, quantity }),
      });
      fetchCart();
    } catch {
      toast("Error", "error");
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
      fetchCart();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear pedido", "error");
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

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
              <span className={styles.cartItemPrice}>
                {formatCurrency(item.product.price)} c/u
              </span>
            </div>
            <div className={styles.cartItemActions}>
              <button
                className={styles.qtyBtn}
                onClick={() => updateQty(item.id, item.quantity - 1)}
              >
                −
              </button>
              <span className={styles.qtyValue}>{item.quantity}</span>
              <button
                className={styles.qtyBtn}
                onClick={() => updateQty(item.id, item.quantity + 1)}
              >
                +
              </button>
              <span className={styles.cartItemSubtotal}>
                {formatCurrency(item.product.price * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.cartTotal}>
        <span>Total: <strong>{formatCurrency(total)}</strong></span>
        <Button onClick={placeOrder} isLoading={ordering}>
          Realizar pedido
        </Button>
      </div>
    </div>
  );
}

// ---- Orders View ----

function OrdersView({ toast }: { toast: (m: string, t: "success" | "error") => void }) {
  const [data, setData] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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

  const columns: Column<OrderRow>[] = [
    { key: "id", header: "#", width: "60px", render: (r) => `#${r.id}` },
    { key: "total", header: "Total", render: (r) => <strong>{formatCurrency(r.total)}</strong> },
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <Badge variant={ORDER_BADGE[r.status] || "default"}>
          {ORDER_STATUS_LABELS[r.status] || r.status}
        </Badge>
      ),
    },
    { key: "date", header: "Fecha", render: (r) => formatDate(r.created_at) },
  ];

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      keyExtractor={(r) => r.id}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      emptyTitle="Sin pedidos"
      emptyDescription="No has realizado ningún pedido."
    />
  );
}
