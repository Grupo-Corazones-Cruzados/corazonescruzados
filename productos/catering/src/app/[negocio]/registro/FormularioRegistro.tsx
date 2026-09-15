'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { registrarse } from '@/acciones/acceso';
import { Boton, Campo, Entrada, AreaTexto } from '@/componentes/ui';
import { Aviso, Chips } from '@/componentes/campos';
import { ETIQUETA_COMIDA } from '@/lib/catalogo';
import type { TipoComida } from '@/generated/prisma/enums';

export default function FormularioRegistro({ slug, comidas }: { slug: string; comidas: TipoComida[] }) {
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [tipos, setTipos] = useState<TipoComida[]>(comidas.length === 1 ? comidas : []);
  const [enCurso, arranca] = useTransition();

  if (listo)
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-exito" />
        <p className="text-[15px] font-semibold">¡Registro enviado!</p>
        <p className="text-[13px] text-tenue">El negocio lo revisará y te avisará. Cuando esté aprobado, entras con tu correo y tu contraseña.</p>
      </div>
    );

  return (
    <form action={(d) => arranca(async () => { setError(null); const r = await registrarse(slug, d); if (!r.ok) return setError(r.error); setListo(true); })} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre completo" requerido><Entrada name="nombre" required autoFocus /></Campo>
        <Campo etiqueta="Celular" requerido><Entrada name="celular" required inputMode="numeric" placeholder="0991234567" /></Campo>
        <Campo etiqueta="Correo" requerido><Entrada name="email" type="email" required autoComplete="email" /></Campo>
        <span />
        <Campo etiqueta="Contraseña" requerido><Entrada name="clave" type="password" required minLength={8} autoComplete="new-password" /></Campo>
        <Campo etiqueta="Repite la contraseña" requerido><Entrada name="clave2" type="password" required minLength={8} autoComplete="new-password" /></Campo>
      </div>
      <Campo etiqueta="Qué comidas te interesan" requerido>
        <Chips nombre="tiposComida" opciones={comidas} etiquetas={ETIQUETA_COMIDA} valor={tipos} alCambiar={setTipos} />
      </Campo>
      <Campo etiqueta="Dirección de entrega" requerido><Entrada name="direccion" required /></Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Edificio / conjunto"><Entrada name="edificio" /></Campo>
        <Campo etiqueta="Piso / depto."><Entrada name="piso" /></Campo>
      </div>
      <Campo etiqueta="Referencias"><AreaTexto name="referencias" rows={2} placeholder="Frente al parque, portón negro…" /></Campo>
      {error && <Aviso texto={error} />}
      <Boton type="submit" tamano="lg" className="w-full" disabled={enCurso}>{enCurso ? 'Enviando…' : 'Enviar registro'}</Boton>
      <p className="text-center text-[11px] text-tenue">Después de aprobado podrás completar tu perfil: segunda dirección, restricciones y datos nutricionales.</p>
    </form>
  );
}
