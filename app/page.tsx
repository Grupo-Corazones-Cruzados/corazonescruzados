'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import PixelStars from '@/components/landing/PixelStars';
import BrandLoader from '@/components/ui/BrandLoader';

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* ====== HERO ====== */}
      <section className="relative min-h-[90vh] flex items-center justify-center text-center px-6 overflow-hidden">
        <PixelStars count={50} />

        {/* Decorative pixel corners */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-3 border-l-3 border-accent/30" />
        <div className="absolute top-4 right-4 w-8 h-8 border-t-3 border-r-3 border-accent/30" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-3 border-l-3 border-accent/30" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-3 border-r-3 border-accent/30" />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Pixel art badge */}
          <div
            className="inline-block px-4 py-1.5 mb-6 text-accent-glow border-2 border-accent/40 bg-accent/10"
            style={{
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.65rem',
              letterSpacing: '0.15em',
              animation: 'glitchFlicker 4s ease-in-out infinite',
            }}
          >
            SISTEMA DIGITAL ACTIVADO
          </div>

          <h1 className="pixel-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight">
            Un Coraz&oacute;n puede
            <br />
            <span
              className="pixel-glow"
              style={{
                background: 'linear-gradient(135deg, #4B2D8E 0%, #A1207D 50%, #7B5FBF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 20px rgba(75, 45, 142, 0.4))',
              }}
            >
              <span style={{ WebkitTextFillColor: '#ef4444', filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))' }}>cruzar</span> al mundo.
            </span>
          </h1>

          <p
            className="mt-5 text-lg md:text-xl opacity-60"
            style={{
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
              color: '#94A3B8',
            }}
          >
            Proyecto de Desarrollo Humano
          </p>

          {/* Hero buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
            <Link href="/auth?tab=register">
              <button className="pixel-btn pixel-btn-primary">
                Comenzar Gratis
              </button>
            </Link>
            <Link href="#servicios">
              <button className="pixel-btn pixel-btn-secondary">
                Conocer M&aacute;s
              </button>
            </Link>
          </div>

        </div>
      </section>

      {/* ====== PIXEL DIVIDER ====== */}
      <div className="pixel-divider" />

      {/* ====== SERVICIOS ====== */}
      <section id="servicios" className="relative py-20 md:py-28 px-6 pixel-grid-bg">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="pixel-heading text-2xl md:text-3xl text-white">
              Servicios
            </h2>
            <div className="w-16 h-1 bg-accent mx-auto mt-3" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ServiceCard
              icon="?"
              title="Descubrimos el talento de las personas"
              accent="a trav&eacute;s de su prop&oacute;sito"
              delay={0}
            />
            <ServiceCard
              icon="&hearts;"
              title="Ofrecemos lo mejor que tenemos"
              accent="para quienes m&aacute;s lo necesitan"
              delay={0.1}
            />
            <ServiceCard
              icon="&check;"
              title="Entregamos y garantizamos"
              accent="soluciones de calidad para tus problemas"
              delay={0.2}
            />
            <ServiceCard
              icon="&uarr;"
              title="Aplicamos una metodolog&iacute;a moderna y humanizada"
              accent="para un progreso continuo y satisfactorio"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* ====== PIXEL DIVIDER ====== */}
      <div className="pixel-divider" />

      {/* ====== EQUIPO ====== */}
      <section id="equipo" className="relative py-20 md:py-28 px-6">
        <PixelStars count={20} />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <h2 className="pixel-heading text-2xl md:text-3xl text-white">
              Nuestro Equipo
            </h2>
            <p
              className="mt-3 text-sm opacity-50"
              style={{ fontFamily: "'Silkscreen', cursive", color: '#94A3B8' }}
            >
              Conoce a los profesionales que te acompa&ntilde;ar&aacute;n
            </p>
            <div className="w-16 h-1 bg-accent mx-auto mt-3" />
          </div>

          <MemberGallery />
        </div>
      </section>

      {/* ====== PIXEL DIVIDER ====== */}
      <div className="pixel-divider" />

      {/* ====== FAQ ====== */}
      <section id="faq" className="relative py-20 md:py-28 px-6 pixel-grid-bg">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="pixel-heading text-2xl md:text-3xl text-white">
              Preguntas Frecuentes
            </h2>
            <div className="w-16 h-1 bg-accent mx-auto mt-3" />
          </div>

          <div className="flex flex-col gap-2">
            <details className="pixel-faq">
              <summary>&iquest;Qu&eacute; es GCC World?</summary>
              <p className="pixel-faq-answer">
                Es una plataforma de desarrollo humano que conecta personas que
                buscan soluciones con profesionales capacitados. Puedes agendar
                consultor&iacute;as, publicar proyectos o adquirir productos y
                servicios del marketplace, todo desde un solo lugar.
              </p>
            </details>
            <details className="pixel-faq">
              <summary>&iquest;Qu&eacute; servicios puedo encontrar?</summary>
              <p className="pixel-faq-answer">
                Puedes agendar sesiones individuales con un profesional a trav&eacute;s
                de tickets, publicar proyectos para recibir propuestas de
                nuestro equipo, o explorar el marketplace donde encontrar&aacute;s
                productos y trabajos listos para adquirir.
              </p>
            </details>
            <details className="pixel-faq">
              <summary>&iquest;La plataforma es gratuita?</summary>
              <p className="pixel-faq-answer">
                Crear tu cuenta y explorar la plataforma es completamente gratis.
                Solo pagas cuando contratas un servicio, apruebas una propuesta
                de proyecto o realizas una compra en el marketplace.
              </p>
            </details>
            <details className="pixel-faq">
              <summary>&iquest;C&oacute;mo me registro y comienzo?</summary>
              <p className="pixel-faq-answer">
                Haz clic en &quot;Comenzar Gratis&quot;, completa tus datos y
                verifica tu correo electr&oacute;nico. Una vez dentro, podr&aacute;s explorar
                los servicios disponibles, agendar tickets, publicar proyectos y
                comprar en el marketplace desde tu panel de control.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ====== PIXEL DIVIDER ====== */}
      <div className="pixel-divider" />

      {/* ====== CTA ====== */}
      <section className="relative py-20 md:py-28 px-6 text-center overflow-hidden">
        <PixelStars count={30} />
        <div className="relative z-10">
          <h2 className="pixel-heading text-2xl md:text-3xl text-white">
            &iquest;Listo para comenzar?
          </h2>
          <p
            className="mt-3 opacity-50"
            style={{ fontFamily: "'Silkscreen', cursive", fontSize: '0.75rem', color: '#94A3B8' }}
          >
            Crea tu cuenta gratis y gestiona todo desde un solo lugar.
          </p>
          <div className="mt-8">
            <Link href="/auth?tab=register">
              <button
                className="pixel-btn pixel-btn-primary"
                style={{ animation: 'pixelBorderPulse 2s ease-in-out infinite' }}
              >
                Crear Cuenta Gratis
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t-2 border-accent/20 py-8 px-6 text-center">
        <p
          className="opacity-30"
          style={{ fontFamily: "'Silkscreen', cursive", fontSize: '0.65rem', color: '#7B5FBF' }}
        >
          &copy; 2026 GCC World &mdash; Todos los derechos reservados
        </p>
        <div className="flex justify-center gap-6 mt-3">
          <Link
            href="/dashboard"
            className="opacity-40 hover:opacity-80 transition-opacity"
            style={{ fontFamily: "'Silkscreen', cursive", fontSize: '0.6rem', color: '#7B5FBF' }}
          >
            Dashboard
          </Link>
          <Link
            href="/world"
            className="opacity-40 hover:opacity-80 transition-opacity"
            style={{ fontFamily: "'Silkscreen', cursive", fontSize: '0.6rem', color: '#7B5FBF' }}
          >
            DigiMundo
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ─── Service Card ─── */
function ServiceCard({
  icon,
  title,
  accent,
  delay,
}: {
  icon: string;
  title: string;
  accent: string;
  delay: number;
}) {
  return (
    <div
      className="pixel-card flex flex-col items-center text-center"
      style={{ animationDelay: `${delay}s` }}
    >
      <div
        className="w-14 h-14 flex items-center justify-center mb-5 border-2 border-accent/40 bg-accent/10 text-accent-glow text-2xl"
        style={{ fontFamily: "'Silkscreen', cursive" }}
      >
        {icon}
      </div>
      <h3
        className="text-sm text-white leading-relaxed"
        style={{ fontFamily: "'Silkscreen', cursive" }}
      >
        {title}{' '}
        <span className="text-accent-glow" dangerouslySetInnerHTML={{ __html: accent }} />
      </h3>
    </div>
  );
}

/* ─── Member Gallery (real data from DB) ─── */

interface PublicMember {
  id: number;
  name: string;
  phone: string | null;
  photo_url: string | null;
  position: string | null;
  bio: string | null;
  skills: string[] | null;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatWhatsAppUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

function MemberGallery() {
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/members/public')
      .then(r => r.json())
      .then(json => setMembers(json.data ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <BrandLoader size="md" label="Cargando equipo..." />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <p
        className="text-center opacity-40"
        style={{ fontFamily: "'Silkscreen', cursive", fontSize: '0.75rem', color: '#7B5FBF' }}
      >
        Pr&oacute;ximamente conocer&aacute;s a nuestro equipo...
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {members.map((m, i) => {
        return (
          <div
            key={m.id}
            className="pixel-card flex flex-col items-center text-center py-6 px-5"
            style={{ animation: `pixelFadeIn 0.4s ease-out ${i * 0.1}s both` }}
          >
            {/* Member photo or initials */}
            {m.photo_url ? (
              <img
                src={m.photo_url}
                alt={m.name}
                className="w-20 h-20 object-cover border-2 border-accent/50 mb-4"
                style={{ imageRendering: 'auto' }}
              />
            ) : (
              <div
                className="w-20 h-20 flex items-center justify-center bg-accent/20 border-2 border-accent/50 text-accent-glow text-xl mb-4"
                style={{ fontFamily: "'Silkscreen', cursive" }}
              >
                {getInitials(m.name)}
              </div>
            )}

            {/* Name */}
            <h3
              className="text-xs text-white"
              style={{ fontFamily: "'Silkscreen', cursive" }}
            >
              {m.name}
            </h3>

            {/* Position */}
            {m.position && (
              <p
                className="text-[10px] mt-1 text-accent-glow"
                style={{ fontFamily: "'Silkscreen', cursive" }}
              >
                {m.position}
              </p>
            )}

            {/* Bio */}
            {m.bio && (
              <p className="text-xs text-digi-muted mt-2 leading-relaxed line-clamp-2">
                {m.bio}
              </p>
            )}

            {/* Skills */}
            {m.skills && m.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                {m.skills.slice(0, 4).map(skill => (
                  <span
                    key={skill}
                    className="text-[9px] px-2 py-0.5 border border-accent/30 bg-accent/10 text-accent-glow"
                    style={{ fontFamily: "'Silkscreen', cursive" }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              <a
                href={`/members/${m.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-accent-glow text-[10px] border-2 border-accent/40 transition-all hover:bg-accent/10"
                style={{ fontFamily: "'Silkscreen', cursive", boxShadow: '3px 3px 0 rgba(0,0,0,0.3)' }}
              >
                Ver perfil
              </a>
              {m.phone && (
                <a
                  href={formatWhatsAppUrl(m.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-[10px] border-2 transition-all hover:brightness-110"
                  style={{
                    fontFamily: "'Silkscreen', cursive",
                    background: '#25d366',
                    borderColor: '#1da851',
                    boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Contactar
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

