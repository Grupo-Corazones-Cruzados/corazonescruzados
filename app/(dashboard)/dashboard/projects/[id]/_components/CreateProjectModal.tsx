"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import Avatar from "@/components/ui/Avatar";
import { ROLE_LABELS } from "@/lib/constants";
import styles from "./ProjectModals.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface ClientOption {
  id: number;
  name: string;
  email: string;
}

export default function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isClient = user?.role === "client";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const [clients, setClients] = useState<ClientOption[]>([]);

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);

  const loadOptions = useCallback(async () => {
    try {
      const cRes = await fetch("/api/clients?per_page=200");
      const cJson = await cRes.json();

      const clientList = ((cJson.data || []) as ClientOption[]).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setClients(clientList);

      // Auto-select client for client role users
      if (isClient && user?.email) {
        const match = clientList.find(
          (c) => c.email.toLowerCase() === user.email.toLowerCase()
        );
        if (match) setClientId(String(match.id));
      }
    } catch {
      /* silent */
    }
  }, [isClient, user?.email]);

  useEffect(() => {
    if (open) loadOptions();
  }, [open, loadOptions]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selectedClient = clients.find((c) => String(c.id) === clientId);
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const reset = () => {
    setTitle("");
    setDescription("");
    if (!isClient) setClientId("");
    setClientSearch("");
    setBudgetMin("");
    setBudgetMax("");
    setDeadline("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!isClient && !clientId) || !title) return;
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Number(clientId),
          title,
          description: description || undefined,
          budget_min: budgetMin ? Number(budgetMin) : undefined,
          budget_max: budgetMax ? Number(budgetMax) : undefined,
          deadline: deadline || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      reset();
      onCreated();
    } catch {
      toast("Error al crear proyecto", "error");
    } finally {
      setSaving(false);
    }
  };

  const userName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email
    : "";

  const showClientPicker = !isClient;

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Proyecto" size="md">
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Creator info */}
        {user && (
          <div className={styles.creatorCard}>
            <Avatar src={user.avatar_url} name={userName} size="md" />
            <div className={styles.creatorInfo}>
              <span className={styles.creatorName}>{userName}</span>
              <span className={styles.creatorRole}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            <span className={styles.creatorBadge}>Creador</span>
          </div>
        )}

        <Input
          label="Título *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* Client picker — only for member / admin */}
        {showClientPicker && (
          <div className={styles.fieldGroup} ref={clientRef}>
            <span className={styles.label}>Cliente *</span>
            {selectedClient ? (
              <div className={styles.selectedMember}>
                <Avatar name={selectedClient.name} size="sm" />
                <div className={styles.selectedMemberInfo}>
                  <span className={styles.selectedMemberName}>
                    {selectedClient.name}
                  </span>
                  <span className={styles.selectedMemberPos}>
                    {selectedClient.email}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => {
                    setClientId("");
                    setClientSearch("");
                  }}
                  aria-label="Quitar cliente"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className={styles.memberSearchWrap}>
                <input
                  type="text"
                  className={styles.memberSearchInput}
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientDropdownOpen(true);
                  }}
                  onFocus={() => setClientDropdownOpen(true)}
                />
                {clientDropdownOpen && (
                  <div className={styles.memberDropdown}>
                    {filteredClients.length === 0 ? (
                      <div className={styles.memberEmpty}>Sin resultados</div>
                    ) : (
                      filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={styles.memberOption}
                          onClick={() => {
                            setClientId(String(c.id));
                            setClientSearch("");
                            setClientDropdownOpen(false);
                          }}
                        >
                          <Avatar name={c.name} size="sm" />
                          <div className={styles.memberOptionInfo}>
                            <span className={styles.memberOptionName}>{c.name}</span>
                            <span className={styles.memberOptionPos}>{c.email}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear Proyecto
        </Button>
      </form>
    </Modal>
  );
}
