'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const CANCEL_CLS = 'px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-white transition-colors';

interface Flow { id: number; name: string; type: string; description: string; status: string; config: Record<string, any>; }
interface ContactList { id: number; flow_id: number; name: string; contact_count: number; created_at: string; }
interface Contact { id: number; list_id: number; name: string; phone: string; }
interface WaTemplate { id: number; flow_id: number; name: string; language: string; header_type: string; header_content: string | null; header_filename: string | null; body: string; footer: string | null; buttons: any[]; created_at: string; }
interface Campaign { id: number; flow_id: number; contact_list_id: number; wa_template_id: number; status: string; list_name: string; wa_template_name: string; total_contacts: number; sent_count: number; failed_count: number; sent_at: string | null; created_at: string; }
interface CampaignStats { campaign: any; summary: { total: number; sent: number; delivered: number; bounced: number; failed: number }; sends: any[]; }

const CAMP_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = { draft: 'default', sending: 'info', sent: 'success', failed: 'error' };
const CAMP_STATUS_L: Record<string, string> = { draft: 'Borrador', sending: 'Enviando...', sent: 'Enviada', failed: 'Fallida' };

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
      else alert(data.error || 'Error al enviar');
    } catch { alert('Error de conexion'); }
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
    } catch { alert('Error al cargar estadisticas'); }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-4xl bg-digi-darker border-l-2 border-digi-border overflow-y-auto animate-[slideInRight_0.3s_ease-out]">
        <div className="sticky top-0 z-10 bg-digi-darker border-b-2 border-digi-border px-6 py-4 flex items-center gap-4">
          <button onClick={onClose} className="text-digi-muted hover:text-white transition-colors" style={pf}>&lt; Volver</button>
          <div className="flex-1">
            <h2 className="pixel-heading text-sm text-white">{flow.name}</h2>
            <p className="text-[10px] text-digi-muted mt-0.5" style={mf}>WhatsApp Business</p>
          </div>
        </div>

        <div className="p-6">
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
        </div>
      </div>

      {/* Send Preview Modal */}
      <PixelModal open={!!confirmSend && !resendPickTemplate} onClose={() => { setConfirmSend(null); setSendResult(null); }} title="Previsualizar y Enviar" size="lg">
        <div className="space-y-4">
          {!sendResult ? (
            <>
              {loadingPreview ? (
                <div className="flex justify-center py-8"><BrandLoader size="sm" label="Cargando..." /></div>
              ) : sendTemplate ? (
                <WaMessagePreview template={sendTemplate} />
              ) : (
                <p className="text-xs text-digi-muted text-center py-4" style={mf}>No se encontro la plantilla</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs" style={mf}>
                <div>
                  <span className="text-digi-muted text-[9px] block mb-0.5" style={pf}>Lista</span>
                  <span className="text-accent-glow">{confirmSend?.list_name}</span>
                  <span className="text-digi-muted ml-1">({confirmSend?.total_contacts} contactos)</span>
                </div>
                <div>
                  <span className="text-digi-muted text-[9px] block mb-0.5" style={pf}>Plantilla</span>
                  <span className="text-white">{sendTemplate?.name || '-'}</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
                <button onClick={() => setConfirmSend(null)} className={CANCEL_CLS} style={pf}>Cancelar</button>
                <button onClick={() => confirmSend && handleSend(confirmSend)} disabled={sending || !sendTemplate} className="pixel-btn-primary px-4 py-2 text-[9px]" style={pf}>
                  {sending ? 'Enviando...' : `Enviar a ${confirmSend?.total_contacts} contactos`}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-6">
                <p className="text-2xl font-bold text-green-400" style={mf}>{sendResult.sent}/{sendResult.total}</p>
                <p className="text-[9px] text-digi-muted mt-1" style={pf}>Mensajes enviados</p>
                {sendResult.failed > 0 && <p className="text-xs text-red-400 mt-2" style={mf}>{sendResult.failed} fallidos</p>}
              </div>
              <div className="flex justify-end pt-2 border-t-2 border-digi-border">
                <button onClick={() => { setConfirmSend(null); setSendResult(null); }} className="pixel-btn-primary px-4 py-2 text-[9px]" style={pf}>Cerrar</button>
              </div>
            </>
          )}
        </div>
      </PixelModal>

      {/* Resend Choice Modal */}
      <PixelModal open={!!resendChoice && !resendPickTemplate && !confirmSend} onClose={() => setResendChoice(null)} title="Reenviar Campana" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-digi-muted" style={mf}>Como deseas reenviar esta campana?</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { if (!resendChoice) return; openSendPreview(resendChoice); setResendChoice(null); }}
              className="pixel-card py-6 text-center hover:border-accent transition-colors cursor-pointer">
              <p className="text-sm text-white mb-1" style={pf}>Misma plantilla</p>
              <p className="text-[9px] text-digi-muted" style={mf}>Usar la misma configuracion</p>
            </button>
            <button onClick={() => setResendPickTemplate(true)}
              className="pixel-card py-6 text-center hover:border-accent transition-colors cursor-pointer">
              <p className="text-sm text-white mb-1" style={pf}>Otra plantilla</p>
              <p className="text-[9px] text-digi-muted" style={mf}>Seleccionar una plantilla diferente</p>
            </button>
          </div>
          <div className="flex justify-end pt-2 border-t-2 border-digi-border">
            <button onClick={() => setResendChoice(null)} className={CANCEL_CLS} style={pf}>Cancelar</button>
          </div>
        </div>
      </PixelModal>

      {/* Resend Pick Template Modal */}
      <PixelModal open={!!resendChoice && resendPickTemplate} onClose={() => { setResendPickTemplate(false); setResendChoice(null); }} title="Seleccionar Plantilla" size="lg">
        <WaTemplatePickerInline
          flowId={flow.id}
          onSelect={async (templateId) => {
            if (!resendChoice) return;
            // Load template for preview
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
    </div>
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
    { key: 'app_id', label: 'App ID', required: false, placeholder: 'ID de la aplicacion Meta' },
    { key: 'verify_token', label: 'Verify Token (Webhook)', required: false, placeholder: 'Token para verificar webhook' },
  ];

  return (
    <div>
      <h3 className="pixel-heading text-xs text-white mb-1">Configuracion de WhatsApp Business API</h3>
      <p className="text-[9px] text-digi-muted mb-4" style={mf}>Ingresa las credenciales de tu cuenta Meta Business para poder enviar mensajes.</p>
      <div className="space-y-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>
              {f.label} {f.required && <span className="text-red-400">*</span>}
            </label>
            <input
              value={config[f.key] || ''}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              type={f.key === 'access_token' ? 'password' : 'text'}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>
        ))}
        <div className="flex justify-end pt-4 border-t-2 border-digi-border">
          <button onClick={onSave} disabled={saving || !config.phone_number_id || !config.access_token}
            className="pixel-btn-primary px-6 py-2 text-[9px]" style={pf}>
            {saving ? 'Guardando...' : 'Guardar Configuracion'}
          </button>
        </div>
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
  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando..." /></div>;
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="pixel-heading text-xs text-white">Campanas WhatsApp</h3>
        <div className="flex gap-2">
          <button onClick={onEditConfig} className="px-3 py-1.5 text-[9px] border border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Config API</button>
          <button onClick={onCreateNew} className="pixel-btn-primary px-3 py-1.5 text-[9px]" style={pf}>+ Nueva Campana</button>
        </div>
      </div>
      <PixelDataTable
        columns={[
          { key: 'template', header: 'Plantilla', render: (c: Campaign) => <span className="text-white">{c.wa_template_name || '-'}</span> },
          { key: 'list', header: 'Lista', render: (c: Campaign) => <span className="text-accent-glow">{c.list_name || '-'}</span> },
          { key: 'contacts', header: 'Contactos', render: (c: Campaign) => String(c.total_contacts || 0) },
          { key: 'status', header: 'Estado', render: (c: Campaign) => <PixelBadge variant={CAMP_STATUS_V[c.status] || 'default'}>{CAMP_STATUS_L[c.status] || c.status}</PixelBadge> },
          { key: 'sent', header: 'Enviados', render: (c: Campaign) => c.status === 'sent' ? `${c.sent_count}/${c.total_contacts}` : '-' },
          { key: 'date', header: 'Fecha', render: (c: Campaign) => new Date(c.created_at).toLocaleDateString() },
          { key: 'actions', header: '', width: '140px', render: (c: Campaign) => (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              {c.status === 'draft' && <button onClick={() => onSend(c)} className="px-2 py-0.5 text-[8px] border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-colors" style={pf}>Enviar</button>}
              {c.status === 'sent' && (
                <>
                  <button onClick={() => onResend(c)} className="px-2 py-0.5 text-[8px] border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-colors" style={pf}>Reenviar</button>
                  <button onClick={() => onViewStats(c)} className="px-2 py-0.5 text-[8px] border border-accent/50 text-accent-glow hover:bg-accent/10 transition-colors" style={pf}>Stats</button>
                </>
              )}
            </div>
          )},
        ]}
        data={campaigns}
        emptyTitle="Sin campanas"
        emptyDesc="Crea tu primera campana de WhatsApp."
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
  const [countryCode, setCountryCode] = useState('+506');
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
    const ws = XLSX.utils.aoa_to_sheet([['nombre', 'telefono'], ['Juan Perez', '+50688881234'], ['Maria Lopez', '+50677772345']]);
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
          phone: (row['telefono'] || row['Telefono'] || row['phone'] || row['Phone'] || '').toString().trim(),
        }))
        .filter(c => c.name && c.phone);
      if (contactsData.length === 0) { alert('No se encontraron contactos. Columnas: "nombre" y "telefono"'); return; }
      const res = await fetch(`/api/admin/flows/${flowId}/contact-lists/${expandedListId}/contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactsData),
      });
      if (res.ok) { fetchContacts(expandedListId); fetchLists(); }
    } catch { alert('Error al leer el archivo'); }
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
      else { const data = await res.json(); setError(data.error || 'Error'); }
    } catch { setError('Error de conexion'); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onCancel} className="text-digi-muted hover:text-white text-[9px] transition-colors" style={pf}>&lt; Campanas</button>
        <div className="flex-1 flex items-center gap-2 justify-center">
          <StepDot num={1} active={step === 1} done={step > 1} label="Contactos" onClick={() => setStep(1)} />
          <div className={`w-8 h-0.5 ${step > 1 ? 'bg-accent' : 'bg-digi-border'}`} />
          <StepDot num={2} active={step === 2} done={false} label="Plantilla" onClick={() => step > 1 && setStep(2)} />
        </div>
      </div>

      {/* Step 1: Contact Lists */}
      {step === 1 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="pixel-heading text-xs text-white">Listas de Contactos</h3>
            <button onClick={() => setShowCreateList(true)} className="pixel-btn-primary px-3 py-1.5 text-[9px]" style={pf}>+ Nueva Lista</button>
          </div>

          {showCreateList && (
            <div className="pixel-card mb-4 p-4">
              <div className="flex gap-2">
                <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Nombre de la lista"
                  className="flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}
                  onKeyDown={e => e.key === 'Enter' && handleCreateList()} />
                <button onClick={handleCreateList} disabled={creatingList} className="pixel-btn-primary px-3 py-2 text-[9px]" style={pf}>{creatingList ? '...' : 'Crear'}</button>
                <button onClick={() => setShowCreateList(false)} className={CANCEL_CLS} style={pf}>X</button>
              </div>
            </div>
          )}

          {loadingLists ? <div className="flex justify-center py-8"><BrandLoader size="sm" /></div> :
           contactLists.length === 0 ? (
            <div className="pixel-card text-center py-8">
              <p className="text-[9px] text-digi-muted" style={pf}>No hay listas de contactos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contactLists.map(list => (
                <div key={list.id} className={`border-2 transition-colors ${selectedListId === list.id ? 'border-accent bg-accent/5' : 'border-digi-border'}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => toggleExpand(list.id)} className="text-digi-muted hover:text-white text-xs" style={pf}>{expandedListId === list.id ? 'v' : '>'}</button>
                    <div className="flex-1">
                      <span className="text-sm text-white" style={mf}>{list.name}</span>
                      <span className="text-[9px] text-digi-muted ml-2" style={pf}>{list.contact_count} contactos</span>
                    </div>
                    <button onClick={() => setSelectedListId(selectedListId === list.id ? null : list.id)}
                      className={`px-3 py-1 text-[8px] border transition-colors ${selectedListId === list.id ? 'border-accent bg-accent/20 text-accent-glow' : 'border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow'}`} style={pf}>
                      {selectedListId === list.id ? 'Seleccionada' : 'Seleccionar'}
                    </button>
                    <button onClick={() => handleDeleteList(list.id)} className="px-2 py-1 text-[8px] border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors" style={pf}>X</button>
                  </div>

                  {expandedListId === list.id && (
                    <div className="border-t-2 border-digi-border px-4 py-3 bg-digi-dark/50">
                      {/* Add contact: country code + phone */}
                      <div className="flex gap-2 mb-3">
                        <input value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="Nombre"
                          className="flex-1 px-2 py-1.5 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
                          className="w-20 px-1 py-1.5 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf}>
                          {COUNTRY_CODES.map(cc => <option key={cc.code} value={cc.code}>{cc.code} {cc.country}</option>)}
                        </select>
                        <input value={newContactPhone} onChange={e => setNewContactPhone(e.target.value.replace(/\D/g, ''))} placeholder="88881234"
                          className="w-28 px-2 py-1.5 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf}
                          onKeyDown={e => e.key === 'Enter' && handleAddContact()} />
                        <button onClick={handleAddContact} disabled={addingContact} className="pixel-btn-primary px-2 py-1.5 text-[8px]" style={pf}>{addingContact ? '...' : '+'}</button>
                      </div>

                      {/* Import/Download */}
                      <div className="flex gap-2 mb-3">
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} disabled={importingContacts}
                          className="px-2 py-1 text-[8px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow transition-colors" style={pf}>
                          {importingContacts ? 'Importando...' : 'Importar Excel'}
                        </button>
                        <button onClick={handleDownloadTemplate}
                          className="px-2 py-1 text-[8px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow transition-colors" style={pf}>
                          Descargar Plantilla
                        </button>
                      </div>

                      {/* Contacts list */}
                      {loadingContacts ? <div className="flex justify-center py-4"><BrandLoader size="sm" /></div> :
                       contacts.length === 0 ? <p className="text-center text-[9px] text-digi-muted py-2" style={pf}>Sin contactos</p> : (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {contacts.map(c => (
                            <div key={c.id} className="flex items-center gap-2 px-2 py-1 border border-digi-border/50 text-xs" style={mf}>
                              <span className="text-digi-text flex-1">{c.name}</span>
                              <span className="text-green-400 flex-1">{c.phone}</span>
                              <button onClick={() => handleDeleteContact(c.id)} className="text-red-400/60 hover:text-red-400 text-[8px] transition-colors" style={pf}>X</button>
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

          <div className="flex justify-end mt-6 pt-4 border-t-2 border-digi-border">
            <button onClick={() => { if (selectedListId) setStep(2); else setError('Selecciona una lista'); }}
              className="pixel-btn-primary px-6 py-2 text-[9px]" style={pf} disabled={!selectedListId}>Siguiente &gt;</button>
          </div>
          {error && !selectedListId && <p className="text-xs text-red-400 mt-2 text-right" style={mf}>{error}</p>}
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="pixel-heading text-xs text-white">Plantillas de Mensaje</h3>
                <button onClick={() => setShowCreateTemplate(true)} className="pixel-btn-primary px-3 py-1.5 text-[9px]" style={pf}>+ Nueva Plantilla</button>
              </div>

              {loadingTemplates ? <div className="flex justify-center py-8"><BrandLoader size="sm" /></div> :
               templates.length === 0 ? (
                <div className="pixel-card text-center py-8">
                  <p className="text-[9px] text-digi-muted" style={pf}>No hay plantillas</p>
                  <p className="text-xs text-digi-muted/60 mt-1" style={mf}>Crea una plantilla para continuar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => (
                    <div key={t.id} className={`border-2 px-4 py-3 transition-colors cursor-pointer ${selectedTemplateId === t.id ? 'border-accent bg-accent/5' : 'border-digi-border hover:border-digi-muted'}`}
                      onClick={() => setSelectedTemplateId(selectedTemplateId === t.id ? null : t.id)}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <span className="text-sm text-white" style={mf}>{t.name}</span>
                          {t.header_type !== 'none' && <PixelBadge variant="info" className="ml-2">{t.header_type}</PixelBadge>}
                        </div>
                        <span className="text-[9px] text-digi-muted" style={pf}>{t.language}</span>
                        {selectedTemplateId === t.id && <PixelBadge variant="success">Seleccionada</PixelBadge>}
                      </div>
                      <p className="text-xs text-digi-muted mt-1 truncate" style={mf}>{t.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-xs text-red-400 mt-2" style={mf}>{error}</p>}

              <div className="flex justify-between mt-6 pt-4 border-t-2 border-digi-border">
                <button onClick={() => setStep(1)} className={CANCEL_CLS} style={pf}>&lt; Anterior</button>
                <button onClick={handleSaveCampaign} disabled={saving || !selectedTemplateId} className="pixel-btn-primary px-6 py-2 text-[9px]" style={pf}>
                  {saving ? 'Guardando...' : 'Guardar Campana'}
                </button>
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
    { value: 'image', label: 'Imagen (max 5MB)' },
    { value: 'video', label: 'Video (max 16MB)' },
    { value: 'document', label: 'Documento (max 5MB)' },
  ];

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = headerType === 'video' ? 16 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) { alert(`Archivo supera el limite de ${headerType === 'video' ? '16' : '5'}MB`); return; }
    const buffer = await file.arrayBuffer();
    const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));
    const mimePrefix = file.type ? `data:${file.type};base64,` : 'data:application/octet-stream;base64,';
    setHeaderContent(`${mimePrefix}${base64}`);
    setHeaderFilename(file.name);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Nombre requerido'); return; }
    if (!body.trim()) { setError('Cuerpo requerido'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: name.trim(), language, header_type: headerType, header_content: headerContent || null, header_filename: headerFilename || null, body: body.trim(), footer: footer.trim() || null, buttons: [] };
      const url = initial ? `/api/admin/flows/${flowId}/wa-templates/${initial.id}` : `/api/admin/flows/${flowId}/wa-templates`;
      const res = await fetch(url, { method: initial ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { const data = await res.json(); onDone(data.data.id); }
      else { const data = await res.json(); setError(data.error || 'Error'); }
    } catch { setError('Error de conexion'); } finally { setSaving(false); }
  };

  return (
    <div>
      <h3 className="pixel-heading text-xs text-white mb-4">{initial ? 'Editar' : 'Nueva'} Plantilla</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Nombre de la plantilla <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: promo_diciembre"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
          </div>
          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Idioma</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}>
              <option value="es">Espanol</option><option value="en">English</option><option value="pt_BR">Portugues</option>
            </select>
          </div>
        </div>

        {/* Header */}
        <div>
          <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Encabezado</label>
          <select value={headerType} onChange={e => { setHeaderType(e.target.value); setHeaderContent(''); setHeaderFilename(''); }}
            className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none mb-2" style={mf}>
            {HEADER_TYPES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
          {headerType === 'text' && (
            <input value={headerContent} onChange={e => setHeaderContent(e.target.value)} placeholder="Texto del encabezado (max 60 chars)" maxLength={60}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
          )}
          {(headerType === 'image' || headerType === 'video' || headerType === 'document') && (
            <div>
              <input ref={mediaInputRef} type="file" onChange={handleMediaUpload}
                accept={headerType === 'image' ? '.jpg,.png' : headerType === 'video' ? '.mp4,.3gpp' : '.pdf,.docx,.xlsx,.pptx,.txt'}
                className="hidden" />
              <div className="flex items-center gap-2">
                <button onClick={() => mediaInputRef.current?.click()}
                  className="px-3 py-1.5 text-[8px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow transition-colors" style={pf}>
                  Subir {headerType === 'image' ? 'imagen' : headerType === 'video' ? 'video' : 'documento'}
                </button>
                {headerFilename && <span className="text-xs text-green-400" style={mf}>{headerFilename}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div>
          <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Cuerpo del mensaje <span className="text-red-400">*</span></label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Hola {{1}}, te informamos que..." rows={6}
            className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          <p className="text-[8px] text-digi-muted mt-1" style={mf}>Usa {'{{1}}'}, {'{{2}}'} para variables. Max 1024 caracteres.</p>
        </div>

        {/* Footer */}
        <div>
          <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Pie de mensaje</label>
          <input value={footer} onChange={e => setFooter(e.target.value)} placeholder="Texto del pie (max 60 chars)" maxLength={60}
            className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
        </div>

        {error && <p className="text-xs text-red-400" style={mf}>{error}</p>}

        <div className="flex justify-between pt-4 border-t-2 border-digi-border">
          <button onClick={onCancel} className={CANCEL_CLS} style={pf}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="pixel-btn-primary px-6 py-2 text-[9px]" style={pf}>
            {saving ? 'Guardando...' : initial ? 'Guardar' : 'Crear Plantilla'}
          </button>
        </div>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-digi-muted" style={mf}>Selecciona una plantilla:</p>
        <button onClick={() => setShowCreate(true)} className="pixel-btn-primary px-3 py-1.5 text-[9px]" style={pf}>+ Nueva</button>
      </div>
      {loading ? <div className="flex justify-center py-4"><BrandLoader size="sm" /></div> :
       templates.length === 0 ? <p className="text-center text-[9px] text-digi-muted py-4" style={pf}>Sin plantillas</p> : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {templates.map(t => (
            <button key={t.id} onClick={() => onSelect(t.id)}
              className="w-full text-left border-2 border-digi-border px-4 py-3 hover:border-accent transition-colors">
              <span className="text-sm text-white block" style={mf}>{t.name}</span>
              <span className="text-xs text-digi-muted truncate block" style={mf}>{t.body}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end pt-2 border-t-2 border-digi-border">
        <button onClick={onCancel} className={CANCEL_CLS} style={pf}>Cancelar</button>
      </div>
    </div>
  );
}

/* ─── WA Message Preview (WhatsApp style bubble) ─── */
function WaMessagePreview({ template }: { template: WaTemplate }) {
  return (
    <div>
      <span className="text-digi-muted block text-[9px] mb-2" style={pf}>Previsualizacion del mensaje</span>
      <div className="border-2 border-digi-border rounded p-4" style={{ background: '#0b141a' }}>
        <div className="max-w-[320px] mx-auto">
          <div className="rounded-lg overflow-hidden" style={{ background: '#1f2c34' }}>
            {/* Header media */}
            {template.header_type === 'image' && template.header_content && (
              <div className="bg-digi-darker flex items-center justify-center" style={{ height: 160 }}>
                {template.header_content.startsWith('data:') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={template.header_content} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9px] text-digi-muted" style={pf}>Imagen</span>
                )}
              </div>
            )}
            {template.header_type === 'video' && (
              <div className="bg-digi-darker flex items-center justify-center" style={{ height: 160 }}>
                <span className="text-[9px] text-digi-muted" style={pf}>Video: {template.header_filename || 'video'}</span>
              </div>
            )}
            {template.header_type === 'document' && (
              <div className="bg-digi-darker flex items-center justify-center px-3 py-4">
                <span className="text-xs text-red-400" style={mf}>{template.header_filename || 'documento'}</span>
              </div>
            )}
            {template.header_type === 'text' && template.header_content && (
              <div className="px-3 pt-2">
                <p className="text-sm font-bold text-white">{template.header_content}</p>
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
              <span className="text-[10px] text-gray-500">12:00 p.m.</span>
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
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-digi-muted hover:text-white text-[9px] transition-colors" style={pf}>&lt; Campanas</button>
        <h3 className="pixel-heading text-xs text-white">Estadisticas</h3>
      </div>
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
      <PixelDataTable
        columns={[
          { key: 'name', header: 'Contacto', render: (s: any) => s.contact_name },
          { key: 'phone', header: 'Telefono', render: (s: any) => s.contact_email },
          { key: 'status', header: 'Estado', render: (s: any) => <PixelBadge variant={SV[s.status] || 'default'}>{s.status}</PixelBadge> },
          { key: 'error', header: 'Error', render: (s: any) => <span className="text-red-400/80 truncate max-w-[200px] inline-block">{s.error_message || '-'}</span> },
          { key: 'date', header: 'Fecha', render: (s: any) => s.sent_at ? new Date(s.sent_at).toLocaleString() : '-' },
        ]}
        data={stats.sends}
        emptyTitle="Sin envios"
        emptyDesc="No hay registros."
      />
    </div>
  );
}

/* ─── Step Indicator ─── */
function StepDot({ num, active, done, label, onClick }: { num: number; active: boolean; done: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className={`w-7 h-7 flex items-center justify-center text-[10px] border-2 transition-colors ${active ? 'border-accent bg-accent/20 text-accent-glow' : done ? 'border-green-600 bg-green-900/20 text-green-400' : 'border-digi-border text-digi-muted'}`} style={pf}>
        {done ? '✓' : num}
      </div>
      <span className={`text-[8px] ${active ? 'text-accent-glow' : 'text-digi-muted'}`} style={pf}>{label}</span>
    </button>
  );
}
