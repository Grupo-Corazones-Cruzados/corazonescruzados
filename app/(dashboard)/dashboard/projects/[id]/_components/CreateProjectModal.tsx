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
  const isMember = user?.role === "member" && user.member_id != null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const [clients, setClients] = useState<ClientOption[]>([]);

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);

  const loadOptions = useCallback(async () => {
    try {
      if (isMember && user?.member_id) {
        // Members: load only associated clients
        const cRes = await fetch(`/api/members/${user.member_id}/clients`);
        const cJson = await cRes.json();
        setClients(
          ((cJson.data || []) as ClientOption[]).sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
      } else if (!isClient) {
        // Admin: load all clients
        const cRes = await fetch("/api/clients?per_page=200");
        const cJson = await cRes.json();
        setClients(
          ((cJson.data || []) as ClientOption[]).sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
      } else if (isClient && user?.email) {
        // Client: auto-select themselves
        const cRes = await fetch("/api/clients?per_page=200");
        const cJson = await cRes.json();
        const clientList = ((cJson.data || []) as ClientOption[]).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setClients(clientList);
        const match = clientList.find(
          (c) => c.email.toLowerCase() === user.email.toLowerCase()
        );
        if (match) setClientId(String(match.id));
      }
    } catch {
      /* silent */
    }
  }, [isClient, isMember, user?.email, user?.member_id]);

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

  const isEmailLike = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const reset = () => {
    setTitle("");
    setDescription("");
    if (!isClient) setClientId("");
    setClientEmail("");
    setClientSearch("");
    setBudgetMin("");
    setBudgetMax("");
    setFinalCost("");
    setDeadline("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    // Validation: need a client (selected or by email)
    if (!isClient && !clientId && !clientEmail) return;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title,
        description: description || undefined,
        deadline: deadline || undefined,
      };

      if (clientId) {
        payload.client_id = Number(clientId);
      } else if (clientEmail) {
        payload.client_email = clientEmail;
      }

      if (isMember) {
        payload.final_cost = finalCost ? Number(finalCost) : undefined;
      } else {
        payload.budget_min = budgetMin ? Number(budgetMin) : undefined;
        payload.budget_max = budgetMax ? Number(budgetMax) : undefined;
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

            {/* Show selected client */}
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

            /* Show email chip (member invited by email) */
            ) : clientEmail ? (
              <div className={styles.emailChip}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={styles.emailIcon}>
                  <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 7l10 6 10-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className={styles.selectedMemberInfo}>
                  <span className={styles.selectedMemberName}>{clientEmail}</span>
                  <span className={styles.selectedMemberPos}>Se enviará invitación</span>
                </div>
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => {
                    setClientEmail("");
                    setClientSearch("");
                  }}
                  aria-label="Quitar email"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

            /* Show search input with dropdown */
            ) : (
              <div className={styles.memberSearchWrap}>
                <input
                  type="text"
                  className={styles.memberSearchInput}
                  placeholder={isMember ? "Buscar cliente o escribir email..." : "Buscar cliente..."}
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientDropdownOpen(true);
                  }}
                  onFocus={() => setClientDropdownOpen(true)}
                />
                {clientDropdownOpen && (
                  <div className={styles.memberDropdown}>
                    {filteredClients.map((c) => (
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
                    ))}

                    {/* Email invite option for members */}
                    {isMember && filteredClients.length === 0 && clientSearch && !isEmailLike(clientSearch) && (
                      <div className={styles.memberEmpty}>
                        Escribe un email válido para invitar un nuevo cliente
                      </div>
                    )}

                    {isMember && isEmailLike(clientSearch) && (
                      <button
                        type="button"
                        className={`${styles.memberOption} ${styles.inviteOption}`}
                        onClick={() => {
                          setClientEmail(clientSearch);
                          setClientSearch("");
                          setClientDropdownOpen(false);
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.emailIcon}>
                          <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M2 7l10 6 10-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className={styles.memberOptionInfo}>
                          <span className={styles.memberOptionName}>Invitar {clientSearch}</span>
                          <span className={styles.memberOptionPos}>Enviar invitación por correo</span>
                        </div>
                      </button>
                    )}

                    {!isMember && filteredClients.length === 0 && (
                      <div className={styles.memberEmpty}>Sin resultados</div>
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

        {/* Budget fields: members see single "Costo final", others see min/max */}
        {isMember ? (
          <Input
            label="Costo final"
            type="number"
            step="0.01"
            min="0"
            value={finalCost}
            onChange={(e) => setFinalCost(e.target.value)}
          />
        ) : (
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
        )}

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
