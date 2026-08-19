import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserProfile } from '../lib/hooks';
import { IsomerLogo } from '../components/ui';
import { logAuthEvent } from '../lib/activityLog';
import ThumbnailPromptSection from '../components/ThumbnailPromptSection';
import { ProjectLinksEditor, formatValidUrl } from '../components/ProjectLinks';
import type { Project, ProjectGalleryItem, ProjectLink, ProjectVersion } from '../lib/types';
import { useCreateProjectVersion, useUpdateProjectVersion, useDeleteProjectVersion, useSetDefaultProjectVersion } from '../lib/projectVersionHooks';
import { CREATOR_REQUIREMENT_DAYS } from '../lib/constants';
import { isCreatorRole } from '../lib/roles';
import { formatDuration } from '../components/ProjectGallery';

type CreatorView = 'dashboard' | 'projects' | 'requirements';

const CreatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading, refreshProfile } = useUserProfile();
  const [view, setView] = useState<CreatorView>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [requirementWarning, setRequirementWarning] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Project modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [existingGallery, setExistingGallery] = useState<ProjectGalleryItem[]>([]);
  const [deletingGalleryIds, setDeletingGalleryIds] = useState<string[]>([]);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formComponents, setFormComponents] = useState('');
  const [formGithubUrl, setFormGithubUrl] = useState('');
  const [formProjectLinks, setFormProjectLinks] = useState<ProjectLink[]>([]);
  const [formPublished, setFormPublished] = useState(true);
  const [formThumbnailFile, setFormThumbnailFile] = useState<File | null>(null);
  const [formThumbnailPreview, setFormThumbnailPreview] = useState<string | null>(null);
  const [pendingGalleryItems, setPendingGalleryItems] = useState<{
    id: string;
    file: File;
    previewUrl: string;
    mediaType: 'image' | 'video';
    mimeType: string;
    duration: number | null;
    sizeFormatted: string;
  }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Version state
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [editingVersion, setEditingVersion] = useState<ProjectVersion | null>(null);
  const [versionFormName, setVersionFormName] = useState('');
  const [versionFormNumber, setVersionFormNumber] = useState('');
  const [versionFormDescription, setVersionFormDescription] = useState('');
  const [versionFormWhatsNew, setVersionFormWhatsNew] = useState('');
  const [versionFormThumbnail, setVersionFormThumbnail] = useState<File | null>(null);
  const [versionFormThumbnailPreview, setVersionFormThumbnailPreview] = useState<string | null>(null);
  const [versionFormVideoUrl, setVersionFormVideoUrl] = useState('');
  const [versionFormLinks, setVersionFormLinks] = useState<ProjectLink[]>([]);
  const [versionFormIsDefault, setVersionFormIsDefault] = useState(false);
  const [versionFormSortOrder, setVersionFormSortOrder] = useState(0);
  const [versionSubmitting, setVersionSubmitting] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState<ProjectVersion | null>(null);

  const createVersion = useCreateProjectVersion();
  const updateVersion = useUpdateProjectVersion();
  const deleteVersion = useDeleteProjectVersion();
  const setDefaultVersion = useSetDefaultProjectVersion();

  const fetchVersions = useCallback(async (projectId: string) => {
    setVersionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setVersions((data as ProjectVersion[]) || []);
    } catch (err: unknown) {
      console.error('[CreatorDashboard] Failed to load versions:', err);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const resetVersionForm = () => {
    setEditingVersion(null);
    setVersionFormName('');
    setVersionFormNumber('');
    setVersionFormDescription('');
    setVersionFormWhatsNew('');
    setVersionFormThumbnail(null);
    setVersionFormThumbnailPreview(null);
    setVersionFormVideoUrl('');
    setVersionFormLinks([]);
    setVersionFormIsDefault(false);
    setVersionFormSortOrder(0);
    setVersionError(null);
    setShowVersionForm(false);
  };

  const handleOpenAddVersion = () => {
    resetVersionForm();
    setShowVersionForm(true);
  };

  const handleOpenEditVersion = (version: ProjectVersion) => {
    setEditingVersion(version);
    setVersionFormName(version.version_name);
    setVersionFormNumber(version.version_number);
    setVersionFormDescription(version.description || '');
    setVersionFormWhatsNew(version.whats_new || '');
    setVersionFormThumbnail(null);
    setVersionFormThumbnailPreview(version.thumbnail_url || null);
    setVersionFormVideoUrl(version.video_url || '');
    setVersionFormLinks(version.project_links || []);
    setVersionFormIsDefault(version.is_default);
    setVersionFormSortOrder(version.sort_order);
    setVersionError(null);
    setShowVersionForm(true);
  };

  const handleSaveVersion = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!editingProject?.id) return;


    console.log('[DEBUG CreatorDashboard handleSaveVersion] Triggered. editingProject:', editingProject, 'editingVersion:', editingVersion);
    console.log('[DEBUG CreatorDashboard handleSaveVersion] Form fields:', {
      versionFormName,
      versionFormNumber,
      versionFormDescription,
      versionFormWhatsNew,
      versionFormThumbnail,
      versionFormVideoUrl,
      versionFormLinks,
      versionFormIsDefault,
      versionFormSortOrder,
    });

    setVersionSubmitting(true);
    setVersionError(null);

    try {
      let thumbnailUrl = editingVersion?.thumbnail_url || null;
      if (versionFormThumbnail) {
        const clean = versionFormThumbnail.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `projects/${editingProject.id}/versions/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${clean}`;
        const { error: uploadError } = await supabase.storage.from('project-images').upload(path, versionFormThumbnail, { cacheControl: '3600', upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        thumbnailUrl = supabase.storage.from('project-images').getPublicUrl(path).data.publicUrl;
        if (editingVersion?.thumbnail_url) {
          const marker = 'project-images/';
          const idx = editingVersion.thumbnail_url.indexOf(marker);
          if (idx !== -1) await supabase.storage.from('project-images').remove([editingVersion.thumbnail_url.substring(idx + marker.length)]);
        }
      }

      const cleanedLinks = versionFormLinks
        .filter(l => l.url && l.url.trim() !== '')
        .map(l => ({
          ...l,
          url: formatValidUrl(l.url),
          title: l.title.trim() || l.type.toUpperCase(),
        }));

      if (editingVersion) {
        const result = await updateVersion.update(editingVersion.id, {
          version_name: versionFormName,
          version_number: versionFormNumber,
          description: versionFormDescription,
          whats_new: versionFormWhatsNew,
          thumbnail_url: thumbnailUrl,
          video_url: versionFormVideoUrl,
          project_links: cleanedLinks,
          is_default: versionFormIsDefault,
          sort_order: versionFormSortOrder,
        });
        if (!result) throw new Error('Failed to update version');
      } else {
        const createPayload = {
          project_id: editingProject.id,
          version_name: versionFormName,
          version_number: versionFormNumber,
          description: versionFormDescription,
          whats_new: versionFormWhatsNew,
          thumbnail_url: thumbnailUrl,
          video_url: versionFormVideoUrl,
          project_links: cleanedLinks,
          is_default: versionFormIsDefault,
          sort_order: versionFormSortOrder,
          created_by: currentUserId || '',
        };
        console.log('[DEBUG CreatorDashboard handleSaveVersion] Calling createVersion with:', createPayload);
        const result = await createVersion.create(createPayload);
        console.log('[DEBUG CreatorDashboard handleSaveVersion] createVersion returned:', result);
        if (!result) throw new Error('Failed to create version');
      }

      await fetchVersions(editingProject.id);
      resetVersionForm();
    } catch (err: unknown) {
      setVersionError((err as Error)?.message ?? 'Failed to save version.');
    } finally {
      setVersionSubmitting(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!deletingVersion || !editingProject?.id) return;
    setVersionSubmitting(true);
    try {
      const success = await deleteVersion.deleteVersion(deletingVersion.id);
      if (!success) throw new Error('Failed to delete version');
      if (deletingVersion.thumbnail_url) {
        const marker = 'project-images/';
        const idx = deletingVersion.thumbnail_url.indexOf(marker);
        if (idx !== -1) await supabase.storage.from('project-images').remove([deletingVersion.thumbnail_url.substring(idx + marker.length)]);
      }
      await fetchVersions(editingProject.id);
      setDeletingVersion(null);
    } catch (err: unknown) {
      setVersionError((err as Error)?.message ?? 'Failed to delete version.');
    } finally {
      setVersionSubmitting(false);
    }
  };

  const handleSetDefault = async (versionId: string) => {
    if (!editingProject?.id) return;
    const success = await setDefaultVersion.setDefault(versionId);
    if (success) await fetchVersions(editingProject.id);
  };

  const fetchProjects = useCallback(async (userId: string) => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProjects((data as Project[]) || []);
    } catch (err: unknown) {
      console.error('[CreatorDashboard] Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login', { replace: true }); return; }

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (prof?.role !== 'creator') { navigate('/dashboard', { replace: true }); return; }

      setCurrentUserId(user.id);
      await fetchProjects(user.id);

      // Sync requirement status server-side
      await supabase.rpc('sync_creator_requirement_status');
      await refreshProfile();
    }
    if (!profileLoading) init();
  }, [profileLoading, navigate, fetchProjects, refreshProfile]);

  useEffect(() => {
    if (!profile?.creator_approved_at || profile.first_project_uploaded_at) {
      setRequirementWarning(null);
      setTimeRemaining(null);
      return;
    }

    const approvedAt = new Date(profile.creator_approved_at).getTime();
    const deadline = approvedAt + CREATOR_REQUIREMENT_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const remaining = deadline - now;

    if (remaining <= 0) {
      setRequirementWarning('Your Creator access requires at least one project submission within 2 days of approval.');
      setTimeRemaining('Deadline passed');
    } else {
      setRequirementWarning('Your Creator access requires at least one project submission within 2 days of approval.');
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${mins}m`);
    }
  }, [profile]);

  const handleLogout = async () => {
    await logAuthEvent('user_logout', { email: profile?.email ?? undefined, method: 'creator_dashboard' });
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const generateSlug = (title: string) =>
    title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const clean = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${clean}`;
    const { error } = await supabase.storage.from('project-images').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from('project-images').getPublicUrl(path).data.publicUrl;
  };

  const removeStorageFile = async (url: string | null | undefined) => {
    if (!url) return;
    const marker = 'project-images/';
    const idx = url.indexOf(marker);
    if (idx !== -1) await supabase.storage.from('project-images').remove([url.substring(idx + marker.length)]);
  };

  const getVideoDuration = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;

        const cleanUp = () => {
          URL.revokeObjectURL(objectUrl);
        };

        video.onloadedmetadata = () => {
          const dur = video.duration;
          cleanUp();
          if (typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0) {
            resolve(Math.round(dur * 100) / 100);
          } else {
            resolve(null);
          }
        };

        video.onerror = () => {
          cleanUp();
          resolve(null);
        };

        setTimeout(() => {
          cleanUp();
          resolve(null);
        }, 4000);
      } catch {
        resolve(null);
      }
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleGalleryFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFiles = Array.from(e.target.files);
    const newPending: {
      id: string;
      file: File;
      previewUrl: string;
      mediaType: 'image' | 'video';
      mimeType: string;
      duration: number | null;
      sizeFormatted: string;
    }[] = [];

    for (const file of selectedFiles) {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name);
      const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg|avif)$/i.test(file.name);

      if (!isVideo && !isImage) {
        console.warn('[CreatorDashboard] Unsupported file type skipped:', file.name, file.type);
        continue;
      }

      const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';
      const previewUrl = URL.createObjectURL(file);
      let duration: number | null = null;
      if (isVideo) {
        duration = await getVideoDuration(file);
      }

      newPending.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl,
        mediaType,
        mimeType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
        duration,
        sizeFormatted: formatFileSize(file.size),
      });
    }

    setPendingGalleryItems((prev) => [...prev, ...newPending]);
    e.target.value = '';
  };

  const handleOpenAdd = () => {
    setEditingProject(null);
    setFormTitle(''); setFormSlug(''); setFormDescription(''); setFormComponents('');
    setFormGithubUrl(''); setFormProjectLinks([]); setFormPublished(true);
    setFormThumbnailFile(null); setFormThumbnailPreview(null);
    setPendingGalleryItems([]); setExistingGallery([]); setDeletingGalleryIds([]); setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (project: Project) => {
    setEditingProject(project);
    setFormTitle(project.title); setFormSlug(project.slug);
    setFormDescription(project.description || '');
    setFormComponents(Array.isArray(project.components) ? project.components.join(', ') : (project.components as string) || '');
    setFormGithubUrl(project.github_url || '');

    if (project.project_links && project.project_links.length > 0) {
      setFormProjectLinks(project.project_links);
    } else if (project.github_url) {
      setFormProjectLinks([
        {
          id: 'gh_init',
          type: 'github',
          title: 'GitHub Repository',
          url: project.github_url,
        },
      ]);
    } else {
      setFormProjectLinks([]);
    }

    setFormPublished(project.published !== false);
    setFormThumbnailPreview(project.thumbnail_url || null);
    setFormThumbnailFile(null);
    setPendingGalleryItems([]);
    setDeletingGalleryIds([]);
    setFormError(null);
    setIsModalOpen(true);

    const { data } = await supabase
      .from('project_gallery')
      .select('id, project_id, version_id, image_url, sort_order, created_at, media_type, mime_type, duration_seconds')
      .eq('project_id', project.id)
      .order('sort_order');

    setExistingGallery((data as ProjectGalleryItem[]) || []);
    await fetchVersions(project.id);
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSlug.trim() || !currentUserId) return;
    setSubmitting(true); setFormError(null);
    try {
      const componentsArray = formComponents.split(',').map(c => c.trim()).filter(Boolean);
      let thumbnailUrl = editingProject?.thumbnail_url || null;
      if (formThumbnailFile) {
        setSubmitStatusText('Uploading thumbnail...');
        const newUrl = await uploadFile(formThumbnailFile, 'thumbnails');
        if (editingProject?.thumbnail_url) await removeStorageFile(editingProject.thumbnail_url);
        thumbnailUrl = newUrl;
      }

      // Format and validate links
      const cleanedLinks = formProjectLinks
        .filter(l => l.url && l.url.trim() !== '')
        .map(l => ({
          ...l,
          url: formatValidUrl(l.url),
          title: l.title.trim() || l.type.toUpperCase(),
        }));

      const ghLink = cleanedLinks.find(l => l.type === 'github');
      const syncedGithub = ghLink ? ghLink.url : (formGithubUrl.trim() || null);

      const payload = {
        title: formTitle.trim(), slug: formSlug.trim(),
        description: formDescription.trim(), components: componentsArray,
        github_url: syncedGithub,
        project_links: cleanedLinks,
        thumbnail_url: thumbnailUrl, published: formPublished,
      };
      let projectId = editingProject?.id;
      if (editingProject) {
        const { error } = await supabase.from('projects').update(payload).eq('id', editingProject.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('projects').insert([{ ...payload, created_by: currentUserId }]).select().single();
        if (error) throw error;
        projectId = data.id;
      }

      // Delete removed gallery records and storage files
      if (deletingGalleryIds.length > 0) {
        setSubmitStatusText('Removing deleted gallery media...');
        const toDelete = existingGallery.filter(item => deletingGalleryIds.includes(item.id));
        for (const item of toDelete) {
          if (item.image_url) await removeStorageFile(item.image_url);
        }
        const { error: delError } = await supabase.from('project_gallery').delete().in('id', deletingGalleryIds);
        if (delError) {
          console.warn('[CreatorDashboard] Gallery deletion warning:', delError);
        }
      }

      // Upload new gallery files (both images and videos)
      if (pendingGalleryItems.length > 0 && projectId) {
        const defaultVersion = versions.find(v => v.is_default) || versions[0];
        const targetVersionId = defaultVersion?.id || null;

        const inserts = [];
        const startOrder = existingGallery.length;

        for (let i = 0; i < pendingGalleryItems.length; i++) {
          const item = pendingGalleryItems[i];
          const mediaLabel = item.mediaType === 'video' ? 'video' : 'image';
          setSubmitStatusText(`Uploading ${mediaLabel} ${i + 1}/${pendingGalleryItems.length} (${item.sizeFormatted})...`);

          const cleanName = item.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const path = `gallery/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanName}`;

          const { error: uploadError } = await supabase.storage.from('project-images').upload(path, item.file, {
            cacheControl: '3600',
            upsert: false,
          });

          if (uploadError) {
            console.error('[CreatorDashboard] Storage upload error:', uploadError);
            throw new Error(`Upload failed for ${item.file.name}: ${uploadError.message}`);
          }

          const { data: urlData } = supabase.storage.from('project-images').getPublicUrl(path);
          if (!urlData?.publicUrl) {
            throw new Error(`Failed to obtain public URL for ${item.file.name}`);
          }

          inserts.push({
            project_id: projectId,
            version_id: targetVersionId,
            image_url: urlData.publicUrl,
            media_type: item.mediaType,
            mime_type: item.mimeType,
            duration_seconds: item.duration,
            sort_order: startOrder + i,
          });
        }

        setSubmitStatusText('Saving gallery records...');
        const { error: galleryError } = await supabase.from('project_gallery').insert(inserts);
        if (galleryError) {
          console.error('[CreatorDashboard] Database insert error for project_gallery:', galleryError);
          throw new Error(`Failed to save gallery records: ${galleryError.message}`);
        }
      }

      setIsModalOpen(false);
      if (currentUserId) await fetchProjects(currentUserId);
      await supabase.rpc('sync_creator_requirement_status');
      await refreshProfile();
    } catch (err: unknown) {
      setFormError((err as Error)?.message ?? 'Failed to save project.');
    } finally {
      setSubmitting(false); setSubmitStatusText('');
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirmProject || !currentUserId) return;
    setSubmitting(true);
    try {
      const { data: gallery } = await supabase.from('project_gallery').select('*').eq('project_id', deleteConfirmProject.id);
      if (gallery) for (const item of gallery) await removeStorageFile(item.image_url);
      await supabase.from('project_gallery').delete().eq('project_id', deleteConfirmProject.id);
      if (deleteConfirmProject.thumbnail_url) await removeStorageFile(deleteConfirmProject.thumbnail_url);
      const { error } = await supabase.from('projects').delete().eq('id', deleteConfirmProject.id);
      if (error) throw error;
      setDeleteConfirmProject(null);
      await fetchProjects(currentUserId);
    } catch (err: unknown) {
      alert((err as Error)?.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (profileLoading || !isCreatorRole(profile?.role)) {
    return (
      <div className="min-h-screen bg-dark bg-circuit flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
      </div>
    );
  }

  const totalCount = projects.length;
  const publishedCount = projects.filter(p => p.published).length;
  const draftCount = totalCount - publishedCount;
  const inputClass = 'w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg font-mono-custom';

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
      <header className="glass-dark border-b border-eg/10 sticky top-0 z-30 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link to="/"><IsomerLogo size="md" /></Link>
            <span className="font-mono-custom text-[10px] tracking-widest text-eg/80 uppercase bg-eg/10 px-2.5 py-1 rounded border border-eg/30 hidden sm:inline-block">CREATOR DASHBOARD</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="font-mono-custom text-xs text-white/60 hover:text-eg px-3 py-1.5 rounded border border-white/10">Public Site ↗</Link>
            <button onClick={handleLogout} className="btn-primary py-1.5 px-4 text-xs font-mono-custom">LOGOUT</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {requirementWarning && !profile?.first_project_uploaded_at && (
          <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="font-sans text-xs text-amber-200/90">{requirementWarning}</p>
            {timeRemaining && (
              <span className="font-mono-custom text-xs text-amber-400 whitespace-nowrap">Time remaining: {timeRemaining}</span>
            )}
          </div>
        )}

        {view === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'TOTAL PROJECTS', value: totalCount, color: 'text-white' },
                { label: 'PUBLISHED', value: publishedCount, color: 'text-eg text-glow-sm' },
                { label: 'DRAFTS', value: draftCount, color: 'text-amber-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className="glass rounded-xl p-5 border border-eg/15">
                  <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">{label}</p>
                  <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: '+ UPLOAD PROJECT', action: () => { handleOpenAdd(); setView('projects'); } },
                { label: 'MY PROJECTS', action: () => setView('projects') },
                { label: 'MY PROFILE', action: () => navigate('/profile/edit') },
                { label: 'CREATOR REQUIREMENTS', action: () => setView('requirements') },
              ].map(({ label, action }) => (
                <button key={label} onClick={action} className="glass rounded-xl p-5 border border-eg/20 hover:border-eg/50 hover:bg-eg/5 transition-all text-left">
                  <span className="font-mono-custom text-xs tracking-widest text-eg">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {view === 'requirements' && (
          <div className="glass rounded-2xl p-8 border border-eg/20 space-y-4 max-w-2xl">
            <button onClick={() => setView('dashboard')} className="font-mono-custom text-xs text-white/40 hover:text-eg">← BACK</button>
            <h2 className="font-display text-lg font-bold text-white">Creator Requirements</h2>
            <ul className="font-sans text-sm text-white/70 space-y-2 list-disc list-inside">
              <li>Upload at least one project within 2 days of approval.</li>
              <li>Only manage your own uploaded projects.</li>
              <li>Maintain quality standards for published work.</li>
              <li>Accounts that fail to meet requirements may be reviewed.</li>
            </ul>
            {profile?.creator_approved_at && (
              <p className="font-mono-custom text-xs text-white/40">Approved: {new Date(profile.creator_approved_at).toLocaleDateString()}</p>
            )}
            {profile?.creator_requirement_status && (
              <p className="font-mono-custom text-xs text-eg">Status: {profile.creator_requirement_status.toUpperCase()}</p>
            )}
          </div>
        )}

        {view === 'projects' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <button onClick={() => setView('dashboard')} className="font-mono-custom text-xs text-white/40 hover:text-eg">← DASHBOARD</button>
              <button onClick={handleOpenAdd} className="btn-primary py-2 px-5 text-xs font-mono-custom">+ UPLOAD PROJECT</button>
            </div>

            <div className="glass rounded-xl border border-eg/20 overflow-hidden">
              {loadingProjects ? (
                <div className="py-16 text-center"><div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto" /></div>
              ) : projects.length === 0 ? (
                <div className="py-16 text-center space-y-4">
                  <p className="font-mono-custom text-xs text-white/40">NO PROJECTS YET</p>
                  <button onClick={handleOpenAdd} className="btn-primary text-xs py-2 px-4">+ UPLOAD YOUR FIRST PROJECT</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-eg/10 bg-dark-200/50 font-mono-custom text-[10px] text-white/50 uppercase tracking-widest">
                        <th className="py-3 px-6">PROJECT</th>
                        <th className="py-3 px-4">STATUS</th>
                        <th className="py-3 px-6 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-eg/10">
                      {projects.map(p => (
                        <tr key={p.id} className="hover:bg-eg/5">
                          <td className="py-3 px-6 font-display font-semibold text-white">{p.title}</td>
                          <td className="py-3 px-4">
                            <span className={`font-mono-custom text-[10px] px-2 py-0.5 rounded border ${p.published ? 'text-eg border-eg/30 bg-eg/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
                              {p.published ? 'PUBLISHED' : 'DRAFT'}
                            </span>
                          </td>
                          <td className="py-3 px-6 text-right space-x-2">
                            <button onClick={() => handleOpenEdit(p)} className="px-3 py-1 rounded border border-eg/30 text-eg text-[10px] font-mono-custom">EDIT</button>
                            <button onClick={() => setDeleteConfirmProject(p)} className="px-3 py-1 rounded border border-red-500/30 text-red-400 text-[10px] font-mono-custom">DELETE</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass rounded-2xl border border-eg/30 max-w-2xl w-full max-h-[90vh] flex flex-col my-auto">
            <div className="p-6 border-b border-eg/10 flex justify-between items-center">
              <h2 className="font-display text-lg font-bold">{editingProject ? 'EDIT PROJECT' : 'UPLOAD PROJECT'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-eg">✕</button>
            </div>
            <form onSubmit={handleSubmitProject} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="font-mono-custom text-[10px] text-white/50 uppercase">Title *</label><input required className={inputClass} value={formTitle} onChange={e => { setFormTitle(e.target.value); if (!editingProject) setFormSlug(generateSlug(e.target.value)); }} /></div>
                <div><label className="font-mono-custom text-[10px] text-white/50 uppercase">Slug *</label><input required className={inputClass} value={formSlug} onChange={e => setFormSlug(generateSlug(e.target.value))} /></div>
              </div>
              <div><label className="font-mono-custom text-[10px] text-white/50 uppercase">Description</label><textarea rows={3} className={`${inputClass} font-sans`} value={formDescription} onChange={e => setFormDescription(e.target.value)} /></div>
              <div>
                <label className="font-mono-custom text-[10px] text-white/50 uppercase">Components / Tech Stack</label>
                <input className={inputClass} value={formComponents} onChange={e => setFormComponents(e.target.value)} placeholder="React, TypeScript, Tailwind, Python..." />
              </div>

              {/* Project Links Section */}
              <div className="p-4 rounded-xl border border-eg/20 bg-dark-200/50 space-y-3">
                <ProjectLinksEditor
                  links={formProjectLinks}
                  onChange={setFormProjectLinks}
                />
              </div>

              {/* Versions Section */}
              {editingProject && (
                <div className="p-4 rounded-xl border border-eg/20 bg-dark-200/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-custom text-[10px] text-white/60 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-eg" />
                      VERSIONS ({versions.length})
                    </span>
                    <button type="button" onClick={handleOpenAddVersion} className="text-xs font-mono-custom text-eg hover:text-white px-2.5 py-1 rounded-lg border border-eg/30 hover:border-eg bg-eg/5 transition-colors flex items-center gap-1">
                      <span>+</span> Add Version
                    </button>
                  </div>

                  {versionsLoading ? (
                    <div className="py-4 text-center"><div className="w-6 h-6 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto" /></div>
                  ) : versions.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-2">No versions yet. Add your first version above.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {versions.map(v => (
                        <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-dark-300/50 hover:border-eg/30 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-custom text-xs font-bold text-white">{v.version_number}</span>
                              <span className="font-mono-custom text-xs text-white/70">—</span>
                              <span className="font-mono-custom text-xs text-white/70 truncate">{v.version_name}</span>
                              {v.is_default && <span className="text-[9px] font-mono-custom text-eg uppercase tracking-wider border border-eg/30 px-1.5 py-0.5 rounded bg-eg/10">Default</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2">
                            {!v.is_default && (
                              <button type="button" onClick={() => handleSetDefault(v.id)} className="px-2 py-1 rounded border border-eg/30 text-eg text-[10px] font-mono-custom hover:bg-eg/10 transition-colors">Default</button>
                            )}
                            <button type="button" onClick={() => handleOpenEditVersion(v)} className="px-2 py-1 rounded border border-eg/30 text-eg text-[10px] font-mono-custom hover:bg-eg/10 transition-colors">Edit</button>
                            <button type="button" onClick={() => setDeletingVersion(v)} className="px-2 py-1 rounded border border-red-500/30 text-red-400 text-[10px] font-mono-custom hover:bg-red-500/10 transition-colors">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Version Form (Add/Edit) */}
                  {showVersionForm && (
                    <div className="space-y-3 pt-3 border-t border-eg/10">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-mono-custom text-[10px] text-white/50 uppercase block mb-1">Version Number *</label>
                          <input required className={inputClass} value={versionFormNumber} onChange={e => setVersionFormNumber(e.target.value)} placeholder="1.0" />
                        </div>
                        <div>
                          <label className="font-mono-custom text-[10px] text-white/50 uppercase block mb-1">Version Name *</label>
                          <input required className={inputClass} value={versionFormName} onChange={e => setVersionFormName(e.target.value)} placeholder="Initial Prototype" />
                        </div>
                      </div>
                      <div>
                        <label className="font-mono-custom text-[10px] text-white/50 uppercase block mb-1">Description</label>
                        <textarea rows={3} className={`${inputClass} font-sans`} value={versionFormDescription} onChange={e => setVersionFormDescription(e.target.value)} />
                      </div>
                      <div>
                        <label className="font-mono-custom text-[10px] text-white/50 uppercase block mb-1">What's New</label>
                        <textarea rows={2} className={`${inputClass} font-sans`} value={versionFormWhatsNew} onChange={e => setVersionFormWhatsNew(e.target.value)} />
                      </div>
                      <div>
                        <label className="font-mono-custom text-[10px] text-white/50 uppercase block mb-1">Video URL</label>
                        <input className={inputClass} value={versionFormVideoUrl} onChange={e => setVersionFormVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                      </div>
                      <div>
                        <label className="font-mono-custom text-[10px] text-white/50 uppercase block mb-1">Thumbnail</label>
                        {versionFormThumbnailPreview && <img src={versionFormThumbnailPreview} alt="" className="w-24 h-16 object-cover rounded-lg border border-eg/30 mb-2" />}
                        <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) { setVersionFormThumbnail(e.target.files[0]); setVersionFormThumbnailPreview(URL.createObjectURL(e.target.files[0])); } }} className="text-xs text-white/50" />
                      </div>
                      <div className="p-3 rounded-xl border border-eg/20 bg-dark-200/30 space-y-2">
                        <ProjectLinksEditor links={versionFormLinks} onChange={setVersionFormLinks} />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs font-mono-custom">
                          <input type="checkbox" checked={versionFormIsDefault} onChange={e => setVersionFormIsDefault(e.target.checked)} className="rounded border-eg/40" />
                          DEFAULT VERSION
                        </label>
                        <label className="flex items-center gap-2 text-xs font-mono-custom">
                          <span className="text-white/50">Sort Order:</span>
                          <input type="number" className={`${inputClass} w-20`} value={versionFormSortOrder} onChange={e => setVersionFormSortOrder(parseInt(e.target.value || '0', 10))} />
                        </label>
                      </div>
                      {versionError && <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300">{versionError}</div>}
                      <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={resetVersionForm} className="text-xs text-white/50 hover:text-eg px-3 py-1.5">CANCEL</button>
                        <button type="button" onClick={handleSaveVersion} disabled={versionSubmitting} className="btn-primary py-1.5 px-4 text-xs">{versionSubmitting ? 'SAVING...' : 'SAVE VERSION'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-mono-custom"><input type="checkbox" checked={formPublished} onChange={e => setFormPublished(e.target.checked)} className="rounded border-eg/40" /> PUBLISH IMMEDIATELY</label>
              <div>
                <label className="font-mono-custom text-[10px] text-white/50 uppercase block mb-2">Thumbnail</label>
                {formThumbnailPreview && <img src={formThumbnailPreview} alt="" className="w-24 h-16 object-cover rounded-lg border border-eg/30 mb-2" />}
                <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) { setFormThumbnailFile(e.target.files[0]); setFormThumbnailPreview(URL.createObjectURL(e.target.files[0])); } }} className="text-xs text-white/50" />
                <ThumbnailPromptSection projectName={formTitle} projectDescription={formDescription} hasProductImage={!!(formThumbnailFile || formThumbnailPreview)} />
              </div>
              {/* Project Gallery */}
              <div className="space-y-3 pt-3 border-t border-eg/10">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-mono-custom text-[11px] text-white/70 uppercase block">
                      PROJECT GALLERY (IMAGES & VIDEOS)
                    </label>
                    <span className="font-mono-custom text-[9px] text-white/40 block">
                      Accepted: PNG, JPG, JPEG, WEBP, GIF, MP4, WEBM, MOV
                    </span>
                  </div>
                </div>

                {/* Existing Gallery Media List */}
                {existingGallery.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-mono-custom text-[10px] text-white/40 uppercase">
                      Existing Gallery Items ({existingGallery.length}):
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {existingGallery.map((item) => {
                        const isVideo = item.media_type === 'video' || (item.mime_type && item.mime_type.startsWith('video/'));
                        const durFormatted = formatDuration(item.duration_seconds);
                        return (
                          <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-eg/20 bg-dark-400 group flex items-center justify-center">
                            {isVideo ? (
                              <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-black/60">
                                <span className="font-mono-custom text-[9px] text-eg font-bold flex items-center gap-1">
                                  ▶ VIDEO
                                </span>
                                {durFormatted && (
                                  <span className="font-mono-custom text-[8px] text-white/60 mt-0.5">
                                    {durFormatted}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <img src={item.image_url} alt="Gallery item" className="w-full h-full object-cover" />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingGalleryIds(prev => [...prev, item.id]);
                                setExistingGallery(prev => prev.filter(g => g.id !== item.id));
                              }}
                              className="absolute inset-0 bg-red-950/85 text-red-300 font-mono-custom text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer font-bold"
                            >
                              REMOVE [✕]
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Newly Selected Gallery Media List */}
                {pendingGalleryItems.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-mono-custom text-[10px] text-eg uppercase">
                      Selected Media to Upload ({pendingGalleryItems.length}):
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {pendingGalleryItems.map((item, i) => (
                        <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-eg/40 bg-dark-400 group flex items-center justify-center">
                          {item.mediaType === 'video' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-black/70">
                              <span className="font-mono-custom text-[9px] text-eg font-bold flex items-center gap-1">
                                ▶ VIDEO
                              </span>
                              <span className="font-mono-custom text-[8px] text-white/60 truncate max-w-[90%]">
                                {item.duration ? `${formatDuration(item.duration)} · ` : ''}{item.sizeFormatted}
                              </span>
                            </div>
                          ) : (
                            <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                              setPendingGalleryItems(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            className="absolute top-1 right-1 bg-black/80 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] cursor-pointer transition-colors shadow"
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File picker input */}
                <div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-eg/40 bg-eg/10 hover:bg-eg/20 text-eg font-mono-custom text-xs cursor-pointer transition-colors">
                    <span>+ Add Image / Video</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleGalleryFilesChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-eg/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-xs text-white/50">CANCEL</button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 px-5 text-xs">{submitting ? (submitStatusText || 'SAVING...') : 'SAVE PROJECT'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmProject && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-red-500/40 p-6 max-w-md w-full space-y-4">
            <p className="font-sans text-sm text-white/80">Delete <strong>{deleteConfirmProject.title}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmProject(null)} className="text-xs text-white/50">CANCEL</button>
              <button onClick={handleDeleteProject} disabled={submitting} className="px-4 py-2 rounded border border-red-500/50 text-red-300 text-xs font-mono-custom">{submitting ? 'DELETING...' : 'DELETE'}</button>
            </div>
          </div>
        </div>
      )}

      {deletingVersion && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-red-500/40 p-6 max-w-md w-full space-y-4">
            <p className="font-sans text-sm text-white/80">Delete version <strong>{deletingVersion.version_number} — {deletingVersion.version_name}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingVersion(null)} className="text-xs text-white/50">CANCEL</button>
              <button onClick={handleDeleteVersion} disabled={versionSubmitting} className="px-4 py-2 rounded border border-red-500/50 text-red-300 text-xs font-mono-custom">{versionSubmitting ? 'DELETING...' : 'DELETE'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorDashboard;
