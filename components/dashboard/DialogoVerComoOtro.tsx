'use client';

/**
 * VER LA PLATAFORMA COMO OTRO USUARIO — el diálogo de elección.
 *
 * Se abre desde la foto de perfil del menú, y solo para administradores. La regla de
 * verdad no está aquí: el servidor comprueba el rol contra la base en cada llamada (ver
 * `app/api/admin/suplantar/route.ts`). Esto solo evita ofrecer lo que no se puede hacer.
 *
 * ⚠️ **No hay listado.** Hay que escribir al menos dos letras y se devuelven 20 como mucho.
 * Un desplegable con todas las cuentas invita a entrar en la de cualquiera por curiosidad;
 * un buscador obliga a ir a por alguien concreto, que es la única razón legítima para usar
 * esto.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { Search, Eye, ShieldAlert } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Candidato {
  id: string; email: string; first_name: string | null; last_name: string | null;
  avatar_url: string | null; role: string; account_type: string | null;
}

const COMO_SE_LLAMA = (u: Candidato) =>
  [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;

/** Lo que de verdad es la cuenta: cliente y candidato comparten rol y no son lo mismo. */
const QUE_ES = (u: Candidato) =>
  u.role === 'admin' ? 'Administrador'
  : u.role === 'member' ? 'Miembro'
  : u.account_type === 'candidate' ? 'Candidato'
  : 'Cliente';

export default function DialogoVerComoOtro({ abierto, alCerrar }: {
  abierto: boolean; alCerrar: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Candidato[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { if (abierto) { setBusca(''); setResultados([]); } }, [abierto]);

  // Se espera a que deje de teclear: una consulta por letra sobraría.
  useEffect(() => {
    if (!abierto) return;
    const termino = busca.trim();
    if (termino.length < 2) { setResultados([]); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/suplantar?busca=${encodeURIComponent(termino)}`);
        const d = await r.json();
        setResultados(r.ok ? (d.data ?? []) : []);
      } finally { setBuscando(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [busca, abierto]);

  const entrar = useCallback(async (u: Candidato) => {
    setOcupado(true);
    try {
      const r = await fetch('/api/admin/suplantar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: u.id }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'No se pudo cambiar de vista'); return; }
      // ⚠️ Recarga COMPLETA, no `router.refresh()`: la sesión cambió de identidad y hay
      // media aplicación con datos del usuario anterior en memoria —el menú, los permisos,
      // lo que cada pantalla ya había pedido—. Empezar de cero es lo único fiable.
      window.location.href = '/dashboard';
    } finally { setOcupado(false); }
  }, []);

  return (
    <PixelModal open={abierto} onClose={alCerrar} title="Ver la plataforma como otro usuario" size="md" busy={ocupado}>
      <div className="space-y-4">
        <div className="rounded-md border border-digi-border bg-digi-card px-3 py-2.5 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
            Entrarás con <strong className="text-digi-text">su identidad y sus permisos</strong>, no con los tuyos:
            verás lo que ve y solo podrás hacer lo que él puede. Lo que escribas quedará
            firmado por esa persona, y el acceso queda registrado.
          </p>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-digi-text mb-1.5" style={mf}>Buscar la cuenta</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-digi-muted pointer-events-none" />
            <PixelInput
              autoFocus
              placeholder="Nombre o correo…"
              value={busca}
              onChange={(e: any) => setBusca(e.target.value)}
              style={{ paddingLeft: 28 }}
            />
          </div>
        </div>

        <div className="min-h-[120px]">
          {buscando ? (
            <div className="flex justify-center py-8"><BrandLoader size="sm" /></div>
          ) : busca.trim().length < 2 ? (
            <p className="text-[12px] text-digi-muted py-8 text-center" style={mf}>
              Escribe al menos dos letras del nombre o del correo.
            </p>
          ) : resultados.length === 0 ? (
            <p className="text-[12px] text-digi-muted py-8 text-center" style={mf}>Ninguna cuenta coincide.</p>
          ) : (
            <ul className="space-y-1.5">
              {resultados.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => entrar(u)}
                    className="w-full flex items-center gap-2.5 rounded-md border border-digi-border px-3 py-2 text-left hover:border-accent hover:bg-accent-light/40 transition-colors disabled:opacity-50"
                  >
                    {u.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-accent-light text-accent flex items-center justify-center text-[12px] font-semibold shrink-0" style={mf}>
                        {COMO_SE_LLAMA(u)[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-digi-text truncate" style={mf}>{COMO_SE_LLAMA(u)}</span>
                      <span className="block text-[11.5px] text-digi-muted truncate" style={mf}>{u.email} · {QUE_ES(u)}</span>
                    </span>
                    <Eye className="w-4 h-4 text-digi-muted shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <button type="button" className={BTN_SECONDARY} onClick={alCerrar}>Cancelar</button>
        </div>
      </div>
    </PixelModal>
  );
}
