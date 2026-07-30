'use client';

/**
 * ChatbotFlowPanel — editor del flujo de CHATBOT (agentes de IA sobre YCloud/WhatsApp:
 * configuración, archivos de conocimiento, listas de preguntas y respuestas, y las
 * conversaciones). Estilo Fluent `.corp`; overlay, cabecera, pasos y controles
 * compartidos en `FlowPanelUI`.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelTabs from '@/components/ui/PixelTabs';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import {
  FlowPanelShell, PanelSubHeader, SectionBar, PanelFooter, Steps, FileRow,
  PanelEmpty, FIELD, FIELD_SM, LABEL, BTN_ROW, BTN_ROW_DANGER, formatSize,
} from '@/components/dashboard/flows/FlowPanelUI';
import {
  Bot, Plus, Play, Pause, Trash2, KeyRound, Upload, MessageSquare, Check, Copy,
  ChevronRight, Eye, HelpCircle, FileText, BookOpen,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Flow { id: number; name: string; type: string; description: string; config: Record<string, any>; }
interface Agent { id: number; flow_id: number; name: string; description: string; ai_provider: string; ai_model: string; wait_seconds: number; status: string; knowledge_count: number; conversation_count: number; created_at: string; }
interface KnowledgeFile { id: number; filename: string; file_type: string; file_size: number; created_at: string; }
interface QaList { id: number; name: string; selected: boolean; item_count: number; created_at: string; }
interface Conversation { id: number; contact_phone: string; contact_name: string; paused: boolean; message_count: number; last_message_at: string; }

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'anthropic', label: 'Anthropic (Claude)', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'] },
];

export default function ChatbotFlowPanel({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  const [yCloudKey, setYCloudKey] = useState(flow.config?.ycloud_api_key || '');
  const [configSaved, setConfigSaved] = useState(!!flow.config?.ycloud_api_key);
  const [savingConfig, setSavingConfig] = useState(false);

  const [view, setView] = useState<'agents' | 'create-agent' | 'agent-detail'>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [confirmDeleteAgent, setConfirmDeleteAgent] = useState<Agent | null>(null);

  const fetchAgents = useCallback(async () => {
    try { const res = await fetch(`/api/admin/flows/${flow.id}/agents`); const data = await res.json(); setAgents(data.data || []); }
    catch { /* */ } finally { setLoading(false); }
  }, [flow.id]);

  useEffect(() => { if (configSaved) fetchAgents(); else setLoading(false); }, [configSaved, fetchAgents]);

  const handleSaveConfig = async () => {
    if (!yCloudKey.trim()) return;
    setSavingConfig(true);
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { ...flow.config, ycloud_api_key: yCloudKey.trim() } }),
      });
      if (res.ok) setConfigSaved(true);
    } catch { /* */ } finally { setSavingConfig(false); }
  };

  const handleUpdateWaitSeconds = async (agent: Agent, seconds: number) => {
    await fetch(`/api/admin/flows/${flow.id}/agents/${agent.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wait_seconds: seconds }),
    });
    fetchAgents();
  };

  const handleToggleAgent = async (agent: Agent) => {
    await fetch(`/api/admin/flows/${flow.id}/agents/${agent.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: agent.status === 'active' ? 'paused' : 'active' }),
    });
    fetchAgents();
  };

  const handleDeleteAgent = async (agent: Agent) => {
    setConfirmDeleteAgent(null);
    await fetch(`/api/admin/flows/${flow.id}/agents/${agent.id}`, { method: 'DELETE' });
    fetchAgents();
  };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <FlowPanelShell Icon={Bot} title={flow.name} subtitle="Chatbot vía YCloud" onClose={onClose}>
      {!configSaved ? (
        <div>
          <SectionBar
            title="Configurar YCloud API"
            hint="Ingresa tu API key de YCloud para conectarte a WhatsApp Business."
          />
          <div className="rounded-lg border border-digi-border bg-digi-darker/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-accent" />
              <span className="text-[12px] text-digi-muted" style={mf}>Credenciales de YCloud</span>
            </div>
            <PixelInput label="YCloud API Key *" value={yCloudKey} onChange={e => setYCloudKey(e.target.value)}
              type="password" placeholder="Tu API key de YCloud" />
          </div>
          <div className="mt-4">
            <PanelFooter align="end">
              <button onClick={handleSaveConfig} disabled={savingConfig || !yCloudKey.trim()} className={BTN_PRIMARY}>
                {savingConfig ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </PanelFooter>
          </div>
        </div>
      ) : view === 'agents' ? (
        <div>
          <SectionBar title="Agentes" hint={agents.length ? `${agents.length} en total` : undefined}>
            <button onClick={() => setConfigSaved(false)} className={BTN_SECONDARY}>
              <KeyRound className="w-4 h-4" /> Credenciales
            </button>
            <button onClick={() => setView('create-agent')} className={BTN_PRIMARY}>
              <Plus className="w-4 h-4" /> Crear agente
            </button>
          </SectionBar>

          {loading ? <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando agentes…" /></div> : (
            <PixelDataTable
              singleLine
              columns={[
                { key: 'name', header: 'Nombre', render: (a: Agent) => (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-md bg-accent-light border border-accent/15 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-accent" />
                    </span>
                    <span className="block text-[13px] font-medium text-digi-text truncate" style={mf}>{a.name}</span>
                  </span>
                ) },
                { key: 'provider', header: 'IA', width: '150px', hideOnMobile: true, render: (a: Agent) => (
                  <span className="text-[12px] text-digi-text" style={mf}>
                    {AI_PROVIDERS.find(p => p.value === a.ai_provider)?.label || a.ai_provider}
                  </span>
                ) },
                { key: 'knowledge', header: 'Archivos', width: '80px', hideOnMobile: true, render: (a: Agent) => (
                  <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{a.knowledge_count}</span>
                ) },
                { key: 'convs', header: 'Chats', width: '70px', hideOnMobile: true, render: (a: Agent) => (
                  <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{a.conversation_count}</span>
                ) },
                { key: 'wait', header: 'Espera', width: '110px', render: (a: Agent) => (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <input type="number" min={1} max={60} value={a.wait_seconds}
                      onChange={e => handleUpdateWaitSeconds(a, parseInt(e.target.value) || 8)}
                      className={`${FIELD_SM} w-14 text-center tabular-nums`} style={mf} />
                    <span className="text-[11px] text-digi-muted" style={mf}>seg</span>
                  </div>
                ) },
                { key: 'status', header: 'Estado', width: '100px', render: (a: Agent) => (
                  <PixelBadge variant={a.status === 'active' ? 'success' : 'warning'}>{a.status === 'active' ? 'Activo' : 'Pausado'}</PixelBadge>
                ) },
                { key: 'actions', header: '', width: '190px', render: (a: Agent) => (
                  <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleToggleAgent(a)} className={BTN_ROW}>
                      {a.status === 'active' ? <><Pause className="w-3.5 h-3.5" /> Pausar</> : <><Play className="w-3.5 h-3.5" /> Activar</>}
                    </button>
                    <button onClick={() => { setSelectedAgent(a); setView('agent-detail'); }} className={BTN_ROW}>
                      <Eye className="w-3.5 h-3.5" /> Ver
                    </button>
                    <button onClick={() => setConfirmDeleteAgent(a)} className={BTN_ROW_DANGER} aria-label="Eliminar agente">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) },
              ]}
              data={agents}
              onRowClick={(a) => { setSelectedAgent(a as Agent); setView('agent-detail'); }}
              emptyTitle="Sin agentes"
              emptyDesc="Crea tu primer agente de chatbot."
            />
          )}
        </div>
      ) : view === 'create-agent' ? (
        <CreateAgentWizard flowId={flow.id} onDone={() => { setView('agents'); fetchAgents(); }} onCancel={() => setView('agents')} />
      ) : view === 'agent-detail' && selectedAgent ? (
        <AgentDetail flowId={flow.id} agent={selectedAgent} appUrl={appUrl} onBack={() => { setView('agents'); setSelectedAgent(null); fetchAgents(); }} />
      ) : null}

      <PixelConfirm
        open={confirmDeleteAgent !== null}
        title="Eliminar agente"
        message={`¿Eliminar el agente "${confirmDeleteAgent?.name ?? ''}"?`}
        confirmLabel="Sí, eliminar"
        danger
        onConfirm={() => { if (confirmDeleteAgent) handleDeleteAgent(confirmDeleteAgent); }}
        onCancel={() => setConfirmDeleteAgent(null)}
      />
    </FlowPanelShell>
  );
}

/* ─── Create Agent Wizard ─── */
function CreateAgentWizard({ flowId, onDone, onCancel }: { flowId: number; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(1);

  // Step 1: Agent info + AI + Knowledge
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [waitSeconds, setWaitSeconds] = useState(8);
  const [knowledgeFiles, setKnowledgeFiles] = useState<{ filename: string; content: string; file_type: string; file_size: number }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Q&A
  const [qaListName, setQaListName] = useState('');
  const [qaItems, setQaItems] = useState<{ question: string; answer: string }[]>([]);
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [agentId, setAgentId] = useState<number | null>(null);

  const currentProvider = AI_PROVIDERS.find(p => p.value === aiProvider);

  const handleUploadKnowledge = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadingFile(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} supera 10MB`); continue; }
        const text = await file.text();
        setKnowledgeFiles(prev => [...prev, { filename: file.name, content: text, file_type: file.type || 'text/plain', file_size: file.size }]);
      }
    } catch { toast.error('Error al leer el archivo'); }
    finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSaveStep1 = async () => {
    if (!name.trim()) { setError('El nombre es requerido'); return; }
    if (!aiApiKey.trim()) { setError('La API key de IA es requerida'); return; }
    setSaving(true); setError('');
    try {
      // Create agent
      const res = await fetch(`/api/admin/flows/${flowId}/agents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), ai_provider: aiProvider, ai_api_key: aiApiKey.trim(), ai_model: aiModel, wait_seconds: waitSeconds }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error al guardar'); return; }
      const { data: agent } = await res.json();
      setAgentId(agent.id);

      // Upload knowledge files
      for (const file of knowledgeFiles) {
        await fetch(`/api/admin/flows/${flowId}/agents/${agent.id}/knowledge`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(file),
        });
      }
      setStep(2);
    } catch { setError('Error de conexión'); }
    finally { setSaving(false); }
  };

  const handleAddQa = () => {
    if (!newQ.trim() || !newA.trim()) return;
    setQaItems(prev => [...prev, { question: newQ.trim(), answer: newA.trim() }]);
    setNewQ(''); setNewA('');
  };

  const handleSaveStep2 = async () => {
    if (!agentId) return;
    if (qaItems.length > 0 && !qaListName.trim()) { setError('El nombre de la lista es requerido'); return; }
    setSaving(true); setError('');
    try {
      if (qaItems.length > 0) {
        // Create Q&A list
        const listRes = await fetch(`/api/admin/flows/${flowId}/agents/${agentId}/qa-lists`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: qaListName.trim() }),
        });
        if (listRes.ok) {
          const { data: list } = await listRes.json();
          // Add items
          await fetch(`/api/admin/flows/${flowId}/agents/${agentId}/qa-lists/${list.id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(qaItems),
          });
          // Select this list
          await fetch(`/api/admin/flows/${flowId}/agents/${agentId}/qa-lists/${list.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selected: true }),
          });
        }
      }
      onDone();
    } catch { setError('Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PanelSubHeader onBack={onCancel} backLabel="Agentes" title="Nuevo agente">
        <Steps items={['Configuración', 'Preguntas']} current={step} />
      </PanelSubHeader>

      {step === 1 && (
        <div className="space-y-4">
          <SectionBar title="Configuración del agente" />

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_140px] gap-3">
            <PixelInput label="Nombre *" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Soporte Ventas" />
            <PixelInput label="Espera (seg)" type="number" min={1} max={60} value={waitSeconds}
              onChange={e => setWaitSeconds(parseInt(e.target.value) || 8)} />
          </div>

          <div>
            <label className={LABEL}>Descripción / propósito del chatbot</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Ej: Asistente de ventas para una tienda de ropa. Ayuda a los clientes con precios, tallas y disponibilidad."
              className={`${FIELD} resize-none`} style={mf} />
          </div>

          <div className="pt-4 border-t border-digi-border">
            <SectionBar title="Proveedor de IA" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PixelSelect label="Proveedor" value={aiProvider}
                onChange={e => { setAiProvider(e.target.value); setAiModel(AI_PROVIDERS.find(p => p.value === e.target.value)?.models[0] || ''); }}
                options={AI_PROVIDERS.map(p => ({ value: p.value, label: p.label }))} />
              <PixelSelect label="Modelo" value={aiModel} onChange={e => setAiModel(e.target.value)}
                options={(currentProvider?.models || []).map(m => ({ value: m, label: m }))} />
            </div>
            <div className="mt-3">
              <PixelInput label="API Key de IA *" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
                type="password" placeholder="sk-…" />
            </div>
          </div>

          <div className="pt-4 border-t border-digi-border">
            <SectionBar title="Archivos de conocimiento" hint="Información del negocio que el agente podrá consultar.">
              <input ref={fileInputRef} type="file" multiple accept=".txt,.csv,.json,.md,.pdf,.docx" onChange={handleUploadKnowledge} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className={BTN_SECONDARY}>
                <Upload className="w-4 h-4" /> {uploadingFile ? 'Cargando…' : 'Subir archivo'}
              </button>
            </SectionBar>
            {knowledgeFiles.length > 0 ? (
              <div className="space-y-1">
                {knowledgeFiles.map((f, i) => (
                  <FileRow key={i} name={f.filename} meta={formatSize(f.file_size)}
                    onRemove={() => setKnowledgeFiles(prev => prev.filter((_, idx) => idx !== i))} />
                ))}
              </div>
            ) : (
              <PanelEmpty Icon={BookOpen} title="Sin archivos de conocimiento"
                desc="Formatos admitidos: .txt, .csv, .json, .md, .pdf, .docx" />
            )}
          </div>

          {error && <p className="text-[12px] text-red-400" style={mf}>{error}</p>}
          <PanelFooter align="end">
            <button onClick={handleSaveStep1} disabled={saving} className={BTN_PRIMARY}>
              {saving ? 'Guardando…' : <>Siguiente <ChevronRight className="w-4 h-4" /></>}
            </button>
          </PanelFooter>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <SectionBar title="Preguntas y respuestas"
            hint="Define cómo debe responder el chatbot según el contexto. Puedes omitir este paso." />

          <PixelInput label="Nombre de la lista" value={qaListName} onChange={e => setQaListName(e.target.value)}
            placeholder="Ej: Preguntas frecuentes" />

          {/* Add Q&A */}
          <div className="rounded-lg border border-digi-border bg-digi-darker/40 p-3 space-y-2.5">
            <div>
              <label className={LABEL}>Pregunta</label>
              <input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Ej: ¿Cuál es el horario de atención?"
                className={FIELD} style={mf} />
            </div>
            <div>
              <label className={LABEL}>Respuesta</label>
              <textarea value={newA} onChange={e => setNewA(e.target.value)} rows={2}
                placeholder="Ej: Nuestro horario es de lunes a viernes de 8:00 a 17:00."
                className={`${FIELD} resize-none`} style={mf} />
            </div>
            <button onClick={handleAddQa} disabled={!newQ.trim() || !newA.trim()} className={BTN_SECONDARY}>
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>

          {/* List */}
          {qaItems.length > 0 ? (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {qaItems.map((item, i) => (
                <div key={i} className="rounded-lg border border-digi-border px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                    <p className="flex-1 text-[12.5px] font-medium text-digi-text" style={mf}>{item.question}</p>
                    <button onClick={() => setQaItems(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-digi-muted/70 hover:text-red-500 transition-colors shrink-0" aria-label="Quitar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[12px] text-digi-muted mt-1 pl-[22px]" style={mf}>{item.answer}</p>
                </div>
              ))}
            </div>
          ) : (
            <PanelEmpty Icon={HelpCircle} title="Sin preguntas" desc="Puedes finalizar sin agregar ninguna." />
          )}

          {error && <p className="text-[12px] text-red-400" style={mf}>{error}</p>}
          <PanelFooter>
            <button onClick={() => setStep(1)} className={BTN_SECONDARY}>
              <ChevronRight className="w-4 h-4 rotate-180" /> Anterior
            </button>
            <button onClick={handleSaveStep2} disabled={saving} className={BTN_PRIMARY}>
              {saving ? 'Guardando…' : qaItems.length > 0 ? 'Guardar agente' : 'Omitir y finalizar'}
            </button>
          </PanelFooter>
        </div>
      )}
    </div>
  );
}

/* ─── Agent Detail / Dashboard ─── */
function AgentDetail({ flowId, agent, appUrl, onBack }: { flowId: number; agent: Agent; appUrl: string; onBack: () => void }) {
  const [tab, setTab] = useState<'conversations' | 'knowledge' | 'qa'>('conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeFile[]>([]);
  const [qaLists, setQaLists] = useState<QaList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<{ conversation: any; messages: any[] } | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${appUrl}/api/webhooks/chatbot/${agent.id}`;

  const fetchData = useCallback(async () => {
    try {
      const [convRes, knRes, qaRes] = await Promise.all([
        fetch(`/api/admin/flows/${flowId}/agents/${agent.id}/conversations`),
        fetch(`/api/admin/flows/${flowId}/agents/${agent.id}/knowledge`),
        fetch(`/api/admin/flows/${flowId}/agents/${agent.id}/qa-lists`),
      ]);
      const [convData, knData, qaData] = await Promise.all([convRes.json(), knRes.json(), qaRes.json()]);
      setConversations(convData.data || []);
      setKnowledge(knData.data || []);
      setQaLists(qaData.data || []);
    } catch { /* */ } finally { setLoading(false); }
  }, [flowId, agent.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTogglePause = async (conv: Conversation) => {
    await fetch(`/api/admin/flows/${flowId}/agents/${agent.id}/conversations/${conv.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: !conv.paused }),
    });
    fetchData();
  };

  const handleViewMessages = async (conv: Conversation) => {
    const res = await fetch(`/api/admin/flows/${flowId}/agents/${agent.id}/conversations/${conv.id}`);
    const data = await res.json();
    setSelectedConv(data);
  };

  const handleSelectQaList = async (list: QaList) => {
    await fetch(`/api/admin/flows/${flowId}/agents/${agent.id}/qa-lists/${list.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected: !list.selected }),
    });
    fetchData();
  };

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { toast.error('No se pudo copiar'); }
  };

  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando agente…" /></div>;

  const TABS = [
    { value: 'conversations', label: 'Conversaciones', count: conversations.length },
    { value: 'knowledge', label: 'Conocimiento', count: knowledge.length },
    { value: 'qa', label: 'Preguntas', count: qaLists.length },
  ];

  return (
    <div>
      <PanelSubHeader onBack={onBack} backLabel="Agentes" title={agent.name}
        subtitle={agent.description || 'Sin descripción'}>
        <PixelBadge variant={agent.status === 'active' ? 'success' : 'warning'}>
          {agent.status === 'active' ? 'Activo' : 'Pausado'}
        </PixelBadge>
      </PanelSubHeader>

      {/* Webhook URL */}
      <div className="rounded-lg border border-digi-border bg-digi-darker/40 p-3 mb-4">
        <label className={LABEL}>Webhook URL (configurar en YCloud)</label>
        <div className="flex gap-2">
          <input value={webhookUrl} readOnly className={`${FIELD_SM} flex-1 text-accent`} style={mf} />
          <button onClick={copyWebhook} className={BTN_ROW}>
            {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <PixelTabs tabs={TABS} active={tab} onChange={(v) => setTab(v as any)} />

      {/* Conversations */}
      {tab === 'conversations' && (
        <>
          <PixelDataTable
            singleLine
            columns={[
              { key: 'name', header: 'Contacto', render: (c: Conversation) => (
                <span className="text-[13px] font-medium text-digi-text" style={mf}>{c.contact_name || c.contact_phone}</span>
              ) },
              { key: 'phone', header: 'Teléfono', width: '150px', render: (c: Conversation) => (
                <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{c.contact_phone}</span>
              ) },
              { key: 'msgs', header: 'Mensajes', width: '90px', hideOnMobile: true, render: (c: Conversation) => (
                <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{c.message_count}</span>
              ) },
              { key: 'last', header: 'Último', width: '150px', hideOnMobile: true, render: (c: Conversation) => (
                <span className="text-[12px] text-digi-muted" style={mf}>{c.last_message_at ? new Date(c.last_message_at).toLocaleString('es-EC') : '—'}</span>
              ) },
              { key: 'paused', header: 'Estado', width: '100px', render: (c: Conversation) => (
                <PixelBadge variant={c.paused ? 'warning' : 'success'}>{c.paused ? 'Pausado' : 'Activo'}</PixelBadge>
              ) },
              { key: 'actions', header: '', width: '170px', render: (c: Conversation) => (
                <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleTogglePause(c)} className={BTN_ROW}>
                    {c.paused ? <><Play className="w-3.5 h-3.5" /> Reanudar</> : <><Pause className="w-3.5 h-3.5" /> Pausar</>}
                  </button>
                  <button onClick={() => handleViewMessages(c)} className={BTN_ROW}>
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                </div>
              ) },
            ]}
            data={conversations}
            emptyTitle="Sin conversaciones"
            emptyDesc="Las conversaciones aparecen cuando los clientes envían mensajes."
          />

          {/* Message viewer modal */}
          <PixelModal open={!!selectedConv} onClose={() => setSelectedConv(null)}
            title={`Chat con ${selectedConv?.conversation?.contact_name || selectedConv?.conversation?.contact_phone || ''}`} size="lg">
            <div className="space-y-2 max-h-96 overflow-y-auto p-3 rounded-lg" style={{ background: '#0b141a' }}>
              {selectedConv?.messages?.length === 0 ? (
                <p className="text-center text-[12px] text-gray-400 py-4" style={mf}>Sin mensajes</p>
              ) : selectedConv?.messages?.map((m: any, i: number) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${m.role === 'user' ? 'text-gray-200' : 'text-gray-100'}`}
                    style={{ background: m.role === 'user' ? '#1f2c34' : '#005c4b', fontFamily: 'sans-serif' }}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className="text-[10px] text-gray-400 mt-1 text-right">{new Date(m.created_at).toLocaleTimeString('es-EC')}</p>
                  </div>
                </div>
              ))}
            </div>
          </PixelModal>
        </>
      )}

      {/* Knowledge */}
      {tab === 'knowledge' && (
        <PixelDataTable
          singleLine
          columns={[
            { key: 'name', header: 'Archivo', render: (k: KnowledgeFile) => (
              <span className="flex items-center gap-2 min-w-0">
                <FileText className="w-3.5 h-3.5 text-digi-muted shrink-0" />
                <span className="block text-[13px] text-digi-text truncate" style={mf}>{k.filename}</span>
              </span>
            ) },
            { key: 'type', header: 'Tipo', width: '150px', hideOnMobile: true, render: (k: KnowledgeFile) => (
              <span className="text-[12px] text-digi-muted" style={mf}>{k.file_type}</span>
            ) },
            { key: 'size', header: 'Tamaño', width: '100px', render: (k: KnowledgeFile) => (
              <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{formatSize(k.file_size)}</span>
            ) },
            { key: 'date', header: 'Fecha', width: '110px', hideOnMobile: true, render: (k: KnowledgeFile) => (
              <span className="text-[12px] text-digi-muted" style={mf}>{new Date(k.created_at).toLocaleDateString('es-EC')}</span>
            ) },
          ]}
          data={knowledge}
          emptyTitle="Sin archivos"
          emptyDesc="Sube archivos de conocimiento al crear el agente."
        />
      )}

      {/* Q&A Lists */}
      {tab === 'qa' && (
        <div className="space-y-2">
          {qaLists.length === 0 ? (
            <PanelEmpty Icon={HelpCircle} title="Sin listas de preguntas" desc="Se crean al configurar el agente." />
          ) : qaLists.map(list => (
            <div key={list.id} className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 ${list.selected ? 'border-accent bg-accent-light/40' : 'border-digi-border'}`}>
              <HelpCircle className="w-4 h-4 text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-digi-text truncate" style={mf}>{list.name}</span>
                <span className="block text-[11px] text-digi-muted" style={mf}>{list.item_count} preguntas</span>
              </div>
              <button onClick={() => handleSelectQaList(list)}
                className={list.selected
                  ? 'inline-flex items-center gap-1 px-2 py-1 rounded border border-accent bg-accent text-white text-[12px] font-medium transition-colors'
                  : BTN_ROW}>
                {list.selected ? <><Check className="w-3.5 h-3.5" strokeWidth={3} /> Activa</> : 'Seleccionar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
