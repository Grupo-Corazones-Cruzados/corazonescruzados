'use client';

import { useEffect, useState } from 'react';
import useDigimonConfigs from './useDigimonConfigs';

export default function DigimonHeroParade() {
  const configs = useDigimonConfigs();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!visible || configs.length === 0) return null;

  return (
    <div className="flex items-end justify-center gap-2 md:gap-4 mt-8">
      {configs.map((digi, i) => (
        <div
          key={digi.sprite}
          className="flex flex-col items-center"
          style={{ animation: `pixelFadeIn 0.5s ease-out ${0.1 * i}s both` }}
        >
          <div
            className="pixel-render"
            style={{
              '--sw': '-192px',
              width: 48,
              height: 48,
              backgroundImage: `url(${digi.walkSrc})`,
              backgroundSize: '192px 192px',
              backgroundPositionY: 0,
              imageRendering: 'pixelated',
              animation: `spriteWalk 0.6s steps(4) infinite, floatUpDown ${1.5 + Math.random()}s ease-in-out ${Math.random() * 0.5}s infinite`,
            } as React.CSSProperties}
          />
          <span
            className="text-[8px] mt-1 opacity-50"
            style={{ fontFamily: "'Silkscreen', cursive", color: '#7B5FBF' }}
          >
            {digi.name}
          </span>
        </div>
      ))}
    </div>
  );
}
