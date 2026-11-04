/**
 * CONTROL PSICOSOCIAL en el teléfono — lado de la página. Le pasa al plugin nativo lo que la
 * persona aceptó. En el navegador, y en una app instalada antes de llevar el plugin, no hace nada.
 * `@capacitor/core` se importa dentro para que no pese a quien usa la plataforma en el navegador.
 */
import { FRASE_AUXILIO, SEGUNDOS_PARA_CANCELAR } from '@/lib/centralized/control-psicosocial';

export type EstadoNativo = {
  activo: boolean;
  ubicacion: boolean;
  voz: boolean;
  userId: string | null;
  tieneLlave: boolean;
  /** Por qué la voz no está escuchando; vacío si escucha o está apagada. */
  problemaVoz: string;
};

export type Permisos = { ubicacion: 'siempre' | 'en_uso' | 'denegado'; voz: 'concedido' | 'denegado' };

type Plugin = {
  estado(): Promise<EstadoNativo>;
  pedirPermisos(o: { ubicacion: boolean; voz: boolean }): Promise<Permisos>;
  configurar(o: {
    token?: string; userId: string; ubicacion: boolean; voz: boolean; frase: string; segundos: number;
  }): Promise<void>;
  enviarAhora(): Promise<void>;
  apagar(): Promise<void>;
};

let plugin: Promise<{ p: Plugin; plataforma: 'android' | 'ios' } | null> | null = null;

function cargar() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  plugin ??= import('@capacitor/core').then(({ Capacitor, registerPlugin }) => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('ControlPsicosocial')) return null;
    const plataforma = Capacitor.getPlatform();
    if (plataforma !== 'android' && plataforma !== 'ios') return null;
    return { p: registerPlugin<Plugin>('ControlPsicosocial'), plataforma };
  });
  return plugin;
}

/** La plataforma si este equipo puede rastrear; `null` en el navegador o en una app sin actualizar. */
export async function plataformaNativa(): Promise<'android' | 'ios' | null> {
  return (await cargar())?.plataforma ?? null;
}

/** Está dentro de la app, pero es una instalación anterior al rastreo: hay que actualizarla. */
export async function appSinRastreo(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const { Capacitor } = await import('@capacitor/core');
  return Capacitor.isNativePlatform() && !Capacitor.isPluginAvailable('ControlPsicosocial');
}

export async function estadoNativo(): Promise<EstadoNativo | null> {
  const c = await cargar();
  return c ? c.p.estado() : null;
}

export async function pedirPermisosNativos(ubicacion: boolean, voz: boolean): Promise<Permisos | null> {
  const c = await cargar();
  return c ? c.p.pedirPermisos({ ubicacion, voz }) : null;
}

export async function configurarNativo(userId: string, ubicacion: boolean, voz: boolean, token?: string) {
  const c = await cargar();
  if (c) await c.p.configurar({ token, userId, ubicacion, voz, frase: FRASE_AUXILIO, segundos: SEGUNDOS_PARA_CANCELAR });
}

/** Tras un auxilio: el teléfono manda su posición ya y pasa al intervalo corto. */
export async function enviarPosicionAhora() {
  const c = await cargar();
  if (c) await c.p.enviarAhora();
}

/** Apaga todo y entrega la llave. Sin plugin, o ya apagado, no hace nada. */
export async function apagarProteccionNativa() {
  const c = await cargar();
  if (c) await c.p.apagar();
}
