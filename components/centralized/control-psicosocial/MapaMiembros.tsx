'use client';

import { useEffect, useRef, useState } from 'react';
import type { LayerGroup, Map as MapaLeaflet } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { estadoSenal, type FilaRastreo, type Lugar, type RecorridoMiembro } from '@/lib/centralized/control-psicosocial';

/**
 * Un color por persona, el mismo en su marca y en su recorrido. Es la única paleta fuera de los tokens
 * del tema: el mapa no cambia con el tema y todos dan al menos 4,5:1 con texto blanco.
 */
const COLORES = ['#4B2D8E', '#0F766E', '#B45309', '#1D4ED8', '#BE185D', '#4D7C0F', '#7C2D12', '#0E7490'];
const ROJO_AUXILIO = '#B3261E';
const GRIS_SIN_SENAL = '#6B7280';
export function colorDe(userId: string): string {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

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
  filas, lugares = [], recorridos = [], elegido, onElegir, panelAbierto = false, enfocar, className = '',
}: {
  /** Un panel tapa parte del mapa: al ir a alguien, se encuadra en lo que queda libre. */
  panelAbierto?: boolean;
  /** Llevar el mapa a un punto (al elegir un lugar). `n` cambia en cada petición. */
  enfocar?: { lat: number; lng: number; n: number } | null;
  filas: FilaRastreo[];
  lugares?: Lugar[];
  recorridos?: RecorridoMiembro[];
  elegido?: string | null;
  onElegir?: (userId: string) => void;
  className?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const capa = useRef<LayerGroup | null>(null);
  const capaFondo = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const encuadrados = useRef('');
  const [listo, setListo] = useState(false);
  const conPunto = filas.filter((f) => f.lat != null && f.lng != null);

  useEffect(() => {
    let vivo = true;
    import('leaflet').then((L) => {
      if (!vivo || !caja.current || mapa.current) return;
      leaflet.current = L;
      // En el teléfono se acerca con los dedos: los botones solo quitarían mapa.
      const m = L.map(caja.current, { zoomControl: false, attributionControl: true }).setView(INICIO, 12);
      if (!L.Browser.mobile) L.control.zoom({ position: 'topright' }).addTo(m);
      m.attributionControl.setPrefix(false);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      capaFondo.current = L.layerGroup().addTo(m);
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
          html: `<span style="background:${estado === 'auxilio' ? ROJO_AUXILIO : estado === 'activa' ? colorDe(f.user_id) : GRIS_SIN_SENAL}" class="flex items-center justify-center w-[34px] h-[34px] rounded-full ring-2 ring-white shadow-md text-white text-[11px] font-semibold ${estado === 'auxilio' ? 'animate-pulse' : ''}">${escapar(iniciales(f.nombre))}</span>`,
        }),
      });
      marca.bindTooltip(escapar(f.nombre), { direction: 'top', offset: [0, -18] });
      if (onElegir) marca.on('click', () => onElegir(f.user_id));
      marca.addTo(c);
    }
    const fondo = capaFondo.current;
    fondo?.clearLayers();
    if (fondo) {
      for (const l of lugares) {
        L.circle([l.lat, l.lng], { radius: l.radio_m, color: '#4B2D8E', weight: 2, dashArray: '6 4', fillOpacity: 0.1, interactive: false }).addTo(fondo);
        // En el borde norte del círculo: en el centro taparía la marca de quien está allí.
        L.tooltip({ permanent: true, direction: 'top', className: 'cp-lugar' })
          .setLatLng([l.lat + l.radio_m / 111_000, l.lng]).setContent(escapar(l.nombre)).addTo(fondo);
      }
      for (const r of recorridos) {
        if (r.puntos.length < 2) continue;
        const destacada = !elegido || elegido === r.user_id;
        const linea = L.polyline(r.puntos.map((p) => [p.lat, p.lng] as [number, number]), {
          color: colorDe(r.user_id), weight: elegido === r.user_id ? 5 : 3, opacity: destacada ? 0.85 : 0.2,
        });
        linea.bindTooltip(escapar(r.nombre), { sticky: true });
        if (onElegir) linea.on('click', () => onElegir(r.user_id));
        linea.addTo(fondo);
        // Dónde empezó el día: un círculo hueco.
        L.circleMarker([r.puntos[0].lat, r.puntos[0].lng], {
          radius: 5, color: colorDe(r.user_id), weight: 3, fillColor: '#ffffff', fillOpacity: 1, opacity: destacada ? 1 : 0.2, interactive: false,
        }).addTo(fondo);
      }
    }
    const quienes = conPunto.map((f) => f.user_id).sort().join();
    if (quienes && quienes !== encuadrados.current && !elegido) {
      m.fitBounds(L.latLngBounds(conPunto.map((f) => [f.lat!, f.lng!] as [number, number])), { paddingTopLeft: [48, 48], paddingBottomRight: [48, 96], maxZoom: 15 });
    }
    encuadrados.current = quienes;
    // `conPunto` es nuevo en cada render: lo que cambia de verdad son las filas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, filas, lugares, recorridos, elegido, onElegir]);

  // Ir a quien se eligió, una vez por elección: el refresco no debe volver a mover el mapa.
  const yaElegido = useRef<string | null>(null);
  useEffect(() => {
    if (!listo || elegido === yaElegido.current) return;
    const f = conPunto.find((x) => x.user_id === elegido);
    if (!elegido || f) yaElegido.current = elegido ?? null;
    const r = recorridos.find((x) => x.user_id === elegido);
    const L = leaflet.current;
    const puntos: [number, number][] = r && r.puntos.length > 1
      ? r.puntos.map((p) => [p.lat, p.lng])
      : f ? [[f.lat!, f.lng!]] : [];
    if (puntos.length && L && mapa.current && caja.current) {
      const ancho = window.matchMedia('(min-width: 48rem)').matches;
      mapa.current.fitBounds(L.latLngBounds(puntos), {
        paddingTopLeft: [48, 48],
        // Columna de 360 px a la derecha, o la hoja de abajo (hasta el 58 % del alto).
        paddingBottomRight: panelAbierto
          ? (ancho ? [400, 48] : [48, caja.current.clientHeight * 0.58 + 76])
          : [48, 96],
        maxZoom: 16,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, elegido, filas]);

  useEffect(() => {
    if (enfocar && mapa.current) mapa.current.setView([enfocar.lat, enfocar.lng], Math.max(mapa.current.getZoom(), 16));
  }, [enfocar]);

  return (
    // `isolate`: las capas de Leaflet usan z-index de hasta 1000 y no deben pasar sobre el panel.
    <div className={`isolate overflow-hidden bg-digi-card ${className}`}>
      <div ref={caja} className="absolute inset-0" />
      {listo && conPunto.length === 0 && (
        <p className="absolute left-3 right-3 top-16 z-[1000] md:left-1/2 md:right-auto md:-translate-x-1/2 rounded-md border border-digi-border bg-digi-card px-3 py-2 text-center text-[13px] text-digi-muted" style={{ fontFamily: 'var(--font-body)' }}>
          Ningún miembro comparte su ubicación todavía.
        </p>
      )}
    </div>
  );
}
