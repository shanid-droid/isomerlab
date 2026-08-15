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

export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url?: string | null;
  components?: string[] | string | null;
  github_url?: string | null;
  published?: boolean;
  created_by?: string | null;
  created_at?: string;
}

export interface ProjectGalleryItem {
  id: string;
  project_id: string;
  image_url: string;
  sort_order?: number;
  created_at?: string;
}

export type UserRole = 'user' | 'admin' | 'creator';

export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected';

export type CreatorRequirementStatus = 'pending' | 'completed' | 'review_required';

export interface SocialLinks {
  twitter?: string;
  github?: string;
  linkedin?: string;
  instagram?: string;
  website?: string;
  youtube?: string;
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
    };
  };
};
