import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { IsomerLogo } from '../components/ui';
import type { Project, ProjectGalleryItem } from '../lib/types';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Auth State
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');

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
  const [formPublished, setFormPublished] = useState(true);
  const [formThumbnailFile, setFormThumbnailFile] = useState<File | null>(null);
  const [formThumbnailPreview, setFormThumbnailPreview] = useState<string | null>(null);
  const [formGalleryFiles, setFormGalleryFiles] = useState<File[]>([]);
  const [formGalleryPreviews, setFormGalleryPreviews] = useState<string[]>([]);

  // Submitting / Action state
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Authenticated User Check & Session Monitoring
  useEffect(() => {
    let isMounted = true;

    async function checkAuthSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (isMounted) navigate('/admin/login', { replace: true });
          return;
        }
        if (isMounted) {
          setUserEmail(session.user.email ?? 'Admin');
          setCheckingAuth(false);
        }
      } catch (err) {
        if (isMounted) navigate('/admin/login', { replace: true });
      }
    }

    checkAuthSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        if (!session?.user) {
          navigate('/admin/login', { replace: true });
        } else {
          setUserEmail(session.user.email ?? 'Admin');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // 2. Fetch Projects list
  const fetchProjects = async () => {
    setLoadingProjects(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects((data as Project[]) || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load projects.');
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (!checkingAuth) {
      fetchProjects();
    }
  }, [checkingAuth]);

  // 3. Logout action
  const handleLogout = async () => {
    setUserEmail(null);
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true });
  };

  // Helper: Slugify title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormTitle(val);
    // Auto-generate slug if adding new project or slug matches old generated slug
    if (!editingProject) {
      setFormSlug(generateSlug(val));
    }
  };

  // Open Modal for New Project
  const handleOpenAddModal = () => {
    setEditingProject(null);
    setFormTitle('');
    setFormSlug('');
    setFormDescription('');
    setFormComponents('');
    setFormGithubUrl('');
    setFormPublished(true);
    setFormThumbnailFile(null);
    setFormThumbnailPreview(null);
    setFormGalleryFiles([]);
    setFormGalleryPreviews([]);
    setExistingGallery([]);
    setDeletingGalleryIds([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Modal for Edit Project
  const handleOpenEditModal = async (project: Project) => {
    setEditingProject(project);
    setFormTitle(project.title);
    setFormSlug(project.slug);
    setFormDescription(project.description || '');
    
    // Components formatting
    if (Array.isArray(project.components)) {
      setFormComponents(project.components.join(', '));
    } else if (typeof project.components === 'string') {
      setFormComponents(project.components);
    } else {
      setFormComponents('');
    }

    setFormGithubUrl(project.github_url || '');
    setFormPublished(project.published !== false);
    setFormThumbnailFile(null);
    setFormThumbnailPreview(project.thumbnail_url || null);
    setFormGalleryFiles([]);
    setFormGalleryPreviews([]);
    setDeletingGalleryIds([]);
    setFormError(null);
    setIsModalOpen(true);

    // Fetch existing gallery for this project
    try {
      const { data, error } = await supabase
        .from('project_gallery')
        .select('*')
        .eq('project_id', project.id)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setExistingGallery(data as ProjectGalleryItem[]);
      }
    } catch (err) {
      console.warn('Could not load gallery for editing:', err);
    }
  };

  // Thumbnail File Selection
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormThumbnailFile(file);
      setFormThumbnailPreview(URL.createObjectURL(file));
    }
  };

  // Gallery Files Selection
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFormGalleryFiles((prev) => [...prev, ...selectedFiles]);

      const newPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
      setFormGalleryPreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  // Remove newly selected gallery file preview
  const handleRemoveNewGalleryItem = (index: number) => {
    setFormGalleryFiles((prev) => prev.filter((_, i) => i !== index));
    setFormGalleryPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Mark existing gallery item for deletion
  const handleRemoveExistingGalleryItem = (galleryId: string) => {
    setDeletingGalleryIds((prev) => [...prev, galleryId]);
    setExistingGallery((prev) => prev.filter((item) => item.id !== galleryId));
  };

  // Storage Deletion Utility (keeps Storage objects in sync with DB)
  const removeFileFromSupabaseStorage = async (publicUrl: string | null | undefined) => {
    if (!publicUrl) return;
    try {
      const bucketName = 'project-images';
      const marker = `${bucketName}/`;
      const idx = publicUrl.indexOf(marker);
      if (idx !== -1) {
        const filePath = publicUrl.substring(idx + marker.length);
        if (filePath) {
          await supabase.storage.from(bucketName).remove([filePath]);
        }
      }
    } catch (err) {
      console.warn('Storage deletion failed non-fatally:', err);
    }
  };

  // Storage Upload Utility
  const uploadFileToSupabase = async (file: File, folder: string): Promise<string> => {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('project-images')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('project-images')
      .getPublicUrl(path);

    return data.publicUrl;
  };

  // Form Submission (Add / Edit)
  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Project title is required.');
      return;
    }
    if (!formSlug.trim()) {
      setFormError('Project slug is required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      // Parse components list into string array
      const componentsArray = formComponents
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      let thumbnailUrl = editingProject?.thumbnail_url || null;

      // 1. Upload Thumbnail if a new file was chosen (and delete old thumbnail from storage)
      if (formThumbnailFile) {
        setSubmitStatusText('Uploading thumbnail image...');
        const newThumbnailUrl = await uploadFileToSupabase(formThumbnailFile, 'thumbnails');
        if (editingProject?.thumbnail_url) {
          await removeFileFromSupabaseStorage(editingProject.thumbnail_url);
        }
        thumbnailUrl = newThumbnailUrl;
      }

      // 2. Prepare payload
      const projectPayload = {
        title: formTitle.trim(),
        slug: formSlug.trim(),
        description: formDescription.trim(),
        components: componentsArray,
        github_url: formGithubUrl.trim() || null,
        thumbnail_url: thumbnailUrl,
        published: formPublished,
      };

      let projectId = editingProject?.id;

      if (editingProject) {
        // UPDATE existing project
        setSubmitStatusText('Updating project details...');
        const { error: updateError } = await supabase
          .from('projects')
          .update(projectPayload)
          .eq('id', editingProject.id);

        if (updateError) throw updateError;
      } else {
        // INSERT new project
        setSubmitStatusText('Creating project record...');
        const { data: newProj, error: insertError } = await supabase
          .from('projects')
          .insert([projectPayload])
          .select()
          .single();

        if (insertError) throw insertError;
        projectId = newProj.id;
      }

      // 3. Delete gallery records marked for deletion (and cleanup storage files)
      if (deletingGalleryIds.length > 0) {
        setSubmitStatusText('Removing deleted gallery images...');
        
        // Find URLs of gallery items to delete from storage
        const itemsToDelete = existingGallery.filter((item) => deletingGalleryIds.includes(item.id));
        for (const item of itemsToDelete) {
          await removeFileFromSupabaseStorage(item.image_url);
        }

        await supabase
          .from('project_gallery')
          .delete()
          .in('id', deletingGalleryIds);
      }

      // 4. Upload new gallery files and save records to `project_gallery`
      if (formGalleryFiles.length > 0 && projectId) {
        setSubmitStatusText(`Uploading ${formGalleryFiles.length} gallery image(s)...`);
        
        const galleryInserts = [];
        let startOrder = existingGallery.length;

        for (let i = 0; i < formGalleryFiles.length; i++) {
          const file = formGalleryFiles[i];
          const uploadedUrl = await uploadFileToSupabase(file, 'gallery');
          galleryInserts.push({
            project_id: projectId,
            image_url: uploadedUrl,
            sort_order: startOrder + i,
          });
        }

        const { error: galleryError } = await supabase
          .from('project_gallery')
          .insert(galleryInserts);

        if (galleryError) {
          console.warn('Gallery records insert warning:', galleryError.message);
        }
      }

      // Close modal and refresh list
      setIsModalOpen(false);
      await fetchProjects();
    } catch (err: any) {
      console.error('Save project error:', err);
      setFormError(err.message || 'An error occurred while saving the project.');
    } finally {
      setSubmitting(false);
      setSubmitStatusText('');
    }
  };

  // Toggle Publish / Unpublish directly from table
  const handleTogglePublish = async (project: Project) => {
    const newStatus = !project.published;
    try {
      // 1. Fetch current auth session
      const { data: { session } } = await supabase.auth.getSession();

      // Diagnostic logging requested for debugging RLS 42501 issue:
      console.log('[RLS DIAGNOSTIC] 1. User ID:', session?.user?.id ?? 'NO_USER');
      console.log('[RLS DIAGNOSTIC] 2. User Role:', session?.user?.role ?? 'NO_ROLE');
      console.log('[RLS DIAGNOSTIC] 3. Has Access Token:', !!session?.access_token);
      console.log('[RLS DIAGNOSTIC] 4. Target Project ID:', project.id);
      console.log('[RLS DIAGNOSTIC] 5. Current Published Value:', project.published);
      console.log('[RLS DIAGNOSTIC] 6. Attempting Update to Published:', newStatus);

      // Optimistic update
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id
            ? { ...p, published: newStatus }
            : p
        )
      );

      const { error } = await supabase
        .from('projects')
        .update({ published: newStatus })
        .eq('id', project.id);

      if (error) {
        console.error('[RLS DIAGNOSTIC] Supabase UPDATE Error:', error);
        fetchProjects(); // revert on error
        throw error;
      }
    } catch (err: any) {
      alert(`Could not toggle status: ${err.message}`);
    }
  };

  // Confirm and Delete Project
  const handleDeleteProject = async () => {
    if (!deleteConfirmProject) return;

    setSubmitting(true);
    try {
      // 1. Fetch gallery items to cleanup storage files
      const { data: galleryItems } = await supabase
        .from('project_gallery')
        .select('*')
        .eq('project_id', deleteConfirmProject.id);

      if (galleryItems && galleryItems.length > 0) {
        for (const item of galleryItems) {
          await removeFileFromSupabaseStorage(item.image_url);
        }
      }

      // 2. Delete gallery DB records
      await supabase
        .from('project_gallery')
        .delete()
        .eq('project_id', deleteConfirmProject.id);

      // 3. Remove project thumbnail from Storage if present
      if (deleteConfirmProject.thumbnail_url) {
        await removeFileFromSupabaseStorage(deleteConfirmProject.thumbnail_url);
      }

      // 4. Delete project DB record
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', deleteConfirmProject.id);

      if (error) throw error;

      setDeleteConfirmProject(null);
      await fetchProjects();
    } catch (err: any) {
      alert(`Failed to delete project: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Search projects list
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-dark bg-circuit flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
          <span className="font-mono-custom text-xs tracking-widest text-eg/70 uppercase">
            VERIFYING ADMIN CREDENTIALS...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
      {/* ── Top Header / Navbar ─────────────────────────────────── */}
      <header className="glass-dark border-b border-eg/10 sticky top-0 z-30 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <IsomerLogo size="md" />
            </Link>
            <div className="h-5 w-px bg-eg/20 hidden sm:block" />
            <span className="font-mono-custom text-[10px] tracking-widest text-eg/80 uppercase bg-eg/10 px-2.5 py-1 rounded border border-eg/30 hidden sm:inline-block">
              MANAGEMENT CONSOLE
            </span>
          </div>

          <div className="flex items-center gap-4">
            {userEmail && (
              <div className="font-mono-custom text-xs text-white/50 hidden md:flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
                <span>{userEmail}</span>
              </div>
            )}

            <Link
              to="/"
              className="font-mono-custom text-xs text-white/60 hover:text-eg transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10"
            >
              Public Site ↗
            </Link>

            <button
              id="admin-logout-btn"
              onClick={handleLogout}
              className="btn-primary py-1.5 px-4 text-xs font-mono-custom flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Dashboard Content ─────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-5 border border-eg/15 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-eg/5 rounded-bl-full pointer-events-none" />
            <p className="font-mono-custom text-[10px] tracking-widest text-white/40 uppercase mb-1">
              TOTAL PROJECTS
            </p>
            <p className="font-display text-3xl font-bold text-white">{totalCount}</p>
          </div>

          <div className="glass rounded-xl p-5 border border-eg/15 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-eg/10 rounded-bl-full pointer-events-none" />
            <p className="font-mono-custom text-[10px] tracking-widest text-eg uppercase mb-1">
              PUBLISHED
            </p>
            <p className="font-display text-3xl font-bold text-eg text-glow-sm">{publishedCount}</p>
          </div>

          <div className="glass rounded-xl p-5 border border-eg/15 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full pointer-events-none" />
            <p className="font-mono-custom text-[10px] tracking-widest text-amber-400 uppercase mb-1">
              DRAFTS / UNPUBLISHED
            </p>
            <p className="font-display text-3xl font-bold text-amber-300">{draftCount}</p>
          </div>
        </div>

        {/* Action Header & Search Controls */}
        <div className="glass rounded-xl p-6 border border-eg/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search and Filters */}
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search projects by title, slug or tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 font-mono-custom focus:outline-none focus:border-eg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-dark-200/60 p-1 rounded-xl border border-eg/10">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg font-mono-custom text-[11px] uppercase transition-all ${
                  filterStatus === 'all' ? 'bg-eg/20 text-eg font-semibold' : 'text-white/40 hover:text-white'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setFilterStatus('published')}
                className={`px-3 py-1.5 rounded-lg font-mono-custom text-[11px] uppercase transition-all ${
                  filterStatus === 'published' ? 'bg-eg/20 text-eg font-semibold' : 'text-white/40 hover:text-white'
                }`}
              >
                Published ({publishedCount})
              </button>
              <button
                onClick={() => setFilterStatus('draft')}
                className={`px-3 py-1.5 rounded-lg font-mono-custom text-[11px] uppercase transition-all ${
                  filterStatus === 'draft' ? 'bg-eg/20 text-eg font-semibold' : 'text-white/40 hover:text-white'
                }`}
              >
                Drafts ({draftCount})
              </button>
            </div>
          </div>

          {/* Add Project Button */}
          <button
            onClick={handleOpenAddModal}
            id="admin-add-project-btn"
            className="btn-primary py-3 px-6 text-xs flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span className="text-lg leading-none">+</span>
            ADD NEW PROJECT
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 flex items-center justify-between">
            <p className="font-mono-custom text-xs text-red-300">{errorMsg}</p>
            <button onClick={fetchProjects} className="btn-primary text-[10px] py-1 px-3">
              RETRY
            </button>
          </div>
        )}

        {/* ── Projects List / Table ──────────────────────────────── */}
        <div className="glass rounded-xl border border-eg/20 overflow-hidden shadow-2xl">
          {loadingProjects ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
              <span className="font-mono-custom text-xs text-white/40 uppercase tracking-widest">
                LOADING PROJECT CATALOG...
              </span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-12 h-12 rounded-full border border-eg/20 bg-eg/5 flex items-center justify-center mx-auto text-eg/40">
                📁
              </div>
              <p className="font-mono-custom text-xs text-white/40 uppercase tracking-widest">
                {searchQuery ? 'No matching projects found' : 'No projects created yet'}
              </p>
              {!searchQuery && (
                <button onClick={handleOpenAddModal} className="btn-primary text-xs py-2 px-4">
                  + CREATE YOUR FIRST PROJECT
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-eg/10 bg-dark-200/50 font-mono-custom text-[11px] text-white/50 uppercase tracking-widest">
                    <th className="py-4 px-6">PROJECT</th>
                    <th className="py-4 px-4">STATUS</th>
                    <th className="py-4 px-4 hidden md:table-cell">COMPONENTS</th>
                    <th className="py-4 px-4 hidden lg:table-cell">GITHUB</th>
                    <th className="py-4 px-6 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-eg/10 text-xs font-sans">
                  {filteredProjects.map((project) => {
                    const isPublished = project.published === true;
                    
                    // Parse components for display chips
                    let comps: string[] = [];
                    if (Array.isArray(project.components)) comps = project.components;
                    else if (typeof project.components === 'string') {
                      comps = project.components.split(',').map(s => s.trim()).filter(Boolean);
                    }

                    return (
                      <tr key={project.id} className="hover:bg-eg/5 transition-colors group">
                        {/* Thumbnail & Title */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-12 rounded-lg bg-dark-300 overflow-hidden flex-shrink-0 border border-eg/20 relative">
                              {project.thumbnail_url ? (
                                <img
                                  src={project.thumbnail_url}
                                  alt={project.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-display text-[10px] text-eg/40 bg-circuit">
                                  N/A
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/projects/${project.slug}`}
                                className="font-display font-semibold text-white group-hover:text-eg transition-colors truncate block"
                              >
                                {project.title}
                              </Link>
                              <p className="font-mono-custom text-[10px] text-white/40 truncate">
                                /{project.slug}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Status Toggle Badge */}
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleTogglePublish(project)}
                            title="Click to toggle publish status"
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono-custom text-[10px] tracking-wider uppercase border transition-all ${
                              isPublished
                                ? 'bg-eg/10 text-eg border-eg/30 hover:bg-eg/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isPublished ? 'bg-eg animate-pulse' : 'bg-amber-400'
                              }`}
                            />
                            {isPublished ? 'PUBLISHED' : 'DRAFT'}
                          </button>
                        </td>

                        {/* Components */}
                        <td className="py-4 px-4 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {comps.length > 0 ? (
                              comps.slice(0, 3).map((tech, i) => (
                                <span
                                  key={i}
                                  className="font-mono-custom text-[9px] px-2 py-0.5 rounded bg-dark-200 border border-white/10 text-white/60"
                                >
                                  {tech}
                                </span>
                              ))
                            ) : (
                              <span className="text-white/20 italic text-[11px]">—</span>
                            )}
                            {comps.length > 3 && (
                              <span className="font-mono-custom text-[9px] px-1.5 py-0.5 rounded bg-dark-200 text-white/40">
                                +{comps.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* GitHub Link */}
                        <td className="py-4 px-4 hidden lg:table-cell">
                          {project.github_url ? (
                            <a
                              href={project.github_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono-custom text-[11px] text-eg/80 hover:text-eg underline truncate max-w-[140px] block"
                            >
                              GitHub Link ↗
                            </a>
                          ) : (
                            <span className="text-white/20 italic text-[11px]">None</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditModal(project)}
                              className="px-3 py-1.5 rounded-lg border border-eg/30 bg-eg/10 text-eg hover:bg-eg/20 font-mono-custom text-[10px] tracking-wider transition-colors"
                            >
                              EDIT
                            </button>
                            <button
                              onClick={() => setDeleteConfirmProject(project)}
                              className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-mono-custom text-[10px] tracking-wider transition-colors"
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
      </main>

      {/* ── ADD / EDIT PROJECT MODAL ────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass rounded-2xl border border-eg/30 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl relative my-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-eg/10 flex items-center justify-between">
              <div>
                <span className="font-mono-custom text-[10px] text-eg tracking-widest uppercase">
                  {editingProject ? 'UPDATE RECORD' : 'CREATE RECORD'}
                </span>
                <h2 className="font-display text-lg font-bold text-white tracking-wider">
                  {editingProject ? `EDIT: ${editingProject.title}` : 'ADD NEW PROJECT'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="font-mono-custom text-xs text-white/40 hover:text-eg p-2"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitProject} className="p-6 overflow-y-auto space-y-6 flex-1">
              {formError && (
                <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 font-mono-custom text-xs text-red-300">
                  {formError}
                </div>
              )}

              {/* Title & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider">
                    PROJECT TITLE *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={handleTitleChange}
                    placeholder="e.g. Quantum Neural Mesh"
                    className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg font-mono-custom"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider">
                    SLUG (URL KEY) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => setFormSlug(generateSlug(e.target.value))}
                    placeholder="quantum-neural-mesh"
                    className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg font-mono-custom"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider">
                  DESCRIPTION
                </label>
                <textarea
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detailed summary of architecture, goals, and technical specs..."
                  className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg font-sans leading-relaxed"
                />
              </div>

              {/* Components & GitHub URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider">
                    COMPONENTS USED (COMMA-SEPARATED)
                  </label>
                  <input
                    type="text"
                    value={formComponents}
                    onChange={(e) => setFormComponents(e.target.value)}
                    placeholder="React, Supabase, Tailwind, TypeScript"
                    className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg font-mono-custom"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider">
                    GITHUB REPOSITORY URL
                  </label>
                  <input
                    type="url"
                    value={formGithubUrl}
                    onChange={(e) => setFormGithubUrl(e.target.value)}
                    placeholder="https://github.com/org/repo"
                    className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg font-mono-custom"
                  />
                </div>
              </div>

              {/* Status Switch */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-eg/10 bg-dark-200/50">
                <input
                  type="checkbox"
                  id="form-published-check"
                  checked={formPublished}
                  onChange={(e) => setFormPublished(e.target.checked)}
                  className="w-4 h-4 rounded border-eg/40 text-eg focus:ring-eg bg-dark"
                />
                <label htmlFor="form-published-check" className="font-mono-custom text-xs text-white cursor-pointer select-none">
                  PUBLISH IMMEDIATELY ({formPublished ? 'Visible on Public Website' : 'Saved as Draft'})
                </label>
              </div>

              {/* Thumbnail Image Picker */}
              <div className="space-y-2">
                <label className="block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider">
                  THUMBNAIL IMAGE (UPLOAD TO SUPABASE BUCKET `project-images`)
                </label>

                <div className="flex items-center gap-4">
                  {formThumbnailPreview ? (
                    <div className="w-24 h-16 rounded-lg bg-dark-300 border border-eg/30 overflow-hidden relative flex-shrink-0">
                      <img src={formThumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setFormThumbnailFile(null);
                          setFormThumbnailPreview(null);
                        }}
                        className="absolute top-1 right-1 bg-black/70 text-white hover:text-red-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}

                  <label className="flex-1 cursor-pointer border border-dashed border-eg/30 hover:border-eg rounded-xl p-3 text-center bg-dark-200/50 hover:bg-eg/5 transition-all">
                    <span className="font-mono-custom text-xs text-eg/80 block">
                      {formThumbnailPreview ? 'Change Thumbnail File' : 'Select Thumbnail File'}
                    </span>
                    <span className="font-sans text-[10px] text-white/30 block mt-0.5">
                      PNG, JPG, WEBP or GIF (Max 5MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Gallery Image Uploads */}
              <div className="space-y-3">
                <label className="block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider">
                  PROJECT GALLERY IMAGES (MULTIPLE)
                </label>

                {/* Existing Gallery Images list */}
                {existingGallery.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-mono-custom text-[10px] text-white/40 uppercase">Existing Gallery Items:</span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {existingGallery.map((item) => (
                        <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-eg/20 group">
                          <img src={item.image_url} alt="Gallery item" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingGalleryItem(item.id)}
                            className="absolute inset-0 bg-red-950/80 text-red-300 font-mono-custom text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            REMOVE
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Newly selected gallery previews */}
                {formGalleryPreviews.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-mono-custom text-[10px] text-eg uppercase">New Images to Upload:</span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {formGalleryPreviews.map((url, i) => (
                        <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-eg/40 group">
                          <img src={url} alt="New gallery preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewGalleryItem(i)}
                            className="absolute top-1 right-1 bg-black/80 text-white hover:text-red-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Gallery Files Dropzone button */}
                <label className="cursor-pointer border border-dashed border-eg/30 hover:border-eg rounded-xl p-4 text-center bg-dark-200/50 hover:bg-eg/5 transition-all block">
                  <span className="font-mono-custom text-xs text-eg block">
                    + Add Gallery Images
                  </span>
                  <span className="font-sans text-[10px] text-white/30 block mt-0.5">
                    Select one or multiple screenshots/diagrams
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleGalleryChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-eg/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg font-mono-custom text-xs text-white/60 hover:text-white"
                >
                  CANCEL
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-2.5 px-6 text-xs flex items-center gap-2"
                >
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

      {/* ── DELETE CONFIRMATION MODAL ──────────────────────────── */}
      {deleteConfirmProject && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass rounded-2xl border border-red-500/40 p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-full border border-red-500/40 bg-red-500/10 flex items-center justify-center flex-shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-white tracking-wider">
                  CONFIRM DELETION
                </h3>
                <p className="font-mono-custom text-[10px] text-red-400 uppercase">
                  IRREVERSIBLE ACTION
                </p>
              </div>
            </div>

            <p className="font-sans text-xs text-white/70 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-white">{deleteConfirmProject.title}</span>? This will permanently remove the project and its gallery records.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmProject(null)}
                disabled={submitting}
                className="px-4 py-2 rounded-lg font-mono-custom text-xs text-white/60 hover:text-white"
              >
                CANCEL
              </button>

              <button
                onClick={handleDeleteProject}
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg border border-red-500/60 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-mono-custom text-xs tracking-wider transition-all"
              >
                {submitting ? 'DELETING...' : 'DELETE PROJECT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-eg/10 text-center z-10 mt-auto">
        <p className="font-mono-custom text-[10px] tracking-widest text-white/20 uppercase">
          © 2025 ISOMER. ADMIN MANAGEMENT CONSOLE.
        </p>
      </footer>
    </div>
  );
};

export default AdminDashboard;
