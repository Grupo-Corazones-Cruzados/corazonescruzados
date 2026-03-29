'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import useDigimonConfigs, { type DigimonConfig } from './useDigimonConfigs';

interface Walker {
  id: number;
  digimon: DigimonConfig;
  direction: 'left' | 'right';
  y: number;
  duration: number;
  size: 64 | 128;
  state: 'walking' | 'done' | 'fading';
  /** Frozen X position (set on hover) */
  frozenX?: number;
}

let nextId = Date.now();

const MS_PER_FRAME = 240;

function animKey(cfg: DigimonConfig, size: number) {
  return `wf_${cfg.sheetCols}x${cfg.sheetRows}_r${cfg.walkRow}_${cfg.walkFrames.join('-')}_${size}`;
}

function doneAnimKey(cfg: DigimonConfig, size: number) {
  return `df_${cfg.doneFrames.join('-')}_${size}`;
}

export default function DigimonWalkers() {
  const configs = useDigimonConfigs();
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const walkerRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const spawnWalker = useCallback(() => {
    if (configs.length === 0) return;

    setWalkers(prev => {
      const onScreen = new Set(prev.map(w => w.digimon.sprite));
      const available = configs.filter(c => !onScreen.has(c.sprite));
      if (available.length === 0) return prev;

      const digimon = available[Math.floor(Math.random() * available.length)];
      const walker: Walker = {
        id: nextId++,
        digimon,
        direction: Math.random() > 0.5 ? 'right' : 'left',
        y: 15 + Math.random() * 70,
        duration: 8 + Math.random() * 12,
        size: Math.random() > 0.6 ? 128 : 64,
        state: 'walking',
      };

      setTimeout(() => {
        setWalkers(p => p.filter(w => w.id !== walker.id));
        walkerRefs.current.delete(walker.id);
      }, walker.duration * 1000 + 500);

      return [...prev, walker];
    });
  }, [configs]);

  useEffect(() => {
    if (configs.length === 0) return;
    const first = setTimeout(spawnWalker, 2000);
    const interval = setInterval(spawnWalker, 5000 + Math.random() * 8000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [spawnWalker, configs.length]);

  const handleHover = useCallback((walkerId: number) => {
    // Capture current screen position before stopping the walk animation
    const el = walkerRefs.current.get(walkerId);
    let frozenX: number | undefined;
    if (el) {
      const rect = el.getBoundingClientRect();
      frozenX = rect.left;
    }

    setWalkers(prev => prev.map(w =>
      w.id === walkerId && w.state === 'walking'
        ? { ...w, state: 'done', frozenX }
        : w
    ));

    setTimeout(() => {
      setWalkers(prev => prev.map(w =>
        w.id === walkerId && w.state === 'done' ? { ...w, state: 'fading' } : w
      ));
    }, 1000);

    setTimeout(() => {
      setWalkers(prev => prev.filter(w => w.id !== walkerId));
      walkerRefs.current.delete(walkerId);
    }, 2000);
  }, []);

  // Walk keyframes
  const walkKeyframes = useMemo(() => {
    const seen = new Set<string>();
    const rules: string[] = [];
    for (const cfg of configs) {
      for (const displaySize of [64, 128] as const) {
        const name = animKey(cfg, displaySize);
        if (seen.has(name)) continue;
        seen.add(name);
        const { walkRow, walkFrames } = cfg;
        const rowY = -walkRow * displaySize;
        const n = walkFrames.length;
        const stops = walkFrames.map((col, i) => {
          const pct = ((i / n) * 100).toFixed(2);
          return `${pct}% { background-position: ${-col * displaySize}px ${rowY}px; }`;
        });
        rules.push(`@keyframes ${name} { ${stops.join(' ')} }`);
      }
    }
    return rules.join('\n');
  }, [configs]);

  // Done keyframes (all done sheets are 4 cols × 1 row)
  const doneKeyframes = useMemo(() => {
    const seen = new Set<string>();
    const rules: string[] = [];
    for (const cfg of configs) {
      for (const displaySize of [64, 128] as const) {
        const name = doneAnimKey(cfg, displaySize);
        if (seen.has(name)) continue;
        seen.add(name);
        const { doneFrames } = cfg;
        const n = doneFrames.length;
        const stops = doneFrames.map((col, i) => {
          const pct = ((i / n) * 100).toFixed(2);
          return `${pct}% { background-position: ${-col * displaySize}px 0px; }`;
        });
        rules.push(`@keyframes ${name} { ${stops.join(' ')} }`);
      }
    }
    return rules.join('\n');
  }, [configs]);

  const allStyles = [walkKeyframes, doneKeyframes].filter(Boolean).join('\n');

  return (
    <>
      {allStyles && <style dangerouslySetInnerHTML={{ __html: allStyles }} />}
      {walkers.map(walker => {
        const { digimon, direction, size, state, frozenX } = walker;

        const shouldFlip = digimon.flipWalk
          ? direction === 'left'
          : direction === 'right';

        const { sheetCols, sheetRows } = digimon;
        const walkBgW = sheetCols * size;
        const walkBgH = sheetRows * size;
        const doneBgW = 4 * size;
        const doneBgH = size;

        const isWalking = state === 'walking';
        const isDone = state === 'done';
        const isFading = state === 'fading';
        const isStopped = isDone || isFading;

        const walkCycleDuration = (digimon.walkFrames.length * MS_PER_FRAME) / 1000;
        const doneCycleDuration = (digimon.doneFrames.length * MS_PER_FRAME) / 1000;

        const walkName = animKey(digimon, size);
        const doneName = doneAnimKey(digimon, size);

        return (
          <div
            key={walker.id}
            ref={(el) => { if (el) walkerRefs.current.set(walker.id, el); }}
            className="digi-walker"
            style={{
              top: `${walker.y}%`,
              // Walking: use CSS animation to move across. Stopped: fix at captured position.
              ...(isWalking
                ? {
                    animation: `${direction === 'right' ? 'walkAcrossRight' : 'walkAcrossLeft'} ${walker.duration}s linear forwards`,
                  }
                : {
                    left: frozenX != null ? `${frozenX}px` : undefined,
                    animation: 'none',
                    transform: 'none',
                  }
              ),
              pointerEvents: isWalking ? 'auto' : 'none',
              opacity: isFading ? 0 : 1,
              transition: isFading ? 'opacity 1s ease-out' : undefined,
              cursor: isWalking ? 'pointer' : undefined,
            }}
            onMouseEnter={() => isWalking && handleHover(walker.id)}
          >
            {/* Walk sprite */}
            <div
              style={{
                width: size,
                height: size,
                display: isWalking ? 'block' : 'none',
                backgroundImage: `url(${digimon.walkSrc})`,
                backgroundSize: `${walkBgW}px ${walkBgH}px`,
                imageRendering: 'pixelated',
                transform: shouldFlip ? 'scaleX(-1)' : 'none',
                animation: `${walkName} ${walkCycleDuration}s step-end infinite`,
              } as React.CSSProperties}
            />
            {/* Done sprite */}
            {isStopped && (
              <div
                style={{
                  width: size,
                  height: size,
                  backgroundImage: `url(${digimon.doneSrc})`,
                  backgroundSize: `${doneBgW}px ${doneBgH}px`,
                  imageRendering: 'pixelated',
                  transform: shouldFlip ? 'scaleX(-1)' : 'none',
                  animation: `${doneName} ${doneCycleDuration}s step-end infinite`,
                } as React.CSSProperties}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
