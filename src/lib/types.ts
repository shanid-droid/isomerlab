/* ── Supabase database type definitions ──────────────────────────
   Mirrors columns consumed by the frontend.
──────────────────────────────────────────────────────────────── */

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

export type UserRole = 'user' | 'admin';

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
  social_links?: SocialLinks | null;
  created_at?: string;
  updated_at?: string;
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
    };
  };
};
