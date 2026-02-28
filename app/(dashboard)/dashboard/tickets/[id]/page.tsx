"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, Input, Select, Spinner, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { TICKET_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import styles from "./page.module.css";

interface TicketDetail {
  id: number;
  client_id: number;
  service_id: number | null;
  member_id: number | null;
  title: string | null;
  description: string | null;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
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

interface TimeSlot {
  id: number;
  ticket_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  actual_duration: number | null;
  notes: string | null;
}

interface TicketServiceItem {
  id: number;
  ticket_id: number;
  service_id: number | null;
  assigned_hours: number;
  hourly_cost: number;
  subtotal: number;
  service_name: string | null;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmado" },
  { value: "in_progress", label: "En Progreso" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
];

const BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  confirmed: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "error",
};

const SLOT_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  confirmed: "info",
  completed: "success",
  cancelled: "error",
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const ticketId = Number(params.id);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [services, setServices] = useState<TicketServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [editStatus, setEditStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // Slot modal
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotDate, setSlotDate] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);

  // Service modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [svcHours, setSvcHours] = useState("");
  const [svcCost, setSvcCost] = useState("");
  const [svcServiceId, setSvcServiceId] = useState("");
  const [availableServices, setAvailableServices] = useState<{ value: string; label: string }[]>([]);
  const [savingService, setSavingService] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTicket(json.data);
      setEditStatus(json.data.status);
    } catch {
      toast("Error al cargar ticket", "error");
      router.push("/dashboard/tickets");
    }
  }, [ticketId, toast, router]);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/slots`);
      const json = await res.json();
      setSlots(json.data || []);
    } catch {
      /* silent */
    }
  }, [ticketId]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/services`);
      const json = await res.json();
      setServices(json.data || []);
    } catch {
      /* silent */
    }
  }, [ticketId]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchTicket(), fetchSlots(), fetchServices()]);
      setLoading(false);
    }
    loadAll();
  }, [fetchTicket, fetchSlots, fetchServices]);

  // Update status
  const handleStatusChange = async () => {
    if (!ticket || editStatus === ticket.status) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus }),
      });
      if (!res.ok) throw new Error();
      toast("Estado actualizado", "success");
      fetchTicket();
    } catch {
      toast("Error al actualizar", "error");
    } finally {
      setSavingStatus(false);
    }
  };

  // Add slot
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSlot(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: slotDate,
          start_time: slotStart,
          end_time: slotEnd,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Horario agregado", "success");
      setShowSlotModal(false);
      setSlotDate("");
      setSlotStart("");
      setSlotEnd("");
      fetchSlots();
    } catch {
      toast("Error al agregar horario", "error");
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    try {
      await fetch(`/api/tickets/${ticketId}/slots`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slotId }),
      });
      toast("Horario eliminado", "success");
      fetchSlots();
    } catch {
      toast("Error", "error");
    }
  };

  // Add service
  const openServiceModal = async () => {
    try {
      const res = await fetch("/api/services?active_only=true");
      const json = await res.json();
      setAvailableServices(
        (json.data || []).map((s: { id: number; name: string }) => ({
          value: String(s.id),
          label: s.name,
        }))
      );
    } catch {
      /* silent */
    }
    setShowServiceModal(true);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingService(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: svcServiceId ? Number(svcServiceId) : undefined,
          assigned_hours: Number(svcHours),
          hourly_cost: Number(svcCost),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Servicio agregado", "success");
      setShowServiceModal(false);
      setSvcHours("");
      setSvcCost("");
      setSvcServiceId("");
      fetchServices();
    } catch {
      toast("Error al agregar servicio", "error");
    } finally {
      setSavingService(false);
    }
  };

  const handleDeleteService = async (serviceItemId: number) => {
    try {
      await fetch(`/api/tickets/${ticketId}/services`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_service_id: serviceItemId }),
      });
      toast("Servicio eliminado", "success");
      fetchServices();
    } catch {
      toast("Error", "error");
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

  const totalServicesCost = services.reduce((sum, s) => sum + s.subtotal, 0);

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
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        }
      />

      <div className={styles.grid}>
        {/* Left column: main info */}
        <div className={styles.main}>
          {/* Status card */}
          <Card>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Estado</h3>
              <Badge variant={BADGE_VARIANT[ticket.status] || "default"}>
                {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
              </Badge>
            </div>
            <div className={styles.statusRow}>
              <Select
                options={STATUS_OPTIONS}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleStatusChange}
                isLoading={savingStatus}
                disabled={editStatus === ticket.status}
              >
                Actualizar
              </Button>
            </div>
          </Card>

          {/* Description */}
          {ticket.description && (
            <Card>
              <h3 className={styles.cardTitle}>Descripción</h3>
              <p className={styles.description}>{ticket.description}</p>
            </Card>
          )}

          {/* Time Slots */}
          <Card>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Horarios</h3>
              <Button size="sm" variant="secondary" onClick={() => setShowSlotModal(true)}>
                Agregar
              </Button>
            </div>
            {slots.length === 0 ? (
              <p className={styles.empty}>Sin horarios programados</p>
            ) : (
              <div className={styles.slotList}>
                {slots.map((slot) => (
                  <div key={slot.id} className={styles.slotItem}>
                    <div className={styles.slotInfo}>
                      <span className={styles.slotDate}>{formatDate(slot.date)}</span>
                      <span className={styles.slotTime}>
                        {slot.start_time} — {slot.end_time}
                      </span>
                      <Badge variant={SLOT_STATUS_VARIANT[slot.status] || "default"} >
                        {slot.status}
                      </Badge>
                    </div>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteSlot(slot.id)}
                      aria-label="Eliminar horario"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Ticket Services */}
          <Card>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Servicios</h3>
              <Button size="sm" variant="secondary" onClick={openServiceModal}>
                Agregar
              </Button>
            </div>
            {services.length === 0 ? (
              <p className={styles.empty}>Sin servicios asignados</p>
            ) : (
              <>
                <div className={styles.serviceList}>
                  {services.map((svc) => (
                    <div key={svc.id} className={styles.serviceItem}>
                      <div className={styles.serviceInfo}>
                        <span className={styles.serviceName}>
                          {svc.service_name || "Servicio personalizado"}
                        </span>
                        <span className={styles.serviceMeta}>
                          {svc.assigned_hours}h × {formatCurrency(svc.hourly_cost)} ={" "}
                          <strong>{formatCurrency(svc.subtotal)}</strong>
                        </span>
                      </div>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteService(svc.id)}
                        aria-label="Eliminar servicio"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <div className={styles.totalRow}>
                  Total: <strong>{formatCurrency(totalServicesCost)}</strong>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Right column: sidebar info */}
        <div className={styles.sidebar}>
          <Card>
            <h3 className={styles.cardTitle}>Detalles</h3>
            <div className={styles.detailList}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Cliente</span>
                <span className={styles.detailValue}>
                  {ticket.client_name || "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Miembro</span>
                <span className={styles.detailValue}>
                  {ticket.member_name || "Sin asignar"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Servicio</span>
                <span className={styles.detailValue}>
                  {ticket.service_name || "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Fecha programada</span>
                <span className={styles.detailValue}>
                  {ticket.scheduled_at ? formatDateTime(ticket.scheduled_at) : "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Creado</span>
                <span className={styles.detailValue}>
                  {formatDateTime(ticket.created_at)}
                </span>
              </div>
              {ticket.completed_at && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Completado</span>
                  <span className={styles.detailValue}>
                    {formatDateTime(ticket.completed_at)}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h3 className={styles.cardTitle}>Estimaciones</h3>
            <div className={styles.detailList}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Horas est.</span>
                <span className={styles.detailValue}>
                  {ticket.estimated_hours != null ? `${ticket.estimated_hours}h` : "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Horas reales</span>
                <span className={styles.detailValue}>
                  {ticket.actual_hours != null ? `${ticket.actual_hours}h` : "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Costo est.</span>
                <span className={styles.detailValue}>
                  {ticket.estimated_cost != null ? formatCurrency(ticket.estimated_cost) : "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Costo real</span>
                <span className={styles.detailValue}>
                  {ticket.actual_cost != null ? formatCurrency(ticket.actual_cost) : "—"}
                </span>
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

      {/* Add Slot Modal */}
      <Modal open={showSlotModal} onClose={() => setShowSlotModal(false)} title="Agregar Horario" size="sm">
        <form onSubmit={handleAddSlot} className={styles.modalForm}>
          <Input
            label="Fecha *"
            type="date"
            value={slotDate}
            onChange={(e) => setSlotDate(e.target.value)}
            required
          />
          <div className={styles.modalRow}>
            <Input
              label="Inicio *"
              type="time"
              value={slotStart}
              onChange={(e) => setSlotStart(e.target.value)}
              required
            />
            <Input
              label="Fin *"
              type="time"
              value={slotEnd}
              onChange={(e) => setSlotEnd(e.target.value)}
              required
            />
          </div>
          <Button type="submit" isLoading={savingSlot} style={{ width: "100%" }}>
            Agregar horario
          </Button>
        </form>
      </Modal>

      {/* Add Service Modal */}
      <Modal open={showServiceModal} onClose={() => setShowServiceModal(false)} title="Agregar Servicio" size="sm">
        <form onSubmit={handleAddService} className={styles.modalForm}>
          <Select
            label="Servicio"
            options={availableServices}
            value={svcServiceId}
            onChange={(e) => setSvcServiceId(e.target.value)}
            placeholder="Opcional"
          />
          <div className={styles.modalRow}>
            <Input
              label="Horas *"
              type="number"
              step="0.5"
              min="0.5"
              value={svcHours}
              onChange={(e) => setSvcHours(e.target.value)}
              required
            />
            <Input
              label="Costo/hora *"
              type="number"
              step="0.01"
              min="0"
              value={svcCost}
              onChange={(e) => setSvcCost(e.target.value)}
              required
            />
          </div>
          <Button type="submit" isLoading={savingService} style={{ width: "100%" }}>
            Agregar servicio
          </Button>
        </form>
      </Modal>
    </div>
  );
}
