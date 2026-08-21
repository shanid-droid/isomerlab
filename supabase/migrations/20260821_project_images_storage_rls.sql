-- ============================================================================
-- ISOMER: PROJECT IMAGES STORAGE BUCKET + RLS
-- ============================================================================
-- Fixes thumbnail upload RLS errors while preserving existing gallery uploads.
-- ============================================================================

-- 1. Ensure the project-images bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-images',
  'project-images',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop potentially conflicting policies on storage.objects for this bucket
DROP POLICY IF EXISTS "Project images - public read" ON storage.objects;
DROP POLICY IF EXISTS "Project images - authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Project images - authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Project images - authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Public read project-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload project-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update project-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete project-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read project-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload project-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update project-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete project-images" ON storage.objects;

-- 3. Public read access for project images
CREATE POLICY "Public can read project images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-images');

-- 4. Thumbnail policies (new format: thumbnails/{project_id}/...)
CREATE POLICY "Project owners can insert thumbnails"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'thumbnails'
    AND array_length(storage.foldername(name), 1) >= 3
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = (storage.foldername(name))[2]::uuid
      AND (
        p.created_by = auth.uid()
        OR public.is_admin()
        OR public.is_owner()
      )
    )
  );

CREATE POLICY "Project owners can update thumbnails"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'thumbnails'
    AND array_length(storage.foldername(name), 1) >= 3
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = (storage.foldername(name))[2]::uuid
      AND (
        p.created_by = auth.uid()
        OR public.is_admin()
        OR public.is_owner()
      )
    )
  );

CREATE POLICY "Project owners can delete thumbnails"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'thumbnails'
    AND array_length(storage.foldername(name), 1) >= 3
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = (storage.foldername(name))[2]::uuid
      AND (
        p.created_by = auth.uid()
        OR public.is_admin()
        OR public.is_owner()
      )
    )
  );

-- Legacy thumbnail paths (backward compatibility: thumbnails/{filename})
CREATE POLICY "Authenticated users can insert legacy thumbnails"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'thumbnails'
    AND array_length(storage.foldername(name), 1) = 2
  );

CREATE POLICY "Authenticated users can update legacy thumbnails"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'thumbnails'
    AND array_length(storage.foldername(name), 1) = 2
  );

CREATE POLICY "Authenticated users can delete legacy thumbnails"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'thumbnails'
    AND array_length(storage.foldername(name), 1) = 2
  );

-- 5. Version thumbnail policies (existing format: projects/{project_id}/versions/...)
CREATE POLICY "Project owners can insert version thumbnails"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'projects'
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[3] = 'versions'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = (storage.foldername(name))[2]::uuid
      AND (
        p.created_by = auth.uid()
        OR public.is_admin()
        OR public.is_owner()
      )
    )
  );

CREATE POLICY "Project owners can update version thumbnails"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'projects'
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[3] = 'versions'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = (storage.foldername(name))[2]::uuid
      AND (
        p.created_by = auth.uid()
        OR public.is_admin()
        OR public.is_owner()
      )
    )
  );

CREATE POLICY "Project owners can delete version thumbnails"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'projects'
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[3] = 'versions'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = (storage.foldername(name))[2]::uuid
      AND (
        p.created_by = auth.uid()
        OR public.is_admin()
        OR public.is_owner()
      )
    )
  );

-- 6. Gallery policies (preserve existing behavior: gallery/...)
CREATE POLICY "Authenticated users can insert gallery"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'gallery'
  );

CREATE POLICY "Authenticated users can update gallery"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'gallery'
  );

CREATE POLICY "Authenticated users can delete gallery"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-images'
    AND (storage.foldername(name))[1] = 'gallery'
  );

-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
