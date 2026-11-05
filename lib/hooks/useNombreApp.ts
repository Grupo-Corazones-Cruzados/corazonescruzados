'use client';

import { useEffect, useState } from 'react';
import { appDeTelefono, nombreDeApp } from '@/lib/sitio/appDeTelefono';

/** «GCC World» hasta hidratar (el servidor no ve la cookie en una página estática). */
export function useNombreApp(): string {
  const [nombre, setNombre] = useState('GCC World');
  useEffect(() => { setNombre(nombreDeApp(appDeTelefono())); }, []);
  return nombre;
}
