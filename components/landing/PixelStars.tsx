'use client';

import { useEffect, useState } from 'react';

interface Star {
  id: number;
  left: string;
  top: string;
  size: number;
  duration: string;
  delay: string;
}

export default function PixelStars({ count = 40 }: { count?: number }) {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    setStars(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() > 0.7 ? 3 : 2,
        duration: `${2 + Math.random() * 4}s`,
        delay: `${Math.random() * 5}s`,
      }))
    );
  }, [count]);

  if (stars.length === 0) return null;

  return (
    <div className="pixel-stars">
      {stars.map(star => (
        <div
          key={star.id}
          className="pixel-star"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            '--duration': star.duration,
            '--delay': star.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
