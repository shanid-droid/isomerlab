import React, { useState, useEffect, useCallback, useRef } from 'react';
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

/* ── Types ───────────────────────────────────────────────────────── */
type SidebarView = 'overview' | 'projects' | 'requirements';
type ProjectEditorTab = 'general' | 'media' | 'versions' | 'links' | 'settings';

/* ── Toast ───────────────────────────────────────────────────────── */
interface ToastMessage { id: number; message: string; type: 'success' | 'error' | 'info'; }
let toastCounter = 0;

const Toast: React.FC<{ toasts: ToastMessage[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl font-mono-custom text-xs tracking-wide backdrop-blur-xl transition-all duration-300 ${
          t.type === 'success'
            ? 'bg-dark-100/95 border-eg/40 text-eg'
            : t.type === 'error'
            ? 'bg-dark-100/95 border-red-500/40 text-red-300'
            : 'bg-dark-100/95 border-white/20 text-white/80'
        }`}
        style={{ minWidth: 220 }}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.type === 'success' ? 'bg-eg' : t.type === 'error' ? 'bg-red-400' : 'bg-white/50'}`} />
        <span className="flex-1">{t.message}</span>
        <button onClick={() => onDismiss(t.id)} className="text-white/30 hover:text-white ml-1 flex-shrink-0">✕</button>
      </div>
    ))}
  </div>
);

function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const show = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  return { toasts, show, dismiss };
}

/* ── Sidebar ─────────────────────────────────────────────────────── */
const NAV_ITEMS: { view: SidebarView; label: string; icon: React.ReactNode }[] = [
  {
    view: 'overview',
    label: 'Overview',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    view: 'projects',
    label: 'Projects',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    view: 'requirements',
    label: 'Requirements',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" strokeLinecap="round" />
      </svg>
    ),
  },
];

/* ── Input class ─────────────────────────────────────────────────── */
const IC = 'w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg/60 font-mono-custom transition-colors';

/* ── Main Component ──────────────────────────────────────────────── */
const CreatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading, refreshProfile } = useUserProfile();
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  const [activeView, setActiveView] = useState<SidebarView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [requirementWarning, setRequirementWarning] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Project modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [modalTab, setModalTab] = useState<ProjectEditorTab>('general');
  const [existingGallery, setExistingGallery] = useState<ProjectGalleryItem[]>([]);
  const [deletingGalleryIds, setDeletingGalleryIds] = useState<string[]>([]);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);

  // Project form fields
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
    id: string; file: File; previewUrl: string;
    mediaType: 'image' | 'video'; mimeType: string;
    duration: number | null; sizeFormatted: string;
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

  const [stats, setStats] = useState<{ totalViews: number; totalLikes: number; totalComments: number }>({ totalViews: 0, totalLikes: 0, totalComments: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const modalRef = useRef<HTMLDivElement>(null);

  /* ── Version helpers ─────────────────────────────────────────── */
  const fetchVersions = useCallback(async (projectId: string) => {
    setVersionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_versions').select('*').eq('project_id', projectId)
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
    setVersionFormName(''); setVersionFormNumber('');
    setVersionFormDescription(''); setVersionFormWhatsNew('');
    setVersionFormThumbnail(null); setVersionFormThumbnailPreview(null);
    setVersionFormVideoUrl(''); setVersionFormLinks([]);
    setVersionFormIsDefault(false); setVersionFormSortOrder(0);
    setVersionError(null); setShowVersionForm(false);
  };

  const handleOpenAddVersion = () => { resetVersionForm(); setShowVersionForm(true); };

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
        .map(l => ({ ...l, url: formatValidUrl(l.url), title: l.title.trim() || l.type.toUpperCase() }));

      if (editingVersion) {
        const result = await updateVersion.update(editingVersion.id, {
          version_name: versionFormName, version_number: versionFormNumber,
          description: versionFormDescription, whats_new: versionFormWhatsNew,
          thumbnail_url: thumbnailUrl, video_url: versionFormVideoUrl,
          project_links: cleanedLinks, is_default: versionFormIsDefault, sort_order: versionFormSortOrder,
        });
        if (!result) throw new Error('Failed to update version');
        showToast('Version updated successfully.', 'success');
      } else {
        const result = await createVersion.create({
          project_id: editingProject.id, version_name: versionFormName,
          version_number: versionFormNumber, description: versionFormDescription,
          whats_new: versionFormWhatsNew, thumbnail_url: thumbnailUrl,
          video_url: versionFormVideoUrl, project_links: cleanedLinks,
          is_default: versionFormIsDefault, sort_order: versionFormSortOrder,
          created_by: currentUserId || '',
        });
        if (!result) throw new Error('Failed to create version');
        showToast('Version created successfully.', 'success');
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
      showToast('Version deleted.', 'success');
    } catch (err: unknown) {
      setVersionError((err as Error)?.message ?? 'Failed to delete version.');
    } finally {
      setVersionSubmitting(false);
    }
  };

  const handleSetDefault = async (versionId: string) => {
    if (!editingProject?.id) return;
    const success = await setDefaultVersion.setDefault(versionId);
    if (success) {
      await fetchVersions(editingProject.id);
      showToast('Default version updated.', 'success');
    }
  };

  /* ── Project helpers ─────────────────────────────────────────── */
  const fetchProjects = useCallback(async (userId: string) => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase.from('projects').select('*')
        .eq('created_by', userId).order('created_at', { ascending: false });
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
      await supabase.rpc('sync_creator_requirement_status');
      await refreshProfile();
    }
    if (!profileLoading) init();
  }, [profileLoading, navigate, fetchProjects, refreshProfile]);

  useEffect(() => {
    if (!profile?.creator_approved_at || profile.first_project_uploaded_at) {
      setRequirementWarning(null); setTimeRemaining(null); return;
    }
    const approvedAt = new Date(profile.creator_approved_at).getTime();
    const deadline = approvedAt + CREATOR_REQUIREMENT_DAYS * 24 * 60 * 60 * 1000;
    const remaining = deadline - Date.now();
    setRequirementWarning('Upload at least one project within 2 days of creator approval.');
    if (remaining <= 0) {
      setTimeRemaining('Deadline passed');
    } else {
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${mins}m remaining`);
    }
  }, [profile]);

  const handleLogout = async () => {
    await logAuthEvent('user_logout', { email: profile?.email ?? undefined, method: 'creator_dashboard' });
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const generateSlug = (title: string) =>
    title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

  const uploadFile = async (file: File, folder: string, projectId?: string): Promise<string> => {
    const clean = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = projectId
      ? `${folder}/${projectId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${clean}`
      : `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${clean}`;
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

  const getVideoDuration = (file: File): Promise<number | null> => new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      const cleanUp = () => URL.revokeObjectURL(objectUrl);
      video.onloadedmetadata = () => {
        const dur = video.duration;
        cleanUp();
        resolve(typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0 ? Math.round(dur * 100) / 100 : null);
      };
      video.onerror = () => { cleanUp(); resolve(null); };
      setTimeout(() => { cleanUp(); resolve(null); }, 4000);
    } catch { resolve(null); }
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleGalleryFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFiles = Array.from(e.target.files);
    const newPending: typeof pendingGalleryItems = [];
    for (const file of selectedFiles) {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name);
      const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg|avif)$/i.test(file.name);
      if (!isVideo && !isImage) continue;
      const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';
      const previewUrl = URL.createObjectURL(file);
      const duration = isVideo ? await getVideoDuration(file) : null;
      newPending.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file, previewUrl, mediaType,
        mimeType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
        duration, sizeFormatted: formatFileSize(file.size),
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
    setPendingGalleryItems([]); setExistingGallery([]); setDeletingGalleryIds([]);
    setFormError(null); setModalTab('general'); setVersions([]);
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
      setFormProjectLinks([{ id: 'gh_init', type: 'github', title: 'GitHub Repository', url: project.github_url }]);
    } else {
      setFormProjectLinks([]);
    }
    setFormPublished(project.published !== false);
    setFormThumbnailPreview(project.thumbnail_url || null);
    setFormThumbnailFile(null);
    setPendingGalleryItems([]); setDeletingGalleryIds([]);
    setFormError(null); setModalTab('general');
    setIsModalOpen(true);
    const { data } = await supabase.from('project_gallery')
      .select('id, project_id, version_id, image_url, sort_order, created_at, media_type, mime_type, duration_seconds')
      .eq('project_id', project.id).order('sort_order');
    setExistingGallery((data as ProjectGalleryItem[]) || []);
    await fetchVersions(project.id);
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSlug.trim() || !currentUserId) return;
    setSubmitting(true); setFormError(null);
    try {
      const componentsArray = formComponents.split(',').map(c => c.trim()).filter(Boolean);
      const cleanedLinks = formProjectLinks
        .filter(l => l.url && l.url.trim() !== '')
        .map(l => ({ ...l, url: formatValidUrl(l.url), title: l.title.trim() || l.type.toUpperCase() }));
      const ghLink = cleanedLinks.find(l => l.type === 'github');
      const syncedGithub = ghLink ? ghLink.url : (formGithubUrl.trim() || null);
      const payload = {
        title: formTitle.trim(), slug: formSlug.trim(),
        description: formDescription.trim(), components: componentsArray,
        github_url: syncedGithub, project_links: cleanedLinks,
        published: formPublished,
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

      if (formThumbnailFile && projectId) {
        setSubmitStatusText('Uploading thumbnail...');
        const newUrl = await uploadFile(formThumbnailFile, 'thumbnails', projectId);
        if (editingProject?.thumbnail_url) await removeStorageFile(editingProject.thumbnail_url);
        const { error: thumbError } = await supabase.from('projects').update({ thumbnail_url: newUrl }).eq('id', projectId);
        if (thumbError) throw thumbError;
      }

      if (projectId && payload.description !== undefined) {
        const { data: defaultVer } = await supabase
          .from('project_versions')
          .select('id')
          .eq('project_id', projectId)
          .eq('is_default', true)
          .maybeSingle();

        if (defaultVer?.id) {
          await supabase
            .from('project_versions')
            .update({ description: payload.description })
            .eq('id', defaultVer.id);
        }
      }

      if (deletingGalleryIds.length > 0) {
        setSubmitStatusText('Removing deleted media...');
        const toDelete = existingGallery.filter(item => deletingGalleryIds.includes(item.id));
        for (const item of toDelete) { if (item.image_url) await removeStorageFile(item.image_url); }
        await supabase.from('project_gallery').delete().in('id', deletingGalleryIds);
      }
      if (pendingGalleryItems.length > 0 && projectId) {
        const defaultVersion = versions.find(v => v.is_default) || versions[0];
        const targetVersionId = defaultVersion?.id || null;
        const inserts = [];
        const startOrder = existingGallery.length;
        for (let i = 0; i < pendingGalleryItems.length; i++) {
          const item = pendingGalleryItems[i];
          setSubmitStatusText(`Uploading ${item.mediaType} ${i + 1}/${pendingGalleryItems.length}...`);
          const cleanName = item.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const path = `gallery/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanName}`;
          const { error: uploadError } = await supabase.storage.from('project-images').upload(path, item.file, { cacheControl: '3600', upsert: false });
          if (uploadError) throw new Error(`Upload failed for ${item.file.name}: ${uploadError.message}`);
          const { data: urlData } = supabase.storage.from('project-images').getPublicUrl(path);
          if (!urlData?.publicUrl) throw new Error(`Failed to obtain public URL for ${item.file.name}`);
          inserts.push({
            project_id: projectId, version_id: targetVersionId,
            image_url: urlData.publicUrl, media_type: item.mediaType,
            mime_type: item.mimeType, duration_seconds: item.duration,
            sort_order: startOrder + i,
          });
        }
        setSubmitStatusText('Saving gallery records...');
        const { error: galleryError } = await supabase.from('project_gallery').insert(inserts);
        if (galleryError) throw new Error(`Failed to save gallery records: ${galleryError.message}`);
      }
      setIsModalOpen(false);
      if (currentUserId) await fetchProjects(currentUserId);
      await supabase.rpc('sync_creator_requirement_status');
      await refreshProfile();
      showToast(editingProject ? 'Project updated successfully.' : 'Project uploaded successfully.', 'success');
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
      showToast('Project deleted.', 'success');
    } catch (err: unknown) {
      showToast((err as Error)?.message ?? 'Failed to delete project.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (project: Project) => {
    const newState = !project.published;
    try {
      const { error } = await supabase.from('projects').update({ published: newState }).eq('id', project.id);
      if (error) throw error;
      if (currentUserId) await fetchProjects(currentUserId);
      showToast(newState ? 'Project published.' : 'Project moved to drafts.', 'success');
    } catch (err: unknown) {
      showToast((err as Error)?.message ?? 'Failed to update project.', 'error');
    }
  };

  useEffect(() => {
    async function fetchStats() {
      if (!currentUserId || projects.length === 0) {
        setLoadingStats(false);
        return;
      }
      setLoadingStats(true);
      try {
        const projectIds = projects.map(p => p.id);
        const { data: likesData } = await supabase.from('project_likes').select('project_id').in('project_id', projectIds);
        const { data: commentsData } = await supabase.from('project_comments').select('project_id').in('project_id', projectIds);
        const totalLikes = likesData?.length || 0;
        const totalComments = commentsData?.length || 0;
        const totalViews = projects.reduce((sum, p) => sum + (p.views_count || 0), 0);
        setStats({ totalViews, totalLikes, totalComments });
      } catch {
        // Silently fail stats fetch
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, [currentUserId, projects]);

  /* ── Loading guard ─────────────────────────────────────────────── */
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
  const firstName = profile?.full_name?.split(' ')[0] || 'Creator';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CR';

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* ── Top bar (mobile only) ─────────────────────────────── */}
      <header className="glass-dark border-b border-eg/10 sticky top-0 z-30 py-3.5 px-5 flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex flex-col items-center justify-center gap-1.5 text-white/60 hover:text-eg transition-colors"
            aria-label="Open menu"
          >
            <span className="w-5 h-px bg-current" />
            <span className="w-4 h-px bg-current self-start" />
            <span className="w-5 h-px bg-current" />
          </button>
          <Link to="/"><IsomerLogo size="sm" /></Link>
        </div>
        <span className="font-mono-custom text-[10px] tracking-widest text-eg/70 uppercase">CREATOR STUDIO</span>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar overlay (mobile) ────────────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside
          className={`
            fixed top-0 left-0 h-full z-50 w-56 bg-dark-100 border-r border-eg/15 flex flex-col
            transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:relative lg:translate-x-0 lg:z-auto lg:flex-shrink-0
          `}
        >
          {/* Sidebar header */}
          <div className="px-5 py-5 border-b border-eg/10">
            <Link to="/" onClick={() => setSidebarOpen(false)}>
              <IsomerLogo size="sm" />
            </Link>
            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono-custom text-[9px] tracking-widest text-eg/70 uppercase bg-eg/10 px-2 py-0.5 rounded border border-eg/25">
                CREATOR STUDIO
              </span>
            </div>
          </div>

          {/* Creator identity */}
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name || ''} className="w-9 h-9 rounded-xl object-cover border border-eg/30" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-dark-300 border border-eg/30 flex items-center justify-center">
                  <span className="font-display text-sm font-bold text-eg">{initials}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="font-mono-custom text-xs text-white truncate">{profile?.full_name || 'Creator'}</p>
                <p className="font-mono-custom text-[9px] text-eg/60 tracking-wider uppercase">Creator</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map(({ view, label, icon }) => (
              <button
                key={view}
                onClick={() => { setActiveView(view); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 font-mono-custom text-xs tracking-wide
                  ${activeView === view
                    ? 'bg-eg/15 text-eg border border-eg/30'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                <span className={activeView === view ? 'text-eg' : 'text-white/30'}>{icon}</span>
                {label}
                {view === 'projects' && totalCount > 0 && (
                  <span className="ml-auto font-mono-custom text-[9px] text-eg/60 bg-eg/10 px-1.5 py-0.5 rounded-full">{totalCount}</span>
                )}
              </button>
            ))}

            <div className="pt-3 border-t border-white/5 space-y-1 mt-3">
              <Link
                to="/profile/edit"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white/80 hover:bg-white/5 transition-all font-mono-custom text-xs tracking-wide border border-transparent"
              >
                <svg className="w-4 h-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" strokeLinecap="round" />
                </svg>
                Edit Profile
              </Link>
              <Link
                to={`/profile/${currentUserId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white/80 hover:bg-white/5 transition-all font-mono-custom text-xs tracking-wide border border-transparent"
              >
                <svg className="w-4 h-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" strokeLinecap="round" />
                  <path d="M15 3h6v6" strokeLinecap="round" />
                  <path d="M10 14L21 3" strokeLinecap="round" />
                </svg>
                Public Profile ↗
              </Link>
            </div>
          </nav>

          {/* Sidebar footer */}
          <div className="px-4 pb-5 border-t border-white/5 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
              <span className="font-mono-custom text-[9px] text-white/30 tracking-widest uppercase">System Online</span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 rounded-xl border border-white/10 text-white/40 hover:text-red-300 hover:border-red-500/30 font-mono-custom text-xs transition-all"
            >
              LOGOUT
            </button>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────── */}
        <main className="flex-1 min-h-screen overflow-y-auto">
          {/* Requirement warning */}
          {requirementWarning && !profile?.first_project_uploaded_at && (
            <div className="px-6 pt-4">
              <div className="p-3.5 rounded-xl border border-amber-500/35 bg-amber-500/8 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <p className="font-mono-custom text-xs text-amber-200/80">{requirementWarning}</p>
                {timeRemaining && (
                  <span className="font-mono-custom text-xs text-amber-400 whitespace-nowrap">{timeRemaining}</span>
                )}
              </div>
            </div>
          )}

          {/* ════ OVERVIEW ════════════════════════════════════════ */}
          {activeView === 'overview' && (
            <div className="px-6 py-8 max-w-4xl space-y-8">
              {/* Greeting */}
              <div>
                <p className="font-mono-custom text-xs tracking-[0.3em] text-eg/60 uppercase mb-1">{greeting},</p>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-wide">{firstName.toUpperCase()}.</h1>
                <p className="font-mono-custom text-xs text-white/30 mt-2">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Metrics strip */}
              <div className="grid grid-cols-3 gap-0 rounded-2xl border border-eg/15 overflow-hidden">
                {[
                  { label: 'TOTAL', value: totalCount, color: 'text-white' },
                  { label: 'PUBLISHED', value: publishedCount, color: 'text-eg' },
                  { label: 'DRAFTS', value: draftCount, color: 'text-amber-300' },
                ].map(({ label, value, color }, i) => (
                  <div
                    key={label}
                    className={`px-6 py-5 bg-dark-200/40 ${i < 2 ? 'border-r border-eg/15' : ''}`}
                  >
                    <p className="font-mono-custom text-[9px] tracking-widest text-white/30 uppercase mb-1">{label}</p>
                    <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Extended stats */}
              {!loadingStats && (
                <div className="grid grid-cols-3 gap-0 rounded-2xl border border-eg/15 overflow-hidden">
                  {[
                    { label: 'VIEWS', value: stats.totalViews.toLocaleString(), color: 'text-white' },
                    { label: 'LIKES', value: stats.totalLikes.toLocaleString(), color: 'text-eg' },
                    { label: 'COMMENTS', value: stats.totalComments.toLocaleString(), color: 'text-amber-300' },
                  ].map(({ label, value, color }, i) => (
                    <div
                      key={label}
                      className={`px-6 py-4 bg-dark-200/30 ${i < 2 ? 'border-r border-eg/10' : ''}`}
                    >
                      <p className="font-mono-custom text-[9px] tracking-widest text-white/25 uppercase mb-1">{label}</p>
                      <p className={`font-display text-xl font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick actions */}
              <div>
                <p className="font-mono-custom text-[9px] tracking-widest text-white/25 uppercase mb-3">QUICK ACTIONS</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => { handleOpenAdd(); setActiveView('projects'); }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-eg/30 bg-eg/8 hover:bg-eg/15 hover:border-eg/60 text-eg font-mono-custom text-xs tracking-wide transition-all text-left"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    Upload Project
                  </button>
                  <Link
                    to="/profile/edit"
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/10 hover:border-eg/30 hover:bg-eg/5 text-white/60 hover:text-eg font-mono-custom text-xs tracking-wide transition-all"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" strokeLinecap="round" />
                    </svg>
                    Edit Profile
                  </Link>
                  <button
                    onClick={() => setActiveView('requirements')}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/10 hover:border-eg/30 hover:bg-eg/5 text-white/60 hover:text-eg font-mono-custom text-xs tracking-wide transition-all text-left"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4l3 3" strokeLinecap="round" />
                    </svg>
                    Requirements
                  </button>
                </div>
              </div>

              {/* Recent projects */}
              {projects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-mono-custom text-[9px] tracking-widest text-white/25 uppercase">RECENT PROJECTS</p>
                    <button
                      onClick={() => setActiveView('projects')}
                      className="font-mono-custom text-[10px] text-eg/60 hover:text-eg transition-colors"
                    >
                      VIEW ALL →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {projects.slice(0, 3).map((p) => (
                      <div key={p.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/8 bg-dark-200/30 hover:border-eg/20 transition-colors">
                        {p.thumbnail_url ? (
                          <img src={p.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-eg/20" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-dark-400 border border-eg/15 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-xs font-semibold text-white truncate">{p.title}</p>
                        </div>
                        <span className={`font-mono-custom text-[9px] px-2 py-0.5 rounded border flex-shrink-0 ${p.published ? 'text-eg border-eg/30 bg-eg/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/8'}`}>
                          {p.published ? 'LIVE' : 'DRAFT'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ PROJECTS ════════════════════════════════════════ */}
          {activeView === 'projects' && (
            <div className="px-6 py-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">Projects</h2>
                  <p className="font-mono-custom text-[10px] text-white/30 mt-0.5">
                    {publishedCount} published · {draftCount} drafts
                  </p>
                </div>
                <button onClick={handleOpenAdd} className="btn-primary py-2 px-5 text-xs font-mono-custom flex items-center gap-2">
                  <span>+</span> UPLOAD
                </button>
              </div>

              {loadingProjects ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin mx-auto" />
                </div>
              ) : projects.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <p className="font-mono-custom text-xs text-white/30">NO PROJECTS YET</p>
                  <button onClick={handleOpenAdd} className="btn-primary text-xs py-2 px-4">
                    + UPLOAD YOUR FIRST PROJECT
                  </button>
                </div>
              ) : (
                <div className="glass rounded-2xl border border-eg/15 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-eg/10 bg-dark-200/50 font-mono-custom text-[9px] text-white/40 uppercase tracking-widest">
                          <th className="py-3 px-4 w-12" />
                          <th className="py-3 px-4">PROJECT</th>
                          <th className="py-3 px-4">STATUS</th>
                          <th className="py-3 px-4 text-right">ACTIONS</th>
                        </tr>
                      </thead>
                    <tbody className="divide-y divide-eg/8">
                        {projects.map(p => {
                          return (
                          <tr key={p.id} className="hover:bg-eg/5 transition-colors group">
                            <td className="py-3 px-4">
                              {p.thumbnail_url ? (
                                <img src={p.thumbnail_url} alt="" className="w-10 h-8 rounded-lg object-cover border border-eg/20" />
                              ) : (
                                <div className="w-10 h-8 rounded-lg bg-dark-400 border border-eg/15" />
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-display font-semibold text-white group-hover:text-eg transition-colors">{p.title}</p>
                              <p className="font-mono-custom text-[9px] text-white/30 mt-0.5">/{p.slug}</p>
                              {p.components && Array.isArray(p.components) && p.components.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {p.components.slice(0, 3).map((c) => (
                                    <span key={c} className="font-mono-custom text-[8px] px-1.5 py-0.5 rounded bg-dark-300 border border-eg/15 text-white/50">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handleTogglePublish(p)}
                                className={`font-mono-custom text-[9px] px-2.5 py-1 rounded border cursor-pointer transition-all hover:opacity-80 ${p.published ? 'text-eg border-eg/30 bg-eg/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/8'}`}
                                title={p.published ? 'Click to unpublish' : 'Click to publish'}
                              >
                                {p.published ? 'PUBLISHED' : 'DRAFT'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  to={`/projects/${p.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-lg border border-white/15 text-white/40 hover:text-eg hover:border-eg/30 font-mono-custom text-[9px] transition-all"
                                  title="Preview"
                                >
                                  ↗
                                </Link>
                                <button
                                  onClick={() => handleOpenEdit(p)}
                                  className="px-3 py-1.5 rounded-lg border border-eg/25 text-eg font-mono-custom text-[9px] hover:bg-eg/10 transition-colors"
                                >
                                  EDIT
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmProject(p)}
                                  className="px-3 py-1.5 rounded-lg border border-red-500/25 text-red-400 font-mono-custom text-[9px] hover:bg-red-500/8 transition-colors"
                                >
                                  DELETE
                                </button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                    </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ REQUIREMENTS ════════════════════════════════════ */}
          {activeView === 'requirements' && (
            <div className="px-6 py-8 max-w-2xl">
              <h2 className="font-display text-xl font-bold text-white mb-6">Creator Requirements</h2>
              <div className="glass-dark rounded-2xl p-7 border border-eg/15 space-y-5">
                <div className="space-y-3">
                  {[
                    'Upload at least one project within 2 days of approval.',
                    'Only manage your own uploaded projects.',
                    'Maintain quality standards for published work.',
                    'Accounts that fail to meet requirements may be reviewed.',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-eg mt-1.5 flex-shrink-0" />
                      <p className="font-sans text-sm text-white/70">{item}</p>
                    </div>
                  ))}
                </div>
                {profile?.creator_approved_at && (
                  <div className="pt-4 border-t border-eg/10 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-custom text-[9px] text-white/30 uppercase tracking-widest">Approved</span>
                      <span className="font-mono-custom text-xs text-white/60">
                        {new Date(profile.creator_approved_at).toLocaleDateString()}
                      </span>
                    </div>
                    {profile?.creator_requirement_status && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono-custom text-[9px] text-white/30 uppercase tracking-widest">Status</span>
                        <span className="font-mono-custom text-xs text-eg">{profile.creator_requirement_status.toUpperCase()}</span>
                      </div>
                    )}
                    {requirementWarning && !profile?.first_project_uploaded_at && timeRemaining && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono-custom text-[9px] text-amber-400/60 uppercase tracking-widest">Time</span>
                        <span className="font-mono-custom text-xs text-amber-400">{timeRemaining}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ════════════════════════════════════════════════════════════
          PROJECT MODAL — TABBED EDITOR
      ════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div
            ref={modalRef}
            className="glass rounded-2xl border border-eg/25 w-full max-w-2xl my-auto flex flex-col max-h-[92vh]"
          >
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-eg/10 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-display text-base font-bold text-white">
                  {editingProject ? 'EDIT PROJECT' : 'UPLOAD PROJECT'}
                </h2>
                {editingProject && (
                  <p className="font-mono-custom text-[10px] text-white/30 mt-0.5">/{editingProject.slug}</p>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-eg hover:bg-eg/10 transition-all">
                ✕
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-eg/10 px-2 flex-shrink-0 overflow-x-auto">
              {(
                [
                  { id: 'general', label: 'General' },
                  { id: 'media', label: 'Media' },
                  ...(editingProject ? [{ id: 'versions', label: `Versions${versions.length > 0 ? ` (${versions.length})` : ''}` }] : []),
                  { id: 'links', label: 'Links' },
                  { id: 'settings', label: 'Settings' },
                ] as { id: ProjectEditorTab; label: string }[]
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setModalTab(id)}
                  className={`
                    px-4 py-3 font-mono-custom text-[10px] tracking-wider whitespace-nowrap border-b-2 transition-all
                    ${modalTab === id
                      ? 'text-eg border-eg'
                      : 'text-white/40 border-transparent hover:text-white/70 hover:border-white/20'
                    }
                  `}
                >
                  {label.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <form onSubmit={handleSubmitProject} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl border border-red-500/35 bg-red-500/8 text-xs text-red-300 font-sans">
                    {formError}
                  </div>
                )}

                {/* ── GENERAL ──────────────────────────────────── */}
                {modalTab === 'general' && (
                  <div className="space-y-4">
                    <div>
                      <label className="font-mono-custom text-[9px] text-white/40 uppercase tracking-widest block mb-1.5">Title *</label>
                      <input
                        required
                        className={IC}
                        value={formTitle}
                        onChange={e => { setFormTitle(e.target.value); if (!editingProject) setFormSlug(generateSlug(e.target.value)); }}
                        placeholder="My Awesome Project"
                      />
                    </div>
                    <div>
                      <label className="font-mono-custom text-[9px] text-white/40 uppercase tracking-widest block mb-1.5">Slug *</label>
                      <input
                        required
                        className={IC}
                        value={formSlug}
                        onChange={e => setFormSlug(generateSlug(e.target.value))}
                        placeholder="my-awesome-project"
                      />
                      <p className="font-mono-custom text-[9px] text-white/25 mt-1">URL: /projects/{formSlug || 'slug'}</p>
                    </div>
                    <div>
                      <label className="font-mono-custom text-[9px] text-white/40 uppercase tracking-widest block mb-1.5">Description</label>
                      <textarea
                        rows={4}
                        className={`${IC} font-sans leading-relaxed`}
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        placeholder="A brief description of your project..."
                      />
                    </div>
                    <div>
                      <label className="font-mono-custom text-[9px] text-white/40 uppercase tracking-widest block mb-1.5">Tech Stack / Components</label>
                      <input
                        className={IC}
                        value={formComponents}
                        onChange={e => setFormComponents(e.target.value)}
                        placeholder="React, TypeScript, Supabase, Python..."
                      />
                      <p className="font-mono-custom text-[9px] text-white/25 mt-1">Comma-separated</p>
                    </div>
                  </div>
                )}

                {/* ── MEDIA ────────────────────────────────────── */}
                {modalTab === 'media' && (
                  <div className="space-y-6">
                    {/* Thumbnail */}
                    <div className="space-y-3">
                      <label className="font-mono-custom text-[9px] text-white/40 uppercase tracking-widest block">Thumbnail</label>
                      {formThumbnailPreview && (
                        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-eg/20">
                          <img src={formThumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => { setFormThumbnailFile(null); setFormThumbnailPreview(null); }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white/70 hover:text-eg flex items-center justify-center text-xs"
                          >✕</button>
                        </div>
                      )}
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-eg/30 bg-eg/8 hover:bg-eg/15 text-eg font-mono-custom text-xs cursor-pointer transition-colors">
                        <span>{formThumbnailPreview ? 'Replace Thumbnail' : '+ Choose Thumbnail'}</span>
                        <input
                          type="file" accept="image/*"
                          onChange={e => { if (e.target.files?.[0]) { setFormThumbnailFile(e.target.files[0]); setFormThumbnailPreview(URL.createObjectURL(e.target.files[0])); } }}
                          className="hidden"
                        />
                      </label>
                      <ThumbnailPromptSection projectName={formTitle} projectDescription={formDescription} hasProductImage={!!(formThumbnailFile || formThumbnailPreview)} />
                    </div>

                    {/* Gallery */}
                    <div className="space-y-3 pt-4 border-t border-eg/10">
                      <div className="flex items-center justify-between">
                        <label className="font-mono-custom text-[9px] text-white/40 uppercase tracking-widest">
                          Gallery <span className="text-white/25">(Images & Videos)</span>
                        </label>
                        <span className="font-mono-custom text-[9px] text-white/20">PNG, JPG, WEBP, MP4, WEBM, MOV</span>
                      </div>

                      {/* Existing items */}
                      {existingGallery.length > 0 && (
                        <div className="space-y-2">
                          <span className="font-mono-custom text-[9px] text-white/30 uppercase">
                            Existing ({existingGallery.length})
                          </span>
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {existingGallery.map((item) => {
                              const isVid = item.media_type === 'video' || (item.mime_type && item.mime_type.startsWith('video/'));
                              return (
                                <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-eg/15 bg-dark-400 group">
                                  {isVid ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-dark-300">
                                      <svg className="w-5 h-5 text-eg/50 mb-0.5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                      <span className="font-mono-custom text-[8px] text-eg/50">VIDEO</span>
                                      {formatDuration(item.duration_seconds) && (
                                        <span className="font-mono-custom text-[7px] text-white/30">{formatDuration(item.duration_seconds)}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <img src={item.image_url} alt="Gallery item" className="w-full h-full object-cover" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => { setDeletingGalleryIds(prev => [...prev, item.id]); setExistingGallery(prev => prev.filter(g => g.id !== item.id)); }}
                                    className="absolute inset-0 bg-red-950/80 text-red-300 font-mono-custom text-[8px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity font-bold"
                                  >
                                    REMOVE
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pending new items */}
                      {pendingGalleryItems.length > 0 && (
                        <div className="space-y-2">
                          <span className="font-mono-custom text-[9px] text-eg/60 uppercase">
                            To upload ({pendingGalleryItems.length})
                          </span>
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {pendingGalleryItems.map((item, i) => (
                              <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-eg/30 bg-dark-400 group">
                                {item.mediaType === 'video' ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-dark-300">
                                    <svg className="w-5 h-5 text-eg/60 mb-0.5" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                    <span className="font-mono-custom text-[7px] text-white/40 truncate max-w-[90%]">
                                      {item.sizeFormatted}
                                    </span>
                                  </div>
                                ) : (
                                  <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); setPendingGalleryItems(prev => prev.filter((_, idx) => idx !== i)); }}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center text-[9px] transition-colors"
                                >✕</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-eg/30 bg-eg/8 hover:bg-eg/15 text-eg font-mono-custom text-xs cursor-pointer transition-colors">
                        <span>+ Add Image / Video</span>
                        <input type="file" multiple accept="image/*,video/*" onChange={handleGalleryFilesChange} className="hidden" />
                      </label>
                    </div>
                  </div>
                )}

                {/* ── VERSIONS ─────────────────────────────────── */}
                {modalTab === 'versions' && editingProject && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono-custom text-xs text-white/70">Version History</p>
                        <p className="font-mono-custom text-[9px] text-white/30 mt-0.5">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
                      </div>
                      {!showVersionForm && (
                        <button
                          type="button"
                          onClick={handleOpenAddVersion}
                          className="px-3 py-1.5 rounded-lg border border-eg/30 text-eg font-mono-custom text-xs hover:bg-eg/10 transition-colors flex items-center gap-1.5"
                        >
                          <span>+</span> Add Version
                        </button>
                      )}
                    </div>

                    {versionsLoading ? (
                      <div className="py-8 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
                      </div>
                    ) : versions.length === 0 && !showVersionForm ? (
                      <div className="py-10 text-center">
                        <p className="font-mono-custom text-xs text-white/30">No versions yet.</p>
                        <button
                          type="button"
                          onClick={handleOpenAddVersion}
                          className="mt-3 font-mono-custom text-xs text-eg/60 hover:text-eg underline transition-colors"
                        >
                          Add your first version →
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {versions.map(v => (
                          <div
                            key={v.id}
                            className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${v.is_default ? 'border-eg/40 bg-eg/8' : 'border-white/8 bg-dark-300/40 hover:border-eg/20'}`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono-custom text-xs font-bold text-white">v{v.version_number}</span>
                                <span className="font-mono-custom text-xs text-white/50 truncate">{v.version_name}</span>
                                {v.is_default && (
                                  <span className="font-mono-custom text-[8px] text-eg border border-eg/30 px-1.5 py-0.5 rounded bg-eg/10 uppercase tracking-wider">DEFAULT</span>
                                )}
                              </div>
                              {v.description && (
                                <p className="font-sans text-[11px] text-white/30 mt-1 line-clamp-1">{v.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                              {!v.is_default && (
                                <button type="button" onClick={() => handleSetDefault(v.id)} className="px-2 py-1 rounded border border-eg/20 text-white/40 hover:text-eg hover:border-eg/40 font-mono-custom text-[9px] transition-colors">
                                  SET DEFAULT
                                </button>
                              )}
                              <button type="button" onClick={() => handleOpenEditVersion(v)} className="px-2 py-1 rounded border border-eg/25 text-eg font-mono-custom text-[9px] hover:bg-eg/10 transition-colors">EDIT</button>
                              <button type="button" onClick={() => setDeletingVersion(v)} className="px-2 py-1 rounded border border-red-500/20 text-red-400 font-mono-custom text-[9px] hover:bg-red-500/8 transition-colors">DEL</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Version form */}
                    {showVersionForm && (
                      <div className="space-y-4 pt-4 border-t border-eg/10">
                        <div className="flex items-center justify-between">
                          <p className="font-mono-custom text-xs text-eg">{editingVersion ? 'EDITING VERSION' : 'NEW VERSION'}</p>
                          <button type="button" onClick={resetVersionForm} className="font-mono-custom text-[9px] text-white/30 hover:text-white/60">CANCEL</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="font-mono-custom text-[9px] text-white/35 uppercase block mb-1">Version Number *</label>
                            <input required className={IC} value={versionFormNumber} onChange={e => setVersionFormNumber(e.target.value)} placeholder="1.0" />
                          </div>
                          <div>
                            <label className="font-mono-custom text-[9px] text-white/35 uppercase block mb-1">Version Name *</label>
                            <input required className={IC} value={versionFormName} onChange={e => setVersionFormName(e.target.value)} placeholder="Initial Release" />
                          </div>
                        </div>
                        <div>
                          <label className="font-mono-custom text-[9px] text-white/35 uppercase block mb-1">Description</label>
                          <textarea rows={3} className={`${IC} font-sans`} value={versionFormDescription} onChange={e => setVersionFormDescription(e.target.value)} />
                        </div>
                        <div>
                          <label className="font-mono-custom text-[9px] text-white/35 uppercase block mb-1">What's New</label>
                          <textarea rows={2} className={`${IC} font-sans`} value={versionFormWhatsNew} onChange={e => setVersionFormWhatsNew(e.target.value)} />
                        </div>
                        <div>
                          <label className="font-mono-custom text-[9px] text-white/35 uppercase block mb-1">Video URL</label>
                          <input className={IC} value={versionFormVideoUrl} onChange={e => setVersionFormVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                        </div>
                        <div>
                          <label className="font-mono-custom text-[9px] text-white/35 uppercase block mb-1">Thumbnail</label>
                          {versionFormThumbnailPreview && (
                            <img src={versionFormThumbnailPreview} alt="" className="w-24 h-16 object-cover rounded-lg border border-eg/25 mb-2" />
                          )}
                          <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) { setVersionFormThumbnail(e.target.files[0]); setVersionFormThumbnailPreview(URL.createObjectURL(e.target.files[0])); } }} className="text-xs text-white/40" />
                        </div>
                        <div className="p-3 rounded-xl border border-eg/15 bg-dark-200/30">
                          <ProjectLinksEditor links={versionFormLinks} onChange={setVersionFormLinks} />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-xs font-mono-custom cursor-pointer">
                            <input type="checkbox" checked={versionFormIsDefault} onChange={e => setVersionFormIsDefault(e.target.checked)} className="rounded border-eg/40 accent-eg" />
                            <span className="text-white/60">SET AS DEFAULT</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs font-mono-custom">
                            <span className="text-white/30">Sort Order:</span>
                            <input type="number" className={`${IC} w-16`} value={versionFormSortOrder} onChange={e => setVersionFormSortOrder(parseInt(e.target.value || '0', 10))} />
                          </label>
                        </div>
                        {versionError && (
                          <div className="p-3 rounded-xl border border-red-500/35 bg-red-500/8 text-xs text-red-300">{versionError}</div>
                        )}
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={handleSaveVersion} disabled={versionSubmitting} className="btn-primary py-2 px-5 text-xs">
                            {versionSubmitting ? 'SAVING...' : 'SAVE VERSION'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── LINKS ────────────────────────────────────── */}
                {modalTab === 'links' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-eg/15 bg-dark-200/40">
                      <ProjectLinksEditor links={formProjectLinks} onChange={setFormProjectLinks} />
                    </div>
                  </div>
                )}

                {/* ── SETTINGS ─────────────────────────────────── */}
                {modalTab === 'settings' && (
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl border border-eg/15 bg-dark-200/40 space-y-4">
                      <p className="font-mono-custom text-[9px] text-white/30 uppercase tracking-widest">Publish Settings</p>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div
                          onClick={() => setFormPublished(!formPublished)}
                          className={`w-10 h-5 rounded-full border-2 relative transition-colors flex-shrink-0 cursor-pointer ${formPublished ? 'bg-eg border-eg' : 'bg-dark-300 border-white/20'}`}
                        >
                          <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform ${formPublished ? 'translate-x-4 bg-dark' : 'translate-x-0.5 bg-white/30'}`} />
                        </div>
                        <div>
                          <span className="font-mono-custom text-xs text-white/80 group-hover:text-white transition-colors">
                            {formPublished ? 'Published' : 'Draft'}
                          </span>
                          <p className="font-mono-custom text-[9px] text-white/30 mt-0.5">
                            {formPublished ? 'Project is visible to the public.' : 'Project is hidden from the public.'}
                          </p>
                        </div>
                      </label>
                    </div>

                    {editingProject && (
                      <div className="p-5 rounded-xl border border-white/8 space-y-3">
                        <p className="font-mono-custom text-[9px] text-white/30 uppercase tracking-widest">Quick Preview</p>
                        <Link
                          to={`/projects/${editingProject.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 font-mono-custom text-xs text-eg/70 hover:text-eg transition-colors underline"
                        >
                          /projects/{editingProject.slug} ↗
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal footer — always visible */}
              <div className="px-6 py-4 border-t border-eg/10 flex items-center justify-between flex-shrink-0 sticky bottom-0 bg-dark-100/95 backdrop-blur-xl rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="font-mono-custom text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  CANCEL
                </button>
                <div className="flex items-center gap-3">
                  {submitting && submitStatusText && (
                    <span className="font-mono-custom text-[10px] text-eg/60 animate-pulse">{submitStatusText}</span>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary py-2 px-6 text-xs disabled:opacity-50"
                  >
                    {submitting ? 'SAVING...' : 'SAVE PROJECT'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete project confirm ───────────────────────────────── */}
      {deleteConfirmProject && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-red-500/35 p-6 max-w-sm w-full space-y-4">
            <div>
              <p className="font-mono-custom text-xs text-red-400 uppercase tracking-widest mb-2">Confirm Delete</p>
              <p className="font-sans text-sm text-white/80">
                Delete <strong className="text-white">{deleteConfirmProject.title}</strong>? This will permanently remove the project, all gallery media, and version records.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmProject(null)} className="font-mono-custom text-xs text-white/40 hover:text-white/70 px-3 py-1.5">CANCEL</button>
              <button
                onClick={handleDeleteProject}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 font-mono-custom text-xs transition-colors disabled:opacity-50"
              >
                {submitting ? 'DELETING...' : 'DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete version confirm ───────────────────────────────── */}
      {deletingVersion && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-red-500/35 p-6 max-w-sm w-full space-y-4">
            <div>
              <p className="font-mono-custom text-xs text-red-400 uppercase tracking-widest mb-2">Confirm Delete Version</p>
              <p className="font-sans text-sm text-white/80">
                Delete version <strong className="text-white">v{deletingVersion.version_number} — {deletingVersion.version_name}</strong>? This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingVersion(null)} className="font-mono-custom text-xs text-white/40 hover:text-white/70 px-3 py-1.5">CANCEL</button>
              <button
                onClick={handleDeleteVersion}
                disabled={versionSubmitting}
                className="px-4 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 font-mono-custom text-xs transition-colors disabled:opacity-50"
              >
                {versionSubmitting ? 'DELETING...' : 'DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorDashboard;
