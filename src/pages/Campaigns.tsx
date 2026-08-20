import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePublicCampaigns, computeCampaignDisplayStatus } from '../lib/badgeCampaignHooks';
import { Navbar, ArrowRight, IsomerLogo } from '../components/ui';
import FinalCtaFooter from '../components/FinalCtaFooter';
import { BadgeDetailModal } from '../components/ui/BadgeVisual';
import type { Campaign, Badge } from '../lib/types';

export const CampaignsPage: React.FC = () => {
  const { campaigns, loading } = usePublicCampaigns();
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'ended'>('all');
  const [search, setSearch] = useState('');
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const statusMeta = computeCampaignDisplayStatus(c);
      if (filter !== 'all' && statusMeta.key !== filter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesDesc = c.short_description.toLowerCase().includes(q);
        return matchesTitle || matchesDesc;
      }
      return true;
    });
  }, [campaigns, filter, search]);

  const featuredCampaign = useMemo(() => {
    return campaigns.find((c) => c.is_featured) || campaigns[0];
  }, [campaigns]);

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white overflow-x-hidden selection:bg-eg/30 flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 pb-20 max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-12">
        {/* Hero Header */}
        <div className="relative rounded-3xl overflow-hidden glass-dark border border-eg/20 p-6 sm:p-12 text-center sm:text-left flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-eg/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-eg/30 bg-eg/10 text-eg font-mono-custom text-xs">
              <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
              ISOMER ECOSYSTEM MISSIONS & DROPS
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
              Campaigns &amp; <span className="text-eg">Rewards</span>
            </h1>
            <p className="font-sans text-sm sm:text-base text-white/60 leading-relaxed">
              Engage with curated developer quests, support groundbreaking open-source projects, and earn collectible ISOMER credentials, digital drops, and exclusive community badges.
            </p>
          </div>

          <div className="relative flex-shrink-0 flex flex-col sm:flex-row gap-3">
            <Link to="/dashboard" className="btn-outline py-3 px-6 text-xs justify-center">
              MY DASHBOARD →
            </Link>
            <a href="#browse-campaigns" className="btn-primary py-3 px-6 text-xs justify-center">
              EXPLORE MISSIONS <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Featured Campaign Spotlight if available */}
        {featuredCampaign && (
          <section className="space-y-4">
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              FEATURED CAMPAIGN SPOTLIGHT
            </h2>
            <div className="glass-dark rounded-3xl border border-eg/30 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative group hover:border-eg/50 transition-all duration-300">
              <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const st = computeCampaignDisplayStatus(featuredCampaign);
                      return (
                        <span className={`font-mono-custom text-[10px] tracking-wider px-3 py-1 rounded-full border font-bold uppercase ${st.color}`}>
                          {st.label}
                        </span>
                      );
                    })()}
                    <span className="font-mono-custom text-xs text-white/40">
                      {new Date(featuredCampaign.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {featuredCampaign.end_date && ` — ${new Date(featuredCampaign.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </span>
                  </div>

                  <h3 className="font-display text-2xl sm:text-4xl font-bold text-white group-hover:text-eg transition-colors">
                    {featuredCampaign.title}
                  </h3>

                  <p className="font-sans text-sm sm:text-base text-white/70 line-clamp-3">
                    {featuredCampaign.short_description}
                  </p>
                </div>

                {/* Rewards preview strip */}
                {featuredCampaign.rewards && featuredCampaign.rewards.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-white/10">
                    <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase">
                      Rewards Preview
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      {featuredCampaign.rewards.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 font-mono-custom text-xs text-white/80"
                        >
                          <span>{r.reward_type === 'drop' ? '🎁' : '🏆'}</span>
                          <span className="truncate max-w-[140px]">{r.title}</span>
                          {r.max_claims && (
                            <span className="text-[10px] text-eg font-semibold">
                              ({r.claimed_count}/{r.max_claims})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress bar if joined */}
                {featuredCampaign.user_progress && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between font-mono-custom text-xs">
                      <span className="text-white/60">Your Mission Progress</span>
                      <span className="text-eg font-bold">
                        {featuredCampaign.user_progress.progress_percent}% ({featuredCampaign.user_progress.completed_requirements}/{featuredCampaign.user_progress.total_requirements})
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-dark-300 overflow-hidden">
                      <div
                        className="h-full bg-eg rounded-full transition-all duration-500"
                        style={{ width: `${featuredCampaign.user_progress.progress_percent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Link
                    to={`/campaigns/${featuredCampaign.slug}`}
                    className="btn-primary py-3 px-8 text-xs inline-flex items-center gap-2"
                  >
                    ENTER CAMPAIGN <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Artwork Banner Side */}
              <div className="lg:col-span-5 relative min-h-[260px] lg:min-h-full bg-dark-300 overflow-hidden border-t lg:border-t-0 lg:border-l border-white/10">
                {featuredCampaign.banner_url || featuredCampaign.thumbnail_url ? (
                  <img
                    src={featuredCampaign.banner_url || featuredCampaign.thumbnail_url || ''}
                    alt={featuredCampaign.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-dark-200 to-dark-300">
                    <IsomerLogo size="lg" />
                    <p className="font-mono-custom text-xs text-eg/60 mt-4 tracking-widest uppercase">
                      MISSION ARTIFACT #01
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </section>
        )}

        {/* Filter and Search Bar */}
        <section id="browse-campaigns" className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Status tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-dark border border-white/10 w-full sm:w-auto overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All Quests' },
                  { id: 'active', label: 'Active' },
                  { id: 'upcoming', label: 'Upcoming' },
                  { id: 'ended', label: 'Ended' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`font-mono-custom text-xs px-4 py-2 rounded-xl transition-all capitalize whitespace-nowrap ${filter === tab.id
                    ? 'bg-eg text-dark font-bold shadow-eg-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full py-2 pl-9 pr-4 rounded-xl bg-dark-200/60 border border-white/10 text-white placeholder:text-white/30 text-xs font-sans focus:outline-none focus:border-eg/50 transition-colors"
              />
              <svg
                className="w-4 h-4 text-white/30 absolute left-3 top-2.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          {/* Campaigns Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-96 rounded-3xl glass-dark border border-white/10" />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="p-12 sm:p-16 rounded-3xl glass-dark border border-dashed border-white/15 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-white/30">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-bold text-white">NO ACTIVE CAMPAIGNS</h3>
              <p className="font-sans text-xs text-white/50 max-w-md mx-auto">
                New ISOMER campaigns and interactive quests will appear here. Stay tuned or check your notifications.
              </p>
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="btn-outline py-2 px-4 text-xs font-mono-custom mt-2"
                >
                  VIEW ALL CAMPAIGNS
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((camp) => (
                <CampaignCard key={camp.id} campaign={camp} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Badge Modal */}
      <BadgeDetailModal
        badge={selectedBadge}
        isOpen={!!selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />

      <FinalCtaFooter />
    </div>
  );
};

/* ── Campaign Card Component ───────────────────────────────────────── */
const CampaignCard: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const status = computeCampaignDisplayStatus(campaign);
  const rewards = campaign.rewards || [];

  return (
    <div className="group glass-dark rounded-3xl overflow-hidden border border-white/10 hover:border-eg/40 hover:shadow-xl hover:shadow-eg/10 transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Banner Artwork */}
        <div className="relative h-48 bg-dark-300 overflow-hidden">
          {campaign.banner_url || campaign.thumbnail_url ? (
            <img
              src={campaign.banner_url || campaign.thumbnail_url || ''}
              alt={campaign.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-dark-200">
              <span className="font-display font-bold text-xl text-white/30 tracking-widest">
                ISOMER QUEST
              </span>
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span className={`font-mono-custom text-[10px] tracking-wider px-2.5 py-1 rounded-full border font-bold uppercase ${status.color}`}>
              {status.label}
            </span>
          </div>
          {campaign.participants_count !== undefined && campaign.participants_count > 0 && (
            <div className="absolute bottom-3 right-3 font-mono-custom text-[10px] px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white/80 border border-white/10">
              👥 {campaign.participants_count} {campaign.participants_count === 1 ? 'member' : 'members'}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <p className="font-mono-custom text-[10px] text-white/40 uppercase">
              {new Date(campaign.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {campaign.end_date && ` — ${new Date(campaign.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </p>
            <h3 className="font-display text-lg font-bold text-white group-hover:text-eg transition-colors truncate">
              {campaign.title}
            </h3>
            <p className="font-sans text-xs text-white/60 line-clamp-2 leading-relaxed">
              {campaign.short_description}
            </p>
          </div>

          {/* Rewards Preview */}
          {rewards.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-white/5">
              <span className="font-mono-custom text-[10px] text-white/35 uppercase">
                Rewards:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {rewards.slice(0, 2).map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 font-mono-custom text-[10px] px-2 py-1 rounded-lg bg-dark-200/60 border border-white/10 text-white/75 truncate max-w-[150px]"
                  >
                    <span>{r.reward_type === 'drop' ? '🎁' : '🏆'}</span>
                    <span className="truncate">{r.title}</span>
                  </span>
                ))}
                {rewards.length > 2 && (
                  <span className="font-mono-custom text-[10px] px-2 py-1 rounded-lg bg-white/5 text-white/40">
                    +{rewards.length - 2} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Progress bar if joined */}
          {campaign.user_progress && (
            <div className="space-y-1 pt-2">
              <div className="flex justify-between font-mono-custom text-[10px]">
                <span className="text-white/50">Your Progress</span>
                <span className="text-eg font-semibold">
                  {campaign.user_progress.completed_requirements}/{campaign.user_progress.total_requirements}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-dark-300 overflow-hidden">
                <div
                  className="h-full bg-eg rounded-full transition-all duration-300"
                  style={{ width: `${campaign.user_progress.progress_percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer CTA */}
      <div className="p-6 pt-0">
        <Link
          to={`/campaigns/${campaign.slug}`}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-mono-custom flex items-center justify-center gap-2 transition-all ${status.key === 'active'
            ? 'btn-primary'
            : 'btn-outline border-white/20 text-white/70 hover:bg-white/5'
            }`}
        >
          {status.key === 'active'
            ? campaign.is_joined
              ? 'VIEW PROGRESS'
              : 'JOIN CAMPAIGN'
            : status.key === 'upcoming'
              ? 'COMING SOON'
              : 'VIEW ARCHIVE'}{' '}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default CampaignsPage;
