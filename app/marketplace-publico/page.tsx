'use client';

import { useState } from 'react';
import MarketplaceCatalog from '@/components/marketplace/MarketplaceCatalog';
import PixelModal from '@/components/ui/PixelModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Lock, LogIn, ShoppingBag } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

// Lleva al flujo "Colaborar → Ingresar como cliente" de la landing (mismo modal de
// login que ya tiene la opción de crear cuenta de cliente) y, tras iniciar sesión,
// devuelve al usuario al marketplace completo del dashboard.
const goToLogin = () => { window.location.href = '/?acceso=cliente'; };
// Ya con sesión: al marketplace interno (privado) del panel.
const goToMarketplace = () => { window.location.href = '/dashboard/marketplace'; };

export default function PublicMarketplacePage() {
  const { user } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);

  // Acción principal de un registro seleccionado: con sesión abierta va directo al
  // marketplace interno; sin sesión, muestra el aviso "solo para clientes".
  const handlePrimaryAction = () => { if (user) goToMarketplace(); else setGateOpen(true); };

  return (
    <div className="corp min-h-screen flex flex-col">
      {/* ── Top bar (sin menú de módulos) ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 md:px-6 h-14 bg-digi-card border-b border-digi-border">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="GCC World" className="w-8 h-8 rounded-full shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-digi-text leading-none truncate" style={df}>GCC WORLD</p>
            <p className="text-[11px] text-digi-muted leading-none mt-1 truncate" style={mf}>Marketplace</p>
          </div>
        </div>
        {user ? (
          <a href="/dashboard/marketplace" className={`${BTN_PRIMARY} shrink-0`}>
            <ShoppingBag className="w-4 h-4" /> Ir al marketplace
          </a>
        ) : (
          <button onClick={goToLogin} className={`${BTN_PRIMARY} shrink-0`}>
            <LogIn className="w-4 h-4" /> Iniciar sesión / Crear cuenta
          </button>
        )}
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="mb-4">
          <h1 className="text-[18px] font-semibold text-digi-text" style={df}>Marketplace</h1>
          <p className="text-[13px] text-digi-muted mt-0.5" style={mf}>
            Explora los proyectos, productos y automatizaciones del grupo. Para solicitar o comprar necesitas una cuenta de cliente.
          </p>
        </div>

        <MarketplaceCatalog onPrimaryAction={handlePrimaryAction} />
      </main>

      {/* ── Gate: solo clientes pueden solicitar/comprar ── */}
      <PixelModal open={gateOpen} onClose={() => setGateOpen(false)} title="Acceso solo para clientes">
        <div className="space-y-4">
          <div className="w-11 h-11 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-accent" />
          </div>
          <p className="text-[13px] text-digi-text leading-relaxed" style={mf}>
            Solo nuestros clientes pueden realizar solicitudes y compras de proyectos, productos y
            automatizaciones. Para acceder al marketplace y solicitar lo que necesitas, crea tu cuenta de cliente.
          </p>
          <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
            Una vez inicies sesión tendrás acceso completo al marketplace desde tu panel.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {user ? (
              <button onClick={goToMarketplace} className={`${BTN_PRIMARY} flex-1`}>
                <ShoppingBag className="w-4 h-4" /> Ir al marketplace
              </button>
            ) : (
              <button onClick={goToLogin} className={`${BTN_PRIMARY} flex-1`}>
                <LogIn className="w-4 h-4" /> Iniciar sesión / Crear cuenta
              </button>
            )}
            <button onClick={() => setGateOpen(false)} className={`${BTN_SECONDARY} flex-1`}>
              Seguir explorando
            </button>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}
