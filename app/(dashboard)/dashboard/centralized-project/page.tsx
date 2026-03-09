"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, DataTable, Tabs, Input, Spinner, Modal, Select } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { APPLICANT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import styles from "./page.module.css";

interface ApplicantRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  source: string | null;
  created_at: string;
}

interface EventRow {
  id: number;
  title: string;
  event_date: string;
  location: string | null;
  type: string;
  max_capacity: number | null;
}

type MainTab = "recruitment";
type RecruitmentTab = "applicants" | "events";

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  applied: "default",
  screening: "info",
  interview: "info",
  evaluation: "warning",
  accepted: "success",
  rejected: "error",
  withdrawn: "default",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  interview: "Entrevista",
  evaluation: "Evaluación",
  orientation: "Orientación",
  training: "Capacitación",
};

export default function CentralizedProjectPage() {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState<MainTab>("recruitment");

  return (
    <div>
      <PageHeader
        title="Proyecto Centralizado"
        description="Gestión centralizada del proyecto y sus procesos."
      />

      <Tabs
        tabs={[
          { value: "recruitment", label: "Reclutamiento" },
        ]}
        active={mainTab}
        onChange={(v) => setMainTab(v as MainTab)}
      />

      {mainTab === "recruitment" && <RecruitmentSection toast={toast} />}
    </div>
  );
}

// ---- Recruitment Section (with sub-tabs) ----

function RecruitmentSection({ toast }: { toast: (m: string, t: "success" | "error") => void }) {
  const [tab, setTab] = useState<RecruitmentTab>("applicants");

  return (
    <div className={styles.section}>
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTab} ${tab === "applicants" ? styles.subTabActive : ""}`}
          onClick={() => setTab("applicants")}
        >
          Aspirantes
        </button>
        <button
          className={`${styles.subTab} ${tab === "events" ? styles.subTabActive : ""}`}
          onClick={() => setTab("events")}
        >
          Eventos
        </button>
      </div>

      {tab === "applicants" && <ApplicantsTable toast={toast} />}
      {tab === "events" && <EventsTable toast={toast} />}
    </div>
  );
}

// ---- Applicants ----

function ApplicantsTable({ toast }: { toast: (m: string, t: "success" | "error") => void }) {
  const [data, setData] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/applicants?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      toast("Error al cargar aspirantes", "error");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const updateStatus = async (id: number, status: string) => {
    try {
      await fetch(`/api/applicants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast("Estado actualizado", "success");
      fetchData();
    } catch {
      toast("Error", "error");
    }
  };

  const columns: Column<ApplicantRow>[] = [
    {
      key: "name",
      header: "Nombre",
      render: (r) => `${r.first_name} ${r.last_name}`,
    },
    { key: "email", header: "Email", render: (r) => r.email },
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <Select
          options={Object.entries(APPLICANT_STATUS_LABELS).map(([v, l]) => ({
            value: v,
            label: l,
          }))}
          value={r.status}
          onChange={(e) => updateStatus(r.id, e.target.value)}
        />
      ),
    },
    { key: "source", header: "Fuente", render: (r) => r.source || "—" },
    { key: "date", header: "Fecha", render: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <Input
          placeholder="Buscar aspirantes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
        <Button size="sm" onClick={() => setShowCreate(true)}>
          Nuevo Aspirante
        </Button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          keyExtractor={(r) => r.id}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyTitle="Sin aspirantes"
          emptyDescription="No hay aspirantes registrados."
        />
      )}

      <CreateApplicantModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchData();
        }}
        toast={toast}
      />
    </>
  );
}

function CreateApplicantModal({
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/applicants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || undefined,
          source: source || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
      toast("Aspirante creado", "success");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setSource("");
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Aspirante" size="sm">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <Input label="Nombre *" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Input label="Apellido *" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Fuente" value={source} onChange={(e) => setSource(e.target.value)} placeholder="LinkedIn, referido, etc." />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear aspirante
        </Button>
      </form>
    </Modal>
  );
}

// ---- Events ----

function EventsTable({ toast }: { toast: (m: string, t: "success" | "error") => void }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recruitment-events");
      const json = await res.json();
      setEvents(json.data || []);
    } catch {
      toast("Error al cargar eventos", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<EventRow>[] = [
    { key: "title", header: "Título", render: (r) => r.title },
    {
      key: "type",
      header: "Tipo",
      render: (r) => (
        <Badge variant="info">{EVENT_TYPE_LABELS[r.type] || r.type}</Badge>
      ),
    },
    { key: "date", header: "Fecha", render: (r) => formatDateTime(r.event_date) },
    { key: "location", header: "Ubicación", render: (r) => r.location || "—" },
    {
      key: "capacity",
      header: "Capacidad",
      render: (r) => (r.max_capacity ? String(r.max_capacity) : "—"),
    },
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          Nuevo Evento
        </Button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={events}
          keyExtractor={(r) => r.id}
          emptyTitle="Sin eventos"
          emptyDescription="No hay eventos de reclutamiento."
        />
      )}

      <CreateEventModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchData();
        }}
        toast={toast}
      />
    </>
  );
}

function CreateEventModal({
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
  const [title, setTitle] = useState("");
  const [type, setType] = useState("interview");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/recruitment-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          event_date: eventDate,
          location: location || undefined,
          max_capacity: capacity ? Number(capacity) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Evento creado", "success");
      setTitle("");
      setType("interview");
      setEventDate("");
      setLocation("");
      setCapacity("");
      onCreated();
    } catch {
      toast("Error al crear evento", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Evento" size="sm">
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input label="Título *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Select
          label="Tipo *"
          options={[
            { value: "interview", label: "Entrevista" },
            { value: "evaluation", label: "Evaluación" },
            { value: "orientation", label: "Orientación" },
            { value: "training", label: "Capacitación" },
          ]}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <Input label="Fecha y hora *" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        <Input label="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Input label="Capacidad máxima" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear evento
        </Button>
      </form>
    </Modal>
  );
}
