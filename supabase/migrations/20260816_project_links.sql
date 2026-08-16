-- ============================================================================
-- ISOMER: FLEXIBLE PROJECT LINKS SYSTEM MIGRATION
-- ============================================================================
-- Adds project_links JSONB column to public.projects while preserving github_url
-- Backfills existing github_url values into project_links
-- ============================================================================

-- 1. Add project_links JSONB column
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_links JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Backfill existing projects with github_url into project_links
UPDATE public.projects
SET project_links = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'type', 'github',
    'title', 'GitHub Repository',
    'url', trim(github_url)
  )
)
WHERE github_url IS NOT NULL
  AND trim(github_url) <> ''
  AND (project_links IS NULL OR project_links = '[]'::jsonb);

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
