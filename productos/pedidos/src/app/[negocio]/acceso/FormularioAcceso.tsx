'use client';

import { useState, useTransition } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { AlertCircle, Fingerprint, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { entrar, pedirCodigo, entrarConCodigo, passkeyOpciones, entrarConPasskey } from '@/acciones/acceso';
import { Boton, Campo, Entrada } from '@/componentes/ui';

/**
 * ENTRAR, EN UNO O EN DOS PASOS.
 *
 * ── LO QUE PIDIÓ FERNANDO (2026-09-24) ──────────────────────────────────────────
 * «Que en los productos ya apliquemos la identificación de cuentas de clientes de gcc
 * world, y obligues a ingresar el segundo paso… replica lo mismo en las páginas de login
 * de cada producto, donde hay dos opciones de segundo paso, la passkey o el correo».
 *
 * Así que esta pantalla es **la misma conversación** que la de GCC World, con las mismas
 * dos salidas y en el mismo orden. Quien ya entra a la plataforma no tiene que aprender
 * nada nuevo.
 *
 * ── QUIÉN VE EL SEGUNDO PASO ────────────────────────────────────────────────────
 * Solo quien es cliente de GCC World, y no porque lo diga aquí: lo decide el servidor al
 * reconocer el correo (`acciones/acceso.ts`). Una cuenta que creó el administrador del
 * inquilino para su gente entra de una vez, como siempre. Por eso el formulario no
 * pregunta «¿qué clase de cuenta tienes?»: eso es asunto nuestro, no suyo.
 */
export default function FormularioAcceso({ slug }: { slug: string }) {
  const [paso, setPaso] = useState<'clave' | 'elegir' | 'codigo'>('clave');
  const [clave, setClave] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tapado, setTapado] = useState<string | null>(null);
  const [hayPasskey, setHayPasskey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  function enviarClave(datos: FormData) {
    setError(null);
    // Se guarda para poder pedir el código sin volver a escribirla. Vive en memoria de
    // esta pantalla y muere al recargarla; nunca se escribe en disco ni en una cookie.
    setClave(String(datos.get('clave') ?? ''));
    arranca(async () => {
      // Si entra de una vez, la acción redirige y esto no vuelve.
      const r = await entrar(slug, datos);
      if (r?.error) { setError(r.error); return; }
      if (r?.segundoPaso) {
        setTapado(r.segundoPaso.correoTapado);
        setHayPasskey(r.segundoPaso.tienePasskey);
        setPaso('elegir');
      }
    });
  }

  function conPasskey() {
    setError(null);
    arranca(async () => {
      try {
        const opciones = await passkeyOpciones(slug, window.location.origin);
        if (!opciones) {
          setError('No hay ninguna passkey guardada para esta cuenta. Usa el código del correo.');
          return;
        }
        const credencial = await startAuthentication({ optionsJSON: opciones as never });
        const r = await entrarConPasskey(slug, window.location.origin, credencial);
        if (r?.error) setError(r.error);
      } catch (e) {
        // Cancelar no es un error: si alguien cierra el diálogo del sistema, no se le
        // regaña — se le deja donde estaba para que elija la otra opción.
        const m = e instanceof Error ? e.message : 'No se pudo usar la passkey.';
        if (!/cancel|abort|timeout|allowed|NotAllowed/i.test(m)) setError(m);
      }
    });
  }

  function mandarCodigo() {
    setError(null);
    arranca(async () => {
      const r = await pedirCodigo(slug, clave);
      if (r?.error) { setError(r.error); return; }
      if (r?.segundoPaso?.correoTapado) setTapado(r.segundoPaso.correoTapado);
      setPaso('codigo');
    });
  }

  function comprobarCodigo(datos: FormData) {
    setError(null);
    arranca(async () => {
      const r = await entrarConCodigo(slug, String(datos.get('codigo') ?? ''));
      if (r?.error) setError(r.error);
    });
  }

  const aviso = error && (
    <p
      role="alert"
      className="flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error"
    >
      <AlertCircle className="mt-px h-4 w-4 shrink-0" />
      {error}
    </p>
  );

  // ── Paso 1: usuario y contraseña ───────────────────────────────────────────
  if (paso === 'clave') {
    return (
      <form action={enviarClave} className="space-y-3">
        {/*
          UNA SOLA CASILLA PARA LAS DOS CLASES DE CUENTA (Fernando, 2026-09-23).
          Quien tiene cuenta de cliente en GCC World escribe su correo y su contraseña
          de siempre; quien tiene una cuenta creada aquí escribe su usuario.
        */}
        <Campo etiqueta="Usuario o correo">
          <Entrada name="usuario" autoComplete="username" autoFocus required />
        </Campo>
        <Campo etiqueta="Contraseña">
          <Entrada name="clave" type="password" autoComplete="current-password" required />
        </Campo>

        {aviso}

        <Boton type="submit" tamano="lg" className="w-full" disabled={enCurso}>
          {enCurso ? 'Entrando…' : 'Entrar'}
        </Boton>

        <p className="pt-1 text-center text-[11px] leading-relaxed text-tenue">
          Si tienes cuenta de cliente de GCC World, entra con ese correo y esa contraseña:
          es la misma para todo. Si te creó la cuenta tu administrador, pídesela a él.
        </p>
      </form>
    );
  }

  // ── Paso 2, la elección: passkey o correo ──────────────────────────────────
  if (paso === 'elegir') {
    return (
      <div className="space-y-3">
        <div className="rounded border border-borde bg-acento-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-acento">
          <p className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-4 w-4 shrink-0" /> Un paso más
          </p>
          <p className="mt-0.5">
            Tu cuenta es de <strong>cliente de GCC World</strong>, así que pedimos una segunda
            prueba de que eres tú.
          </p>
        </div>

        {aviso}

        {/* La passkey primero: es la que no se teclea, no caduca y no viaja por correo.
            Se ofrece solo si la cuenta tiene alguna guardada; si no, sobra un botón que
            solo sabría fallar. */}
        {hayPasskey && (
          <Boton tamano="lg" className="w-full" disabled={enCurso} onClick={conPasskey}>
            <Fingerprint className="h-4 w-4" />
            {enCurso ? 'Esperando…' : 'Usar mi passkey'}
          </Boton>
        )}

        <Boton
          variante={hayPasskey ? 'secundario' : 'primario'}
          tamano="lg"
          className="w-full"
          disabled={enCurso}
          onClick={mandarCodigo}
        >
          <Mail className="h-4 w-4" />
          {enCurso ? 'Enviando…' : 'Enviarme un código al correo'}
        </Boton>

        {!hayPasskey && (
          <p className="text-center text-[11px] leading-relaxed text-tenue">
            ¿Quieres entrar sin código la próxima vez? Registra una passkey desde tu cuenta
            de GCC World: sirve aquí y en todos los productos.
          </p>
        )}

        <Volver alVolver={() => { setPaso('clave'); setError(null); }} />
      </div>
    );
  }

  // ── Paso 2, el código ──────────────────────────────────────────────────────
  return (
    <form action={comprobarCodigo} className="space-y-3">
      <p className="rounded border border-borde bg-realce px-3 py-2.5 text-[12.5px] leading-relaxed text-tenue">
        Te enviamos un código de seis cifras a <strong>{tapado}</strong>. Caduca en 15 minutos.
      </p>

      <Campo etiqueta="Código">
        <Entrada
          name="codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          autoFocus
          required
        />
      </Campo>

      {aviso}

      <Boton type="submit" tamano="lg" className="w-full" disabled={enCurso || codigo.length < 6}>
        {enCurso ? 'Comprobando…' : 'Entrar'}
      </Boton>

      <div className="flex items-center justify-between gap-2">
        <Volver alVolver={() => { setPaso('elegir'); setError(null); setCodigo(''); }} />
        <button
          type="button"
          onClick={mandarCodigo}
          disabled={enCurso}
          className="h-9 px-1.5 text-[11.5px] text-tenue underline underline-offset-2 hover:text-texto disabled:opacity-50"
        >
          Enviar otro código
        </button>
      </div>
    </form>
  );
}

function Volver({ alVolver }: { alVolver: () => void }) {
  return (
    <button
      type="button"
      onClick={alVolver}
      className="flex h-9 items-center gap-1 px-1.5 text-[11.5px] text-tenue hover:text-texto"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Volver
    </button>
  );
}
