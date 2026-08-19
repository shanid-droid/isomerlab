import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { supabase } from '../lib/supabase';
import type { ProjectGalleryItem, ProjectVersion } from '../lib/types';

/* ── Duration Formatter ──────────────────────────────────────────── */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) return null;
  const totalSeconds = Math.round(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const remainingSecs = totalSeconds % 60;
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

function fmtTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/* ── Storage URL Resolver ────────────────────────────────────────── */
export function resolveGalleryMediaUrl(item: ProjectGalleryItem | null | undefined): string | null {
  if (!item) return null;
  const raw = item.image_url;
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (/^(https?:\/\/|\/\/|data:|blob:)/i.test(trimmed)) return trimmed;

  let path = trimmed;
  if (path.startsWith('project-images/')) path = path.substring('project-images/'.length);
  else if (path.startsWith('/project-images/')) path = path.substring('/project-images/'.length);
  path = path.replace(/^\/+/, '');
  if (!path) return null;

  try {
    const { data } = supabase.storage.from('project-images').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (err) {
    console.warn('[resolveGalleryMediaUrl] Error:', path, err);
    return null;
  }
}

/* ── Media Type Resolver ─────────────────────────────────────────── */
export function resolveGalleryMediaType(item: ProjectGalleryItem): 'image' | 'video' {
  if (item.media_type) {
    const t = item.media_type.toLowerCase().trim();
    if (t === 'video' || t.startsWith('video/')) return 'video';
    if (t === 'image' || t.startsWith('image/')) return 'image';
  }
  if (item.mime_type) {
    const m = item.mime_type.toLowerCase().trim();
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('image/')) return 'image';
  }
  const rawUrl = (item.image_url || '').split('?')[0].split('#')[0].toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i.test(rawUrl)) return 'video';
  return 'image';
}

/* ── Resolved Gallery Item ───────────────────────────────────────── */
export interface ResolvedGalleryItem {
  id: string;
  original: ProjectGalleryItem;
  url: string | null;
  mediaType: 'image' | 'video';
  mimeType?: string | null;
  durationSeconds?: number | null;
}

/* ═══════════════════════════════════════════════════════════════════
   ISOMER Custom Video Player
   ─ No native browser controls, no native 3-dot menu
   ─ object-fit: contain always (no cropping)
   ─ Fullscreen uses Fullscreen API on the player wrapper
═══════════════════════════════════════════════════════════════════ */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface IsomerVideoPlayerProps {
  src: string;
  className?: string;
  /** When true the player fills 100% of its container (lightbox/fullscreen) */
  expand?: boolean;
  onError?: () => void;
}

export const IsomerVideoPlayer: React.FC<IsomerVideoPlayerProps> = ({
  src,
  className = '',
  expand = false,
  onError,
}) => {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  /* playback state */
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showSpeedSub, setShowSpeedSub] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [buffered, setBuffered] = useState(0);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── init ── */
  useEffect(() => {
    setPipSupported('pictureInPictureEnabled' in document);
  }, []);

  /* reset when src changes */
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVideoError(false);
    setShowOptionsMenu(false);
    setShowSpeedSub(false);
  }, [src]);

  /* fullscreen change listener */
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  /* auto-hide controls */
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 2800);
  }, [playing]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, resetHideTimer]);

  /* ── Video event handlers ── */
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered((v.buffered.end(v.buffered.length - 1) / (v.duration || 1)) * 100);
    }
  };
  const onLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration || 0);
  };
  const onPlay = () => setPlaying(true);
  const onPause = () => setPlaying(false);
  const onEnded = () => { setPlaying(false); setShowControls(true); };
  const onVideoError = () => { setVideoError(true); onError?.(); };

  /* ── Controls ── */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    playing ? v.pause() : v.play().catch(() => {});
    resetHideTimer();
  }, [playing, resetHideTimer]);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = parseFloat(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
    resetHideTimer();
  }, [resetHideTimer]);

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const vol = parseFloat(e.target.value);
    v.volume = vol;
    setVolume(vol);
    setMuted(vol === 0);
    resetHideTimer();
  }, [resetHideTimer]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    resetHideTimer();
  }, [resetHideTimer]);

  const setPlaybackSpeed = useCallback((s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSpeedSub(false);
    setShowOptionsMenu(false);
    resetHideTimer();
  }, [resetHideTimer]);

  const toggleFullscreen = useCallback(async () => {
    const el = playerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* ignore */ }
    resetHideTimer();
  }, [resetHideTimer]);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch { /* ignore */ }
    setShowOptionsMenu(false);
    resetHideTimer();
  }, [resetHideTimer]);

  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = src;
    a.download = src.split('/').pop() || 'video';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
    setShowOptionsMenu(false);
  }, [src]);

  const volumeIcon = muted || volume === 0
    ? '🔇'
    : volume < 0.5 ? '🔉' : '🔊';

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  /* ── Render ── */
  if (videoError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-dark-400 rounded-xl border border-red-500/20 p-8 gap-3 ${className}`}>
        <span className="text-2xl">🎬</span>
        <span className="font-mono-custom text-[11px] tracking-widest text-red-400 uppercase">VIDEO UNAVAILABLE</span>
        <span className="font-mono-custom text-[9px] text-white/30">Source media could not be loaded</span>
      </div>
    );
  }

  return (
    <div
      ref={playerRef}
      className={`isomer-video-player relative bg-black select-none overflow-hidden ${expand ? 'w-full h-full' : 'rounded-xl'} ${className}`}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={(e) => {
        /* close menus on click outside */
        if (showOptionsMenu) { setShowOptionsMenu(false); setShowSpeedSub(false); e.stopPropagation(); }
      }}
    >
      {/* ── Video element — no native controls, contain always ── */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onError={onVideoError}
        onClick={togglePlay}
        style={{ objectFit: 'contain', width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
      />

      {/* ── Big play overlay when paused ── */}
      {!playing && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <div className="w-16 h-16 rounded-full bg-black/70 border border-eg/60 flex items-center justify-center shadow-lg backdrop-blur-sm">
            <span className="text-eg text-2xl pl-1">▶</span>
          </div>
        </div>
      )}

      {/* ── Controls Bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0 transition-opacity duration-300"
        style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        <div className="relative z-10 px-3 pb-3 pt-6 space-y-1.5">
          {/* ── Seek + buffer bar ── */}
          <div className="relative h-1 group/seek">
            {/* buffer */}
            <div
              className="absolute top-0 left-0 h-full bg-white/20 rounded-full"
              style={{ width: `${buffered}%` }}
            />
            {/* progress */}
            <div
              className="absolute top-0 left-0 h-full bg-eg rounded-full pointer-events-none"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={seek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Seek"
            />
            {/* thumb dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-eg border-2 border-dark shadow-lg shadow-eg/40 pointer-events-none"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          {/* ── Button Row ── */}
          <div className="flex items-center gap-1.5">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-eg transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 cursor-pointer flex-shrink-0"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              <span className="text-sm font-bold font-mono-custom leading-none">
                {playing ? '⏸' : '▶'}
              </span>
            </button>

            {/* Volume */}
            <button
              onClick={toggleMute}
              className="text-white/80 hover:text-eg transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 cursor-pointer flex-shrink-0 text-sm"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {volumeIcon}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={changeVolume}
              className="w-14 accent-eg cursor-pointer"
              aria-label="Volume"
              style={{ accentColor: 'var(--color-eg, #00ff8c)' }}
            />

            {/* Time */}
            <span className="font-mono-custom text-[10px] text-white/60 flex-1 text-left pl-1 tabular-nums">
              {fmtTime(currentTime)} / {fmtTime(duration)}
            </span>

            {/* Speed badge */}
            {speed !== 1 && (
              <span className="font-mono-custom text-[9px] text-eg border border-eg/40 px-1.5 py-0.5 rounded flex-shrink-0">
                {speed}×
              </span>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white/80 hover:text-eg transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 cursor-pointer flex-shrink-0 text-sm"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? '⊡' : '⛶'}
            </button>

            {/* Options (⋮) — ISOMER custom, replaces native 3-dot */}
            <div className="relative flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOptionsMenu(v => !v);
                  setShowSpeedSub(false);
                }}
                className="text-white/80 hover:text-eg transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 cursor-pointer text-base leading-none font-bold"
                aria-label="Video options"
              >
                ⋮
              </button>

              {/* ── ISOMER Options Panel ── */}
              {showOptionsMenu && (
                <div
                  className="absolute bottom-full right-0 mb-2 w-52 rounded-xl border border-eg/30 bg-dark-100 shadow-2xl overflow-hidden z-50"
                  style={{ boxShadow: '0 0 24px rgba(0,255,140,0.08), 0 8px 32px rgba(0,0,0,0.7)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-3 py-2 border-b border-eg/20 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse flex-shrink-0" />
                    <span className="font-mono-custom text-[10px] text-eg tracking-widest uppercase">Video Options</span>
                  </div>

                  {/* Playback Speed */}
                  <div>
                    <button
                      onClick={() => setShowSpeedSub(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-eg/10 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-white/70 text-xs">⏩</span>
                        <span className="font-mono-custom text-[11px] text-white/80 group-hover:text-eg transition-colors">Playback Speed</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-mono-custom text-[10px] text-eg">{speed}×</span>
                        <span className="text-white/40 text-[10px]">{showSpeedSub ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {showSpeedSub && (
                      <div className="border-t border-eg/10 bg-dark-200/60">
                        {SPEEDS.map((s) => (
                          <button
                            key={s}
                            onClick={() => setPlaybackSpeed(s)}
                            className={`w-full flex items-center justify-between px-5 py-2 hover:bg-eg/10 transition-colors cursor-pointer ${s === speed ? 'text-eg' : 'text-white/60'}`}
                          >
                            <span className="font-mono-custom text-[11px]">{s === 1 ? 'Normal' : `${s}×`}</span>
                            {s === speed && <span className="text-eg text-xs">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Picture-in-Picture */}
                  {pipSupported && (
                    <button
                      onClick={togglePiP}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-eg/10 transition-colors cursor-pointer group border-t border-eg/10"
                    >
                      <span className="text-white/70 text-xs">⧉</span>
                      <span className="font-mono-custom text-[11px] text-white/80 group-hover:text-eg transition-colors">Picture in Picture</span>
                    </button>
                  )}

                  {/* Fullscreen */}
                  <button
                    onClick={() => { toggleFullscreen(); setShowOptionsMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-eg/10 transition-colors cursor-pointer group border-t border-eg/10"
                  >
                    <span className="text-white/70 text-xs">{fullscreen ? '⊡' : '⛶'}</span>
                    <span className="font-mono-custom text-[11px] text-white/80 group-hover:text-eg transition-colors">
                      {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </span>
                  </button>

                  {/* Download */}
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-eg/10 transition-colors cursor-pointer group border-t border-eg/10"
                  >
                    <span className="text-white/70 text-xs">⬇</span>
                    <span className="font-mono-custom text-[11px] text-white/80 group-hover:text-eg transition-colors">Download</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Corner accents */}
      {!expand && (
        <>
          <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-eg/50 pointer-events-none" />
          <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-eg/50 pointer-events-none" />
          <div className="absolute bottom-10 left-3 w-3 h-3 border-b border-l border-eg/50 pointer-events-none" />
          <div className="absolute bottom-10 right-3 w-3 h-3 border-b border-r border-eg/50 pointer-events-none" />
        </>
      )}
    </div>
  );
};

/* ── Gallery Lightbox Modal ──────────────────────────────────────── */
interface GalleryLightboxProps {
  items: ResolvedGalleryItem[];
  currentIndex: number;
  onClose: () => void;
  onSelectIndex: (idx: number) => void;
}

export const GalleryLightbox: React.FC<GalleryLightboxProps> = ({
  items,
  currentIndex,
  onClose,
  onSelectIndex,
}) => {
  const total = items.length;
  const currentItem = items[currentIndex];
  const [lightboxError, setLightboxError] = useState(false);

  useEffect(() => { setLightboxError(false); }, [currentIndex]);

  const handlePrev = useCallback(() => {
    onSelectIndex((currentIndex - 1 + total) % total);
  }, [currentIndex, total, onSelectIndex]);

  const handleNext = useCallback(() => {
    onSelectIndex((currentIndex + 1) % total);
  }, [currentIndex, total, onSelectIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && total > 1) handlePrev();
      if (e.key === 'ArrowRight' && total > 1) handleNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, handlePrev, handleNext, total]);

  if (!currentItem) return null;

  const formattedDuration = formatDuration(currentItem.durationSeconds);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="w-full flex items-center justify-between px-1">
          <div className="font-mono-custom text-xs tracking-widest text-eg/90 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
            {currentItem.mediaType === 'video' ? 'VIDEO' : 'IMAGE'} {currentIndex + 1} OF {total}
            {formattedDuration && (
              <span className="text-white/60 font-mono-custom text-[10px] ml-1 px-2 py-0.5 rounded border border-white/10 bg-dark-400">
                {formattedDuration}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="font-mono-custom text-xs text-white/60 hover:text-eg tracking-widest transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 glass cursor-pointer"
          >
            CLOSE [ESC ✕]
          </button>
        </div>

        {/* Media Frame */}
        <div
          className="relative border border-eg/30 rounded-2xl overflow-hidden glass w-full shadow-2xl bg-dark-300"
          style={{ maxHeight: '75vh' }}
        >
          {lightboxError || !currentItem.url ? (
            <div className="flex flex-col items-center justify-center p-12 text-center gap-3 min-h-[300px]">
              <div className="w-12 h-12 rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center text-red-400 text-lg">
                {currentItem.mediaType === 'video' ? '🎬' : '⚠️'}
              </div>
              <span className="font-mono-custom text-xs tracking-widest text-red-400 font-semibold uppercase">
                {currentItem.mediaType === 'video' ? 'VIDEO UNAVAILABLE' : 'MEDIA UNAVAILABLE'}
              </span>
              <span className="font-mono-custom text-[10px] text-white/40 tracking-wider">
                Source media could not be loaded
              </span>
            </div>
          ) : currentItem.mediaType === 'video' ? (
            /* ISOMER video player in expand mode inside lightbox */
            <div style={{ maxHeight: '73vh', height: '56vw', minHeight: '260px' }}>
              <IsomerVideoPlayer
                key={currentItem.url}
                src={currentItem.url}
                expand
                onError={() => setLightboxError(true)}
              />
            </div>
          ) : (
            <img
              key={currentItem.url}
              src={currentItem.url}
              alt={`Gallery media ${currentIndex + 1}`}
              onError={() => setLightboxError(true)}
              style={{ maxHeight: '73vh', objectFit: 'contain' }}
              className="max-w-full w-full rounded-xl"
            />
          )}

          {/* Cyberpunk Corner Accents */}
          <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-eg/70 pointer-events-none" />
          <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-eg/70 pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-eg/70 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-eg/70 pointer-events-none" />

          {/* Nav arrows */}
          {total > 1 && (
            <button
              onClick={handlePrev}
              aria-label="Previous media"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass border border-eg/40 text-eg flex items-center justify-center hover:bg-eg/20 hover:scale-110 transition-all cursor-pointer z-10"
            >←</button>
          )}
          {total > 1 && (
            <button
              onClick={handleNext}
              aria-label="Next media"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass border border-eg/40 text-eg flex items-center justify-center hover:bg-eg/20 hover:scale-110 transition-all cursor-pointer z-10"
            >→</button>
          )}
        </div>

        {/* Thumbnail Strip */}
        {total > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full p-1">
            {items.map((item, idx) => {
              const d = formatDuration(item.durationSeconds);
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectIndex(idx)}
                  className={`w-16 h-11 rounded-lg overflow-hidden border transition-all flex-shrink-0 relative cursor-pointer ${
                    idx === currentIndex
                      ? 'border-eg ring-2 ring-eg/50 scale-105'
                      : 'border-white/20 opacity-50 hover:opacity-100'
                  }`}
                >
                  {item.mediaType === 'video' ? (
                    <div className="w-full h-full bg-dark-400 flex flex-col items-center justify-center p-1">
                      <span className="text-[10px] text-eg font-mono-custom font-bold">▶ VID</span>
                      {d && <span className="text-[8px] text-white/50 font-mono-custom">{d}</span>}
                    </div>
                  ) : item.url ? (
                    <img src={item.url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-dark-400 flex items-center justify-center text-[10px] text-white/30">✕</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Individual Media Card ───────────────────────────────────────── */
interface GalleryMediaCardProps {
  item: ResolvedGalleryItem;
  index: number;
  onOpenLightbox: (index: number) => void;
}

const GalleryMediaCard: React.FC<GalleryMediaCardProps> = ({ item, index, onOpenLightbox }) => {
  const [loadError, setLoadError] = useState(false);
  const isVideo = item.mediaType === 'video';
  const hasValidUrl = !!item.url && !loadError;
  const formattedDuration = formatDuration(item.durationSeconds);

  /* Error state */
  if (!hasValidUrl) {
    return (
      <div className="group relative rounded-2xl overflow-hidden glass border border-red-500/20 bg-dark-400/50 h-56 flex flex-col items-center justify-center p-4 text-center transition-all duration-300 shadow-sm">
        <div className="w-10 h-10 rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center mb-2 text-red-400 text-sm">
          {isVideo ? '🎬' : '⚠️'}
        </div>
        <span className="font-mono-custom text-[11px] tracking-wider text-red-400/90 font-semibold uppercase">
          {isVideo ? 'VIDEO UNAVAILABLE' : 'MEDIA UNAVAILABLE'}
        </span>
        <span className="font-mono-custom text-[9px] text-white/30 tracking-widest mt-1 uppercase">
          {isVideo ? `Video media ${index + 1}` : `Image media ${index + 1}`}
        </span>
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-red-500/40" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-red-500/40" />
      </div>
    );
  }

  /* Video Card — ISOMER custom player, no native controls */
  if (isVideo) {
    return (
      <div className="group relative rounded-2xl overflow-hidden glass border border-eg/30 bg-black h-56 transition-all duration-300 hover:border-eg/70 hover:shadow-eg-sm">
        {/* Badges overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="font-mono-custom text-[9px] tracking-widest text-eg bg-dark-100/95 border border-eg/40 px-2 py-0.5 rounded-md backdrop-blur-md uppercase flex items-center gap-1 shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
              VIDEO
            </span>
            {formattedDuration && (
              <span className="font-mono-custom text-[9px] tracking-wider text-white/70 bg-dark-100/95 border border-white/20 px-1.5 py-0.5 rounded-md backdrop-blur-md shadow">
                {formattedDuration}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenLightbox(index)}
            className="pointer-events-auto font-mono-custom text-[9px] tracking-wider text-white/80 hover:text-eg bg-dark-100/95 border border-white/20 hover:border-eg/50 px-2 py-0.5 rounded-md backdrop-blur-md transition-colors cursor-pointer shadow flex items-center gap-1"
            title="Expand video to full view"
          >
            EXPAND ↗
          </button>
        </div>

        {/* ISOMER player — fills card, object-fit: contain */}
        <IsomerVideoPlayer
          src={item.url!}
          className="w-full h-full"
          expand
          onError={() => {
            console.error('[GalleryMediaCard] Video load error:', {
              id: item.id,
              media_type: item.mediaType,
              mime_type: item.mimeType,
              image_url: item.url,
            });
            setLoadError(true);
          }}
        />
      </div>
    );
  }

  /* Image Card */
  return (
    <div
      onClick={() => onOpenLightbox(index)}
      className="group relative rounded-2xl overflow-hidden glass border border-eg/20 h-56 cursor-pointer transition-all duration-500 hover:border-eg/70 hover:shadow-eg-sm bg-dark-300"
    >
      <img
        src={item.url!}
        alt={`Gallery media ${index + 1}`}
        onError={() => {
          console.error('[GalleryMediaCard] Image load error:', {
            id: item.id,
            media_type: item.mediaType,
            mime_type: item.mimeType,
            image_url: item.url,
          });
          setLoadError(true);
        }}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-dark-100/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2 p-4 text-center">
        <span className="font-mono-custom text-[11px] text-eg tracking-widest border border-eg/50 px-3.5 py-1.5 rounded-lg bg-dark/90 shadow-lg">
          VIEW FULL MEDIA ↗
        </span>
      </div>
      <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-eg/60 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

/* ── Main ProjectGallery Component ───────────────────────────────── */
interface ProjectGalleryProps {
  gallery: ProjectGalleryItem[];
  activeVersion?: ProjectVersion;
}

export const ProjectGallery: React.FC<ProjectGalleryProps> = ({ gallery, activeVersion }) => {
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);

  const versionItems = useMemo(() => {
    if (!gallery || gallery.length === 0) return [];
    if (!activeVersion) return gallery;
    const matched = gallery.filter((item) => item.version_id === activeVersion.id);
    if (activeVersion.is_default) {
      const untagged = gallery.filter((item) => !item.version_id);
      if (untagged.length > 0) return [...matched, ...untagged];
    }
    return matched;
  }, [gallery, activeVersion]);

  const resolvedItems: ResolvedGalleryItem[] = useMemo(() => {
    return versionItems.map((item) => ({
      id: item.id,
      original: item,
      url: resolveGalleryMediaUrl(item),
      mediaType: resolveGalleryMediaType(item),
      mimeType: item.mime_type,
      durationSeconds: item.duration_seconds,
    }));
  }, [versionItems]);

  return (
    <div className="space-y-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-eg" />
          PROJECT GALLERY
          {resolvedItems.length > 0 && (
            <span className="text-eg font-semibold">({resolvedItems.length})</span>
          )}
        </h3>
        {resolvedItems.length > 0 && (
          <span className="font-mono-custom text-[10px] text-white/30 uppercase tracking-widest">
            CLICK ITEM TO ENLARGE
          </span>
        )}
      </div>

      {/* Grid */}
      {resolvedItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {resolvedItems.map((item, idx) => (
            <GalleryMediaCard
              key={item.id}
              item={item}
              index={idx}
              onOpenLightbox={(i) => setSelectedMediaIndex(i)}
            />
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-8 border border-white/5 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full border border-white/10 bg-dark-200/50 flex items-center justify-center text-white/30 text-lg">
            📷
          </div>
          <p className="font-mono-custom text-xs tracking-widest text-white/30 uppercase">
            NO ADDITIONAL GALLERY MEDIA AVAILABLE FOR THIS PROJECT
          </p>
        </div>
      )}

      {/* Lightbox */}
      {selectedMediaIndex !== null && resolvedItems.length > 0 && (
        <GalleryLightbox
          items={resolvedItems}
          currentIndex={selectedMediaIndex}
          onClose={() => setSelectedMediaIndex(null)}
          onSelectIndex={(idx) => setSelectedMediaIndex(idx)}
        />
      )}
    </div>
  );
};

export default ProjectGallery;
