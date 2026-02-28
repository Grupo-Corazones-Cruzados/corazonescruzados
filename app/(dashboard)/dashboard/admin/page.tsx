"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs, DataTable, Badge, Button, Input, Modal, Spinner } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import type { User, Member, Client, Service } from "@/lib/types";
import styles from "./page.module.css";

type Tab = "users" | "members" | "clients" | "services";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("users");
  const [search, setSearch] = useState("");

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

  return (
    <div>
      <PageHeader
        title="Administración"
        description="Gestiona usuarios, miembros, clientes y servicios."
      />

      <Tabs
        tabs={[
          { value: "users", label: "Usuarios" },
          { value: "members", label: "Miembros" },
          { value: "clients", label: "Clientes" },
          { value: "services", label: "Servicios" },
        ]}
        active={tab}
        onChange={(v) => { setTab(v as Tab); setSearch(""); }}
      />

      <div className={styles.toolbar}>
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
      </div>

      {tab === "users" && <UsersTable search={search} toast={toast} />}
      {tab === "members" && <MembersTable search={search} toast={toast} />}
      {tab === "clients" && <ClientsTable search={search} toast={toast} />}
      {tab === "services" && <ServicesTable search={search} toast={toast} />}
    </div>
  );
}

// ---- Users Table ----

function UsersTable({ search, toast }: { search: string; toast: (m: string, t: "success" | "error") => void }) {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/auth/me`); // We'll use a proper admin endpoint
    // For now, use direct query — but in production you'd add /api/admin/users
    const r = await fetch(`/api/members?${params}`);
    // Simplified: just show loading state for now
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const columns: Column<User>[] = [
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "name", header: "Nombre", render: (r) => `${r.first_name || ""} ${r.last_name || ""}`.trim() || "—" },
    { key: "role", header: "Rol", render: (r) => (
      <Badge variant={r.role === "admin" ? "info" : r.role === "member" ? "success" : "default"}>
        {r.role}
      </Badge>
    )},
    { key: "verified", header: "Verificado", render: (r) => r.is_verified ? "Sí" : "No" },
  ];

  if (loading) return <div className={styles.tableLoading}><Spinner /></div>;

  return (
    <DataTable
      columns={columns}
      data={data}
      keyExtractor={(r) => r.id}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      emptyTitle="Sin usuarios"
      emptyDescription="No hay usuarios registrados."
    />
  );
}

// ---- Members Table ----

function MembersTable({ search, toast }: { search: string; toast: (m: string, t: "success" | "error") => void }) {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      per_page: "15",
      active_only: "false",
    });
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/members?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      toast("Error al cargar miembros", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: Column<Member>[] = [
    { key: "name", header: "Nombre", render: (r) => r.name },
    { key: "email", header: "Email", render: (r) => r.email || "—" },
    { key: "position", header: "Puesto", render: (r) => r.position || "—" },
    { key: "rate", header: "Tarifa/h", render: (r) => r.hourly_rate ? `$${r.hourly_rate}` : "—" },
    { key: "active", header: "Activo", render: (r) => (
      <Badge variant={r.is_active ? "success" : "default"}>
        {r.is_active ? "Sí" : "No"}
      </Badge>
    )},
  ];

  if (loading) return <div className={styles.tableLoading}><Spinner /></div>;

  return (
    <>
      <div className={styles.tableActions}>
        <Button size="sm" onClick={() => setShowModal(true)}>
          Nuevo Miembro
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyTitle="Sin miembros"
      />
      <NewMemberModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => { setShowModal(false); fetchData(); }}
        toast={toast}
      />
    </>
  );
}

function NewMemberModal({
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
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          position: position || undefined,
          hourly_rate: rate ? Number(rate) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Miembro creado", "success");
      setName(""); setEmail(""); setPosition(""); setRate("");
      onCreated();
    } catch {
      toast("Error al crear miembro", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Miembro" size="sm">
      <form onSubmit={handleSubmit} className={styles.modalForm}>
        <Input label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Puesto" value={position} onChange={(e) => setPosition(e.target.value)} />
        <Input label="Tarifa/hora" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear miembro
        </Button>
      </form>
    </Modal>
  );
}

// ---- Clients Table ----

function ClientsTable({ search, toast }: { search: string; toast: (m: string, t: "success" | "error") => void }) {
  const [data, setData] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/clients?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      toast("Error al cargar clientes", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: Column<Client>[] = [
    { key: "name", header: "Nombre", render: (r) => r.name },
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "company", header: "Empresa", render: (r) => r.company || "—" },
    { key: "phone", header: "Teléfono", render: (r) => r.phone || "—" },
  ];

  if (loading) return <div className={styles.tableLoading}><Spinner /></div>;

  return (
    <>
      <div className={styles.tableActions}>
        <Button size="sm" onClick={() => setShowModal(true)}>
          Nuevo Cliente
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyTitle="Sin clientes"
      />
      <NewClientModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => { setShowModal(false); fetchData(); }}
        toast={toast}
      />
    </>
  );
}

function NewClientModal({
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
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company: company || undefined,
          phone: phone || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast("Cliente creado", "success");
      setName(""); setEmail(""); setCompany(""); setPhone("");
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear cliente", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Cliente" size="sm">
      <form onSubmit={handleSubmit} className={styles.modalForm}>
        <Input label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear cliente
        </Button>
      </form>
    </Modal>
  );
}

// ---- Services Table ----

function ServicesTable({ search, toast }: { search: string; toast: (m: string, t: "success" | "error") => void }) {
  const [data, setData] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/services?active_only=false");
      const json = await res.json();
      const filtered = search
        ? (json.data || []).filter((s: Service) =>
            s.name.toLowerCase().includes(search.toLowerCase())
          )
        : json.data || [];
      setData(filtered);
    } catch {
      toast("Error al cargar servicios", "error");
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: Column<Service>[] = [
    { key: "name", header: "Nombre", render: (r) => r.name },
    { key: "desc", header: "Descripción", render: (r) => r.description || "—" },
    { key: "price", header: "Precio Base", render: (r) => r.base_price ? `$${r.base_price}` : "—" },
    { key: "active", header: "Activo", render: (r) => (
      <Badge variant={r.is_active ? "success" : "default"}>
        {r.is_active ? "Sí" : "No"}
      </Badge>
    )},
  ];

  if (loading) return <div className={styles.tableLoading}><Spinner /></div>;

  return (
    <>
      <div className={styles.tableActions}>
        <Button size="sm" onClick={() => setShowModal(true)}>
          Nuevo Servicio
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        emptyTitle="Sin servicios"
      />
      <NewServiceModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => { setShowModal(false); fetchData(); }}
        toast={toast}
      />
    </>
  );
}

function NewServiceModal({
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
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          base_price: price ? Number(price) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Servicio creado", "success");
      setName(""); setDescription(""); setPrice("");
      onCreated();
    } catch {
      toast("Error al crear servicio", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Servicio" size="sm">
      <form onSubmit={handleSubmit} className={styles.modalForm}>
        <Input label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Precio base" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear servicio
        </Button>
      </form>
    </Modal>
  );
}
