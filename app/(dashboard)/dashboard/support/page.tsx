"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, DataTable, Input, Select, Spinner, Tabs, Modal } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatDate } from "@/lib/utils";
import styles from "./page.module.css";

const TYPE_OPTIONS = [
  { value: "bug", label: "Reporte de error" },
  { value: "feature", label: "Sugerencia o mejora" },
  { value: "question", label: "Pregunta general" },
  { value: "other", label: "Otro" },
];

const TYPE_LABELS: Record<string, string> = {
  bug: "Error",
  feature: "Sugerencia",
  question: "Pregunta",
  other: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  in_progress: "En proceso",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const STATUS_BADGE: Record<string, "info" | "warning" | "success" | "default"> = {
  open: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "default",
};

interface TicketRow {
  id: number;
  type: string;
  subject: string;
  status: string;
  reply_count: number;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export default function SupportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const tabs = [
    { value: "all", label: "Todos" },
    { value: "open", label: "Abiertos" },
    { value: "in_progress", label: "En proceso" },
    { value: "resolved", label: "Resueltos" },
    { value: "closed", label: "Cerrados" },
  ];

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    if (statusFilter !== "all") params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/support?${params}`);
      const json = await res.json();
      setTickets(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "support");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAttachmentUrl(json.url);
    } catch {
      toast("Error al subir archivo", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, subject, message, attachment_url: attachmentUrl || undefined }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error al enviar");
      }
      toast("Ticket creado correctamente", "success");
      setShowCreate(false);
      setType(""); setSubject(""); setMessage(""); setAttachmentUrl("");
      fetchTickets();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear ticket", "error");
    } finally {
      setSending(false);
    }
  };

  const columns: Column<TicketRow>[] = [
    {
      key: "id",
      header: "#",
      width: "60px",
      render: (r) => <span className={styles.ticketId}>#{r.id}</span>,
    },
    {
      key: "type",
      header: "Tipo",
      width: "110px",
      render: (r) => <Badge variant="default" size="sm">{TYPE_LABELS[r.type] || r.type}</Badge>,
    },
    {
      key: "subject",
      header: "Asunto",
      render: (r) => r.subject,
    },
    ...(isAdmin
      ? [{
          key: "user" as keyof TicketRow,
          header: "Usuario",
          render: (r: TicketRow) => <span className={styles.userCell}>{r.user_name}</span>,
        }]
      : []),
    {
      key: "status",
      header: "Estado",
      width: "120px",
      render: (r) => (
        <Badge variant={STATUS_BADGE[r.status] || "default"}>
          {STATUS_LABELS[r.status] || r.status}
        </Badge>
      ),
    },
    {
      key: "reply_count",
      header: "Respuestas",
      width: "100px",
      render: (r) => r.reply_count || 0,
    },
    {
      key: "created_at",
      header: "Creado",
      width: "120px",
      render: (r) => formatDate(r.created_at),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Soporte y Contacto"
        description="Envía reportes, sugerencias o consultas a nuestro equipo."
        action={
          <Button onClick={() => setShowCreate(true)}>Nuevo Ticket</Button>
        }
      />

      <Tabs tabs={tabs} active={statusFilter} onChange={(v) => setStatusFilter(v)} />

      {loading ? (
        <div className={styles.loading}><Spinner /></div>
      ) : (
        <DataTable
          columns={columns}
          data={tickets}
          keyExtractor={(r) => r.id}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(r) => router.push(`/dashboard/support/${r.id}`)}
          emptyTitle="Sin tickets"
          emptyDescription="No hay tickets de soporte. Crea uno nuevo si necesitas ayuda."
          emptyAction={<Button onClick={() => setShowCreate(true)}>Nuevo Ticket</Button>}
        />
      )}

      {/* Create Ticket Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Ticket de Soporte" size="md">
        <form onSubmit={handleSubmit} className={styles.form}>
          <Select
            label="Tipo *"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Selecciona una categoría"
            required
          />
          <Input
            label="Asunto *"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Describe brevemente el tema"
            required
          />
          <div className={styles.textareaBlock}>
            <label className={styles.textareaLabel}>Mensaje *</label>
            <textarea
              className={styles.textareaField}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe el problema o sugerencia con detalle..."
              required
            />
          </div>

          {/* Attachment */}
          <div className={styles.attachBlock}>
            <label className={styles.textareaLabel}>Adjuntar imagen (opcional)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className={styles.fileInput}
            />
            {uploading && <Spinner size="sm" />}
            {attachmentUrl && (
              <div className={styles.attachPreview}>
                <img src={attachmentUrl} alt="Adjunto" className={styles.attachImg} />
                <button
                  type="button"
                  className={styles.attachRemove}
                  onClick={() => { setAttachmentUrl(""); if (fileRef.current) fileRef.current.value = ""; }}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>

          <Button type="submit" isLoading={sending} style={{ width: "100%" }}>
            Enviar ticket
          </Button>
        </form>
      </Modal>
    </div>
  );
}
