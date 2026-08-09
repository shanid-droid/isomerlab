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

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
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
    };
  };
};
