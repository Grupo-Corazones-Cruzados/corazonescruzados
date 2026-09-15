'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Boton } from '@/componentes/ui';
import { marcarMensajesLeidos } from '@/acciones/clientes';

export default function MarcarLeidos({ slug }: { slug: string }) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  return (
    <Boton variante="fantasma" tamano="sm" disabled={enCurso} onClick={() => arranca(async () => { await marcarMensajesLeidos(slug); router.refresh(); })}>
      Marcar como leídos
    </Boton>
  );
}
