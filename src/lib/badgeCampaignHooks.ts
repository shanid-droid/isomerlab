import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type {
  Badge,
  UserBadge,
  Campaign,
  CampaignRequirement,
  CampaignReward,
  CampaignClaim,
  CampaignProgressResult,
  BadgeRarity,
  BadgeCategory,
  CampaignStatus,
} from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getRarityBadgeStyle(rarity: BadgeRarity): {
  badgeBg: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
  label: string;
} {
  switch (rarity) {
    case 'legendary':
      return {
        badgeBg: 'bg-amber-500/10',
        borderColor: 'border-amber-400/50',
        textColor: 'text-amber-300',
        glowColor: 'shadow-amber-500/20',
        label: 'LEGENDARY',
      };
    case 'epic':
      return {
        badgeBg: 'bg-purple-500/10',
        borderColor: 'border-purple-400/50',
        textColor: 'text-purple-300',
        glowColor: 'shadow-purple-500/20',
        label: 'EPIC',
      };
    case 'rare':
      return {
        badgeBg: 'bg-cyan-500/10',
        borderColor: 'border-cyan-400/50',
        textColor: 'text-cyan-300',
        glowColor: 'shadow-cyan-500/20',
        label: 'RARE',
      };
    case 'common':
    default:
      return {
        badgeBg: 'bg-emerald-500/10',
        borderColor: 'border-emerald-400/40',
        textColor: 'text-emerald-300',
        glowColor: 'shadow-emerald-500/15',
        label: 'COMMON',
      };
  }
}

export function computeCampaignDisplayStatus(c: {
  status: CampaignStatus;
  start_date: string;
  end_date?: string | null;
}): { label: string; key: 'active' | 'upcoming' | 'ended' | 'draft'; color: string } {
  if (c.status === 'draft') {
    return { label: 'DRAFT', key: 'draft', color: 'text-white/40 border-white/20 bg-white/5' };
  }
  const now = new Date();
  const start = new Date(c.start_date);
  const end = c.end_date ? new Date(c.end_date) : null;

  if (start > now) {
    return { label: 'COMING SOON', key: 'upcoming', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' };
  }
  if (end && end < now) {
    return { label: 'CAMPAIGN ENDED', key: 'ended', color: 'text-white/40 border-white/20 bg-dark-300' };
  }
  return { label: 'ACTIVE', key: 'active', color: 'text-eg border-eg/40 bg-eg/10 shadow-eg-sm' };
}

// ─── usePublicCampaigns ──────────────────────────────────────────────────────

export function usePublicCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const currentUserId = userRes?.user?.id;

      // 1. Fetch published campaigns
      const { data: campData, error: campErr } = await supabase
        .from('campaigns')
        .select('*')
        .in('status', ['published', 'active', 'upcoming', 'ended'])
        .order('is_featured', { ascending: false })
        .order('featured_order', { ascending: true })
        .order('start_date', { ascending: false });

      if (campErr) throw new Error(campErr.message);
      const rows = (campData as Campaign[]) ?? [];
      if (rows.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      const campIds = rows.map((c) => c.id);

      // 2. Fetch rewards with badge data
      const { data: rewardsData } = await supabase
        .from('campaign_rewards')
        .select('*, badge:badges(*)')
        .in('campaign_id', campIds)
        .order('sort_order', { ascending: true });

      // 3. Fetch participants counts
      const { data: partData } = await supabase
        .from('campaign_participants')
        .select('campaign_id, user_id');

      const partCountMap: Record<string, number> = {};
      const userJoinedSet = new Set<string>();
      (partData ?? []).forEach((p: { campaign_id: string; user_id: string }) => {
        partCountMap[p.campaign_id] = (partCountMap[p.campaign_id] || 0) + 1;
        if (currentUserId && p.user_id === currentUserId) {
          userJoinedSet.add(p.campaign_id);
        }
      });

      // 4. If logged in, fetch user progress for joined campaigns
      const progressMap: Record<string, CampaignProgressResult> = {};
      if (currentUserId) {
        await Promise.all(
          rows.map(async (c) => {
            try {
              const { data: prog } = await supabase.rpc('check_user_campaign_progress', {
                p_campaign_id: c.id,
                p_user_id: currentUserId,
              });
              if (prog) {
                progressMap[c.id] = prog as CampaignProgressResult;
              }
            } catch {
              // non-fatal
            }
          })
        );
      }

      // 5. Combine data
      const enriched = rows.map((c) => {
        const cRewards = (rewardsData as CampaignReward[])?.filter((r) => r.campaign_id === c.id) || [];
        return {
          ...c,
          rewards: cRewards,
          participants_count: partCountMap[c.id] || 0,
          is_joined: userJoinedSet.has(c.id),
          user_progress: progressMap[c.id] || undefined,
        };
      });

      setCampaigns(enriched);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return { campaigns, loading, error, refresh: fetchCampaigns };
}

// ─── useCampaignDetail ───────────────────────────────────────────────────────

export function useCampaignDetail(slugOrId?: string) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [requirements, setRequirements] = useState<CampaignRequirement[]>([]);
  const [rewards, setRewards] = useState<CampaignReward[]>([]);
  const [userProgress, setUserProgress] = useState<CampaignProgressResult | null>(null);
  const [userClaims, setUserClaims] = useState<CampaignClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!slugOrId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const currentUserId = userRes?.user?.id;

      // 1. Fetch campaign
      let query = supabase.from('campaigns').select('*');
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      if (isUUID) {
        query = query.eq('id', slugOrId);
      } else {
        query = query.eq('slug', slugOrId);
      }

      const { data: campData, error: campErr } = await query.maybeSingle();
      if (campErr) throw new Error(campErr.message);
      if (!campData) throw new Error('Campaign not found');

      const camp = campData as Campaign;

      // 2. Fetch requirements
      const { data: reqsData } = await supabase
        .from('campaign_requirements')
        .select('*')
        .eq('campaign_id', camp.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      // 3. Fetch rewards with badge info
      const { data: rewData } = await supabase
        .from('campaign_rewards')
        .select('*, badge:badges(*)')
        .eq('campaign_id', camp.id)
        .order('sort_order', { ascending: true });

      // 4. Fetch participants count
      const { count: partCount } = await supabase
        .from('campaign_participants')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', camp.id);

      // 5. Fetch claims & progress if logged in
      let claims: CampaignClaim[] = [];
      let progResult: CampaignProgressResult | null = null;
      let isJoined = false;

      if (currentUserId) {
        const { data: claimData } = await supabase
          .from('campaign_claims')
          .select('*, reward:campaign_rewards(*), user_profile:profiles(*)')
          .eq('campaign_id', camp.id)
          .eq('user_id', currentUserId);

        claims = (claimData as CampaignClaim[]) || [];

        const { data: partRow } = await supabase
          .from('campaign_participants')
          .select('id')
          .eq('campaign_id', camp.id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        isJoined = !!partRow;

        const { data: prog } = await supabase.rpc('check_user_campaign_progress', {
          p_campaign_id: camp.id,
          p_user_id: currentUserId,
        });

        if (prog) {
          progResult = prog as CampaignProgressResult;
        }
      }

      const claimedRewardIdSet = new Set(claims.map((c) => c.campaign_reward_id));
      const enrichedRewards = ((rewData as CampaignReward[]) || []).map((r) => ({
        ...r,
        has_claimed: claimedRewardIdSet.has(r.id),
      }));

      setCampaign({
        ...camp,
        participants_count: partCount || 0,
        is_joined: isJoined,
      });
      setRequirements((reqsData as CampaignRequirement[]) || []);
      setRewards(enrichedRewards);
      setUserProgress(progResult);
      setUserClaims(claims);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load campaign detail');
    } finally {
      setLoading(false);
    }
  }, [slugOrId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    campaign,
    requirements,
    rewards,
    userProgress,
    userClaims,
    loading,
    error,
    refresh: fetchDetail,
  };
}

// ─── useUserBadges ───────────────────────────────────────────────────────────

export function useUserBadges(userId?: string | null) {
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBadges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        targetUserId = session?.user?.id ?? null;
      }
      if (!targetUserId) {
        setUserBadges([]);
        setLoading(false);
        return;
      }
      const { data, error: sbErr } = await supabase
        .from('user_badges')
        .select('*, badge:badges(*)')
        .eq('user_id', targetUserId)
        .order('awarded_at', { ascending: false });

      if (sbErr) throw new Error(sbErr.message);
      setUserBadges((data as UserBadge[]) || []);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load user badges');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  return { userBadges, loading, error, refresh: fetchBadges };
}

// ─── useUserCampaigns ────────────────────────────────────────────────────────

export function useUserCampaigns() {
  const [joinedCampaigns, setJoinedCampaigns] = useState<Campaign[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<CampaignClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const currentUserId = userRes?.user?.id;
      if (!currentUserId) {
        setJoinedCampaigns([]);
        setClaimedRewards([]);
        setLoading(false);
        return;
      }

      // 1. Fetch claims
      const { data: claimsData } = await supabase
        .from('campaign_claims')
        .select('*, reward:campaign_rewards(*, badge:badges(*))')
        .eq('user_id', currentUserId)
        .order('claimed_at', { ascending: false });

      setClaimedRewards((claimsData as CampaignClaim[]) || []);

      // 2. Fetch joined campaigns
      const { data: partData } = await supabase
        .from('campaign_participants')
        .select('campaign_id, status, joined_at, campaign:campaigns(*)')
        .eq('user_id', currentUserId);

      const camps: Campaign[] = [];
      if (partData) {
        for (const p of (partData as unknown as { campaign_id: string; campaign: Campaign | null }[])) {
          if (p.campaign) {
            const { data: prog } = await supabase.rpc('check_user_campaign_progress', {
              p_campaign_id: p.campaign.id,
              p_user_id: currentUserId,
            });
            camps.push({
              ...p.campaign,
              is_joined: true,
              user_progress: prog as CampaignProgressResult,
            });
          }
        }
      }

      setJoinedCampaigns(camps);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load user campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserCampaigns();
  }, [fetchUserCampaigns]);

  return { joinedCampaigns, claimedRewards, loading, error, refresh: fetchUserCampaigns };
}

// ─── useAdminCampaigns ───────────────────────────────────────────────────────

export function useAdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sbErr } = await supabase
        .from('campaigns')
        .select('*, requirements:campaign_requirements(*), rewards:campaign_rewards(*, badge:badges(*))')
        .order('created_at', { ascending: false });

      if (sbErr) throw new Error(sbErr.message);

      // Fetch participants and claims counts
      const rows = (data as Campaign[]) || [];
      const campIds = rows.map((r) => r.id);

      let partCountMap: Record<string, number> = {};
      let claimsCountMap: Record<string, number> = {};

      if (campIds.length > 0) {
        const { data: parts } = await supabase
          .from('campaign_participants')
          .select('campaign_id');
        (parts || []).forEach((p: { campaign_id: string }) => {
          partCountMap[p.campaign_id] = (partCountMap[p.campaign_id] || 0) + 1;
        });

        const { data: claims } = await supabase
          .from('campaign_claims')
          .select('campaign_id');
        (claims || []).forEach((c: { campaign_id: string }) => {
          claimsCountMap[c.campaign_id] = (claimsCountMap[c.campaign_id] || 0) + 1;
        });
      }

      setCampaigns(
        rows.map((c) => ({
          ...c,
          participants_count: partCountMap[c.id] || 0,
          claims_count: claimsCountMap[c.id] || 0,
        }))
      );
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load admin campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminCampaigns();
  }, [fetchAdminCampaigns]);

  const saveCampaign = async (
    campaignData: Partial<Campaign>,
    requirementsData: Partial<CampaignRequirement>[],
    rewardsData: Partial<CampaignReward>[]
  ) => {
    try {
      let campId = campaignData.id;

      if (!campId) {
        // Create new
        const { data: newCamp, error: createErr } = await supabase
          .from('campaigns')
          .insert({
            title: campaignData.title,
            slug: campaignData.slug,
            short_description: campaignData.short_description,
            description: campaignData.description,
            banner_url: campaignData.banner_url,
            thumbnail_url: campaignData.thumbnail_url,
            status: campaignData.status || 'draft',
            start_date: campaignData.start_date || new Date().toISOString(),
            end_date: campaignData.end_date || null,
            is_featured: campaignData.is_featured || false,
            featured_order: campaignData.featured_order || 0,
          })
          .select()
          .single();

        if (createErr) throw new Error(createErr.message);
        campId = newCamp.id;
      } else {
        // Update existing
        const { error: updateErr } = await supabase
          .from('campaigns')
          .update({
            title: campaignData.title,
            slug: campaignData.slug,
            short_description: campaignData.short_description,
            description: campaignData.description,
            banner_url: campaignData.banner_url,
            thumbnail_url: campaignData.thumbnail_url,
            status: campaignData.status,
            start_date: campaignData.start_date,
            end_date: campaignData.end_date,
            is_featured: campaignData.is_featured,
            featured_order: campaignData.featured_order,
            updated_at: new Date().toISOString(),
          })
          .eq('id', campId);

        if (updateErr) throw new Error(updateErr.message);
      }

      // Sync requirements: delete removed, update/insert
      await supabase.from('campaign_requirements').delete().eq('campaign_id', campId);
      if (requirementsData.length > 0) {
        const reqRows = requirementsData.map((r, idx) => ({
          campaign_id: campId,
          title: r.title || 'Requirement',
          description: r.description || null,
          requirement_type: r.requirement_type || 'like_project',
          target_count: r.target_count || 1,
          target_entity_id: r.target_entity_id || null,
          metadata: r.metadata || {},
          sort_order: idx,
          is_required: r.is_required !== false,
        }));
        const { error: reqErr } = await supabase.from('campaign_requirements').insert(reqRows);
        if (reqErr) throw new Error(reqErr.message);
      }

      // Sync rewards
      await supabase.from('campaign_rewards').delete().eq('campaign_id', campId);
      if (rewardsData.length > 0) {
        const rewRows = rewardsData.map((r, idx) => ({
          campaign_id: campId,
          title: r.title || 'Reward',
          description: r.description || null,
          reward_type: r.reward_type || 'badge',
          badge_id: r.badge_id || null,
          drop_details: r.drop_details || {},
          max_claims: r.max_claims ? Number(r.max_claims) : null,
          eligibility_type: r.eligibility_type || 'all_requirements',
          min_requirements_count: r.min_requirements_count || 0,
          is_claimable: r.is_claimable !== false,
          is_automatic: r.is_automatic || false,
          sort_order: idx,
        }));
        const { error: rewErr } = await supabase.from('campaign_rewards').insert(rewRows);
        if (rewErr) throw new Error(rewErr.message);
      }

      await fetchAdminCampaigns();
      return { success: true, id: campId };
    } catch (err: unknown) {
      return { success: false, error: (err as Error)?.message || 'Failed to save campaign' };
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    try {
      const { error: delErr } = await supabase.from('campaigns').delete().eq('id', campaignId);
      if (delErr) throw new Error(delErr.message);
      await fetchAdminCampaigns();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error)?.message || 'Failed to delete campaign' };
    }
  };

  const duplicateCampaign = async (campaign: Campaign) => {
    try {
      const newSlug = `${campaign.slug}-copy-${Date.now().toString().slice(-4)}`;
      const { data: newCamp, error: copyErr } = await supabase
        .from('campaigns')
        .insert({
          title: `${campaign.title} (Copy)`,
          slug: newSlug,
          short_description: campaign.short_description,
          description: campaign.description,
          banner_url: campaign.banner_url,
          thumbnail_url: campaign.thumbnail_url,
          status: 'draft',
          start_date: new Date().toISOString(),
          end_date: null,
          is_featured: false,
        })
        .select()
        .single();

      if (copyErr) throw new Error(copyErr.message);

      if (campaign.requirements && campaign.requirements.length > 0) {
        const reqs = campaign.requirements.map((r, idx) => ({
          campaign_id: newCamp.id,
          title: r.title,
          description: r.description,
          requirement_type: r.requirement_type,
          target_count: r.target_count,
          target_entity_id: r.target_entity_id,
          metadata: r.metadata || {},
          sort_order: idx,
          is_required: r.is_required,
        }));
        await supabase.from('campaign_requirements').insert(reqs);
      }

      if (campaign.rewards && campaign.rewards.length > 0) {
        const rews = campaign.rewards.map((r, idx) => ({
          campaign_id: newCamp.id,
          title: r.title,
          description: r.description,
          reward_type: r.reward_type,
          badge_id: r.badge_id,
          drop_details: r.drop_details || {},
          max_claims: r.max_claims,
          eligibility_type: r.eligibility_type,
          min_requirements_count: r.min_requirements_count,
          is_claimable: r.is_claimable,
          is_automatic: r.is_automatic,
          sort_order: idx,
        }));
        await supabase.from('campaign_rewards').insert(rews);
      }

      await fetchAdminCampaigns();
      return { success: true, id: newCamp.id };
    } catch (err: unknown) {
      return { success: false, error: (err as Error)?.message || 'Failed to duplicate campaign' };
    }
  };

  return {
    campaigns,
    loading,
    error,
    refresh: fetchAdminCampaigns,
    saveCampaign,
    deleteCampaign,
    duplicateCampaign,
  };
}

// ─── useAdminBadges ──────────────────────────────────────────────────────────

export function useAdminBadges() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBadges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sbErr } = await supabase
        .from('badges')
        .select('*')
        .order('created_at', { ascending: false });

      if (sbErr) throw new Error(sbErr.message);

      const rows = (data as Badge[]) || [];
      const badgeIds = rows.map((b) => b.id);

      // Get holders count per badge
      const countMap: Record<string, number> = {};
      if (badgeIds.length > 0) {
        const { data: ubData } = await supabase.from('user_badges').select('badge_id');
        (ubData || []).forEach((ub: { badge_id: string }) => {
          countMap[ub.badge_id] = (countMap[ub.badge_id] || 0) + 1;
        });
      }

      setBadges(rows.map((b) => ({ ...b, holders_count: countMap[b.id] || 0 })));
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load badges');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const saveBadge = async (badgeData: Partial<Badge>) => {
    try {
      if (!badgeData.id) {
        const { error: insErr } = await supabase.from('badges').insert({
          name: badgeData.name,
          slug: badgeData.slug,
          description: badgeData.description || null,
          icon_url: badgeData.icon_url || 'sparkles',
          category: (badgeData.category as BadgeCategory) || 'general',
          rarity: (badgeData.rarity as BadgeRarity) || 'common',
          color_theme: badgeData.color_theme || 'emerald',
          is_active: badgeData.is_active !== false,
        });
        if (insErr) throw new Error(insErr.message);
      } else {
        const { error: updErr } = await supabase
          .from('badges')
          .update({
            name: badgeData.name,
            slug: badgeData.slug,
            description: badgeData.description || null,
            icon_url: badgeData.icon_url || 'sparkles',
            category: badgeData.category,
            rarity: badgeData.rarity,
            color_theme: badgeData.color_theme,
            is_active: badgeData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', badgeData.id);
        if (updErr) throw new Error(updErr.message);
      }
      await fetchBadges();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error)?.message || 'Failed to save badge' };
    }
  };

  const deleteBadge = async (badgeId: string) => {
    try {
      const { error: delErr } = await supabase.from('badges').delete().eq('id', badgeId);
      if (delErr) throw new Error(delErr.message);
      await fetchBadges();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error)?.message || 'Failed to delete badge' };
    }
  };

  const awardBadgeDirect = async (
    userId: string,
    badgeId: string,
    notes?: string,
    sourceTitle?: string
  ) => {
    try {
      const { data, error: rpcErr } = await supabase.rpc('award_user_badge', {
        p_user_id: userId,
        p_badge_id: badgeId,
        p_source_type: 'admin',
        p_source_title: sourceTitle || 'Direct Admin Award',
        p_notes: notes || null,
      });

      if (rpcErr) throw new Error(rpcErr.message);
      await fetchBadges();
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: (err as Error)?.message || 'Failed to award badge' };
    }
  };

  const revokeUserBadge = async (userBadgeId: string) => {
    try {
      const { error: rpcErr } = await supabase.rpc('revoke_user_badge', {
        p_user_badge_id: userBadgeId,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      await fetchBadges();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error)?.message || 'Failed to revoke badge' };
    }
  };

  return {
    badges,
    loading,
    error,
    refresh: fetchBadges,
    saveBadge,
    deleteBadge,
    awardBadgeDirect,
    revokeUserBadge,
  };
}

// ─── useClaimReward ──────────────────────────────────────────────────────────

export function useClaimReward() {
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const claimReward = async (campaignRewardId: string) => {
    setClaiming(true);
    setClaimError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('claim_campaign_reward', {
        p_campaign_reward_id: campaignRewardId,
      });

      if (rpcErr) throw new Error(rpcErr.message);
      return { success: true, data };
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to claim reward';
      setClaimError(msg);
      return { success: false, error: msg };
    } finally {
      setClaiming(false);
    }
  };

  return { claimReward, claiming, claimError };
}

// ─── useJoinCampaign ─────────────────────────────────────────────────────────

export function useJoinCampaign() {
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const joinCampaign = async (campaignId: string) => {
    setJoining(true);
    setJoinError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('join_campaign', {
        p_campaign_id: campaignId,
      });

      if (rpcErr) throw new Error(rpcErr.message);
      return { success: true, data };
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to join campaign';
      setJoinError(msg);
      return { success: false, error: msg };
    } finally {
      setJoining(false);
    }
  };

  return { joinCampaign, joining, joinError };
}

// ─── useVerifyCommunityAction ────────────────────────────────────────────────

export function useVerifyCommunityAction() {
  const [verifying, setVerifying] = useState(false);

  const verifyAction = async (campaignId: string, requirementId: string) => {
    setVerifying(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('verify_user_campaign_requirement', {
        p_campaign_id: campaignId,
        p_requirement_id: requirementId,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: (err as Error)?.message || 'Verification failed' };
    } finally {
      setVerifying(false);
    }
  };

  return { verifyAction, verifying };
}
