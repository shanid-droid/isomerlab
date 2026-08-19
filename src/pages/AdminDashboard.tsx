import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Project, ProjectGalleryItem, UserProfile, ProjectLink } from '../lib/types';
import ControlCenterOverview from '../components/admin/ControlCenterOverview';
import ContactInbox from '../components/admin/ContactInbox';
import ActivityLogsPanel from '../components/admin/ActivityLogsPanel';
import { logAuthEvent } from '../lib/activityLog';
import ThumbnailPromptSection from '../components/ThumbnailPromptSection';
import { ProjectLinksEditor, formatValidUrl } from '../components/ProjectLinks';
import CreatorApplicationsPanel from '../components/admin/CreatorApplicationsPanel';
import SiteControlPanel from '../components/admin/SiteControlPanel';
import NotificationsPanel from '../components/admin/NotificationsPanel';
import { CommentsManagementPanel } from '../components/admin/CommentsManagementPanel';
import { LeaderboardControlPanel } from '../components/admin/LeaderboardControlPanel';
import { LeaderboardPublishingPanel } from '../components/admin/LeaderboardPublishingPanel';
import { OWNER_ID } from '../lib/constants';
import {
  formatRoleLabel,
  getRoleBadgeClasses,
  isCreatorRole,
  isNormalUser,
  normalizeUserRole,
  isAdminRole,
} from '../lib/roles';

export { OWNER_ID };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function openPublicProfileInNewTab(userId: string) {
  if (!UUID_REGEX.test(userId)) return;
  window.open(`/profile/${userId}`, '_blank', 'noopener,noreferrer');
}

/* ── Icon helpers ────────────────────────────────────────────── */
const IconOverview = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconProjects = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
  </svg>
);
const IconCreators = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
  </svg>
);
const IconUsers = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 10-16 0" strokeLinecap="round" />
  </svg>
);
const IconComments = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconNotifications = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconLeaderboard = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconActivity = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconMessages = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" />
    <polyline points="22,6 12,13 2,6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSiteControl = ({ active }: { active?: boolean }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-eg' : 'text-white/40 group-hover:text-white/70'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93l-1.41 1.41M4.93 19.07l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2" strokeLinecap="round" />
  </svg>
);
const IconMenu = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
  </svg>
);
const IconClose = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
  </svg>
);
const IconLogout = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ExternalLinkIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type AdminTab =
  | 'overview'
  | 'projects'
  | 'users'
  | 'inbox'
  | 'activity'
  | 'applications'
  | 'site-control'
  | 'notifications'
  | 'comments'
  | 'leaderboard';

/* ── Sidebar nav item ────────────────────────────────────────── */
interface NavItemProps {
  label: string;
  tab: AdminTab;
  active: boolean;
  badge?: number;
  icon: React.ReactNode;
  onClick: (tab: AdminTab) => void;
}

const NavItem: React.FC<NavItemProps> = ({ label, tab, active, badge, icon, onClick }) => (
  <button
    onClick={() => onClick(tab)}
    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 relative ${
      active
        ? 'bg-eg/10 border border-eg/30 text-eg shadow-[0_0_12px_rgba(0,255,136,0.06)]'
        : 'border border-transparent text-white/50 hover:text-white hover:bg-white/5'
    }`}
  >
    {active && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-eg rounded-full" />
    )}
    <span className="pl-1">{icon}</span>
    <span className={`font-mono-custom text-[11px] tracking-[0.15em] uppercase flex-1 ${active ? 'text-eg font-semibold' : ''}`}>
      {label}
    </span>
    {badge != null && badge > 0 && (
      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-eg text-dark text-[9px] font-bold flex items-center justify-center">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

/* ── Section label ───────────────────────────────────────────── */
const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-3 pt-5 pb-1.5">
    <span className="font-mono-custom text-[9px] tracking-[0.35em] text-white/20 uppercase">
      {label}
    </span>
  </div>
);

/* ── Panel heading ───────────────────────────────────────────── */
const PanelHeading: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title, subtitle, action,
}) => (
  <div className="flex items-center justify-between mb-8 pb-5 border-b border-white/5">
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
        {subtitle && (
          <span className="font-mono-custom text-[10px] tracking-[0.3em] text-eg/70 uppercase">
            {subtitle}
          </span>
        )}
      </div>
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
        {title}
      </h2>
    </div>
    {action}
  </div>
);

/* ── Main Dashboard ──────────────────────────────────────────── */
const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Auth State
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isOwner = currentUserId === OWNER_ID;

  // Navigation State
  const [activeTab, setActiveTab] = useState<AdminTab>('projects');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');

  // Users Management State
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersDbError, setUsersDbError] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [roleModalUser, setRoleModalUser] = useState<UserProfile | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [targetNewRole, setTargetNewRole] = useState<'user' | 'admin' | 'creator' | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [existingGallery, setExistingGallery] = useState<ProjectGalleryItem[]>([]);
  const [deletingGalleryIds, setDeletingGalleryIds] = useState<string[]>([]);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formComponents, setFormComponents] = useState('');
  const [formGithubUrl, setFormGithubUrl] = useState('');
  const [formProjectLinks, setFormProjectLinks] = useState<ProjectLink[]>([]);
  const [formPublished, setFormPublished] = useState(true);
  const [formThumbnailFile, setFormThumbnailFile] = useState<File | null>(null);
  const [formThumbnailPreview, setFormThumbnailPreview] = useState<string | null>(null);
  const [formGalleryFiles, setFormGalleryFiles] = useState<File[]>([]);
  const [formGalleryPreviews, setFormGalleryPreviews] = useState<string[]>([]);

  // Submitting / Action state
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── 1. Auth Check ────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function verifyAdminAuth(userId: string, emailStr?: string) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, full_name, avatar_url')
          .eq('id', userId)
          .maybeSingle();

        if (isMounted) {
          if (!error && profile?.role === 'admin') {
            setUserEmail(emailStr ?? 'Admin');
            setUserName(profile.full_name ?? emailStr ?? null);
            setUserAvatar(profile.avatar_url ?? null);
            setCurrentUserId(userId);
            setCheckingAuth(false);
          } else {
            navigate('/dashboard', { replace: true });
          }
        }
      } catch {
        if (isMounted) navigate('/dashboard', { replace: true });
      }
    }

    async function checkAuthSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (isMounted) navigate('/admin/login', { replace: true });
          return;
        }
        await verifyAdminAuth(session.user.id, session.user.email);
      } catch {
        if (isMounted) navigate('/admin/login', { replace: true });
      }
    }

    checkAuthSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isMounted) {
        if (!session?.user) {
          navigate('/admin/login', { replace: true });
        } else {
          await verifyAdminAuth(session.user.id, session.user.email);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // ── 2. Fetch Projects ────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setErrorMsg(null);
    try {
      let query = supabase.from('projects').select('*');
      if (currentUserId && currentUserId !== OWNER_ID) {
        query = query.eq('created_by', currentUserId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setProjects((data as Project[]) || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load projects.');
    } finally {
      setLoadingProjects(false);
    }
  }, [currentUserId]);

  // ── 2b. Fetch Users (Owner only) ─────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (currentUserId !== OWNER_ID) return;
    setLoadingUsers(true);
    setUsersDbError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setUsersDbError(error.message);
      } else {
        const rows = ((data as UserProfile[]) || []).map((u) => ({
          ...u,
          role: normalizeUserRole(u.role),
        }));
        setUsersList(rows);
      }
    } catch (err: any) {
      setUsersDbError(err.message || 'Failed to load user profiles');
    } finally {
      setLoadingUsers(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!checkingAuth && currentUserId) {
      fetchProjects();
      if (isOwner) fetchUsers();
    }
  }, [checkingAuth, isOwner, currentUserId, fetchProjects, fetchUsers]);

  const initialTabSet = useRef(false);

  // Tab protection for non-owner admins
  useEffect(() => {
    if (!isOwner && (activeTab === 'users' || activeTab === 'overview' || activeTab === 'inbox' || activeTab === 'activity' || activeTab === 'site-control')) {
      setActiveTab('projects');
    }
  }, [isOwner, activeTab]);

  // Default owner to overview on first load
  useEffect(() => {
    if (isOwner && !checkingAuth && !initialTabSet.current) {
      initialTabSet.current = true;
      setActiveTab('overview');
    }
  }, [isOwner, checkingAuth]);

  // Inbox unread count (owner only)
  useEffect(() => {
    if (!isOwner || checkingAuth) return;
    async function fetchUnreadCount() {
      const { data } = await supabase
        .from('contact_messages')
        .select('status')
        .eq('status', 'unread');
      setInboxUnreadCount(data?.length ?? 0);
    }
    fetchUnreadCount();
  }, [isOwner, checkingAuth, activeTab]);

  // Handle role change (Owner only)
  const handleConfirmRoleChange = async () => {
    if (!isOwner) {
      showToast('Access Denied: Only the system owner can modify user roles.', 'error');
      setRoleModalUser(null);
      setTargetNewRole(null);
      return;
    }
    if (!roleModalUser || !targetNewRole) return;
    if (roleModalUser.id === OWNER_ID) {
      showToast("Owner safeguard: The owner's admin role cannot be changed or removed.", 'error');
      setRoleModalUser(null);
      setTargetNewRole(null);
      return;
    }
    setUpdatingRole(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: targetNewRole, updated_at: new Date().toISOString() })
        .eq('id', roleModalUser.id);
      if (error) throw error;
      await fetchUsers();
      setRoleModalUser(null);
      setTargetNewRole(null);
      showToast('Role updated successfully');
    } catch (err: any) {
      showToast(`Could not update role: ${err.message}`, 'error');
    } finally {
      setUpdatingRole(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    await logAuthEvent('user_logout', { email: userEmail ?? undefined, method: 'admin_console' });
    setUserEmail(null);
    setCurrentUserId(null);
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true });
  };

  // Slug helper
  const generateSlug = (title: string) =>
    title.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormTitle(val);
    if (!editingProject) setFormSlug(generateSlug(val));
  };

  // Open Add Project Modal
  const handleOpenAddModal = () => {
    setEditingProject(null);
    setFormTitle(''); setFormSlug(''); setFormDescription('');
    setFormComponents(''); setFormGithubUrl(''); setFormProjectLinks([]);
    setFormPublished(true); setFormThumbnailFile(null); setFormThumbnailPreview(null);
    setFormGalleryFiles([]); setFormGalleryPreviews([]); setExistingGallery([]);
    setDeletingGalleryIds([]); setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Project Modal
  const handleOpenEditModal = async (project: Project) => {
    setEditingProject(project);
    setFormTitle(project.title);
    setFormSlug(project.slug);
    setFormDescription(project.description || '');
    if (Array.isArray(project.components)) {
      setFormComponents(project.components.join(', '));
    } else if (typeof project.components === 'string') {
      setFormComponents(project.components);
    } else {
      setFormComponents('');
    }
    setFormGithubUrl(project.github_url || '');
    if (project.project_links && project.project_links.length > 0) {
      setFormProjectLinks(project.project_links);
    } else if (project.github_url) {
      setFormProjectLinks([{ id: 'gh_init', type: 'github', title: 'GitHub Repository', url: project.github_url }]);
    } else {
      setFormProjectLinks([]);
    }
    setFormPublished(project.published !== false);
    setFormThumbnailFile(null); setFormThumbnailPreview(project.thumbnail_url || null);
    setFormGalleryFiles([]); setFormGalleryPreviews([]); setDeletingGalleryIds([]);
    setFormError(null);
    setIsModalOpen(true);
    try {
      const { data, error } = await supabase
        .from('project_gallery')
        .select('id, project_id, version_id, image_url, sort_order, created_at, media_type, mime_type, duration_seconds')
        .eq('project_id', project.id)
        .order('sort_order', { ascending: true });
      if (!error && data) setExistingGallery(data as ProjectGalleryItem[]);
    } catch { /* non-fatal */ }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormThumbnailFile(file);
      setFormThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFormGalleryFiles((prev) => [...prev, ...selectedFiles]);
      const newPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
      setFormGalleryPreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  const handleRemoveNewGalleryItem = (index: number) => {
    setFormGalleryFiles((prev) => prev.filter((_, i) => i !== index));
    setFormGalleryPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingGalleryItem = (galleryId: string) => {
    setDeletingGalleryIds((prev) => [...prev, galleryId]);
    setExistingGallery((prev) => prev.filter((item) => item.id !== galleryId));
  };

  const removeFileFromSupabaseStorage = async (publicUrl: string | null | undefined) => {
    if (!publicUrl) return;
    try {
      const bucketName = 'project-images';
      const marker = `${bucketName}/`;
      const idx = publicUrl.indexOf(marker);
      if (idx !== -1) {
        const filePath = publicUrl.substring(idx + marker.length);
        if (filePath) await supabase.storage.from(bucketName).remove([filePath]);
      }
    } catch { /* non-fatal */ }
  };

  const uploadFileToSupabase = async (file: File, folder: string): Promise<string> => {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanFileName}`;
    const { error: uploadError } = await supabase.storage
      .from('project-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
    const { data } = supabase.storage.from('project-images').getPublicUrl(path);
    return data.publicUrl;
  };

  // Form Submit (Add/Edit)
  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) { setFormError('Project title is required.'); return; }
    if (!formSlug.trim()) { setFormError('Project slug is required.'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const componentsArray = formComponents.split(',').map((c) => c.trim()).filter(Boolean);
      let thumbnailUrl = editingProject?.thumbnail_url || null;

      if (formThumbnailFile) {
        setSubmitStatusText('Uploading thumbnail...');
        const newThumb = await uploadFileToSupabase(formThumbnailFile, 'thumbnails');
        if (editingProject?.thumbnail_url) await removeFileFromSupabaseStorage(editingProject.thumbnail_url);
        thumbnailUrl = newThumb;
      }

      const cleanedLinks = formProjectLinks
        .filter((l) => l.url && l.url.trim() !== '')
        .map((l) => ({ ...l, url: formatValidUrl(l.url), title: l.title.trim() || l.type.toUpperCase() }));

      const ghLink = cleanedLinks.find((l) => l.type === 'github');
      const syncedGithubUrl = ghLink ? ghLink.url : (formGithubUrl.trim() || null);

      const projectPayload: any = {
        title: formTitle.trim(), slug: formSlug.trim(), description: formDescription.trim(),
        components: componentsArray, github_url: syncedGithubUrl,
        project_links: cleanedLinks, thumbnail_url: thumbnailUrl, published: formPublished,
      };

      let projectId = editingProject?.id;
      if (editingProject) {
        setSubmitStatusText('Updating project...');
        const { error: updateError } = await supabase.from('projects').update(projectPayload).eq('id', editingProject.id);
        if (updateError) throw updateError;
      } else {
        setSubmitStatusText('Creating project...');
        if (currentUserId) projectPayload.created_by = currentUserId;
        const { data: newProj, error: insertError } = await supabase.from('projects').insert([projectPayload]).select().single();
        if (insertError) throw insertError;
        projectId = newProj.id;
      }

      if (deletingGalleryIds.length > 0) {
        setSubmitStatusText('Removing gallery items...');
        const itemsToDelete = existingGallery.filter((item) => deletingGalleryIds.includes(item.id));
        for (const item of itemsToDelete) await removeFileFromSupabaseStorage(item.image_url);
        await supabase.from('project_gallery').delete().in('id', deletingGalleryIds);
      }

      if (formGalleryFiles.length > 0 && projectId) {
        setSubmitStatusText(`Uploading ${formGalleryFiles.length} gallery file(s)...`);
        const galleryInserts = [];
        let startOrder = existingGallery.length;
        for (let i = 0; i < formGalleryFiles.length; i++) {
          const file = formGalleryFiles[i];
          const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name);
          const mediaType = isVideo ? 'video' : 'image';
          let duration: number | null = null;
          if (isVideo) {
            try {
              const videoEl = document.createElement('video');
              videoEl.preload = 'metadata';
              const objUrl = URL.createObjectURL(file);
              videoEl.src = objUrl;
              await new Promise<void>((res) => {
                videoEl.onloadedmetadata = () => {
                  if (typeof videoEl.duration === 'number' && !isNaN(videoEl.duration) && videoEl.duration > 0) {
                    duration = Math.round(videoEl.duration * 100) / 100;
                  }
                  URL.revokeObjectURL(objUrl); res();
                };
                videoEl.onerror = () => { URL.revokeObjectURL(objUrl); res(); };
                setTimeout(() => { URL.revokeObjectURL(objUrl); res(); }, 3000);
              });
            } catch { duration = null; }
          }
          const uploadedUrl = await uploadFileToSupabase(file, 'gallery');
          galleryInserts.push({
            project_id: projectId, image_url: uploadedUrl, media_type: mediaType,
            mime_type: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
            duration_seconds: duration, sort_order: startOrder + i,
          });
        }
        const { error: galleryError } = await supabase.from('project_gallery').insert(galleryInserts);
        if (galleryError) console.warn('Gallery insert warning:', galleryError.message);
      }

      setIsModalOpen(false);
      await fetchProjects();
      showToast(editingProject ? 'Project updated successfully' : 'Project created successfully');
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the project.');
    } finally {
      setSubmitting(false);
      setSubmitStatusText('');
    }
  };

  // Toggle Publish
  const handleTogglePublish = async (project: Project) => {
    const newStatus = !project.published;
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, published: newStatus } : p));
    try {
      const { error } = await supabase.from('projects').update({ published: newStatus }).eq('id', project.id);
      if (error) { fetchProjects(); throw error; }
      showToast(newStatus ? 'Project published' : 'Project set to draft');
    } catch (err: any) {
      showToast(`Could not toggle status: ${err.message}`, 'error');
    }
  };

  // Delete Project
  const handleDeleteProject = async () => {
    if (!deleteConfirmProject) return;
    setSubmitting(true);
    try {
      const { data: galleryItems } = await supabase.from('project_gallery').select('*').eq('project_id', deleteConfirmProject.id);
      if (galleryItems && galleryItems.length > 0) {
        for (const item of galleryItems) await removeFileFromSupabaseStorage(item.image_url);
      }
      await supabase.from('project_gallery').delete().eq('project_id', deleteConfirmProject.id);
      if (deleteConfirmProject.thumbnail_url) await removeFileFromSupabaseStorage(deleteConfirmProject.thumbnail_url);
      const { error } = await supabase.from('projects').delete().eq('id', deleteConfirmProject.id);
      if (error) throw error;
      setDeleteConfirmProject(null);
      await fetchProjects();
      showToast('Project deleted');
    } catch (err: any) {
      showToast(`Failed to delete: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterStatus === 'published') return p.published === true;
    if (filterStatus === 'draft') return p.published !== true;
    return true;
  });

  const totalCount = projects.length;
  const publishedCount = projects.filter((p) => p.published === true).length;
  const draftCount = totalCount - publishedCount;

  const filteredUsers = usersList.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    const nameMatch = u.full_name ? u.full_name.toLowerCase().includes(q) : false;
    const emailMatch = u.email ? u.email.toLowerCase().includes(q) : false;
    return nameMatch || emailMatch;
  });

  // Navigate handler (used in overview panel)
  const handleNavigate = useCallback((tab: string) => {
    setActiveTab(tab as AdminTab);
    setSidebarOpen(false);
  }, []);

  // ── Loading Screen ───────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-dark bg-circuit flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
          <span className="font-mono-custom text-xs tracking-widest text-eg/70 uppercase">
            VERIFYING CREDENTIALS...
          </span>
        </div>
      </div>
    );
  }

  // ── Identity initials ────────────────────────────────────────
  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail?.slice(0, 2).toUpperCase() ?? 'AD';

  const roleLabel = isOwner ? 'OWNER' : 'ADMIN';

  // ── Sidebar content ──────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-white/5">
        <Link to="/" className="block group" onClick={() => setSidebarOpen(false)}>
          <div className="font-display font-black text-base tracking-widest text-white leading-none group-hover:text-eg transition-colors">
            ISOM<span className="text-eg">≡</span>R
          </div>
          <div className="font-mono-custom text-[9px] tracking-[0.3em] text-white/30 uppercase mt-1 leading-tight">
            CONTROL<br />CENTER
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {/* Overview (owner only) */}
        {isOwner && (
          <>
            <NavItem
              label="Overview"
              tab="overview"
              active={activeTab === 'overview'}
              icon={<IconOverview active={activeTab === 'overview'} />}
              onClick={handleNavigate as any}
            />
            <div className="h-2" />
          </>
        )}

        {/* CONTENT */}
        <SectionLabel label="Content" />
        <NavItem
          label="Projects"
          tab="projects"
          active={activeTab === 'projects'}
          icon={<IconProjects active={activeTab === 'projects'} />}
          badge={draftCount > 0 ? draftCount : undefined}
          onClick={handleNavigate as any}
        />

        {/* PEOPLE */}
        <SectionLabel label="People" />
        <NavItem
          label="Creators"
          tab="applications"
          active={activeTab === 'applications'}
          icon={<IconCreators active={activeTab === 'applications'} />}
          onClick={handleNavigate as any}
        />
        {isOwner && (
          <NavItem
            label="Users"
            tab="users"
            active={activeTab === 'users'}
            icon={<IconUsers active={activeTab === 'users'} />}
            badge={usersList.length > 0 ? usersList.length : undefined}
            onClick={handleNavigate as any}
          />
        )}

        {/* COMMUNITY */}
        <SectionLabel label="Community" />
        <NavItem
          label="Comments"
          tab="comments"
          active={activeTab === 'comments'}
          icon={<IconComments active={activeTab === 'comments'} />}
          onClick={handleNavigate as any}
        />
        <NavItem
          label="Notifications"
          tab="notifications"
          active={activeTab === 'notifications'}
          icon={<IconNotifications active={activeTab === 'notifications'} />}
          onClick={handleNavigate as any}
        />

        {/* RANKINGS */}
        <SectionLabel label="Rankings" />
        <NavItem
          label="Leaderboard"
          tab="leaderboard"
          active={activeTab === 'leaderboard'}
          icon={<IconLeaderboard active={activeTab === 'leaderboard'} />}
          onClick={handleNavigate as any}
        />

        {/* SYSTEM (owner only) */}
        {isOwner && (
          <>
            <SectionLabel label="System" />
            <NavItem
              label="Activity"
              tab="activity"
              active={activeTab === 'activity'}
              icon={<IconActivity active={activeTab === 'activity'} />}
              onClick={handleNavigate as any}
            />
            <NavItem
              label="Messages"
              tab="inbox"
              active={activeTab === 'inbox'}
              badge={inboxUnreadCount > 0 ? inboxUnreadCount : undefined}
              icon={<IconMessages active={activeTab === 'inbox'} />}
              onClick={handleNavigate as any}
            />
            <NavItem
              label="Site Control"
              tab="site-control"
              active={activeTab === 'site-control'}
              icon={<IconSiteControl active={activeTab === 'site-control'} />}
              onClick={handleNavigate as any}
            />
          </>
        )}
      </nav>

      {/* Identity Footer */}
      <div className="border-t border-white/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName || 'Admin'}
              className="w-9 h-9 rounded-xl object-cover border border-eg/30 flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-eg/10 border border-eg/30 flex items-center justify-center flex-shrink-0">
              <span className="font-display text-xs font-bold text-eg">{initials}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono-custom text-[10px] text-eg font-semibold tracking-widest uppercase">
                {roleLabel}
              </span>
            </div>
            <p className="font-mono-custom text-[11px] text-white/70 truncate">
              {userName?.split(' ')[0] || userEmail?.split('@')[0] || 'Admin'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
            <span className="font-mono-custom text-[9px] text-white/30 tracking-wider uppercase">
              System Online
            </span>
          </div>
          <button
            onClick={handleLogout}
            id="admin-logout-btn"
            className="flex items-center gap-1.5 font-mono-custom text-[10px] text-white/40 hover:text-red-400 transition-colors px-2 py-1 rounded"
          >
            <IconLogout />
            <span>LOGOUT</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Panel titles
  const panelTitles: Record<AdminTab, { title: string; subtitle: string }> = {
    overview: { title: 'OVERVIEW', subtitle: 'CONTROL CENTER' },
    projects: { title: 'PROJECTS', subtitle: 'CONTENT MANAGEMENT' },
    users: { title: 'USERS', subtitle: 'PEOPLE MANAGEMENT' },
    inbox: { title: 'MESSAGES', subtitle: 'SYSTEM INBOX' },
    activity: { title: 'ACTIVITY LOG', subtitle: 'SYSTEM' },
    applications: { title: 'CREATOR APPLICATIONS', subtitle: 'PEOPLE MANAGEMENT' },
    'site-control': { title: 'SITE CONTROL', subtitle: 'SYSTEM SETTINGS' },
    notifications: { title: 'NOTIFICATIONS', subtitle: 'COMMUNITY' },
    comments: { title: 'COMMENTS', subtitle: 'COMMUNITY MODERATION' },
    leaderboard: { title: 'LEADERBOARD', subtitle: 'RANKINGS' },
  };

  const currentPanel = panelTitles[activeTab];

  // ── Main Render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark text-white flex overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Desktop Sidebar ─── */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 bg-dark-100/50 border-r border-white/5 h-full">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ─── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 bg-dark-100 border-r border-white/5 flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main Content Area ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="border-b border-white/5 bg-dark-100/30 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-1.5 text-white/50 hover:text-white transition-colors"
                aria-label="Open menu"
              >
                <IconMenu />
              </button>
              {/* Breadcrumb */}
              <div>
                <span className="font-mono-custom text-[9px] tracking-[0.3em] text-white/25 uppercase block">
                  {currentPanel.subtitle}
                </span>
                <span className="font-mono-custom text-[11px] tracking-[0.15em] text-white/70 uppercase">
                  {currentPanel.title}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="hidden sm:flex items-center gap-1.5 font-mono-custom text-[10px] text-white/40 hover:text-eg transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-eg/30"
              >
                PUBLIC SITE
                <ExternalLinkIcon className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-5 py-8 sm:px-8 sm:py-10">

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && isOwner && (
              <ControlCenterOverview
                isOwner={isOwner}
                userName={userName}
                onNavigate={handleNavigate}
              />
            )}

            {/* ── INBOX (Owner only) ── */}
            {activeTab === 'inbox' && isOwner && (
              <div>
                <PanelHeading title="MESSAGES" subtitle="SYSTEM INBOX" />
                <ContactInbox onCountsChange={(c) => setInboxUnreadCount(c.unread)} />
              </div>
            )}

            {/* ── ACTIVITY (Owner only) ── */}
            {activeTab === 'activity' && isOwner && (
              <div>
                <PanelHeading title="ACTIVITY LOG" subtitle="SYSTEM" />
                <ActivityLogsPanel />
              </div>
            )}

            {/* ── CREATOR APPLICATIONS ── */}
            {activeTab === 'applications' && (
              <div>
                <PanelHeading title="CREATOR APPLICATIONS" subtitle="PEOPLE" />
                <CreatorApplicationsPanel isOwner={isOwner} />
              </div>
            )}

            {/* ── SITE CONTROL (Owner only) ── */}
            {activeTab === 'site-control' && isOwner && (
              <div>
                <PanelHeading title="SITE CONTROL" subtitle="SYSTEM SETTINGS" />
                <SiteControlPanel />
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === 'notifications' && (
              <div>
                <PanelHeading title="NOTIFICATIONS" subtitle="COMMUNITY" />
                <NotificationsPanel />
              </div>
            )}

            {/* ── COMMENTS ── */}
            {activeTab === 'comments' && (
              <div>
                <PanelHeading title="COMMENTS MODERATION" subtitle="COMMUNITY" />
                <CommentsManagementPanel />
              </div>
            )}

            {/* ── LEADERBOARD ── */}
            {activeTab === 'leaderboard' && (
              <div>
                <PanelHeading title="LEADERBOARD" subtitle="RANKINGS" />
                {isOwner ? <LeaderboardControlPanel /> : <LeaderboardPublishingPanel />}
              </div>
            )}

            {/* ── PROJECTS ── */}
            {activeTab === 'projects' && (
              <div className="space-y-6">
                <PanelHeading
                  title="PROJECTS"
                  subtitle="CONTENT"
                  action={
                    <button
                      onClick={handleOpenAddModal}
                      id="admin-add-project-btn"
                      className="btn-primary py-2.5 px-5 text-xs flex items-center gap-2"
                    >
                      <span className="text-base leading-none">+</span>
                      NEW PROJECT
                    </button>
                  }
                />

                {/* Metric bar */}
                <div className="flex items-center gap-8 py-4 border-b border-white/5">
                  <div>
                    <span className="font-display font-black text-2xl text-white">{totalCount}</span>
                    <span className="font-mono-custom text-[10px] text-white/30 tracking-widest uppercase block mt-0.5">Total</span>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <span className="font-display font-black text-2xl text-eg">{publishedCount}</span>
                    <span className="font-mono-custom text-[10px] text-white/30 tracking-widest uppercase block mt-0.5">Published</span>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <span className="font-display font-black text-2xl text-amber-400">{draftCount}</span>
                    <span className="font-mono-custom text-[10px] text-white/30 tracking-widest uppercase block mt-0.5">Drafts</span>
                  </div>
                </div>

                {/* Search + filter */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search projects by title, slug or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-dark-200/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/25 font-mono-custom focus:outline-none focus:border-eg/50 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-dark-200/50 p-1 rounded-xl border border-white/5">
                    {(['all', 'published', 'draft'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilterStatus(f)}
                        className={`px-3 py-1.5 rounded-lg font-mono-custom text-[10px] uppercase tracking-wider transition-all ${
                          filterStatus === f
                            ? 'bg-eg/15 text-eg font-semibold border border-eg/30'
                            : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {f === 'all' ? `All (${totalCount})` : f === 'published' ? `Live (${publishedCount})` : `Draft (${draftCount})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {errorMsg && (
                  <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center justify-between">
                    <p className="font-mono-custom text-xs text-red-300">{errorMsg}</p>
                    <button onClick={fetchProjects} className="font-mono-custom text-xs text-eg hover:underline">RETRY</button>
                  </div>
                )}

                {/* Project table */}
                <div className="rounded-2xl border border-white/5 overflow-hidden">
                  {loadingProjects ? (
                    <div className="py-20 flex flex-col items-center gap-3">
                      <div className="w-7 h-7 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
                      <span className="font-mono-custom text-[10px] text-white/30 uppercase tracking-widest">
                        LOADING PROJECT CATALOG...
                      </span>
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="py-20 text-center space-y-4">
                      <p className="font-mono-custom text-xs text-white/30 uppercase tracking-widest">
                        {searchQuery ? 'No matching projects found' : 'No projects yet'}
                      </p>
                      {!searchQuery && (
                        <button onClick={handleOpenAddModal} className="btn-primary text-xs py-2 px-5">
                          + CREATE FIRST PROJECT
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-dark-200/30 font-mono-custom text-[9px] text-white/30 uppercase tracking-[0.2em]">
                            <th className="py-3.5 px-5">PROJECT</th>
                            <th className="py-3.5 px-4">STATUS</th>
                            <th className="py-3.5 px-4 hidden md:table-cell">STACK</th>
                            <th className="py-3.5 px-4 hidden lg:table-cell">LINKS</th>
                            <th className="py-3.5 px-5 text-right">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] text-xs">
                          {filteredProjects.map((project) => {
                            const isPublished = project.published === true;
                            let comps: string[] = [];
                            if (Array.isArray(project.components)) comps = project.components;
                            else if (typeof project.components === 'string') {
                              comps = project.components.split(',').map((s) => s.trim()).filter(Boolean);
                            }
                            return (
                              <tr key={project.id} className="hover:bg-white/[0.02] transition-colors group">
                                {/* Thumbnail + Title */}
                                <td className="py-3.5 px-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-10 rounded-lg bg-dark-300 overflow-hidden flex-shrink-0 border border-white/10">
                                      {project.thumbnail_url ? (
                                        <img src={project.thumbnail_url} alt={project.title} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center font-display text-[9px] text-eg/30 bg-circuit">N/A</div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <Link
                                        to={`/projects/${project.slug}`}
                                        target="_blank"
                                        className="font-display font-semibold text-white/90 group-hover:text-eg transition-colors truncate block text-sm"
                                      >
                                        {project.title}
                                      </Link>
                                      <p className="font-mono-custom text-[9px] text-white/30 truncate">/{project.slug}</p>
                                    </div>
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="py-3.5 px-4">
                                  <button
                                    onClick={() => handleTogglePublish(project)}
                                    title="Click to toggle"
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono-custom text-[9px] tracking-wider uppercase border transition-all ${
                                      isPublished
                                        ? 'bg-eg/10 text-eg border-eg/30 hover:bg-eg/20'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${isPublished ? 'bg-eg animate-pulse' : 'bg-amber-400'}`} />
                                    {isPublished ? 'LIVE' : 'DRAFT'}
                                  </button>
                                </td>

                                {/* Stack */}
                                <td className="py-3.5 px-4 hidden md:table-cell">
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {comps.length > 0 ? (
                                      comps.slice(0, 3).map((tech, i) => (
                                        <span key={i} className="font-mono-custom text-[9px] px-2 py-0.5 rounded bg-dark-200 border border-white/10 text-white/50">
                                          {tech}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-white/20 italic">—</span>
                                    )}
                                    {comps.length > 3 && (
                                      <span className="font-mono-custom text-[9px] px-1.5 py-0.5 rounded bg-dark-200 text-white/30">+{comps.length - 3}</span>
                                    )}
                                  </div>
                                </td>

                                {/* Links */}
                                <td className="py-3.5 px-4 hidden lg:table-cell">
                                  {project.project_links && project.project_links.length > 0 ? (
                                    <span className="font-mono-custom text-[9px] text-eg bg-eg/10 border border-eg/20 px-2 py-0.5 rounded">
                                      {project.project_links.length} link{project.project_links.length !== 1 ? 's' : ''}
                                    </span>
                                  ) : (
                                    <span className="text-white/20 text-[11px]">—</span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="py-3.5 px-5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditModal(project)}
                                      className="px-3 py-1.5 rounded-lg border border-eg/20 bg-eg/5 text-eg hover:bg-eg/15 font-mono-custom text-[9px] tracking-wider transition-colors"
                                    >
                                      EDIT
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmProject(project)}
                                      className="px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 font-mono-custom text-[9px] tracking-wider transition-colors"
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
                  )}
                </div>
              </div>
            )}

            {/* ── USERS (Owner only) ── */}
            {activeTab === 'users' && isOwner && (
              <div className="space-y-6">
                <PanelHeading title="USERS" subtitle="PEOPLE MANAGEMENT" />

                {/* Metric bar */}
                <div className="flex items-center gap-8 py-4 border-b border-white/5 flex-wrap">
                  {[
                    { label: 'Total', value: usersList.length, color: 'text-white' },
                    { label: 'Admins', value: usersList.filter((u) => isAdminRole(u.role)).length, color: 'text-eg' },
                    { label: 'Creators', value: usersList.filter((u) => isCreatorRole(u.role) && !isAdminRole(u.role)).length, color: 'text-purple-400' },
                    { label: 'Members', value: usersList.filter((u) => isNormalUser(u.role)).length, color: 'text-white/50' },
                  ].map((m, i, arr) => (
                    <React.Fragment key={m.label}>
                      <div>
                        <span className={`font-display font-black text-2xl ${m.color}`}>{m.value}</span>
                        <span className="font-mono-custom text-[10px] text-white/30 tracking-widest uppercase block mt-0.5">{m.label}</span>
                      </div>
                      {i < arr.length - 1 && <div className="w-px h-8 bg-white/10" />}
                    </React.Fragment>
                  ))}
                </div>

                {/* Search */}
                <div className="relative max-w-sm">
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full bg-dark-200/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/25 font-mono-custom focus:outline-none focus:border-eg/50 transition-colors"
                  />
                </div>

                {usersDbError && (
                  <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 font-mono-custom text-xs text-amber-300">
                    ⚠ {usersDbError}
                  </div>
                )}

                {/* Users table */}
                <div className="rounded-2xl border border-white/5 overflow-hidden">
                  {loadingUsers ? (
                    <div className="py-16 flex flex-col items-center gap-3">
                      <div className="w-7 h-7 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
                      <span className="font-mono-custom text-[10px] text-white/30 uppercase">LOADING...</span>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-16 text-center">
                      <span className="font-mono-custom text-xs text-white/30 uppercase">NO USERS FOUND</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-dark-200/30 font-mono-custom text-[9px] text-white/30 uppercase tracking-[0.2em]">
                            <th className="py-3.5 px-5">USER</th>
                            <th className="py-3.5 px-4">EMAIL</th>
                            <th className="py-3.5 px-4 hidden sm:table-cell">JOINED</th>
                            <th className="py-3.5 px-4">ROLE</th>
                            <th className="py-3.5 px-5 text-right">ACTION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] font-mono-custom text-xs">
                          {filteredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedUser(u)}>
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} alt={u.full_name || 'User'} className="w-8 h-8 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-dark-300 border border-white/10 flex items-center justify-center text-eg font-bold text-xs flex-shrink-0">
                                      {u.full_name ? u.full_name.substring(0, 2).toUpperCase() : 'US'}
                                    </div>
                                  )}
                                  <span className="text-white/80 group-hover:text-eg transition-colors font-medium truncate">
                                    {u.full_name || 'Anonymous'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-white/40 truncate max-w-[160px]">{u.email}</td>
                              <td className="py-3.5 px-4 text-white/30 hidden sm:table-cell">
                                {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-block px-2.5 py-1 rounded text-[9px] uppercase tracking-wider font-semibold border ${getRoleBadgeClasses(u.role)}`}>
                                  {formatRoleLabel(u.role)}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  <button
                                    onClick={() => openPublicProfileInNewTab(u.id)}
                                    className="px-2.5 py-1.5 rounded border border-white/10 text-white/40 hover:text-eg hover:border-eg/30 transition-colors text-[9px] tracking-wider flex items-center gap-1"
                                  >
                                    <ExternalLinkIcon className="w-3 h-3" />
                                    PROFILE
                                  </button>
                                  {u.id === OWNER_ID ? (
                                    <span className="px-2.5 py-1.5 font-mono-custom text-[9px] text-white/20">OWNER</span>
                                  ) : isNormalUser(u.role) ? (
                                    <button onClick={() => { setRoleModalUser(u); setTargetNewRole('admin'); }}
                                      className="px-2.5 py-1.5 rounded border border-eg/20 text-eg hover:bg-eg/10 transition-colors text-[9px] tracking-wider">
                                      PROMOTE
                                    </button>
                                  ) : isCreatorRole(u.role) && !isAdminRole(u.role) ? (
                                    <button onClick={() => { setRoleModalUser(u); setTargetNewRole('user'); }}
                                      className="px-2.5 py-1.5 rounded border border-purple-500/20 text-purple-400 hover:bg-purple-500/10 transition-colors text-[9px] tracking-wider">
                                      REVOKE
                                    </button>
                                  ) : u.role === 'admin' ? (
                                    <button onClick={() => { setRoleModalUser(u); setTargetNewRole('user'); }}
                                      className="px-2.5 py-1.5 rounded border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 transition-colors text-[9px] tracking-wider">
                                      DEMOTE
                                    </button>
                                  ) : null}
                                </div>
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

          </div>
        </main>
      </div>

      {/* ── TOAST NOTIFICATION ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl border backdrop-blur-sm shadow-2xl font-mono-custom text-xs pointer-events-none transition-all ${
          toast.type === 'success'
            ? 'border-eg/30 bg-dark-200/95 text-eg'
            : 'border-red-500/30 bg-dark-200/95 text-red-400'
        }`}>
          {toast.type === 'success' ? '✓' : '×'} {toast.message}
        </div>
      )}

      {/* ── ADD/EDIT PROJECT MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-100 rounded-2xl border border-eg/20 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl my-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
              <div>
                <span className="font-mono-custom text-[10px] text-eg tracking-widest uppercase">
                  {editingProject ? 'EDIT PROJECT' : 'NEW PROJECT'}
                </span>
                <h2 className="font-display text-lg font-bold text-white tracking-wider mt-0.5">
                  {editingProject ? editingProject.title : 'Create Project Record'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} disabled={submitting}
                className="font-mono-custom text-white/30 hover:text-white p-2 transition-colors">
                <IconClose />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitProject} className="p-6 overflow-y-auto space-y-5 flex-1">
              {formError && (
                <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 font-mono-custom text-xs text-red-300">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-mono-custom text-[10px] text-white/40 uppercase tracking-widest">
                    PROJECT TITLE *
                  </label>
                  <input type="text" required value={formTitle} onChange={handleTitleChange}
                    placeholder="e.g. Quantum Neural Mesh"
                    className="w-full bg-dark-200/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg/50 font-mono-custom transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-mono-custom text-[10px] text-white/40 uppercase tracking-widest">
                    SLUG (URL KEY) *
                  </label>
                  <input type="text" required value={formSlug} onChange={(e) => setFormSlug(generateSlug(e.target.value))}
                    placeholder="quantum-neural-mesh"
                    className="w-full bg-dark-200/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg/50 font-mono-custom transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono-custom text-[10px] text-white/40 uppercase tracking-widest">DESCRIPTION</label>
                <textarea rows={4} value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detailed summary of architecture, goals, and technical specs..."
                  className="w-full bg-dark-200/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg/50 font-sans leading-relaxed transition-colors" />
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono-custom text-[10px] text-white/40 uppercase tracking-widest">
                  TECH STACK (COMMA-SEPARATED)
                </label>
                <input type="text" value={formComponents} onChange={(e) => setFormComponents(e.target.value)}
                  placeholder="React, Supabase, TypeScript, Python"
                  className="w-full bg-dark-200/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg/50 font-mono-custom transition-colors" />
              </div>

              <div className="p-4 rounded-xl border border-white/5 bg-dark-200/30 space-y-3">
                <ProjectLinksEditor links={formProjectLinks} onChange={setFormProjectLinks} />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-dark-200/30">
                <input type="checkbox" id="form-published-check" checked={formPublished}
                  onChange={(e) => setFormPublished(e.target.checked)}
                  className="w-4 h-4 rounded border-eg/40 text-eg focus:ring-eg bg-dark" />
                <label htmlFor="form-published-check" className="font-mono-custom text-xs text-white/60 cursor-pointer select-none">
                  PUBLISH IMMEDIATELY — {formPublished ? 'Visible on public website' : 'Saved as draft'}
                </label>
              </div>

              {/* Thumbnail */}
              <div className="space-y-2">
                <label className="block font-mono-custom text-[10px] text-white/40 uppercase tracking-widest">THUMBNAIL IMAGE</label>
                <div className="flex items-center gap-4">
                  {formThumbnailPreview && (
                    <div className="w-24 h-16 rounded-lg bg-dark-300 border border-white/10 overflow-hidden relative flex-shrink-0">
                      <img src={formThumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => { setFormThumbnailFile(null); setFormThumbnailPreview(null); }}
                        className="absolute top-1 right-1 bg-black/70 text-white hover:text-red-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
                        ✕
                      </button>
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer border border-dashed border-white/15 hover:border-eg/40 rounded-xl p-3 text-center bg-dark-200/30 hover:bg-eg/5 transition-all">
                    <span className="font-mono-custom text-xs text-white/50 block">
                      {formThumbnailPreview ? 'Change Thumbnail' : 'Select Thumbnail File'}
                    </span>
                    <span className="font-sans text-[10px] text-white/25 block mt-0.5">PNG, JPG, WEBP or GIF</span>
                    <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                  </label>
                </div>
                <ThumbnailPromptSection
                  projectName={formTitle}
                  projectDescription={formDescription}
                  hasProductImage={!!(formThumbnailFile || formThumbnailPreview)}
                />
              </div>

              {/* Gallery */}
              <div className="space-y-3">
                <label className="block font-mono-custom text-[10px] text-white/40 uppercase tracking-widest">
                  GALLERY MEDIA (IMAGES & VIDEOS)
                </label>
                {existingGallery.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-mono-custom text-[10px] text-white/30 uppercase">Existing:</span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {existingGallery.map((item) => {
                        const isVid = item.media_type === 'video' || (item.mime_type && item.mime_type.startsWith('video/'));
                        return (
                          <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-white/10 bg-dark-400 group flex items-center justify-center">
                            {isVid ? (
                              <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-black/60">
                                <span className="font-mono-custom text-[9px] text-eg font-bold">▶ VIDEO</span>
                              </div>
                            ) : (
                              <img src={item.image_url} alt="Gallery" className="w-full h-full object-cover" />
                            )}
                            <button type="button" onClick={() => handleRemoveExistingGalleryItem(item.id)}
                              className="absolute inset-0 bg-red-950/80 text-red-300 font-mono-custom text-[9px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              REMOVE
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {formGalleryPreviews.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-mono-custom text-[10px] text-eg uppercase">New files:</span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {formGalleryPreviews.map((url, i) => {
                        const file = formGalleryFiles[i];
                        const isVid = file && (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name));
                        return (
                          <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-eg/30 bg-dark-400 group flex items-center justify-center">
                            {isVid ? (
                              <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-black/60">
                                <span className="font-mono-custom text-[9px] text-eg font-bold">▶ VIDEO</span>
                              </div>
                            ) : (
                              <img src={url} alt="New" className="w-full h-full object-cover" />
                            )}
                            <button type="button" onClick={() => handleRemoveNewGalleryItem(i)}
                              className="absolute top-1 right-1 bg-black/80 text-white hover:text-red-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <label className="cursor-pointer border border-dashed border-white/15 hover:border-eg/40 rounded-xl p-4 text-center bg-dark-200/30 hover:bg-eg/5 transition-all block">
                  <span className="font-mono-custom text-xs text-white/50 block">+ Add Gallery Media</span>
                  <span className="font-sans text-[10px] text-white/25 block mt-0.5">Images (PNG, JPG, WEBP) or Videos (MP4, WEBM, MOV)</span>
                  <input type="file" multiple accept="image/*,video/*" onChange={handleGalleryChange} className="hidden" />
                </label>
              </div>

              {/* Submit */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={submitting}
                  className="px-4 py-2 rounded-lg font-mono-custom text-xs text-white/40 hover:text-white transition-colors">
                  CANCEL
                </button>
                <button type="submit" disabled={submitting} className="btn-primary py-2.5 px-6 text-xs flex items-center gap-2">
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-dark border-t-transparent animate-spin" />
                      <span>{submitStatusText || 'SAVING...'}</span>
                    </>
                  ) : (
                    <span>{editingProject ? 'SAVE CHANGES' : 'CREATE PROJECT'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION ── */}
      {deleteConfirmProject && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-dark-100 rounded-2xl border border-red-500/30 p-7 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center justify-center flex-shrink-0 text-red-400 font-bold">!</div>
              <div>
                <h3 className="font-display text-base font-bold text-white tracking-wider">DELETE PROJECT?</h3>
                <p className="font-mono-custom text-[10px] text-red-400 uppercase tracking-wider">IRREVERSIBLE ACTION</p>
              </div>
            </div>
            <p className="font-sans text-sm text-white/60 leading-relaxed">
              This will permanently remove <span className="font-semibold text-white">{deleteConfirmProject.title}</span> and all associated gallery media, versions, and data.
            </p>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <ul className="font-mono-custom text-[10px] text-red-300 space-y-1">
                <li>• Project record</li>
                <li>• All gallery media (storage)</li>
                <li>• Version history</li>
              </ul>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={() => setDeleteConfirmProject(null)} disabled={submitting}
                className="px-4 py-2 rounded-lg font-mono-custom text-xs text-white/50 hover:text-white transition-colors">
                CANCEL
              </button>
              <button onClick={handleDeleteProject} disabled={submitting}
                className="px-5 py-2.5 rounded-lg border border-red-500/50 bg-red-500/15 hover:bg-red-500/25 text-red-300 font-mono-custom text-xs tracking-wider transition-all flex items-center gap-2">
                {submitting ? (
                  <><div className="w-3 h-3 rounded-full border border-red-400 border-t-transparent animate-spin" /><span>DELETING...</span></>
                ) : 'DELETE PROJECT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── USER DETAILS MODAL ── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-dark-100 rounded-2xl border border-eg/20 p-6 max-w-lg w-full shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t border-l border-eg/40" />
            <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t border-r border-eg/40" />
            <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b border-l border-eg/40" />
            <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b border-r border-eg/40" />

            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="font-display text-base font-bold text-white tracking-wider">USER RECORD</h3>
              <button onClick={() => setSelectedUser(null)} className="text-white/30 hover:text-white transition-colors">
                <IconClose />
              </button>
            </div>

            <div className="flex items-center gap-4 bg-dark-200/40 p-4 rounded-xl border border-white/5">
              {selectedUser.avatar_url ? (
                <img src={selectedUser.avatar_url} alt={selectedUser.full_name || 'User'}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-eg/30 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-dark-300 border-2 border-eg/30 flex items-center justify-center text-eg font-display font-bold text-lg flex-shrink-0">
                  {selectedUser.full_name ? selectedUser.full_name.substring(0, 2).toUpperCase() : 'US'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-display text-base font-bold text-white truncate">
                  {selectedUser.full_name || 'Anonymous'}
                </h4>
                <p className="font-mono-custom text-xs text-white/40 truncate mt-0.5">{selectedUser.email}</p>
                <span className={`inline-block mt-2 px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${getRoleBadgeClasses(selectedUser.role)}`}>
                  {formatRoleLabel(selectedUser.role)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono-custom text-xs">
              {[
                { label: 'USER ID', value: selectedUser.id, mono: true },
                { label: 'JOINED', value: selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A', mono: false },
              ].map((f) => (
                <div key={f.label} className="bg-dark-200/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <p className="text-[9px] tracking-widest text-white/25 uppercase">{f.label}</p>
                  <p className={`text-[10px] text-white/70 ${f.mono ? 'font-mono select-all truncate' : ''}`}>{f.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5 flex-wrap">
              <button onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-lg font-mono-custom text-xs text-white/40 hover:text-white transition-colors">
                CLOSE
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => openPublicProfileInNewTab(selectedUser.id)}
                  className="px-3 py-1.5 rounded-lg border border-eg/30 bg-eg/10 text-eg hover:bg-eg/20 font-mono-custom text-[10px] tracking-wider transition-colors flex items-center gap-1.5">
                  <ExternalLinkIcon className="w-3 h-3" />
                  PUBLIC PROFILE
                </button>
                {selectedUser.id !== OWNER_ID && isNormalUser(selectedUser.role) ? (
                  <button onClick={() => { const u = selectedUser; setSelectedUser(null); setRoleModalUser(u); setTargetNewRole('admin'); }}
                    className="px-3 py-1.5 rounded-lg border border-eg/30 bg-eg/10 text-eg hover:bg-eg/20 font-mono-custom text-[10px] tracking-wider transition-colors">
                    PROMOTE TO ADMIN
                  </button>
                ) : selectedUser.id !== OWNER_ID && isCreatorRole(selectedUser.role) && !isAdminRole(selectedUser.role) ? (
                  <button onClick={() => { const u = selectedUser; setSelectedUser(null); setRoleModalUser(u); setTargetNewRole('user'); }}
                    className="px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 font-mono-custom text-[10px] tracking-wider transition-colors">
                    REVOKE CREATOR
                  </button>
                ) : selectedUser.id !== OWNER_ID && selectedUser.role === 'admin' ? (
                  <button onClick={() => { const u = selectedUser; setSelectedUser(null); setRoleModalUser(u); setTargetNewRole('user'); }}
                    className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-mono-custom text-[10px] tracking-wider transition-colors">
                    DEMOTE TO USER
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ROLE CHANGE CONFIRMATION ── */}
      {roleModalUser && targetNewRole && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-dark-100 rounded-2xl border border-eg/30 p-7 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-eg/30 bg-eg/10 flex items-center justify-center flex-shrink-0 text-eg font-bold">⚡</div>
              <div>
                <h3 className="font-display text-base font-bold text-white tracking-wider">CONFIRM ROLE CHANGE</h3>
                <p className="font-mono-custom text-[10px] text-eg/70 uppercase tracking-wider">PERMISSIONS MANAGEMENT</p>
              </div>
            </div>
            <p className="font-sans text-sm text-white/70 leading-relaxed">
              Change <span className="font-semibold text-white">{roleModalUser.full_name || roleModalUser.email}</span> to{' '}
              <span className="font-bold text-eg uppercase">{formatRoleLabel(targetNewRole)}</span>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={() => { setRoleModalUser(null); setTargetNewRole(null); }} disabled={updatingRole}
                className="px-4 py-2 rounded-lg font-mono-custom text-xs text-white/40 hover:text-white transition-colors">
                CANCEL
              </button>
              <button onClick={handleConfirmRoleChange} disabled={updatingRole}
                className="btn-primary py-2 px-5 text-xs flex items-center gap-2">
                {updatingRole ? (
                  <><div className="w-3 h-3 rounded-full border-2 border-dark border-t-transparent animate-spin" /><span>UPDATING...</span></>
                ) : 'CONFIRM CHANGE'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
