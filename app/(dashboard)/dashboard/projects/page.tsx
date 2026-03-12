"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, DataTable, Tabs, Input, Spinner } from "@/components/ui";
import Avatar from "@/components/ui/Avatar";
import type { Column } from "@/components/ui/DataTable";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import CreateProjectModal from "./[id]/_components/CreateProjectModal";
import styles from "./page.module.css";

interface AcceptedMemberSummary {
  name: string;
  photo_url: string | null;
}

interface ProjectRow {
  id: number;
  title: string;
  status: string;
  client_name: string | null;
  accepted_members: AcceptedMemberSummary[];
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  updated_at: string;
}

const BASE_TABS = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "open", label: "Abiertos" },
  { value: "in_progress", label: "En Progreso" },
  { value: "review", label: "En Revisión" },
  { value: "completed", label: "Completados" },
  { value: "closed", label: "Cerrados" },
  { value: "cancelled", label: "Cancelados" },
];

const BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  draft: "default",
  open: "info",
  in_progress: "warning",
  review: "warning",
  completed: "success",
  closed: "success",
  cancelled: "error",
};

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isMember = user?.role === "member";
  const isClient = user?.role === "client";
  const [data, setData] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const tabs = isMember
    ? [{ value: "invited", label: "Invitado" }, ...BASE_TABS]
    : isClient
    ? [{ value: "mine", label: "Mis Proyectos" }, ...BASE_TABS]
    : BASE_TABS;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    if (statusFilter === "invited" && isMember && user?.member_id) {
      params.set("invited_member_id", String(user.member_id));
    } else if (statusFilter === "mine" && isClient) {
      params.set("my_projects", "true");
    } else {
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (isMember && user?.member_id) {
        params.set("visible_to_member_id", String(user.member_id));
      }
    }
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
  }, [page, statusFilter, search, isMember, isClient, user?.member_id]);

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
      key: "members",
      header: "Miembros",
      render: (r) => {
        const members = r.accepted_members || [];
        if (members.length === 0) return <span className={styles.noMembers}>Sin asignar</span>;
        return (
          <div className={styles.memberAvatars}>
            {members.map((m, i) => (
              <span key={i} className={styles.memberAvatarWrap} title={m.name}>
                <Avatar src={m.photo_url} name={m.name} size="xs" />
              </span>
            ))}
          </div>
        );
      },
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
          !isMember ? <Button onClick={() => setShowCreate(true)}>Nuevo Proyecto</Button> : undefined
        }
      />

      <Tabs
        tabs={tabs}
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
          emptyAction={!isMember ? <Button onClick={() => setShowCreate(true)}>Nuevo Proyecto</Button> : undefined}
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
