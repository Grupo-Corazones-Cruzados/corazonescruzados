'use client';

import { useState, useTransition } from 'react';
import { entrar } from '@/acciones/acceso';
import { Boton, Campo, Entrada } from '@/componentes/ui';
import { AlertCircle } from 'lucide-react';

export default function FormularioAcceso({ slug }: { slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  function enviar(datos: FormData) {
    setError(null);
    arranca(async () => {
      // Si el acceso es correcto la acción redirige y esto no vuelve.
      const r = await entrar(slug, datos);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form action={enviar} className="space-y-3">
      <Campo etiqueta="Usuario">
        <Entrada name="usuario" autoComplete="username" autoFocus required />
      </Campo>
      <Campo etiqueta="Contraseña">
        <Entrada name="clave" type="password" autoComplete="current-password" required />
      </Campo>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <Boton type="submit" tamano="lg" className="w-full" disabled={enCurso}>
        {enCurso ? 'Entrando…' : 'Entrar'}
      </Boton>

      <p className="pt-1 text-center text-[11px] leading-relaxed text-tenue">
        ¿Olvidaste tu contraseña? Pídesela a quien administra las cuentas de tu alojamiento.
      </p>
    </form>
  );
}
