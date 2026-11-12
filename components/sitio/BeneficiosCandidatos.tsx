/**
 * LOS BENEFICIOS BAJO «POSTULARME» (Fernando, 2026-11-12). Cuatro bloques —módulos de Progreso,
 * videojuego, herramientas y, al final, lo que abre ser miembro—, cada uno con su rótulo y una rejilla de tarjetas (icono, nombre, una línea).
 * Los textos viven en `lib/sitio/beneficiosCandidatos.ts`. Sin cápsulas con relleno: «Próximamente» es
 * texto en color (regla de /diseno §4-septies).
 */

import {
  Repeat2, Captions, Printer, QrCode, CalendarDays, PartyPopper, BrainCircuit, AlarmClock, Ticket,
  ReceiptText, Store, IdCard, Swords, Coins, Users, Sparkles, Wrench, LayoutDashboard, Gamepad2,
  HeartHandshake, Clapperboard, Wallet, Calculator, MessagesSquare, BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import { BENEFICIOS_INTRO, GRUPOS_BENEFICIOS } from '@/lib/sitio/beneficiosCandidatos';
import { conNegritas } from './piezas';

const ICONOS: Record<string, LucideIcon> = {
  Repeat2, Captions, Printer, QrCode, CalendarDays, PartyPopper, BrainCircuit, AlarmClock, Ticket,
  ReceiptText, Store, IdCard, Swords, Coins, Users, Sparkles,
  HeartHandshake, Clapperboard, Wallet, Calculator, MessagesSquare,
};
const ICONO_GRUPO: Record<string, LucideIcon> = { herramientas: Wrench, progreso: LayoutDashboard, videojuego: Gamepad2, miembros: BadgeCheck };

export default function BeneficiosCandidatos() {
  return (
    <section className="beneficios" aria-labelledby="beneficios-titulo">
      <header className="beneficios-cabecera">
        <p className="beneficios-etiqueta">{BENEFICIOS_INTRO.etiqueta}</p>
        <h2 id="beneficios-titulo" className="beneficios-titulo">{BENEFICIOS_INTRO.titulo}</h2>
        <p className="beneficios-texto">{conNegritas(BENEFICIOS_INTRO.texto)}</p>
      </header>

      {GRUPOS_BENEFICIOS.map((g, i) => {
        const IconoGrupo = ICONO_GRUPO[g.id] ?? Sparkles;
        return (
          <div key={g.id} className="beneficios-grupo">
            <div className="beneficios-grupo-cabecera">
              <span className="beneficios-grupo-icono" aria-hidden><IconoGrupo /></span>
              <div>
                <p className="beneficios-grupo-num">
                  {String(i + 1).padStart(2, '0')} · {g.etiqueta}
                  {g.proximamente && <span className="beneficios-proximamente"> · Próximamente</span>}
                </p>
                <h3 className="beneficios-grupo-titulo">{g.titulo}</h3>
                <p className="beneficios-grupo-texto">{g.texto}</p>
              </div>
            </div>
            <ul className="beneficios-rejilla">
              {g.beneficios.map((b) => {
                const Icono = ICONOS[b.icono] ?? Sparkles;
                return (
                  <li key={b.titulo} className="beneficio">
                    <span className="beneficio-icono" aria-hidden><Icono /></span>
                    <p className="beneficio-titulo">{b.titulo}{b.proximamente && <span className="beneficios-proximamente"> · Próximamente</span>}</p>
                    <p className="beneficio-texto">{b.texto}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
