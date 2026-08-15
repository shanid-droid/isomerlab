import React from 'react';
import { Link } from 'react-router-dom';
import type { LeaderboardEntry } from '../../lib/types';
import { formatRank, formatScore } from './format';

interface Props {
  entry: LeaderboardEntry;
  /** Top 3 get the larger card treatment; everything else is a compact row */
  highlight?: boolean;
}

export const ProjectRankCard: React.FC<Props> = ({ entry, highlight = false }) => {
  const { metadata } = entry;
  const to = metadata.slug ? `/projects/${metadata.slug}` : '#';
  const title = metadata.title ?? 'UNTITLED';

  if (highlight) {
    return (
      <Link
        to={to}
        className="group glass rounded-2xl border border-eg/25 hover:border-eg/60 transition-all duration-300 overflow-hidden flex flex-col min-w-0"
      >
        <div className="relative aspect-[16/9] bg-dark-300 overflow-hidden">
          {metadata.thumbnail_url ? (
            <img
              src={metadata.thumbnail_url}
              alt={title}
              loading="lazy"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-mono-custom text-xs text-white/20">
              NO PREVIEW
            </div>
          )}
          <span className="absolute top-3 left-3 font-display text-2xl font-bold text-eg text-glow-sm tabular-nums">
            {formatRank(entry.rank)}
          </span>
        </div>

        <div className="p-4 flex flex-col gap-2 min-w-0">
          <h3 className="font-display text-sm sm:text-base tracking-wider uppercase text-white break-words">
            {title}
          </h3>
          <p className="font-mono-custom text-[11px] text-white/45 truncate">
            by {metadata.creator_name ?? 'UNKNOWN'}
          </p>
          <div className="h-px bg-gradient-to-r from-eg/40 to-transparent" />
          <p className="font-display text-lg text-eg tabular-nums">
            {formatScore(entry.score)} <span className="text-[10px] text-eg/60 tracking-widest">POINTS</span>
          </p>
          <div className="flex items-center gap-4 font-mono-custom text-[11px] text-white/50 tabular-nums">
            <span>♥ {entry.likes}</span>
            <span>💬 {entry.comments}</span>
            <span>◎ {entry.views}</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={to}
      className="group grid grid-cols-[2.5rem_2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:px-4 py-3 rounded-xl border border-white/5 hover:border-eg/40 bg-dark-200/40 hover:bg-dark-200/70 transition-all duration-200 min-w-0"
    >
      <span className="font-display text-sm text-white/40 group-hover:text-eg tabular-nums transition-colors">
        {formatRank(entry.rank)}
      </span>

      <span className="w-11 h-8 rounded-md overflow-hidden bg-dark-300 flex-shrink-0">
        {metadata.thumbnail_url && (
          <img src={metadata.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover opacity-70" />
        )}
      </span>

      <span className="min-w-0">
        <span className="block font-display text-xs sm:text-sm tracking-wide uppercase text-white truncate">
          {title}
        </span>
        <span className="block font-mono-custom text-[10px] text-white/40 truncate">
          by {metadata.creator_name ?? 'UNKNOWN'} · ♥ {entry.likes} · 💬 {entry.comments}
        </span>
      </span>

      <span className="font-display text-sm text-eg/90 tabular-nums justify-self-end">
        {formatScore(entry.score)}
      </span>
    </Link>
  );
};
