"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, Input, Spinner, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { TICKET_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import styles from "./page.module.css";

interface TicketDetail {
  id: number;
  user_id: string;
  service_id: number | null;
  member_id: number | null;
  client_id: number | null;
  title: string | null;
  description: string | null;
  status: string;
  deadline: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  google_event_id: string | null;
  google_meet_link: string | null;
  created_at: string;
  client_name: string | null;
  client_email: string | null;
  member_name: string | null;
  member_email: string | null;
  service_name: string | null;
}

const BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  confirmed: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "error",
  withdrawn: "default",
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const ticketId = Number(params.id);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [workDays, setWorkDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [savingReject, setSavingReject] = useState(false);

  // Confirmation calendar modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [savingConfirm, setSavingConfirm] = useState(false);

  // Edit work days modal
  const [showEditDaysModal, setShowEditDaysModal] = useState(false);
  const [editDates, setEditDates] = useState<string[]>([]);
  const [editReason, setEditReason] = useState("");
  const [savingEditDays, setSavingEditDays] = useState(false);

  // Member status update
  const [savingMemberStatus, setSavingMemberStatus] = useState(false);

  // Withdrawn modal (desistido with reason)
  const [showWithdrawnModal, setShowWithdrawnModal] = useState(false);
  const [withdrawnReason, setWithdrawnReason] = useState("");

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTicket(json.data);
    } catch {
      toast("Error al cargar ticket", "error");
      router.push("/dashboard/tickets");
    }
  }, [ticketId, toast, router]);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/slots`);
      const json = await res.json();
      const dates = ((json.data || []) as { date: string }[])
        .map((s) => s.date.split("T")[0])
        .sort();
      setWorkDays(dates);
    } catch {
      /* silent */
    }
  }, [ticketId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTicket(), fetchSlots()]).finally(() => setLoading(false));
  }, [fetchTicket, fetchSlots]);

  // Role checks
  const isMemberAssigned = user?.role === "member" && user.member_id != null && ticket?.member_id === user.member_id;
  const isCreator = user?.id === ticket?.user_id;
  const isPending = ticket?.status === "pending";

  // Creator can only delete while ticket is still pending
  const canDelete = isCreator && isPending;

  // Member rejects ticket
  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setSavingReject(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellation_reason: rejectReason.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Ticket rechazado", "success");
      setShowRejectModal(false);
      setRejectReason("");
      fetchTicket();
    } catch {
      toast("Error al rechazar", "error");
    } finally {
      setSavingReject(false);
    }
  };

  // Member confirms ticket with selected work dates
  const handleConfirm = async () => {
    if (selectedDates.length === 0) return;
    setSavingConfirm(true);
    try {
      const statusRes = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (!statusRes.ok) throw new Error();

      for (const date of selectedDates) {
        await fetch(`/api/tickets/${ticketId}/slots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            start_time: "00:00",
            end_time: "23:59",
          }),
        });
      }

      toast("Ticket confirmado con fechas de trabajo", "success");
      setShowConfirmModal(false);
      setSelectedDates([]);
      fetchTicket();
      fetchSlots();
    } catch {
      toast("Error al confirmar", "error");
    } finally {
      setSavingConfirm(false);
    }
  };

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) =>
      prev.includes(dateStr)
        ? prev.filter((d) => d !== dateStr)
        : [...prev, dateStr].sort()
    );
  };

  const toggleEditDate = (dateStr: string) => {
    setEditDates((prev) =>
      prev.includes(dateStr)
        ? prev.filter((d) => d !== dateStr)
        : [...prev, dateStr].sort()
    );
  };

  const openEditDaysModal = () => {
    setEditDates([...workDays]);
    setEditReason("");
    setShowEditDaysModal(true);
  };

  const handleEditDays = async () => {
    if (editDates.length === 0 || !editReason.trim()) return;
    setSavingEditDays(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/slots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: editDates,
          reason: editReason.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Días actualizados y cliente notificado", "success");
      setShowEditDaysModal(false);
      fetchSlots();
    } catch {
      toast("Error al actualizar días", "error");
    } finally {
      setSavingEditDays(false);
    }
  };

  // Member updates ticket status (completed / cancelled — no reason needed)
  const handleMemberStatus = async (newStatus: string) => {
    if (newStatus === "withdrawn") {
      setWithdrawnReason("");
      setShowWithdrawnModal(true);
      return;
    }
    const labels: Record<string, string> = {
      completed: "completar",
      cancelled: "cancelar",
    };
    if (!confirm(`¿Estás seguro de ${labels[newStatus] || "cambiar"} este ticket?`)) return;
    setSavingMemberStatus(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast("Estado actualizado y cliente notificado", "success");
      fetchTicket();
    } catch {
      toast("Error al actualizar estado", "error");
    } finally {
      setSavingMemberStatus(false);
    }
  };

  // Member withdraws with required reason
  const handleWithdrawn = async () => {
    if (!withdrawnReason.trim()) return;
    setSavingMemberStatus(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "withdrawn",
          cancellation_reason: withdrawnReason.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Ticket desistido y cliente notificado", "success");
      setShowWithdrawnModal(false);
      setWithdrawnReason("");
      fetchTicket();
    } catch {
      toast("Error al desistir", "error");
    } finally {
      setSavingMemberStatus(false);
    }
  };

  // Delete ticket
  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar este ticket?")) return;
    try {
      await fetch(`/api/tickets/${ticketId}`, { method: "DELETE" });
      toast("Ticket eliminado", "success");
      router.push("/dashboard/tickets");
    } catch {
      toast("Error al eliminar", "error");
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div>
      <PageHeader
        title={`Ticket #${ticket.id}`}
        description={ticket.title || "Sin título"}
        action={
          <div className={styles.headerActions}>
            <Button variant="ghost" onClick={() => router.push("/dashboard/tickets")}>
              Volver
            </Button>
            {canDelete && (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                Eliminar
              </Button>
            )}
          </div>
        }
      />

      <div className={styles.grid}>
        {/* Left column: main info */}
        <div className={styles.main}>
          <Card>
            <div className={styles.mainContent}>
              {/* Status */}
              <div className={styles.statusSection}>
                <Badge variant={BADGE_VARIANT[ticket.status] || "default"}>
                  {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                </Badge>
                {/* Member pending actions */}
                {isMemberAssigned && isPending && (
                  <div className={styles.memberActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRejectModal(true)}
                    >
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowConfirmModal(true)}
                    >
                      Confirmar
                    </Button>
                  </div>
                )}
              </div>

              {/* Cancellation / withdrawal reason */}
              {(ticket.status === "cancelled" || ticket.status === "withdrawn") && ticket.cancellation_reason && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    {ticket.status === "withdrawn" ? "Motivo de desistimiento" : "Motivo de rechazo"}
                  </h3>
                  <p className={styles.description}>{ticket.cancellation_reason}</p>
                </div>
              )}

              {/* Description */}
              {ticket.description && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Descripción</h3>
                  <p className={styles.description}>{ticket.description}</p>
                </div>
              )}

              {/* Work days */}
              {workDays.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Días de trabajo</h3>
                    {isMemberAssigned && !isPending && ticket.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" onClick={openEditDaysModal}>
                        Editar días
                      </Button>
                    )}
                  </div>
                  <div className={styles.workDays}>
                    {workDays.map((d) => (
                      <span key={d} className={styles.workDayChip}>
                        {formatDate(d)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Member status actions */}
          {isMemberAssigned && (ticket.status === "confirmed" || ticket.status === "in_progress") && (
            <div className={styles.memberStatusActions}>
              <Button
                size="sm"
                onClick={() => handleMemberStatus("completed")}
                isLoading={savingMemberStatus}
              >
                Completado
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleMemberStatus("withdrawn")}
                isLoading={savingMemberStatus}
              >
                Desistido
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleMemberStatus("cancelled")}
                isLoading={savingMemberStatus}
              >
                Cancelado
              </Button>
            </div>
          )}
        </div>

        {/* Right column: sidebar info */}
        <div className={styles.sidebar}>
          <Card>
            <h3 className={styles.cardTitle}>Detalles</h3>
            <div className={styles.detailStack}>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Cliente</span>
                <span className={styles.detailValue}>
                  {ticket.client_name || "—"}
                </span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Miembro</span>
                <span className={styles.detailValue}>
                  {ticket.member_name || "Sin asignar"}
                </span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Servicio</span>
                <span className={styles.detailValue}>
                  {ticket.service_name || "—"}
                </span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Fecha límite</span>
                <span className={styles.detailValue}>
                  {ticket.deadline ? formatDate(ticket.deadline) : "—"}
                </span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Creado</span>
                <span className={styles.detailValue}>
                  {formatDateTime(ticket.created_at)}
                </span>
              </div>
              {ticket.completed_at && (
                <div className={styles.detailBlock}>
                  <span className={styles.detailLabel}>Completado</span>
                  <span className={styles.detailValue}>
                    {formatDateTime(ticket.completed_at)}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h3 className={styles.cardTitle}>Horas y Costo</h3>
            <div className={styles.costGrid}>
              <div className={styles.costItem}>
                <span className={styles.costValue}>
                  {ticket.estimated_hours != null ? `${ticket.estimated_hours}h` : "—"}
                </span>
                <span className={styles.costLabel}>Horas</span>
              </div>
              <div className={styles.costItem}>
                <span className={styles.costValue}>
                  {ticket.estimated_cost != null ? formatCurrency(ticket.estimated_cost) : "—"}
                </span>
                <span className={styles.costLabel}>Costo</span>
              </div>
            </div>
          </Card>

          {ticket.google_meet_link && (
            <Card>
              <h3 className={styles.cardTitle}>Google Meet</h3>
              <a
                href={ticket.google_meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.meetLink}
              >
                Unirse a la reunión
              </a>
            </Card>
          )}
        </div>
      </div>

      {/* Rejection Modal */}
      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} title="Rechazar Ticket" size="sm">
        <div className={styles.modalForm}>
          <p className={styles.modalHint}>
            Por favor indica el motivo por el cual rechazas este ticket. El cliente podrá ver esta razón.
          </p>
          <div className={styles.textarea}>
            <textarea
              className={styles.textareaInput}
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Escribe el motivo del rechazo..."
            />
          </div>
          <Button
            variant="danger"
            onClick={handleReject}
            isLoading={savingReject}
            disabled={!rejectReason.trim()}
            style={{ width: "100%" }}
          >
            Confirmar rechazo
          </Button>
        </div>
      </Modal>

      {/* Confirmation Calendar Modal */}
      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirmar Ticket" size="md">
        <div className={styles.modalForm}>
          <p className={styles.modalHint}>
            Selecciona los días en los que vas a trabajar en este ticket.
            {ticket.deadline && (
              <> Fecha límite: <strong>{formatDate(ticket.deadline)}</strong></>
            )}
          </p>

          <CalendarPicker
            selectedDates={selectedDates}
            onToggleDate={toggleDate}
            minDate={new Date().toISOString().split("T")[0]}
            maxDate={ticket.deadline || undefined}
          />

          {selectedDates.length > 0 && (
            <div className={styles.selectedDatesInfo}>
              <span>{selectedDates.length} día(s) seleccionado(s)</span>
            </div>
          )}

          <Button
            onClick={handleConfirm}
            isLoading={savingConfirm}
            disabled={selectedDates.length === 0}
            style={{ width: "100%" }}
          >
            Confirmar y programar ({selectedDates.length} día(s))
          </Button>
        </div>
      </Modal>

      {/* Withdrawn Modal (Desistido) */}
      <Modal open={showWithdrawnModal} onClose={() => setShowWithdrawnModal(false)} title="Desistir del Ticket" size="sm">
        <div className={styles.modalForm}>
          <p className={styles.modalHint}>
            Por favor indica el motivo por el cual desistes de este ticket. El cliente será notificado por correo.
          </p>
          <div className={styles.textarea}>
            <textarea
              className={styles.textareaInput}
              rows={4}
              value={withdrawnReason}
              onChange={(e) => setWithdrawnReason(e.target.value)}
              placeholder="Escribe el motivo..."
            />
          </div>
          <Button
            variant="danger"
            onClick={handleWithdrawn}
            isLoading={savingMemberStatus}
            disabled={!withdrawnReason.trim()}
            style={{ width: "100%" }}
          >
            Confirmar desistimiento
          </Button>
        </div>
      </Modal>

      {/* Edit Work Days Modal */}
      <Modal open={showEditDaysModal} onClose={() => setShowEditDaysModal(false)} title="Editar Días de Trabajo" size="md">
        <div className={styles.modalForm}>
          <div className={styles.textarea}>
            <label className={styles.textareaLabel}>Motivo del cambio *</label>
            <textarea
              className={styles.textareaInput}
              rows={3}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Explica por qué necesitas cambiar los días..."
            />
          </div>

          <p className={styles.modalHint}>
            Selecciona los nuevos días de trabajo.
            {ticket.deadline && (
              <> Fecha límite: <strong>{formatDate(ticket.deadline)}</strong></>
            )}
          </p>

          <CalendarPicker
            selectedDates={editDates}
            onToggleDate={toggleEditDate}
            minDate={new Date().toISOString().split("T")[0]}
            maxDate={ticket.deadline || undefined}
          />

          {editDates.length > 0 && (
            <div className={styles.selectedDatesInfo}>
              <span>{editDates.length} día(s) seleccionado(s)</span>
            </div>
          )}

          <Button
            onClick={handleEditDays}
            isLoading={savingEditDays}
            disabled={editDates.length === 0 || !editReason.trim()}
            style={{ width: "100%" }}
          >
            Guardar y notificar al cliente
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ----- Calendar Picker Component -----

function CalendarPicker({
  selectedDates,
  onToggleDate,
  minDate,
  maxDate,
}: {
  selectedDates: string[];
  onToggleDate: (date: string) => void;
  minDate: string;
  maxDate?: string;
}) {
  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(minDate);
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(minDate);
    return d.getMonth();
  });

  const DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(dateStr);
  }

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isDisabled = (dateStr: string) => {
    if (dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarNav}>
        <button type="button" className={styles.calendarNavBtn} onClick={prevMonth}>
          &#8249;
        </button>
        <span className={styles.calendarTitle}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" className={styles.calendarNavBtn} onClick={nextMonth}>
          &#8250;
        </button>
      </div>
      <div className={styles.calendarGrid}>
        {DAYS.map((d) => (
          <div key={d} className={styles.calendarDayHeader}>{d}</div>
        ))}
        {cells.map((dateStr, i) => {
          if (!dateStr) {
            return <div key={`empty-${i}`} className={styles.calendarCell} />;
          }
          const disabled = isDisabled(dateStr);
          const selected = selectedDates.includes(dateStr);
          const dayNum = parseInt(dateStr.split("-")[2], 10);

          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled}
              className={`${styles.calendarDay} ${selected ? styles.calendarDaySelected : ""} ${disabled ? styles.calendarDayDisabled : ""}`}
              onClick={() => !disabled && onToggleDate(dateStr)}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
