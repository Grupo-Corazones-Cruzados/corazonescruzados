'use client';

/**
 * EmailFlowWorkspace — configuración de un flujo de EMAIL MASIVO, a página completa.
 *
 * Tres zonas, de izquierda a derecha:
 *   1. Rail de CAMPAÑAS (`FilterRail`) — seleccionar una, editarla o borrarla.
 *   2. Panel de LISTAS del flujo — arriba las asociadas a la campaña seleccionada, abajo el
 *      resto. La casilla asocia/desasocia; el clic en la fila (fuera de la casilla) la
 *      selecciona para ver sus contactos.
 *   3. Panel de CONTACTOS de la lista seleccionada — editar, quitar, agregar, y
 *      plantilla / exportar / importar / compartir.
 *
 * Todo lo que se ve aquí pertenece al flujo: sus campañas, sus listas y los contactos de
 * esas listas. Borrar el flujo se lo lleva todo (ON DELETE CASCADE, comprobado).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelConfirm from '@/components/ui/PixelConfirm';
import FilterRail from '@/components/ui/FilterRail';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import {
  SectionBar, PanelFooter, StatCards, PanelEmpty, FIELD, LABEL, BTN_ROW, BTN_ROW_DANGER,
} from '@/components/dashboard/flows/FlowPanelUI';
import {
  HtmlEditor, SubjectField, AttachmentsManager, buildPreviewHtml,
} from '@/components/dashboard/flows/EmailEditor';
import { CONTACT_VARIABLES, usedVariables, previewTemplate } from '@/lib/flows/variables';
import {
  Mail, Plus, Send, BarChart3, Users, Trash2, Pencil, Check, Eye, Share2, Copy,
  Download, FileSpreadsheet, Upload, Link2, RefreshCw, ShieldOff, ExternalLink,
  FileEdit, CheckCircle2, AlertTriangle, XCircle, User,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/* ─── Tipos ─── */
interface Flow { id: number; name: string; type: string; description: string; status: string; config: Record<string, any>; }
interface ListRef { id: number; name: string }
interface ContactList { id: number; name: string; contact_count: number; share_token?: string | null }
interface Contact { id: number; name: string; email: string; phone: string | null; position: string | null; added_via_share: boolean }
/**
 * Campaña tal como la devuelve el LISTADO: sin `body_html`/`footer_html`/`attachments`, que
 * pesan megabytes (los adjuntos van en base64 en la fila). El contenido completo se pide al
 * abrir la campaña (`GET .../campaigns/[id]`).
 */
interface Campaign {
  id: number; subject: string; from_email: string; status: string;
  lists: ListRef[]; total_contacts: number; attachment_count: number;
  sent_count: number; failed_count: number; created_at: string;
}
interface CampaignStats {
  campaign: any;
  summary: { total: number; sent: number; delivered: number; bounced: number; failed: number };
  sends: any[];
}

const CAMP_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', sending: 'info', sent: 'success', failed: 'error',
};
const CAMP_STATUS_L: Record<string, string> = {
  draft: 'Borrador', sending: 'Enviando…', sent: 'Enviada', failed: 'Fallida',
};
const CAMP_STATUS_ICON: Record<string, any> = {
  draft: FileEdit, sending: RefreshCw, sent: CheckCircle2, failed: XCircle,
};
const SEND_STATUS_L: Record<string, string> = {
  pending: 'Pendiente', sent: 'Enviado', delivered: 'Entregado', bounced: 'Rebotado', failed: 'Fallido',
};

/** Nombre visible de un `From` guardado (el servidor impone la dirección). */
function displayNameOf(rawFrom?: string | null): string {
  const raw = String(rawFrom || '').trim();
  const angled = raw.match(/^\s*(.*?)\s*<[^>]*>\s*$/);
  const name = angled ? angled[1] : (/@/.test(raw) ? '' : raw);
  return name.replace(/["<>]/g, '').trim();
}

export default function EmailFlowWorkspace({ flow }: { flow: Flow }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [senderAddress, setSenderAddress] = useState('');
  const [loading, setLoading] = useState(true);

  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [listId, setListId] = useState<number | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Modales
  const [newCampaign, setNewCampaign] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [newList, setNewList] = useState(false);
  const [renameList, setRenameList] = useState<ContactList | null>(null);
  const [shareList, setShareList] = useState<ContactList | null>(null);
  const [editContact, setEditContact] = useState<Contact | 'new' | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [sendFor, setSendFor] = useState<Campaign | null>(null);

  // Confirmaciones
  const [delCampaign, setDelCampaign] = useState<Campaign | null>(null);
  const [delList, setDelList] = useState<ContactList | null>(null);
  const [delContact, setDelContact] = useState<Contact | null>(null);

  const base = `/api/admin/flows/${flow.id}`;

  /* ── Carga ── */
  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`${base}/campaigns`);
      const d = await res.json();
      setCampaigns(d.data || []);
      if (d.senderAddress) setSenderAddress(d.senderAddress);
    } catch { toast.error('Error al cargar las campañas'); }
  }, [base]);

  const loadLists = useCallback(async () => {
    try {
      const res = await fetch(`${base}/contact-lists`);
      const d = await res.json();
      setLists(d.data || []);
    } catch { toast.error('Error al cargar las listas'); }
  }, [base]);

  useEffect(() => {
    (async () => { await Promise.all([loadCampaigns(), loadLists()]); setLoading(false); })();
  }, [loadCampaigns, loadLists]);

  const loadContacts = useCallback(async (id: number) => {
    setLoadingContacts(true);
    try {
      const res = await fetch(`${base}/contact-lists/${id}/contacts`);
      const d = await res.json();
      setContacts(d.data || []);
    } catch { toast.error('Error al cargar los contactos'); }
    finally { setLoadingContacts(false); }
  }, [base]);

  useEffect(() => {
    if (listId == null) { setContacts([]); return; }
    loadContacts(listId);
  }, [listId, loadContacts]);

  const campaign = useMemo(() => campaigns.find((c) => c.id === campaignId) || null, [campaigns, campaignId]);
  const list = useMemo(() => lists.find((l) => l.id === listId) || null, [lists, listId]);

  // Listas asociadas a la campaña seleccionada vs. el resto (las dos secciones del panel).
  const attachedIds = useMemo(() => new Set((campaign?.lists || []).map((l) => l.id)), [campaign]);
  const attached = useMemo(() => lists.filter((l) => attachedIds.has(l.id)), [lists, attachedIds]);
  const others = useMemo(() => lists.filter((l) => !attachedIds.has(l.id)), [lists, attachedIds]);

  /* ── Campañas ── */
  const toggleList = async (l: ContactList, next: boolean) => {
    if (!campaign) { toast.error('Elige primero una campaña'); return; }
    try {
      const res = await fetch(`${base}/campaigns/${campaign.id}/lists`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_id: l.id, attached: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      await loadCampaigns();
    } catch (e: any) { toast.error(e.message || 'Error al cambiar la lista'); }
  };

  const removeCampaign = async (c: Campaign) => {
    setDelCampaign(null);
    try {
      const res = await fetch(`${base}/campaigns/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      if (campaignId === c.id) setCampaignId(null);
      await loadCampaigns();
      toast.success('Campaña eliminada');
    } catch (e: any) { toast.error(e.message); }
  };

  const openStats = async (c: Campaign) => {
    try {
      const res = await fetch(`${base}/campaigns/${c.id}/stats`);
      setStats(await res.json());
    } catch { toast.error('Error al cargar las estadísticas'); }
  };

  /* ── Listas ── */
  const removeList = async (l: ContactList) => {
    setDelList(null);
    try {
      const res = await fetch(`${base}/contact-lists/${l.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al eliminar');
      if (listId === l.id) setListId(null);
      await Promise.all([loadLists(), loadCampaigns()]);
      toast.success('Lista eliminada');
    } catch (e: any) { toast.error(e.message); }
  };

  /* ── Contactos ── */
  const removeContact = async (c: Contact) => {
    setDelContact(null);
    if (listId == null) return;
    try {
      const res = await fetch(`${base}/contact-lists/${listId}/contacts/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al quitar');
      setContacts((p) => p.filter((x) => x.id !== c.id));
      await Promise.all([loadLists(), loadCampaigns()]);
      toast.success('Contacto quitado');
    } catch (e: any) { toast.error(e.message); }
  };

  /* ── Excel ── */
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'correo', 'telefono', 'puesto'],
      ['María López', 'maria@ejemplo.com', '+593988881234', 'Directora'],
      ['Juan Pérez', 'juan@ejemplo.com', '+593977772345', 'Coordinador'],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
    XLSX.writeFile(wb, 'plantilla_contactos.xlsx');
  };

  const exportExcel = () => {
    if (!list || contacts.length === 0) { toast.error('No hay contactos que exportar'); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(contacts.map((c) => ({
      nombre: c.name, correo: c.email || '', telefono: c.phone || '', puesto: c.position || '',
    })));
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
    XLSX.writeFile(wb, `contactos_${list.name.replace(/[^\w\-]+/g, '_')}.xlsx`);
  };

  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || listId == null) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const payload = rows.map((r) => ({
        name: String(r['nombre'] ?? r['Nombre'] ?? r['name'] ?? '').trim(),
        email: String(r['correo'] ?? r['Correo'] ?? r['email'] ?? '').trim().toLowerCase(),
        phone: String(r['telefono'] ?? r['teléfono'] ?? r['Telefono'] ?? r['phone'] ?? '').trim(),
        position: String(r['puesto'] ?? r['Puesto'] ?? r['position'] ?? r['cargo'] ?? '').trim(),
      })).filter((c) => c.name && (c.email || c.phone));
      if (payload.length === 0) { toast.error('No se encontraron contactos. Columnas: nombre, correo, telefono, puesto.'); return; }

      const res = await fetch(`${base}/contact-lists/${listId}/contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al importar');
      await Promise.all([loadContacts(listId), loadLists(), loadCampaigns()]);
      toast.success(`${payload.length} contacto(s) importado(s)`);
    } catch (err: any) { toast.error(err.message || 'Error al leer el archivo'); }
    finally { e.target.value = ''; }
  };

  if (loading) return <div className="flex justify-center py-16"><BrandLoader size="lg" label="Cargando el flujo…" /></div>;

  /* ── Rail de campañas ── */
  const railItems = campaigns.map((c) => ({
    value: String(c.id),
    label: c.subject || 'Sin asunto',
    Icon: CAMP_STATUS_ICON[c.status] || Mail,
    // Sin burbuja de conteo: el asunto necesita todo el ancho. El número de
    // destinatarios va en la segunda línea, junto al estado.
    hint: `${CAMP_STATUS_L[c.status] || c.status} · ${c.total_contacts} destinatario(s)`,
    actions: (
      <>
        <button onClick={() => setEditCampaign(c)} title="Editar el correo"
          className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-black/[0.05] transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setDelCampaign(c)} title="Eliminar la campaña"
          className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </>
    ),
  }));

  return (
    <div className="flex flex-col xl:flex-row gap-4 items-start">
      {/* ── 1. Campañas ── */}
      <div className="w-full xl:w-[268px] shrink-0 space-y-2">
        <button onClick={() => setNewCampaign(true)} className={`${BTN_PRIMARY} w-full`}>
          <Plus className="w-4 h-4" /> Nueva campaña
        </button>
        {campaigns.length === 0 ? (
          <PanelEmpty Icon={Mail} title="Sin campañas" desc="Crea la primera para empezar." />
        ) : (
          <FilterRail
            className="w-full"
            wrapLabels
            title={`Campañas (${campaigns.length})`}
            items={railItems}
            value={campaignId != null ? String(campaignId) : ''}
            onChange={(v) => setCampaignId(Number(v))}
          />
        )}
      </div>

      <div className="flex-1 min-w-0 w-full space-y-3">
        {/* Barra de la campaña seleccionada */}
        {campaign && (
          <div className="bg-digi-card border border-digi-border rounded-lg p-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-digi-text truncate" style={mf}>{campaign.subject || 'Sin asunto'}</p>
              <p className="text-[11.5px] text-digi-muted truncate" style={mf}>
                {displayNameOf(campaign.from_email) || 'GCC World'} · {campaign.total_contacts} destinatario(s) en {campaign.lists.length} lista(s)
              </p>
            </div>
            <PixelBadge variant={CAMP_STATUS_V[campaign.status] || 'default'}>
              {CAMP_STATUS_L[campaign.status] || campaign.status}
            </PixelBadge>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditCampaign(campaign)} className={BTN_SECONDARY}>
                <Pencil className="w-4 h-4" /> Editar correo
              </button>
              {campaign.status === 'sent' && (
                <button onClick={() => openStats(campaign)} className={BTN_SECONDARY}>
                  <BarChart3 className="w-4 h-4" /> Estadísticas
                </button>
              )}
              <button onClick={() => setSendFor(campaign)} className={BTN_PRIMARY} disabled={campaign.total_contacts === 0}>
                <Send className="w-4 h-4" /> {campaign.status === 'sent' ? 'Reenviar' : 'Enviar'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[270px_minmax(0,1fr)] gap-4 items-start">
          {/* ── 2. Listas del flujo ── */}
          <div className="bg-digi-card border border-digi-border rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide" style={mf}>
                Listas de contactos
              </p>
              <button onClick={() => setNewList(true)} className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-accent-light transition-colors" title="Nueva lista">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {lists.length === 0 ? (
              <PanelEmpty Icon={Users} title="Sin listas" desc="Crea una lista de contactos." />
            ) : (
              <div className="space-y-2">
                {campaign && (
                  <ListGroup
                    title="En esta campaña"
                    lists={attached}
                    emptyText="Marca abajo las listas que entran en la campaña."
                    checked
                    selectedId={listId}
                    onSelect={setListId}
                    onToggle={(l) => toggleList(l, false)}
                    onRename={setRenameList}
                    onShare={setShareList}
                    onDelete={setDelList}
                  />
                )}
                <ListGroup
                  title={campaign ? 'Otras listas del flujo' : undefined}
                  lists={campaign ? others : lists}
                  emptyText={campaign ? 'Todas las listas están en la campaña.' : undefined}
                  checked={false}
                  showCheckbox={!!campaign}
                  selectedId={listId}
                  onSelect={setListId}
                  onToggle={(l) => toggleList(l, true)}
                  onRename={setRenameList}
                  onShare={setShareList}
                  onDelete={setDelList}
                />
              </div>
            )}
          </div>

          {/* ── 3. Contactos de la lista ── */}
          <div className="min-w-0">
            {!list ? (
              <div className="bg-digi-card border border-digi-border rounded-lg p-8 text-center">
                <div className="w-10 h-10 rounded-lg bg-black/[0.04] flex items-center justify-center mx-auto mb-2">
                  <User className="w-5 h-5 text-digi-muted" />
                </div>
                <p className="text-[13px] font-medium text-digi-text" style={mf}>Elige una lista</p>
                <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>
                  Haz clic en el nombre de una lista para ver y editar sus contactos.
                </p>
              </div>
            ) : (
              <div className="bg-digi-card border border-digi-border rounded-lg p-4">
                <SectionBar title={list.name} hint={`${contacts.length} contacto(s)`}>
                  <button onClick={() => setEditContact('new')} className={BTN_PRIMARY}>
                    <Plus className="w-4 h-4" /> Agregar contacto
                  </button>
                </SectionBar>

                <div className="flex flex-wrap gap-2 mb-3">
                  <label className={`${BTN_ROW} cursor-pointer`}>
                    <Upload className="w-3.5 h-3.5" /> Importar Excel
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importExcel} />
                  </label>
                  <button onClick={downloadTemplate} className={BTN_ROW}>
                    <Download className="w-3.5 h-3.5" /> Descargar plantilla
                  </button>
                  <button onClick={exportExcel} className={BTN_ROW}>
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
                  </button>
                  <button onClick={() => setShareList(list)} className={BTN_ROW}>
                    <Share2 className="w-3.5 h-3.5" /> Compartir
                  </button>
                </div>

                {loadingContacts ? (
                  <div className="flex justify-center py-10"><BrandLoader size="sm" /></div>
                ) : (
                  <PixelDataTable
                    singleLine
                    columns={[
                      { key: 'name', header: 'Nombre', render: (c: Contact) => (
                        <span className="block text-[13px] font-medium text-digi-text truncate" style={mf}>{c.name}</span>
                      ) },
                      { key: 'email', header: 'Correo', render: (c: Contact) => (
                        <span className="block text-[12px] text-digi-muted truncate" style={mf}>{c.email || '—'}</span>
                      ) },
                      { key: 'position', header: 'Puesto', width: '150px', hideOnMobile: true, render: (c: Contact) => (
                        <span className="block text-[12px] text-digi-text truncate" style={mf}>{c.position || '—'}</span>
                      ) },
                      { key: 'phone', header: 'Teléfono', width: '140px', hideOnMobile: true, render: (c: Contact) => (
                        <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{c.phone || '—'}</span>
                      ) },
                      { key: 'actions', header: '', width: '90px', render: (c: Contact) => (
                        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditContact(c)} className={BTN_ROW} aria-label="Editar contacto" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDelContact(c)} className={BTN_ROW_DANGER} aria-label="Quitar contacto" title="Quitar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) },
                    ]}
                    data={contacts}
                    emptyTitle="Sin contactos"
                    emptyDesc="Agrega el primero o importa un Excel."
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modales ── */}
      <CampaignFormModal
        open={newCampaign || !!editCampaign}
        base={base}
        campaign={editCampaign}
        senderAddress={senderAddress}
        defaultSenderName={flow.name}
        onClose={() => { setNewCampaign(false); setEditCampaign(null); }}
        onSaved={async (id) => { await loadCampaigns(); if (id) setCampaignId(id); }}
      />

      <ListNameModal
        open={newList || !!renameList}
        base={base}
        list={renameList}
        onClose={() => { setNewList(false); setRenameList(null); }}
        onSaved={async (id) => { await Promise.all([loadLists(), loadCampaigns()]); if (id) setListId(id); }}
      />

      <ContactFormModal
        open={!!editContact}
        base={base}
        listId={listId}
        contact={editContact === 'new' ? null : editContact}
        onClose={() => setEditContact(null)}
        onSaved={async () => {
          if (listId != null) await loadContacts(listId);
          await Promise.all([loadLists(), loadCampaigns()]);
        }}
      />

      <ShareListModal base={base} list={shareList} onClose={() => setShareList(null)} onChanged={loadLists} />

      <SendCampaignModal
        base={base}
        campaign={sendFor}
        senderAddress={senderAddress}
        onClose={() => setSendFor(null)}
        onSent={loadCampaigns}
      />

      <StatsModal stats={stats} onClose={() => setStats(null)} />

      <PixelConfirm
        open={!!delCampaign}
        title="Eliminar campaña"
        message={`¿Eliminar "${delCampaign?.subject ?? ''}"? También se borra su historial de envíos.`}
        confirmLabel="Sí, eliminar" danger
        onConfirm={() => delCampaign && removeCampaign(delCampaign)}
        onCancel={() => setDelCampaign(null)}
      />
      <PixelConfirm
        open={!!delList}
        title="Eliminar lista"
        message={`¿Eliminar "${delList?.name ?? ''}"? Se borran sus ${delList?.contact_count ?? 0} contacto(s) y se quita de las campañas que la usan.`}
        confirmLabel="Sí, eliminar" danger
        onConfirm={() => delList && removeList(delList)}
        onCancel={() => setDelList(null)}
      />
      <PixelConfirm
        open={!!delContact}
        title="Quitar contacto"
        message={`¿Quitar a "${delContact?.name ?? ''}" de la lista?`}
        confirmLabel="Sí, quitar" danger
        onConfirm={() => delContact && removeContact(delContact)}
        onCancel={() => setDelContact(null)}
      />
    </div>
  );
}

/* ─── Grupo de listas (asociadas / resto) ─── */
function ListGroup({
  title, lists, emptyText, checked, showCheckbox = true, selectedId,
  onSelect, onToggle, onRename, onShare, onDelete,
}: {
  /** Sin título cuando no hay campaña elegida: el panel ya se llama "Listas de contactos". */
  title?: string;
  lists: ContactList[];
  emptyText?: string;
  checked: boolean;
  showCheckbox?: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onToggle: (l: ContactList) => void;
  onRename: (l: ContactList) => void;
  onShare: (l: ContactList) => void;
  onDelete: (l: ContactList) => void;
}) {
  return (
    <div>
      {title && (
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-1 pb-1" style={mf}>{title}</p>
      )}
      {lists.length === 0 ? (
        emptyText ? <p className="text-[11.5px] text-digi-muted/80 px-1 pb-1.5" style={mf}>{emptyText}</p> : null
      ) : (
        <div className="space-y-0.5">
          {lists.map((l) => {
            const selected = selectedId === l.id;
            return (
              <div
                key={l.id}
                className={`group/list flex items-center gap-1.5 rounded-md border-l-2 transition-colors ${
                  selected ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.03]'
                }`}
              >
                {showCheckbox && (
                  // La casilla asocia/desasocia la lista de la campaña; NO selecciona.
                  <button
                    type="button"
                    onClick={() => onToggle(l)}
                    title={checked ? 'Quitar de la campaña' : 'Agregar a la campaña'}
                    className={`ml-2 w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                      checked ? 'bg-accent border-accent text-white' : 'border-digi-border bg-digi-darker hover:border-accent'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                )}

                {/* El clic fuera de la casilla SELECCIONA la lista (muestra sus contactos). */}
                <button
                  type="button"
                  onClick={() => onSelect(l.id)}
                  className={`flex-1 min-w-0 text-left py-2 ${showCheckbox ? 'pl-1' : 'pl-3'} pr-1`}
                >
                  <span className={`block text-[12.5px] font-medium truncate ${selected ? 'text-accent' : 'text-digi-text'}`} style={mf}>
                    {l.name}
                  </span>
                  <span className="block text-[10.5px] text-digi-muted" style={mf}>
                    {l.contact_count} contacto(s){l.share_token ? ' · enlace activo' : ''}
                  </span>
                </button>

                <span className={`flex items-center gap-0.5 pr-1.5 shrink-0 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover/list:opacity-100 focus-within:opacity-100'}`}>
                  <button onClick={() => onRename(l)} title="Renombrar la lista"
                    className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-black/[0.05] transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onShare(l)} title="Compartir enlace"
                    className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-black/[0.05] transition-colors">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(l)} title="Eliminar la lista"
                    className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Alta / edición de campaña (el correo que se envía) ─── */
function CampaignFormModal({
  open, base, campaign, senderAddress, defaultSenderName, onClose, onSaved,
}: {
  open: boolean;
  base: string;
  campaign: Campaign | null;
  senderAddress: string;
  defaultSenderName: string;
  onClose: () => void;
  onSaved: (id?: number) => Promise<void> | void;
}) {
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [footerHtml, setFooterHtml] = useState('');
  const [attachments, setAttachments] = useState<{ filename: string; content: string; size: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Al abrir, se carga el contenido real de la campaña (el listado no trae el cuerpo completo).
  useEffect(() => {
    if (!open) return;
    setError('');
    if (!campaign) {
      setFromName(defaultSenderName || 'GCC World');
      setSubject(''); setBodyHtml(''); setFooterHtml(''); setAttachments([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${base}/campaigns/${campaign.id}`);
        const { data } = await res.json();
        setFromName(displayNameOf(data.from_email) || defaultSenderName || 'GCC World');
        setSubject(data.subject || '');
        setBodyHtml(data.body_html || '');
        setFooterHtml(data.footer_html || '');
        setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      } catch { toast.error('Error al abrir la campaña'); }
    })();
  }, [open, campaign, base, defaultSenderName]);

  const save = async () => {
    if (!subject.trim()) { setError('El asunto es requerido'); return; }
    setSaving(true); setError('');
    try {
      const payload = { from_name: fromName, subject: subject.trim(), body_html: bodyHtml, footer_html: footerHtml, attachments };
      const res = await fetch(campaign ? `${base}/campaigns/${campaign.id}` : `${base}/campaigns`, {
        method: campaign ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al guardar');
      toast.success(campaign ? 'Campaña actualizada' : 'Campaña creada');
      await onSaved(d.data?.id);
      onClose();
    } catch (e: any) { setError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const vars = usedVariables(subject, bodyHtml, footerHtml);

  return (
    <PixelModal open={open} onClose={() => !saving && onClose()} title={campaign ? 'Editar el correo' : 'Nueva campaña'} size="lg" busy={saving}>
      <div className="space-y-4">
        <div>
          <PixelInput label="Nombre del remitente" value={fromName} onChange={(e) => setFromName(e.target.value)}
            placeholder="Ej: Helen Cárdenas" />
          <div className="flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-md border border-digi-border bg-digi-darker/40">
            <Mail className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-[12px] text-digi-muted" style={mf}>
              Se envía desde <span className="text-digi-text">{senderAddress || 'la cuenta corporativa'}</span> · la dirección no se puede cambiar
            </span>
          </div>
        </div>

        <SubjectField value={subject} onChange={setSubject} placeholder="Asunto del correo" />
        <HtmlEditor label="Cuerpo del correo" value={bodyHtml} onChange={setBodyHtml} rows={12}
          placeholder="Escribe el contenido del correo…" />
        <HtmlEditor label="Pie del correo" value={footerHtml} onChange={setFooterHtml} rows={5}
          placeholder="Pie de página del correo…" />

        {vars.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-accent/30 bg-accent-light/40">
            <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-px" />
            <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>
              Este correo usa {vars.map((v) => CONTACT_VARIABLES.find((x) => x.key === v)?.label).join(', ')}.
              Si algún contacto no tiene ese dato, ahí llegará vacío.
            </p>
          </div>
        )}

        <AttachmentsManager attachments={attachments} onChange={setAttachments} />

        {error && <p className="text-[12px] text-red-400" style={mf}>{error}</p>}

        <PanelFooter align="end">
          <button onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
          <button onClick={save} disabled={saving} className={BTN_PRIMARY}>
            {saving ? 'Guardando…' : campaign ? 'Guardar' : 'Crear campaña'}
          </button>
        </PanelFooter>
      </div>
    </PixelModal>
  );
}

/* ─── Alta / renombrar lista ─── */
function ListNameModal({
  open, base, list, onClose, onSaved,
}: {
  open: boolean; base: string; list: ContactList | null;
  onClose: () => void; onSaved: (id?: number) => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setName(list?.name || ''); }, [open, list]);

  const save = async () => {
    if (!name.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const res = await fetch(list ? `${base}/contact-lists/${list.id}` : `${base}/contact-lists`, {
        method: list ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al guardar');
      toast.success(list ? 'Lista renombrada' : 'Lista creada');
      await onSaved(d.data?.id);
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <PixelModal open={open} onClose={() => !saving && onClose()} title={list ? 'Renombrar lista' : 'Nueva lista'} size="sm" busy={saving}>
      <div className="space-y-3">
        <PixelInput label="Nombre de la lista" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Escuelas de Guayaquil" />
        <PanelFooter align="end">
          <button onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
          <button onClick={save} disabled={saving} className={BTN_PRIMARY}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </PanelFooter>
      </div>
    </PixelModal>
  );
}

/* ─── Alta / edición de contacto (los 4 campos de las variables) ─── */
function ContactFormModal({
  open, base, listId, contact, onClose, onSaved,
}: {
  open: boolean; base: string; listId: number | null; contact: Contact | null;
  onClose: () => void; onSaved: () => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(contact?.name || '');
    setEmail(contact?.email || '');
    setPosition(contact?.position || '');
    setPhone(contact?.phone || '');
  }, [open, contact]);

  const save = async () => {
    if (listId == null) return;
    if (!name.trim()) { toast.error('El nombre es requerido'); return; }
    if (!email.trim() && !phone.trim()) { toast.error('Hace falta el correo o el teléfono'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), email: email.trim(), phone: phone.trim(), position: position.trim() };
      const res = await fetch(
        contact ? `${base}/contact-lists/${listId}/contacts/${contact.id}` : `${base}/contact-lists/${listId}/contacts`,
        { method: contact ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al guardar');
      toast.success(contact ? 'Contacto actualizado' : 'Contacto agregado');
      await onSaved();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <PixelModal open={open} onClose={() => !saving && onClose()} title={contact ? 'Editar contacto' : 'Nuevo contacto'} size="md" busy={saving}>
      <div className="space-y-3">
        <p className="text-[12px] text-digi-muted" style={mf}>
          Estos cuatro datos son los que se pueden insertar como variables en el correo.
        </p>
        <PixelInput label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: María López" />
        <PixelInput label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@ejemplo.com" />
        <PixelInput label="Puesto" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Ej: Directora" />
        <PixelInput label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+593 99 888 1234" />
        <PanelFooter align="end">
          <button onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
          <button onClick={save} disabled={saving} className={BTN_PRIMARY}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </PanelFooter>
      </div>
    </PixelModal>
  );
}

/* ─── Compartir la lista por enlace público ─── */
function ShareListModal({
  base, list, onClose, onChanged,
}: {
  base: string; list: ContactList | null; onClose: () => void; onChanged: () => Promise<void> | void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!list) { setUrl(null); setCopied(false); setConfirmRevoke(false); return; }
    setUrl(list.share_token ? `${window.location.origin}/lista-contactos/${list.share_token}` : null);
    setCopied(false);
    setConfirmRevoke(false);
  }, [list]);

  const generate = async () => {
    if (!list) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/contact-lists/${list.id}/share`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al generar el enlace');
      setUrl(d.data.token ? `${window.location.origin}/lista-contactos/${d.data.token}` : d.data.url);
      setConfirmRevoke(false);
      await onChanged();
      toast.success('Enlace listo para compartir');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!list) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/contact-lists/${list.id}/share`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al revocar');
      setUrl(null); setConfirmRevoke(false);
      await onChanged();
      toast.success('Enlace revocado');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error('No se pudo copiar'); }
  };

  return (
    <PixelModal open={!!list} onClose={onClose} title="Compartir la lista" size="md" busy={busy}>
      <div className="space-y-4">
        <div>
          <p className="text-[13px] text-digi-text" style={mf}>Lista <span className="font-medium">{list?.name}</span></p>
          <p className="text-[12.5px] text-digi-muted leading-relaxed mt-1" style={mf}>
            Con este enlace una persona <span className="text-digi-text font-medium">sin cuenta</span> puede agregar,
            editar y quitar contactos de esta lista. No verá el flujo, las campañas ni las demás listas, y no podrá
            importar archivos: solo los agrega a mano.
          </p>
        </div>

        {!url ? (
          <div className="rounded-lg border border-digi-border bg-digi-darker/40 px-3 py-4 text-center">
            <Share2 className="w-5 h-5 text-digi-muted mx-auto mb-2" />
            <p className="text-[12.5px] text-digi-muted mb-3" style={mf}>Esta lista todavía no tiene enlace público.</p>
            <button onClick={generate} disabled={busy} className={BTN_PRIMARY}>
              <Link2 className="w-4 h-4" /> {busy ? 'Generando…' : 'Generar enlace'}
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className={LABEL}>Enlace para compartir</label>
              <div className="flex gap-2">
                <input value={url} readOnly onFocus={(e) => e.currentTarget.select()} className={`${FIELD} flex-1 text-accent`} style={mf} />
                <button onClick={copy} className={BTN_PRIMARY}>
                  {copied ? <><Check className="w-4 h-4" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar</>}
                </button>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mt-1.5" style={mf}>
                <ExternalLink className="w-3.5 h-3.5" /> Abrir la página como la verá esa persona
              </a>
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-amber-500/40 bg-amber-500/10">
              <ShieldOff className="w-4 h-4 text-amber-400 shrink-0 mt-px" />
              <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>
                Cualquiera con el enlace entra sin identificarse, así que <span className="font-medium">solo compártelo
                con quien deba llenar la lista</span> y revócalo cuando termine.
              </p>
            </div>

            {confirmRevoke ? (
              <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-3">
                <p className="text-[12.5px] text-digi-text" style={mf}>
                  Al revocar, el enlace deja de funcionar de inmediato. Los contactos ya agregados se quedan en la lista.
                </p>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={revoke} disabled={busy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-red-500/40 rounded text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                    <ShieldOff className="w-4 h-4" /> {busy ? 'Revocando…' : 'Sí, revocar'}
                  </button>
                  <button onClick={() => setConfirmRevoke(false)} className={BTN_SECONDARY}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-digi-border">
                <button onClick={generate} disabled={busy} className={BTN_SECONDARY} title="Genera otro enlace; el actual deja de servir">
                  <RefreshCw className="w-4 h-4" /> Generar uno nuevo
                </button>
                <button onClick={() => setConfirmRevoke(true)} disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-red-500/40 rounded text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                  <ShieldOff className="w-4 h-4" /> Revocar enlace
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PixelModal>
  );
}

/* ─── Previsualizar y enviar ─── */
function SendCampaignModal({
  base, campaign, senderAddress, onClose, onSent,
}: {
  base: string; campaign: Campaign | null; senderAddress: string;
  onClose: () => void; onSent: () => Promise<void> | void;
}) {
  const [full, setFull] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  useEffect(() => {
    if (!campaign) { setFull(null); setResult(null); return; }
    setResult(null);
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${base}/campaigns/${campaign.id}`);
        const { data } = await res.json();
        setFull(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [campaign, base]);

  const send = async () => {
    if (!campaign) return;
    setSending(true);
    try {
      const res = await fetch(`${base}/campaigns/${campaign.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al enviar');
      setResult({ sent: d.sent, failed: d.failed, total: d.total });
      await onSent();
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const vars = full ? usedVariables(full.subject, full.body_html, full.footer_html) : [];

  return (
    <PixelModal open={!!campaign} onClose={() => !sending && onClose()} title="Previsualizar y enviar" size="lg" busy={sending}>
      <div className="space-y-4">
        {result ? (
          <>
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-green-400" strokeWidth={3} />
              </div>
              <p className="text-[26px] font-semibold text-digi-text tabular-nums" style={mf}>{result.sent}/{result.total}</p>
              <p className="text-[12px] text-digi-muted mt-1" style={mf}>correos enviados correctamente</p>
              {result.failed > 0 && <p className="text-[13px] text-red-400 mt-2" style={mf}>{result.failed} fallidos</p>}
            </div>
            <PanelFooter align="end">
              <button onClick={onClose} className={BTN_PRIMARY}>Cerrar</button>
            </PanelFooter>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] text-digi-muted mb-0.5" style={mf}>Remitente</span>
                <span className="text-[13px] text-digi-text" style={mf}>
                  {displayNameOf(full?.from_email) || 'GCC World'}
                  <span className="text-digi-muted"> &lt;{senderAddress}&gt;</span>
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-digi-muted mb-0.5" style={mf}>Destinatarios</span>
                <span className="text-[13px] text-digi-text" style={mf}>
                  {campaign?.total_contacts} · {(campaign?.lists || []).map((l) => l.name).join(', ') || 'sin listas'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="block text-[11px] text-digi-muted mb-0.5" style={mf}>Asunto</span>
                <span className="text-[13px] font-medium text-digi-text" style={mf}>{full?.subject}</span>
              </div>
              {campaign?.status === 'sent' && (
                <div className="col-span-2"><PixelBadge variant="warning">Reenvío</PixelBadge></div>
              )}
            </div>

            {vars.length > 0 && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-accent/30 bg-accent-light/40">
                <Eye className="w-4 h-4 text-accent shrink-0 mt-px" />
                <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>
                  La vista previa usa datos de ejemplo. Al enviar, cada correo lleva los de su
                  destinatario ({vars.map((v) => CONTACT_VARIABLES.find((x) => x.key === v)?.label).join(', ')}).
                </p>
              </div>
            )}

            <div>
              <span className="block text-[11px] text-digi-muted mb-1.5" style={mf}>Previsualización</span>
              {loading ? (
                <div className="flex justify-center py-8"><BrandLoader size="sm" label="Cargando…" /></div>
              ) : full ? (
                <div className="border border-digi-border rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={buildPreviewHtml(
                      previewTemplate(full.body_html || ''), previewTemplate(full.footer_html || ''),
                    )}
                    className="w-full bg-white"
                    style={{ height: '340px', border: 'none' }}
                    sandbox="allow-same-origin"
                    title="Previsualización del correo"
                  />
                </div>
              ) : (
                <PanelEmpty Icon={Mail} title="No se pudo cargar la previsualización" />
              )}
            </div>

            <PanelFooter align="end">
              <button onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
              <button onClick={send} disabled={sending || loading || !campaign?.total_contacts} className={BTN_PRIMARY}>
                <Send className="w-4 h-4" />
                {sending ? 'Enviando…' : `Enviar a ${campaign?.total_contacts} contactos`}
              </button>
            </PanelFooter>
          </>
        )}
      </div>
    </PixelModal>
  );
}

/* ─── Estadísticas ─── */
function StatsModal({ stats, onClose }: { stats: CampaignStats | null; onClose: () => void }) {
  const SV: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    pending: 'default', sent: 'success', delivered: 'success', bounced: 'warning', failed: 'error',
  };
  return (
    <PixelModal open={!!stats} onClose={onClose} title="Estadísticas del envío" size="lg">
      {stats && (
        <div>
          <p className="text-[13px] text-digi-text mb-3" style={mf}>{stats.campaign?.subject}</p>
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
                <PixelBadge variant={SV[s.status] || 'default'}>{SEND_STATUS_L[s.status] || s.status}</PixelBadge>
              ) },
              { key: 'error', header: 'Error', hideOnMobile: true, render: (s: any) => (
                <span className="text-[12px] text-red-400 truncate max-w-[200px] inline-block" style={mf}>{s.error_message || '—'}</span>
              ) },
            ]}
            data={stats.sends}
            emptyTitle="Sin envíos"
            emptyDesc="No hay registros de envío para esta campaña."
          />
        </div>
      )}
    </PixelModal>
  );
}
