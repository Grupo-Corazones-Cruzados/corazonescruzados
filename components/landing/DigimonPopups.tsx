'use client';

import { useEffect, useState, useCallback } from 'react';
import useDigimonConfigs, { getDigimonMessage, type DigimonConfig } from './useDigimonConfigs';

interface Popup {
  id: number;
  digimon: DigimonConfig;
  message: string;
  side: 'left' | 'right' | 'bottom';
  position: number;
}

let popupId = 0;

export default function DigimonPopups() {
  const configs = useDigimonConfigs();
  const [popups, setPopups] = useState<Popup[]>([]);

  const spawnPopup = useCallback(() => {
    if (configs.length === 0) return;
    const digimon = configs[Math.floor(Math.random() * configs.length)];
    const sides: Popup['side'][] = ['left', 'right', 'bottom'];
    const popup: Popup = {
      id: popupId++,
      digimon,
      message: getDigimonMessage(digimon.name),
      side: sides[Math.floor(Math.random() * sides.length)],
      position: 20 + Math.random() * 60,
    };
    setPopups(prev => [...prev, popup]);
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== popup.id)), 4500);
  }, [configs]);

  useEffect(() => {
    if (configs.length === 0) return;
    const first = setTimeout(spawnPopup, 5000);
    const interval = setInterval(spawnPopup, 10000 + Math.random() * 10000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [spawnPopup, configs.length]);

  return (
    <>
      {popups.map(popup => {
        const posStyle = getPopupPosition(popup);
        return (
          <div
            key={popup.id}
            className="fixed z-45 pointer-events-none"
            style={{ ...posStyle, animation: 'digiPeekIn 4s ease-in-out forwards' }}
          >
            <div className="flex flex-col items-center gap-1">
              <div
                className="px-3 py-1.5 rounded font-pixel text-[10px] text-white whitespace-nowrap"
                style={{
                  background: 'rgba(75, 45, 142, 0.9)',
                  border: '2px solid rgba(123, 95, 191, 0.6)',
                  animation: 'digiBounce 0.6s ease-in-out infinite',
                  fontFamily: "'Silkscreen', cursive",
                }}
              >
                {popup.message}
              </div>
              {/* Idle sprite — Row 0 (front-facing) from /api/assets/ */}
              <div
                className="pixel-render"
                style={{
                  width: 64,
                  height: 64,
                  backgroundImage: `url(${popup.digimon.walkSrc})`,
                  backgroundSize: '256px 256px',
                  backgroundPositionY: 0,
                  imageRendering: 'pixelated',
                  '--sw': '-256px',
                  animation: 'spriteWalk 0.5s steps(4) infinite',
                } as React.CSSProperties}
              />
              <span
                className="text-[9px] font-pixel opacity-70"
                style={{ fontFamily: "'Silkscreen', cursive", color: '#7B5FBF' }}
              >
                {popup.digimon.name}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

function getPopupPosition(popup: Popup): React.CSSProperties {
  switch (popup.side) {
    case 'left':   return { left: 12, top: `${popup.position}%` };
    case 'right':  return { right: 12, top: `${popup.position}%` };
    case 'bottom': return { bottom: 12, left: `${popup.position}%` };
  }
}
