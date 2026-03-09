"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs, DataTable, Badge, Button, Input, Select, Modal, Spinner } from "@/components/ui";
import Avatar from "@/components/ui/Avatar";
import type { Column } from "@/components/ui/DataTable";
import type { User, Position, Service } from "@/lib/types";
import styles from "./page.module.css";

type Tab = "team" | "clients" | "positions";

const TAB_CONFIG: Record<"team" | "clients", { roles: string; emptyTitle: string; emptyDesc: string }> = {
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
        description="Gestiona el equipo, clientes, puestos y servicios."
      />

      <Tabs
        tabs={[
          { value: "team", label: "Equipo" },
          { value: "clients", label: "Clientes" },
          { value: "positions", label: "Puestos y Servicios" },
        ]}
        active={tab}
        onChange={(v) => { setTab(v as Tab); setSearch(""); }}
      />

      {(tab === "team" || tab === "clients") && (
        <UsersTab tab={tab} search={search} setSearch={setSearch} toast={toast} />
      )}
      {tab === "positions" && <PositionsAndServicesTab toast={toast} />}
    </div>
  );
}

// ====================
// Users Tab (Team / Clients)
// ====================

function UsersTab({
  tab,
  search,
  setSearch,
  toast,
}: {
  tab: "team" | "clients";
  search: string;
  setSearch: (s: string) => void;
  toast: (m: string, t: "success" | "error") => void;
}) {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [promoteUser, setPromoteUser] = useState<User | null>(null);
  const [editMemberUser, setEditMemberUser] = useState<User | null>(null);

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
  useEffect(() => { setPage(1); }, [tab]);

  const userName = (r: User) =>
    `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email;

  const avatarCol: Column<User> = {
    key: "avatar",
    header: "",
    width: "50px",
    render: (r) => (
      <Avatar src={r.avatar_url} name={userName(r)} size="sm" />
    ),
  };

  const teamColumns: Column<User & { position_name?: string; hourly_rate?: number }>[] = [
    avatarCol,
    { key: "name", header: "Nombre", render: (r) => userName(r) || "—" },
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "position", header: "Puesto", render: (r) => (r as any).position_name || "—" },
    { key: "rate", header: "Tarifa/h", render: (r) =>
      (r as any).hourly_rate ? `$${(r as any).hourly_rate}` : "—"
    },
    { key: "role", header: "Rol", render: (r) => (
      <Badge variant={r.role === "admin" ? "info" : "success"}>
        {r.role === "admin" ? "Administrador" : "Miembro"}
      </Badge>
    )},
    { key: "action", header: "", width: "100px", render: (r) =>
      r.member_id ? (
        <Button size="sm" variant="ghost" onClick={() => setEditMemberUser(r)}>
          Editar
        </Button>
      ) : null
    },
  ];

  const clientColumns: Column<User>[] = [
    avatarCol,
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "name", header: "Nombre", render: (r) => userName(r) || "—" },
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
    <>
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

      <EditMemberModal
        user={editMemberUser}
        onClose={() => setEditMemberUser(null)}
        onSaved={() => { setEditMemberUser(null); fetchData(); }}
        toast={toast}
      />
    </>
  );
}

// ====================
// Edit Member Modal
// ====================

function EditMemberModal({
  user: targetUser,
  onClose,
  onSaved,
  toast,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
  toast: (m: string, t: "success" | "error") => void;
}) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionId, setPositionId] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Position search
  const [posSearch, setPosSearch] = useState("");
  const [posDropdownOpen, setPosDropdownOpen] = useState(false);
  const posRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!targetUser?.member_id) return;
    setLoading(true);
    Promise.all([
      fetch("/api/positions?active_only=true").then((r) => r.json()),
      fetch(`/api/members/${targetUser.member_id}`).then((r) => r.json()),
    ])
      .then(([posJson, memberJson]) => {
        setPositions(posJson.data || []);
        const member = memberJson.data;
        if (member) {
          setPositionId(member.position_id ? String(member.position_id) : "");
          setRate(member.hourly_rate ? String(member.hourly_rate) : "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    setPosSearch("");
  }, [targetUser]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (posRef.current && !posRef.current.contains(e.target as Node)) {
        setPosDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selectedPosition = positions.find((p) => String(p.id) === positionId);
  const filteredPositions = positions.filter((p) =>
    p.name.toLowerCase().includes(posSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser?.member_id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${targetUser.member_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position_id: positionId ? Number(positionId) : null,
          hourly_rate: rate ? Number(rate) : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Miembro actualizado", "success");
      onSaved();
    } catch {
      toast("Error al actualizar miembro", "error");
    } finally {
      setSaving(false);
    }
  };

  const displayName = targetUser
    ? `${targetUser.first_name || ""} ${targetUser.last_name || ""}`.trim() || targetUser.email
    : "";

  return (
    <Modal open={!!targetUser} onClose={onClose} title="Editar Miembro" size="sm">
      {loading ? (
        <div className={styles.tableLoading}><Spinner /></div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <p className="text-secondary" style={{ margin: 0 }}>
            <strong>{displayName}</strong> ({targetUser?.email})
          </p>

          {/* Position picker with search */}
          <div className={styles.fieldGroup} ref={posRef}>
            <label className={styles.fieldLabel}>Puesto</label>
            {selectedPosition ? (
              <div className={styles.selectedChip}>
                <span>{selectedPosition.name}</span>
                <button
                  type="button"
                  className={styles.clearChip}
                  onClick={() => { setPositionId(""); setPosSearch(""); }}
                  aria-label="Quitar puesto"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className={styles.searchWrap}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Buscar puesto..."
                  value={posSearch}
                  onChange={(e) => { setPosSearch(e.target.value); setPosDropdownOpen(true); }}
                  onFocus={() => setPosDropdownOpen(true)}
                />
                {posDropdownOpen && (
                  <div className={styles.dropdown}>
                    {filteredPositions.length === 0 ? (
                      <div className={styles.dropdownEmpty}>Sin resultados</div>
                    ) : (
                      filteredPositions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={styles.dropdownOption}
                          onClick={() => {
                            setPositionId(String(p.id));
                            setPosSearch("");
                            setPosDropdownOpen(false);
                          }}
                        >
                          <span className={styles.dropdownName}>{p.name}</span>
                          {p.description && (
                            <span className={styles.dropdownDesc}>{p.description}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Input
            label="Tarifa/hora"
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="0.00"
          />
          <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
            Guardar cambios
          </Button>
        </form>
      )}
    </Modal>
  );
}

// ====================
// Promote Modal
// ====================

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
  const [positionId, setPositionId] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    if (targetUser) {
      fetch("/api/positions?active_only=true")
        .then((r) => r.json())
        .then((json) => setPositions(json.data || []))
        .catch(() => {});
    }
  }, [targetUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position_id: positionId ? Number(positionId) : undefined,
          hourly_rate: rate ? Number(rate) : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast("Usuario promovido a miembro", "success");
      setPositionId(""); setRate("");
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
        <Select
          label="Puesto"
          options={positions.map((p) => ({ value: String(p.id), label: p.name }))}
          value={positionId}
          onChange={(e) => setPositionId(e.target.value)}
          placeholder="Seleccionar puesto"
        />
        <Input label="Tarifa/hora" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Confirmar promoción
        </Button>
      </form>
    </Modal>
  );
}

// ====================
// Positions & Services Tab (Master-Detail)
// ====================

function PositionsAndServicesTab({ toast }: { toast: (m: string, t: "success" | "error") => void }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosId, setSelectedPosId] = useState<number | null>(null);

  // Position modal state
  const [posModal, setPosModal] = useState(false);
  const [editPos, setEditPos] = useState<Position | null>(null);
  const [posName, setPosName] = useState("");
  const [posDesc, setPosDesc] = useState("");
  const [posSaving, setPosSaving] = useState(false);

  // Service modal state
  const [svcModal, setSvcModal] = useState(false);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [svcName, setSvcName] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcSaving, setSvcSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/positions?active_only=false"),
        fetch("/api/services?active_only=false"),
      ]);
      const [pJson, sJson] = await Promise.all([pRes.json(), sRes.json()]);
      setPositions(pJson.data || []);
      setServices(sJson.data || []);
    } catch {
      toast("Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedPos = positions.find((p) => p.id === selectedPosId) || null;
  const filteredServices = selectedPosId
    ? services.filter((s) => s.position_id === selectedPosId)
    : [];

  // --- Position CRUD ---
  const openCreatePos = () => {
    setEditPos(null);
    setPosName("");
    setPosDesc("");
    setPosModal(true);
  };

  const openEditPos = (p: Position) => {
    setEditPos(p);
    setPosName(p.name);
    setPosDesc(p.description || "");
    setPosModal(true);
  };

  const handlePosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posName.trim()) return;
    setPosSaving(true);
    try {
      const body = { name: posName, description: posDesc || null };
      if (editPos) {
        const res = await fetch(`/api/positions/${editPos.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        toast("Puesto actualizado", "success");
      } else {
        const res = await fetch("/api/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        toast("Puesto creado", "success");
      }
      setPosModal(false);
      fetchData();
    } catch {
      toast("Error al guardar puesto", "error");
    } finally {
      setPosSaving(false);
    }
  };

  const togglePosActive = async (p: Position) => {
    try {
      const res = await fetch(`/api/positions/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      if (!res.ok) throw new Error();
      toast(p.is_active ? "Puesto desactivado" : "Puesto activado", "success");
      fetchData();
    } catch {
      toast("Error al actualizar", "error");
    }
  };

  // --- Service CRUD ---
  const openCreateSvc = () => {
    setEditSvc(null);
    setSvcName("");
    setSvcDesc("");
    setSvcPrice("");
    setSvcModal(true);
  };

  const openEditSvc = (s: Service) => {
    setEditSvc(s);
    setSvcName(s.name);
    setSvcDesc(s.description || "");
    setSvcPrice(String(s.base_price || ""));
    setSvcModal(true);
  };

  const handleSvcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!svcName.trim() || !selectedPosId) return;
    setSvcSaving(true);
    try {
      const body = {
        name: svcName,
        description: svcDesc || null,
        base_price: svcPrice ? Number(svcPrice) : 0,
        position_id: selectedPosId,
      };
      if (editSvc) {
        const res = await fetch(`/api/services/${editSvc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        toast("Servicio actualizado", "success");
      } else {
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        toast("Servicio creado", "success");
      }
      setSvcModal(false);
      fetchData();
    } catch {
      toast("Error al guardar servicio", "error");
    } finally {
      setSvcSaving(false);
    }
  };

  const toggleSvcActive = async (s: Service) => {
    try {
      const res = await fetch(`/api/services/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !s.is_active }),
      });
      if (!res.ok) throw new Error();
      toast(s.is_active ? "Servicio desactivado" : "Servicio activado", "success");
      fetchData();
    } catch {
      toast("Error al actualizar", "error");
    }
  };

  const svcColumns: Column<Service>[] = [
    { key: "name", header: "Nombre", render: (r) => r.name },
    { key: "price", header: "Precio base", render: (r) => r.base_price > 0 ? `$${r.base_price}` : "—" },
    { key: "status", header: "Estado", render: (r) => (
      <Badge variant={r.is_active ? "success" : "default"}>
        {r.is_active ? "Activo" : "Inactivo"}
      </Badge>
    )},
    { key: "actions", header: "", width: "180px", render: (r) => (
      <div className={styles.rowActions}>
        <Button size="sm" variant="ghost" onClick={() => openEditSvc(r)}>Editar</Button>
        <Button size="sm" variant="ghost" onClick={() => toggleSvcActive(r)}>
          {r.is_active ? "Desactivar" : "Activar"}
        </Button>
      </div>
    )},
  ];

  if (loading) {
    return <div className={styles.tableLoading}><Spinner /></div>;
  }

  return (
    <>
      <div className={styles.masterDetail}>
        {/* Left: Positions list */}
        <div className={styles.masterPanel}>
          <div className={styles.masterHeader}>
            <h3 className={styles.masterTitle}>Puestos</h3>
            <Button size="sm" onClick={openCreatePos}>Nuevo</Button>
          </div>

          {positions.length === 0 ? (
            <p className={styles.masterEmpty}>
              No hay puestos creados. Crea uno para empezar.
            </p>
          ) : (
            <div className={styles.positionList}>
              {positions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.positionItem} ${
                    selectedPosId === p.id ? styles.positionItemActive : ""
                  } ${!p.is_active ? styles.positionItemInactive : ""}`}
                  onClick={() => setSelectedPosId(p.id)}
                >
                  <div className={styles.positionItemHeader}>
                    <span className={styles.positionItemName}>{p.name}</span>
                    {!p.is_active && (
                      <Badge variant="default">Inactivo</Badge>
                    )}
                  </div>
                  {p.description && (
                    <span className={styles.positionItemDesc}>{p.description}</span>
                  )}
                  <div className={styles.positionItemMeta}>
                    {services.filter((s) => s.position_id === p.id).length} servicio(s)
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Services detail */}
        <div className={styles.detailPanel}>
          {selectedPos ? (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h3 className={styles.detailTitle}>
                    Servicios de {selectedPos.name}
                  </h3>
                  {selectedPos.description && (
                    <p className={styles.detailDesc}>{selectedPos.description}</p>
                  )}
                </div>
                <div className={styles.detailActions}>
                  <Button size="sm" variant="ghost" onClick={() => openEditPos(selectedPos)}>
                    Editar puesto
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => togglePosActive(selectedPos)}>
                    {selectedPos.is_active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button size="sm" onClick={openCreateSvc}>
                    Nuevo servicio
                  </Button>
                </div>
              </div>

              <DataTable
                columns={svcColumns}
                data={filteredServices}
                keyExtractor={(r) => r.id}
                emptyTitle="Sin servicios"
                emptyDescription={`Agrega servicios para el puesto de ${selectedPos.name}.`}
              />
            </>
          ) : (
            <div className={styles.detailEmpty}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p>Selecciona un puesto para ver y gestionar sus servicios.</p>
            </div>
          )}
        </div>
      </div>

      {/* Position Modal */}
      <Modal open={posModal} onClose={() => setPosModal(false)} title={editPos ? "Editar Puesto" : "Nuevo Puesto"} size="sm">
        <form onSubmit={handlePosSubmit} className={styles.modalForm}>
          <Input label="Nombre *" value={posName} onChange={(e) => setPosName(e.target.value)} placeholder="Ej: Desarrollador, Diseñador" required />
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Descripción</label>
            <textarea
              className={styles.textarea}
              rows={3}
              value={posDesc}
              onChange={(e) => setPosDesc(e.target.value)}
              placeholder="Describe las responsabilidades del puesto..."
            />
          </div>
          <Button type="submit" isLoading={posSaving} style={{ width: "100%" }}>
            {editPos ? "Guardar cambios" : "Crear puesto"}
          </Button>
        </form>
      </Modal>

      {/* Service Modal */}
      <Modal open={svcModal} onClose={() => setSvcModal(false)} title={editSvc ? "Editar Servicio" : "Nuevo Servicio"} size="sm">
        <form onSubmit={handleSvcSubmit} className={styles.modalForm}>
          <Input label="Nombre *" value={svcName} onChange={(e) => setSvcName(e.target.value)} placeholder="Ej: Diseño de logo" required />
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Descripción</label>
            <textarea
              className={styles.textarea}
              rows={3}
              value={svcDesc}
              onChange={(e) => setSvcDesc(e.target.value)}
              placeholder="Describe el servicio..."
            />
          </div>
          <Input label="Precio base" type="number" step="0.01" min="0" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)} placeholder="0.00" />
          <Button type="submit" isLoading={svcSaving} style={{ width: "100%" }}>
            {editSvc ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
