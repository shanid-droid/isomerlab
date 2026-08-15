import React from 'react';
import type { MyLeaderboardPosition } from '../../lib/types';
import { formatScore } from './format';

export const YourPositionCard: React.FC<{ position: MyLeaderboardPosition }> = ({ position }) => {
  const movement = position.movement;

  return (
    <div className="glass rounded-2xl border border-eg/20 px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div>
        <p className="font-mono-custom text-[10px] tracking-widest text-white/40">YOUR RANK</p>
        <p className="font-display text-xl text-eg tabular-nums">#{position.rank}</p>
      </div>
      <div>
        <p className="font-mono-custom text-[10px] tracking-widest text-white/40">YOUR SCORE</p>
        <p className="font-display text-xl text-white tabular-nums">{formatScore(position.score)}</p>
      </div>
      <div>
        <p className="font-mono-custom text-[10px] tracking-widest text-white/40">MOVEMENT</p>
        <p className="font-mono-custom text-xs tabular-nums">
          {movement === null || movement === undefined ? (
            <span className="text-white/40">—</span>
          ) : movement > 0 ? (
            <span className="text-eg">↑ {movement} positions</span>
          ) : movement < 0 ? (
            <span className="text-red-400">↓ {Math.abs(movement)} positions</span>
          ) : (
            <span className="text-white/50">no change</span>
          )}
        </p>
      </div>
    </div>
  );
};
