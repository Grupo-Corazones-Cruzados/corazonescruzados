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
}

interface ServiceOption {
  id: number;
  name: string;
  base_price: number;
}

export default function CreateTicketModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [saving, setSaving] = useState(false);

  // Options
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberServices, setMemberServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Member search
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const memberRef = useRef<HTMLDivElement>(null);

  // Load members when modal opens
  const loadOptions = useCallback(async () => {
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

  useEffect(() => {
    if (open) loadOptions();
  }, [open, loadOptions]);

  // Load services when member changes
  useEffect(() => {
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
  }, [memberId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selectedMember = members.find((m) => String(m.id) === memberId);
  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.position_name || "").toLowerCase().includes(memberSearch.toLowerCase())
  );

  const reset = () => {
    setTitle("");
    setDescription("");
    setServiceId("");
    setMemberId("");
    setMemberSearch("");
    setScheduledAt("");
    setEstimatedHours("");
    setEstimatedCost("");
    setMemberServices([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

  const userName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email
    : "";

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

        <Input
          label="Título *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* Member picker with search */}
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

        {/* Service: depends on selected member */}
        <div className={styles.fieldGroup}>
          <span className={styles.label}>Servicio</span>
          {!memberId ? (
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
              <span className={styles.disabledHint}>Este miembro no tiene servicios configurados</span>
            </div>
          ) : (
            <select
              className={styles.nativeSelect}
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                const svc = memberServices.find((s) => String(s.id) === e.target.value);
                if (svc && svc.base_price > 0) {
                  setEstimatedCost(String(svc.base_price));
                }
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
