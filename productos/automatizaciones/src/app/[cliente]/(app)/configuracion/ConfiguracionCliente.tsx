'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Users, CreditCard, KeyRound, Upload, MessageCircle, Save, Trash2, UserPlus } from 'lucide-react';
import { Boton, BotonIcono, Campo, Confirmar, Entrada, Selector, Insignia, Tarjeta, Tabla, Secciones, useSeccion, type OpcionRail } from '@/componentes/ui';
import { num2 } from '@/lib/formato';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { LogoHotel } from '@/componentes/Marca';
import { guardarNegocio, subirLogo, quitarLogo, cambiarMiClave } from '@/acciones/configuracion';
import PanelSuscripcion, { type SuscripcionVista } from '@/componentes/PanelSuscripcion';
import SeccionWhatsApp, { type ConexionVista } from './SeccionWhatsApp';
import SeccionUsuarios, { type UsuarioVista } from './SeccionUsuarios';

export type NegocioVista = {
  nombre: string;
  logoUrl: string | null;
  zonaHoraria: string;
  razonSocial: string | null;
  identificacion: string | null;
  direccion: string | null;
  correoFacturacion: string | null;
  contactoNombre: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
};

/**
 * La suscripción la pinta `PanelSuscripcion`, que es el MISMO que ve un cliente
 * bloqueado en `/‹cliente›/suscripcion`. Por eso el tipo viene de allí y no se
 * declara aquí: con dos tipos, una de las dos pantallas acabaría sin el botón de
 * pagar —que es exactamente lo que pasó—.
 */
export type { SuscripcionVista };

export type PagoVista = {
  id: number; periodo: string; monto: number; moneda: string; estado: string; metodo: string; pagadoEn: string | null;
};

export type PerfilVista = { nombre: string; email: string; telefono: string | null; foto: string | null };

export type Seccion = 'negocio' | 'usuarios' | 'whatsapp' | 'suscripcion' | 'cuenta';

/**
 * CONFIGURACIÓN CON SUBMENÚ, como en Gestión de Pedidos (Fernando, 2026-09-23: «no
 * debería haber módulo de suscripción, sino que en el módulo de configuración están las
 * opciones o un submenú»).
 *
 * La suscripción deja de ser un destino del menú principal: no es algo que se mire a
 * diario, es algo que se consulta cuando toca. Lo que se mira a diario —conversaciones,
 * estudio, envíos— es lo que merece un sitio arriba.
 */
export default function ConfiguracionCliente({
  slug,
  negocio,
  usuarios,
  suscripcion,
  pagos,
  miOrigen,
  perfil,
  conexion,
  meta,
  esCortesia,
}: {
  slug: string;
  negocio: NegocioVista;
  usuarios: { lista: UsuarioVista[]; tope: number | null; activas: number };
  suscripcion: SuscripcionVista;
  pagos: PagoVista[];
  miOrigen: 'GCC' | 'PRODUCTO' | null;
  /** Los datos de su cuenta de GCC World, si entra con ella. */
  perfil: PerfilVista | null;
  conexion: ConexionVista | null;
  /** Identificadores PÚBLICOS de la app de Meta (el secreto no sale del servidor). */
  meta: { appId: string | null; configId: string | null };
  esCortesia: boolean;
}) {
  const s = useSeccion(SECCIONES);
  const seccion = s.activo as Seccion;
  const [crearUsuario, setCrearUsuario] = useState(false);
  const usuariosLleno = usuarios.tope !== null && usuarios.activas >= usuarios.tope;
  // Los «Guardar» de cada sección: en escritorio viven al pie de su tarjeta; en el teléfono
  // bajan a la barra de acciones (regla §4-nonies), unidos a su formulario por `form=`.
  const guardarTelefono =
    s.enUrl && seccion === 'negocio' ? <Boton form="form-negocio" type="submit" icono={Save}>Guardar</Boton>
    : s.enUrl && seccion === 'usuarios' ? <Boton icono={UserPlus} disabled={usuariosLleno} onClick={() => setCrearUsuario(true)}>Crear usuario</Boton>
    : s.enUrl && seccion === 'cuenta' && miOrigen !== 'GCC' ? <Boton form="form-clave" type="submit" icono={Save}>Cambiar contraseña</Boton>
    : undefined;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <CabeceraPagina
        titulo="Configuración"
        descripcion="Los datos de tu negocio, quién entra, la conexión con WhatsApp, tu suscripción y tu cuenta"
        tituloTelefono={s.enUrl ? s.etiqueta : undefined}
        volverTelefono={s.enUrl ? { href: s.hrefPortada, etiqueta: 'Volver a Configuración' } : undefined}
        accionesTelefono={guardarTelefono}
      />
      <Secciones opciones={SECCIONES} seccion={s}>
        {seccion === 'negocio' && <SeccionNegocio slug={slug} negocio={negocio} />}
        {seccion === 'usuarios' && (
          <SeccionUsuarios
            slug={slug}
            usuarios={usuarios.lista}
            tope={usuarios.tope}
            activas={usuarios.activas}
            abierto={crearUsuario}
            setAbierto={setCrearUsuario}
          />
        )}
        {seccion === 'whatsapp' && (
          <SeccionWhatsApp slug={slug} conexion={conexion} appId={meta.appId} configId={meta.configId} esCortesia={esCortesia} />
        )}
        {seccion === 'suscripcion' && <SeccionSuscripcion slug={slug} s={suscripcion} pagos={pagos} />}
        {seccion === 'cuenta' && <SeccionCuenta slug={slug} miOrigen={miOrigen} perfil={perfil} />}
      </Secciones>
    </div>
  );
}

const SECCIONES: OpcionRail[] = [
  { valor: 'negocio', etiqueta: 'Negocio', icono: Building2 },
  { valor: 'usuarios', etiqueta: 'Usuarios', icono: Users },
  { valor: 'whatsapp', etiqueta: 'WhatsApp', icono: MessageCircle },
  { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
  { valor: 'cuenta', etiqueta: 'Mi cuenta', icono: KeyRound },
];

// ── Negocio ──────────────────────────────────────────────────────────────────
/**
 * NEGOCIO (antes «Marca», Fernando, 2026-11-08): sin color ni tema —el producto tiene un
 * solo tema—, solo los datos del negocio. El logo se SUBE como archivo; ya no se escribe
 * una dirección.
 */
function SeccionNegocio({ slug, negocio }: { slug: string; negocio: NegocioVista }) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [quitar, setQuitar] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  function subir(f: File) {
    const fd = new FormData();
    fd.set('archivo', f);
    arranca(async () => {
      const r = await subirLogo(slug, fd);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje ?? 'Logo subido.');
      router.refresh();
    });
  }

  return (
    <Tarjeta className="p-4 sm:p-5">
      <form
        id="form-negocio"
        action={(d) =>
          arranca(async () => {
            const r = await guardarNegocio(slug, d);
            if (!r.ok) { toast.error(r.error); return; }
            toast.success(r.mensaje ?? 'Guardado.');
            router.refresh();
          })
        }
        className="space-y-5"
      >
        {/* ── El negocio ── */}
        <div className="flex items-center gap-3">
          <LogoHotel nombre={negocio.nombre} logoUrl={negocio.logoUrl} tamano={52} />
          <input
            ref={archivo}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f); }}
          />
          <Boton variante="secundario" type="button" icono={Upload} onClick={() => archivo.current?.click()} disabled={enCurso}>
            {negocio.logoUrl ? 'Cambiar logo' : 'Subir logo'}
          </Boton>
          {negocio.logoUrl && (
            <BotonIcono icono={Trash2} titulo="Quitar el logo" onClick={() => setQuitar(true)} disabled={enCurso} />
          )}
        </div>

        <Grupo titulo="Negocio">
          <Campo etiqueta="Nombre comercial" requerido>
            <Entrada name="nombre" defaultValue={negocio.nombre} required />
          </Campo>
          <Campo etiqueta="Zona horaria">
            <Selector name="zonaHoraria" defaultValue={negocio.zonaHoraria}>
              <option value="America/Guayaquil">Ecuador (America/Guayaquil)</option>
              <option value="America/Bogota">Colombia (America/Bogota)</option>
              <option value="America/Lima">Perú (America/Lima)</option>
              <option value="America/Mexico_City">México (America/Mexico_City)</option>
              <option value="Europe/Madrid">España (Europe/Madrid)</option>
            </Selector>
          </Campo>
        </Grupo>

        <Grupo titulo="Facturación">
          <Campo etiqueta="Razón social">
            <Entrada name="razonSocial" defaultValue={negocio.razonSocial ?? ''} autoComplete="organization" />
          </Campo>
          <Campo etiqueta="RUC o identificación">
            <Entrada name="identificacion" defaultValue={negocio.identificacion ?? ''} inputMode="numeric" />
          </Campo>
          <Campo etiqueta="Dirección">
            <Entrada name="direccion" defaultValue={negocio.direccion ?? ''} autoComplete="street-address" />
          </Campo>
          <Campo etiqueta="Correo de facturación">
            <Entrada name="correoFacturacion" type="email" defaultValue={negocio.correoFacturacion ?? ''} />
          </Campo>
        </Grupo>

        <Grupo titulo="Contacto">
          <Campo etiqueta="Persona de contacto">
            <Entrada name="contactoNombre" defaultValue={negocio.contactoNombre ?? ''} autoComplete="name" />
          </Campo>
          <Campo etiqueta="Correo">
            <Entrada name="contactoEmail" type="email" defaultValue={negocio.contactoEmail ?? ''} autoComplete="email" />
          </Campo>
          <Campo etiqueta="Teléfono">
            <Entrada name="contactoTelefono" type="tel" defaultValue={negocio.contactoTelefono ?? ''} autoComplete="tel" />
          </Campo>
        </Grupo>

        <div className="hidden justify-end lg:flex">
          <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>
            {enCurso ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>

      <Confirmar
        abierto={quitar}
        titulo="¿Quitar el logo?"
        mensaje="En su lugar se verá la inicial del negocio."
        textoAceptar="Quitar"
        ocupado={enCurso}
        alCerrar={() => setQuitar(false)}
        alAceptar={() =>
          arranca(async () => {
            const r = await quitarLogo(slug);
            if (!r.ok) { toast.error(r.error); return; }
            setQuitar(false);
            toast.success(r.mensaje ?? 'Quitado.');
            router.refresh();
          })
        }
      />
    </Tarjeta>
  );
}

/** Un grupo de campos con su rótulo, en rejilla: se aprovecha el ancho. */
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-borde pt-4">
      <legend className="pr-2 text-[11px] font-semibold uppercase tracking-wide text-tenue">{titulo}</legend>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </fieldset>
  );
}

// ── Suscripción ──────────────────────────────────────────────────────────────
const ETIQUETA_METODO: Record<string, string> = {
  AUTOSERVICIO: 'Registrado por GCC', TARJETA: 'Tarjeta', APP_STORE: 'App Store', GOOGLE_PLAY: 'Google Play',
};

/**
 * ⭐ AQUÍ SE PAGA (Fernando, 2026-09-23: «aquí no debería estar la opción para pagar,
 * no veo la interfaz que permita pagar»).
 *
 * Tenía razón: el botón existía, pero solo en la pantalla que se ve con el acceso ya
 * cerrado. Y esta —Configuración → Suscripción— es la que se mira normalmente, y la que
 * él pidió desde el principio. Ahora las dos son el mismo componente, así que no puede
 * volver a haber una con botón y otra sin él.
 */
function SeccionSuscripcion({ slug, s, pagos }: { slug: string; s: SuscripcionVista; pagos: PagoVista[] }) {
  return (
    <div className="space-y-3">
      <PanelSuscripcion slug={slug} s={s} />

      {pagos.length > 0 && (
        <Tarjeta className="overflow-hidden">
          <p className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-tenue">Pagos registrados</p>
          <Tabla
            filas={pagos}
            claveFila={(p) => p.id}
            recuento={`${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'}`}
            columnas={[
              { clave: 'periodo', titulo: 'Periodo', ancho: '22%', render: (p) => <span className="text-texto">{p.periodo}</span> },
              { clave: 'pagado', titulo: 'Pagado el', ancho: '22%', render: (p) => p.pagadoEn ?? 'sin fecha' },
              { clave: 'metodo', titulo: 'Método', ancho: '22%', render: (p) => ETIQUETA_METODO[p.metodo] ?? p.metodo },
              { clave: 'monto', titulo: 'Monto', ancho: '17%', alinear: 'der', render: (p) => <span className="tabular-nums">{num2(p.monto)} {p.moneda}</span> },
              { clave: 'estado', titulo: 'Estado', ancho: '17%', render: (p) => (
                <Insignia tono={p.estado === 'PAGADO' ? 'exito' : p.estado === 'FALLIDO' ? 'error' : 'neutro'}>
                  {p.estado === 'PAGADO' ? 'Pagado' : p.estado === 'FALLIDO' ? 'Fallido' : 'Pendiente'}
                </Insignia>
              ) },
            ]}
          />
        </Tarjeta>
      )}
    </div>
  );
}

// ── Mi cuenta ────────────────────────────────────────────────────────────────
function SeccionCuenta({ slug, miOrigen, perfil }: { slug: string; miOrigen: 'GCC' | 'PRODUCTO' | null; perfil: PerfilVista | null }) {
  const [enCurso, arranca] = useTransition();
  const esDeGcc = miOrigen === 'GCC';

  return (
    <Tarjeta className="p-4 sm:p-5">
      {esDeGcc ? (
        /* Su cuenta de GCC World, tal como está en la plataforma: aquí solo se ve. */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {perfil?.foto
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={perfil.foto} alt="" className="h-14 w-14 rounded-full object-cover" />
              : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-acento-suave text-[18px] font-bold text-acento">{(perfil?.nombre ?? '?').charAt(0).toUpperCase()}</div>}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-texto">{perfil?.nombre ?? '—'}</p>
              <p className="text-[12px] text-tenue">Cuenta de GCC World</p>
            </div>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <DatoCuenta titulo="Correo">{perfil?.email ?? '—'}</DatoCuenta>
            <DatoCuenta titulo="Teléfono">{perfil?.telefono ?? '—'}</DatoCuenta>
          </dl>
          <div className="flex justify-end">
            <a href="https://app.grupocc.org/dashboard/settings" target="_blank" rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded border border-borde bg-tarjeta px-4 text-[13px] font-semibold text-texto hover:bg-realce">
              Editar en GCC World
            </a>
          </div>
        </div>
      ) : (
        <>
        <h2 className="hidden text-[14px] font-semibold text-texto lg:block">Tu contraseña</h2>
        <form
          id="form-clave"
          action={(d) =>
            arranca(async () => {
              const r = await cambiarMiClave(slug, d);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(r.mensaje ?? 'Cambiada.');
            })
          }
          className="space-y-4 lg:mt-3"
        >
          {/* Se aprovecha el ancho: dos columnas, no una columna estrecha (regla de disposición 3). */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Contraseña actual">
              <Entrada name="actual" type="password" autoComplete="current-password" required />
            </Campo>
            <Campo etiqueta="Contraseña nueva">
              <Entrada name="nueva" type="password" autoComplete="new-password" minLength={8} required />
            </Campo>
          </div>
          <div className="hidden justify-end lg:flex">
            <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>{enCurso ? 'Cambiando…' : 'Cambiar contraseña'}</Boton>
          </div>
        </form>
        </>
      )}
    </Tarjeta>
  );
}

function DatoCuenta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-borde bg-realce px-3 py-2">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-tenue">{titulo}</dt>
      <dd className="truncate text-[13px] text-texto">{children}</dd>
    </div>
  );
}

