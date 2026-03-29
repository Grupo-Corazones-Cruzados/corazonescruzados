'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

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
  draft: 'Borrador', sending: 'Enviando...', sent: 'Enviada', failed: 'Fallida',
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
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
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
        alert(data.error || 'Error al enviar');
      }
    } catch {
      alert('Error de conexion');
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
      alert('Error al cargar estadisticas');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-4xl bg-digi-darker border-l-2 border-digi-border overflow-y-auto animate-[slideInRight_0.3s_ease-out]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-digi-darker border-b-2 border-digi-border px-6 py-4 flex items-center gap-4">
          <button onClick={onClose} className="text-digi-muted hover:text-white transition-colors" style={pf}>
            &lt; Volver
          </button>
          <div className="flex-1">
            <h2 className="pixel-heading text-sm text-white">{flow.name}</h2>
            <p className="text-[10px] text-digi-muted mt-0.5" style={mf}>{flow.description || 'Email masivo'}</p>
          </div>
        </div>

        <div className="p-6">
          {view === 'campaigns' && (
            <CampaignsView
              campaigns={campaigns}
              loading={loading}
              onCreateNew={() => setView('create-campaign')}
              onSend={async (c) => {
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
              }}
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
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => { setView('campaigns'); setResendEditing(false); setResendCampaign(null); }} className="text-digi-muted hover:text-white text-[9px] transition-colors" style={pf}>
                  &lt; Campanas
                </button>
                <h3 className="pixel-heading text-xs text-white">Editar correo para reenvio</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Correo Remitente</label>
                  <input
                    value={resendOverrides.from_email}
                    onChange={e => setResendOverrides(p => ({ ...p, from_email: e.target.value }))}
                    className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
                    style={mf}
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Asunto</label>
                  <input
                    value={resendOverrides.subject}
                    onChange={e => setResendOverrides(p => ({ ...p, subject: e.target.value }))}
                    className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
                    style={mf}
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Cuerpo del Correo</label>
                  <HtmlEditor value={resendOverrides.body_html} onChange={v => setResendOverrides(p => ({ ...p, body_html: v }))} rows={10} />
                </div>
                <div>
                  <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Pie de Pagina</label>
                  <HtmlEditor value={resendOverrides.footer_html} onChange={v => setResendOverrides(p => ({ ...p, footer_html: v }))} rows={4} />
                </div>

                <AttachmentsManager attachments={resendOverrides.attachments} onChange={a => setResendOverrides(p => ({ ...p, attachments: a }))} />

                <div className="flex justify-between pt-4 border-t-2 border-digi-border">
                  <button onClick={() => { setView('campaigns'); setResendEditing(false); setResendCampaign(null); }} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-white transition-colors" style={pf}>
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const previewCampaign = { ...resendCampaign, ...resendOverrides };
                      setConfirmSend(resendCampaign);
                      setConfirmSendFull(previewCampaign as Campaign);
                      setSendResult(null);
                    }}
                    className="pixel-btn-primary px-4 py-2 text-[9px]"
                    style={pf}
                  >
                    Previsualizar y Enviar &gt;
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'stats' && statsData && (
            <StatsView
              stats={statsData}
              onBack={() => { setView('campaigns'); setStatsData(null); }}
            />
          )}
        </div>
      </div>

      {/* Send Confirmation + Preview Modal */}
      <PixelModal open={!!confirmSend} onClose={() => { setConfirmSend(null); setConfirmSendFull(null); setSendResult(null); setResendEditing(false); }} title="Previsualizar y Enviar" size="lg">
        <div className="space-y-4">
          {!sendResult ? (
            <>
              {/* Campaign info */}
              <div className="grid grid-cols-2 gap-3 text-xs" style={mf}>
                <div>
                  <span className="text-digi-muted block text-[9px] mb-0.5" style={pf}>Remitente</span>
                  <span className="text-white">{resendEditing ? resendOverrides.from_email : (confirmSendFull?.from_email || confirmSend?.from_email)}</span>
                </div>
                <div>
                  <span className="text-digi-muted block text-[9px] mb-0.5" style={pf}>Lista</span>
                  <span className="text-accent-glow">{confirmSend?.list_name}</span>
                  <span className="text-digi-muted ml-1">({confirmSend?.total_contacts} contactos)</span>
                </div>
                <div className="col-span-2">
                  <span className="text-digi-muted block text-[9px] mb-0.5" style={pf}>Asunto</span>
                  <span className="text-white font-medium">{resendEditing ? resendOverrides.subject : confirmSend?.subject}</span>
                </div>
                {confirmSend?.status === 'sent' && (
                  <div className="col-span-2">
                    <PixelBadge variant="warning">Reenvio</PixelBadge>
                  </div>
                )}
              </div>

              {/* Email preview */}
              <div>
                <span className="text-digi-muted block text-[9px] mb-1" style={pf}>Previsualizacion del correo</span>
                {loadingPreview ? (
                  <div className="flex justify-center py-8"><BrandLoader size="sm" label="Cargando preview..." /></div>
                ) : confirmSendFull ? (
                  <div className="border-2 border-digi-border rounded overflow-hidden">
                    <iframe
                      srcDoc={buildPreviewHtml(confirmSendFull.body_html, confirmSendFull.footer_html)}
                      className="w-full bg-white"
                      style={{ height: '350px', border: 'none' }}
                      sandbox="allow-same-origin"
                      title="Preview del correo"
                    />
                  </div>
                ) : (
                  <div className="pixel-card text-center py-6">
                    <p className="text-xs text-digi-muted" style={mf}>No se pudo cargar la previsualizacion</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
                <button onClick={() => { setConfirmSend(null); setConfirmSendFull(null); setResendEditing(false); }} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-white transition-colors" style={pf}>Cancelar</button>
                <button onClick={handleSendCampaign} disabled={sending || loadingPreview} className="pixel-btn-primary px-4 py-2 text-[9px]" style={pf}>
                  {sending ? 'Enviando...' : `Enviar a ${confirmSend?.total_contacts} contactos`}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-6">
                <p className="text-2xl font-bold text-green-400" style={mf}>{sendResult.sent}/{sendResult.total}</p>
                <p className="text-[9px] text-digi-muted mt-1" style={pf}>Correos enviados exitosamente</p>
                {sendResult.failed > 0 && (
                  <p className="text-xs text-red-400 mt-2" style={mf}>{sendResult.failed} fallidos</p>
                )}
              </div>
              <div className="flex justify-end pt-2 border-t-2 border-digi-border">
                <button onClick={() => { setConfirmSend(null); setConfirmSendFull(null); setSendResult(null); setResendEditing(false); }} className="pixel-btn-primary px-4 py-2 text-[9px]" style={pf}>
                  Cerrar
                </button>
              </div>
            </>
          )}
        </div>
      </PixelModal>

      {/* Resend Choice Modal — same or different */}
      <PixelModal open={!!resendChoice && !resendEditing && !confirmSend} onClose={() => setResendChoice(null)} title="Reenviar Campana" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-digi-muted" style={mf}>
            Como deseas reenviar <span className="text-white">{resendChoice?.subject}</span>?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={async () => {
                if (!resendChoice) return;
                // Same email → go to preview
                setConfirmSend(resendChoice);
                setConfirmSendFull(null);
                setSendResult(null);
                setResendEditing(false);
                setLoadingPreview(true);
                try {
                  const res = await fetch(`/api/admin/flows/${flow.id}/campaigns/${resendChoice.id}`);
                  const data = await res.json();
                  setConfirmSendFull(data.data);
                } catch { /* ignore */ }
                finally { setLoadingPreview(false); }
                setResendChoice(null);
              }}
              className="pixel-card py-6 text-center hover:border-accent transition-colors cursor-pointer"
            >
              <p className="text-sm text-white mb-1" style={pf}>Mismo correo</p>
              <p className="text-[9px] text-digi-muted" style={mf}>Reenviar con el mismo contenido</p>
            </button>
            <button
              onClick={async () => {
                if (!resendChoice) return;
                // Different email → load data and switch to edit view
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
              className="pixel-card py-6 text-center hover:border-accent transition-colors cursor-pointer"
            >
              <p className="text-sm text-white mb-1" style={pf}>Correo diferente</p>
              <p className="text-[9px] text-digi-muted" style={mf}>Editar el contenido antes de enviar</p>
            </button>
          </div>
          <div className="flex justify-end pt-2 border-t-2 border-digi-border">
            <button onClick={() => setResendChoice(null)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-white transition-colors" style={pf}>Cancelar</button>
          </div>
        </div>
      </PixelModal>

    </div>
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
  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando campanas..." /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="pixel-heading text-xs text-white">Campanas</h3>
        <button onClick={onCreateNew} className="pixel-btn-primary px-3 py-1.5 text-[9px]" style={pf}>
          + Nueva Campana
        </button>
      </div>

      <PixelDataTable
        columns={[
          { key: 'subject', header: 'Asunto', render: (c: Campaign) => <span className="text-white">{c.subject}</span> },
          { key: 'list', header: 'Lista', render: (c: Campaign) => <span className="text-accent-glow">{c.list_name || '-'}</span> },
          { key: 'contacts', header: 'Contactos', render: (c: Campaign) => String(c.total_contacts || 0) },
          { key: 'status', header: 'Estado', render: (c: Campaign) => (
            <PixelBadge variant={CAMP_STATUS_V[c.status] || 'default'}>
              {CAMP_STATUS_L[c.status] || c.status}
            </PixelBadge>
          )},
          { key: 'sent', header: 'Enviados', render: (c: Campaign) => c.status === 'sent' ? `${c.sent_count}/${c.total_contacts}` : '-' },
          { key: 'date', header: 'Fecha', render: (c: Campaign) => new Date(c.created_at).toLocaleDateString() },
          { key: 'actions', header: '', width: '140px', render: (c: Campaign) => (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              {c.status === 'draft' && (
                <button onClick={() => onSend(c)} className="px-2 py-0.5 text-[8px] border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-colors" style={pf}>
                  Enviar
                </button>
              )}
              {c.status === 'sent' && (
                <>
                  <button onClick={() => onResend(c)} className="px-2 py-0.5 text-[8px] border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-colors" style={pf}>
                    Reenviar
                  </button>
                  <button onClick={() => onViewStats(c)} className="px-2 py-0.5 text-[8px] border border-accent/50 text-accent-glow hover:bg-accent/10 transition-colors" style={pf}>
                    Estadisticas
                  </button>
                </>
              )}
            </div>
          )},
        ]}
        data={campaigns}
        emptyTitle="Sin campanas"
        emptyDesc="Crea tu primera campana de email masivo."
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
      ['Juan Perez', 'juan@ejemplo.com'],
      ['Maria Lopez', 'maria@ejemplo.com'],
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
        alert('No se encontraron contactos validos. Asegurate de que el archivo tenga columnas "nombre" y "correo".');
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
        alert(err.error || 'Error al importar');
      }
    } catch {
      alert('Error al leer el archivo');
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
      setError('Error de conexion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onCancel} className="text-digi-muted hover:text-white text-[9px] transition-colors" style={pf}>
          &lt; Campanas
        </button>
        <div className="flex-1 flex items-center gap-2 justify-center">
          <StepIndicator num={1} active={step === 1} done={step > 1} label="Contactos" onClick={() => setStep(1)} />
          <div className={`w-8 h-0.5 ${step > 1 ? 'bg-accent' : 'bg-digi-border'}`} />
          <StepIndicator num={2} active={step === 2} done={false} label="Email" onClick={() => step > 1 && setStep(2)} />
        </div>
      </div>

      {step === 1 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="pixel-heading text-xs text-white">Listas de Contactos</h3>
            <button onClick={() => setShowCreateList(true)} className="pixel-btn-primary px-3 py-1.5 text-[9px]" style={pf}>
              + Nueva Lista
            </button>
          </div>

          {/* Create list form */}
          {showCreateList && (
            <div className="pixel-card mb-4 p-4">
              <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Nombre de la lista</label>
              <div className="flex gap-2">
                <input
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  placeholder="Ej: Clientes VIP"
                  className="flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
                  style={mf}
                  onKeyDown={e => e.key === 'Enter' && handleCreateList()}
                />
                <button onClick={handleCreateList} disabled={creatingList} className="pixel-btn-primary px-3 py-2 text-[9px]" style={pf}>
                  {creatingList ? '...' : 'Crear'}
                </button>
                <button onClick={() => setShowCreateList(false)} className="pixel-btn px-3 py-2 text-[9px]" style={pf}>
                  X
                </button>
              </div>
            </div>
          )}

          {/* Lists */}
          {loadingLists ? (
            <div className="flex justify-center py-8"><BrandLoader size="sm" /></div>
          ) : contactLists.length === 0 ? (
            <div className="pixel-card text-center py-8">
              <p className="text-[9px] text-digi-muted" style={pf}>No hay listas de contactos</p>
              <p className="text-xs text-digi-muted/60 mt-1" style={mf}>Crea una lista para continuar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contactLists.map(list => (
                <div key={list.id} className={`border-2 transition-colors ${
                  selectedListId === list.id ? 'border-accent bg-accent/5' : 'border-digi-border'
                }`}>
                  {/* List header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => toggleExpand(list.id)} className="text-digi-muted hover:text-white transition-colors text-xs" style={pf}>
                      {expandedListId === list.id ? 'v' : '>'}
                    </button>
                    <div className="flex-1">
                      <span className="text-sm text-white" style={mf}>{list.name}</span>
                      <span className="text-[9px] text-digi-muted ml-2" style={pf}>{list.contact_count} contactos</span>
                    </div>
                    <button
                      onClick={() => setSelectedListId(selectedListId === list.id ? null : list.id)}
                      className={`px-3 py-1 text-[8px] border transition-colors ${
                        selectedListId === list.id
                          ? 'border-accent bg-accent/20 text-accent-glow'
                          : 'border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow'
                      }`}
                      style={pf}
                    >
                      {selectedListId === list.id ? 'Seleccionada' : 'Seleccionar'}
                    </button>
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      className="px-2 py-1 text-[8px] border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors"
                      style={pf}
                    >
                      X
                    </button>
                  </div>

                  {/* Expanded contacts */}
                  {expandedListId === list.id && (
                    <div className="border-t-2 border-digi-border px-4 py-3 bg-digi-dark/50">
                      {/* Add contact form */}
                      <div className="flex gap-2 mb-3">
                        <input
                          value={newContactName}
                          onChange={e => setNewContactName(e.target.value)}
                          placeholder="Nombre"
                          className="flex-1 px-2 py-1.5 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none"
                          style={mf}
                        />
                        <input
                          value={newContactEmail}
                          onChange={e => setNewContactEmail(e.target.value)}
                          placeholder="correo@ejemplo.com"
                          className="flex-1 px-2 py-1.5 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none"
                          style={mf}
                          onKeyDown={e => e.key === 'Enter' && handleAddContact()}
                        />
                        <button onClick={handleAddContact} disabled={addingContact} className="pixel-btn-primary px-2 py-1.5 text-[8px]" style={pf}>
                          {addingContact ? '...' : '+ Agregar'}
                        </button>
                      </div>

                      {/* Import / Download template */}
                      <div className="flex gap-2 mb-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleImportExcel}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={importingContacts}
                          className="px-2 py-1 text-[8px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow transition-colors"
                          style={pf}
                        >
                          {importingContacts ? 'Importando...' : 'Importar Excel'}
                        </button>
                        <button
                          onClick={handleDownloadTemplate}
                          className="px-2 py-1 text-[8px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow transition-colors"
                          style={pf}
                        >
                          Descargar Plantilla
                        </button>
                      </div>

                      {/* Contacts list */}
                      {loadingContacts ? (
                        <div className="flex justify-center py-4"><BrandLoader size="sm" /></div>
                      ) : contacts.length === 0 ? (
                        <p className="text-center text-[9px] text-digi-muted py-2" style={pf}>Sin contactos</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {contacts.map(c => (
                            <div key={c.id} className="flex items-center gap-2 px-2 py-1 border border-digi-border/50 text-xs" style={mf}>
                              <span className="text-digi-text flex-1">{c.name}</span>
                              <span className="text-digi-muted flex-1">{c.email}</span>
                              <button
                                onClick={() => handleDeleteContact(c.id)}
                                className="text-red-400/60 hover:text-red-400 text-[8px] transition-colors"
                                style={pf}
                              >
                                X
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Next button */}
          <div className="flex justify-end mt-6 pt-4 border-t-2 border-digi-border">
            <button
              onClick={() => { if (selectedListId) setStep(2); else setError('Selecciona una lista'); }}
              className="pixel-btn-primary px-6 py-2 text-[9px]"
              style={pf}
              disabled={!selectedListId}
            >
              Siguiente &gt;
            </button>
          </div>
          {error && !selectedListId && <p className="text-xs text-red-400 mt-2 text-right" style={mf}>{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="pixel-heading text-xs text-white mb-4">Configuracion del Correo</h3>

          <div className="space-y-4">
            {/* From email */}
            <div>
              <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Correo Remitente</label>
              <input
                value={fromEmail}
                onChange={e => setFromEmail(e.target.value)}
                placeholder="Nombre <correo@dominio.com>"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
                style={mf}
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Asunto</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Asunto del correo"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
                style={mf}
              />
            </div>

            {/* Body HTML Editor */}
            <div>
              <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Cuerpo del Correo</label>
              <HtmlEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Escribe el contenido del correo..." rows={10} />
            </div>

            {/* Footer HTML Editor */}
            <div>
              <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Pie de Pagina</label>
              <HtmlEditor value={footerHtml} onChange={setFooterHtml} placeholder="Pie de pagina del correo..." rows={4} />
            </div>

            {/* Attachments */}
            <AttachmentsManager attachments={attachments} onChange={setAttachments} />

            {error && <p className="text-xs text-red-400" style={mf}>{error}</p>}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t-2 border-digi-border">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-white transition-colors" style={pf}>
                &lt; Anterior
              </button>
              <button onClick={handleSaveCampaign} disabled={saving} className="pixel-btn-primary px-6 py-2 text-[9px]" style={pf}>
                {saving ? 'Guardando...' : 'Crear Campana'}
              </button>
            </div>
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
          alert(`${file.name} supera el limite de 10MB`);
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
      alert('Error al leer archivos');
    } finally {
      setAdding(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-[9px] text-digi-muted" style={pf}>Archivos Adjuntos</label>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={adding}
            className="px-2 py-1 text-[8px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow transition-colors"
            style={pf}
          >
            {adding ? 'Cargando...' : '+ Adjuntar archivo'}
          </button>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 border border-digi-border/50 text-xs" style={mf}>
              <span className="text-accent-glow text-[9px]" style={pf}>FILE</span>
              <span className="text-digi-text flex-1 truncate">{a.filename}</span>
              <span className="text-digi-muted text-[9px]">{formatSize(a.size)}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="text-red-400/60 hover:text-red-400 text-[8px] transition-colors"
                style={pf}
              >
                X
              </button>
            </div>
          ))}
          <p className="text-[8px] text-digi-muted mt-1" style={mf}>
            {attachments.length} archivo{attachments.length > 1 ? 's' : ''} — {formatSize(attachments.reduce((s, a) => s + a.size, 0))} total
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
    const text = prompt('Texto del enlace:', 'Click aqui') || 'Click aqui';
    insertAtCursor(`<a href="${url}" style="color:#7B5FBF;text-decoration:underline;">${text}</a>`);
  };

  const handleInsertImage = () => {
    const url = prompt('URL de la imagen:');
    if (!url) return;
    const alt = prompt('Texto alternativo:', 'imagen') || 'imagen';
    insertAtCursor(`<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;" />`);
  };

  const toolbarBtns: { label: string; title: string; action: () => void }[] = [
    { label: 'B', title: 'Negrita', action: () => insertTag('<strong>', '</strong>') },
    { label: 'I', title: 'Cursiva', action: () => insertTag('<em>', '</em>') },
    { label: 'U', title: 'Subrayado', action: () => insertTag('<u>', '</u>') },
    { label: 'H1', title: 'Titulo 1', action: () => insertTag('<h1 style="color:#e5e5e5;font-size:22px;font-weight:600;margin:0 0 12px;">', '</h1>') },
    { label: 'H2', title: 'Titulo 2', action: () => insertTag('<h2 style="color:#e5e5e5;font-size:18px;font-weight:600;margin:0 0 10px;">', '</h2>') },
    { label: 'P', title: 'Parrafo', action: () => insertTag('<p style="color:#CBD5E1;font-size:15px;line-height:1.6;margin:0 0 12px;">', '</p>') },
    { label: '<>', title: 'Enlace', action: handleInsertLink },
    { label: 'IMG', title: 'Imagen', action: handleInsertImage },
    { label: 'HR', title: 'Linea separadora', action: () => insertAtCursor('<hr style="border:none;border-top:1px solid #2a2a3a;margin:16px 0;" />') },
    { label: 'BTN', title: 'Boton', action: () => {
      const url = prompt('URL del boton:') || '#';
      const text = prompt('Texto del boton:', 'Click aqui') || 'Click aqui';
      insertAtCursor(`<div style="text-align:center;margin:20px 0;"><a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:12px 32px;font-weight:600;font-size:14px;border:2px solid #7B5FBF;">${text}</a></div>`);
    }},
  ];

  return (
    <div className="border-2 border-digi-border">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-digi-card border-b-2 border-digi-border">
        {toolbarBtns.map(btn => (
          <button
            key={btn.label}
            onClick={btn.action}
            title={btn.title}
            className="px-2 py-1 text-[8px] text-digi-muted hover:text-white hover:bg-accent/10 border border-transparent hover:border-digi-border transition-colors"
            style={pf}
          >
            {btn.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setPreview(!preview)}
          className={`px-2 py-1 text-[8px] border transition-colors ${
            preview ? 'border-accent text-accent-glow bg-accent/10' : 'border-transparent text-digi-muted hover:text-white'
          }`}
          style={pf}
        >
          {preview ? 'Editor' : 'Preview'}
        </button>
      </div>

      {/* Editor or Preview */}
      {preview ? (
        <div
          className="px-4 py-3 bg-digi-darker text-sm text-digi-text min-h-[120px] overflow-auto"
          style={{ ...mf, maxHeight: rows * 24 }}
          dangerouslySetInnerHTML={{ __html: value || '<span style="color:#737373;">Sin contenido</span>' }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 bg-digi-darker text-sm text-digi-text focus:outline-none resize-none"
          style={mf}
        />
      )}
    </div>
  );
}

/* ─── Step Indicator ─── */
function StepIndicator({ num, active, done, label, onClick }: {
  num: number; active: boolean; done: boolean; label: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className={`w-7 h-7 flex items-center justify-center text-[10px] border-2 transition-colors ${
        active ? 'border-accent bg-accent/20 text-accent-glow' :
        done ? 'border-green-600 bg-green-900/20 text-green-400' :
        'border-digi-border text-digi-muted'
      }`} style={pf}>
        {done ? '✓' : num}
      </div>
      <span className={`text-[8px] ${active ? 'text-accent-glow' : 'text-digi-muted'}`} style={pf}>{label}</span>
    </button>
  );
}

/* ─── Campaign Stats View ─── */
function StatsView({ stats, onBack }: { stats: CampaignStats; onBack: () => void }) {
  const SEND_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    pending: 'default', sent: 'success', delivered: 'success', bounced: 'warning', failed: 'error',
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-digi-muted hover:text-white text-[9px] transition-colors" style={pf}>
          &lt; Campanas
        </button>
        <h3 className="pixel-heading text-xs text-white">Estadisticas: {stats.campaign.subject}</h3>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.summary.total, color: 'text-white' },
          { label: 'Enviados', value: stats.summary.sent, color: 'text-green-400' },
          { label: 'Entregados', value: stats.summary.delivered, color: 'text-blue-400' },
          { label: 'Rebotados', value: stats.summary.bounced, color: 'text-yellow-400' },
          { label: 'Fallidos', value: stats.summary.failed, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="pixel-card py-3 text-center">
            <p className="text-[8px] text-digi-muted mb-1" style={pf}>{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`} style={mf}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sends table */}
      <PixelDataTable
        columns={[
          { key: 'name', header: 'Contacto', render: (s: any) => s.contact_name },
          { key: 'email', header: 'Email', render: (s: any) => s.contact_email },
          { key: 'status', header: 'Estado', render: (s: any) => (
            <PixelBadge variant={SEND_STATUS_V[s.status] || 'default'}>{s.status}</PixelBadge>
          )},
          { key: 'error', header: 'Error', render: (s: any) => (
            <span className="text-red-400/80 truncate max-w-[200px] inline-block">{s.error_message || '-'}</span>
          )},
          { key: 'date', header: 'Fecha', render: (s: any) => s.sent_at ? new Date(s.sent_at).toLocaleString() : '-' },
        ]}
        data={stats.sends}
        emptyTitle="Sin envios"
        emptyDesc="No hay registros de envio para esta campana."
      />
    </div>
  );
}
