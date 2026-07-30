'use client';

/**
 * WhatsAppFlowPanel — editor del flujo de WHATSAPP BUSINESS (credenciales de Meta,
 * plantillas de mensaje, listas de contactos, envío y estadísticas). Estilo Fluent `.corp`;
 * overlay, cabecera, pasos y controles compartidos en `FlowPanelUI`.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import {
  FlowPanelShell, PanelSubHeader, SectionBar, PanelFooter, Steps, StatCards,
  PanelEmpty, FIELD, FIELD_SM, LABEL, BTN_ROW, BTN_ROW_DANGER,
} from '@/components/dashboard/flows/FlowPanelUI';
import {
  MessageCircle, Plus, Send, BarChart3, RotateCcw, Users, ChevronRight, ChevronDown,
  Trash2, FileSpreadsheet, Download, Check, X, KeyRound, FileText, Upload, Image as ImageIcon,
  Video as VideoIcon, File as FileIcon,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Flow { id: number; name: string; type: string; description: string; status: string; config: Record<string, any>; }
interface ContactList { id: number; flow_id: number; name: string; contact_count: number; created_at: string; }
interface Contact { id: number; list_id: number; name: string; phone: string; }
interface WaTemplate { id: number; flow_id: number; name: string; language: string; header_type: string; header_content: string | null; header_filename: string | null; body: string; footer: string | null; buttons: any[]; created_at: string; }
interface Campaign { id: number; flow_id: number; contact_list_id: number; wa_template_id: number; status: string; list_name: string; wa_template_name: string; total_contacts: number; sent_count: number; failed_count: number; sent_at: string | null; created_at: string; }
interface CampaignStats { campaign: any; summary: { total: number; sent: number; delivered: number; bounced: number; failed: number }; sends: any[]; }

const CAMP_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = { draft: 'default', sending: 'info', sent: 'success', failed: 'error' };
const CAMP_STATUS_L: Record<string, string> = { draft: 'Borrador', sending: 'Enviando…', sent: 'Enviada', failed: 'Fallida' };
const SEND_STATUS_L: Record<string, string> = { pending: 'Pendiente', sent: 'Enviado', delivered: 'Entregado', bounced: 'Rebotado', failed: 'Fallido' };

const HEADER_TYPE_L: Record<string, string> = { none: 'Sin encabezado', text: 'Texto', image: 'Imagen', video: 'Video', document: 'Documento' };

const COUNTRY_CODES = [
  { code: '+506', country: 'CR' }, { code: '+507', country: 'PA' }, { code: '+502', country: 'GT' },
  { code: '+503', country: 'SV' }, { code: '+504', country: 'HN' }, { code: '+505', country: 'NI' },
  { code: '+52', country: 'MX' }, { code: '+57', country: 'CO' }, { code: '+51', country: 'PE' },
  { code: '+56', country: 'CL' }, { code: '+54', country: 'AR' }, { code: '+55', country: 'BR' },
  { code: '+593', country: 'EC' }, { code: '+58', country: 'VE' }, { code: '+591', country: 'BO' },
  { code: '+595', country: 'PY' }, { code: '+598', country: 'UY' }, { code: '+1', country: 'US' },
  { code: '+44', country: 'UK' }, { code: '+34', country: 'ES' }, { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' }, { code: '+39', country: 'IT' }, { code: '+91', country: 'IN' },
];

/* ─── Main Panel ─── */
export default function WhatsAppFlowPanel({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  const [waConfig, setWaConfig] = useState(flow.config || {});
  const [configSaved, setConfigSaved] = useState(!!(flow.config?.phone_number_id && flow.config?.access_token));
  const [savingConfig, setSavingConfig] = useState(false);

  const [view, setView] = useState<'campaigns' | 'create-campaign' | 'stats'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<CampaignStats | null>(null);

  // Send flow
  const [confirmSend, setConfirmSend] = useState<Campaign | null>(null);
  const [sendTemplate, setSendTemplate] = useState<WaTemplate | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  // Resend choice
  const [resendChoice, setResendChoice] = useState<Campaign | null>(null);
  const [resendPickTemplate, setResendPickTemplate] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}/campaigns`);
      const data = await res.json();
      setCampaigns(data.data || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [flow.id]);

  useEffect(() => { if (configSaved) fetchCampaigns(); else setLoading(false); }, [configSaved, fetchCampaigns]);

  const handleSaveConfig = async () => {
    if (!waConfig.phone_number_id || !waConfig.access_token) return;
    setSavingConfig(true);
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: waConfig }),
      });
      if (res.ok) setConfigSaved(true);
    } catch { /* */ }
    finally { setSavingConfig(false); }
  };

  const handleSend = async (campaign: Campaign, templateOverrideId?: number) => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}/campaigns/${campaign.id}/send-wa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateOverrideId ? { wa_template_id: templateOverrideId } : {}),
      });
      const data = await res.json();
      if (res.ok) { setSendResult(data); fetchCampaigns(); }
      else toast.error(data.error || 'Error al enviar');
    } catch { toast.error('Error de conexión'); }
    finally { setSending(false); }
  };

  const openSendPreview = async (campaign: Campaign) => {
    setConfirmSend(campaign);
    setSendTemplate(null);
    setLoadingPreview(true);
    setSendResult(null);
    try {
      if (campaign.wa_template_id) {
        const res = await fetch(`/api/admin/flows/${flow.id}/wa-templates/${campaign.wa_template_id}`);
        const data = await res.json();
        setSendTemplate(data.data);
      }
    } catch { /* */ }
    finally { setLoadingPreview(false); }
  };

  const handleViewStats = async (campaign: Campaign) => {
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}/campaigns/${campaign.id}/stats`);
      const data = await res.json();
      setStatsData(data);
      setView('stats');
    } catch { toast.error('Error al cargar las estadísticas'); }
  };

  return (
    <FlowPanelShell Icon={MessageCircle} title={flow.name} subtitle="WhatsApp Business" onClose={onClose}>
      {!configSaved ? (
        <WaConfigForm config={waConfig} onChange={setWaConfig} onSave={handleSaveConfig} saving={savingConfig} />
      ) : (
        <>
          {view === 'campaigns' && (
            <WaCampaignsView
              campaigns={campaigns}
              loading={loading}
              onCreateNew={() => setView('create-campaign')}
              onSend={openSendPreview}
              onResend={(c) => setResendChoice(c)}
              onViewStats={handleViewStats}
              onEditConfig={() => setConfigSaved(false)}
            />
          )}
          {view === 'create-campaign' && (
            <WaCreateCampaignWizard
              flowId={flow.id}
              onDone={() => { setView('campaigns'); fetchCampaigns(); }}
              onCancel={() => setView('campaigns')}
            />
          )}
          {view === 'stats' && statsData && (
            <WaStatsView stats={statsData} onBack={() => { setView('campaigns'); setStatsData(null); }} />
          )}
        </>
      )}

      {/* Send Preview Modal */}
      <PixelModal open={!!confirmSend && !resendPickTemplate} onClose={() => { setConfirmSend(null); setSendResult(null); }} title="Previsualizar y enviar" size="lg" busy={sending}>
        <div className="space-y-4">
          {!sendResult ? (
            <>
              {loadingPreview ? (
                <div className="flex justify-center py-8"><BrandLoader size="sm" label="Cargando…" /></div>
              ) : sendTemplate ? (
                <WaMessagePreview template={sendTemplate} />
              ) : (
                <PanelEmpty Icon={FileText} title="No se encontró la plantilla" />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-digi-muted mb-0.5" style={mf}>Lista</span>
                  <span className="text-[13px] text-digi-text" style={mf}>
                    {confirmSend?.list_name}
                    <span className="text-digi-muted"> · {confirmSend?.total_contacts} contactos</span>
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-digi-muted mb-0.5" style={mf}>Plantilla</span>
                  <span className="text-[13px] text-digi-text" style={mf}>{sendTemplate?.name || '—'}</span>
                </div>
              </div>
              <PanelFooter align="end">
                <button onClick={() => setConfirmSend(null)} className={BTN_SECONDARY}>Cancelar</button>
                <button onClick={() => confirmSend && handleSend(confirmSend)} disabled={sending || !sendTemplate} className={BTN_PRIMARY}>
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
                <p className="text-[12px] text-digi-muted mt-1" style={mf}>mensajes enviados</p>
                {sendResult.failed > 0 && <p className="text-[13px] text-red-400 mt-2" style={mf}>{sendResult.failed} fallidos</p>}
              </div>
              <PanelFooter align="end">
                <button onClick={() => { setConfirmSend(null); setSendResult(null); }} className={BTN_PRIMARY}>Cerrar</button>
              </PanelFooter>
            </>
          )}
        </div>
      </PixelModal>

      {/* Resend Choice Modal */}
      <PixelModal open={!!resendChoice && !resendPickTemplate && !confirmSend} onClose={() => setResendChoice(null)} title="Reenviar campaña" size="sm">
        <div className="space-y-4">
          <p className="text-[13px] text-digi-muted" style={mf}>¿Cómo quieres reenviar esta campaña?</p>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => { if (!resendChoice) return; openSendPreview(resendChoice); setResendChoice(null); }}
              className="rounded-lg border border-digi-border bg-digi-darker/40 px-3 py-4 text-center hover:border-accent transition-colors">
              <Send className="w-4 h-4 text-accent mx-auto mb-1.5" />
              <p className="text-[13px] font-medium text-digi-text" style={mf}>Misma plantilla</p>
              <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Usar la misma configuración</p>
            </button>
            <button onClick={() => setResendPickTemplate(true)}
              className="rounded-lg border border-digi-border bg-digi-darker/40 px-3 py-4 text-center hover:border-accent transition-colors">
              <FileText className="w-4 h-4 text-accent mx-auto mb-1.5" />
              <p className="text-[13px] font-medium text-digi-text" style={mf}>Otra plantilla</p>
              <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Elegir una plantilla diferente</p>
            </button>
          </div>
          <PanelFooter align="end">
            <button onClick={() => setResendChoice(null)} className={BTN_SECONDARY}>Cancelar</button>
          </PanelFooter>
        </div>
      </PixelModal>

      {/* Resend Pick Template Modal */}
      <PixelModal open={!!resendChoice && resendPickTemplate} onClose={() => { setResendPickTemplate(false); setResendChoice(null); }} title="Seleccionar plantilla" size="lg">
        <WaTemplatePickerInline
          flowId={flow.id}
          onSelect={async (templateId) => {
            if (!resendChoice) return;
            try {
              const res = await fetch(`/api/admin/flows/${flow.id}/wa-templates/${templateId}`);
              const data = await res.json();
              setSendTemplate(data.data);
            } catch { /* */ }
            setConfirmSend({ ...resendChoice, wa_template_id: templateId });
            setResendPickTemplate(false);
            setResendChoice(null);
            setSendResult(null);
          }}
          onCancel={() => { setResendPickTemplate(false); setResendChoice(null); }}
        />
      </PixelModal>
    </FlowPanelShell>
  );
}

/* ─── WA Config Form ─── */
function WaConfigForm({ config, onChange, onSave, saving }: {
  config: Record<string, any>; onChange: (c: Record<string, any>) => void; onSave: () => void; saving: boolean;
}) {
  const set = (key: string, value: string) => onChange({ ...config, [key]: value });
  const fields = [
    { key: 'phone_number_id', label: 'Phone Number ID', required: true, placeholder: 'Ej: 123456789012345' },
    { key: 'business_account_id', label: 'Business Account ID', required: false, placeholder: 'Ej: 987654321098765' },
    { key: 'access_token', label: 'Access Token', required: true, placeholder: 'Token de acceso permanente' },
    { key: 'app_id', label: 'App ID', required: false, placeholder: 'ID de la aplicación de Meta' },
    { key: 'verify_token', label: 'Verify Token (webhook)', required: false, placeholder: 'Token para verificar el webhook' },
  ];

  return (
    <div>
      <SectionBar
        title="Configuración de WhatsApp Business API"
        hint="Ingresa las credenciales de tu cuenta de Meta Business para poder enviar mensajes."
      />
      <div className="rounded-lg border border-digi-border bg-digi-darker/40 p-4 space-y-3">
        <div className="flex items-center gap-2 pb-1">
          <KeyRound className="w-4 h-4 text-accent" />
          <span className="text-[12px] text-digi-muted" style={mf}>Credenciales de Meta</span>
        </div>
        {fields.map(f => (
          <PixelInput
            key={f.key}
            label={f.required ? `${f.label} *` : f.label}
            value={config[f.key] || ''}
            onChange={e => set(f.key, e.target.value)}
            placeholder={f.placeholder}
            type={f.key === 'access_token' ? 'password' : 'text'}
          />
        ))}
      </div>
      <div className="mt-4">
        <PanelFooter align="end">
          <button onClick={onSave} disabled={saving || !config.phone_number_id || !config.access_token} className={BTN_PRIMARY}>
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </PanelFooter>
      </div>
    </div>
  );
}

/* ─── WA Campaigns View ─── */
function WaCampaignsView({ campaigns, loading, onCreateNew, onSend, onResend, onViewStats, onEditConfig }: {
  campaigns: Campaign[]; loading: boolean; onCreateNew: () => void;
  onSend: (c: Campaign) => void; onResend: (c: Campaign) => void;
  onViewStats: (c: Campaign) => void; onEditConfig: () => void;
}) {
  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando campañas…" /></div>;
  return (
    <div>
      <SectionBar title="Campañas de WhatsApp" hint={campaigns.length ? `${campaigns.length} en total` : undefined}>
        <button onClick={onEditConfig} className={BTN_SECONDARY}>
          <KeyRound className="w-4 h-4" /> Credenciales
        </button>
        <button onClick={onCreateNew} className={BTN_PRIMARY}>
          <Plus className="w-4 h-4" /> Nueva campaña
        </button>
      </SectionBar>

      <PixelDataTable
        singleLine
        columns={[
          { key: 'template', header: 'Plantilla', render: (c: Campaign) => (
            <span className="block text-[13px] font-medium text-digi-text truncate max-w-[240px]" style={mf}>{c.wa_template_name || '—'}</span>
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
            <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
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
        emptyDesc="Crea tu primera campaña de WhatsApp."
      />
    </div>
  );
}

/* ─── WA Create Campaign Wizard ─── */
function WaCreateCampaignWizard({ flowId, onDone, onCancel }: { flowId: number; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(1);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);

  // Contact list creation
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  // Contacts
  const [expandedListId, setExpandedListId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [countryCode, setCountryCode] = useState('+593');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Templates
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchLists = useCallback(async () => {
    try { const res = await fetch(`/api/admin/flows/${flowId}/contact-lists`); const data = await res.json(); setContactLists(data.data || []); }
    catch { /* */ } finally { setLoadingLists(false); }
  }, [flowId]);

  const fetchTemplates = useCallback(async () => {
    try { const res = await fetch(`/api/admin/flows/${flowId}/wa-templates`); const data = await res.json(); setTemplates(data.data || []); }
    catch { /* */ } finally { setLoadingTemplates(false); }
  }, [flowId]);

  useEffect(() => { fetchLists(); fetchTemplates(); }, [fetchLists, fetchTemplates]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try { const res = await fetch(`/api/admin/flows/${flowId}/contact-lists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newListName.trim() }) }); if (res.ok) { setNewListName(''); setShowCreateList(false); fetchLists(); } }
    catch { /* */ } finally { setCreatingList(false); }
  };

  const fetchContacts = async (listId: number) => {
    setLoadingContacts(true);
    try { const res = await fetch(`/api/admin/flows/${flowId}/contact-lists/${listId}/contacts`); const data = await res.json(); setContacts(data.data || []); }
    catch { /* */ } finally { setLoadingContacts(false); }
  };

  const toggleExpand = (listId: number) => {
    if (expandedListId === listId) { setExpandedListId(null); setContacts([]); }
    else { setExpandedListId(listId); fetchContacts(listId); }
  };

  const handleAddContact = async () => {
    if (!expandedListId || !newContactName.trim() || !newContactPhone.trim()) return;
    setAddingContact(true);
    try {
      const phone = `${countryCode}${newContactPhone.trim()}`;
      const res = await fetch(`/api/admin/flows/${flowId}/contact-lists/${expandedListId}/contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newContactName.trim(), phone }),
      });
      if (res.ok) { setNewContactName(''); setNewContactPhone(''); fetchContacts(expandedListId); fetchLists(); }
    } catch { /* */ } finally { setAddingContact(false); }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!expandedListId) return;
    await fetch(`/api/admin/flows/${flowId}/contact-lists/${expandedListId}/contacts?contactId=${contactId}`, { method: 'DELETE' });
    fetchContacts(expandedListId); fetchLists();
  };

  const handleDeleteList = async (listId: number) => {
    await fetch(`/api/admin/flows/${flowId}/contact-lists/${listId}`, { method: 'DELETE' });
    if (selectedListId === listId) setSelectedListId(null);
    if (expandedListId === listId) { setExpandedListId(null); setContacts([]); }
    fetchLists();
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['nombre', 'telefono'], ['Juan Pérez', '+593988881234'], ['María López', '+593977772345']]);
    ws['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
    XLSX.writeFile(wb, 'plantilla_contactos_wa.xlsx');
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
      const contactsData = rows
        .map(row => ({
          name: (row['nombre'] || row['Nombre'] || row['name'] || '').toString().trim(),
          phone: (row['telefono'] || row['Telefono'] || row['teléfono'] || row['phone'] || row['Phone'] || '').toString().trim(),
        }))
        .filter(c => c.name && c.phone);
      if (contactsData.length === 0) { toast.error('No se encontraron contactos. El archivo debe tener columnas "nombre" y "telefono".'); return; }
      const res = await fetch(`/api/admin/flows/${flowId}/contact-lists/${expandedListId}/contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactsData),
      });
      if (res.ok) { fetchContacts(expandedListId); fetchLists(); }
    } catch { toast.error('Error al leer el archivo'); }
    finally { setImportingContacts(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSaveCampaign = async () => {
    if (!selectedListId) { setError('Selecciona una lista de contactos'); return; }
    if (!selectedTemplateId) { setError('Selecciona una plantilla'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/campaigns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_list_id: selectedListId, wa_template_id: selectedTemplateId }),
      });
      if (res.ok) onDone();
      else { const data = await res.json(); setError(data.error || 'Error al guardar'); }
    } catch { setError('Error de conexión'); } finally { setSaving(false); }
  };

  return (
    <div>
      <PanelSubHeader onBack={onCancel} backLabel="Campañas" title="Nueva campaña">
        <Steps items={['Contactos', 'Plantilla']} current={step} onGo={setStep} />
      </PanelSubHeader>

      {/* Step 1: Contact Lists */}
      {step === 1 && (
        <div>
          <SectionBar title="Listas de contactos" hint="Elige la lista a la que se enviará la campaña.">
            <button onClick={() => setShowCreateList(true)} className={BTN_SECONDARY}>
              <Plus className="w-4 h-4" /> Nueva lista
            </button>
          </SectionBar>

          {showCreateList && (
            <div className="rounded-lg border border-digi-border bg-digi-darker/40 p-3 mb-3">
              <label className={LABEL}>Nombre de la lista</label>
              <div className="flex gap-2">
                <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Ej: Clientes VIP"
                  className={`${FIELD} flex-1`} style={mf}
                  onKeyDown={e => e.key === 'Enter' && handleCreateList()} />
                <button onClick={handleCreateList} disabled={creatingList} className={BTN_PRIMARY}>{creatingList ? 'Creando…' : 'Crear'}</button>
                <button onClick={() => setShowCreateList(false)} className={BTN_SECONDARY} aria-label="Cancelar"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {loadingLists ? <div className="flex justify-center py-8"><BrandLoader size="sm" /></div> :
           contactLists.length === 0 ? (
            <PanelEmpty Icon={Users} title="No hay listas de contactos" desc="Crea una lista para continuar." />
          ) : (
            <div className="space-y-2">
              {contactLists.map(list => {
                const selected = selectedListId === list.id;
                const expanded = expandedListId === list.id;
                return (
                  <div key={list.id} className={`rounded-lg border transition-colors overflow-hidden ${selected ? 'border-accent bg-accent-light/40' : 'border-digi-border'}`}>
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
                      <button onClick={() => setSelectedListId(selected ? null : list.id)}
                        className={selected
                          ? 'inline-flex items-center gap-1 px-2 py-1 rounded border border-accent bg-accent text-white text-[12px] font-medium transition-colors'
                          : BTN_ROW}>
                        {selected ? <><Check className="w-3.5 h-3.5" strokeWidth={3} /> Seleccionada</> : 'Seleccionar'}
                      </button>
                      <button onClick={() => handleDeleteList(list.id)} className={BTN_ROW_DANGER} aria-label="Eliminar lista">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {expanded && (
                      <div className="border-t border-digi-border px-3 py-3 bg-digi-darker/40">
                        {/* Add contact: country code + phone */}
                        <div className="flex flex-wrap gap-2 mb-2.5">
                          <input value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="Nombre"
                            className={`${FIELD_SM} flex-1 min-w-[120px]`} style={mf} />
                          <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
                            className={`${FIELD_SM} field-select appearance-none w-[104px] pr-7`} style={mf}>
                            {COUNTRY_CODES.map(cc => <option key={cc.code} value={cc.code}>{cc.code} {cc.country}</option>)}
                          </select>
                          <input value={newContactPhone} onChange={e => setNewContactPhone(e.target.value.replace(/\D/g, ''))} placeholder="988881234"
                            className={`${FIELD_SM} w-[130px]`} style={mf}
                            onKeyDown={e => e.key === 'Enter' && handleAddContact()} />
                          <button onClick={handleAddContact} disabled={addingContact} className={BTN_SECONDARY}>
                            <Plus className="w-4 h-4" /> {addingContact ? 'Agregando…' : 'Agregar'}
                          </button>
                        </div>

                        {/* Import/Download */}
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
                        {loadingContacts ? <div className="flex justify-center py-4"><BrandLoader size="sm" /></div> :
                         contacts.length === 0 ? <p className="text-center text-[12px] text-digi-muted py-3" style={mf}>Sin contactos en esta lista.</p> : (
                          <div className="max-h-52 overflow-y-auto space-y-1">
                            {contacts.map(c => (
                              <div key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-digi-border bg-digi-card">
                                <span className="flex-1 min-w-0 text-[12.5px] text-digi-text truncate" style={mf}>{c.name}</span>
                                <span className="flex-1 min-w-0 text-[12px] text-digi-muted truncate tabular-nums" style={mf}>{c.phone}</span>
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
              <button onClick={() => { if (selectedListId) setStep(2); else setError('Selecciona una lista'); }}
                className={BTN_PRIMARY} disabled={!selectedListId}>
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </PanelFooter>
          </div>
        </div>
      )}

      {/* Step 2: Templates */}
      {step === 2 && (
        <div>
          {showCreateTemplate ? (
            <WaTemplateForm
              flowId={flowId}
              onDone={(id) => { setShowCreateTemplate(false); fetchTemplates(); setSelectedTemplateId(id); }}
              onCancel={() => setShowCreateTemplate(false)}
            />
          ) : (
            <>
              <SectionBar title="Plantillas de mensaje" hint="El mensaje que recibirán los contactos.">
                <button onClick={() => setShowCreateTemplate(true)} className={BTN_SECONDARY}>
                  <Plus className="w-4 h-4" /> Nueva plantilla
                </button>
              </SectionBar>

              {loadingTemplates ? <div className="flex justify-center py-8"><BrandLoader size="sm" /></div> :
               templates.length === 0 ? (
                <PanelEmpty Icon={FileText} title="No hay plantillas" desc="Crea una plantilla para continuar." />
              ) : (
                <div className="space-y-2">
                  {templates.map(t => {
                    const selected = selectedTemplateId === t.id;
                    return (
                      <button key={t.id} type="button"
                        className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${selected ? 'border-accent bg-accent-light/40' : 'border-digi-border hover:border-accent/50'}`}
                        onClick={() => setSelectedTemplateId(selected ? null : t.id)}>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-accent shrink-0" />
                          <span className="text-[13px] font-medium text-digi-text truncate" style={mf}>{t.name}</span>
                          {t.header_type !== 'none' && <PixelBadge variant="info">{HEADER_TYPE_L[t.header_type] || t.header_type}</PixelBadge>}
                          <span className="text-[11px] text-digi-muted uppercase ml-auto shrink-0" style={mf}>{t.language}</span>
                          {selected && <PixelBadge variant="success">Seleccionada</PixelBadge>}
                        </div>
                        <p className="text-[12px] text-digi-muted mt-1 truncate" style={mf}>{t.body}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {error && <p className="text-[12px] text-red-400 mt-2" style={mf}>{error}</p>}

              <div className="mt-4">
                <PanelFooter>
                  <button onClick={() => setStep(1)} className={BTN_SECONDARY}>
                    <ChevronRight className="w-4 h-4 rotate-180" /> Anterior
                  </button>
                  <button onClick={handleSaveCampaign} disabled={saving || !selectedTemplateId} className={BTN_PRIMARY}>
                    {saving ? 'Guardando…' : 'Guardar campaña'}
                  </button>
                </PanelFooter>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── WA Template Form ─── */
function WaTemplateForm({ flowId, onDone, onCancel, initial }: {
  flowId: number; onDone: (id: number) => void; onCancel: () => void; initial?: WaTemplate;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [language, setLanguage] = useState(initial?.language || 'es');
  const [headerType, setHeaderType] = useState(initial?.header_type || 'none');
  const [headerContent, setHeaderContent] = useState(initial?.header_content || '');
  const [headerFilename, setHeaderFilename] = useState(initial?.header_filename || '');
  const [body, setBody] = useState(initial?.body || '');
  const [footer, setFooter] = useState(initial?.footer || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const HEADER_TYPES = [
    { value: 'none', label: 'Sin encabezado' },
    { value: 'text', label: 'Texto' },
    { value: 'image', label: 'Imagen (máx. 5MB)' },
    { value: 'video', label: 'Video (máx. 16MB)' },
    { value: 'document', label: 'Documento (máx. 5MB)' },
  ];

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = headerType === 'video' ? 16 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) { toast.error(`El archivo supera el límite de ${headerType === 'video' ? '16' : '5'}MB`); return; }
    const buffer = await file.arrayBuffer();
    const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));
    const mimePrefix = file.type ? `data:${file.type};base64,` : 'data:application/octet-stream;base64,';
    setHeaderContent(`${mimePrefix}${base64}`);
    setHeaderFilename(file.name);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es requerido'); return; }
    if (!body.trim()) { setError('El cuerpo del mensaje es requerido'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: name.trim(), language, header_type: headerType, header_content: headerContent || null, header_filename: headerFilename || null, body: body.trim(), footer: footer.trim() || null, buttons: [] };
      const url = initial ? `/api/admin/flows/${flowId}/wa-templates/${initial.id}` : `/api/admin/flows/${flowId}/wa-templates`;
      const res = await fetch(url, { method: initial ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { const data = await res.json(); onDone(data.data.id); }
      else { const data = await res.json(); setError(data.error || 'Error al guardar'); }
    } catch { setError('Error de conexión'); } finally { setSaving(false); }
  };

  const MediaIcon = headerType === 'image' ? ImageIcon : headerType === 'video' ? VideoIcon : FileIcon;

  return (
    <div>
      <SectionBar title={initial ? 'Editar plantilla' : 'Nueva plantilla'} />
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PixelInput label="Nombre de la plantilla *" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: promo_diciembre" />
          <PixelSelect label="Idioma" value={language} onChange={e => setLanguage(e.target.value)}
            options={[{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }, { value: 'pt_BR', label: 'Português' }]} />
        </div>

        {/* Header */}
        <div>
          <PixelSelect label="Encabezado" value={headerType}
            onChange={e => { setHeaderType(e.target.value); setHeaderContent(''); setHeaderFilename(''); }}
            options={HEADER_TYPES} />
          {headerType === 'text' && (
            <input value={headerContent} onChange={e => setHeaderContent(e.target.value)}
              placeholder="Texto del encabezado (máx. 60 caracteres)" maxLength={60}
              className={`${FIELD} mt-2`} style={mf} />
          )}
          {(headerType === 'image' || headerType === 'video' || headerType === 'document') && (
            <div className="mt-2">
              <input ref={mediaInputRef} type="file" onChange={handleMediaUpload}
                accept={headerType === 'image' ? '.jpg,.png' : headerType === 'video' ? '.mp4,.3gpp' : '.pdf,.docx,.xlsx,.pptx,.txt'}
                className="hidden" />
              <div className="flex items-center gap-2">
                <button onClick={() => mediaInputRef.current?.click()} className={BTN_ROW}>
                  <Upload className="w-3.5 h-3.5" /> Subir {headerType === 'image' ? 'imagen' : headerType === 'video' ? 'video' : 'documento'}
                </button>
                {headerFilename && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-digi-text" style={mf}>
                    <MediaIcon className="w-3.5 h-3.5 text-accent" /> {headerFilename}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div>
          <label className={LABEL}>Cuerpo del mensaje *</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Hola {{1}}, te informamos que…" rows={6}
            className={`${FIELD} resize-none`} style={mf} />
          <p className="text-[11px] text-digi-muted mt-1" style={mf}>Usa {'{{1}}'}, {'{{2}}'} para variables. Máximo 1024 caracteres.</p>
        </div>

        {/* Footer */}
        <PixelInput label="Pie del mensaje" value={footer} onChange={e => setFooter(e.target.value)}
          placeholder="Texto del pie (máx. 60 caracteres)" maxLength={60} />

        {error && <p className="text-[12px] text-red-400" style={mf}>{error}</p>}

        <PanelFooter>
          <button onClick={onCancel} className={BTN_SECONDARY}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
            {saving ? 'Guardando…' : initial ? 'Guardar' : 'Crear plantilla'}
          </button>
        </PanelFooter>
      </div>
    </div>
  );
}

/* ─── WA Template Picker (inline in modal) ─── */
function WaTemplatePickerInline({ flowId, onSelect, onCancel }: { flowId: number; onSelect: (id: number) => void; onCancel: () => void }) {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try { const res = await fetch(`/api/admin/flows/${flowId}/wa-templates`); const data = await res.json(); setTemplates(data.data || []); }
    catch { /* */ } finally { setLoading(false); }
  }, [flowId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  if (showCreate) {
    return <WaTemplateForm flowId={flowId} onDone={(id) => { setShowCreate(false); fetchTemplates(); onSelect(id); }} onCancel={() => setShowCreate(false)} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-digi-muted" style={mf}>Elige la plantilla que se enviará:</p>
        <button onClick={() => setShowCreate(true)} className={BTN_SECONDARY}>
          <Plus className="w-4 h-4" /> Nueva
        </button>
      </div>
      {loading ? <div className="flex justify-center py-4"><BrandLoader size="sm" /></div> :
       templates.length === 0 ? <PanelEmpty Icon={FileText} title="Sin plantillas" /> : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {templates.map(t => (
            <button key={t.id} onClick={() => onSelect(t.id)}
              className="w-full text-left rounded-lg border border-digi-border px-3 py-2.5 hover:border-accent transition-colors">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent shrink-0" />
                <span className="text-[13px] font-medium text-digi-text truncate" style={mf}>{t.name}</span>
              </span>
              <span className="block text-[12px] text-digi-muted truncate mt-0.5" style={mf}>{t.body}</span>
            </button>
          ))}
        </div>
      )}
      <PanelFooter align="end">
        <button onClick={onCancel} className={BTN_SECONDARY}>Cancelar</button>
      </PanelFooter>
    </div>
  );
}

/* ─── WA Message Preview (burbuja estilo WhatsApp — colores propios de WhatsApp a propósito) ─── */
function WaMessagePreview({ template }: { template: WaTemplate }) {
  return (
    <div>
      <span className="block text-[11px] text-digi-muted mb-1.5" style={mf}>Previsualización del mensaje</span>
      <div className="border border-digi-border rounded-lg p-4" style={{ background: '#0b141a' }}>
        <div className="max-w-[320px] mx-auto">
          <div className="rounded-lg overflow-hidden" style={{ background: '#1f2c34' }}>
            {/* Header media */}
            {template.header_type === 'image' && template.header_content && (
              <div className="flex items-center justify-center" style={{ height: 160, background: '#111b21' }}>
                {template.header_content.startsWith('data:') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={template.header_content} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-500" />
                )}
              </div>
            )}
            {template.header_type === 'video' && (
              <div className="flex items-center justify-center gap-2" style={{ height: 160, background: '#111b21' }}>
                <VideoIcon className="w-5 h-5 text-gray-400" />
                <span className="text-[12px] text-gray-400" style={mf}>{template.header_filename || 'video'}</span>
              </div>
            )}
            {template.header_type === 'document' && (
              <div className="flex items-center justify-center gap-2 px-3 py-4" style={{ background: '#111b21' }}>
                <FileIcon className="w-4 h-4 text-gray-400" />
                <span className="text-[12px] text-gray-300" style={mf}>{template.header_filename || 'documento'}</span>
              </div>
            )}
            {template.header_type === 'text' && template.header_content && (
              <div className="px-3 pt-2">
                <p className="text-sm font-bold text-gray-100">{template.header_content}</p>
              </div>
            )}

            {/* Body */}
            <div className="px-3 py-2">
              <p className="text-sm text-gray-200 whitespace-pre-wrap" style={{ fontFamily: 'sans-serif', lineHeight: 1.4 }}>{template.body}</p>
            </div>

            {/* Footer */}
            {template.footer && (
              <div className="px-3 pb-2">
                <p className="text-[11px] text-gray-500">{template.footer}</p>
              </div>
            )}

            {/* Timestamp */}
            <div className="px-3 pb-2 flex justify-end">
              <span className="text-[10px] text-gray-500">12:00 p.&nbsp;m.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── WA Stats View ─── */
function WaStatsView({ stats, onBack }: { stats: CampaignStats; onBack: () => void }) {
  const SV: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = { pending: 'default', sent: 'success', delivered: 'success', bounced: 'warning', failed: 'error' };
  return (
    <div>
      <PanelSubHeader onBack={onBack} backLabel="Campañas" title="Estadísticas"
        subtitle={stats.campaign?.wa_template_name || undefined} />

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
          { key: 'phone', header: 'Teléfono', render: (s: any) => (
            <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{s.contact_email}</span>
          ) },
          { key: 'status', header: 'Estado', width: '110px', render: (s: any) => (
            <PixelBadge variant={SV[s.status] || 'default'}>{SEND_STATUS_L[s.status] || s.status}</PixelBadge>
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
