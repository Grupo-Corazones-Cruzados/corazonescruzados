'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;
const CANCEL_CLS = 'px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-white transition-colors';

interface Flow { id: number; name: string; type: string; description: string; config: Record<string, any>; }
interface Agent { id: number; flow_id: number; name: string; description: string; ai_provider: string; ai_model: string; wait_seconds: number; status: string; knowledge_count: number; conversation_count: number; created_at: string; }
interface KnowledgeFile { id: number; filename: string; file_type: string; file_size: number; created_at: string; }
interface QaList { id: number; name: string; selected: boolean; item_count: number; created_at: string; }
interface QaItem { id: number; question: string; answer: string; }
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
    if (!confirm(`Eliminar agente "${agent.name}"?`)) return;
    await fetch(`/api/admin/flows/${flow.id}/agents/${agent.id}`, { method: 'DELETE' });
    fetchAgents();
  };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-4xl bg-digi-darker border-l-2 border-digi-border overflow-y-auto animate-[slideInRight_0.3s_ease-out]">
        <div className="sticky top-0 z-10 bg-digi-darker border-b-2 border-digi-border px-6 py-4 flex items-center gap-4">
          <button onClick={onClose} className="text-digi-muted hover:text-white transition-colors" style={pf}>&lt; Volver</button>
          <div className="flex-1">
            <h2 className="pixel-heading text-sm text-white">{flow.name}</h2>
            <p className="text-[10px] text-digi-muted mt-0.5" style={mf}>Chatbot via YCloud</p>
          </div>
        </div>

        <div className="p-6">
          {!configSaved ? (
            <div>
              <h3 className="pixel-heading text-xs text-white mb-1">Configurar YCloud API</h3>
              <p className="text-[9px] text-digi-muted mb-4" style={mf}>Ingresa tu API key de YCloud para conectarte a WhatsApp Business.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] text-digi-muted mb-1" style={pf}>YCloud API Key <span className="text-red-400">*</span></label>
                  <input value={yCloudKey} onChange={e => setYCloudKey(e.target.value)} type="password" placeholder="Tu API key de YCloud"
                    className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
                <div className="flex justify-end pt-4 border-t-2 border-digi-border">
                  <button onClick={handleSaveConfig} disabled={savingConfig || !yCloudKey.trim()} className="pixel-btn-primary px-6 py-2 text-[9px]" style={pf}>
                    {savingConfig ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          ) : view === 'agents' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="pixel-heading text-xs text-white">Agentes</h3>
                <div className="flex gap-2">
                  <button onClick={() => setConfigSaved(false)} className="px-3 py-1.5 text-[9px] border border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Config API</button>
                  <button onClick={() => setView('create-agent')} className="pixel-btn-primary px-3 py-1.5 text-[9px]" style={pf}>+ Crear Agente</button>
                </div>
              </div>

              {loading ? <div className="flex justify-center py-12"><BrandLoader size="md" /></div> : (
                <PixelDataTable
                  columns={[
                    { key: 'name', header: 'Nombre', render: (a: Agent) => <span className="text-white">{a.name}</span> },
                    { key: 'provider', header: 'IA', render: (a: Agent) => <span className="text-accent-glow">{a.ai_provider}</span> },
                    { key: 'knowledge', header: 'Archivos', render: (a: Agent) => String(a.knowledge_count) },
                    { key: 'convs', header: 'Chats', render: (a: Agent) => String(a.conversation_count) },
                    { key: 'wait', header: 'Espera', render: (a: Agent) => (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input type="number" min={1} max={60} value={a.wait_seconds}
                          onChange={e => handleUpdateWaitSeconds(a, parseInt(e.target.value) || 8)}
                          className="w-12 px-1 py-0.5 bg-digi-darker border border-digi-border text-xs text-digi-text text-center focus:border-accent focus:outline-none" style={mf} />
                        <span className="text-[8px] text-digi-muted" style={pf}>seg</span>
                      </div>
                    )},
                    { key: 'status', header: 'Estado', render: (a: Agent) => (
                      <PixelBadge variant={a.status === 'active' ? 'success' : 'warning'}>{a.status === 'active' ? 'Activo' : 'Pausado'}</PixelBadge>
                    )},
                    { key: 'actions', header: '', width: '180px', render: (a: Agent) => (
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleToggleAgent(a)} className={`px-2 py-0.5 text-[8px] border transition-colors ${a.status === 'active' ? 'border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20' : 'border-green-700/50 text-green-400 hover:bg-green-900/20'}`} style={pf}>
                          {a.status === 'active' ? 'Pausar' : 'Activar'}
                        </button>
                        <button onClick={() => { setSelectedAgent(a); setView('agent-detail'); }} className="px-2 py-0.5 text-[8px] border border-accent/50 text-accent-glow hover:bg-accent/10 transition-colors" style={pf}>Ver</button>
                        <button onClick={() => handleDeleteAgent(a)} className="px-2 py-0.5 text-[8px] border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors" style={pf}>X</button>
                      </div>
                    )},
                  ]}
                  data={agents}
                  onRowClick={(a) => { setSelectedAgent(a as Agent); setView('agent-detail'); }}
                  emptyTitle="Sin agentes"
                  emptyDesc="Crea tu primer agente chatbot."
                />
              )}
            </div>
          ) : view === 'create-agent' ? (
            <CreateAgentWizard flowId={flow.id} onDone={() => { setView('agents'); fetchAgents(); }} onCancel={() => setView('agents')} />
          ) : view === 'agent-detail' && selectedAgent ? (
            <AgentDetail flowId={flow.id} agent={selectedAgent} appUrl={appUrl} onBack={() => { setView('agents'); setSelectedAgent(null); fetchAgents(); }} />
          ) : null}
        </div>
      </div>
    </div>
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
        if (file.size > 10 * 1024 * 1024) { alert(`${file.name} supera 10MB`); continue; }
        const text = await file.text();
        setKnowledgeFiles(prev => [...prev, { filename: file.name, content: text, file_type: file.type || 'text/plain', file_size: file.size }]);
      }
    } catch { alert('Error al leer archivo'); }
    finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSaveStep1 = async () => {
    if (!name.trim()) { setError('Nombre requerido'); return; }
    if (!aiApiKey.trim()) { setError('API key de IA requerida'); return; }
    setSaving(true); setError('');
    try {
      // Create agent
      const res = await fetch(`/api/admin/flows/${flowId}/agents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), ai_provider: aiProvider, ai_api_key: aiApiKey.trim(), ai_model: aiModel, wait_seconds: waitSeconds }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error'); return; }
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
    } catch { setError('Error de conexion'); }
    finally { setSaving(false); }
  };

  const handleAddQa = () => {
    if (!newQ.trim() || !newA.trim()) return;
    setQaItems(prev => [...prev, { question: newQ.trim(), answer: newA.trim() }]);
    setNewQ(''); setNewA('');
  };

  const handleSaveStep2 = async () => {
    if (!agentId) return;
    if (qaItems.length > 0 && !qaListName.trim()) { setError('Nombre de lista requerido'); return; }
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
    } catch { setError('Error'); }
    finally { setSaving(false); }
  };

  const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onCancel} className="text-digi-muted hover:text-white text-[9px] transition-colors" style={pf}>&lt; Agentes</button>
        <div className="flex-1 flex items-center gap-2 justify-center">
          <StepDot num={1} active={step === 1} done={step > 1} label="Config" />
          <div className={`w-8 h-0.5 ${step > 1 ? 'bg-accent' : 'bg-digi-border'}`} />
          <StepDot num={2} active={step === 2} done={false} label="Q&A" />
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="pixel-heading text-xs text-white">Configuracion del Agente</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Nombre <span className="text-red-400">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Soporte Ventas"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
            </div>
            <div>
              <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Espera (seg)</label>
              <input type="number" min={1} max={60} value={waitSeconds} onChange={e => setWaitSeconds(parseInt(e.target.value) || 8)}
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
            </div>
          </div>
          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Descripcion / Proposito del chatbot</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Ej: Asistente de ventas para una tienda de ropa. Ayuda a los clientes con precios, tallas y disponibilidad."
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>

          <div className="border-t-2 border-digi-border pt-4">
            <h4 className="pixel-heading text-[10px] text-white mb-3">Proveedor de IA</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Proveedor</label>
                <select value={aiProvider} onChange={e => { setAiProvider(e.target.value); setAiModel(AI_PROVIDERS.find(p => p.value === e.target.value)?.models[0] || ''); }}
                  className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}>
                  {AI_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Modelo</label>
                <select value={aiModel} onChange={e => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}>
                  {currentProvider?.models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[9px] text-digi-muted mb-1" style={pf}>API Key de IA <span className="text-red-400">*</span></label>
              <input value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} type="password" placeholder="sk-..."
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
            </div>
          </div>

          <div className="border-t-2 border-digi-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="pixel-heading text-[10px] text-white">Archivos de Conocimiento</h4>
              <div>
                <input ref={fileInputRef} type="file" multiple accept=".txt,.csv,.json,.md,.pdf,.docx" onChange={handleUploadKnowledge} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                  className="px-3 py-1.5 text-[8px] border border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow transition-colors" style={pf}>
                  {uploadingFile ? 'Cargando...' : '+ Subir archivo'}
                </button>
              </div>
            </div>
            {knowledgeFiles.length > 0 ? (
              <div className="space-y-1">
                {knowledgeFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 border border-digi-border/50 text-xs" style={mf}>
                    <span className="text-accent-glow text-[9px]" style={pf}>FILE</span>
                    <span className="text-digi-text flex-1 truncate">{f.filename}</span>
                    <span className="text-digi-muted text-[9px]">{formatSize(f.file_size)}</span>
                    <button onClick={() => setKnowledgeFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400 text-[8px]" style={pf}>X</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-digi-muted text-center py-3" style={mf}>Sube archivos con informacion del negocio (.txt, .csv, .json, .md, .pdf)</p>
            )}
          </div>

          {error && <p className="text-xs text-red-400" style={mf}>{error}</p>}
          <div className="flex justify-end pt-4 border-t-2 border-digi-border">
            <button onClick={handleSaveStep1} disabled={saving} className="pixel-btn-primary px-6 py-2 text-[9px]" style={pf}>
              {saving ? 'Guardando...' : 'Siguiente >'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="pixel-heading text-xs text-white">Preguntas y Respuestas</h3>
          <p className="text-[9px] text-digi-muted" style={mf}>Define como debe responder el chatbot segun el contexto. Puedes omitir este paso si prefieres.</p>

          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Nombre de la lista Q&A</label>
            <input value={qaListName} onChange={e => setQaListName(e.target.value)} placeholder="Ej: FAQ General"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
          </div>

          {/* Add Q&A */}
          <div className="pixel-card p-3 space-y-2">
            <div>
              <label className="block text-[8px] text-digi-muted mb-0.5" style={pf}>Pregunta</label>
              <input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Ej: Cual es el horario de atencion?"
                className="w-full px-2 py-1.5 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
            </div>
            <div>
              <label className="block text-[8px] text-digi-muted mb-0.5" style={pf}>Respuesta</label>
              <textarea value={newA} onChange={e => setNewA(e.target.value)} rows={2} placeholder="Ej: Nuestro horario es de lunes a viernes de 8am a 5pm."
                className="w-full px-2 py-1.5 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
            </div>
            <button onClick={handleAddQa} className="pixel-btn-primary px-3 py-1.5 text-[8px]" style={pf}>+ Agregar</button>
          </div>

          {/* List */}
          {qaItems.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {qaItems.map((item, i) => (
                <div key={i} className="px-3 py-2 border border-digi-border/50 text-xs" style={mf}>
                  <div className="flex justify-between">
                    <span className="text-accent-glow font-medium">P:</span>
                    <button onClick={() => setQaItems(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400 text-[8px]" style={pf}>X</button>
                  </div>
                  <p className="text-digi-text mb-1">{item.question}</p>
                  <span className="text-green-400 font-medium">R:</span>
                  <p className="text-digi-muted">{item.answer}</p>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-400" style={mf}>{error}</p>}
          <div className="flex justify-between pt-4 border-t-2 border-digi-border">
            <button onClick={() => setStep(1)} className={CANCEL_CLS} style={pf}>&lt; Anterior</button>
            <button onClick={handleSaveStep2} disabled={saving} className="pixel-btn-primary px-6 py-2 text-[9px]" style={pf}>
              {saving ? 'Guardando...' : qaItems.length > 0 ? 'Guardar Agente' : 'Omitir y Finalizar'}
            </button>
          </div>
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

  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" /></div>;

  const TABS = [
    { value: 'conversations', label: `Conversaciones (${conversations.length})` },
    { value: 'knowledge', label: `Conocimiento (${knowledge.length})` },
    { value: 'qa', label: `Q&A (${qaLists.length})` },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-digi-muted hover:text-white text-[9px] transition-colors" style={pf}>&lt; Agentes</button>
        <div className="flex-1">
          <h3 className="pixel-heading text-xs text-white">{agent.name}</h3>
          <p className="text-[9px] text-digi-muted" style={mf}>{agent.description || 'Sin descripcion'}</p>
        </div>
        <PixelBadge variant={agent.status === 'active' ? 'success' : 'warning'}>{agent.status}</PixelBadge>
      </div>

      {/* Webhook URL */}
      <div className="pixel-card p-3 mb-4">
        <label className="block text-[8px] text-digi-muted mb-1" style={pf}>Webhook URL (configurar en YCloud)</label>
        <div className="flex gap-2">
          <input value={webhookUrl} readOnly className="flex-1 px-2 py-1.5 bg-digi-darker border border-digi-border text-[10px] text-accent-glow focus:outline-none" style={mf} />
          <button onClick={() => navigator.clipboard.writeText(webhookUrl)} className="px-2 py-1 text-[8px] border border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Copiar</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value as any)}
            className={`px-3 py-1.5 text-[9px] border whitespace-nowrap transition-colors ${tab === t.value ? 'border-accent bg-accent/15 text-accent-glow' : 'border-digi-border text-digi-muted hover:text-digi-text'}`} style={pf}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Conversations */}
      {tab === 'conversations' && (
        <>
          <PixelDataTable
            columns={[
              { key: 'name', header: 'Contacto', render: (c: Conversation) => <span className="text-white">{c.contact_name || c.contact_phone}</span> },
              { key: 'phone', header: 'Telefono', render: (c: Conversation) => <span className="text-green-400">{c.contact_phone}</span> },
              { key: 'msgs', header: 'Mensajes', render: (c: Conversation) => String(c.message_count) },
              { key: 'last', header: 'Ultimo', render: (c: Conversation) => c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '-' },
              { key: 'paused', header: 'Estado', render: (c: Conversation) => (
                <PixelBadge variant={c.paused ? 'warning' : 'success'}>{c.paused ? 'Pausado' : 'Activo'}</PixelBadge>
              )},
              { key: 'actions', header: '', width: '120px', render: (c: Conversation) => (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleTogglePause(c)}
                    className={`px-2 py-0.5 text-[8px] border transition-colors ${c.paused ? 'border-green-700/50 text-green-400 hover:bg-green-900/20' : 'border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20'}`} style={pf}>
                    {c.paused ? 'Reanudar' : 'Pausar'}
                  </button>
                  <button onClick={() => handleViewMessages(c)} className="px-2 py-0.5 text-[8px] border border-accent/50 text-accent-glow hover:bg-accent/10 transition-colors" style={pf}>Chat</button>
                </div>
              )},
            ]}
            data={conversations}
            emptyTitle="Sin conversaciones"
            emptyDesc="Las conversaciones aparecen cuando los clientes envian mensajes."
          />

          {/* Message viewer modal */}
          <PixelModal open={!!selectedConv} onClose={() => setSelectedConv(null)} title={`Chat: ${selectedConv?.conversation?.contact_name || selectedConv?.conversation?.contact_phone}`} size="lg">
            <div className="space-y-2 max-h-96 overflow-y-auto p-2" style={{ background: '#0b141a' }}>
              {selectedConv?.messages?.length === 0 ? (
                <p className="text-center text-[9px] text-digi-muted py-4" style={pf}>Sin mensajes</p>
              ) : selectedConv?.messages?.map((m: any, i: number) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${m.role === 'user' ? 'bg-[#1f2c34] text-gray-200' : 'bg-[#005c4b] text-white'}`} style={{ fontFamily: 'sans-serif' }}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className="text-[9px] text-gray-500 mt-1 text-right">{new Date(m.created_at).toLocaleTimeString()}</p>
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
          columns={[
            { key: 'name', header: 'Archivo', render: (k: KnowledgeFile) => <span className="text-white">{k.filename}</span> },
            { key: 'type', header: 'Tipo', render: (k: KnowledgeFile) => k.file_type },
            { key: 'size', header: 'Tamano', render: (k: KnowledgeFile) => k.file_size < 1024 ? `${k.file_size} B` : `${(k.file_size / 1024).toFixed(1)} KB` },
            { key: 'date', header: 'Fecha', render: (k: KnowledgeFile) => new Date(k.created_at).toLocaleDateString() },
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
            <div className="pixel-card text-center py-8">
              <p className="text-[9px] text-digi-muted" style={pf}>Sin listas Q&A</p>
            </div>
          ) : qaLists.map(list => (
            <div key={list.id} className={`border-2 px-4 py-3 flex items-center gap-3 ${list.selected ? 'border-accent bg-accent/5' : 'border-digi-border'}`}>
              <div className="flex-1">
                <span className="text-sm text-white" style={mf}>{list.name}</span>
                <span className="text-[9px] text-digi-muted ml-2" style={pf}>{list.item_count} preguntas</span>
              </div>
              <button onClick={() => handleSelectQaList(list)}
                className={`px-3 py-1 text-[8px] border transition-colors ${list.selected ? 'border-accent bg-accent/20 text-accent-glow' : 'border-digi-border text-digi-muted hover:border-accent hover:text-accent-glow'}`} style={pf}>
                {list.selected ? 'Activa' : 'Seleccionar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Step Dot ─── */
function StepDot({ num, active, done, label }: { num: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-7 h-7 flex items-center justify-center text-[10px] border-2 transition-colors ${active ? 'border-accent bg-accent/20 text-accent-glow' : done ? 'border-green-600 bg-green-900/20 text-green-400' : 'border-digi-border text-digi-muted'}`} style={pf}>
        {done ? '✓' : num}
      </div>
      <span className={`text-[8px] ${active ? 'text-accent-glow' : 'text-digi-muted'}`} style={pf}>{label}</span>
    </div>
  );
}
