'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BrandLoader from '@/components/ui/BrandLoader';
import PixelBadge from '@/components/ui/PixelBadge';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', open: 'Abierto', in_progress: 'En Progreso', review: 'En Revision',
  completed: 'Completado', closed: 'Cerrado', cancelled: 'Cancelado', on_hold: 'En Espera',
};
const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', open: 'info', in_progress: 'warning', review: 'warning',
  completed: 'success', closed: 'success', cancelled: 'error', on_hold: 'default',
};
const SRI_LABEL: Record<string, string> = {
  generated: 'Generada', signed: 'Firmada', sent: 'Enviada al SRI',
  authorized: 'Autorizada', rejected: 'Rechazada', error: 'Error',
};
const SRI_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  generated: 'default', signed: 'info', sent: 'warning',
  authorized: 'success', rejected: 'error', error: 'error',
};

export default function PublicProjectPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/auth/me').then(r => {
      if (r.ok) setIsLoggedIn(true);
    }).catch(() => {});

    // Fetch public project data
    const url = `/api/projects/${id}/public${token ? `?token=${token}` : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); }
        else { setProject(d.data); }
      })
      .catch(() => setError('Error al cargar el proyecto'))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-digi-darker flex items-center justify-center">
        <BrandLoader size="lg" label="Cargando proyecto..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-digi-darker flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-white text-lg mb-2" style={pf}>{error}</h1>
          <p className="text-digi-muted text-sm" style={mf}>
            Este proyecto no esta disponible.
          </p>
          <Link href="/" className="inline-block mt-6 px-4 py-2 bg-accent text-white text-xs hover:bg-accent-hover transition-colors" style={pf}>
            Ir al Inicio
          </Link>
        </div>
      </div>
    );
  }

  const p = project;
  const completedReqs = p.requirements?.filter((r: any) => r.is_completed).length || 0;
  const totalReqs = p.requirements?.length || 0;
  const progressPct = totalReqs > 0 ? Math.round((completedReqs / totalReqs) * 100) : 0;

  const showBanner = !isLoggedIn && !bannerDismissed;

  return (
    <div className="min-h-screen bg-digi-darker text-digi-text">
      {/* Sticky Banner */}
      {showBanner && (
        <div className="sticky top-0 z-50 bg-accent/95 backdrop-blur-sm border-b border-accent-glow/30">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-white text-[10px] sm:text-xs flex-1" style={mf}>
              Crea una cuenta para aprovechar nuestras soluciones de automatizacion de procesos y encontrar a los profesionales que necesitas
            </p>
            <Link
              href="/auth?tab=register"
              className="shrink-0 px-3 py-1.5 bg-white text-accent text-[10px] font-bold hover:bg-accent-light transition-colors"
              style={pf}
            >
              Crear Cuenta
            </Link>
            <button
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 text-white/70 hover:text-white transition-colors p-1"
              aria-label="Cerrar banner"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-digi-border bg-digi-darker/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full overflow-hidden"
              style={{
                backgroundImage: 'url(/logo-spritesheet.png)',
                backgroundSize: '256px 256px',
                backgroundPositionY: '185px',
                backgroundPositionX: '-9.9px',
                imageRendering: 'auto',
              }}
            />
            <span className="text-white text-sm" style={pf}>GCC World</span>
          </Link>
          {isLoggedIn ? (
            <Link href="/dashboard" className="text-accent-glow text-[10px] hover:text-white transition-colors" style={pf}>
              Dashboard
            </Link>
          ) : (
            <Link href="/auth" className="text-accent-glow text-[10px] hover:text-white transition-colors" style={pf}>
              Iniciar Sesion
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Project Title & Status */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl text-white mb-2" style={pf}>{p.title}</h1>
              {p.description && (
                <p className="text-sm text-digi-muted leading-relaxed" style={mf}>{p.description}</p>
              )}
            </div>
            <PixelBadge variant={STATUS_V[p.status] || 'default'} className="shrink-0 text-[10px]">
              {STATUS_LABEL[p.status] || p.status}
            </PixelBadge>
          </div>

          {/* Project Meta */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {p.client_name && (
              <MetaCard label="Cliente" value={p.client_name} />
            )}
            {p.deadline && (
              <MetaCard label="Fecha Limite" value={new Date(p.deadline).toLocaleDateString('es-EC')} />
            )}
            {(p.budget_min || p.budget_max) && (
              <MetaCard
                label="Presupuesto"
                value={p.budget_min && p.budget_max
                  ? `$${Number(p.budget_min).toFixed(0)} - $${Number(p.budget_max).toFixed(0)}`
                  : p.final_cost ? `$${Number(p.final_cost).toFixed(2)}` : 'N/A'}
              />
            )}
            <MetaCard label="Creado" value={new Date(p.created_at).toLocaleDateString('es-EC')} />
          </div>
        </section>

        {/* Progress Bar */}
        {totalReqs > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-digi-muted" style={pf}>Progreso</span>
              <span className="text-[10px] text-accent-glow" style={pf}>{completedReqs}/{totalReqs} ({progressPct}%)</span>
            </div>
            <div className="h-2 bg-digi-card border border-digi-border overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </section>
        )}

        {/* Requirements */}
        {totalReqs > 0 && (
          <section>
            <h2 className="text-sm text-white mb-4" style={pf}>Requerimientos</h2>
            <div className="space-y-3">
              {p.requirements.map((req: any) => (
                <div key={req.id} className="border border-digi-border bg-digi-card p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-4 h-4 border-2 flex items-center justify-center shrink-0 ${req.is_completed ? 'border-green-500 bg-green-500/20' : 'border-digi-border'}`}>
                      {req.is_completed && (
                        <svg className="w-2.5 h-2.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs text-white" style={pf}>{req.title}</h3>
                      {req.description && (
                        <p className="text-[11px] text-digi-muted mt-1" style={mf}>{req.description}</p>
                      )}

                      {/* Sub-items */}
                      {req.items?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {req.items.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-2 text-[10px]" style={mf}>
                              <span className={item.is_completed ? 'text-green-400' : 'text-digi-muted'}>
                                {item.is_completed ? '■' : '□'}
                              </span>
                              <span className={item.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}>
                                {item.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Assigned members */}
                      {req.assignments?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {req.assignments.map((a: any, i: number) => (
                            <div key={i} className="flex items-center gap-1.5">
                              {a.photo_url ? (
                                <img src={a.photo_url} alt={a.member_name} className="w-5 h-5 rounded-full object-cover border border-digi-border" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-accent/30 border border-accent/50 flex items-center justify-center">
                                  <span className="text-[7px] text-accent-glow" style={pf}>
                                    {a.member_name?.charAt(0) || '?'}
                                  </span>
                                </div>
                              )}
                              <span className="text-[10px] text-digi-muted" style={mf}>{a.member_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {req.estimated_cost && (
                      <span className="text-[10px] text-accent-glow shrink-0" style={mf}>
                        ${Number(req.estimated_cost).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Team Members */}
        {p.participants?.length > 0 && (
          <section>
            <h2 className="text-sm text-white mb-4" style={pf}>Equipo del Proyecto</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {p.participants.map((m: any, i: number) => (
                <div key={i} className="border border-digi-border bg-digi-card p-3 flex flex-col items-center text-center">
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.member_name} className="w-12 h-12 rounded-full object-cover border-2 border-accent/40 mb-2" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center mb-2">
                      <span className="text-sm text-accent-glow" style={pf}>
                        {m.member_name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  <span className="text-[10px] text-white" style={pf}>{m.member_name}</span>
                  {m.position && (
                    <span className="text-[9px] text-digi-muted mt-0.5" style={mf}>{m.position}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Invoice */}
        {p.invoice && (
          <section>
            <h2 className="text-sm text-white mb-4" style={pf}>Factura Electronica</h2>
            <div className="border border-digi-border bg-digi-card p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[9px] text-digi-muted block mb-1" style={pf}>No. Factura</span>
                  <span className="text-xs text-white" style={mf}>{p.invoice.invoice_number}</span>
                </div>
                <div>
                  <span className="text-[9px] text-digi-muted block mb-1" style={pf}>Fecha</span>
                  <span className="text-xs text-white" style={mf}>
                    {p.invoice.issue_date ? new Date(p.invoice.issue_date).toLocaleDateString('es-EC') : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-digi-muted block mb-1" style={pf}>Estado SRI</span>
                  <PixelBadge variant={SRI_V[p.invoice.sri_status] || 'default'}>
                    {SRI_LABEL[p.invoice.sri_status] || p.invoice.sri_status}
                  </PixelBadge>
                </div>
                <div>
                  <span className="text-[9px] text-digi-muted block mb-1" style={pf}>Total</span>
                  <span className="text-base text-white font-bold" style={mf}>${Number(p.invoice.total).toFixed(2)}</span>
                </div>
              </div>
              {/* Invoice breakdown */}
              {(p.invoice.subtotal_0 || p.invoice.subtotal_iva) && (
                <div className="mt-3 pt-3 border-t border-digi-border flex flex-wrap gap-4 text-[10px]" style={mf}>
                  {p.invoice.subtotal_0 > 0 && (
                    <span className="text-digi-muted">Subtotal 0%: <span className="text-digi-text">${Number(p.invoice.subtotal_0).toFixed(2)}</span></span>
                  )}
                  {p.invoice.subtotal_iva > 0 && (
                    <span className="text-digi-muted">Subtotal IVA: <span className="text-digi-text">${Number(p.invoice.subtotal_iva).toFixed(2)}</span></span>
                  )}
                  {p.invoice.iva_amount > 0 && (
                    <span className="text-digi-muted">IVA: <span className="text-digi-text">${Number(p.invoice.iva_amount).toFixed(2)}</span></span>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Timeline */}
        <section>
          <h2 className="text-sm text-white mb-4" style={pf}>Historial</h2>
          <div className="border border-digi-border bg-digi-card p-4">
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-1 bottom-1 w-px bg-digi-border" />

              <TimelineItem
                date={p.created_at}
                label="Proyecto creado"
                variant="info"
              />
              {p.confirmed_at && (
                <TimelineItem
                  date={p.confirmed_at}
                  label="Proyecto confirmado"
                  variant="info"
                />
              )}
              {p.status === 'in_progress' && (
                <TimelineItem
                  date={p.updated_at}
                  label="En progreso"
                  variant="warning"
                />
              )}
              {p.status === 'review' && (
                <TimelineItem
                  date={p.updated_at}
                  label="En revision"
                  variant="warning"
                />
              )}
              {p.status === 'completed' && (
                <TimelineItem
                  date={p.updated_at}
                  label="Proyecto completado"
                  variant="success"
                />
              )}
              {p.invoice && (
                <TimelineItem
                  date={p.invoice.issue_date || p.updated_at}
                  label={`Factura ${p.invoice.invoice_number} emitida`}
                  variant="success"
                />
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-digi-border">
          <p className="text-[9px] text-digi-muted" style={pf}>
            GCC World &mdash; Plataforma de Desarrollo Humano
          </p>
        </footer>
      </main>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-digi-border bg-digi-card p-3">
      <span className="text-[9px] text-digi-muted block mb-1" style={{ fontFamily: "'Silkscreen', cursive" }}>{label}</span>
      <span className="text-xs text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </div>
  );
}

function TimelineItem({ date, label, variant }: { date: string; label: string; variant: 'info' | 'success' | 'warning' | 'error' | 'default' }) {
  const dotColors: Record<string, string> = {
    info: 'bg-accent border-accent-glow',
    success: 'bg-green-500 border-green-400',
    warning: 'bg-yellow-500 border-yellow-400',
    error: 'bg-red-500 border-red-400',
    default: 'bg-digi-muted border-digi-border',
  };
  return (
    <div className="relative flex items-start gap-3">
      <div className={`absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full border ${dotColors[variant]}`} />
      <div>
        <p className="text-[10px] text-digi-muted" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {new Date(date).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        <p className="text-xs text-white" style={{ fontFamily: "'Silkscreen', cursive" }}>{label}</p>
      </div>
    </div>
  );
}
