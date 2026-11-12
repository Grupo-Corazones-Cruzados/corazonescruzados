/**
 * LOS BENEFICIOS BAJO «POSTULARME» (Fernando, 2026-11-12). Un bloque por grupo (su `etiqueta` de
 * `beneficiosCandidatos.ts` como título) y, dentro, una galería horizontal de tarjetas (`GaleriaBeneficios`).
 * Los textos viven en `lib/sitio/beneficiosCandidatos.ts`. Sin «Próximamente» (Fernando, 2026-11-12).
 */

import {
  Repeat2, Captions, Printer, QrCode, CalendarDays, PartyPopper, BrainCircuit, AlarmClock, Ticket,
  ReceiptText, Store, IdCard, Swords, Coins, Users, Sparkles,
  HeartHandshake, Clapperboard, Wallet, Calculator, MessagesSquare,
  Award, Gauge, Mail, Smartphone, ShieldCheck, UserCheck, Workflow, Lightbulb, Compass, GraduationCap,
  LayoutDashboard, Gamepad2, Wrench, Rocket, Sprout,
  type LucideIcon,
} from 'lucide-react';
import { BENEFICIOS_INTRO, GRUPOS_BENEFICIOS } from '@/lib/sitio/beneficiosCandidatos';
import { conNegritas } from './piezas';
import GaleriaBeneficios from './GaleriaBeneficios';

const ICONO_GRUPO: Record<string, LucideIcon> = {
  progreso: LayoutDashboard, videojuego: Gamepad2, herramientas: Wrench, ingresos: Award,
  emprendimiento: Rocket, aprendizaje: GraduationCap, miembros: Sprout,
};

const ICONOS: Record<string, LucideIcon> = {
  Repeat2, Captions, Printer, QrCode, CalendarDays, PartyPopper, BrainCircuit, AlarmClock, Ticket,
  ReceiptText, Store, IdCard, Swords, Coins, Users, Sparkles,
  HeartHandshake, Clapperboard, Wallet, Calculator, MessagesSquare,
  Award, Gauge, Mail, Smartphone, ShieldCheck, UserCheck, Workflow, Lightbulb, Compass, GraduationCap,
};

export default function BeneficiosCandidatos() {
  return (
    <section className="beneficios" aria-labelledby="beneficios-titulo">
      <header className="beneficios-cabecera">
        <p className="beneficios-etiqueta">{BENEFICIOS_INTRO.etiqueta}</p>
        <h2 id="beneficios-titulo" className="beneficios-titulo">{BENEFICIOS_INTRO.titulo}</h2>
        <p className="beneficios-texto">{conNegritas(BENEFICIOS_INTRO.texto)}</p>
      </header>

      {/* Por grupos, cada uno una galería horizontal (Fernando, 2026-11-12). */}
      <div className="galerias">
        {GRUPOS_BENEFICIOS.map((g) => {
          const IconoGrupo = ICONO_GRUPO[g.id] ?? Sparkles;
          return (
            <GaleriaBeneficios key={g.id} titulo={g.etiqueta} icono={<IconoGrupo />} cuenta={g.beneficios.length}>
              {g.beneficios.map((b) => {
                const Icono = ICONOS[b.icono] ?? Sparkles;
                return (
                  <li key={b.titulo} className="beneficio">
                    <span className="beneficio-icono" aria-hidden><Icono /></span>
                    <p className="beneficio-titulo">{b.titulo}</p>
                    <p className="beneficio-texto">{b.texto}</p>
                  </li>
                );
              })}
            </GaleriaBeneficios>
          );
        })}
      </div>
    </section>
  );
}
