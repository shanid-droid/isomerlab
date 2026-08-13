import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserProfile } from '../lib/hooks';
import { IsomerLogo } from '../components/ui';
import { logAuthEvent } from '../lib/activityLog';
import ThumbnailPromptSection from '../components/ThumbnailPromptSection';
import type { Project, ProjectGalleryItem } from '../lib/types';
import { CREATOR_REQUIREMENT_DAYS } from '../lib/constants';
import { isCreatorRole } from '../lib/roles';

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
  const [formPublished, setFormPublished] = useState(true);
  const [formThumbnailFile, setFormThumbnailFile] = useState<File | null>(null);
  const [formThumbnailPreview, setFormThumbnailPreview] = useState<string | null>(null);
  const [formGalleryFiles, setFormGalleryFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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

  const handleOpenAdd = () => {
    setEditingProject(null);
    setFormTitle(''); setFormSlug(''); setFormDescription(''); setFormComponents('');
    setFormGithubUrl(''); setFormPublished(true);
    setFormThumbnailFile(null); setFormThumbnailPreview(null);
    setFormGalleryFiles([]); setExistingGallery([]); setDeletingGalleryIds([]); setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (project: Project) => {
    setEditingProject(project);
    setFormTitle(project.title); setFormSlug(project.slug);
    setFormDescription(project.description || '');
    setFormComponents(Array.isArray(project.components) ? project.components.join(', ') : (project.components as string) || '');
    setFormGithubUrl(project.github_url || '');
    setFormPublished(project.published !== false);
    setFormThumbnailPreview(project.thumbnail_url || null);
    setFormThumbnailFile(null); setFormGalleryFiles([]);
    setDeletingGalleryIds([]); setFormError(null); setIsModalOpen(true);
    const { data } = await supabase.from('project_gallery').select('*').eq('project_id', project.id).order('sort_order');
    setExistingGallery((data as ProjectGalleryItem[]) || []);
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
      const payload = {
        title: formTitle.trim(), slug: formSlug.trim(),
        description: formDescription.trim(), components: componentsArray,
        github_url: formGithubUrl.trim() || null, thumbnail_url: thumbnailUrl, published: formPublished,
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
      if (deletingGalleryIds.length > 0) {
        await supabase.from('project_gallery').delete().in('id', deletingGalleryIds);
      }
      if (formGalleryFiles.length > 0 && projectId) {
        const inserts = [];
        for (let i = 0; i < formGalleryFiles.length; i++) {
          const url = await uploadFile(formGalleryFiles[i], 'gallery');
          inserts.push({ project_id: projectId, image_url: url, sort_order: existingGallery.length + i });
        }
        await supabase.from('project_gallery').insert(inserts);
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
              <div className="grid grid-cols-2 gap-4">
                <div><label className="font-mono-custom text-[10px] text-white/50 uppercase">Components</label><input className={inputClass} value={formComponents} onChange={e => setFormComponents(e.target.value)} placeholder="React, TS..." /></div>
                <div><label className="font-mono-custom text-[10px] text-white/50 uppercase">GitHub URL</label><input type="url" className={inputClass} value={formGithubUrl} onChange={e => setFormGithubUrl(e.target.value)} /></div>
              </div>
              <label className="flex items-center gap-2 text-xs font-mono-custom"><input type="checkbox" checked={formPublished} onChange={e => setFormPublished(e.target.checked)} className="rounded border-eg/40" /> PUBLISH IMMEDIATELY</label>
              <div>
                <label className="font-mono-custom text-[10px] text-white/50 uppercase block mb-2">Thumbnail</label>
                {formThumbnailPreview && <img src={formThumbnailPreview} alt="" className="w-24 h-16 object-cover rounded-lg border border-eg/30 mb-2" />}
                <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) { setFormThumbnailFile(e.target.files[0]); setFormThumbnailPreview(URL.createObjectURL(e.target.files[0])); } }} className="text-xs text-white/50" />
                <ThumbnailPromptSection projectName={formTitle} projectDescription={formDescription} hasProductImage={!!(formThumbnailFile || formThumbnailPreview)} />
              </div>
              <div>
                <label className="font-mono-custom text-[10px] text-white/50 uppercase block mb-2">Gallery Images</label>
                <input type="file" multiple accept="image/*" onChange={e => { if (e.target.files) setFormGalleryFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} className="text-xs text-white/50" />
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
    </div>
  );
};

export default CreatorDashboard;
