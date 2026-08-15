import React from 'react';
import { Link } from 'react-router-dom';
import type { LeaderboardEntry } from '../../lib/types';
import { formatRank, formatScore, initialsOf } from './format';

interface Props {
  entry: LeaderboardEntry;
  highlight?: boolean;
}

const Avatar: React.FC<{ url?: string | null; name?: string | null; size: string }> = ({ url, name, size }) => (
  <span className={`${size} rounded-full overflow-hidden border border-eg/25 bg-dark-300 flex items-center justify-center flex-shrink-0`}>
    {url
      ? <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
      : <span className="font-display text-xs text-eg/70">{initialsOf(name)}</span>}
  </span>
);

export const CreatorRankCard: React.FC<Props> = ({ entry, highlight = false }) => {
  const { metadata } = entry;
  const to = `/profile/${entry.entity_id}`;
  const name = metadata.name ?? 'UNKNOWN CREATOR';

  if (highlight) {
    return (
      <Link
        to={to}
        className="group glass rounded-2xl border border-eg/25 hover:border-eg/60 transition-all duration-300 p-5 flex flex-col gap-3 min-w-0"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display text-2xl font-bold text-eg text-glow-sm tabular-nums">
            {formatRank(entry.rank)}
          </span>
          <Avatar url={metadata.avatar_url} name={name} size="w-12 h-12" />
          <span className="font-display text-sm tracking-wider uppercase text-white break-words min-w-0">
            {name}
          </span>
        </div>

        <div className="h-px bg-gradient-to-r from-eg/40 to-transparent" />

        <p className="font-display text-lg text-eg tabular-nums">
          {formatScore(entry.score)} <span className="text-[10px] text-eg/60 tracking-widest">POINTS</span>
        </p>

        <p className="font-mono-custom text-[11px] text-white/50 tabular-nums">
          {entry.projects} PROJECTS · {entry.likes} LIKES · {entry.comments} COMMENTS
        </p>

        {metadata.top_project && (
          <p className="font-mono-custom text-[10px] text-white/35 break-words">
            TOP PROJECT: <span className="text-white/60">{metadata.top_project}</span>
          </p>
        )}
      </Link>
    );
  }

  return (
    <Link
      to={to}
      className="group grid grid-cols-[2.5rem_2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:px-4 py-3 rounded-xl border border-white/5 hover:border-eg/40 bg-dark-200/40 hover:bg-dark-200/70 transition-all duration-200 min-w-0"
    >
      <span className="font-display text-sm text-white/40 group-hover:text-eg tabular-nums transition-colors">
        {formatRank(entry.rank)}
      </span>

      <Avatar url={metadata.avatar_url} name={name} size="w-9 h-9" />

      <span className="min-w-0">
        <span className="block font-display text-xs sm:text-sm tracking-wide uppercase text-white truncate">
          {name}
        </span>
        <span className="block font-mono-custom text-[10px] text-white/40 truncate">
          {entry.projects} PROJECTS · ♥ {entry.likes}
          {metadata.top_project ? ` · TOP: ${metadata.top_project}` : ''}
        </span>
      </span>

      <span className="font-display text-sm text-eg/90 tabular-nums justify-self-end">
        {formatScore(entry.score)}
      </span>
    </Link>
  );
};
