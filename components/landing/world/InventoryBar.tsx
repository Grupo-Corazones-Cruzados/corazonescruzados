'use client';

import { findItem, itemDataUrl } from './items';

// Minecraft-style hotbar that's always visible at the bottom of the
// screen. Renders `maxSlots` cells in a fixed order; each cell can be
// activated by clicking it or by pressing its number key (1-9, then 0
// for the 10th). The slot with the equipped item gets the gold ring.
export default function InventoryBar({
  inventory,
  equipped,
  maxSlots,
  onEquip,
}: {
  inventory: Record<string, number>;
  equipped: string | null;
  maxSlots: number;
  onEquip: (id: string | null) => void;
}) {
  const entries = Object.entries(inventory).filter(([, qty]) => qty > 0);
  // Pad with empty slots so the bar shape stays constant.
  const slots: ([string, number] | null)[] = Array.from(
    { length: maxSlots },
    (_, i) => entries[i] ?? null,
  );
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
      {slots.map((entry, i) => {
        const hotkey = i === 9 ? '0' : String(i + 1);
        if (!entry) {
          return (
            <SlotShell key={i} active={false} hotkey={hotkey}>
              <div style={{ width: '100%', height: '100%' }} />
            </SlotShell>
          );
        }
        const [id, qty] = entry;
        const def = findItem(id);
        if (!def) {
          return (
            <SlotShell key={i} active={false} hotkey={hotkey}>
              <div style={{ width: '100%', height: '100%' }} />
            </SlotShell>
          );
        }
        const isEquipped = equipped === id;
        return (
          <SlotShell
            key={i}
            active={isEquipped}
            hotkey={hotkey}
            onClick={() => onEquip(isEquipped ? null : id)}
            title={`${def.label} ×${qty}${isEquipped ? ' (equipado)' : ''} · [${hotkey}]`}
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
          </SlotShell>
        );
      })}
    </div>
  );
}

function SlotShell({
  active,
  hotkey,
  onClick,
  title,
  children,
}: {
  active: boolean;
  hotkey: string;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        background: '#0a0a14',
        border: active
          ? '2px solid #ffcc00'
          : '2px solid rgba(75,45,142,0.6)',
        cursor: onClick ? 'pointer' : 'default',
        padding: 4,
        boxShadow: active ? '0 0 8px #ffcc00' : 'none',
      }}
    >
      {children}
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: 3,
          fontFamily: "'Silkscreen', cursive",
          fontSize: '0.5rem',
          color: active ? '#ffcc00' : 'rgba(225,215,255,0.55)',
          letterSpacing: '0.04em',
          pointerEvents: 'none',
        }}
      >
        {hotkey}
      </span>
    </Tag>
  );
}
