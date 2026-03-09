"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Badge, Button, Card, Input, Tabs, Spinner, Modal } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import type { PortfolioItemWithMember } from "@/lib/types";
import styles from "./page.module.css";

type TabValue = "projects" | "products";

export default function PublicMarketplacePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabValue>("projects");
  const [authModal, setAuthModal] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const onBuyClick = async (portfolioItemId: number) => {
    if (!user) {
      setAuthModal(true);
      return;
    }

    setAddingId(portfolioItemId);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio_item_id: portfolioItemId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error al agregar");
      }
      router.push("/dashboard/marketplace?tab=cart");
    } catch {
      // If cart add fails, still redirect to dashboard marketplace
      router.push("/dashboard/marketplace");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className="heading-2">Marketplace</h1>
        <p>Explora proyectos y productos de nuestro equipo.</p>
      </div>

      <Tabs
        tabs={[
          { value: "projects", label: "Proyectos" },
          { value: "products", label: "Productos" },
        ]}
        active={tab}
        onChange={(v) => setTab(v as TabValue)}
      />

      {tab === "projects" && <ItemGallery type="project" onBuyClick={onBuyClick} addingId={addingId} userMemberId={user?.member_id ?? null} />}
      {tab === "products" && <ItemGallery type="product" onBuyClick={onBuyClick} addingId={addingId} userMemberId={user?.member_id ?? null} />}

      {/* Auth required modal */}
      <Modal open={authModal} onClose={() => setAuthModal(false)} title="Cuenta requerida">
        <div className={styles.authModalBody}>
          <div className={styles.authModalIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <p className={styles.authModalText}>
            Para comprar productos o proyectos necesitas una cuenta.
            Crea una gratis en menos de un minuto.
          </p>
          <div className={styles.authModalActions}>
            <Link href="/auth">
              <Button variant="secondary" style={{ width: "100%" }}>
                Iniciar sesión
              </Button>
            </Link>
            <Link href="/auth?tab=register">
              <Button style={{ width: "100%" }}>
                Crear cuenta
              </Button>
            </Link>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---- Shared gallery for both projects and products ----

function ItemGallery({ type, onBuyClick, addingId, userMemberId }: { type: "project" | "product"; onBuyClick: (id: number) => void; addingId: number | null; userMemberId: number | null }) {
  const [items, setItems] = useState<PortfolioItemWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (search) params.set("search", search);
      const res = await fetch(`/api/portfolio/public?${params}`);
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [type, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className={styles.loading}><Spinner /></div>;
  }

  const placeholder = type === "project" ? "Buscar proyectos..." : "Buscar productos...";
  const emptyMsg = type === "project" ? "No hay proyectos disponibles." : "No hay productos disponibles.";

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
                    {userMemberId != null && item.member_id === userMemberId ? (
                      <Badge variant="default">Tu {type === "project" ? "proyecto" : "producto"}</Badge>
                    ) : (
                      <Button size="sm" onClick={() => onBuyClick(item.id)} isLoading={addingId === item.id}>Agregar</Button>
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
