'use client';

import { useEffect, useRef, useState } from 'react';
import type { Circle, Map as MapaLeaflet } from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Elegir el punto de un lugar tocando el mapa. El círculo enseña hasta dónde cuenta la llegada. */
export default function MapaElegirPunto({
  lat, lng, radio, inicio, onCambiar,
}: {
  lat: number | null;
  lng: number | null;
  radio: number;
  /** Dónde abrir si aún no hay punto. */
  inicio: [number, number];
  onCambiar: (lat: number, lng: number) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const circulo = useRef<Circle | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const alCambiar = useRef(onCambiar);
  alCambiar.current = onCambiar;
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let vivo = true;
    import('leaflet').then((L) => {
      if (!vivo || !caja.current || mapa.current) return;
      leaflet.current = L;
      const m = L.map(caja.current).setView(lat != null && lng != null ? [lat, lng] : inicio, 16);
      m.attributionControl.setPrefix(false);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on('click', (e) => alCambiar.current(e.latlng.lat, e.latlng.lng));
      mapa.current = m;
      setListo(true);
    });
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      circulo.current = null;
    };
    // Solo al abrir: los cambios de punto no deben recolocar la vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!caja.current) return;
    const o = new ResizeObserver(() => mapa.current?.invalidateSize());
    o.observe(caja.current);
    return () => o.disconnect();
  }, []);

  useEffect(() => {
    const L = leaflet.current; const m = mapa.current;
    if (!listo || !L || !m || lat == null || lng == null) return;
    if (!circulo.current) {
      circulo.current = L.circle([lat, lng], { radius: radio, color: '#4B2D8E', weight: 2, fillOpacity: 0.15, interactive: false }).addTo(m);
    } else {
      circulo.current.setLatLng([lat, lng]);
      circulo.current.setRadius(radio);
    }
  }, [listo, lat, lng, radio]);

  return (
    <div className="relative isolate overflow-hidden rounded-md border border-digi-border h-72">
      <div ref={caja} className="absolute inset-0 cursor-crosshair" />
    </div>
  );
}
