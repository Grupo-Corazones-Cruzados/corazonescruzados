'use client';

/**
 * FlowSidePanel — editor del flujo de EMAIL MASIVO (campañas, listas de contactos,
 * redacción del correo, envío y estadísticas). Estilo Fluent `.corp` del dashboard;
 * el overlay, la cabecera, los pasos y los controles compartidos viven en `FlowPanelUI`.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import {
  FlowPanelShell, PanelSubHeader, SectionBar, PanelFooter, Steps, StatCards, FileRow,
  PanelEmpty, FIELD, FIELD_SM, LABEL, BTN_ROW, BTN_ROW_DANGER, formatSize,
} from '@/components/dashboard/flows/FlowPanelUI';
import {
  Mail, Plus, Send, BarChart3, RotateCcw, Users, ChevronRight, ChevronDown, Trash2,
  FileSpreadsheet, Download, Paperclip, Eye, Code2, Check, X, Bold, Italic, Underline,
  Heading1, Heading2, Pilcrow, Link2, Image as ImageIcon, Minus, MousePointerClick,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/* ─── Types ─── */
interface Flow {
  id: number;
  name: string;
  type: string;
  description: string;
  status: string;
  config: Record<string, any>;
}

interface ContactList {
  id: number;
  flow_id: number;
  name: string;
  contact_count: number;
  created_at: string;
}

interface Contact {
  id: number;
  list_id: number;
  name: string;
  email: string;
}

interface Campaign {
  id: number;
  flow_id: number;
  contact_list_id: number;
  from_email: string;
  subject: string;
  body_html: string;
  footer_html: string;
  attachments: any[];
  status: string;
  list_name: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
}

interface CampaignStats {
  campaign: Campaign;
  summary: { total: number; sent: number; delivered: number; bounced: number; failed: number };
  sends: { id: number; contact_name: string; contact_email: string; status: string; error_message: string | null; sent_at: string }[];
}

const CAMP_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', sending: 'info', sent: 'success', failed: 'error',
};
const CAMP_STATUS_L: Record<string, string> = {
  draft: 'Borrador', sending: 'Enviando…', sent: 'Enviada', failed: 'Fallida',
};
const SEND_STATUS_L: Record<string, string> = {
  pending: 'Pendiente', sent: 'Enviado', delivered: 'Entregado', bounced: 'Rebotado', failed: 'Fallido',
};

/* ─── Build preview HTML (neutral, no branding) ─── */
function buildPreviewHtml(bodyHtml: string, footerHtml: string): string {
  const footer = footerHtml
    ? `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e0e0e0;">${footerHtml}</div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>body{margin:0;padding:0;}</style></head>
<body style="font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f5;margin:0;padding:24px 16px;color:#333333;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;overflow:hidden;border-radius:4px;">
  <div style="padding:32px;font-size:15px;line-height:1.6;color:#333333;">
    ${bodyHtml}
    ${footer}
  </div>
</div></body></html>`;
}

/* ─── Main Panel ─── */
export default function FlowSidePanel({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  const [view, setView] = useState<'campaigns' | 'create-campaign' | 'stats' | 'resend-edit'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<CampaignStats | null>(null);
  const [confirmSend, setConfirmSend] = useState<Campaign | null>(null);
  const [confirmSendFull, setConfirmSendFull] = useState<Campaign | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  // Resend flow
  const [resendChoice, setResendChoice] = useState<Campaign | null>(null); // modal to pick same/different
  const [resendCampaign, setResendCampaign] = useState<Campaign | null>(null); // campaign being resent
  const [resendEditing, setResendEditing] = useState(false); // editing email for resend
  const [resendOverrides, setResendOverrides] = useState<{ from_email: string; subject: string; body_html: string; footer_html: string; attachments: { filename: string; content: string; size: number }[] }>({ from_email: '', subject: '', body_html: '', footer_html: '', attachments: [] });

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}/campaigns`);
      const data = await res.json();
      setCampaigns(data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [flow.id]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleSendCampaign = async () => {
    if (!confirmSend) return;
    setSending(true);
    setSendResult(null);
    try {
      // If resend with edits, pass overrides (exclude attachments from body, they go separately)
      const { attachments: resendAttachments, ...resendEmailOverrides } = resendOverrides;
      const overrideBody = resendEditing ? { ...resendEmailOverrides, attachments: resendAttachments } : {};
      const res = await fetch(`/api/admin/flows/${flow.id}/campaigns/${confirmSend.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrideBody),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult({ sent: data.sent, failed: data.failed, total: data.total });
        fetchCampaigns();
      } else {
        toast.error(data.error || 'Error al enviar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSending(false);
    }
  };

  const handleViewStats = async (campaign: Campaign) => {
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}/campaigns/${campaign.id}/stats`);
      const data = await res.json();
      setStatsData(data);
      setView('stats');
    } catch {
      toast.error('Error al cargar las estadísticas');
    }
  };

  const closeSendModal = () => {
    setConfirmSend(null); setConfirmSendFull(null); setSendResult(null); setResendEditing(false);
  };

  const loadPreviewFor = async (c: Campaign) => {
    setConfirmSend(c);
    setConfirmSendFull(null);
    setSendResult(null);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}/campaigns/${c.id}`);
      const data = await res.json();
      setConfirmSendFull(data.data);
    } catch { /* ignore */ }
    finally { setLoadingPreview(false); }
  };

  return (
    <FlowPanelShell Icon={Mail} title={flow.name} subtitle={flow.description || 'Email masivo'} onClose={onClose}>
      {view === 'campaigns' && (
        <CampaignsView
          campaigns={campaigns}
          loading={loading}
          onCreateNew={() => setView('create-campaign')}
          onSend={(c) => { setResendEditing(false); loadPreviewFor(c); }}
          onViewStats={handleViewStats}
          onResend={(c) => setResendChoice(c)}
        />
      )}

      {view === 'create-campaign' && (
        <CreateCampaignWizard
          flowId={flow.id}
          onDone={() => { setView('campaigns'); fetchCampaigns(); }}
          onCancel={() => setView('campaigns')}
        />
      )}

      {view === 'resend-edit' && resendCampaign && (
        <div>
          <PanelSubHeader
            onBack={() => { setView('campaigns'); setResendEditing(false); setResendCampaign(null); }}
            backLabel="Campañas"
            title="Editar el correo para reenviarlo"
            subtitle={resendCampaign.subject}
          />

          <div className="space-y-4">
            <PixelInput label="Correo remitente" value={resendOverrides.from_email}
              onChange={(e) => setResendOverrides((p) => ({ ...p, from_email: e.target.value }))} />
            <PixelInput label="Asunto" value={resendOverrides.subject}
              onChange={(e) => setResendOverrides((p) => ({ ...p, subject: e.target.value }))} />
            <div>
              <label className={LABEL}>Cuerpo del correo</label>
              <HtmlEditor value={resendOverrides.body_html} onChange={(v) => setResendOverrides((p) => ({ ...p, body_html: v }))} rows={10} />
            </div>
            <div>
              <label className={LABEL}>Pie de página</label>
              <HtmlEditor value={resendOverrides.footer_html} onChange={(v) => setResendOverrides((p) => ({ ...p, footer_html: v }))} rows={4} />
            </div>

            <AttachmentsManager attachments={resendOverrides.attachments} onChange={(a) => setResendOverrides((p) => ({ ...p, attachments: a }))} />

            <PanelFooter>
              <button onClick={() => { setView('campaigns'); setResendEditing(false); setResendCampaign(null); }} className={BTN_SECONDARY}>
                Cancelar
              </button>
              <button
                onClick={() => {
                  const previewCampaign = { ...resendCampaign, ...resendOverrides };
                  setConfirmSend(resendCampaign);
                  setConfirmSendFull(previewCampaign as Campaign);
                  setSendResult(null);
                }}
                className={BTN_PRIMARY}
              >
                <Eye className="w-4 h-4" /> Previsualizar y enviar
              </button>
            </PanelFooter>
          </div>
        </div>
      )}

      {view === 'stats' && statsData && (
        <StatsView stats={statsData} onBack={() => { setView('campaigns'); setStatsData(null); }} />
      )}

      {/* Send Confirmation + Preview Modal */}
      <PixelModal open={!!confirmSend} onClose={closeSendModal} title="Previsualizar y enviar" size="lg" busy={sending}>
        <div className="space-y-4">
          {!sendResult ? (
            <>
              {/* Campaign info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-digi-muted mb-0.5" style={mf}>Remitente</span>
                  <span className="text-[13px] text-digi-text" style={mf}>{resendEditing ? resendOverrides.from_email : (confirmSendFull?.from_email || confirmSend?.from_email)}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-digi-muted mb-0.5" style={mf}>Lista</span>
                  <span className="text-[13px] text-digi-text" style={mf}>
                    {confirmSend?.list_name}
                    <span className="text-digi-muted"> · {confirmSend?.total_contacts} contactos</span>
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[11px] text-digi-muted mb-0.5" style={mf}>Asunto</span>
                  <span className="text-[13px] font-medium text-digi-text" style={mf}>{resendEditing ? resendOverrides.subject : confirmSend?.subject}</span>
                </div>
                {confirmSend?.status === 'sent' && (
                  <div className="col-span-2"><PixelBadge variant="warning">Reenvío</PixelBadge></div>
                )}
              </div>

              {/* Email preview */}
              <div>
                <span className="block text-[11px] text-digi-muted mb-1.5" style={mf}>Previsualización del correo</span>
                {loadingPreview ? (
                  <div className="flex justify-center py-8"><BrandLoader size="sm" label="Cargando previsualización…" /></div>
                ) : confirmSendFull ? (
                  <div className="border border-digi-border rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={buildPreviewHtml(confirmSendFull.body_html, confirmSendFull.footer_html)}
                      className="w-full bg-white"
                      style={{ height: '350px', border: 'none' }}
                      sandbox="allow-same-origin"
                      title="Previsualización del correo"
                    />
                  </div>
                ) : (
                  <PanelEmpty Icon={Mail} title="No se pudo cargar la previsualización" />
                )}
              </div>

              <PanelFooter align="end">
                <button onClick={closeSendModal} className={BTN_SECONDARY}>Cancelar</button>
                <button onClick={handleSendCampaign} disabled={sending || loadingPreview} className={BTN_PRIMARY}>
                  <Send className="w-4 h-4" />
                  {sending ? 'Enviando…' : `Enviar a ${confirmSend?.total_contacts} contactos`}
                </button>
              </PanelFooter>
            </>
          ) : (
            <>
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-green-400" strokeWidth={3} />
                </div>
                <p className="text-[26px] font-semibold text-digi-text tabular-nums" style={mf}>{sendResult.sent}/{sendResult.total}</p>
                <p className="text-[12px] text-digi-muted mt-1" style={mf}>correos enviados correctamente</p>
                {sendResult.failed > 0 && (
                  <p className="text-[13px] text-red-400 mt-2" style={mf}>{sendResult.failed} fallidos</p>
                )}
              </div>
              <PanelFooter align="end">
                <button onClick={closeSendModal} className={BTN_PRIMARY}>Cerrar</button>
              </PanelFooter>
            </>
          )}
        </div>
      </PixelModal>

      {/* Resend Choice Modal — same or different */}
      <PixelModal open={!!resendChoice && !resendEditing && !confirmSend} onClose={() => setResendChoice(null)} title="Reenviar campaña" size="sm">
        <div className="space-y-4">
          <p className="text-[13px] text-digi-muted" style={mf}>
            ¿Cómo quieres reenviar <span className="text-digi-text font-medium">{resendChoice?.subject}</span>?
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={async () => {
                if (!resendChoice) return;
                setResendEditing(false);
                await loadPreviewFor(resendChoice);
                setResendChoice(null);
              }}
              className="rounded-lg border border-digi-border bg-digi-darker/40 px-3 py-4 text-center hover:border-accent transition-colors"
            >
              <Send className="w-4 h-4 text-accent mx-auto mb-1.5" />
              <p className="text-[13px] font-medium text-digi-text" style={mf}>Mismo correo</p>
              <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Reenviar con el mismo contenido</p>
            </button>
            <button
              onClick={async () => {
                if (!resendChoice) return;
                try {
                  const res = await fetch(`/api/admin/flows/${flow.id}/campaigns/${resendChoice.id}`);
                  const data = await res.json();
                  const c = data.data;
                  setResendOverrides({
                    from_email: c.from_email,
                    subject: c.subject,
                    body_html: c.body_html,
                    footer_html: c.footer_html,
                    attachments: c.attachments || [],
                  });
                } catch { /* ignore */ }
                setResendCampaign(resendChoice);
                setResendEditing(true);
                setView('resend-edit');
                setResendChoice(null);
              }}
              className="rounded-lg border border-digi-border bg-digi-darker/40 px-3 py-4 text-center hover:border-accent transition-colors"
            >
              <Code2 className="w-4 h-4 text-accent mx-auto mb-1.5" />
              <p className="text-[13px] font-medium text-digi-text" style={mf}>Correo diferente</p>
              <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Editar el contenido antes de enviar</p>
            </button>
          </div>
          <PanelFooter align="end">
            <button onClick={() => setResendChoice(null)} className={BTN_SECONDARY}>Cancelar</button>
          </PanelFooter>
        </div>
      </PixelModal>
    </FlowPanelShell>
  );
}

/* ─── Campaigns Table View ─── */
function CampaignsView({
  campaigns, loading, onCreateNew, onSend, onViewStats, onResend,
}: {
  campaigns: Campaign[];
  loading: boolean;
  onCreateNew: () => void;
  onSend: (c: Campaign) => void;
  onViewStats: (c: Campaign) => void;
  onResend: (c: Campaign) => void;
}) {
  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando campañas…" /></div>;

  return (
    <div>
      <SectionBar title="Campañas" hint={campaigns.length ? `${campaigns.length} en total` : undefined}>
        <button onClick={onCreateNew} className={BTN_PRIMARY}>
          <Plus className="w-4 h-4" /> Nueva campaña
        </button>
      </SectionBar>

      <PixelDataTable
        singleLine
        columns={[
          { key: 'subject', header: 'Asunto', render: (c: Campaign) => (
            <span className="block text-[13px] font-medium text-digi-text truncate max-w-[280px]" style={mf}>{c.subject}</span>
          ) },
          { key: 'list', header: 'Lista', width: '150px', render: (c: Campaign) => (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-digi-text" style={mf}>
              <Users className="w-3.5 h-3.5 text-digi-muted shrink-0" />
              <span className="truncate">{c.list_name || '—'}</span>
            </span>
          ) },
          { key: 'contacts', header: 'Contactos', width: '90px', hideOnMobile: true, render: (c: Campaign) => (
            <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{c.total_contacts || 0}</span>
          ) },
          { key: 'status', header: 'Estado', width: '110px', render: (c: Campaign) => (
            <PixelBadge variant={CAMP_STATUS_V[c.status] || 'default'}>{CAMP_STATUS_L[c.status] || c.status}</PixelBadge>
          ) },
          { key: 'sent', header: 'Enviados', width: '90px', hideOnMobile: true, render: (c: Campaign) => (
            <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{c.status === 'sent' ? `${c.sent_count}/${c.total_contacts}` : '—'}</span>
          ) },
          { key: 'date', header: 'Fecha', width: '100px', hideOnMobile: true, render: (c: Campaign) => (
            <span className="text-[12px] text-digi-muted" style={mf}>{new Date(c.created_at).toLocaleDateString('es-EC')}</span>
          ) },
          { key: 'actions', header: '', width: '190px', render: (c: Campaign) => (
            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              {c.status === 'draft' && (
                <button onClick={() => onSend(c)} className={BTN_ROW}><Send className="w-3.5 h-3.5" /> Enviar</button>
              )}
              {c.status === 'sent' && (
                <>
                  <button onClick={() => onResend(c)} className={BTN_ROW}><RotateCcw className="w-3.5 h-3.5" /> Reenviar</button>
                  <button onClick={() => onViewStats(c)} className={BTN_ROW}><BarChart3 className="w-3.5 h-3.5" /> Estadísticas</button>
                </>
              )}
            </div>
          ) },
        ]}
        data={campaigns}
        emptyTitle="Sin campañas"
        emptyDesc="Crea tu primera campaña de email masivo."
      />
    </div>
  );
}

/* ─── Create Campaign Wizard ─── */
function CreateCampaignWizard({ flowId, onDone, onCancel }: { flowId: number; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(1); // 1 = contact list, 2 = email config
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);

  // Contact list creation
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  // Contacts management
  const [expandedListId, setExpandedListId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email config
  const [fromEmail, setFromEmail] = useState('GCC World <noreply@gccworld.com>');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [footerHtml, setFooterHtml] = useState('');
  const [attachments, setAttachments] = useState<{ filename: string; content: string; size: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/contact-lists`);
      const data = await res.json();
      setContactLists(data.data || []);
    } catch { /* ignore */ }
    finally { setLoadingLists(false); }
  }, [flowId]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/contact-lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      if (res.ok) {
        setNewListName('');
        setShowCreateList(false);
        fetchLists();
      }
    } catch { /* ignore */ }
    finally { setCreatingList(false); }
  };

  const fetchContacts = async (listId: number) => {
    setLoadingContacts(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/contact-lists/${listId}/contacts`);
      const data = await res.json();
      setContacts(data.data || []);
    } catch { /* ignore */ }
    finally { setLoadingContacts(false); }
  };

  const toggleExpand = (listId: number) => {
    if (expandedListId === listId) {
      setExpandedListId(null);
      setContacts([]);
    } else {
      setExpandedListId(listId);
      fetchContacts(listId);
    }
  };

  const handleAddContact = async () => {
    if (!expandedListId || !newContactName.trim() || !newContactEmail.trim()) return;
    setAddingContact(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/contact-lists/${expandedListId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newContactName.trim(), email: newContactEmail.trim() }),
      });
      if (res.ok) {
        setNewContactName('');
        setNewContactEmail('');
        fetchContacts(expandedListId);
        fetchLists(); // update count
      }
    } catch { /* ignore */ }
    finally { setAddingContact(false); }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!expandedListId) return;
    await fetch(`/api/admin/flows/${flowId}/contact-lists/${expandedListId}/contacts?contactId=${contactId}`, { method: 'DELETE' });
    fetchContacts(expandedListId);
    fetchLists();
  };

  const handleDeleteList = async (listId: number) => {
    await fetch(`/api/admin/flows/${flowId}/contact-lists/${listId}`, { method: 'DELETE' });
    if (selectedListId === listId) setSelectedListId(null);
    if (expandedListId === listId) { setExpandedListId(null); setContacts([]); }
    fetchLists();
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'correo'],
      ['Juan Pérez', 'juan@ejemplo.com'],
      ['María López', 'maria@ejemplo.com'],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
    XLSX.writeFile(wb, 'plantilla_contactos.xlsx');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !expandedListId) return;
    setImportingContacts(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      const contacts = rows
        .map(row => ({
          name: (row['nombre'] || row['Nombre'] || row['name'] || row['Name'] || '').toString().trim(),
          email: (row['correo'] || row['Correo'] || row['email'] || row['Email'] || '').toString().trim().toLowerCase(),
        }))
        .filter(c => c.name && c.email);

      if (contacts.length === 0) {
        toast.error('No se encontraron contactos válidos. El archivo debe tener columnas "nombre" y "correo".');
        return;
      }

      const res = await fetch(`/api/admin/flows/${flowId}/contact-lists/${expandedListId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contacts),
      });

      if (res.ok) {
        fetchContacts(expandedListId);
        fetchLists();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error al importar');
      }
    } catch {
      toast.error('Error al leer el archivo');
    } finally {
      setImportingContacts(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveCampaign = async () => {
    if (!selectedListId) { setError('Selecciona una lista de contactos'); return; }
    if (!subject.trim()) { setError('El asunto es requerido'); return; }
    if (!bodyHtml.trim()) { setError('El cuerpo del correo es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_list_id: selectedListId,
          from_email: fromEmail,
          subject: subject.trim(),
          body_html: bodyHtml,
          footer_html: footerHtml,
          attachments,
        }),
      });
      if (res.ok) {
        onDone();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al guardar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PanelSubHeader onBack={onCancel} backLabel="Campañas" title="Nueva campaña">
        <Steps items={['Contactos', 'Correo']} current={step} onGo={setStep} />
      </PanelSubHeader>

      {step === 1 && (
        <div>
          <SectionBar title="Listas de contactos" hint="Elige la lista a la que se enviará la campaña.">
            <button onClick={() => setShowCreateList(true)} className={BTN_SECONDARY}>
              <Plus className="w-4 h-4" /> Nueva lista
            </button>
          </SectionBar>

          {/* Create list form */}
          {showCreateList && (
            <div className="rounded-lg border border-digi-border bg-digi-darker/40 p-3 mb-3">
              <label className={LABEL}>Nombre de la lista</label>
              <div className="flex gap-2">
                <input
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  placeholder="Ej: Clientes VIP"
                  className={`${FIELD} flex-1`}
                  style={mf}
                  onKeyDown={e => e.key === 'Enter' && handleCreateList()}
                />
                <button onClick={handleCreateList} disabled={creatingList} className={BTN_PRIMARY}>
                  {creatingList ? 'Creando…' : 'Crear'}
                </button>
                <button onClick={() => setShowCreateList(false)} className={BTN_SECONDARY} aria-label="Cancelar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Lists */}
          {loadingLists ? (
            <div className="flex justify-center py-8"><BrandLoader size="sm" /></div>
          ) : contactLists.length === 0 ? (
            <PanelEmpty Icon={Users} title="No hay listas de contactos" desc="Crea una lista para continuar." />
          ) : (
            <div className="space-y-2">
              {contactLists.map(list => {
                const selected = selectedListId === list.id;
                const expanded = expandedListId === list.id;
                return (
                  <div key={list.id} className={`rounded-lg border transition-colors overflow-hidden ${selected ? 'border-accent bg-accent-light/40' : 'border-digi-border'}`}>
                    {/* List header */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button onClick={() => toggleExpand(list.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-digi-muted hover:bg-black/[0.04] hover:text-digi-text transition-colors shrink-0"
                        aria-label={expanded ? 'Contraer' : 'Ver contactos'}>
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-digi-text truncate" style={mf}>{list.name}</span>
                        <span className="block text-[11px] text-digi-muted" style={mf}>{list.contact_count} contactos</span>
                      </div>
                      <button
                        onClick={() => setSelectedListId(selected ? null : list.id)}
                        className={selected
                          ? 'inline-flex items-center gap-1 px-2 py-1 rounded border border-accent bg-accent text-white text-[12px] font-medium transition-colors'
                          : BTN_ROW}
                      >
                        {selected ? <><Check className="w-3.5 h-3.5" strokeWidth={3} /> Seleccionada</> : 'Seleccionar'}
                      </button>
                      <button onClick={() => handleDeleteList(list.id)} className={BTN_ROW_DANGER} aria-label="Eliminar lista">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Expanded contacts */}
                    {expanded && (
                      <div className="border-t border-digi-border px-3 py-3 bg-digi-darker/40">
                        {/* Add contact form */}
                        <div className="flex flex-wrap gap-2 mb-2.5">
                          <input
                            value={newContactName}
                            onChange={e => setNewContactName(e.target.value)}
                            placeholder="Nombre"
                            className={`${FIELD_SM} flex-1 min-w-[120px]`}
                            style={mf}
                          />
                          <input
                            value={newContactEmail}
                            onChange={e => setNewContactEmail(e.target.value)}
                            placeholder="correo@ejemplo.com"
                            className={`${FIELD_SM} flex-1 min-w-[160px]`}
                            style={mf}
                            onKeyDown={e => e.key === 'Enter' && handleAddContact()}
                          />
                          <button onClick={handleAddContact} disabled={addingContact} className={BTN_SECONDARY}>
                            <Plus className="w-4 h-4" /> {addingContact ? 'Agregando…' : 'Agregar'}
                          </button>
                        </div>

                        {/* Import / Download template */}
                        <div className="flex flex-wrap gap-2 mb-2.5">
                          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
                          <button onClick={() => fileInputRef.current?.click()} disabled={importingContacts} className={BTN_ROW}>
                            <FileSpreadsheet className="w-3.5 h-3.5" /> {importingContacts ? 'Importando…' : 'Importar Excel'}
                          </button>
                          <button onClick={handleDownloadTemplate} className={BTN_ROW}>
                            <Download className="w-3.5 h-3.5" /> Descargar plantilla
                          </button>
                        </div>

                        {/* Contacts list */}
                        {loadingContacts ? (
                          <div className="flex justify-center py-4"><BrandLoader size="sm" /></div>
                        ) : contacts.length === 0 ? (
                          <p className="text-center text-[12px] text-digi-muted py-3" style={mf}>Sin contactos en esta lista.</p>
                        ) : (
                          <div className="max-h-52 overflow-y-auto space-y-1">
                            {contacts.map(c => (
                              <div key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-digi-border bg-digi-card">
                                <span className="flex-1 min-w-0 text-[12.5px] text-digi-text truncate" style={mf}>{c.name}</span>
                                <span className="flex-1 min-w-0 text-[12px] text-digi-muted truncate" style={mf}>{c.email}</span>
                                <button onClick={() => handleDeleteContact(c.id)} className="text-digi-muted/70 hover:text-red-500 transition-colors shrink-0" aria-label="Quitar contacto">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && !selectedListId && <p className="text-[12px] text-red-400 mt-2 text-right" style={mf}>{error}</p>}

          <div className="mt-4">
            <PanelFooter align="end">
              <button
                onClick={() => { if (selectedListId) setStep(2); else setError('Selecciona una lista'); }}
                className={BTN_PRIMARY}
                disabled={!selectedListId}
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </PanelFooter>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <SectionBar title="Configuración del correo" />

          <div className="space-y-4">
            <PixelInput label="Correo remitente" value={fromEmail} onChange={e => setFromEmail(e.target.value)}
              placeholder="Nombre <correo@dominio.com>" />
            <PixelInput label="Asunto" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Asunto del correo" />

            <div>
              <label className={LABEL}>Cuerpo del correo</label>
              <HtmlEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Escribe el contenido del correo…" rows={10} />
            </div>

            <div>
              <label className={LABEL}>Pie de página</label>
              <HtmlEditor value={footerHtml} onChange={setFooterHtml} placeholder="Pie de página del correo…" rows={4} />
            </div>

            <AttachmentsManager attachments={attachments} onChange={setAttachments} />

            {error && <p className="text-[12px] text-red-400" style={mf}>{error}</p>}

            <PanelFooter>
              <button onClick={() => setStep(1)} className={BTN_SECONDARY}>
                <ChevronRight className="w-4 h-4 rotate-180" /> Anterior
              </button>
              <button onClick={handleSaveCampaign} disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Guardando…' : 'Crear campaña'}
              </button>
            </PanelFooter>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Attachments Manager ─── */
function AttachmentsManager({
  attachments,
  onChange,
}: {
  attachments: { filename: string; content: string; size: number }[];
  onChange: (a: { filename: string; content: string; size: number }[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAdding(true);
    try {
      const newAttachments: { filename: string; content: string; size: number }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} supera el límite de 10MB`);
          continue;
        }
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        newAttachments.push({ filename: file.name, content: base64, size: file.size });
      }
      onChange([...attachments, ...newAttachments]);
    } catch {
      toast.error('Error al leer los archivos');
    } finally {
      setAdding(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const totalSize = attachments.reduce((s, a) => s + a.size, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label className={`${LABEL} mb-0`}>Archivos adjuntos</label>
        <div>
          <input ref={inputRef} type="file" multiple onChange={handleFiles} className="hidden" />
          <button onClick={() => inputRef.current?.click()} disabled={adding} className={BTN_ROW}>
            <Paperclip className="w-3.5 h-3.5" /> {adding ? 'Cargando…' : 'Adjuntar archivo'}
          </button>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((a, i) => (
            <FileRow key={i} name={a.filename} meta={formatSize(a.size)}
              onRemove={() => onChange(attachments.filter((_, idx) => idx !== i))} />
          ))}
          <p className="text-[11px] text-digi-muted pt-0.5" style={mf}>
            {attachments.length} archivo{attachments.length > 1 ? 's' : ''} · {formatSize(totalSize)} en total
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── HTML Editor with Toolbar ─── */
function HtmlEditor({
  value, onChange, placeholder, rows = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const insertTag = (openTag: string, closeTag: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);
    const newValue = `${before}${openTag}${selected}${closeTag}${after}`;
    onChange(newValue);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + openTag.length;
      ta.selectionEnd = start + openTag.length + selected.length;
    }, 0);
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = value.substring(0, start);
    const after = value.substring(start);
    onChange(`${before}${text}${after}`);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    }, 0);
  };

  const handleInsertLink = () => {
    const url = prompt('URL del enlace:');
    if (!url) return;
    const text = prompt('Texto del enlace:', 'Clic aquí') || 'Clic aquí';
    insertAtCursor(`<a href="${url}" style="color:#7B5FBF;text-decoration:underline;">${text}</a>`);
  };

  const handleInsertImage = () => {
    const url = prompt('URL de la imagen:');
    if (!url) return;
    const alt = prompt('Texto alternativo:', 'imagen') || 'imagen';
    insertAtCursor(`<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;" />`);
  };

  // Barra de formato: iconos lucide (el estándar del dashboard), no siglas de texto.
  const toolbarBtns: { Icon: any; title: string; action: () => void }[] = [
    { Icon: Bold, title: 'Negrita', action: () => insertTag('<strong>', '</strong>') },
    { Icon: Italic, title: 'Cursiva', action: () => insertTag('<em>', '</em>') },
    { Icon: Underline, title: 'Subrayado', action: () => insertTag('<u>', '</u>') },
    { Icon: Heading1, title: 'Título 1', action: () => insertTag('<h1 style="color:#222222;font-size:22px;font-weight:600;margin:0 0 12px;">', '</h1>') },
    { Icon: Heading2, title: 'Título 2', action: () => insertTag('<h2 style="color:#222222;font-size:18px;font-weight:600;margin:0 0 10px;">', '</h2>') },
    { Icon: Pilcrow, title: 'Párrafo', action: () => insertTag('<p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 12px;">', '</p>') },
    { Icon: Link2, title: 'Enlace', action: handleInsertLink },
    { Icon: ImageIcon, title: 'Imagen', action: handleInsertImage },
    { Icon: Minus, title: 'Línea separadora', action: () => insertAtCursor('<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;" />') },
    { Icon: MousePointerClick, title: 'Botón', action: () => {
      const url = prompt('URL del botón:') || '#';
      const text = prompt('Texto del botón:', 'Clic aquí') || 'Clic aquí';
      insertAtCursor(`<div style="text-align:center;margin:20px 0;"><a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:12px 32px;font-weight:600;font-size:14px;border-radius:4px;">${text}</a></div>`);
    } },
  ];

  return (
    <div className="border border-digi-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-digi-card border-b border-digi-border">
        {toolbarBtns.map(btn => (
          <button
            key={btn.title}
            type="button"
            onClick={btn.action}
            title={btn.title}
            aria-label={btn.title}
            className="w-7 h-7 flex items-center justify-center rounded-md text-digi-muted hover:bg-accent-light hover:text-accent transition-colors"
          >
            <btn.Icon className="w-4 h-4" />
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium transition-colors ${
            preview ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text'
          }`}
          style={mf}
        >
          {preview ? <><Code2 className="w-3.5 h-3.5" /> Código</> : <><Eye className="w-3.5 h-3.5" /> Vista previa</>}
        </button>
      </div>

      {/* Editor or Preview */}
      {preview ? (
        <div
          className="px-3 py-2.5 bg-digi-darker text-sm text-digi-text min-h-[120px] overflow-auto"
          style={{ ...mf, maxHeight: rows * 24 }}
          dangerouslySetInnerHTML={{ __html: value || '<span style="opacity:.6;">Sin contenido</span>' }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2.5 bg-digi-darker text-sm text-digi-text placeholder:text-digi-muted/50 focus:outline-none resize-none border-0"
          style={mf}
        />
      )}
    </div>
  );
}

/* ─── Campaign Stats View ─── */
function StatsView({ stats, onBack }: { stats: CampaignStats; onBack: () => void }) {
  const SEND_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    pending: 'default', sent: 'success', delivered: 'success', bounced: 'warning', failed: 'error',
  };

  return (
    <div>
      <PanelSubHeader onBack={onBack} backLabel="Campañas" title="Estadísticas" subtitle={stats.campaign.subject} />

      <StatCards items={[
        { label: 'Total', value: stats.summary.total },
        { label: 'Enviados', value: stats.summary.sent, tone: 'success' },
        { label: 'Entregados', value: stats.summary.delivered, tone: 'info' },
        { label: 'Rebotados', value: stats.summary.bounced, tone: 'warning' },
        { label: 'Fallidos', value: stats.summary.failed, tone: 'danger' },
      ]} />

      <PixelDataTable
        singleLine
        columns={[
          { key: 'name', header: 'Contacto', render: (s: any) => (
            <span className="text-[13px] text-digi-text" style={mf}>{s.contact_name}</span>
          ) },
          { key: 'email', header: 'Correo', render: (s: any) => (
            <span className="text-[12px] text-digi-muted" style={mf}>{s.contact_email}</span>
          ) },
          { key: 'status', header: 'Estado', width: '110px', render: (s: any) => (
            <PixelBadge variant={SEND_STATUS_V[s.status] || 'default'}>{SEND_STATUS_L[s.status] || s.status}</PixelBadge>
          ) },
          { key: 'error', header: 'Error', hideOnMobile: true, render: (s: any) => (
            <span className="text-[12px] text-red-400 truncate max-w-[200px] inline-block" style={mf}>{s.error_message || '—'}</span>
          ) },
          { key: 'date', header: 'Fecha', width: '140px', hideOnMobile: true, render: (s: any) => (
            <span className="text-[12px] text-digi-muted" style={mf}>{s.sent_at ? new Date(s.sent_at).toLocaleString('es-EC') : '—'}</span>
          ) },
        ]}
        data={stats.sends}
        emptyTitle="Sin envíos"
        emptyDesc="No hay registros de envío para esta campaña."
      />
    </div>
  );
}
