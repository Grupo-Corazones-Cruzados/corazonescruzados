/**
 * LOS BENEFICIOS BAJO «POSTULARME» (Fernando, 2026-11-12). Una sola rejilla con todas las tarjetas
 * (icono, categoría, nombre, una línea); la categoría sale del grupo de `beneficiosCandidatos.ts`.
 * Los textos viven en `lib/sitio/beneficiosCandidatos.ts`. Sin cápsulas con relleno: «Próximamente» es
 * texto en color (regla de /diseno §4-septies).
 */

import {
  Repeat2, Captions, Printer, QrCode, CalendarDays, PartyPopper, BrainCircuit, AlarmClock, Ticket,
  ReceiptText, Store, IdCard, Swords, Coins, Users, Sparkles,
  HeartHandshake, Clapperboard, Wallet, Calculator, MessagesSquare,
  Award, Gauge, Mail, Smartphone, ShieldCheck, UserCheck, Workflow, Lightbulb, Compass, GraduationCap,
  type LucideIcon,
} from 'lucide-react';
import { BENEFICIOS_INTRO, GRUPOS_BENEFICIOS } from '@/lib/sitio/beneficiosCandidatos';
import { conNegritas } from './piezas';

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

      {/* UNA SOLA LISTA (Fernando, 2026-11-12: «que sea una sola lista con todos los beneficios»): cada
          tarjeta lleva arriba su categoría (y «Próximamente» si aún no está), en vez de bloques con título. */}
      <ul className="beneficios-rejilla">
        {GRUPOS_BENEFICIOS.flatMap((g) =>
          g.beneficios.map((b) => {
            const Icono = ICONOS[b.icono] ?? Sparkles;
            const proximo = g.proximamente || b.proximamente;
            return (
              <li key={`${g.id}-${b.titulo}`} className="beneficio">
                <span className="beneficio-icono" aria-hidden><Icono /></span>
                <p className="beneficio-categoria">
                  {g.etiqueta}
                  {proximo && <span className="beneficios-proximamente"> · Próximamente</span>}
                </p>
                <p className="beneficio-titulo">{b.titulo}</p>
                <p className="beneficio-texto">{b.texto}</p>
              </li>
            );
          }),
        )}
      </ul>
    </section>
  );
}
