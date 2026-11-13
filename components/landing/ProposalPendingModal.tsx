'use client';
import { Send, MailCheck, BadgeCheck } from 'lucide-react';
import { AuthDialog, BotonAuth } from '@/components/landing/AuthSurface';
import { Aviso } from '@/components/landing/OnboardingSlidersModal';

/**
 * ProposalPendingModal
 * --------------------
 * Se muestra a un candidato cuya postulación ya está registrada (reconocido por su IP al volver a
 * "Entrar → candidato", o justo tras enviar su propuesta), y al cliente que aún no verificó su correo.
 *
 * Con el armazón de los diálogos de acceso (`AuthDialog`, Fernando, 2026-11-13: «actualiza esto con diseño
 * moderno… tenemos reglas que aquí no están siendo aplicadas»). Antes era pixel: Silkscreen, emoji de reloj,
 * borde morado de 2 px y un aviso con fondo de color y borde. Ahora: título simple, el texto, y el aviso del
 * correo como rótulo con icono (`Aviso`), sin caja. El mismo diálogo que el de la página Candidatos.
 */
export default function ProposalPendingModal({
  email,
  emailVerified,
  onClose,
  mode = 'candidate',
  approved = false,
  onContinue,
}: {
  email?: string | null;
  emailVerified?: boolean;
  onClose: () => void;
  /** 'candidate' (postulación, requiere aprobación) | 'client' (solo verificar). */
  mode?: 'candidate' | 'client';
  /** La postulación ya fue APROBADA por el admin → botón "Continuar". */
  approved?: boolean;
  /** Acción del botón "Continuar" (crear cuenta). Requerido cuando approved=true. */
  onContinue?: () => void;
}) {
  const isClient = mode === 'client';
  const strong = 'font-semibold text-digi-text';

  return (
    <AuthDialog
      Icon={approved ? BadgeCheck : isClient ? MailCheck : Send}
      titulo={approved ? 'Postulación aprobada' : isClient ? 'Verificación de la cuenta' : 'Postulación en revisión'}
      onClose={onClose}
      ancho="sm"
      pie={
        <BotonAuth onClick={approved ? (onContinue ?? onClose) : onClose}>
          {approved ? 'Continuar' : 'Entendido'}
        </BotonAuth>
      }
    >
      <div className="space-y-5">
        <p className="text-[13.5px] leading-relaxed text-digi-text">
          {approved ? (
            <>
              El administrador del proyecto aprobó tu postulación{email ? <> con el correo <strong className={strong}>{email}</strong></> : ''}.
              Continúa para <strong className={strong}>crear tu cuenta</strong> con tu contraseña y tus datos.
            </>
          ) : isClient ? (
            <>
              Tu cuenta de cliente ya está creada, y para iniciar sesión primero debes{' '}
              <strong className={strong}>verificar tu correo</strong>, sin necesidad de crear otra cuenta.
            </>
          ) : (
            <>
              Tu propuesta quedó registrada y está <strong className={strong}>en espera de aprobación</strong>{' '}
              por parte del administrador del proyecto. Te avisaremos cuando sea aprobada.
            </>
          )}
        </p>

        {!approved && (
          emailVerified ? (
            <Aviso tono="info" titulo="Correo verificado">
              Tu correo {email ? <strong className={strong}>{email}</strong> : ''} ya está verificado.
            </Aviso>
          ) : (
            <Aviso tono="info" titulo="Verificación del correo">
              Te enviamos un correo{email ? <> a <strong className={strong}>{email}</strong></> : ''} para
              verificarlo. Revisa tu bandeja de entrada y la carpeta de spam.
            </Aviso>
          )
        )}
      </div>
    </AuthDialog>
  );
}
