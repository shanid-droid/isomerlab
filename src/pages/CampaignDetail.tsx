import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useCampaignDetail,
  useClaimReward,
  useJoinCampaign,
  useVerifyCommunityAction,
  computeCampaignDisplayStatus,
  getRarityBadgeStyle,
} from '../lib/badgeCampaignHooks';
import { Navbar, ArrowRight } from '../components/ui';
import FinalCtaFooter from '../components/FinalCtaFooter';
import { BadgeDetailModal, RewardCelebrationModal, BadgeIcon } from '../components/ui/BadgeVisual';
import { supabase } from '../lib/supabase';
import type { CampaignReward, CampaignRequirement, Badge } from '../lib/types';

export const CampaignDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    campaign,
    requirements,
    rewards,
    userProgress,
    loading,
    error,
    refresh,
  } = useCampaignDetail(slug);

  const { claimReward, claiming, claimError } = useClaimReward();
  const { joinCampaign, joining } = useJoinCampaign();
  const { verifyAction, verifying } = useVerifyCommunityAction();

  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [celebration, setCelebration] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    badgeName?: string;
    badgeIcon?: string;
    rarity?: any;
    rewardType?: string;
  }>({ isOpen: false, title: '' });

  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Status calculation
  const statusMeta = useMemo(() => {
    if (!campaign) return null;
    return computeCampaignDisplayStatus(campaign);
  }, [campaign]);

  // Handle Join Action
  const handleJoin = async () => {
    if (!campaign) return;
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      navigate('/login');
      return;
    }
    const res = await joinCampaign(campaign.id);
    if (res.success) {
      setActionSuccessMessage('Successfully joined the campaign!');
      await refresh();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    }
  };

  // Handle Claim Action
  const handleClaim = async (reward: CampaignReward) => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      navigate('/login');
      return;
    }
    const res = await claimReward(reward.id);
    if (res.success) {
      setCelebration({
        isOpen: true,
        title: reward.title,
        subtitle: `Successfully collected reward from ${campaign?.title}!`,
        badgeName: reward.badge?.name || reward.title,
        badgeIcon: reward.badge?.icon_url || 'sparkles',
        rarity: reward.badge?.rarity || 'epic',
        rewardType: reward.reward_type,
      });
      await refresh();
    }
  };

  // Handle Community Action Verification
  const handleVerifyAction = async (req: CampaignRequirement) => {
    if (!campaign) return;
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      navigate('/login');
      return;
    }
    // If metadata has action_url, open it
    const actionUrl = req.metadata?.action_url as string | undefined;
    if (actionUrl) {
      window.open(actionUrl, '_blank', 'noopener,noreferrer');
    }
    const res = await verifyAction(campaign.id, req.id);
    if (res.success) {
      setActionSuccessMessage(`Completed: ${req.title}!`);
      await refresh();
      setTimeout(() => setActionSuccessMessage(null), 3500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-32 pb-20 animate-pulse space-y-8">
          <div className="h-64 rounded-3xl glass-dark border border-white/10" />
          <div className="h-40 rounded-2xl glass-dark border border-white/10" />
        </main>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-36 pb-20 text-center space-y-6">
          <div className="p-8 rounded-3xl glass-dark border border-red-500/30 bg-red-500/10 space-y-4">
            <h2 className="font-display text-2xl font-bold text-white">Campaign Not Found</h2>
            <p className="font-sans text-sm text-white/60">
              {error || 'This campaign may have been removed or is not available yet.'}
            </p>
            <Link to="/campaigns" className="btn-primary py-2.5 px-6 text-xs inline-flex items-center gap-2">
              ← BACK TO CAMPAIGNS
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isJoined = campaign.is_joined || userProgress?.is_participant;
  const isCampaignActive = statusMeta?.key === 'active';

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white overflow-x-hidden selection:bg-eg/30 flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 pb-24 max-w-6xl mx-auto px-4 sm:px-6 w-full space-y-10">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono-custom text-white/50">
          <Link to="/campaigns" className="hover:text-eg transition-colors">
            CAMPAIGNS
          </Link>
          <span>/</span>
          <span className="text-white truncate max-w-xs">{campaign.title}</span>
        </div>

        {/* Global Action Notifications */}
        {actionSuccessMessage && (
          <div className="p-4 rounded-2xl glass-dark border border-eg/40 bg-eg/10 text-eg font-mono-custom text-xs flex items-center justify-between animate-fade-in">
            <span>✓ {actionSuccessMessage}</span>
            <button onClick={() => setActionSuccessMessage(null)} className="text-white/40 hover:text-white">✕</button>
          </div>
        )}

        {claimError && (
          <div className="p-4 rounded-2xl glass-dark border border-red-500/40 bg-red-500/10 text-red-300 font-mono-custom text-xs">
            ✕ {claimError}
          </div>
        )}

        {/* ── 1. HERO SECTION ────────────────────────────────────────── */}
        <section className="glass-dark rounded-3xl border border-eg/20 overflow-hidden relative">
          {/* Banner Artwork if present */}
          {campaign.banner_url && (
            <div className="relative h-64 sm:h-80 w-full overflow-hidden border-b border-white/10">
              <img
                src={campaign.banner_url}
                alt={campaign.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />
            </div>
          )}

          <div className="p-6 sm:p-10 space-y-6 relative">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {statusMeta && (
                  <span className={`font-mono-custom text-xs px-3 py-1 rounded-full border font-bold uppercase ${statusMeta.color}`}>
                    {statusMeta.label}
                  </span>
                )}
                {campaign.participants_count !== undefined && (
                  <span className="font-mono-custom text-xs text-white/50 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    👥 {campaign.participants_count} {campaign.participants_count === 1 ? 'participant' : 'participants'}
                  </span>
                )}
              </div>

              <div className="font-mono-custom text-xs text-white/50">
                <span>Timeline: </span>
                <span className="text-white font-medium">
                  {new Date(campaign.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {campaign.end_date ? ` → ${new Date(campaign.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ' (Ongoing)'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
                {campaign.title}
              </h1>
              <p className="font-sans text-base sm:text-lg text-white/70 max-w-3xl leading-relaxed">
                {campaign.short_description}
              </p>
            </div>

            {/* Primary CTA Row */}
            <div className="pt-4 flex flex-wrap items-center gap-4">
              {!isJoined ? (
                <button
                  onClick={handleJoin}
                  disabled={joining || !isCampaignActive}
                  className={`btn-primary py-3 px-8 text-xs font-mono-custom flex items-center gap-2 ${!isCampaignActive ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  {joining ? 'JOINING...' : isCampaignActive ? 'JOIN CAMPAIGN' : statusMeta?.label}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-eg/15 border border-eg/30 text-eg font-mono-custom text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
                  YOU ARE ENROLLED IN THIS CAMPAIGN
                </div>
              )}

              <a
                href="#requirements"
                className="btn-outline py-3 px-6 text-xs font-mono-custom"
              >
                VIEW REQUIREMENTS ↓
              </a>
            </div>
          </div>
        </section>

        {/* ── 2. PROGRESS STRIP (LOGGED IN) ─────────────────────────── */}
        {userProgress && (
          <section className="glass rounded-3xl p-6 sm:p-8 border border-eg/25 bg-eg/5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono-custom">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
                <h2 className="text-xs tracking-widest text-white/70 uppercase">
                  YOUR CAMPAIGN PROGRESS
                </h2>
              </div>
              <span className="text-sm text-eg font-bold tabular-nums">
                {userProgress.completed_requirements} / {userProgress.total_requirements} REQUIREMENTS COMPLETED ({userProgress.progress_percent}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-dark-300 overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-eg rounded-full transition-all duration-500 shadow-eg-sm"
                style={{ width: `${userProgress.progress_percent}%` }}
              />
            </div>
          </section>
        )}

        {/* ── 3. ABOUT SECTION ───────────────────────────────────────── */}
        {campaign.description && (
          <section className="glass-dark rounded-3xl p-6 sm:p-10 border border-white/10 space-y-4">
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              ABOUT THIS MISSION
            </h2>
            <div className="font-sans text-sm sm:text-base text-white/80 leading-relaxed whitespace-pre-line space-y-3">
              {campaign.description}
            </div>
          </section>
        )}

        {/* ── 4. REQUIREMENTS CHECKLIST ─────────────────────────────── */}
        <section id="requirements" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              MISSION REQUIREMENTS
            </h2>
            <span className="font-mono-custom text-xs text-white/40">
              {requirements.length} total tasks
            </span>
          </div>

          <div className="space-y-3">
            {requirements.map((req, idx) => {
              const reqProg = userProgress?.requirements?.find((r) => r.id === req.id);
              const isCompleted = reqProg?.is_completed ?? false;

              return (
                <div
                  key={req.id}
                  className={`glass-dark rounded-2xl p-5 sm:p-6 border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isCompleted
                      ? 'border-eg/30 bg-eg/5'
                      : 'border-white/10 hover:border-white/20'
                    }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Status Circle */}
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono-custom text-xs font-bold flex-shrink-0 mt-0.5 ${isCompleted
                          ? 'bg-eg text-dark shadow-eg-sm'
                          : 'bg-white/10 text-white/40 border border-white/10'
                        }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-sm sm:text-base font-bold text-white">
                          {req.title}
                        </h3>
                        {req.is_required && (
                          <span className="font-mono-custom text-[9px] text-eg uppercase px-1.5 py-0.5 rounded bg-eg/10 border border-eg/20">
                            Required
                          </span>
                        )}
                      </div>
                      {req.description && (
                        <p className="font-sans text-xs text-white/60 leading-relaxed">
                          {req.description}
                        </p>
                      )}
                      {reqProg && (
                        <p className="font-mono-custom text-[11px] text-white/40 pt-1">
                          Current status: <span className={isCompleted ? 'text-eg font-semibold' : 'text-white/70'}>{reqProg.current_count} / {reqProg.target_count}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Button depending on type */}
                  <div className="flex-shrink-0 sm:self-center">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 font-mono-custom text-xs text-eg font-bold px-3 py-1.5 rounded-xl bg-eg/10 border border-eg/30">
                        <span>✓</span> COMPLETED
                      </span>
                    ) : req.requirement_type === 'like_project' || req.requirement_type === 'comment_project' ? (
                      <Link
                        to="/#projects"
                        className="btn-outline py-2 px-4 text-xs font-mono-custom inline-flex items-center gap-1.5"
                      >
                        EXPLORE PROJECTS →
                      </Link>
                    ) : req.requirement_type === 'profile_complete' || req.requirement_type === 'link_social' ? (
                      <Link
                        to="/profile/edit"
                        className="btn-outline py-2 px-4 text-xs font-mono-custom inline-flex items-center gap-1.5"
                      >
                        EDIT PROFILE →
                      </Link>
                    ) : req.requirement_type === 'apply_creator' ? (
                      <Link
                        to="/apply-creator"
                        className="btn-outline py-2 px-4 text-xs font-mono-custom inline-flex items-center gap-1.5"
                      >
                        APPLY CREATOR →
                      </Link>
                    ) : req.requirement_type === 'community_action' || req.requirement_type === 'custom_check' ? (
                      <button
                        onClick={() => handleVerifyAction(req)}
                        disabled={verifying}
                        className="btn-primary py-2 px-4 text-xs font-mono-custom inline-flex items-center gap-1.5"
                      >
                        {verifying ? 'VERIFYING...' : 'VERIFY ACTION →'}
                      </button>
                    ) : (
                      <span className="font-mono-custom text-xs text-white/40">
                        Incomplete
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 5. REWARDS & DROPS SECTION ────────────────────────────── */}
        <section id="rewards" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              CAMPAIGN REWARDS &amp; DROPS
            </h2>
            <span className="font-mono-custom text-xs text-white/40">
              {rewards.length} available
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rewards.map((reward) => {
              const isClaimed = reward.has_claimed;
              const isDrop = reward.reward_type === 'drop';
              const isCapReached = reward.max_claims ? reward.claimed_count >= reward.max_claims : false;

              // Check user eligibility
              const totalReqs = userProgress?.total_requirements || 0;
              const compReqs = userProgress?.completed_requirements || 0;
              let isEligible = false;

              if (reward.eligibility_type === 'all_requirements') {
                isEligible = totalReqs > 0 && compReqs >= totalReqs;
              } else if (reward.eligibility_type === 'min_requirements_count') {
                isEligible = compReqs >= reward.min_requirements_count;
              } else {
                isEligible = !!isJoined;
              }

              const rarityStyle = getRarityBadgeStyle(reward.badge?.rarity || 'epic');

              return (
                <div
                  key={reward.id}
                  className={`glass-dark rounded-3xl p-6 sm:p-8 border transition-all duration-300 flex flex-col justify-between space-y-6 relative overflow-hidden ${isClaimed
                      ? 'border-eg/40 bg-eg/5'
                      : isEligible && !isCapReached
                        ? `${rarityStyle.borderColor} shadow-lg`
                        : 'border-white/10 opacity-75'
                    }`}
                >
                  <div className="space-y-4">
                    {/* Header tags */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono-custom text-[10px] tracking-wider px-2.5 py-0.5 rounded-full border uppercase ${isDrop
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            : rarityStyle.badgeBg + ' ' + rarityStyle.borderColor + ' ' + rarityStyle.textColor
                          }`}
                      >
                        {isDrop ? '⚡ LIMITED DROP' : `${reward.badge?.rarity || 'COLLECTIBLE'} BADGE`}
                      </span>

                      {/* Drop claim counter */}
                      {reward.max_claims && (
                        <span className="font-mono-custom text-xs font-bold text-eg bg-dark-200 px-2.5 py-0.5 rounded-lg border border-white/10">
                          {reward.claimed_count} / {reward.max_claims} claimed
                        </span>
                      )}
                    </div>

                    {/* Reward Title & Badge Showcase */}
                    <div className="flex items-center gap-4">
                      {reward.badge ? (
                        <div
                          onClick={() => reward.badge && setSelectedBadge(reward.badge)}
                          className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 cursor-pointer border ${rarityStyle.borderColor} ${rarityStyle.badgeBg} ${rarityStyle.textColor}`}
                          title="Click to inspect badge"
                        >
                          <BadgeIcon icon={reward.badge.icon_url} className="w-8 h-8" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-center text-2xl flex-shrink-0">
                          🎁
                        </div>
                      )}

                      <div className="space-y-1 min-w-0">
                        <h3 className="font-display text-lg font-bold text-white truncate">
                          {reward.title}
                        </h3>
                        <p className="font-sans text-xs text-white/60 line-clamp-2">
                          {reward.description || (reward.badge ? reward.badge.description : 'Special campaign reward.')}
                        </p>
                      </div>
                    </div>

                    {/* Eligibility details */}
                    <div className="p-3 rounded-xl bg-dark-200/50 border border-white/5 font-mono-custom text-xs text-white/50 flex items-center justify-between">
                      <span>Requirement rule:</span>
                      <span className="text-white/80">
                        {reward.eligibility_type === 'all_requirements'
                          ? 'Complete all requirements'
                          : `Complete at least ${reward.min_requirements_count} requirements`}
                      </span>
                    </div>
                  </div>

                  {/* Claim Button Action */}
                  <div>
                    {isClaimed ? (
                      <div className="w-full py-3 rounded-xl bg-eg/20 border border-eg/40 text-eg font-mono-custom text-xs font-bold text-center flex items-center justify-center gap-1.5">
                        <span>✓</span> CLAIMED
                      </div>
                    ) : isCapReached ? (
                      <div className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 font-mono-custom text-xs text-center">
                        DROP CLAIM LIMIT REACHED
                      </div>
                    ) : isEligible && isCampaignActive ? (
                      <button
                        onClick={() => handleClaim(reward)}
                        disabled={claiming}
                        className="w-full btn-primary py-3 justify-center text-xs font-mono-custom font-bold shadow-eg-sm animate-pulse-slow"
                      >
                        {claiming ? 'CLAIMING REWARD...' : 'CLAIM REWARD NOW →'}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/35 font-mono-custom text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        LOCKED (REQUIREMENTS INCOMPLETE)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Badge Inspection Modal */}
      <BadgeDetailModal
        badge={selectedBadge}
        isOpen={!!selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />

      {/* Celebration Unlock Modal */}
      <RewardCelebrationModal
        isOpen={celebration.isOpen}
        onClose={() => setCelebration({ ...celebration, isOpen: false })}
        title={celebration.title}
        subtitle={celebration.subtitle}
        badgeName={celebration.badgeName}
        badgeIcon={celebration.badgeIcon}
        rarity={celebration.rarity}
        rewardType={celebration.rewardType}
      />

      <FinalCtaFooter />
    </div>
  );
};

export default CampaignDetailPage;
