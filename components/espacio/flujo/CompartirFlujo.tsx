'use client';

import { useEffect, useState } from 'react';
import PanelCompartirEnlace from '@/components/ui/PanelCompartirEnlace';
import PixelSelect from '@/components/ui/PixelSelect';
import { cabeceras } from '../api';

const VIGENCIAS = [
  { v: 24, l: '1 día' }, { v: 168, l: '1 semana' }, { v: 720, l: '1 mes' }, { v: 2160, l: '3 meses' },
];

interface Cliente { id: number; nombre: string; email: string }

/** Compartir el diagrama por enlace temporal: el mismo formulario de la cotización, con el cliente a elegir. */
export default function CompartirFlujo({ proyectoId, nombre, open, onClose }: { proyectoId: string; nombre: string; open: boolean; onClose: () => void }) {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [cliente, setCliente] = useState('');

  useEffect(() => {
    if (!open) return;
    setCliente('');
    fetch('/api/espacio-trabajo/clientes', { headers: cabeceras() })
      .then((r) => (r.ok ? r.json() : { clientes: [] }))
      .then((d) => setClientes(d.clientes))
      .catch(() => setClientes([]));
  }, [open]);

  const elegido = clientes?.find((c) => String(c.id) === cliente);
  return (
    <PanelCompartirEnlace
      open={open} onClose={onClose}
      title="Compartir el diagrama de flujo"
      intro={<>Quien abra el enlace verá el diagrama de <strong>{nombre}</strong> tal como está ahora, sin cuenta y sin poder cambiarlo. Generar otro deja sin efecto el anterior.</>}
      duraciones={VIGENCIAS} duracionInicial={168}
      correoInicial={elegido?.email || ''}
      aviso="Cualquiera con este enlace puede ver el diagrama mientras esté vigente."
      generar={async ({ horas, email, enviar }) => {
        const r = await fetch('/api/espacio-trabajo/flujo-compartido', {
          method: 'POST', headers: cabeceras({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ proyecto: proyectoId, horas, email: enviar ? email : undefined }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'No se pudo generar el enlace.');
        if (enviar && !d.enviado) return { url: d.url, mensaje: 'Enlace generado, pero el correo no salió: cópialo y envíalo tú', ok: false };
        return { url: d.url, mensaje: enviar ? 'Enlace enviado por correo' : 'Enlace generado' };
      }}
    >
      <PixelSelect label="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)}
        placeholder={clientes === null ? 'Cargando…' : clientes.length ? 'Elige el cliente' : 'Ningún cliente tiene cuenta'}
        options={(clientes || []).map((c) => ({ value: String(c.id), label: `${c.nombre} · ${c.email}` }))} />
    </PanelCompartirEnlace>
  );
}
