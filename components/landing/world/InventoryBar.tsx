'use client';

import { findItem, itemDataUrl } from './items';

export default function InventoryBar({
  inventory,
  equipped,
  onEquip,
}: {
  inventory: Record<string, number>;
  equipped: string | null;
  onEquip: (id: string | null) => void;
}) {
  const entries = Object.entries(inventory).filter(([, qty]) => qty > 0);
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99996,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: 8,
        background: 'rgba(19, 25, 35, 0.92)',
        border: '2px solid var(--color-accent)',
        boxShadow: '4px 4px 0 rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          fontFamily: "'Silkscreen', cursive",
          fontSize: '0.55rem',
          letterSpacing: '0.18em',
          color: 'rgba(225,215,255,0.7)',
          textTransform: 'uppercase',
          padding: '0 6px',
        }}
      >
        Inventario
      </div>
      {entries.length === 0 ? (
        <div
          style={{
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.55rem',
            color: 'rgba(225,215,255,0.4)',
            padding: '0 8px',
          }}
        >
          (vacío)
        </div>
      ) : (
        entries.map(([id, qty]) => {
          const def = findItem(id);
          if (!def) return null;
          const isEquipped = equipped === id;
          return (
            <button
              key={id}
              type="button"
              title={`${def.label} ×${qty}${isEquipped ? ' (equipado)' : ''}`}
              onClick={() => onEquip(isEquipped ? null : id)}
              style={{
                position: 'relative',
                width: 44,
                height: 44,
                background: '#0a0a14',
                border: isEquipped
                  ? '2px solid #ffcc00'
                  : '2px solid rgba(75,45,142,0.6)',
                cursor: 'pointer',
                padding: 4,
                boxShadow: isEquipped ? '0 0 8px #ffcc00' : 'none',
              }}
            >
              <img
                src={itemDataUrl(def)}
                alt={def.label}
                style={{
                  width: '100%',
                  height: '100%',
                  imageRendering: 'pixelated',
                  display: 'block',
                }}
              />
              {qty > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    fontFamily: "'Silkscreen', cursive",
                    fontSize: '0.55rem',
                    color: '#fff',
                    background: '#0a0a14',
                    padding: '0 3px',
                    border: '1px solid #444',
                  }}
                >
                  ×{qty}
                </div>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
