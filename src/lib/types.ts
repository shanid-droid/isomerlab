/* ── Supabase database type definitions ──────────────────────────
   Mirrors columns consumed by the frontend.
──────────────────────────────────────────────────────────────── */

export type NotificationType = 'public' | 'private' | 'creators' | 'all_creators' | 'birthday';

export interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  recipient_id: string | null;
  recipient_user_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface NotificationRead {
  id: string;
  notification_id: string;
  user_id: string;
  read_at: string;
}

export interface NotificationWithRead extends Notification {
  is_read: boolean;
  /** Display name of the sender (joined client-side) */
  sender_name?: string | null;
  /** Display name of the private recipient (joined client-side) */
  recipient_name?: string | null;
}

export type ProjectLinkType =
  | 'website'
  | 'youtube'
  | 'github'
  | 'demo'
  | 'docs'
  | 'figma'
  | 'download'
  | 'other';

export interface ProjectLink {
  id: string;
  type: ProjectLinkType;
  title: string;
  url: string;
}

export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url?: string | null;
  components?: string[] | string | null;
  github_url?: string | null;
  project_links?: ProjectLink[] | null;
  published?: boolean;
  created_by?: string | null;
  created_at?: string;
  views_count?: number | null;
  versions?: ProjectVersion[] | null;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_name: string;
  version_number: string;
  description?: string | null;
  whats_new?: string | null;
  thumbnail_url?: string | null;
  video_url?: string | null;
  project_links?: ProjectLink[] | null;
  sort_order: number;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type GalleryMediaType = 'image' | 'video';

export interface ProjectGalleryItem {
  id: string;
  project_id: string;
  version_id?: string | null;
  image_url: string;
  media_type: GalleryMediaType | string;
  mime_type?: string | null;
  duration_seconds?: number | null;
  sort_order?: number;
  created_at?: string;
}

export interface ProjectLike {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  parent_comment_id?: string | null;
  content: string;
  is_pinned?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ProjectCommentWithProfile extends ProjectComment {
  author_name?: string | null;
  author_avatar_url?: string | null;
  author_role?: UserRole;
  replies?: ProjectCommentWithProfile[];
}

export type UserRole = 'owner' | 'admin' | 'creator' | 'user';

export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected';

export type CreatorRequirementStatus = 'pending' | 'completed' | 'review_required';

export interface SocialLinks {
  twitter?: string;
  github?: string;
  linkedin?: string;
  instagram?: string;
  website?: string;
  youtube?: string;
  discord?: string;
  [key: string]: string | undefined;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  role: UserRole;
  bio?: string | null;
  about?: string | null;
  date_of_birth?: string | null;
  social_links?: SocialLinks | null;
  creator_approved_at?: string | null;
  first_project_uploaded_at?: string | null;
  creator_requirement_status?: CreatorRequirementStatus | null;
  created_at?: string;
  updated_at?: string;
  // Professional & Creator Details (from approved application / profile)
  profession?: string | null;
  current_role?: string | null;
  education?: string | null;
  education_details?: string | null;
  experience_level?: string | null;
  location?: string | null;
  skills?: string | null;
  project_types?: string | null;
}

export interface CreatorApplication {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth?: string | null;
  age?: number | null;
  profession: string;
  profession_other?: string | null;
  applicant_role: string;
  applicant_role_other?: string | null;
  bio: string;
  skills: string;
  education?: string | null;
  education_details?: string | null;
  experience_level?: string | null;
  location?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  linkedin_url?: string | null;
  other_url?: string | null;
  motivation: string;
  project_types: string;
  status: CreatorApplicationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteSettings {
  id: number;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export type LeaderboardType = 'projects' | 'creators';
export type LeaderboardPeriod = 'all_time' | 'monthly' | 'weekly';
export type LeaderboardVisibility = 'public' | 'creators_only' | 'admins_only' | 'no_one';
export type LeaderboardSnapshotStatus = 'draft' | 'published' | 'archived';

export interface LeaderboardSettings {
  id: number;
  enabled: boolean;
  project_enabled: boolean;
  creator_enabled: boolean;
  visibility: LeaderboardVisibility;
  project_like_weight: number;
  project_comment_weight: number;
  project_view_weight: number;
  github_bonus: number;
  gallery_bonus: number;
  recency_decay_days: number;
  creator_project_weight: number;
  creator_like_weight: number;
  creator_comment_weight: number;
  creator_activity_weight: number;
  creator_top3_bonus: number;
  creator_top10_bonus: number;
  weekly_enabled: boolean;
  monthly_enabled: boolean;
  all_time_enabled: boolean;
  updated_at?: string;
  updated_by?: string | null;
}

export interface LeaderboardSnapshot {
  id: string;
  leaderboard_type: LeaderboardType;
  period: LeaderboardPeriod;
  status: LeaderboardSnapshotStatus;
  visibility: LeaderboardVisibility;
  published_at?: string | null;
  published_by?: string | null;
  created_at: string;
}

export interface ProjectLeaderboardMetadata {
  title: string;
  slug: string;
  thumbnail_url?: string | null;
  created_by?: string | null;
  creator_name?: string | null;
  creator_avatar?: string | null;
  views_count?: number;
  github_bonus?: boolean;
  gallery_bonus?: boolean;
}

export interface CreatorLeaderboardMetadata {
  creator_name: string;
  creator_avatar?: string | null;
  creator_bio?: string | null;
  top_project_id?: string | null;
  top_project_title?: string | null;
  top_project_slug?: string | null;
}

export interface LeaderboardEntry {
  id: string;
  snapshot_id: string;
  entity_type: 'project' | 'creator';
  entity_id: string;
  rank: number;
  score: number;
  likes: number;
  comments: number;
  projects_count: number;
  activity_score: number;
  metadata: ProjectLeaderboardMetadata | CreatorLeaderboardMetadata | Record<string, unknown>;
  is_overridden?: boolean;
  override_notes?: string | null;
  published_at?: string | null;
  created_at?: string;
}

export interface LiveProjectLeaderboardItem {
  rank: number;
  project_id: string;
  title: string;
  slug: string;
  thumbnail_url?: string | null;
  created_by?: string | null;
  creator_name: string;
  creator_avatar?: string | null;
  score: number;
  likes_count: number;
  comments_count: number;
  views_count: number;
  github_bonus_applied: boolean;
  gallery_bonus_applied: boolean;
  created_at: string;
  is_overridden?: boolean;
  override_notes?: string | null;
}

export interface LiveCreatorLeaderboardItem {
  rank: number;
  creator_id: string;
  creator_name: string;
  creator_avatar?: string | null;
  creator_bio?: string | null;
  score: number;
  projects_count: number;
  total_likes_received: number;
  total_comments_received: number;
  top_project_id?: string | null;
  top_project_title?: string | null;
  top_project_slug?: string | null;
  activity_score: number;
  created_at: string;
  is_overridden?: boolean;
  override_notes?: string | null;
}

export interface MyCreatorRank {
  rank: number | null;
  score: number | null;
  total_creators: number;
  rank_delta: number;
  is_creator: boolean;
}

/** Project with creator profile info joined in */
export interface ProjectWithCreator extends Project {
  creator_name?: string | null;
  creator_avatar_url?: string | null;
}

export type ContactMessageStatus = 'unread' | 'read' | 'archived';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string | null;
  message: string;
  status: ContactMessageStatus;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  actor_user_id?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

/* ── Badge & Campaign System Types ────────────────────────────── */

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type BadgeCategory = 'general' | 'community' | 'creator' | 'campaign' | 'special_event' | 'achievement';
export type BadgeSourceType = 'admin' | 'campaign' | 'campaign_drop' | 'achievement';

export interface Badge {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_url?: string | null;
  category: BadgeCategory;
  rarity: BadgeRarity;
  color_theme?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  holders_count?: number;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  source_type: BadgeSourceType;
  source_id?: string | null;
  source_title?: string | null;
  awarded_by?: string | null;
  awarded_at: string;
  notes?: string | null;
  badge?: Badge;
}

export type CampaignStatus = 'draft' | 'published' | 'active' | 'upcoming' | 'ended' | 'archived';

export type CampaignRequirementType =
  | 'like_project'
  | 'comment_project'
  | 'publish_project'
  | 'profile_complete'
  | 'apply_creator'
  | 'link_social'
  | 'community_action'
  | 'custom_check';

export interface CampaignRequirement {
  id: string;
  campaign_id: string;
  title: string;
  description?: string | null;
  requirement_type: CampaignRequirementType;
  target_count: number;
  target_entity_id?: string | null;
  metadata?: Record<string, unknown>;
  sort_order: number;
  is_required: boolean;
  created_at: string;
}

export type CampaignRewardType = 'badge' | 'drop' | 'role' | 'custom';
export type CampaignEligibilityType = 'all_requirements' | 'min_requirements_count' | 'manual';

export interface CampaignReward {
  id: string;
  campaign_id: string;
  title: string;
  description?: string | null;
  reward_type: CampaignRewardType;
  badge_id?: string | null;
  drop_details?: Record<string, unknown>;
  max_claims?: number | null;
  claimed_count: number;
  eligibility_type: CampaignEligibilityType;
  min_requirements_count: number;
  is_claimable: boolean;
  is_automatic: boolean;
  sort_order: number;
  created_at: string;
  badge?: Badge | null;
  has_claimed?: boolean;
}

export interface CampaignParticipant {
  id: string;
  campaign_id: string;
  user_id: string;
  joined_at: string;
  completed_at?: string | null;
  status: 'in_progress' | 'completed' | 'disqualified';
  metadata?: Record<string, unknown>;
  user_profile?: UserProfile | null;
}

export interface CampaignClaim {
  id: string;
  campaign_id: string;
  campaign_reward_id: string;
  user_id: string;
  badge_id?: string | null;
  claimed_at: string;
  status: 'claimed' | 'revoked';
  metadata?: Record<string, unknown>;
  reward?: CampaignReward | null;
  user_profile?: UserProfile | null;
}

export interface CampaignRequirementProgress {
  id: string;
  title: string;
  description?: string | null;
  requirement_type: CampaignRequirementType;
  target_count: number;
  target_entity_id?: string | null;
  current_count: number;
  is_completed: boolean;
  is_required: boolean;
  metadata?: Record<string, unknown>;
}

export interface CampaignProgressResult {
  is_participant: boolean;
  participant_status: string;
  total_requirements: number;
  completed_requirements: number;
  progress_percent: number;
  requirements: CampaignRequirementProgress[];
}

export interface Campaign {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  description?: string | null;
  banner_url?: string | null;
  thumbnail_url?: string | null;
  status: CampaignStatus;
  start_date: string;
  end_date?: string | null;
  is_featured: boolean;
  featured_order: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  requirements?: CampaignRequirement[];
  rewards?: CampaignReward[];
  participants_count?: number;
  claims_count?: number;
  is_joined?: boolean;
  user_progress?: CampaignProgressResult;
}

export interface CampaignAnalytics {
  participants_count: number;
  completed_count: number;
  claims_count: number;
  drops_claimed: number;
  badges_awarded: number;
  completion_rate: number;
}

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: Project;
      };
      project_gallery: {
        Row: ProjectGalleryItem;
      };
      profiles: {
        Row: UserProfile;
      };
      contact_messages: {
        Row: ContactMessage;
      };
      activity_logs: {
        Row: ActivityLog;
      };
      creator_applications: {
        Row: CreatorApplication;
      };
      site_settings: {
        Row: SiteSettings;
      };
      notifications: {
        Row: Notification;
      };
      notification_reads: {
        Row: NotificationRead;
      };
      leaderboard_settings: {
        Row: LeaderboardSettings;
      };
      leaderboard_snapshots: {
        Row: LeaderboardSnapshot;
      };
      leaderboard_entries: {
        Row: LeaderboardEntry;
      };
      project_versions: {
        Row: ProjectVersion;
      };
      badges: {
        Row: Badge;
      };
      user_badges: {
        Row: UserBadge;
      };
      campaigns: {
        Row: Campaign;
      };
      campaign_requirements: {
        Row: CampaignRequirement;
      };
      campaign_rewards: {
        Row: CampaignReward;
      };
      campaign_participants: {
        Row: CampaignParticipant;
      };
      campaign_claims: {
        Row: CampaignClaim;
      };
    };
  };
};
