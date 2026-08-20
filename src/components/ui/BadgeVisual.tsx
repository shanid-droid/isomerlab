import React from 'react';
import type { Badge, BadgeRarity, UserBadge } from '../../lib/types';
import { getRarityBadgeStyle } from '../../lib/badgeCampaignHooks';

/* ── SVG Icon Selector ─────────────────────────────────────────── */
export const BadgeIcon: React.FC<{ icon?: string | null; className?: string }> = ({
  icon = 'sparkles',
  className = 'w-6 h-6',
}) => {
  const iconKey = (icon || 'sparkles').toLowerCase();

  if (icon && (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/'))) {
    return <img src={icon} alt="" className={`${className} object-contain`} />;
  }

  switch (iconKey) {
    case 'compass':
    case 'explorer':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
    case 'zap':
    case 'supporter':
    case 'lightning':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
    case 'crown':
    case 'genesis':
    case 'pioneer':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
    case 'trophy':
    case 'award':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
          <path d="M6 3h12v7a6 6 0 0 1-12 0V3z" fill="currentColor" fillOpacity={0.2} />
          <path d="M9 21h6M12 16v5" />
        </svg>
      );
    case 'shield':
    case 'verified':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
    case 'flame':
    case 'fire':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
    case 'star':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
    case 'diamond':
    case 'gem':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor" fillOpacity={0.2} />
          <path d="M10 3v6l-4-6M14 3v6l4-6M2 9h20M12 21L8 9M12 21l4-12" />
        </svg>
      );
    case 'sparkles':
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
  }
};

/* ── Badge Card Component ─────────────────────────────────────────── */
interface BadgeCardProps {
  badge: Badge;
  userBadge?: UserBadge | null;
  isLocked?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showRarityTag?: boolean;
}

export const BadgeCard: React.FC<BadgeCardProps> = ({
  badge,
  userBadge,
  isLocked = false,
  size = 'md',
  onClick,
  showRarityTag = true,
}) => {
  const style = getRarityBadgeStyle(badge.rarity);

  const sizeClasses = {
    sm: {
      container: 'p-3',
      iconBox: 'w-10 h-10',
      icon: 'w-5 h-5',
      title: 'text-xs',
      sub: 'text-[10px]',
    },
    md: {
      container: 'p-4',
      iconBox: 'w-14 h-14',
      icon: 'w-7 h-7',
      title: 'text-sm',
      sub: 'text-xs',
    },
    lg: {
      container: 'p-6',
      iconBox: 'w-20 h-20',
      icon: 'w-10 h-10',
      title: 'text-base',
      sub: 'text-xs',
    },
  }[size];

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-2xl border transition-all duration-300 ${
        isLocked
          ? 'bg-dark-300/40 border-white/10 opacity-60 hover:opacity-85'
          : `glass-dark ${style.borderColor} hover:${style.glowColor} hover:shadow-xl hover:-translate-y-0.5`
      } ${sizeClasses.container} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Rarity tag */}
      {showRarityTag && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`font-mono-custom text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-full border ${style.borderColor} ${style.badgeBg} ${style.textColor}`}
          >
            {style.label}
          </span>
          {isLocked ? (
            <span className="font-mono-custom text-[9px] text-white/35 flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              LOCKED
            </span>
          ) : userBadge?.awarded_at ? (
            <span className="font-mono-custom text-[9px] text-eg flex items-center gap-1">
              ✓ EARNED
            </span>
          ) : null}
        </div>
      )}

      {/* Center Icon */}
      <div className="flex flex-col items-center text-center">
        <div
          className={`relative rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${
            sizeClasses.iconBox
          } ${
            isLocked
              ? 'bg-white/5 text-white/30 border border-white/10'
              : `${style.badgeBg} ${style.textColor} border ${style.borderColor}`
          }`}
        >
          <BadgeIcon icon={badge.icon_url} className={sizeClasses.icon} />
          {!isLocked && (
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-t from-black/30 to-transparent pointer-events-none`} />
          )}
        </div>

        {/* Badge Title */}
        <h4 className={`font-display font-bold text-white mt-3 truncate max-w-full ${sizeClasses.title}`}>
          {badge.name}
        </h4>

        {/* Short Description */}
        {badge.description && (
          <p className={`font-sans text-white/50 line-clamp-2 mt-1 ${sizeClasses.sub}`}>
            {badge.description}
          </p>
        )}

        {/* Source or date if awarded */}
        {userBadge && (
          <div className="mt-2.5 pt-2 border-t border-white/5 w-full flex items-center justify-between text-[10px] font-mono-custom text-white/40">
            <span className="truncate max-w-[120px] text-eg/80">
              {userBadge.source_title || 'ISOMER'}
            </span>
            <span>
              {new Date(userBadge.awarded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Badge Detail Modal ───────────────────────────────────────────── */
interface BadgeModalProps {
  badge: Badge | null;
  userBadge?: UserBadge | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BadgeDetailModal: React.FC<BadgeModalProps> = ({
  badge,
  userBadge,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !badge) return null;
  const style = getRarityBadgeStyle(badge.rarity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-md glass-dark rounded-3xl p-6 sm:p-8 border ${style.borderColor} ${style.glowColor} shadow-2xl space-y-6 text-white`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Icon & Glow */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div
            className={`w-24 h-24 rounded-3xl flex items-center justify-center border-2 ${style.borderColor} ${style.badgeBg} ${style.textColor} shadow-2xl relative`}
          >
            <BadgeIcon icon={badge.icon_url} className="w-12 h-12" />
            <div className="absolute inset-0 rounded-3xl bg-radial-glow pointer-events-none opacity-40" />
          </div>

          <div className="space-y-1">
            <span
              className={`inline-block font-mono-custom text-[10px] tracking-widest uppercase px-3 py-1 rounded-full border ${style.borderColor} ${style.badgeBg} ${style.textColor}`}
            >
              {style.label} BADGE
            </span>
            <h3 className="font-display text-2xl font-bold text-white mt-2">{badge.name}</h3>
            <p className="font-mono-custom text-xs text-white/40 uppercase tracking-wider">
              Category: {badge.category}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="p-4 rounded-2xl bg-dark-200/50 border border-white/10 text-sm text-white/70 leading-relaxed">
          {badge.description || 'Exclusive ISOMER achievement credential.'}
        </div>

        {/* Acquisition details */}
        {userBadge ? (
          <div className="space-y-2 p-4 rounded-2xl border border-eg/20 bg-eg/5 font-mono-custom text-xs">
            <div className="flex items-center justify-between text-white/60">
              <span>Earned Via:</span>
              <span className="text-eg font-semibold">{userBadge.source_title || 'ISOMER Mission'}</span>
            </div>
            <div className="flex items-center justify-between text-white/60">
              <span>Unlocked Date:</span>
              <span className="text-white">
                {new Date(userBadge.awarded_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            {userBadge.notes && (
              <div className="pt-2 border-t border-eg/15 text-white/50 text-[11px]">
                Note: {userBadge.notes}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl border border-white/10 bg-white/5 font-mono-custom text-xs text-center text-white/50">
            Earn this badge by completing active ISOMER campaigns or community challenges.
          </div>
        )}

        {/* Footer CTA */}
        <button onClick={onClose} className="w-full btn-primary py-3 justify-center text-xs">
          CLOSE
        </button>
      </div>
    </div>
  );
};

/* ── Celebration Claim Modal ─────────────────────────────────────── */
interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badgeName?: string;
  badgeIcon?: string;
  rarity?: BadgeRarity;
  rewardType?: string;
}

export const RewardCelebrationModal: React.FC<CelebrationModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badgeName,
  badgeIcon,
  rarity = 'epic',
  rewardType = 'badge',
}) => {
  if (!isOpen) return null;
  const style = getRarityBadgeStyle(rarity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fade-in">
      <div className="relative w-full max-w-md glass-dark rounded-3xl p-6 sm:p-8 border border-eg/40 shadow-2xl shadow-eg/20 text-center space-y-6 text-white overflow-hidden">
        {/* Ambient ray */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-eg/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative space-y-2">
          <p className="font-mono-custom text-[11px] tracking-widest text-eg uppercase flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-eg animate-ping" />
            {rewardType === 'drop' ? 'LIMITED DROP CLAIMED' : 'BADGE UNLOCKED'}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white">
            {title}
          </h2>
          {subtitle && <p className="font-sans text-xs text-white/60 max-w-sm mx-auto">{subtitle}</p>}
        </div>

        {/* Big Icon Showcase */}
        <div className="relative py-4 flex justify-center">
          <div
            className={`w-28 h-28 rounded-3xl flex items-center justify-center border-2 ${style.borderColor} ${style.badgeBg} ${style.textColor} shadow-2xl animate-bounce-short`}
          >
            <BadgeIcon icon={badgeIcon} className="w-14 h-14" />
          </div>
        </div>

        {badgeName && (
          <div className="inline-block font-display text-lg font-bold text-white px-4 py-1.5 rounded-xl border border-white/15 bg-white/5">
            {badgeName}
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full btn-primary py-3.5 justify-center text-xs font-mono-custom tracking-wider"
          >
            COLLECT REWARD →
          </button>
        </div>
      </div>
    </div>
  );
};
