'use client';

import { useState, useTransition } from 'react';
import { entrar } from '@/acciones/acceso';
import { Boton, Campo, Entrada } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';

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
      {error && <Aviso texto={error} />}
      <Boton type="submit" tamano="lg" className="w-full" disabled={enCurso}>
        {enCurso ? 'Entrando…' : 'Entrar'}
      </Boton>
      <p className="pt-1 text-center text-[11px] leading-relaxed text-tenue">¿Olvidaste tu contraseña? Pídesela a la administración de tu institución: pueden generarte una nueva.</p>
    </form>
  );
}
