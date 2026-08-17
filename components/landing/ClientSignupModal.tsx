'use client';

/**
 * ALTA DE CUENTA DE CLIENTE.
 *
 * Es **el mismo diálogo** desde la portada y desde `/soluciones`: una sola definición, para
 * que no haya dos altas que piden cosas distintas.
 *
 * Estilo: el del panel, en su variante oscura, sobre una **isla `.corp dark`**. Antes era
 * pixel art —`Silkscreen` en las etiquetas, bordes de 2 px, botones en mayúsculas— y no se
 * parecía en nada al panel al que lleva. El armazón y los campos vienen de `AuthSurface`,
 * compartidos con los demás diálogos de acceso.
 *
 * Crea un usuario con rol `client` y **exige verificar el correo** antes de poder entrar.
 */

import { useState } from 'react';
import { UserPlus, MailCheck } from 'lucide-react';
import {
  AuthDialog, Campo, Casilla, ErrorAuth, BotonAuth, EnlaceAuth, INPUT,
} from './AuthSurface';

const mf = { fontFamily: 'var(--font-body)' } as const;

export default function ClientSignupModal({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ok =
    fullName.trim().length > 1 &&
    emailOk &&
    country.trim().length > 1 &&
    address.trim().length > 2 &&
    phone.trim().length >= 7 &&
    pwd.length >= 8 &&
    pwd === pwd2 &&
    terms;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pwd.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (pwd !== pwd2) return setError('Las contraseñas no coinciden');
    setBusy(true);
    try {
      // Cuenta de cliente = usuario con rol 'client' en gcc_world.users
      // (auth nativa del dashboard). Verifica correo antes de iniciar sesión.
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pwd,
          first_name: fullName.trim(),
          last_name: '',
          phone: phone.trim(),
          country: country.trim(),
          address: address.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo crear la cuenta');
        return;
      }
      setSent(true);
    } catch {
      setError('Error de red');
    } finally {
      setBusy(false);
    }
  };

  /* ── Confirmación ─────────────────────────────────────────────────────────── */
  if (sent) {
    return (
      <AuthDialog
        Icon={MailCheck}
        titulo="Confirma tu correo"
        subtitulo="Falta un paso para activar la cuenta."
        onClose={onClose}
        ancho="sm"
        pie={<BotonAuth onClick={onClose}>Entendido</BotonAuth>}
      >
        <p className="text-[13.5px] leading-relaxed text-digi-text" style={mf}>
          Te enviamos un enlace a <strong className="text-digi-text font-semibold">{email}</strong>.
          Ábrelo para activar tu cuenta y entrar a tu espacio de cliente.
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-digi-muted" style={mf}>
          Si no lo ves en unos minutos, revisa la carpeta de correo no deseado.
        </p>
      </AuthDialog>
    );
  }

  /* ── Formulario ───────────────────────────────────────────────────────────── */
  return (
    <AuthDialog
      Icon={UserPlus}
      titulo="Crea tu cuenta de cliente"
      subtitulo="Para pedir una cotización y seguir tus proyectos, tickets y facturas."
      onClose={onClose}
      ancho="lg"
      pie={<EnlaceAuth onClick={onLogin}>¿Ya tienes cuenta? Inicia sesión</EnlaceAuth>}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorAuth>{error}</ErrorAuth>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre completo" requerido>
            <input className={INPUT} value={fullName} onChange={(e) => setFullName(e.target.value)}
              autoComplete="name" placeholder="Tu nombre y apellidos" />
          </Campo>
          <Campo label="Correo electrónico" requerido>
            <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" placeholder="nombre@empresa.com" />
          </Campo>
          <Campo label="País" requerido>
            <input className={INPUT} value={country} onChange={(e) => setCountry(e.target.value)}
              autoComplete="country-name" placeholder="Ecuador" />
          </Campo>
          <Campo label="Teléfono" requerido>
            <input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel" placeholder="+593 99 000 0000" />
          </Campo>
        </div>

        <Campo label="Dirección" requerido>
          <input className={INPUT} value={address} onChange={(e) => setAddress(e.target.value)}
            autoComplete="street-address" placeholder="Calle, número, ciudad" />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Contraseña" hint="Mínimo 8 caracteres." requerido>
            <input className={INPUT} type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
              autoComplete="new-password" />
          </Campo>
          <Campo
            label="Repite la contraseña"
            requerido
            // El aviso aparece MIENTRAS se escribe, no al enviar: descubrir que no coinciden
            // después de pulsar el botón obliga a volver a los dos campos.
            hint={pwd2.length > 0 && pwd !== pwd2 ? 'No coinciden.' : undefined}
          >
            <input className={INPUT} type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)}
              autoComplete="new-password" />
          </Campo>
        </div>

        <div className="space-y-2.5">
          <Casilla checked={terms} onChange={setTerms}>
            Acepto los{' '}
            <a href="/legal" target="_blank" rel="noopener noreferrer"
              className="text-accent hover:underline">términos y condiciones y la política de privacidad</a>
            , y autorizo el tratamiento de mis datos conforme a ella.
          </Casilla>
          <Casilla checked={marketing} onChange={setMarketing}>
            Quiero recibir información sobre productos y novedades del proyecto.{' '}
            <span className="text-digi-muted">(opcional)</span>
          </Casilla>
        </div>

        <BotonAuth tipo="submit" cargando={busy} deshabilitado={!ok}>
          {busy ? 'Creando la cuenta…' : 'Crear cuenta'}
        </BotonAuth>
      </form>
    </AuthDialog>
  );
}
