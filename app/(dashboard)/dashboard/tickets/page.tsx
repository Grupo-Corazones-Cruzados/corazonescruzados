"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, DataTable, Tabs, Input, Spinner } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { TICKET_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import CreateTicketModal from "./_components/CreateTicketModal";
import styles from "./page.module.css";

interface TicketRow {
  id: number;
  title: string | null;
  status: string;
  client_name: string | null;
  member_name: string | null;
  service_name: string | null;
  deadline: string | null;
  work_days: string[];
  created_at: string;
}

const STATUS_TABS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "confirmed", label: "Confirmados" },
  { value: "completed", label: "Completados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "withdrawn", label: "Desistidos" },
];

const BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  confirmed: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "error",
  withdrawn: "default",
};

export default function TicketsPage() {
  const router = useRouter();
  const [data, setData] = useState<TicketRow[]>([]);
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
      const res = await fetch(`/api/tickets?${params}`);
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

  const columns: Column<TicketRow>[] = [
    {
      key: "id",
      header: "#",
      width: "60px",
      render: (r) => <span className={styles.ticketId}>#{r.id}</span>,
    },
    {
      key: "title",
      header: "Título",
      render: (r) => r.title || "Sin título",
    },
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <Badge variant={BADGE_VARIANT[r.status] || "default"}>
          {TICKET_STATUS_LABELS[r.status] || r.status}
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
      key: "service",
      header: "Servicio",
      render: (r) => r.service_name || "—",
    },
    {
      key: "date",
      header: "Fecha límite",
      render: (r) =>
        r.deadline ? formatDate(r.deadline) : "—",
    },
    {
      key: "work_days",
      header: "Próximo día",
      render: (r) => {
        if (!r.work_days || r.work_days.length === 0) return "—";
        const today = new Date().toISOString().split("T")[0];
        const next = r.work_days
          .map((d: string) => d.split("T")[0])
          .sort()
          .find((d: string) => d >= today);
        return next ? formatDate(next) : <span className={styles.workDaysPast}>Completado</span>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Gestiona tus tickets de soporte."
        action={
          <Button onClick={() => setShowCreate(true)}>Nuevo Ticket</Button>
        }
      />

      <Tabs
        tabs={STATUS_TABS}
        active={statusFilter}
        onChange={(v) => setStatusFilter(v)}
      />

      <div className={styles.toolbar}>
        <Input
          placeholder="Buscar tickets..."
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
          onRowClick={(r) => router.push(`/dashboard/tickets/${r.id}`)}
          emptyTitle="Sin tickets"
          emptyDescription="No hay tickets que mostrar. Crea uno nuevo para comenzar."
          emptyAction={<Button onClick={() => setShowCreate(true)}>Nuevo Ticket</Button>}
        />
      )}

      <CreateTicketModal
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
