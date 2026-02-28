"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, DataTable, Tabs, Spinner, Modal, Input, Select } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { formatCurrency } from "@/lib/utils";
import styles from "./page.module.css";

interface PackageItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  hours: number;
  features: string[];
  is_active: boolean;
}

interface PurchaseRow {
  id: number;
  package_name: string;
  client_name: string;
  hours_total: number;
  hours_used: number;
  status: string;
  created_at: string;
}

type TabValue = "catalog" | "purchases";

const PURCHASE_STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  active: "success",
  exhausted: "warning",
  expired: "error",
  cancelled: "error",
};

export default function PackagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<TabValue>("catalog");

  return (
    <div>
      <PageHeader
        title="Paquetes"
        description="Compra y gestiona paquetes de horas."
      />

      <Tabs
        tabs={[
          { value: "catalog", label: "Catálogo" },
          { value: "purchases", label: "Mis Compras" },
        ]}
        active={tab}
        onChange={(v) => setTab(v as TabValue)}
      />

      {tab === "catalog" && <PackageCatalog toast={toast} isAdmin={user?.role === "admin"} />}
      {tab === "purchases" && <PurchasesList toast={toast} />}
    </div>
  );
}

// ---- Catalog ----

function PackageCatalog({ toast, isAdmin }: { toast: (m: string, t: "success" | "error") => void; isAdmin: boolean }) {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/packages?active_only=${!isAdmin}`);
      const json = await res.json();
      setPackages(json.data || []);
    } catch {
      toast("Error al cargar paquetes", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <>
      {isAdmin && (
        <div className={styles.toolbar}>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            Nuevo Paquete
          </Button>
        </div>
      )}

      <div className={styles.packagesGrid}>
        {packages.map((pkg) => (
          <Card key={pkg.id} hover padding="lg">
            <div className={styles.pkgHeader}>
              <h3 className={styles.pkgName}>{pkg.name}</h3>
              {!pkg.is_active && <Badge variant="default">Inactivo</Badge>}
            </div>
            <p className={styles.pkgPrice}>{formatCurrency(pkg.price)}</p>
            <p className={styles.pkgHours}>{pkg.hours} horas incluidas</p>
            {pkg.description && (
              <p className={styles.pkgDesc}>{pkg.description}</p>
            )}
            {pkg.features.length > 0 && (
              <ul className={styles.featureList}>
                {pkg.features.map((f, i) => (
                  <li key={i} className={styles.featureItem}>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        {packages.length === 0 && (
          <p className={styles.empty}>No hay paquetes disponibles.</p>
        )}
      </div>

      {isAdmin && (
        <CreatePackageModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchData();
          }}
          toast={toast}
        />
      )}
    </>
  );
}

function CreatePackageModal({
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [hours, setHours] = useState("");
  const [features, setFeatures] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          price: Number(price),
          hours: Number(hours),
          features: features
            ? features.split("\n").map((f) => f.trim()).filter(Boolean)
            : [],
        }),
      });
      if (!res.ok) throw new Error();
      toast("Paquete creado", "success");
      setName("");
      setDescription("");
      setPrice("");
      setHours("");
      setFeatures("");
      onCreated();
    } catch {
      toast("Error al crear paquete", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Paquete" size="sm">
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className={styles.row}>
          <Input label="Precio *" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          <Input label="Horas *" type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} required />
        </div>
        <div className={styles.textareaBlock}>
          <label className={styles.textareaLabel}>Características (una por línea)</label>
          <textarea
            className={styles.textareaField}
            rows={4}
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Soporte prioritario&#10;Acceso 24/7&#10;..."
          />
        </div>
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear paquete
        </Button>
      </form>
    </Modal>
  );
}

// ---- Purchases List ----

function PurchasesList({ toast }: { toast: (m: string, t: "success" | "error") => void }) {
  const [data, setData] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      const res = await fetch(`/api/packages/purchases?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      toast("Error al cargar compras", "error");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<PurchaseRow>[] = [
    { key: "id", header: "#", width: "60px", render: (r) => `#${r.id}` },
    { key: "package", header: "Paquete", render: (r) => r.package_name },
    { key: "client", header: "Cliente", render: (r) => r.client_name },
    {
      key: "hours",
      header: "Horas",
      render: (r) => (
        <span>
          {r.hours_used}/{r.hours_total}h
        </span>
      ),
    },
    {
      key: "progress",
      header: "Uso",
      render: (r) => {
        const pct = r.hours_total > 0 ? (r.hours_used / r.hours_total) * 100 : 0;
        return (
          <div className={styles.miniBar}>
            <div className={styles.miniFill} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <Badge variant={PURCHASE_STATUS_BADGE[r.status] || "default"}>
          {r.status === "active" ? "Activo" : r.status === "exhausted" ? "Agotado" : r.status === "expired" ? "Expirado" : "Cancelado"}
        </Badge>
      ),
    },
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
      emptyTitle="Sin compras"
      emptyDescription="No tienes paquetes comprados aún."
    />
  );
}
