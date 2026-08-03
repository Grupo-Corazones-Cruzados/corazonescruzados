'use client';

/**
 * EL FORMULARIO DE ACCESO — uno solo, con el tipo de cuenta como parámetro.
 *
 * ── POR QUÉ UNO Y NO TRES ──────────────────────────────────────────────────────
 * Las tres puertas —cliente, miembro, candidato— hacen exactamente lo mismo: credenciales,
 * código por correo y entrar. Lo único que cambia es el título y qué cuentas se aceptan.
 * Escribir tres pantallas equivalentes es la forma segura de que dentro de tres meses una
 * tenga el arreglo que las otras dos no. Aquí se cambia una vez.
 *
 * ── SE VE IGUAL QUE EL DIÁLOGO DE LA PORTADA, Y NO POR CASUALIDAD ─────────────
 * Usa `authEstilos`, la MISMA definición que `ClientLoginModal`: panel, título, campos sin
 * etiqueta y botón primario a ancho completo. Es la misma acción; quien llega por un
 * enlace directo no debería encontrarse otra cosa que quien llega desde la portada.
 * Escribir estilos «equivalentes» aquí sería repetir el error de la pantalla de plantillas
 * (ver `Diseño.md`): equivalente no es igual.
 *
 * Lo ÚNICO que cambia según la ruta es el rótulo — «cuenta de cliente», «de miembro», «de
 * candidato»— para que se sepa por qué puerta se está entrando.
 *
 * ⚠️ La comprobación del tipo de cuenta está en el SERVIDOR (`login/begin`). Lo de aquí es
 * el rótulo de la puerta, no la cerradura: cambiar la URL no da acceso a nada.
 *
 * ── DOS PASOS, Y NINGÚN ATAJO A LA VISTA ──────────────────────────────────────
 * Correo y contraseña primero; el código del segundo factor **después**, en su propia
 * pantalla. No hay botón de «enviar código» ni de passkey junto a las credenciales
 * (decisión de Fernando, 2026-08-03): ofrecer tres caminos antes de saber quién eres
 * convierte una entrada en un menú, y el segundo factor deja de leerse como lo que es —el
 * paso siguiente— para parecer una opción entre otras.
 *
 * La única cuenta que se salta el código es la marcada `sin_doble_factor` en la base —hoy
 * la del revisor de Meta—, y no lo decide esta pantalla: el servidor devuelve `sinCodigo`
 * con la sesión ya abierta y aquí solo se entra. Ver la migración 029.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/AuthProvider';
import BrandLoader from '@/components/ui/BrandLoader';
import {
  PANEL_AUTH, TITULO_AUTH, SUBTITULO_AUTH, CAMPO_AUTH, ENLACE_AUTH,
} from '@/components/landing/authEstilos';
import { PERFILES, type TipoCuenta } from '@/lib/auth/tipos';

const mf = { fontFamily: 'var(--font-body)' } as const;

export default function FormularioAcceso({ tipo }: { tipo: TipoCuenta }) {
  const perfil = PERFILES[tipo];

  const params = useSearchParams();
  const redirect = params.get('redirect') || '/dashboard';
  const router = useRouter();
  const { resetPassword, refreshUser } = useAuth();

  const [vista, setVista] = useState<'acceso' | 'recuperar'>('acceso');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [pasoCodigo, setPasoCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [tapado, setTapado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      if (vista === 'recuperar') {
        await resetPassword(email);
        toast.info('Si el correo existe, recibirás un enlace para restablecer tu contraseña.');
        return;
      }

      if (!pasoCodigo) {
        const r = await fetch('/api/auth/login/begin', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: clave, expect: tipo }),
        });
        const j = await r.json();
        if (!r.ok) { setError(j?.error ?? 'No se pudo iniciar sesión'); return; }
        // Cuenta exenta del segundo factor: el servidor ya dejó la sesión abierta.
        if (j?.sinCodigo) { await refreshUser(); router.push(redirect); return; }
        setTapado(j?.masked ?? null);
        setPasoCodigo(true);
      } else {
        const r = await fetch('/api/auth/login/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: codigo }),
        });
        const j = await r.json();
        if (!r.ok) { setError(j?.error ?? 'Código incorrecto'); return; }
        await refreshUser();
        router.push(redirect);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally { setCargando(false); }
  };

  const titulo =
    vista === 'recuperar' ? 'Restablecer contraseña'
    : pasoCodigo ? 'Confirma el código'
    : 'Inicia sesión';

  const subtitulo =
    vista === 'recuperar' ? 'Te enviaremos un enlace a tu correo.'
    : pasoCodigo ? `Te enviamos un código a ${tapado ?? 'tu correo'}.`
    : perfil.subtituloAcceso;

  return (
    <div className="corp dark w-full max-w-[440px] flex flex-col items-center gap-[18px]">
      <Link href="/" className="flex flex-col items-center gap-2">
        <BrandLoader size="md" />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', letterSpacing: '0.2em', color: '#fff' }}>
          GCC WORLD
        </span>
      </Link>

      <div style={PANEL_AUTH}>
        <h1 style={TITULO_AUTH}>{titulo}</h1>
        <p style={SUBTITULO_AUTH}>{subtitulo}</p>

        <form onSubmit={enviar} className="flex flex-col gap-2.5">
          {vista === 'acceso' && pasoCodigo ? (
            <input
              value={codigo} inputMode="numeric" autoFocus placeholder="Código de 6 dígitos"
              onChange={(e) => setCodigo(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              style={CAMPO_AUTH}
            />
          ) : (
            <>
              <input
                type="email" required value={email} autoComplete="email" autoFocus
                placeholder="Correo electrónico" onChange={(e) => setEmail(e.target.value)}
                style={CAMPO_AUTH}
              />
              {vista === 'acceso' && (
                <input
                  type="password" required value={clave} autoComplete="current-password"
                  placeholder="Contraseña" onChange={(e) => setClave(e.target.value)}
                  style={CAMPO_AUTH}
                />
              )}
            </>
          )}

          {error && (
            <p className="text-[0.78rem] leading-relaxed" style={{ ...mf, color: '#ff9d9d' }}>{error}</p>
          )}

          <button
            type="submit" disabled={cargando}
            className="pixel-btn pixel-btn-primary"
            style={{ marginTop: 4, opacity: cargando ? 0.6 : 1 }}
          >
            {cargando ? 'Verificando…'
              : vista === 'recuperar' ? 'Enviar el enlace'
              : pasoCodigo ? 'Entrar' : 'Continuar'}
          </button>

          {vista === 'acceso' && !pasoCodigo && (
            <button type="button" onClick={() => { setVista('recuperar'); setError(null); }} style={ENLACE_AUTH}>
              He olvidado mi contraseña
            </button>
          )}
          {vista === 'acceso' && pasoCodigo && (
            <button
              type="button" style={ENLACE_AUTH}
              onClick={() => { setPasoCodigo(false); setCodigo(''); setError(null); }}
            >
              Volver a escribir el correo
            </button>
          )}
          {vista === 'recuperar' && (
            <button type="button" onClick={() => { setVista('acceso'); setError(null); }} style={ENLACE_AUTH}>
              Volver al acceso
            </button>
          )}

          {perfil.altaTexto && perfil.altaHref && vista === 'acceso' && !pasoCodigo && (
            <Link href={perfil.altaHref} style={{ ...ENLACE_AUTH, textAlign: 'center' }}>
              {perfil.altaTexto}
            </Link>
          )}

          <Link href="/auth" style={{ ...ENLACE_AUTH, color: 'rgba(225,215,255,0.5)', textAlign: 'center' }}>
            No es mi tipo de cuenta
          </Link>
        </form>
      </div>
    </div>
  );
}
