'use client';

import { useState, useTransition } from 'react';
import { AlertCircle } from 'lucide-react';
import { entrarOperador } from '@/acciones/acceso';
import { Boton, Campo, Entrada } from '@/componentes/ui';

export default function FormularioOperador() {
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  return (
    <form
      action={(datos) =>
        arranca(async () => {
          setError(null);
          const r = await entrarOperador(datos);
          if (r?.error) setError(r.error);
        })
      }
      className="space-y-3"
    >
      <Campo etiqueta="Correo">
        <Entrada name="email" type="email" autoComplete="username" autoFocus required />
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
    </form>
  );
}
