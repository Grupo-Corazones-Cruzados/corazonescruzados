'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Music, SkipForward, Volume2, VolumeX, Pause, Play } from 'lucide-react';

const TRACKS = [
  { name: 'Butterfly', file: '/sounds/music/butterfly.mp3' },
  { name: 'Brave Heart', file: '/sounds/music/brave_heart.mp3' },
  { name: 'Butterfly (Inst)', file: '/sounds/music/butterfly_instrumental.mp3' },
  { name: 'Brave Heart (Inst)', file: '/sounds/music/brave_heart_instrumental.mp3' },
];

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('world_music_vol') || '0.15');
    }
    return 0.15;
  });
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const track = TRACKS[trackIdx];

  // Init audio element
  useEffect(() => {
    const audio = new Audio(track.file);
    audio.loop = false;
    audio.volume = volume;
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      // Auto-advance to next track
      setTrackIdx(prev => (prev + 1) % TRACKS.length);
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const wasPlaying = !audio.paused;
    audio.src = track.file;
    audio.volume = muted ? 0 : volume;
    if (wasPlaying) audio.play().catch(() => {});
  }, [trackIdx, track.file, volume, muted]);

  // Volume change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
    localStorage.setItem('world_music_vol', String(volume));
  }, [volume, muted]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const nextTrack = useCallback(() => {
    setTrackIdx(prev => (prev + 1) % TRACKS.length);
  }, []);

  return (
    <div className="relative">
      {expanded && (
        <div className="absolute bottom-full left-0 mb-2 bg-digi-card/95 backdrop-blur border border-digi-border rounded-lg p-3 space-y-2.5 shadow-lg w-60">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-digi-green font-mono flex items-center gap-1.5 truncate">
              <Music size={12} className="shrink-0" />
              {track.name}
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-digi-muted hover:text-digi-text text-xs ml-2 shrink-0"
            >
              ×
            </button>
          </div>

          {/* Transport controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded bg-digi-green/15 text-digi-green hover:bg-digi-green/25 transition-colors"
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={nextTrack}
              className="p-1.5 rounded bg-white/5 text-digi-muted hover:text-digi-text transition-colors"
            >
              <SkipForward size={14} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMuted(!muted)}
              className="p-1 rounded bg-white/5 text-digi-muted hover:text-digi-text transition-colors shrink-0"
            >
              {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-digi-green min-w-0"
            />
          </div>

          {/* Track list */}
          <div className="space-y-0.5">
            {TRACKS.map((t, i) => (
              <button
                key={t.file}
                onClick={() => { setTrackIdx(i); if (!playing) togglePlay(); }}
                className={`block w-full text-left text-[9px] font-mono px-2 py-1 rounded transition-colors ${
                  i === trackIdx
                    ? 'text-digi-green bg-digi-green/10'
                    : 'text-digi-muted hover:text-digi-text hover:bg-white/5'
                }`}
              >
                {i === trackIdx && playing ? '♫ ' : '  '}{t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-[#0d1117]/90 border transition-all ${
          playing
            ? 'border-purple-400/40 bg-purple-400/10 hover:bg-purple-400/20'
            : 'border-[#30363d] hover:border-purple-400/40 hover:bg-purple-400/10'
        }`}
        title="Reproductor de música"
      >
        <Music size={20} className={playing ? 'text-purple-400 animate-pulse' : 'text-[#8b949e]'} />
      </button>
    </div>
  );
}
