"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Select, Modal } from "@/components/ui";
import styles from "./ProjectModals.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface Option {
  value: string;
  label: string;
}

export default function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [clients, setClients] = useState<Option[]>([]);
  const [members, setMembers] = useState<Option[]>([]);

  const loadOptions = useCallback(async () => {
    try {
      const [cRes, mRes] = await Promise.all([
        fetch("/api/clients?per_page=200"),
        fetch("/api/members?per_page=200&active_only=true"),
      ]);
      const [cJson, mJson] = await Promise.all([cRes.json(), mRes.json()]);
      setClients(
        (cJson.data || []).map((c: { id: number; name: string }) => ({
          value: String(c.id),
          label: c.name,
        }))
      );
      setMembers(
        (mJson.data || []).map((m: { id: number; name: string }) => ({
          value: String(m.id),
          label: m.name,
        }))
      );
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    if (open) loadOptions();
  }, [open, loadOptions]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setClientId("");
    setMemberId("");
    setBudgetMin("");
    setBudgetMax("");
    setDeadline("");
    setIsPrivate(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !title) return;
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Number(clientId),
          title,
          description: description || undefined,
          assigned_member_id: memberId ? Number(memberId) : undefined,
          budget_min: budgetMin ? Number(budgetMin) : undefined,
          budget_max: budgetMax ? Number(budgetMax) : undefined,
          deadline: deadline || undefined,
          is_private: isPrivate,
        }),
      });
      if (!res.ok) throw new Error();
      reset();
      onCreated();
    } catch {
      /* TODO: toast */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Proyecto" size="md">
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
        <Select
          label="Miembro asignado"
          options={members}
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          placeholder="Opcional"
        />
        <div className={styles.textarea}>
          <label className={styles.label}>Descripción</label>
          <textarea
            className={styles.textareaInput}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el proyecto..."
          />
        </div>
        <div className={styles.row}>
          <Input
            label="Presupuesto mínimo"
            type="number"
            step="0.01"
            min="0"
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
          />
          <Input
            label="Presupuesto máximo"
            type="number"
            step="0.01"
            min="0"
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
          />
        </div>
        <Input
          label="Fecha límite"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <span>Proyecto privado (sin enlace público)</span>
        </label>
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear Proyecto
        </Button>
      </form>
    </Modal>
  );
}
