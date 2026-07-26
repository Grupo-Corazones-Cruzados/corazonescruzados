'use client';

import { useEffect, useState } from 'react';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';
import { ExternalLink, PlayCircle, Video } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Tutorial {
  id: number;
  title: string;
  description: string | null;
  url: string;
  videoId: string;
}

/**
 * Modal de TUTORIALES de un módulo — se abre desde el botón ⓘ del sidebar.
 * Incrusta los videos de YouTube que el admin registró para ese módulo
 * (`/dashboard/admin` → pestaña Tutoriales).
 *
 * Se monta solo cuando hay un módulo elegido, así al cerrarlo el `<iframe>` se
 * desmonta y el video deja de reproducirse.
 */
export default function ModuleTutorialsModal({
  module,
  label,
  onClose,
}: {
  module: string;
  label: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/tutoriales?module=${encodeURIComponent(module)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive) return;
        if (!ok) throw new Error(j.error || 'Error');
        setItems(j.data || []);
        setCurrent(0);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [module]);

  const video = items[current];

  return (
    <PixelModal open onClose={onClose} title={`Tutoriales · ${label}`} size="lg">
      {loading ? (
        <div className="flex justify-center py-16"><BrandLoader size="md" label="Cargando tutoriales..." /></div>
      ) : error ? (
        <p className="text-[12.5px] text-red-600 py-8 text-center" style={mf}>{error}</p>
      ) : !items.length ? (
        <div className="text-center py-14">
          <div className="w-11 h-11 rounded-lg bg-accent-light flex items-center justify-center mx-auto mb-3">
            <Video className="w-5 h-5 text-accent" />
          </div>
          <p className="text-[13px] font-semibold text-digi-text" style={mf}>Aún no hay tutoriales</p>
          <p className="text-[12px] text-digi-muted mt-1" style={mf}>
            Todavía no se ha publicado ningún video para {label}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reproductor */}
          <div className="rounded-lg overflow-hidden border border-digi-border bg-black aspect-video">
            <iframe
              key={video.videoId}
              src={`https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0&modestbranding=1`}
              title={video.title}
              className="w-full h-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>

          {/* Ficha del video actual */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[14px] font-semibold text-digi-text" style={mf}>{video.title}</h3>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 text-[12px] text-digi-muted hover:text-accent transition-colors"
                style={mf}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver en YouTube
              </a>
            </div>
            {video.description && (
              <p className="text-[12.5px] text-digi-muted mt-1.5 leading-relaxed whitespace-pre-wrap" style={mf}>
                {video.description}
              </p>
            )}
          </div>

          {/* Lista de videos del módulo (solo si hay más de uno) */}
          {items.length > 1 && (
            <div className="border-t border-digi-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-digi-muted mb-2" style={mf}>
                {items.length} videos en este módulo
              </p>
              <div className="space-y-1">
                {items.map((t, i) => {
                  const active = i === current;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setCurrent(i)}
                      className={`w-full flex items-center gap-3 rounded-md border p-2 text-left transition-colors ${
                        active
                          ? 'border-accent bg-accent-light'
                          : 'border-digi-border hover:border-accent hover:bg-accent-light'
                      }`}
                    >
                      <img
                        src={`https://i.ytimg.com/vi/${t.videoId}/mqdefault.jpg`}
                        alt=""
                        className="w-20 h-[45px] object-cover rounded shrink-0 bg-digi-border"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12.5px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>
                          {t.title}
                        </span>
                        {t.description && (
                          <span className="block text-[11.5px] text-digi-muted truncate" style={mf}>{t.description}</span>
                        )}
                      </span>
                      {active && <PlayCircle className="w-4 h-4 text-accent shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </PixelModal>
  );
}
