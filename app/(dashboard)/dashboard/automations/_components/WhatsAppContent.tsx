"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Badge, Button, Input, Select, Spinner } from "@/components/ui";
import PageHeader from "@/components/layout/PageHeader";
import type { EmailList, WhatsAppCampaign } from "@/lib/types";
import styles from "../page.module.css";

interface ToastFn {
  (message: string, type: "success" | "error"): void;
}

interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  components: {
    type: string;
    text?: string;
    example?: { body_text?: string[][] };
  }[];
}

interface SendResult {
  total_contacts: number;
  total_sent: number;
  total_failed: number;
  errors?: { name: string; phone: string; error: string }[];
}

interface SendRow {
  id: number;
  contact_name: string;
  contact_phone: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
}

type View = "campaigns" | "new" | "detail" | "quick";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Fallido",
};

const STATUS_BADGE: Record<string, "default" | "success" | "error" | "warning"> = {
  draft: "default",
  sending: "warning",
  sent: "success",
  failed: "error",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-EC", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("es-EC", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WhatsAppContent({ toast }: { toast: ToastFn }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<View>("campaigns");
  const [lists, setLists] = useState<EmailList[]>([]);
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Campaign form state
  const [campaignName, setCampaignName] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [messageType, setMessageType] = useState("text");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [languageCode, setLanguageCode] = useState("es");
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Campaign detail
  const [detailCampaign, setDetailCampaign] = useState<WhatsAppCampaign | null>(null);
  const [detailSends, setDetailSends] = useState<SendRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Quick send result
  const [result, setResult] = useState<SendResult | null>(null);

  // Derived
  const selectedList = lists.find((l) => l.id === Number(selectedListId));
  const categories = selectedList?.categories || [];

  const listOptions = useMemo(
    () => [
      { value: "", label: "Seleccionar lista..." },
      ...lists.map((list) => ({
        value: String(list.id),
        label: `${list.name} (${list.contact_count ?? 0} contactos)`,
      })),
    ],
    [lists]
  );

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "Todas las categorías" },
      ...categories.map((cat) => ({ value: cat, label: cat })),
    ],
    [categories]
  );

  const messageTypeOptions = useMemo(
    () => [
      { value: "text", label: "Mensaje de texto" },
      { value: "template", label: "Plantilla aprobada" },
    ],
    []
  );

  const templateOptions = useMemo(
    () => [
      { value: "", label: "Seleccionar plantilla..." },
      ...templates.map((t) => ({
        value: t.name,
        label: `${t.name} (${t.category}) — ${t.language}`,
      })),
    ],
    [templates]
  );

  // Detect how many {{variables}} the selected template body has
  const selectedTemplateData = templates.find((t) => t.name === selectedTemplate);
  const templateBodyText = selectedTemplateData?.components?.find(
    (c) => c.type === "BODY"
  )?.text;
  const templateVarCount = templateBodyText
    ? (templateBodyText.match(/\{\{\d+\}\}/g) || []).length
    : 0;

  // ── Fetch data ─────────────────────────────────────

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch("/api/email-lists");
      const json = await res.json();
      setLists(json.data || []);
    } catch {
      toast("Error al cargar listas", "error");
    }
  }, [toast]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/campaigns");
      const json = await res.json();
      setCampaigns(json.data || []);
    } catch {
      toast("Error al cargar campañas", "error");
    }
  }, [toast]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates");
      const json = await res.json();
      if (json.data) {
        setTemplates(json.data);
      } else if (json.error) {
        toast(json.error, "error");
      }
    } catch {
      // Templates might not be available if WABA ID not set
    } finally {
      setTemplatesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/dashboard");
      return;
    }
    if (user) {
      Promise.all([fetchLists(), fetchCampaigns()]).finally(() => setLoading(false));
    }
  }, [user, authLoading, router, fetchLists, fetchCampaigns]);

  // Fetch templates when switching to template mode
  useEffect(() => {
    if (messageType === "template" && templates.length === 0) {
      fetchTemplates();
    }
  }, [messageType, templates.length, fetchTemplates]);

  // Adjust templateVars array when var count changes
  useEffect(() => {
    setTemplateVars((prev) => {
      if (prev.length === templateVarCount) return prev;
      const next = Array.from({ length: templateVarCount }, (_, i) => prev[i] || "");
      return next;
    });
  }, [templateVarCount]);

  // ── Campaign detail ────────────────────────────────

  const openCampaignDetail = async (campaign: WhatsAppCampaign) => {
    setDetailCampaign(campaign);
    setView("detail");
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/whatsapp/campaigns/${campaign.id}/report`);
      const json = await res.json();
      if (json.data) {
        setDetailCampaign(json.data.campaign);
        setDetailSends(json.data.sends || []);
      }
    } catch {
      toast("Error al cargar reporte", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Save draft ──────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!campaignName.trim()) {
      toast("Nombre de campaña es obligatorio", "error");
      return;
    }

    setSavingDraft(true);
    try {
      const res = await fetch("/api/whatsapp/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName.trim(),
          message_type: messageType,
          message: messageType === "text" ? message.trim() : selectedTemplate,
          template_name: messageType === "template" ? selectedTemplate : null,
          template_lang: languageCode,
          template_vars:
            messageType === "template"
              ? templateVars.map((v) => ({ type: "text", text: v }))
              : [],
          list_id: selectedListId ? Number(selectedListId) : null,
          category_filter: categoryFilter || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error al guardar");
      }

      toast("Campaña guardada como borrador", "success");
      resetForm();
      setView("campaigns");
      fetchCampaigns();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al guardar", "error");
    } finally {
      setSavingDraft(false);
    }
  };

  // ── Send campaign ──────────────────────────────────

  const handleSendCampaign = async (campaignId: number) => {
    if (!confirm("¿Estás seguro de enviar esta campaña? Se enviará a todos los contactos de la lista.")) return;

    setSending(true);
    try {
      const res = await fetch(`/api/whatsapp/campaigns/${campaignId}/send`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Error al enviar");
      }

      toast(
        `Enviados: ${json.data.total_sent} / Fallidos: ${json.data.total_failed}`,
        json.data.total_failed === 0 ? "success" : "error"
      );

      fetchCampaigns();
      if (detailCampaign?.id === campaignId) {
        openCampaignDetail({ ...detailCampaign, id: campaignId } as WhatsAppCampaign);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al enviar", "error");
    } finally {
      setSending(false);
    }
  };

  // ── Delete campaign ─────────────────────────────────

  const handleDeleteCampaign = async (campaignId: number) => {
    if (!confirm("¿Eliminar esta campaña?")) return;

    try {
      const res = await fetch(`/api/whatsapp/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar");

      toast("Campaña eliminada", "success");
      fetchCampaigns();
      if (view === "detail") setView("campaigns");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  // ── Quick send ──────────────────────────────────────

  const handleQuickSend = async () => {
    if (!selectedListId) {
      toast("Selecciona una lista de contactos", "error");
      return;
    }
    if (!message.trim() && messageType === "text") {
      toast("Escribe un mensaje", "error");
      return;
    }
    if (!selectedTemplate && messageType === "template") {
      toast("Selecciona una plantilla", "error");
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_id: Number(selectedListId),
          category_filter: categoryFilter || undefined,
          message_type: messageType,
          message: messageType === "text" ? message.trim() : selectedTemplate,
          language_code: languageCode,
          template_vars:
            messageType === "template"
              ? templateVars.map((v) => ({ type: "text", text: v }))
              : undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Error al enviar");

      setResult(json.data);
      toast(
        `Enviados: ${json.data.total_sent} / Fallidos: ${json.data.total_failed}`,
        json.data.total_failed === 0 ? "success" : "error"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al enviar mensajes", "error");
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setCampaignName("");
    setSelectedListId("");
    setCategoryFilter("");
    setMessageType("text");
    setMessage("");
    setSelectedTemplate("");
    setLanguageCode("es");
    setTemplateVars([]);
    setResult(null);
  };

  // ── Render ──────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <button
        className={styles.backButton}
        onClick={() => router.push("/dashboard/automations")}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Volver
      </button>

      <PageHeader
        title="WhatsApp Business"
        description="Envía mensajes masivos a tus contactos usando la API de Meta Business."
      />

      {/* ── Tab bar ── */}
      <div className={styles.toolbar}>
        <Button
          variant={view === "campaigns" ? "primary" : "secondary"}
          size="sm"
          onClick={() => { setView("campaigns"); resetForm(); }}
        >
          Campañas
        </Button>
        <Button
          variant={view === "new" ? "primary" : "secondary"}
          size="sm"
          onClick={() => { setView("new"); resetForm(); }}
        >
          Nueva campaña
        </Button>
        <Button
          variant={view === "quick" ? "primary" : "secondary"}
          size="sm"
          onClick={() => { setView("quick"); resetForm(); }}
        >
          Envío rápido
        </Button>
      </div>

      {/* ── CAMPAIGNS LIST ── */}
      {view === "campaigns" && (
        <div className={styles.section}>
          {campaigns.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className={styles.emptyTitle}>No tienes campañas de WhatsApp</h3>
              <p className={styles.emptyDesc}>
                Crea una campaña para enviar mensajes masivos con seguimiento de entregas.
              </p>
              <Button onClick={() => setView("new")}>Crear campaña</Button>
            </div>
          ) : (
            <div className={styles.campaignGrid}>
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className={styles.campaignCard}
                  onClick={() => openCampaignDetail(c)}
                >
                  <div className={styles.campaignCardTop}>
                    <div className={`${styles.campaignCardIcon} ${
                      c.status === "sent"
                        ? styles.campaignCardIconSent
                        : c.status === "failed"
                        ? styles.campaignCardIconFailed
                        : c.status === "sending"
                        ? styles.campaignCardIconSending
                        : styles.campaignCardIconDraft
                    }`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </div>
                    <Badge variant={STATUS_BADGE[c.status] || "default"}>
                      {STATUS_LABELS[c.status] || c.status}
                    </Badge>
                  </div>
                  <h3 className={styles.campaignCardTitle}>{c.name}</h3>
                  <p className={styles.campaignCardSubject}>
                    {c.message_type === "template"
                      ? `Plantilla: ${c.template_name || "-"}`
                      : c.message?.substring(0, 60) || "-"}
                  </p>
                  <div className={styles.campaignCardFooter}>
                    <span className={styles.campaignCardStat}>
                      {c.list_name || "Sin lista"}
                    </span>
                    {c.status !== "draft" && (
                      <>
                        <span className={styles.campaignCardStat}>
                          {c.total_sent} enviados
                        </span>
                        {c.total_failed > 0 && (
                          <span className={styles.campaignCardStat} style={{ color: "var(--error)" }}>
                            {c.total_failed} fallidos
                          </span>
                        )}
                      </>
                    )}
                    <span className={styles.campaignCardStat}>
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NEW CAMPAIGN FORM ── */}
      {view === "new" && (
        <div className={styles.section}>
          <div style={{ maxWidth: 640 }}>
            <div className={styles.form}>
              <Input
                label="Nombre de la campaña"
                placeholder="Ej: Promoción Navideña 2025"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />

              <Select
                label="Lista de contactos"
                options={listOptions}
                value={selectedListId}
                onChange={(e) => {
                  setSelectedListId(e.target.value);
                  setCategoryFilter("");
                }}
              />

              {categories.length > 0 && (
                <Select
                  label="Filtrar por categoría (opcional)"
                  options={categoryOptions}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                />
              )}

              <Select
                label="Tipo de mensaje"
                options={messageTypeOptions}
                value={messageType}
                onChange={(e) => {
                  setMessageType(e.target.value);
                  setMessage("");
                  setSelectedTemplate("");
                  setTemplateVars([]);
                }}
              />

              {messageType === "text" ? (
                <div>
                  <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
                    Mensaje
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe tu mensaje aquí..."
                    rows={5}
                    style={{
                      width: "100%",
                      padding: "var(--space-3)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                      fontFamily: "inherit",
                      resize: "vertical",
                      background: "var(--bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "var(--space-1) 0 0" }}>
                    {message.length} / 4096 caracteres
                  </p>
                </div>
              ) : (
                <div className={styles.form}>
                  {templatesLoading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <Spinner /> <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Cargando plantillas aprobadas...</span>
                    </div>
                  ) : templates.length > 0 ? (
                    <>
                      <Select
                        label="Plantilla aprobada"
                        options={templateOptions}
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                      />

                      {/* Template preview */}
                      {selectedTemplateData && templateBodyText && (
                        <div style={{
                          padding: "var(--space-4)",
                          background: "var(--gray-50)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-light)",
                        }}>
                          <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 var(--space-2)", textTransform: "uppercase" }}>
                            Vista previa del cuerpo
                          </p>
                          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {templateBodyText}
                          </p>
                          <div style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-2)" }}>
                            <Badge variant="default">{selectedTemplateData.category}</Badge>
                            <Badge variant="default">{selectedTemplateData.language}</Badge>
                          </div>
                        </div>
                      )}

                      {/* Template variables */}
                      {templateVarCount > 0 && (
                        <div>
                          <p style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
                            Variables de la plantilla ({templateVarCount})
                          </p>
                          {templateVars.map((val, i) => (
                            <div key={i} style={{ marginBottom: "var(--space-2)" }}>
                              <Input
                                label={`{{${i + 1}}}`}
                                placeholder={`Valor para variable {{${i + 1}}}`}
                                value={val}
                                onChange={(e) => {
                                  const next = [...templateVars];
                                  next[i] = e.target.value;
                                  setTemplateVars(next);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <Input
                        label="Código de idioma"
                        placeholder="es"
                        value={languageCode}
                        onChange={(e) => setLanguageCode(e.target.value)}
                      />
                    </>
                  ) : (
                    <div className={styles.form}>
                      <Input
                        label="Nombre de la plantilla"
                        placeholder="hello_world"
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                      />
                      <Input
                        label="Código de idioma"
                        placeholder="es"
                        value={languageCode}
                        onChange={(e) => setLanguageCode(e.target.value)}
                      />
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                        No se pudieron cargar las plantillas automáticamente. Ingresa el nombre manualmente.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.formActions}>
                <Button onClick={handleSaveDraft} disabled={savingDraft}>
                  {savingDraft ? "Guardando..." : "Guardar borrador"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setView("campaigns"); resetForm(); }}
                >
                  Cancelar
                </Button>
              </div>

              {/* Info box */}
              <div style={{
                padding: "var(--space-4)",
                background: "rgba(37, 211, 102, 0.06)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(37, 211, 102, 0.2)",
              }}>
                <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 var(--space-2)" }}>
                  Información importante
                </p>
                <ul style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0, paddingLeft: "var(--space-4)", lineHeight: 1.8 }}>
                  <li>Los mensajes se envían respetando el límite de 80 msg/seg de Meta</li>
                  <li>Después de 24h sin respuesta, solo se pueden enviar plantillas aprobadas</li>
                  <li>Las plantillas de marketing incluyen botón de opt-out obligatorio</li>
                  <li>Sin verificación de negocio: máximo 250 contactos/día</li>
                  <li>Verificado: escalado automático hasta ilimitado con calidad alta</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CAMPAIGN DETAIL ── */}
      {view === "detail" && detailCampaign && (
        <div className={styles.section}>
          <button
            className={styles.backButton}
            onClick={() => { setView("campaigns"); setDetailCampaign(null); setDetailSends([]); }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Volver a campañas
          </button>

          <div className={styles.detailHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
              <h2 className={styles.detailTitle}>{detailCampaign.name}</h2>
              <Badge variant={STATUS_BADGE[detailCampaign.status] || "default"}>
                {STATUS_LABELS[detailCampaign.status] || detailCampaign.status}
              </Badge>
            </div>
            <div className={styles.metaRow}>
              {detailCampaign.list_name && (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  Lista: {detailCampaign.list_name}
                </span>
              )}
              {detailCampaign.category_filter && (
                <Badge variant="default">{detailCampaign.category_filter}</Badge>
              )}
              {detailCampaign.message_type === "template" && detailCampaign.template_name && (
                <Badge variant="default">Plantilla: {detailCampaign.template_name}</Badge>
              )}
              {detailCampaign.sent_at && (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  Enviado: {formatDateTime(detailCampaign.sent_at)}
                </span>
              )}
            </div>

            <div className={styles.formActions}>
              {detailCampaign.status === "draft" && (
                <Button
                  onClick={() => handleSendCampaign(detailCampaign.id)}
                  disabled={sending || !detailCampaign.list_id}
                >
                  {sending ? "Enviando..." : "Enviar campaña"}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => handleDeleteCampaign(detailCampaign.id)}
              >
                Eliminar
              </Button>
            </div>
          </div>

          {/* Message preview */}
          {detailCampaign.message_type === "text" && detailCampaign.message && (
            <div style={{
              padding: "var(--space-4)",
              background: "var(--gray-50)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-light)",
              marginBottom: "var(--space-6)",
              maxWidth: 640,
            }}>
              <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 var(--space-2)", textTransform: "uppercase" }}>
                Mensaje
              </p>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", margin: 0, whiteSpace: "pre-wrap" }}>
                {detailCampaign.message}
              </p>
            </div>
          )}

          {/* Summary stats */}
          {detailCampaign.status !== "draft" && (
            <div className={styles.summaryGrid} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div className={styles.summaryCard}>
                <h4>{detailCampaign.total_recipients}</h4>
                <p>Destinatarios</p>
              </div>
              <div className={`${styles.summaryCard} ${styles.summaryCardSuccess}`}>
                <h4>{detailCampaign.total_sent}</h4>
                <p>Enviados</p>
              </div>
              <div className={`${styles.summaryCard} ${styles.summaryCardError}`}>
                <h4>{detailCampaign.total_failed}</h4>
                <p>Fallidos</p>
              </div>
              <div className={`${styles.summaryCard} ${styles.summaryCardInfo}`}>
                <h4>
                  {detailCampaign.total_recipients > 0
                    ? Math.round((detailCampaign.total_sent / detailCampaign.total_recipients) * 100)
                    : 0}%
                </h4>
                <p>Tasa de entrega</p>
              </div>
            </div>
          )}

          {/* Send details table */}
          {detailLoading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : detailSends.length > 0 && (
            <div style={{ border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ background: "var(--gray-50)" }}>
                    <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: 600 }}>Contacto</th>
                    <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: 600 }}>Teléfono</th>
                    <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: 600 }}>Estado</th>
                    <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: 600 }}>Enviado</th>
                    <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: 600 }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {detailSends.map((s) => (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "var(--space-3)" }}>{s.contact_name}</td>
                      <td style={{ padding: "var(--space-3)" }}>{s.contact_phone}</td>
                      <td style={{ padding: "var(--space-3)" }}>
                        <Badge variant={
                          s.status === "sent" || s.status === "delivered" || s.status === "read"
                            ? "success"
                            : s.status === "failed"
                            ? "error"
                            : "default"
                        }>
                          {s.status === "sent" ? "Enviado"
                            : s.status === "delivered" ? "Entregado"
                            : s.status === "read" ? "Leído"
                            : s.status === "failed" ? "Fallido"
                            : "Pendiente"}
                        </Badge>
                      </td>
                      <td style={{ padding: "var(--space-3)", color: "var(--text-secondary)" }}>
                        {s.sent_at ? formatDateTime(s.sent_at) : "-"}
                      </td>
                      <td style={{ padding: "var(--space-3)", color: "var(--error)", fontSize: "var(--text-xs)" }}>
                        {s.error_message || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── QUICK SEND ── */}
      {view === "quick" && (
        <div className={styles.section}>
          <div style={{ maxWidth: 640 }}>
            <div className={styles.form}>
              <Select
                label="Lista de contactos"
                options={listOptions}
                value={selectedListId}
                onChange={(e) => {
                  setSelectedListId(e.target.value);
                  setCategoryFilter("");
                }}
              />

              {categories.length > 0 && (
                <Select
                  label="Filtrar por categoría (opcional)"
                  options={categoryOptions}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                />
              )}

              <Select
                label="Tipo de mensaje"
                options={messageTypeOptions}
                value={messageType}
                onChange={(e) => {
                  setMessageType(e.target.value);
                  setMessage("");
                  setSelectedTemplate("");
                  setTemplateVars([]);
                }}
              />

              {messageType === "text" ? (
                <div>
                  <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
                    Mensaje
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe tu mensaje aquí..."
                    rows={5}
                    style={{
                      width: "100%",
                      padding: "var(--space-3)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                      fontFamily: "inherit",
                      resize: "vertical",
                      background: "var(--bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "var(--space-1) 0 0" }}>
                    {message.length} / 4096 caracteres
                  </p>
                </div>
              ) : (
                <div className={styles.form}>
                  {templatesLoading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <Spinner /> <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Cargando plantillas...</span>
                    </div>
                  ) : templates.length > 0 ? (
                    <>
                      <Select
                        label="Plantilla aprobada"
                        options={templateOptions}
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                      />
                      {selectedTemplateData && templateBodyText && (
                        <div style={{
                          padding: "var(--space-4)",
                          background: "var(--gray-50)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-light)",
                        }}>
                          <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 var(--space-2)", textTransform: "uppercase" }}>
                            Vista previa
                          </p>
                          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", margin: 0, whiteSpace: "pre-wrap" }}>
                            {templateBodyText}
                          </p>
                        </div>
                      )}
                      {templateVarCount > 0 && templateVars.map((val, i) => (
                        <Input
                          key={i}
                          label={`Variable {{${i + 1}}}`}
                          placeholder={`Valor para {{${i + 1}}}`}
                          value={val}
                          onChange={(e) => {
                            const next = [...templateVars];
                            next[i] = e.target.value;
                            setTemplateVars(next);
                          }}
                        />
                      ))}
                    </>
                  ) : (
                    <>
                      <Input
                        label="Nombre de la plantilla"
                        placeholder="hello_world"
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                      />
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                        La plantilla debe estar aprobada en tu cuenta de Meta Business.
                      </p>
                    </>
                  )}
                  <Input
                    label="Código de idioma"
                    placeholder="es"
                    value={languageCode}
                    onChange={(e) => setLanguageCode(e.target.value)}
                  />
                </div>
              )}

              <Button onClick={handleQuickSend} disabled={sending}>
                {sending ? "Enviando..." : "Enviar mensajes"}
              </Button>
            </div>

            {/* Quick send results */}
            {result && (
              <div style={{ marginTop: "var(--space-6)" }}>
                <div className={styles.summaryGrid} style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div className={styles.summaryCard}>
                    <h4>{result.total_contacts}</h4>
                    <p>Total contactos</p>
                  </div>
                  <div className={`${styles.summaryCard} ${styles.summaryCardSuccess}`}>
                    <h4>{result.total_sent}</h4>
                    <p>Enviados</p>
                  </div>
                  <div className={`${styles.summaryCard} ${styles.summaryCardError}`}>
                    <h4>{result.total_failed}</h4>
                    <p>Fallidos</p>
                  </div>
                </div>

                {result.errors && result.errors.length > 0 && (
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>
                      Errores de envío
                    </h4>
                    <div style={{ border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                        <thead>
                          <tr style={{ background: "var(--gray-50)" }}>
                            <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: 600 }}>Contacto</th>
                            <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: 600 }}>Teléfono</th>
                            <th style={{ padding: "var(--space-3)", textAlign: "left", fontWeight: 600 }}>Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.errors.map((err, i) => (
                            <tr key={i} style={{ borderTop: "1px solid var(--border-light)" }}>
                              <td style={{ padding: "var(--space-3)" }}>{err.name}</td>
                              <td style={{ padding: "var(--space-3)" }}>{err.phone}</td>
                              <td style={{ padding: "var(--space-3)", color: "var(--error)" }}>{err.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty state for no lists */}
            {lists.length === 0 && (
              <div className={styles.emptyState} style={{ marginTop: "var(--space-6)" }}>
                <div className={styles.emptyIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M7 10a3 3 0 100-6 3 3 0 000 6zM1 17v-1a4 4 0 014-4h4a4 4 0 014 4v1M13 4.5a3 3 0 010 5.5M17 17v-1a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className={styles.emptyTitle}>No tienes listas de contactos</h3>
                <p className={styles.emptyDesc}>
                  Primero crea una lista de contactos en el módulo de correo masivo.
                </p>
                <Button variant="secondary" onClick={() => router.push("/dashboard/automations/email-masivo")}>
                  Ir a correo masivo
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
