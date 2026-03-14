"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Input, Modal, Spinner } from "@/components/ui";
import Avatar from "@/components/ui/Avatar";
import { ROLE_LABELS } from "@/lib/constants";
import styles from "./CreateTicketModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface MemberOption {
  id: number;
  name: string;
  photo_url: string | null;
  position_name: string | null;
  hourly_rate: number | null;
}

interface ServiceOption {
  id: number;
  name: string;
  base_price: number;
}

interface ClientOption {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

type TicketMode = "member" | "client";

export default function CreateTicketModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const isMember = user?.role === "member" && user.member_id != null;

  // Mode: "member" = request to another member, "client" = create for a client
  const [mode, setMode] = useState<TicketMode>("member");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [deadline, setDeadline] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [saving, setSaving] = useState(false);

  // Options
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [memberServices, setMemberServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  // Member search
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const memberRef = useRef<HTMLDivElement>(null);

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);

  // Load members when modal opens
  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/members?per_page=200&active_only=true");
      const json = await res.json();
      setMembers(
        ((json.data || []) as MemberOption[]).sort((a: MemberOption, b: MemberOption) =>
          a.name.localeCompare(b.name)
        )
      );
    } catch {
      /* silent */
    }
  }, []);

  // Load member's clients (from projects)
  const loadClients = useCallback(async () => {
    if (!isMember || !user?.member_id) return;
    setLoadingClients(true);
    try {
      const res = await fetch(`/api/members/${user.member_id}/clients`);
      const json = await res.json();
      setClients(json.data || []);
    } catch {
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, [isMember, user?.member_id]);

  useEffect(() => {
    if (open) {
      loadMembers();
      if (isMember) loadClients();
    }
  }, [open, loadMembers, loadClients, isMember]);

  // Load services when member changes (member mode) or own services (client mode)
  useEffect(() => {
    if (mode === "member") {
      if (!memberId) {
        setMemberServices([]);
        setServiceId("");
        return;
      }
      setLoadingServices(true);
      fetch(`/api/members/${memberId}/services`)
        .then((r) => r.json())
        .then((json) => setMemberServices(json.data || []))
        .catch(() => setMemberServices([]))
        .finally(() => setLoadingServices(false));
    } else {
      // In client mode, load the member's own services
      if (!user?.member_id) {
        setMemberServices([]);
        setServiceId("");
        return;
      }
      setLoadingServices(true);
      fetch(`/api/members/${user.member_id}/services`)
        .then((r) => r.json())
        .then((json) => setMemberServices(json.data || []))
        .catch(() => setMemberServices([]))
        .finally(() => setLoadingServices(false));
    }
  }, [memberId, mode, user?.member_id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
      }
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selectedMember = members.find((m) => String(m.id) === memberId);
  const filteredMembers = members.filter((m) =>
    m.id !== user?.member_id &&
    (m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.position_name || "").toLowerCase().includes(memberSearch.toLowerCase()))
  );

  const selectedClient = clients.find((c) => String(c.id) === clientId);
  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const isEmailLike = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const reset = () => {
    setTitle("");
    setDescription("");
    setServiceId("");
    setMemberId("");
    setClientId("");
    setClientEmail("");
    setMemberSearch("");
    setClientSearch("");
    setDeadline("");
    setEstimatedHours("");
    setEstimatedCost("");
    setMemberServices([]);
    setMode("member");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title,
        description: description || undefined,
        service_id: serviceId ? Number(serviceId) : undefined,
        deadline: deadline || undefined,
        estimated_hours: estimatedHours ? Number(estimatedHours) : undefined,
        estimated_cost: estimatedCost ? Number(estimatedCost) : undefined,
      };

      if (mode === "member") {
        payload.member_id = memberId ? Number(memberId) : undefined;
      } else {
        // Client mode: member assigns themselves, selects a client or invites by email
        payload.member_id = user?.member_id || undefined;
        if (clientId) {
          payload.client_id = Number(clientId);
        } else if (clientEmail) {
          payload.client_email = clientEmail;
        }
      }

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const handleModeChange = (newMode: TicketMode) => {
    setMode(newMode);
    setMemberId("");
    setClientId("");
    setClientEmail("");
    setMemberSearch("");
    setClientSearch("");
    setServiceId("");
    setEstimatedCost("");
    setMemberServices([]);
  };

  const userName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email
    : "";

  // Cost calculation helper
  const recalcCost = (hours: string, svcId: string) => {
    const h = Number(hours) || 0;
    const svc = memberServices.find((s) => String(s.id) === svcId);
    if (svc && h > 0) {
      setEstimatedCost(String(Math.round(svc.base_price * h * 100) / 100));
    } else {
      setEstimatedCost("");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Ticket" size="md">
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

        {/* Mode toggle — only visible for members */}
        {isMember && (
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === "member" ? styles.modeBtnActive : ""}`}
              onClick={() => handleModeChange("member")}
            >
              Solicitar a miembro
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === "client" ? styles.modeBtnActive : ""}`}
              onClick={() => handleModeChange("client")}
            >
              Crear para cliente
            </button>
          </div>
        )}

        <Input
          label="Título *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* --- Member mode: pick a member --- */}
        {mode === "member" && (
          <div className={styles.fieldGroup} ref={memberRef}>
            <span className={styles.label}>Miembro asignado</span>
            {selectedMember ? (
              <div className={styles.selectedMember}>
                <Avatar
                  src={selectedMember.photo_url}
                  name={selectedMember.name}
                  size="sm"
                />
                <div className={styles.selectedMemberInfo}>
                  <span className={styles.selectedMemberName}>
                    {selectedMember.name}
                  </span>
                  {selectedMember.position_name && (
                    <span className={styles.selectedMemberPos}>
                      {selectedMember.position_name}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => {
                    setMemberId("");
                    setMemberSearch("");
                  }}
                  aria-label="Quitar miembro"
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
                  placeholder="Buscar miembro..."
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setMemberDropdownOpen(true);
                  }}
                  onFocus={() => setMemberDropdownOpen(true)}
                />
                {memberDropdownOpen && (
                  <div className={styles.memberDropdown}>
                    {filteredMembers.length === 0 ? (
                      <div className={styles.memberEmpty}>Sin resultados</div>
                    ) : (
                      filteredMembers.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={styles.memberOption}
                          onClick={() => {
                            setMemberId(String(m.id));
                            setMemberSearch("");
                            setMemberDropdownOpen(false);
                          }}
                        >
                          <Avatar src={m.photo_url} name={m.name} size="sm" />
                          <div className={styles.memberOptionInfo}>
                            <span className={styles.memberOptionName}>{m.name}</span>
                            {m.position_name && (
                              <span className={styles.memberOptionPos}>{m.position_name}</span>
                            )}
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

        {/* --- Client mode: pick a client or invite by email --- */}
        {mode === "client" && (
          <div className={styles.fieldGroup} ref={clientRef}>
            <span className={styles.label}>Cliente</span>
            {loadingClients ? (
              <div className={styles.autoField}>
                <Spinner size="sm" />
                <span>Cargando clientes...</span>
              </div>
            ) : selectedClient ? (
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
            ) : (
              <div className={styles.memberSearchWrap}>
                <input
                  type="text"
                  className={styles.memberSearchInput}
                  placeholder="Buscar cliente o escribir email..."
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

                    {filteredClients.length === 0 && clientSearch && !isEmailLike(clientSearch) && (
                      <div className={styles.memberEmpty}>
                        Escribe un email válido para invitar un nuevo cliente
                      </div>
                    )}

                    {isEmailLike(clientSearch) && (
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
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Service: depends on selected member (member mode) or own services (client mode) */}
        <div className={styles.fieldGroup}>
          <span className={styles.label}>Servicio</span>
          {mode === "member" && !memberId ? (
            <div className={styles.autoField}>
              <span className={styles.disabledHint}>Selecciona un miembro primero</span>
            </div>
          ) : loadingServices ? (
            <div className={styles.autoField}>
              <Spinner size="sm" />
              <span>Cargando servicios...</span>
            </div>
          ) : memberServices.length === 0 ? (
            <div className={styles.autoField}>
              <span className={styles.disabledHint}>
                {mode === "client"
                  ? "No tienes servicios configurados"
                  : "Este miembro no tiene servicios configurados"}
              </span>
            </div>
          ) : (
            <select
              className={styles.nativeSelect}
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                recalcCost(estimatedHours, e.target.value);
              }}
            >
              <option value="">Seleccionar servicio</option>
              {memberServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
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
          label="Fecha máxima de entrega"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
        />

        <div className={styles.row}>
          <Input
            label="Horas estimadas"
            type="number"
            step="0.5"
            min="0"
            value={estimatedHours}
            onChange={(e) => {
              setEstimatedHours(e.target.value);
              recalcCost(e.target.value, serviceId);
            }}
          />
          <Input
            label="Costo estimado"
            type="number"
            step="0.01"
            min="0"
            value={estimatedCost}
            readOnly
          />
        </div>

        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear Ticket
        </Button>
      </form>
    </Modal>
  );
}
