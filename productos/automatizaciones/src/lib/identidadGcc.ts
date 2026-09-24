/**
 * LA IDENTIDAD DE GCC WORLD, PREGUNTADA A LA PLATAFORMA.
 *
 * ── QUÉ PIDIÓ FERNANDO (2026-09-24) ─────────────────────────────────────────────
 * «Que en los productos ya apliquemos la identificación de cuentas de clientes de gcc
 * world, y obligues a ingresar el segundo paso… replica lo mismo en las páginas de login
 * de cada producto, donde hay dos opciones de segundo paso, la passkey o el correo».
 *
 * ── CÓMO FUNCIONA ───────────────────────────────────────────────────────────────
 * Cuando alguien escribe su correo en la pantalla de acceso, se le pregunta a la
 * plataforma si ese correo es de un cliente de GCC World. Si lo es:
 *   · la contraseña que vale es **la de GCC World**, no la del producto;
 *   · y hace falta el **segundo paso**, obligatorio, con las mismas dos opciones de
 *     siempre: la passkey o un código al correo.
 * Si no lo es, no cambia nada: entra con la cuenta que le creó su administrador.
 *
 * ── POR QUÉ NO SE COMPRUEBA NADA AQUÍ ───────────────────────────────────────────
 * Este archivo no verifica contraseñas, no guarda códigos y no valida passkeys: solo
 * pregunta. Todo eso vive en la plataforma (`lib/productos/identidad.ts`), que es la
 * dueña de la identidad, igual que es la dueña de la facturación. Copiarlo aquí sería
 * tener dos verdades sobre quién es quién, y la que se quedara vieja sería la de
 * seguridad.
 *
 * ⚠️ Es la MISMA tubería que ya usa `acciones/suscripcion.ts` para pedir un enlace de
 * pago: `GCC_URL` + `GCC_TOKEN` de servidor a servidor. El navegador nunca habla con la
 * plataforma.
 */

type Respuesta = Record<string, unknown> & { ok?: boolean; error?: string };

function config() {
  const base = (process.env.GCC_URL || 'https://app.grupocc.org').replace(/\/$/, '');
  /**
   * ⚠️ `GCC_TOKEN`, no `CRON_TOKEN`. Cada producto tiene su propio `CRON_TOKEN` para sus
   * tareas internas, y NO es el de la plataforma (comprobado en Railway el 2026-09-24:
   * cuatro valores distintos). Usar ese habría dado 401 en tres de los cinco productos.
   * `GCC_TOKEN` apunta con una referencia al de la plataforma y deja el propio en paz.
   */
  const token = process.env.GCC_TOKEN || process.env.CRON_TOKEN;
  return { base, token };
}

async function preguntar(cuerpo: Record<string, unknown>): Promise<Respuesta | null> {
  const { base, token } = config();
  if (!token) {
    // Sin secreto no se puede preguntar. Se devuelve `null` y quien llama trata al
    // usuario como lo que es sin GCC World: una cuenta del producto. Nunca al revés —
    // un fallo de red no puede convertirse en una entrada sin segundo paso.
    console.error('[identidad] Falta GCC_TOKEN: no se puede consultar a la plataforma.');
    return null;
  }
  try {
    const r = await fetch(`${base}/api/productos/identidad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-token': token },
      body: JSON.stringify(cuerpo),
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => ({}))) as Respuesta;
    return r.ok ? j : { ok: false, error: String(j.error ?? '') };
  } catch (e) {
    console.error('[identidad] No se pudo hablar con la plataforma:', e);
    return null;
  }
}

export type Reconocimiento = {
  esClienteGcc: boolean;
  tienePasskey: boolean;
  correoTapado: string;
  /**
   * ⚠️ Cuentas EXENTAS del segundo paso (`users.sin_doble_factor` en la plataforma). El
   * caso real es el revisor de Meta: su cuenta vive en nuestro dominio, así que el código
   * le llegaría a un buzón nuestro y se quedaría fuera justo mientras revisa. La
   * plataforma ya lo contempla en su login; aquí se obedece, no se decide.
   */
  sinSegundoPaso: boolean;
};

/** ¿El correo de esta cuenta es el de un cliente de GCC World? */
export async function reconocer(email: string): Promise<Reconocimiento> {
  const r = await preguntar({ paso: 'reconocer', email });
  return {
    // Si la plataforma no contesta, NO se le trata como cliente de GCC World: entraría
    // sin el segundo paso. Ante la duda, la puerta más estrecha.
    esClienteGcc: r?.ok === true && r.esClienteGcc === true,
    tienePasskey: r?.tienePasskey === true,
    sinSegundoPaso: r?.sinSegundoPaso === true,
    correoTapado: String(r?.correoTapado ?? email),
  };
}

/** Comprueba la contraseña de GCC World. No abre sesión: solo dice si es correcta. */
export async function claveGccCorrecta(email: string, clave: string): Promise<Reconocimiento | null> {
  const r = await preguntar({ paso: 'clave', email, clave });
  if (r?.ok !== true) return null;
  return {
    esClienteGcc: true,
    tienePasskey: r.tienePasskey === true,
    sinSegundoPaso: r.sinSegundoPaso === true,
    correoTapado: String(r.correoTapado ?? email),
  };
}

/** Manda el código de seis cifras al correo de la cuenta. */
export async function enviarCodigo(email: string, clave: string): Promise<string | null> {
  const r = await preguntar({ paso: 'enviar-codigo', email, clave });
  return r?.ok === true ? String(r.correoTapado ?? email) : null;
}

/** Comprueba el código del correo. */
export async function codigoCorrecto(email: string, codigo: string): Promise<boolean> {
  const r = await preguntar({ paso: 'comprobar-codigo', email, codigo });
  return r?.ok === true;
}

/** Opciones de WebAuthn para pedirle la passkey al navegador. */
export async function passkeyIniciar(email: string, origen: string): Promise<unknown | null> {
  const r = await preguntar({ paso: 'passkey-iniciar', email, origen });
  return r?.ok === true ? r.opciones : null;
}

/** Comprueba la passkey que devolvió el navegador. */
export async function passkeyTerminar(
  email: string,
  origen: string,
  credencial: unknown,
): Promise<boolean> {
  const r = await preguntar({ paso: 'passkey-terminar', email, origen, credencial });
  return r?.ok === true;
}
