"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs, DataTable, Badge, Button, Input, Modal, Spinner } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import type { User } from "@/lib/types";
import styles from "./page.module.css";

type Tab = "team" | "clients";

const TAB_CONFIG: Record<Tab, { roles: string; emptyTitle: string; emptyDesc: string }> = {
  team: {
    roles: "admin,member",
    emptyTitle: "Sin miembros",
    emptyDesc: "No hay miembros del equipo registrados.",
  },
  clients: {
    roles: "client",
    emptyTitle: "Sin clientes",
    emptyDesc: "No hay clientes registrados.",
  },
};

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("team");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [promoteUser, setPromoteUser] = useState<User | null>(null);

  const config = TAB_CONFIG[tab];

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      per_page: "15",
      roles: config.roles,
    });
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      toast("Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, config.roles, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (user?.role !== "admin") {
    return (
      <div style={{ textAlign: "center", paddingTop: "var(--space-20)" }}>
        <h2 className="heading-3">Acceso denegado</h2>
        <p className="text-secondary" style={{ marginTop: "var(--space-2)" }}>
          No tienes permisos para acceder a esta sección.
        </p>
      </div>
    );
  }

  const teamColumns: Column<User>[] = [
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "name", header: "Nombre", render: (r) => `${r.first_name || ""} ${r.last_name || ""}`.trim() || "—" },
    { key: "role", header: "Rol", render: (r) => (
      <Badge variant={r.role === "admin" ? "info" : "success"}>
        {r.role === "admin" ? "Administrador" : "Miembro"}
      </Badge>
    )},
    { key: "verified", header: "Verificado", render: (r) => (
      <Badge variant={r.is_verified ? "success" : "default"}>
        {r.is_verified ? "Sí" : "No"}
      </Badge>
    )},
  ];

  const clientColumns: Column<User>[] = [
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "name", header: "Nombre", render: (r) => `${r.first_name || ""} ${r.last_name || ""}`.trim() || "—" },
    { key: "phone", header: "Teléfono", render: (r) => r.phone || "—" },
    { key: "verified", header: "Verificado", render: (r) => (
      <Badge variant={r.is_verified ? "success" : "default"}>
        {r.is_verified ? "Sí" : "No"}
      </Badge>
    )},
    { key: "action", header: "", render: (r) =>
      r.is_verified ? (
        <Button size="sm" variant="secondary" onClick={() => setPromoteUser(r)}>
          Convertir en Miembro
        </Button>
      ) : null
    },
  ];

  const columns = tab === "team" ? teamColumns : clientColumns;

  return (
    <div>
      <PageHeader
        title="Administración"
        description="Gestiona el equipo y los clientes."
      />

      <Tabs
        tabs={[
          { value: "team", label: "Equipo" },
          { value: "clients", label: "Clientes" },
        ]}
        active={tab}
        onChange={(v) => { setTab(v as Tab); setSearch(""); setPage(1); }}
      />

      <div className={styles.toolbar}>
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className={styles.search}
        />
      </div>

      {loading ? (
        <div className={styles.tableLoading}><Spinner /></div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          keyExtractor={(r) => r.id}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyTitle={config.emptyTitle}
          emptyDescription={config.emptyDesc}
        />
      )}

      <PromoteModal
        user={promoteUser}
        onClose={() => setPromoteUser(null)}
        onPromoted={() => { setPromoteUser(null); fetchData(); }}
        toast={toast}
      />
    </div>
  );
}

// ---- Promote Modal ----

function PromoteModal({
  user: targetUser,
  onClose,
  onPromoted,
  toast,
}: {
  user: User | null;
  onClose: () => void;
  onPromoted: () => void;
  toast: (m: string, t: "success" | "error") => void;
}) {
  const [position, setPosition] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: position || undefined,
          hourly_rate: rate ? Number(rate) : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast("Usuario promovido a miembro", "success");
      setPosition(""); setRate("");
      onPromoted();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al promover usuario", "error");
    } finally {
      setSaving(false);
    }
  };

  const displayName = targetUser
    ? `${targetUser.first_name || ""} ${targetUser.last_name || ""}`.trim() || targetUser.email
    : "";

  return (
    <Modal open={!!targetUser} onClose={onClose} title="Convertir en Miembro" size="sm">
      <form onSubmit={handleSubmit} className={styles.modalForm}>
        <p className="text-secondary" style={{ margin: 0 }}>
          <strong>{displayName}</strong> ({targetUser?.email})
        </p>
        <Input label="Puesto" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Ej: Diseñador, Desarrollador" />
        <Input label="Tarifa/hora" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Confirmar promoción
        </Button>
      </form>
    </Modal>
  );
}
