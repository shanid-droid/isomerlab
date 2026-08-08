/* ── Supabase database type definitions ──────────────────────────
   Mirrors only the columns consumed by the frontend.
   Do NOT change the database schema — this is read-only.
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
  created_at?: string;
}

export interface ProjectGalleryItem {
  id: string;
  project_id: string;
  image_url: string;
  sort_order?: number;
  created_at?: string;
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
    };
  };
};
