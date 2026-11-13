import type { Metadata } from 'next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { PANEL_AUTH, TITULO_AUTH, TEXTO_AUTH } from '@/components/landing/authEstilos';

export const metadata: Metadata = { title: 'Verificación del correo', robots: { index: false } };

/**
 * EL RESULTADO DE VERIFICAR EL CORREO DE UNA POSTULACIÓN (Fernando, 2026-11-13: «el botón de verificar correo me
 * está llevando a la página de inicio y no aparece la página en donde se vea que se está verificando la cuenta»).
 * `/api/candidate/verify` marca el correo y manda aquí con `?estado=`; antes mandaba a la portada con
 * `?candidato=…`, que nadie leía. Mismo aspecto que confirmar el correo de una cuenta (`/auth/verify`).
 */
const ESTADOS = {
  'correo-verificado': {
    ok: true,
    titulo: 'Correo verificado',
    texto: 'Tu postulación quedó en espera de aprobación por parte del administrador del proyecto, y te avisaremos a tu correo cuando sea aprobada.',
  },
  'token-invalido': {
    ok: false,
    titulo: 'Enlace no válido',
    texto: 'El enlace de verificación no es válido o ya no existe. Ábrelo de nuevo desde el último correo que recibiste.',
  },
  error: {
    ok: false,
    titulo: 'No se pudo verificar',
    texto: 'Hubo un problema al verificar el correo. Vuelve a abrir el enlace del correo en un momento.',
  },
} as const;

export default async function PostulacionVerificada({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const e = ESTADOS[(estado ?? '') as keyof typeof ESTADOS] ?? ESTADOS['token-invalido'];
  const Icono = e.ok ? CheckCircle2 : XCircle;
  return (
    <div style={PANEL_AUTH}>
      <h1 style={TITULO_AUTH} className="flex items-center gap-2">
        <Icono className={`w-5 h-5 shrink-0 ${e.ok ? 'text-green-400' : 'text-red-400'}`} /> {e.titulo}
      </h1>
      <p style={TEXTO_AUTH}>{e.texto}</p>
      <a href="/" className="pixel-btn pixel-btn-primary w-full flex items-center justify-center">Ir al inicio</a>
    </div>
  );
}
