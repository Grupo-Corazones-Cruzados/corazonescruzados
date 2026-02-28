"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Select, Modal } from "@/components/ui";
import styles from "./CreateTicketModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface Option {
  value: string;
  label: string;
}

export default function CreateTicketModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [saving, setSaving] = useState(false);

  const [clients, setClients] = useState<Option[]>([]);
  const [services, setServices] = useState<Option[]>([]);
  const [members, setMembers] = useState<Option[]>([]);

  const loadOptions = useCallback(async () => {
    try {
      const [cRes, sRes, mRes] = await Promise.all([
        fetch("/api/clients?per_page=200"),
        fetch("/api/services?active_only=true"),
        fetch("/api/members?per_page=200&active_only=true"),
      ]);
      const [cJson, sJson, mJson] = await Promise.all([
        cRes.json(),
        sRes.json(),
        mRes.json(),
      ]);
      setClients(
        (cJson.data || []).map((c: { id: number; name: string }) => ({
          value: String(c.id),
          label: c.name,
        }))
      );
      setServices(
        (sJson.data || []).map((s: { id: number; name: string }) => ({
          value: String(s.id),
          label: s.name,
        }))
      );
      setMembers(
        (mJson.data || []).map((m: { id: number; name: string }) => ({
          value: String(m.id),
          label: m.name,
        }))
      );
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (open) loadOptions();
  }, [open, loadOptions]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setClientId("");
    setServiceId("");
    setMemberId("");
    setScheduledAt("");
    setEstimatedHours("");
    setEstimatedCost("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !title) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Number(clientId),
          title,
          description: description || undefined,
          service_id: serviceId ? Number(serviceId) : undefined,
          member_id: memberId ? Number(memberId) : undefined,
          scheduled_at: scheduledAt || undefined,
          estimated_hours: estimatedHours ? Number(estimatedHours) : undefined,
          estimated_cost: estimatedCost ? Number(estimatedCost) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      reset();
      onCreated();
    } catch {
      // TODO: toast error
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Ticket" size="md">
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label="Título *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="Cliente *"
          options={clients}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Seleccionar cliente"
          required
        />

        <div className={styles.row}>
          <Select
            label="Servicio"
            options={services}
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            placeholder="Opcional"
          />
          <Select
            label="Miembro asignado"
            options={members}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div className={styles.textarea}>
          <label className={styles.label}>Descripción</label>
          <textarea
            className={styles.textareaInput}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el ticket..."
          />
        </div>

        <Input
          label="Fecha programada"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />

        <div className={styles.row}>
          <Input
            label="Horas estimadas"
            type="number"
            step="0.5"
            min="0"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
          <Input
            label="Costo estimado"
            type="number"
            step="0.01"
            min="0"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
          />
        </div>

        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear Ticket
        </Button>
      </form>
    </Modal>
  );
}
