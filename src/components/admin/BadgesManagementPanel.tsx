import React, { useState, useMemo } from 'react';
import { useAdminBadges, getRarityBadgeStyle } from '../../lib/badgeCampaignHooks';
import { BadgeIcon } from '../ui/BadgeVisual';
import { supabase } from '../../lib/supabase';
import type { Badge, BadgeRarity, BadgeCategory, UserBadge } from '../../lib/types';

export const BadgesManagementPanel: React.FC = () => {
  const {
    badges,
    loading,
    saveBadge,
    deleteBadge,
    awardBadgeDirect,
    revokeUserBadge,
  } = useAdminBadges();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modals state
  const [badgeEditorOpen, setBadgeEditorOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);

  const [awardModalOpen, setAwardModalOpen] = useState(false);
  const [selectedAwardBadge, setSelectedAwardBadge] = useState<Badge | null>(null);

  const [holdersDrawerBadge, setHoldersDrawerBadge] = useState<Badge | null>(null);
  const [holdersList, setHoldersList] = useState<UserBadge[]>([]);
  const [holdersLoading, setHoldersLoading] = useState(false);

  const [panelMessage, setPanelMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filtered badges
  const filteredBadges = useMemo(() => {
    return badges.filter((b) => {
      if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
      if (rarityFilter !== 'all' && b.rarity !== rarityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q);
      }
      return true;
    });
  }, [badges, categoryFilter, rarityFilter, search]);

  // Load badge holders
  const openHoldersDrawer = async (badge: Badge) => {
    setHoldersDrawerBadge(badge);
    setHoldersLoading(true);
    try {
      const { data, error: sbErr } = await supabase
        .from('user_badges')
        .select('*, user_profile:profiles(*)')
        .eq('badge_id', badge.id)
        .order('awarded_at', { ascending: false });

      if (sbErr) throw new Error(sbErr.message);
      setHoldersList((data as UserBadge[]) || []);
    } catch {
      // non-fatal
    } finally {
      setHoldersLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-eg" />
            Badge &amp; Credentials Catalog
          </h2>
          <p className="font-sans text-xs text-white/50 mt-1">
            Manage reusable badges, rarity tiers, and award credentials directly to community creators and members.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              setSelectedAwardBadge(null);
              setAwardModalOpen(true);
            }}
            className="btn-outline py-2 px-4 text-xs font-mono-custom text-eg border-eg/40 hover:bg-eg/10"
          >
            ★ AWARD BADGE DIRECTLY
          </button>
          <button
            onClick={() => {
              setEditingBadge(null);
              setBadgeEditorOpen(true);
            }}
            className="btn-primary py-2 px-4 text-xs font-mono-custom"
          >
            + CREATE BADGE
          </button>
        </div>
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

      {/* Filters Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="py-2 px-3 rounded-xl bg-dark-200 border border-white/10 text-white text-xs font-mono-custom focus:outline-none focus:border-eg/50"
          >
            <option value="all">All Categories</option>
            <option value="community">Community</option>
            <option value="creator">Creator</option>
            <option value="campaign">Campaign</option>
            <option value="special_event">Special Event</option>
            <option value="achievement">Achievement</option>
            <option value="general">General</option>
          </select>

          {/* Rarity Filter */}
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            className="py-2 px-3 rounded-xl bg-dark-200 border border-white/10 text-white text-xs font-mono-custom focus:outline-none focus:border-eg/50"
          >
            <option value="all">All Rarities</option>
            <option value="common">Common</option>
            <option value="rare">Rare</option>
            <option value="epic">Epic</option>
            <option value="legendary">Legendary</option>
          </select>
        </div>

        <input
          type="text"
          placeholder="Search by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 py-2 px-3 rounded-xl bg-dark-200/60 border border-white/10 text-white placeholder:text-white/30 text-xs font-sans focus:outline-none focus:border-eg/50"
        />
      </div>

      {/* Badges Grid */}
      {loading ? (
        <div className="p-8 text-center glass-dark rounded-2xl border border-white/10 font-mono-custom text-xs text-white/40">
          Loading badge catalog...
        </div>
      ) : filteredBadges.length === 0 ? (
        <div className="p-12 text-center glass-dark rounded-2xl border border-dashed border-white/15 space-y-3">
          <p className="font-mono-custom text-xs text-white/40 uppercase">No badges found</p>
          <p className="font-sans text-xs text-white/50">
            Create your first collectible badge to reward users and creators.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => {
            const rStyle = getRarityBadgeStyle(badge.rarity);

            return (
              <div
                key={badge.id}
                className={`glass-dark rounded-2xl p-4 border transition-all flex flex-col justify-between space-y-4 ${badge.is_active ? rStyle.borderColor : 'border-white/10 opacity-50'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`font-mono-custom text-[9px] tracking-wider px-2 py-0.5 rounded-full border uppercase ${rStyle.badgeBg} ${rStyle.borderColor} ${rStyle.textColor}`}
                    >
                      {rStyle.label}
                    </span>
                    <span className="font-mono-custom text-[10px] text-white/40">
                      👥 {badge.holders_count || 0}
                    </span>
                  </div>

                  <div className="flex flex-col items-center text-center space-y-2">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${rStyle.badgeBg} ${rStyle.borderColor} ${rStyle.textColor}`}
                    >
                      <BadgeIcon icon={badge.icon_url} className="w-7 h-7" />
                    </div>

                    <h4 className="font-display font-bold text-white text-sm truncate max-w-full">
                      {badge.name}
                    </h4>

                    <p className="font-sans text-xs text-white/50 line-clamp-2">
                      {badge.description || 'ISOMER Community Badge'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-custom">
                  <button
                    onClick={() => openHoldersDrawer(badge)}
                    className="text-cyan-300 hover:text-cyan-200 text-[11px]"
                  >
                    Holders ({badge.holders_count || 0})
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedAwardBadge(badge);
                        setAwardModalOpen(true);
                      }}
                      className="text-eg hover:underline text-[11px]"
                    >
                      Award
                    </button>
                    <button
                      onClick={() => {
                        setEditingBadge(badge);
                        setBadgeEditorOpen(true);
                      }}
                      className="text-white/60 hover:text-white text-[11px]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete badge "${badge.name}"?`)) {
                          const res = await deleteBadge(badge.id);
                          if (res.success) {
                            setPanelMessage({ text: 'Badge deleted', type: 'success' });
                          }
                        }
                      }}
                      className="text-red-400 hover:text-red-300 text-[11px]"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT BADGE MODAL ─────────────────────────────────── */}
      {badgeEditorOpen && (
        <BadgeEditorModal
          badge={editingBadge}
          isOpen={badgeEditorOpen}
          onClose={() => {
            setBadgeEditorOpen(false);
            setEditingBadge(null);
          }}
          onSave={async (bData) => {
            const res = await saveBadge(bData);
            if (res.success) {
              setPanelMessage({ text: 'Badge saved successfully!', type: 'success' });
              setBadgeEditorOpen(false);
              setEditingBadge(null);
            } else {
              alert(res.error || 'Failed to save badge');
            }
          }}
        />
      )}

      {/* ── DIRECT AWARD BADGE MODAL ──────────────────────────────────── */}
      {awardModalOpen && (
        <DirectAwardModal
          badges={badges}
          defaultBadge={selectedAwardBadge}
          isOpen={awardModalOpen}
          onClose={() => {
            setAwardModalOpen(false);
            setSelectedAwardBadge(null);
          }}
          onAward={async (userId, badgeId, notes, sourceTitle) => {
            const res = await awardBadgeDirect(userId, badgeId, notes, sourceTitle);
            if (res.success) {
              setPanelMessage({ text: 'Badge successfully awarded to user!', type: 'success' });
              setAwardModalOpen(false);
              setSelectedAwardBadge(null);
            } else {
              alert(res.error || 'Failed to award badge');
            }
          }}
        />
      )}

      {/* ── BADGE HOLDERS DRAWER ──────────────────────────────────────── */}
      {holdersDrawerBadge && (
        <BadgeHoldersDrawer
          badge={holdersDrawerBadge}
          holders={holdersList}
          loading={holdersLoading}
          onClose={() => setHoldersDrawerBadge(null)}
          onRevoke={async (userBadgeId) => {
            if (confirm('Revoke this badge from the user?')) {
              await revokeUserBadge(userBadgeId);
              await openHoldersDrawer(holdersDrawerBadge);
              setPanelMessage({ text: 'Badge revoked from user', type: 'success' });
            }
          }}
        />
      )}
    </div>
  );
};

/* ── BADGE EDITOR MODAL COMPONENT ──────────────────────────────────── */
interface BadgeEditorModalProps {
  badge: Badge | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Badge>) => Promise<void>;
}

const BadgeEditorModal: React.FC<BadgeEditorModalProps> = ({
  badge,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(badge?.name || '');
  const [slug, setSlug] = useState(badge?.slug || '');
  const [description, setDescription] = useState(badge?.description || '');
  const [iconUrl, setIconUrl] = useState(badge?.icon_url || 'sparkles');
  const [category, setCategory] = useState<BadgeCategory>(badge?.category || 'community');
  const [rarity, setRarity] = useState<BadgeRarity>(badge?.rarity || 'common');
  const [colorTheme] = useState(badge?.color_theme || 'emerald');
  const [isActive, setIsActive] = useState(badge?.is_active !== false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!badge) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: badge?.id,
        name,
        slug,
        description,
        icon_url: iconUrl,
        category,
        rarity,
        color_theme: colorTheme,
        is_active: isActive,
      });
    } finally {
      setSaving(false);
    }
  };

  const iconOptions = [
    'sparkles',
    'compass',
    'zap',
    'crown',
    'trophy',
    'shield',
    'flame',
    'star',
    'diamond',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg glass-dark rounded-3xl p-6 sm:p-8 border border-eg/30 space-y-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">
            {badge ? `Edit Badge: ${badge.name}` : 'Create New Badge'}
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-mono-custom text-[10px] text-white/50 uppercase">Badge Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Master Builder"
                className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono-custom text-[10px] text-white/50 uppercase">Slug *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. master-builder"
                className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-mono-custom text-[10px] text-white/50 uppercase">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How this badge is earned or what it represents..."
              className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-mono-custom text-[10px] text-white/50 uppercase">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BadgeCategory)}
                className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
              >
                <option value="community">Community</option>
                <option value="creator">Creator</option>
                <option value="campaign">Campaign</option>
                <option value="special_event">Special Event</option>
                <option value="achievement">Achievement</option>
                <option value="general">General</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-mono-custom text-[10px] text-white/50 uppercase">Rarity Level</label>
              <select
                value={rarity}
                onChange={(e) => setRarity(e.target.value as BadgeRarity)}
                className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
              >
                <option value="common">Common (Emerald)</option>
                <option value="rare">Rare (Cyan)</option>
                <option value="epic">Epic (Purple)</option>
                <option value="legendary">Legendary (Gold)</option>
              </select>
            </div>
          </div>

          {/* Icon Selector */}
          <div className="space-y-1.5">
            <label className="font-mono-custom text-[10px] text-white/50 uppercase">Select Vector Icon or Custom URL</label>
            <div className="flex flex-wrap gap-2">
              {iconOptions.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setIconUrl(ic)}
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${iconUrl === ic
                      ? 'border-eg bg-eg/20 text-eg'
                      : 'border-white/10 bg-dark-200 text-white/60 hover:text-white'
                    }`}
                  title={ic}
                >
                  <BadgeIcon icon={ic} className="w-5 h-5" />
                </button>
              ))}
            </div>
            <input
              type="text"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="Or paste custom image URL (https://...)"
              className="w-full mt-2 p-2 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="active-toggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-white/20 bg-dark-200 text-eg focus:ring-eg/40"
            />
            <label htmlFor="active-toggle" className="font-sans text-xs text-white/80 cursor-pointer">
              Active Badge (available for campaign rewards and public profiles)
            </label>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline py-2 px-4 text-xs font-mono-custom"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary py-2 px-6 text-xs font-mono-custom"
            >
              {saving ? 'Saving...' : 'Save Badge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── DIRECT AWARD MODAL COMPONENT ──────────────────────────────────── */
interface DirectAwardModalProps {
  badges: Badge[];
  defaultBadge: Badge | null;
  isOpen: boolean;
  onClose: () => void;
  onAward: (userId: string, badgeId: string, notes?: string, sourceTitle?: string) => Promise<void>;
}

const DirectAwardModal: React.FC<DirectAwardModalProps> = ({
  badges,
  defaultBadge,
  isOpen,
  onClose,
  onAward,
}) => {
  const [selectedBadgeId, setSelectedBadgeId] = useState(defaultBadge?.id || badges[0]?.id || '');
  const [userSearch, setUserSearch] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [notes, setNotes] = useState('');
  const [sourceTitle, setSourceTitle] = useState('ISOMER Staff Recognition');
  const [awarding, setAwarding] = useState(false);

  if (!isOpen) return null;

  const handleSearchUsers = async (q: string) => {
    setUserSearch(q);
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

  const handleAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedBadgeId) return;
    setAwarding(true);
    try {
      await onAward(selectedUser.id, selectedBadgeId, notes, sourceTitle);
    } finally {
      setAwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg glass-dark rounded-3xl p-6 sm:p-8 border border-eg/30 space-y-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">Award Badge Directly</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleAward} className="space-y-4">
          {/* Badge Select */}
          <div className="space-y-1">
            <label className="font-mono-custom text-[10px] text-white/50 uppercase">Select Badge *</label>
            <select
              value={selectedBadgeId}
              onChange={(e) => setSelectedBadgeId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
            >
              {badges.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.rarity} - {b.category})
                </option>
              ))}
            </select>
          </div>

          {/* User Search */}
          <div className="space-y-1.5">
            <label className="font-mono-custom text-[10px] text-white/50 uppercase">Search User (Name or Email) *</label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => handleSearchUsers(e.target.value)}
              placeholder="Search user..."
              className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
            />

            {searchedUsers.length > 0 && (
              <div className="p-2 rounded-xl bg-dark-300 border border-white/10 space-y-1 max-h-40 overflow-y-auto">
                {searchedUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(u);
                      setSearchedUsers([]);
                      setUserSearch(u.full_name || u.email);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs font-sans flex items-center justify-between hover:bg-white/10 ${selectedUser?.id === u.id ? 'bg-eg/20 text-eg' : 'text-white'
                      }`}
                  >
                    <span className="font-medium">{u.full_name || 'Member'}</span>
                    <span className="text-white/40 font-mono-custom text-[10px]">{u.email}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="p-3 rounded-xl bg-eg/10 border border-eg/30 text-eg text-xs font-mono-custom flex items-center justify-between">
                <span>Selected: {selectedUser.full_name || selectedUser.email}</span>
                <button type="button" onClick={() => setSelectedUser(null)} className="text-eg/60 hover:text-eg">✕</button>
              </div>
            )}
          </div>

          {/* Source Title */}
          <div className="space-y-1">
            <label className="font-mono-custom text-[10px] text-white/50 uppercase">Award Source / Event Label</label>
            <input
              type="text"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              placeholder="e.g. Community Moderator Award"
              className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
            />
          </div>

          {/* Optional notes */}
          <div className="space-y-1">
            <label className="font-mono-custom text-[10px] text-white/50 uppercase">Reason / Note</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional citation or reason..."
              className="w-full p-2.5 rounded-xl bg-dark-200 border border-white/15 text-white text-xs font-sans focus:outline-none focus:border-eg/50"
            />
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline py-2 px-4 text-xs font-mono-custom"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={awarding || !selectedUser || !selectedBadgeId}
              className="btn-primary py-2 px-6 text-xs font-mono-custom"
            >
              {awarding ? 'Awarding...' : 'Award Badge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── BADGE HOLDERS DRAWER ──────────────────────────────────────────── */
interface BadgeHoldersDrawerProps {
  badge: Badge;
  holders: UserBadge[];
  loading: boolean;
  onClose: () => void;
  onRevoke: (userBadgeId: string) => Promise<void>;
}

const BadgeHoldersDrawer: React.FC<BadgeHoldersDrawerProps> = ({
  badge,
  holders,
  loading,
  onClose,
  onRevoke,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl h-full glass-dark border-l border-eg/30 flex flex-col text-white">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="font-mono-custom text-[10px] text-eg uppercase tracking-widest">
              BADGE HOLDERS DIRECTORY
            </span>
            <h3 className="font-display text-xl font-bold text-white">{badge.name}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/40 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <p className="text-center font-mono-custom text-xs text-white/40 py-8">Loading holders...</p>
          ) : holders.length === 0 ? (
            <p className="text-center font-mono-custom text-xs text-white/40 py-8">
              No users currently hold this badge.
            </p>
          ) : (
            holders.map((h) => {
              const profile = (h as any).user_profile;
              return (
                <div
                  key={h.id}
                  className="p-3.5 rounded-xl glass bg-dark-200/50 border border-white/10 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">
                      {profile?.full_name || profile?.email || h.user_id}
                    </p>
                    <p className="font-mono-custom text-[10px] text-white/40 truncate">
                      Source: {h.source_title || h.source_type} • {new Date(h.awarded_at).toLocaleDateString()}
                    </p>
                    {h.notes && (
                      <p className="font-sans text-[11px] text-white/50 italic mt-0.5">&ldquo;{h.notes}&rdquo;</p>
                    )}
                  </div>
                  <button
                    onClick={() => onRevoke(h.id)}
                    className="text-red-400 hover:text-red-300 text-[10px] font-mono-custom px-2 py-1 rounded bg-red-500/10 border border-red-500/20 flex-shrink-0"
                  >
                    Revoke
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
