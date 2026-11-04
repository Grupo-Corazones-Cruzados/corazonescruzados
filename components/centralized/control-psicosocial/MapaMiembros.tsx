'use client';

import { useEffect, useRef, useState } from 'react';
import type { LayerGroup, Map as MapaLeaflet } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { estadoSenal, type FilaRastreo } from '@/lib/centralized/control-psicosocial';

const COLOR: Record<string, string> = {
  auxilio: 'bg-red-600 ring-red-300',
  activa: 'bg-accent ring-white',
  sin_senal: 'bg-gray-500 ring-white',
};

const INICIO: [number, number] = [-2.17, -79.92]; // Guayaquil, hasta que alguien comparta.

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const iniciales = (nombre: string) => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/**
 * El mapa de los miembros que comparten. Leaflet y no el mapa incrustado de OpenStreetMap porque
 * aquel solo pinta un marcador. Leaflet se carga aquí dentro: necesita `window` y no debe pesar
 * fuera de esta pantalla. Las posiciones se refrescan sin mover la vista; la vista solo se encuadra
 * al entrar alguien nuevo o al elegir a alguien.
 */
export default function MapaMiembros({
  filas, elegido, onElegir, className = '',
}: {
  filas: FilaRastreo[];
  elegido?: string | null;
  onElegir?: (userId: string) => void;
  className?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const capa = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const encuadrados = useRef('');
  const [listo, setListo] = useState(false);
  const conPunto = filas.filter((f) => f.lat != null && f.lng != null);

  useEffect(() => {
    let vivo = true;
    import('leaflet').then((L) => {
      if (!vivo || !caja.current || mapa.current) return;
      leaflet.current = L;
      const m = L.map(caja.current, { zoomControl: true, attributionControl: true }).setView(INICIO, 12);
      m.attributionControl.setPrefix(false);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      capa.current = L.layerGroup().addTo(m);
      mapa.current = m;
      setListo(true);
    });
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  // La caja cambia de alto al abrirse paneles y al girar el teléfono.
  useEffect(() => {
    if (!caja.current) return;
    const o = new ResizeObserver(() => mapa.current?.invalidateSize());
    o.observe(caja.current);
    return () => o.disconnect();
  }, []);

  useEffect(() => {
    const L = leaflet.current; const m = mapa.current; const c = capa.current;
    if (!listo || !L || !m || !c) return;
    c.clearLayers();
    for (const f of conPunto) {
      const estado = estadoSenal(f);
      const marca = L.marker([f.lat!, f.lng!], {
        title: f.nombre,
        zIndexOffset: estado === 'auxilio' ? 1000 : 0,
        icon: L.divIcon({
          className: '',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          html: `<span class="flex items-center justify-center w-[34px] h-[34px] rounded-full ring-2 shadow-md text-white text-[11px] font-semibold ${COLOR[estado] || COLOR.sin_senal} ${estado === 'auxilio' ? 'animate-pulse' : ''}">${escapar(iniciales(f.nombre))}</span>`,
        }),
      });
      marca.bindTooltip(escapar(f.nombre), { direction: 'top', offset: [0, -18] });
      if (onElegir) marca.on('click', () => onElegir(f.user_id));
      marca.addTo(c);
    }
    const quienes = conPunto.map((f) => f.user_id).sort().join();
    if (quienes && quienes !== encuadrados.current && !elegido) {
      m.fitBounds(L.latLngBounds(conPunto.map((f) => [f.lat!, f.lng!] as [number, number])), { padding: [48, 48], maxZoom: 15 });
    }
    encuadrados.current = quienes;
    // `conPunto` es nuevo en cada render: lo que cambia de verdad son las filas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, filas, onElegir]);

  // Ir a quien se eligió, una vez por elección: el refresco no debe volver a mover el mapa.
  const yaElegido = useRef<string | null>(null);
  useEffect(() => {
    if (!listo || elegido === yaElegido.current) return;
    const f = conPunto.find((x) => x.user_id === elegido);
    if (!elegido || f) yaElegido.current = elegido ?? null;
    if (f) mapa.current?.setView([f.lat!, f.lng!], Math.max(mapa.current.getZoom(), 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, elegido, filas]);

  return (
    // `isolate`: las capas de Leaflet usan z-index de hasta 1000 y no deben pasar sobre el panel.
    <div className={`relative isolate overflow-hidden rounded-lg border border-digi-border bg-digi-card ${className}`}>
      <div ref={caja} className="absolute inset-0" />
      {listo && conPunto.length === 0 && (
        <p className="absolute left-3 right-3 bottom-8 z-[1000] rounded-md border border-digi-border bg-digi-card px-3 py-2 text-center text-[13px] text-digi-muted" style={{ fontFamily: 'var(--font-body)' }}>
          Ningún miembro comparte su ubicación todavía.
        </p>
      )}
    </div>
  );
}
