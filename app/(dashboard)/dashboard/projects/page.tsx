"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, DataTable, Tabs, Input, Spinner } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";
import CreateProjectModal from "./[id]/_components/CreateProjectModal";
import styles from "./page.module.css";

interface ProjectRow {
  id: number;
  title: string;
  status: string;
  client_name: string | null;
  member_name: string | null;
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  updated_at: string;
}

const STATUS_TABS = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "open", label: "Abiertos" },
  { value: "in_progress", label: "En Progreso" },
  { value: "review", label: "En Revisión" },
  { value: "completed", label: "Completados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "on_hold", label: "En Espera" },
];

const BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  draft: "default",
  open: "info",
  in_progress: "warning",
  review: "warning",
  completed: "success",
  cancelled: "error",
  on_hold: "default",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [data, setData] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/projects?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const columns: Column<ProjectRow>[] = [
    {
      key: "id",
      header: "#",
      width: "60px",
      render: (r) => <span className={styles.projectId}>#{r.id}</span>,
    },
    {
      key: "title",
      header: "Título",
      render: (r) => r.title,
    },
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <Badge variant={BADGE_VARIANT[r.status] || "default"}>
          {PROJECT_STATUS_LABELS[r.status as keyof typeof PROJECT_STATUS_LABELS] || r.status}
        </Badge>
      ),
    },
    {
      key: "client",
      header: "Cliente",
      render: (r) => r.client_name || "—",
    },
    {
      key: "member",
      header: "Miembro",
      render: (r) => r.member_name || "Sin asignar",
    },
    {
      key: "budget",
      header: "Presupuesto",
      render: (r) => {
        if (r.budget_min && r.budget_max)
          return `${formatCurrency(r.budget_min)} — ${formatCurrency(r.budget_max)}`;
        if (r.budget_max) return formatCurrency(r.budget_max);
        return "—";
      },
    },
    {
      key: "deadline",
      header: "Fecha límite",
      render: (r) => (r.deadline ? formatDate(r.deadline) : "—"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Proyectos"
        description="Publica y gestiona proyectos."
        action={
          <Button onClick={() => setShowCreate(true)}>Nuevo Proyecto</Button>
        }
      />

      <Tabs
        tabs={STATUS_TABS}
        active={statusFilter}
        onChange={(v) => setStatusFilter(v)}
      />

      <div className={styles.toolbar}>
        <Input
          placeholder="Buscar proyectos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
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
          onRowClick={(r) => router.push(`/dashboard/projects/${r.id}`)}
          emptyTitle="Sin proyectos"
          emptyDescription="No hay proyectos que mostrar. Crea uno nuevo para comenzar."
        />
      )}

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchData();
        }}
      />
    </div>
  );
}
