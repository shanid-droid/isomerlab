import React from 'react';
import { useProjectLikes } from '../lib/projectInteractionHooks';

interface LikeButtonProps {
  projectId: string;
  className?: string;
}

export const LikeButton: React.FC<LikeButtonProps> = ({ projectId, className = '' }) => {
  const { likeCount, isLiked, toggleLike, loading, isPending, animating } = useProjectLikes(projectId);

  return (
    <button
      id={`like-btn-${projectId}`}
      onClick={toggleLike}
      disabled={isPending || loading}
      type="button"
      aria-label={isLiked ? 'Unlike this project' : 'Like this project'}
      aria-pressed={isLiked}
      className={[
        'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
        'font-mono-custom text-xs transition-all duration-300 border select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isLiked
          ? 'bg-eg/20 border-eg text-eg shadow-[0_0_14px_rgba(0,255,136,0.35)]'
          : 'bg-dark-200/60 border-white/10 text-white/70 hover:border-eg/50 hover:text-white',
        className,
      ].join(' ')}
    >
      {/* Heart icon with pop animation */}
      <span
        key={`heart-${isLiked}`}
        className={[
          'text-base leading-none',
          isLiked ? 'text-eg' : 'text-white/40',
          animating === 'like'   ? 'animate-like-pop'   : '',
          animating === 'unlike' ? 'animate-unlike-pop' : '',
        ].join(' ')}
        style={{ display: 'inline-block' }}
        aria-hidden="true"
      >
        {isLiked ? '♥' : '♡'}
      </span>

      {/* Label */}
      <span className="font-semibold">
        {isLiked ? 'Liked' : 'Like'}
      </span>

      {/* Count badge — always visible */}
      <span
        className={[
          'px-2 py-0.5 rounded text-[10px] font-bold tabular-nums',
          isLiked ? 'bg-eg/25 text-eg' : 'bg-dark-300 text-white/50',
        ].join(' ')}
      >
        {loading ? '—' : likeCount}
      </span>
    </button>
  );
};
