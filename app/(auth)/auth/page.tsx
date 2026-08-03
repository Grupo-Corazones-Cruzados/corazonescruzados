/**
 * /auth — el selector: ¿quién eres?
 *
 * Dejó de ser un formulario. Era una puerta única para clientes, miembros y candidatos, y
 * no distinguía nada: quien se equivocaba de cuenta se enteraba tarde y sin explicación.
 * Ahora reparte hacia la puerta que corresponde, y cada una comprueba en el servidor que
 * la cuenta encaje.
 *
 * ⚠️ La URL `/auth` NO se retira: está enlazada desde correos, guardada en marcadores y
 * declarada en sitios que no controlamos. Se convierte en la antesala, no desaparece.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { PERFILES, type TipoCuenta } from '@/lib/auth/tipos';

export const metadata: Metadata = { title: 'Acceso · GCC World', robots: { index: false } };

const ORDEN: TipoCuenta[] = ['cliente', 'miembro', 'candidato'];

export default function SelectorDeAcceso() {
  return (
    <div className="corp dark w-full max-w-[440px]">
      <div className="bg-digi-card border border-digi-border rounded-lg shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-digi-border">
          <h1 className="text-[17px] font-semibold text-digi-text leading-tight"
              style={{ fontFamily: 'var(--font-body)' }}>
            Entrar a GCC World
          </h1>
          <p className="mt-0.5 text-[12.5px] text-digi-muted leading-relaxed"
             style={{ fontFamily: 'var(--font-body)' }}>
            Elige el tipo de cuenta con el que vas a entrar.
          </p>
        </div>

        <div className="bg-digi-darker p-3 space-y-2">
          {ORDEN.map((tipo) => {
            const p = PERFILES[tipo];
            return (
              <Link
                key={tipo} href={`/auth/${tipo}`}
                className="block rounded-md border border-digi-border bg-digi-card px-4 py-3
                           hover:border-accent hover:bg-accent-light transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span className="block text-[13.5px] font-semibold text-digi-text">{p.titulo}</span>
                <span className="block text-[12px] text-digi-muted mt-0.5 leading-relaxed">{p.subtitulo}</span>
              </Link>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t border-digi-border">
          <Link href="/"
            className="block text-center text-[12.5px] text-digi-muted hover:text-accent transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
