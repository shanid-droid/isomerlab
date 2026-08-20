import React, { useState, useMemo } from 'react';
import {
  useAdminCampaigns,
  useAdminBadges,
  computeCampaignDisplayStatus,
} from '../../lib/badgeCampaignHooks';
import { supabase } from '../../lib/supabase';
import type {
  Campaign,
  CampaignRequirement,
  CampaignReward,
  CampaignRequirementType,
  CampaignRewardType,
  CampaignEligibilityType,
  CampaignStatus,
  Badge,
} from '../../lib/types';

export const CampaignsManagementPanel: React.FC = () => {
  const {
    campaigns,
    loading,
    refresh,
    saveCampaign,
    deleteCampaign,
    duplicateCampaign,
  } = useAdminCampaigns();
  const { badges } = useAdminBadges();

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'upcoming' | 'ended'>('all');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Participants and Claims inspector states
  const [activeInspectorCampaign, setActiveInspectorCampaign] = useState<Campaign | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'participants' | 'claims'>('overview');
  const [participants, setParticipants] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // Manual grant modal state
  const [manualGrantOpen, setManualGrantOpen] = useState(false);
  const [manualUserSearch, setManualUserSearch] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [selectedGrantUser, setSelectedGrantUser] = useState<any | null>(null);
  const [selectedGrantRewardId, setSelectedGrantRewardId] = useState<string>('');
  const [granting, setGranting] = useState(false);
  const [panelMessage, setPanelMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const st = computeCampaignDisplayStatus(c);
      if (statusFilter !== 'all') {
        if (statusFilter === 'draft' && c.status !== 'draft') return false;
        if (statusFilter !== 'draft' && st.key !== statusFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
      }
      return true;
    });
  }, [campaigns, statusFilter, search]);

  // Open inspector
  const openInspector = async (camp: Campaign, defaultTab: 'overview' | 'participants' | 'claims' = 'overview') => {
    setActiveInspectorCampaign(camp);
    setInspectorTab(defaultTab);
    setInspectorLoading(true);
    try {
      // 1. Fetch analytics
      const { data: analData } = await supabase.rpc('get_campaign_analytics', {
        p_campaign_id: camp.id,
      });
      setAnalytics(analData);

      // 2. Fetch participants
      const { data: partData } = await supabase
        .from('campaign_participants')
        .select('*, user_profile:profiles(*)')
        .eq('campaign_id', camp.id)
        .order('joined_at', { ascending: false });
      setParticipants(partData || []);

      // 3. Fetch claims
      const { data: claimData } = await supabase
        .from('campaign_claims')
        .select('*, reward:campaign_rewards(*), user_profile:profiles(*)')
        .eq('campaign_id', camp.id)
        .order('claimed_at', { ascending: false });
      setClaims(claimData || []);
    } catch {
      // non-fatal
    } finally {
      setInspectorLoading(false);
    }
  };

  // Search user for manual grant
  const handleSearchUsers = async (q: string) => {
    setManualUserSearch(q);
    if (!q.trim()) {
      setSearchedUsers([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role')
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8);
    setSearchedUsers(data || []);
  };

  // Execute manual grant
  const handleExecuteManualGrant = async () => {
    if (!selectedGrantUser || !selectedGrantRewardId) return;
    setGranting(true);
    try {
      const { error: rpcErr } = await supabase.rpc('admin_manual_grant_reward', {
        p_campaign_reward_id: selectedGrantRewardId,
        p_user_id: selectedGrantUser.id,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      setPanelMessage({ text: 'Reward manually granted to user successfully!', type: 'success' });
      setManualGrantOpen(false);
      setSelectedGrantUser(null);
      setSelectedGrantRewardId('');
      if (activeInspectorCampaign) {
        await openInspector(activeInspectorCampaign, 'claims');
      }
      await refresh();
    } catch (err: unknown) {
      setPanelMessage({ text: (err as Error)?.message || 'Failed to grant reward', type: 'error' });
    } finally {
      setGranting(false);
    }
  };

  // Revoke claim
  const handleRevokeClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to revoke this claim? This will remove the claim and decrement the claimed count.')) return;
    try {
      const { error: rpcErr } = await supabase.rpc('admin_revoke_claim', {
        p_claim_id: claimId,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      setPanelMessage({ text: 'Claim revoked successfully', type: 'success' });
      if (activeInspectorCampaign) {
        await openInspector(activeInspectorCampaign, 'claims');
      }
      await refresh();
    } catch (err: unknown) {
      setPanelMessage({ text: (err as Error)?.message || 'Failed to revoke claim', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-eg" />
            Campaigns &amp; Quests Management
          </h2>
          <p className="font-sans text-xs text-white/50 mt-1">
            Create, publish, and orchestrate interactive ISOMER missions, requirements, drops, and community rewards.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCampaign(null);
            setEditorOpen(true);
          }}
          className="btn-primary py-2.5 px-5 text-xs font-mono-custom flex items-center gap-2 self-start sm:self-auto"
        >
          <span>+</span> CREATE CAMPAIGN
        </button>
      </div>

      {/* Notifications */}
      {panelMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono-custom flex items-center justify-between ${panelMessage.type === 'success'
            ? 'bg-eg/10 border-eg/40 text-eg'
            : 'bg-red-500/10 border-red-500/40 text-red-300'
            }`}
        >
          <span>{panelMessage.text}</span>
          <button onClick={() => setPanelMessage(null)} className="text-white/40 hover:text-white">✕</button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-dark border border-white/10 w-full sm:w-auto overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'draft', label: 'Drafts' },
              { id: 'upcoming', label: 'Scheduled' },
              { id: 'ended', label: 'Ended' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`font-mono-custom text-xs px-3.5 py-1.5 rounded-xl transition-all ${statusFilter === tab.id
                ? 'bg-eg text-dark font-bold shadow-eg-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter by title or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 py-2 px-3 rounded-xl bg-dark-200/60 border border-white/10 text-white placeholder:text-white/30 text-xs font-sans focus:outline-none focus:border-eg/50"
        />
      </div>

      {/* Campaigns Table / Cards */}
      {loading ? (
        <div className="p-8 text-center glass-dark rounded-2xl border border-white/10 font-mono-custom text-xs text-white/40">
          Loading campaigns...
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="p-12 text-center glass-dark rounded-2xl border border-dashed border-white/15 space-y-3">
          <p className="font-mono-custom text-xs text-white/40 uppercase">No campaigns found</p>
          <p className="font-sans text-xs text-white/50">
            Create your first interactive campaign to engage community members and creators.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCampaigns.map((camp) => {
            const st = computeCampaignDisplayStatus(camp);
            const reqsCount = camp.requirements?.length || 0;
            const rewsCount = camp.rewards?.length || 0;

            return (
              <div
                key={camp.id}
                className="glass-dark rounded-2xl p-5 border border-white/10 hover:border-eg/30 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left side details */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-xl bg-dark-300 border border-white/10 overflow-hidden flex-shrink-0 relative">
                    {camp.thumbnail_url || camp.banner_url ? (
                      <img src={camp.thumbnail_url || camp.banner_url || ''} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-mono-custom text-xs text-white/30">
                        QUEST
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-mono-custom text-[9px] tracking-wider px-2 py-0.5 rounded-full border font-bold uppercase ${st.color}`}>
                        {st.label}
                      </span>
                      {camp.is_featured && (
                        <span className="font-mono-custom text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                          ★ FEATURED
                        </span>
                      )}
                      <span className="font-mono-custom text-[10px] text-white/40">
                        slug: /{camp.slug}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-bold text-white truncate">
                      {camp.title}
                    </h3>

                    <p className="font-sans text-xs text-white/60 line-clamp-1">
                      {camp.short_description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono-custom text-white/40 pt-1">
                      <span>👥 {camp.participants_count || 0} participants</span>
                      <span>📋 {reqsCount} requirements</span>
                      <span>🏆 {rewsCount} rewards</span>
                      <span>
                        📅 {new Date(camp.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {camp.end_date ? ` - ${new Date(camp.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' (Ongoing)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side actions */}
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openInspector(camp, 'overview')}
                    className="btn-outline py-1.5 px-3 text-xs font-mono-custom text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
                  >
                    Analytics &amp; Data
                  </button>

                  <button
                    onClick={() => {
                      setEditingCampaign(camp);
                      setEditorOpen(true);
                    }}
                    className="btn-outline py-1.5 px-3 text-xs font-mono-custom"
                  >
                    Edit
                  </button>

                  <button
                    onClick={async () => {
                      await duplicateCampaign(camp);
                      setPanelMessage({ text: `Duplicated campaign: ${camp.title}`, type: 'success' });
                    }}
                    className="btn-outline py-1.5 px-2.5 text-xs font-mono-custom text-white/60 hover:text-white"
                    title="Duplicate Campaign"
                  >
                    Copy
                  </button>

                  <a
                    href={`/campaigns/${camp.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outline py-1.5 px-2.5 text-xs font-mono-custom text-white/60 hover:text-white"
                    title="View Public Page"
                  >
                    ↗
                  </a>

                  <button
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete campaign "${camp.title}"? This cannot be undone.`)) {
                        const res = await deleteCampaign(camp.id);
                        if (res.success) {
                          setPanelMessage({ text: 'Campaign deleted', type: 'success' });
                        }
                      }
                    }}
                    className="btn-outline py-1.5 px-2.5 text-xs font-mono-custom text-red-400 border-red-500/30 hover:bg-red-500/10"
                    title="Delete Campaign"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CAMPAIGN EDITOR MODAL ─────────────────────────────────────── */}
      {editorOpen && (
        <CampaignEditorModal
          campaign={editingCampaign}
          badges={badges}
          isOpen={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditingCampaign(null);
          }}
          onSave={async (campData, reqs, rews) => {
            const res = await saveCampaign(campData, reqs, rews);
            if (res.success) {
              setPanelMessage({ text: 'Campaign saved successfully!', type: 'success' });
              setEditorOpen(false);
              setEditingCampaign(null);
            } else {
              alert(res.error || 'Failed to save campaign');
            }
          }}
        />
      )}

      {/* ── CAMPAIGN INSPECTOR DRAWER ─────────────────────────────────── */}
      {activeInspectorCampaign && (
        <CampaignInspectorDrawer
          campaign={activeInspectorCampaign}
          tab={inspectorTab}
          onTabChange={setInspectorTab}
          analytics={analytics}
          participants={participants}
          claims={claims}
          loading={inspectorLoading}
          onClose={() => setActiveInspectorCampaign(null)}
          onOpenManualGrant={() => setManualGrantOpen(true)}
          onRevokeClaim={handleRevokeClaim}
        />
      )}

      {/* ── MANUAL REWARD GRANT MODAL ─────────────────────────────────── */}
      {manualGrantOpen && activeInspectorCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg glass-dark rounded-3xl p-6 sm:p-8 border border-eg/30 space-y-6 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Manual Reward Grant</h3>
              <button onClick={() => setManualGrantOpen(false)} className="text-white/40 hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              {/* Select Reward */}
              <div className="space-y-1.5">
                <label className="font-mono-custom text-[10px] text-white/50 uppercase">Select Reward to Grant</label>
                <select
                  value={selectedGrantRewardId}
                  onChange={(e) => setSelectedGrantRewardId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                >
                  <option value="">-- Choose Reward --</option>
                  {(activeInspectorCampaign.rewards || []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.reward_type === 'drop' ? 'Limited Drop' : 'Badge'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search User */}
              <div className="space-y-1.5">
                <label className="font-mono-custom text-[10px] text-white/50 uppercase">Search Recipient User</label>
                <input
                  type="text"
                  placeholder="Type name or email..."
                  value={manualUserSearch}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                />

                {searchedUsers.length > 0 && (
                  <div className="p-2 rounded-xl bg-dark-300 border border-white/10 space-y-1 max-h-48 overflow-y-auto">
                    {searchedUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedGrantUser(u);
                          setSearchedUsers([]);
                          setManualUserSearch(u.full_name || u.email);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs font-sans flex items-center justify-between hover:bg-white/10 ${selectedGrantUser?.id === u.id ? 'bg-eg/20 text-eg' : 'text-white'
                          }`}
                      >
                        <span className="font-medium">{u.full_name || 'Member'}</span>
                        <span className="text-white/40 font-mono-custom text-[10px]">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedGrantUser && (
                  <div className="p-3 rounded-xl bg-eg/10 border border-eg/30 text-eg text-xs font-mono-custom flex items-center justify-between">
                    <span>Selected: {selectedGrantUser.full_name || selectedGrantUser.email}</span>
                    <button type="button" onClick={() => setSelectedGrantUser(null)} className="text-eg/60 hover:text-eg">✕</button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button onClick={() => setManualGrantOpen(false)} className="btn-outline py-2 px-4 text-xs font-mono-custom">
                Cancel
              </button>
              <button
                onClick={handleExecuteManualGrant}
                disabled={granting || !selectedGrantUser || !selectedGrantRewardId}
                className="btn-primary py-2 px-5 text-xs font-mono-custom"
              >
                {granting ? 'Granting...' : 'Grant Reward'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── CAMPAIGN EDITOR MODAL COMPONENT ───────────────────────────────── */
interface EditorModalProps {
  campaign: Campaign | null;
  badges: Badge[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    campaignData: Partial<Campaign>,
    requirements: Partial<CampaignRequirement>[],
    rewards: Partial<CampaignReward>[]
  ) => Promise<void>;
}

const CampaignEditorModal: React.FC<EditorModalProps> = ({
  campaign,
  badges,
  isOpen,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'requirements' | 'rewards'>('details');

  // Campaign Form State
  const [title, setTitle] = useState(campaign?.title || '');
  const [slug, setSlug] = useState(campaign?.slug || '');
  const [shortDesc, setShortDesc] = useState(campaign?.short_description || '');
  const [desc, setDesc] = useState(campaign?.description || '');
  const [bannerUrl, setBannerUrl] = useState(campaign?.banner_url || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(campaign?.thumbnail_url || '');
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status || 'draft');
  const [startDate, setStartDate] = useState(
    campaign?.start_date ? new Date(campaign.start_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState(
    campaign?.end_date ? new Date(campaign.end_date).toISOString().slice(0, 16) : ''
  );
  const [isFeatured, setIsFeatured] = useState(campaign?.is_featured || false);

  // Requirements State
  const [requirements, setRequirements] = useState<Partial<CampaignRequirement>[]>(
    campaign?.requirements || [
      {
        title: 'Explore & Like Projects',
        description: 'Discover and like at least 2 community creations in the catalogue.',
        requirement_type: 'like_project',
        target_count: 2,
        is_required: true,
      },
    ]
  );

  // Rewards State
  const [rewards, setRewards] = useState<Partial<CampaignReward>[]>(
    campaign?.rewards || [
      {
        title: 'Explorer Badge',
        reward_type: 'badge',
        badge_id: badges[0]?.id || null,
        eligibility_type: 'all_requirements',
        is_claimable: true,
      },
    ]
  );

  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  // Slug generator helper
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!campaign) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || !shortDesc.trim()) {
      alert('Please fill in required fields (Title, Slug, Short Description)');
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          id: campaign?.id,
          title,
          slug,
          short_description: shortDesc,
          description: desc,
          banner_url: bannerUrl || null,
          thumbnail_url: thumbnailUrl || null,
          status,
          start_date: new Date(startDate).toISOString(),
          end_date: endDate ? new Date(endDate).toISOString() : null,
          is_featured: isFeatured,
        },
        requirements,
        rewards
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] glass-dark rounded-3xl border border-eg/30 flex flex-col text-white overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-bold">
              {campaign ? `Edit Campaign: ${campaign.title}` : 'Create New Campaign'}
            </h3>
            <p className="font-sans text-xs text-white/50">
              Configure campaign details, automated requirements, and claimable reward items.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/40 hover:text-white">✕</button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-white/10 px-6 bg-dark-200/50">
          {(
            [
              { id: 'details', label: '1. Basic Details' },
              { id: 'requirements', label: `2. Requirements (${requirements.length})` },
              { id: 'rewards', label: `3. Rewards & Drops (${rewards.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`font-mono-custom text-xs py-3 px-4 border-b-2 transition-all ${activeTab === t.id
                ? 'border-eg text-eg font-bold'
                : 'border-transparent text-white/50 hover:text-white'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-mono-custom text-[10px] text-white/50 uppercase">Campaign Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. ISOMER Genesis Launch"
                    className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono-custom text-[10px] text-white/50 uppercase">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. genesis-launch"
                    className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono-custom text-[10px] text-white/50 uppercase">Short Description (for cards) *</label>
                <input
                  type="text"
                  required
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  placeholder="Brief summary displayed on discovery cards..."
                  className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-mono-custom text-[10px] text-white/50 uppercase">Full Description / Lore</label>
                <textarea
                  rows={4}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Detailed guidelines, backstory, and campaign instructions..."
                  className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-mono-custom text-[10px] text-white/50 uppercase">Banner Artwork URL</label>
                  <input
                    type="text"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://.../banner.jpg"
                    className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono-custom text-[10px] text-white/50 uppercase">Thumbnail URL</label>
                  <input
                    type="text"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://.../thumb.jpg"
                    className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="font-mono-custom text-[10px] text-white/50 uppercase">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                    className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published / Active</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="ended">Ended</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono-custom text-[10px] text-white/50 uppercase">Start Date</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono-custom text-[10px] text-white/50 uppercase">End Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="feat-toggle"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded border-white/20 bg-dark-200 text-eg focus:ring-eg/40"
                />
                <label htmlFor="feat-toggle" className="font-sans text-xs text-white/80 cursor-pointer">
                  Feature this campaign in the Hero spotlight banner
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: REQUIREMENTS */}
          {activeTab === 'requirements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-sans text-xs text-white/60">
                  Define what users must complete. Requirements are validated live against database interactions.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setRequirements([
                      ...requirements,
                      {
                        title: 'New Requirement',
                        description: '',
                        requirement_type: 'like_project',
                        target_count: 1,
                        is_required: true,
                      },
                    ])
                  }
                  className="btn-outline py-1.5 px-3 text-xs font-mono-custom text-eg border-eg/30"
                >
                  + Add Requirement
                </button>
              </div>

              <div className="space-y-3">
                {requirements.map((req, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-dark-200 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-custom text-xs text-eg font-bold">Requirement #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setRequirements(requirements.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300 text-xs font-mono-custom"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="font-mono-custom text-[9px] text-white/50 uppercase">Title</label>
                        <input
                          type="text"
                          value={req.title || ''}
                          onChange={(e) => {
                            const copy = [...requirements];
                            copy[idx].title = e.target.value;
                            setRequirements(copy);
                          }}
                          placeholder="e.g. Like 3 Community Projects"
                          className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono-custom text-[9px] text-white/50 uppercase">Type</label>
                        <select
                          value={req.requirement_type || 'like_project'}
                          onChange={(e) => {
                            const copy = [...requirements];
                            copy[idx].requirement_type = e.target.value as CampaignRequirementType;
                            setRequirements(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                        >
                          <option value="like_project">Like Projects</option>
                          <option value="comment_project">Comment on Projects</option>
                          <option value="publish_project">Publish Projects (Creator)</option>
                          <option value="profile_complete">Complete Profile</option>
                          <option value="apply_creator">Submit Creator Application</option>
                          <option value="link_social">Link Social Account</option>
                          <option value="community_action">Community Action / URL Visit</option>
                          <option value="custom_check">Custom Action</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="font-mono-custom text-[9px] text-white/50 uppercase">Target Count</label>
                        <input
                          type="number"
                          min={1}
                          value={req.target_count || 1}
                          onChange={(e) => {
                            const copy = [...requirements];
                            copy[idx].target_count = parseInt(e.target.value) || 1;
                            setRequirements(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="font-mono-custom text-[9px] text-white/50 uppercase">Description / Instruction</label>
                        <input
                          type="text"
                          value={req.description || ''}
                          onChange={(e) => {
                            const copy = [...requirements];
                            copy[idx].description = e.target.value;
                            setRequirements(copy);
                          }}
                          placeholder="Instructions shown to user..."
                          className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: REWARDS */}
          {activeTab === 'rewards' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-sans text-xs text-white/60">
                  Configure badges or limited drops. Claims are validated atomically.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setRewards([
                      ...rewards,
                      {
                        title: 'Campaign Reward',
                        reward_type: 'badge',
                        badge_id: badges[0]?.id || null,
                        eligibility_type: 'all_requirements',
                        is_claimable: true,
                      },
                    ])
                  }
                  className="btn-outline py-1.5 px-3 text-xs font-mono-custom text-eg border-eg/30"
                >
                  + Add Reward
                </button>
              </div>

              <div className="space-y-3">
                {rewards.map((rew, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-dark-200 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-custom text-xs text-amber-400 font-bold">Reward #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setRewards(rewards.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300 text-xs font-mono-custom"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="font-mono-custom text-[9px] text-white/50 uppercase">Reward Title</label>
                        <input
                          type="text"
                          value={rew.title || ''}
                          onChange={(e) => {
                            const copy = [...rewards];
                            copy[idx].title = e.target.value;
                            setRewards(copy);
                          }}
                          placeholder="e.g. Master Badge"
                          className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono-custom text-[9px] text-white/50 uppercase">Type</label>
                        <select
                          value={rew.reward_type || 'badge'}
                          onChange={(e) => {
                            const copy = [...rewards];
                            copy[idx].reward_type = e.target.value as CampaignRewardType;
                            setRewards(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                        >
                          <option value="badge">Badge (From Catalog)</option>
                          <option value="drop">Limited Campaign Drop</option>
                          <option value="custom">Custom Item</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono-custom text-[9px] text-white/50 uppercase">Badge Link</label>
                        <select
                          value={rew.badge_id || ''}
                          onChange={(e) => {
                            const copy = [...rewards];
                            copy[idx].badge_id = e.target.value || null;
                            const matchedBadge = badges.find((b) => b.id === e.target.value);
                            if (matchedBadge && !rew.title) {
                              copy[idx].title = matchedBadge.name;
                            }
                            setRewards(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                        >
                          <option value="">-- Select Badge --</option>
                          {badges.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.rarity})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="font-mono-custom text-[9px] text-white/50 uppercase">Max Claims (Drop Cap)</label>
                        <input
                          type="number"
                          placeholder="Leave empty for unlimited"
                          value={rew.max_claims ?? ''}
                          onChange={(e) => {
                            const copy = [...rewards];
                            copy[idx].max_claims = e.target.value ? parseInt(e.target.value) : null;
                            setRewards(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono-custom text-[9px] text-white/50 uppercase">Eligibility Rule</label>
                        <select
                          value={rew.eligibility_type || 'all_requirements'}
                          onChange={(e) => {
                            const copy = [...rewards];
                            copy[idx].eligibility_type = e.target.value as CampaignEligibilityType;
                            setRewards(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                        >
                          <option value="all_requirements">Complete All Requirements</option>
                          <option value="min_requirements_count">Min Requirements Count</option>
                          <option value="manual">Manual Admin Approval</option>
                        </select>
                      </div>

                      {rew.eligibility_type === 'min_requirements_count' && (
                        <div className="space-y-1">
                          <label className="font-mono-custom text-[9px] text-white/50 uppercase">Min Count</label>
                          <input
                            type="number"
                            min={1}
                            value={rew.min_requirements_count || 1}
                            onChange={(e) => {
                              const copy = [...rewards];
                              copy[idx].min_requirements_count = parseInt(e.target.value) || 1;
                              setRewards(copy);
                            }}
                            className="w-full p-2 rounded-lg bg-dark-300 border border-white/10 text-white text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-6 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline py-2.5 px-5 text-xs font-mono-custom"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary py-2.5 px-6 text-xs font-mono-custom"
            >
              {saving ? 'Saving Campaign...' : 'Save & Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── CAMPAIGN INSPECTOR DRAWER ─────────────────────────────────────── */
interface InspectorProps {
  campaign: Campaign;
  tab: 'overview' | 'participants' | 'claims';
  onTabChange: (t: 'overview' | 'participants' | 'claims') => void;
  analytics: any | null;
  participants: any[];
  claims: any[];
  loading: boolean;
  onClose: () => void;
  onOpenManualGrant: () => void;
  onRevokeClaim: (id: string) => Promise<void>;
}

const CampaignInspectorDrawer: React.FC<InspectorProps> = ({
  campaign,
  tab,
  onTabChange,
  analytics,
  participants,
  claims,
  loading,
  onClose,
  onOpenManualGrant,
  onRevokeClaim,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl h-full glass-dark border-l border-eg/30 flex flex-col text-white">
        {/* Drawer Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="min-w-0">
            <span className="font-mono-custom text-[10px] text-eg uppercase tracking-widest">
              CAMPAIGN ANALYTICS &amp; AUDIT
            </span>
            <h3 className="font-display text-xl font-bold text-white truncate">{campaign.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/40 hover:text-white">✕</button>
        </div>

        {/* Subtabs */}
        <div className="flex border-b border-white/10 px-6 bg-dark-200/40">
          {(
            [
              { id: 'overview', label: 'Analytics' },
              { id: 'participants', label: `Participants (${participants.length})` },
              { id: 'claims', label: `Claims (${claims.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`font-mono-custom text-xs py-3 px-4 border-b-2 transition-all ${tab === t.id ? 'border-eg text-eg font-bold' : 'border-transparent text-white/50 hover:text-white'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="p-8 text-center font-mono-custom text-xs text-white/40">Loading details...</div>
          ) : tab === 'overview' ? (
            <div className="space-y-6">
              {/* Analytics metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl glass bg-dark-200/50 border border-white/10">
                  <p className="font-mono-custom text-[10px] text-white/40 uppercase">Total Participants</p>
                  <p className="font-display text-2xl font-bold text-white mt-1">
                    {analytics?.participants_count ?? participants.length}
                  </p>
                </div>
                <div className="p-4 rounded-xl glass bg-dark-200/50 border border-white/10">
                  <p className="font-mono-custom text-[10px] text-white/40 uppercase">Completed Quests</p>
                  <p className="font-display text-2xl font-bold text-eg mt-1">
                    {analytics?.completed_count ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl glass bg-dark-200/50 border border-white/10">
                  <p className="font-mono-custom text-[10px] text-white/40 uppercase">Completion Rate</p>
                  <p className="font-display text-2xl font-bold text-cyan-300 mt-1">
                    {analytics?.completion_rate ?? 0}%
                  </p>
                </div>
                <div className="p-4 rounded-xl glass bg-dark-200/50 border border-white/10">
                  <p className="font-mono-custom text-[10px] text-white/40 uppercase">Total Claims</p>
                  <p className="font-display text-2xl font-bold text-amber-300 mt-1">
                    {analytics?.claims_count ?? claims.length}
                  </p>
                </div>
                <div className="p-4 rounded-xl glass bg-dark-200/50 border border-white/10">
                  <p className="font-mono-custom text-[10px] text-white/40 uppercase">Badges Awarded</p>
                  <p className="font-display text-2xl font-bold text-purple-300 mt-1">
                    {analytics?.badges_awarded ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl glass bg-dark-200/50 border border-white/10">
                  <p className="font-mono-custom text-[10px] text-white/40 uppercase">Drops Claimed</p>
                  <p className="font-display text-2xl font-bold text-emerald-300 mt-1">
                    {analytics?.drops_claimed ?? 0}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-4 rounded-2xl glass-dark border border-white/10 space-y-3">
                <h4 className="font-mono-custom text-xs text-white/70 uppercase">Quick Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onOpenManualGrant}
                    className="btn-primary py-2 px-4 text-xs font-mono-custom"
                  >
                    + Manually Grant Reward to User
                  </button>
                </div>
              </div>
            </div>
          ) : tab === 'participants' ? (
            <div className="space-y-3">
              {participants.length === 0 ? (
                <p className="text-center font-mono-custom text-xs text-white/40 py-8">
                  No participants have enrolled in this campaign yet.
                </p>
              ) : (
                participants.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl glass bg-dark-200/50 border border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">
                        {p.user_profile?.full_name || 'Member'}
                      </p>
                      <p className="font-mono-custom text-[10px] text-white/40 truncate">
                        {p.user_profile?.email || p.user_id}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 font-mono-custom text-[10px]">
                      <span className="text-eg uppercase">{p.status}</span>
                      <p className="text-white/40">
                        {new Date(p.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2">
                <span className="font-mono-custom text-xs text-white/50">Claims Record</span>
                <button
                  onClick={onOpenManualGrant}
                  className="btn-primary py-1 px-3 text-[10px] font-mono-custom"
                >
                  + Grant Reward
                </button>
              </div>

              {claims.length === 0 ? (
                <p className="text-center font-mono-custom text-xs text-white/40 py-8">
                  No claims recorded yet.
                </p>
              ) : (
                claims.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl glass bg-dark-200/50 border border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">
                        {c.reward?.title || 'Reward'} → {c.user_profile?.full_name || c.user_profile?.email}
                      </p>
                      <p className="font-mono-custom text-[10px] text-white/40">
                        Claimed at: {new Date(c.claimed_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => onRevokeClaim(c.id)}
                      className="text-red-400 hover:text-red-300 text-[10px] font-mono-custom px-2 py-1 rounded bg-red-500/10 border border-red-500/20 flex-shrink-0"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
