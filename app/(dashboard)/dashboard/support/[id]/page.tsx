"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, Spinner } from "@/components/ui";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatDate } from "@/lib/utils";
import styles from "./page.module.css";

const TYPE_LABELS: Record<string, string> = {
  bug: "Reporte de error",
  feature: "Sugerencia o mejora",
  question: "Pregunta general",
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

interface TicketDetail {
  id: number;
  user_id: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_email: string;
  user_role: string;
}

interface Reply {
  id: number;
  ticket_id: number;
  user_id: string;
  message: string;
  attachment_url: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  user_role: string;
}

export default function SupportTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const ticketId = Number(params.id);
  const isAdmin = user?.role === "admin";

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);

  // Reply form
  const [replyText, setReplyText] = useState("");
  const [replyAttachment, setReplyAttachment] = useState("");
  const [uploadingReply, setUploadingReply] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);

  // Status change
  const [savingStatus, setSavingStatus] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/support/${ticketId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTicket(json.data);
    } catch {
      toast("Error al cargar ticket", "error");
      router.push("/dashboard/support");
    }
  }, [ticketId, toast, router]);

  const fetchReplies = useCallback(async () => {
    try {
      const res = await fetch(`/api/support/${ticketId}/replies`);
      const json = await res.json();
      setReplies(json.data || []);
    } catch { /* silent */ }
  }, [ticketId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchTicket(), fetchReplies()]);
      setLoading(false);
    }
    load();
  }, [fetchTicket, fetchReplies]);

  const handleReplyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReply(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "support");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setReplyAttachment(json.url);
    } catch {
      toast("Error al subir archivo", "error");
    } finally {
      setUploadingReply(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/support/${ticketId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText, attachment_url: replyAttachment || undefined }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
      setReplyText("");
      setReplyAttachment("");
      if (replyFileRef.current) replyFileRef.current.value = "";
      fetchReplies();
      fetchTicket();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al enviar respuesta", "error");
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast("Estado actualizado", "success");
      fetchTicket();
    } catch {
      toast("Error al actualizar estado", "error");
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}><Spinner /></div>;
  }

  if (!ticket) return null;

  const isClosed = ticket.status === "closed";
  const isOwner = ticket.user_id === user?.id;

  return (
    <div>
      <PageHeader
        title={`Ticket #${ticket.id}`}
        description={ticket.subject}
        action={
          <Button variant="ghost" onClick={() => router.push("/dashboard/support")}>
            Volver
          </Button>
        }
      />

      <div className={styles.grid}>
        <div className={styles.main}>
          {/* Original message */}
          <Card>
            <h3 className={styles.cardTitle}>Mensaje original</h3>
            <p className={styles.messageBody}>{ticket.message}</p>
            {ticket.attachment_url && (
              <div className={styles.attachment}>
                <a href={ticket.attachment_url} target="_blank" rel="noopener noreferrer">
                  <img src={ticket.attachment_url} alt="Adjunto" className={styles.attachImg} />
                </a>
              </div>
            )}
          </Card>

          {/* Replies */}
          <Card>
            <h3 className={styles.cardTitle}>Conversación ({replies.length})</h3>
            {replies.length === 0 ? (
              <p className={styles.empty}>Sin respuestas aún</p>
            ) : (
              <div className={styles.replyList}>
                {replies.map((r) => (
                  <div
                    key={r.id}
                    className={`${styles.replyItem} ${r.user_role === "admin" ? styles.replyAdmin : ""}`}
                  >
                    <div className={styles.replyHeader}>
                      <div className={styles.replyAuthor}>
                        <Avatar name={r.user_name} size="xs" />
                        <span className={styles.replyName}>
                          {r.user_name}
                          {r.user_role === "admin" && (
                            <Badge variant="info" size="sm" style={{ marginLeft: 6 }}>Admin</Badge>
                          )}
                        </span>
                      </div>
                      <span className={styles.replyDate}>{formatDate(r.created_at)}</span>
                    </div>
                    <p className={styles.replyBody}>{r.message}</p>
                    {r.attachment_url && (
                      <div className={styles.replyAttach}>
                        <a href={r.attachment_url} target="_blank" rel="noopener noreferrer">
                          <img src={r.attachment_url} alt="Adjunto" className={styles.attachImg} style={{ maxWidth: 200 }} />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Reply form */}
            {isClosed ? (
              <div className={styles.closedBanner}>Este ticket está cerrado.</div>
            ) : (
              <form onSubmit={handleSendReply} className={styles.replyForm} style={{ marginTop: "var(--space-4)" }}>
                <textarea
                  className={styles.replyTextarea}
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escribe una respuesta..."
                  required
                />
                <div className={styles.replyActions}>
                  <input
                    ref={replyFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReplyFileUpload}
                    className={styles.replyFileInput}
                  />
                  {uploadingReply && <Spinner size="sm" />}
                  {replyAttachment && (
                    <div className={styles.replyAttachPreview}>
                      <img src={replyAttachment} alt="Adjunto" className={styles.replyAttachImg} />
                      <button
                        type="button"
                        className={styles.replyAttachRemove}
                        onClick={() => { setReplyAttachment(""); if (replyFileRef.current) replyFileRef.current.value = ""; }}
                      >
                        x
                      </button>
                    </div>
                  )}
                </div>
                <Button type="submit" isLoading={sendingReply} size="sm">
                  Enviar respuesta
                </Button>
              </form>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <Card>
            <h3 className={styles.cardTitle}>Detalles</h3>
            <div className={styles.detailStack}>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Estado</span>
                <Badge variant={STATUS_BADGE[ticket.status] || "default"}>
                  {STATUS_LABELS[ticket.status] || ticket.status}
                </Badge>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Tipo</span>
                <span className={styles.detailValue}>{TYPE_LABELS[ticket.type] || ticket.type}</span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Creado por</span>
                <span className={styles.detailValue}>{ticket.user_name}</span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Email</span>
                <span className={styles.detailValue}>{ticket.user_email}</span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Creado</span>
                <span className={styles.detailValue}>{formatDate(ticket.created_at)}</span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Actualizado</span>
                <span className={styles.detailValue}>{formatDate(ticket.updated_at)}</span>
              </div>
            </div>

            {/* Status change actions */}
            {!isClosed && (isAdmin || isOwner) && (
              <div className={styles.statusActions}>
                {isAdmin && ticket.status === "open" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    style={{ width: "100%" }}
                    onClick={() => handleStatusChange("in_progress")}
                    isLoading={savingStatus}
                  >
                    Marcar en proceso
                  </Button>
                )}
                {isAdmin && (ticket.status === "open" || ticket.status === "in_progress") && (
                  <Button
                    size="sm"
                    style={{ width: "100%" }}
                    onClick={() => handleStatusChange("resolved")}
                    isLoading={savingStatus}
                  >
                    Marcar resuelto
                  </Button>
                )}
                {(isOwner || isAdmin) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    style={{ width: "100%" }}
                    onClick={() => handleStatusChange("closed")}
                    isLoading={savingStatus}
                  >
                    Cerrar ticket
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
