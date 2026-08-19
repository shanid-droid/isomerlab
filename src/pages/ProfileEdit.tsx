import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserProfile } from '../lib/hooks';
import { ArrowRight } from '../components/ui';
import { UserWorkspaceHeader } from '../components/ui/UserWorkspaceHeader';
import { FormSkeleton } from '../components/ui/Skeleton';
import { ToastContainer, useToast } from '../components/ui/Toast';
import { isValidUrl } from '../lib/validation';
import type { SocialLinks } from '../lib/types';
import { formatRoleLabel } from '../lib/roles';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (v?: string | null): v is string => !!v && UUID_REGEX.test(v);

const SOCIAL_PLATFORMS = ['github', 'twitter', 'linkedin', 'instagram', 'youtube', 'website', 'discord'] as const;

const ProfileEdit: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading, refreshProfile } = useUserProfile();
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [fullName, setFullName]   = useState('');
  const [bio, setBio]             = useState('');
  const [about, setAbout]         = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [avatarFile, setAvatarFile]   = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);

  // UI state
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [authChecked, setAuthChecked] = useState(false);

  // Load profile into form fields
  useEffect(() => {
    if (!profileLoading && profile) {
      setFullName(profile.full_name || '');
      setBio(profile.bio || '');
      setAbout(profile.about || '');
      setSocialLinks((profile.social_links as SocialLinks) || {});
      setCurrentAvatar(profile.avatar_url || null);
      setAuthChecked(true);
    } else if (!profileLoading && !profile) {
      // Not authenticated
      navigate('/login', { replace: true });
    }
  }, [profile, profileLoading, navigate]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar image must be under 2 MB.');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setError(null);
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return null;

    const ext = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

    if (uploadError) {
      throw new Error(`Avatar upload failed: ${uploadError.message}`);
    }

    // Get a public URL (bucket is private but we use getPublicUrl which works if RLS allows read)
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError(null);
    setFieldErrors({});

    const urlErrors: Record<string, string> = {};
    Object.entries(socialLinks || {}).forEach(([key, val]) => {
      if (typeof val === 'string' && val.trim() && !isValidUrl(val)) {
        urlErrors[`social-${key}`] = 'Invalid URL format.';
      }
    });
    if (Object.keys(urlErrors).length > 0) {
      setFieldErrors(urlErrors);
      setError('Please fix invalid social link URLs.');
      setSaving(false);
      return;
    }

    try {
      let avatarUrl = currentAvatar;

      // Upload avatar if changed
      if (avatarFile) {
        avatarUrl = await uploadAvatar(profile.id);
      }

      // Clean social links: trim strings, remove empty entries, preserve valid custom keys
      const cleanedSocial: SocialLinks = {};
      Object.entries(socialLinks || {}).forEach(([key, val]) => {
        if (typeof val === 'string' && val.trim()) {
          cleanedSocial[key] = val.trim();
        }
      });

      // Update profile — role is NOT in the update payload (preserved by RLS WITH CHECK)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
          about: about.trim() || null,
          social_links: cleanedSocial,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) {
        console.error(
          '[ProfileEdit] Supabase UPDATE failed.',
          '\n→ Profile ID used:', profile.id,
          '\n→ Possible RLS issue: confirm "Users can update own profile" policy is active.',
          '\n→ Full error:',
          { code: updateError.code, message: updateError.message, details: updateError.details, hint: updateError.hint }
        );
        throw new Error(updateError.message);
      }

      console.debug('[ProfileEdit] UPDATE succeeded for profile ID:', profile.id);

      // Re-fetch the saved row to confirm the write was persisted.
      // Using .single() so a missing row (PGRST116) is an explicit error.
      const { data: savedRow, error: refetchErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, bio, about, social_links, created_at, updated_at')
        .eq('id', profile.id)
        .single();

      if (refetchErr) {
        console.error(
          '[ProfileEdit] Post-save re-fetch failed.',
          '\n→ Profile ID:', profile.id,
          '\n→ Error code:', refetchErr.code,
          '\n→ This may mean the SELECT policy is missing for authenticated users.',
          '\n→ Full error:',
          { code: refetchErr.code, message: refetchErr.message, details: refetchErr.details, hint: refetchErr.hint }
        );
        setAvatarFile(null);
        if (avatarUrl) setCurrentAvatar(avatarUrl);
      } else if (savedRow) {
        const saved = savedRow as typeof profile;
        setFullName(saved.full_name || '');
        setBio(saved.bio || '');
        setAbout(saved.about || '');
        setSocialLinks((saved.social_links as SocialLinks) || {});
        setCurrentAvatar(saved.avatar_url || null);
        setAvatarFile(null);
        console.log('[ProfileEdit] Profile saved and confirmed from DB ✓', {
          id: saved.id,
          full_name: saved.full_name,
          bio: saved.bio,
          about: saved.about ? saved.about.substring(0, 40) + '…' : null,
          social_links: saved.social_links,
          avatar_url: saved.avatar_url,
        });
      } else {
        console.warn(
          '[ProfileEdit] Post-save re-fetch returned no row for profile ID:', profile.id,
          '\n→ The UPDATE succeeded but the SELECT returned nothing.',
          '\n→ Verify the "Users can view own profile" SELECT policy is active.'
        );
        setAvatarFile(null);
        if (avatarUrl) setCurrentAvatar(avatarUrl);
      }

      // Also trigger the hook to refresh in case other parts of the UI use it
      await refreshProfile();
      showToast('Profile updated', 'success');
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSocialLink = (platform: string, value: string) => {
    setSocialLinks((prev) => ({
      ...prev,
      [platform]: value.trim() || undefined,
    }));
  };

  const displayAvatar = avatarPreview || currentAvatar;
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  if (profileLoading || !authChecked) {
    return (
      <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
        <UserWorkspaceHeader badge="EDIT PROFILE" backTo={{ label: '← Dashboard', path: '/dashboard' }} />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10">
          <FormSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      <UserWorkspaceHeader badge="EDIT PROFILE" backTo={{ label: '← Dashboard', path: '/dashboard' }} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Page Title */}
        <div>
          <div className="section-label mb-2">
            <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
            PROFILE SETTINGS
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-widest text-white">
            EDIT YOUR PROFILE
          </h1>
          <p className="font-sans text-xs text-white/40 mt-1">
            Update your public profile information. Your role and account ID cannot be changed here.
          </p>
        </div>

        {/* Success handled via toast */}

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 flex items-start gap-3 animate-fade-in">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            <p className="font-mono-custom text-xs text-red-300/90 tracking-wider">{error}</p>
          </div>
        )}

        {/* Profile Preview */}
        <div className="glass rounded-2xl p-6 border border-eg/20 relative overflow-hidden">
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
          <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-eg" /> PREVIEW
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              {displayAvatar ? (
                <img src={displayAvatar} alt="Avatar preview" className="w-16 h-16 rounded-xl object-cover border-2 border-eg/40" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-dark-300 border-2 border-eg/40 flex items-center justify-center">
                  <span className="font-display text-xl font-bold text-eg">{initials}</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-white truncate">{fullName || 'Your Name'}</p>
              <p className="font-mono-custom text-[10px] text-white/40 truncate">{bio || 'Your bio will appear here...'}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Avatar Section */}
          <div className="glass rounded-2xl p-6 border border-eg/20 relative overflow-hidden">
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" /> PROFILE PICTURE
            </h2>
            <div className="flex items-center gap-6 flex-wrap">
              {/* Avatar Preview */}
              <div className="relative">
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt="Avatar preview"
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-eg/40 shadow-eg-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-dark-300 border-2 border-eg/40 flex items-center justify-center shadow-eg-sm">
                    <span className="font-display text-2xl font-bold text-eg">{initials}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-eg flex items-center justify-center text-dark shadow-sm hover:scale-110 transition-transform"
                  aria-label="Change avatar"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-outline text-xs flex items-center gap-2"
                >
                  UPLOAD NEW PHOTO <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <p className="font-mono-custom text-[10px] text-white/30 tracking-wider">
                  JPEG, PNG, WebP or GIF · Max 2 MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarSelect}
                className="hidden"
                aria-label="Upload avatar image"
              />
            </div>
          </div>

          {/* Basic Info */}
          <div className="glass rounded-2xl p-6 border border-eg/20 space-y-5 relative overflow-hidden">
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" /> IDENTITY
            </h2>

            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="edit-full-name" className="block font-mono-custom text-[11px] tracking-widest text-white/60 uppercase">
                FULL NAME
              </label>
              <input
                id="edit-full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                maxLength={100}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label htmlFor="edit-bio" className="block font-mono-custom text-[11px] tracking-widest text-white/60 uppercase">
                SHORT BIO <span className="text-white/30 font-light normal-case tracking-normal ml-1">(appears on profile & project cards)</span>
              </label>
              <input
                id="edit-bio"
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short one-liner about yourself..."
                maxLength={160}
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom"
              />
              <p className="font-mono-custom text-[10px] text-white/25 text-right">{bio.length}/160</p>
            </div>

            {/* Read-only fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-eg/10">
              <div className="space-y-1.5">
                <label className="block font-mono-custom text-[11px] tracking-widest text-white/30 uppercase">
                  ROLE <span className="text-white/20">(read-only)</span>
                </label>
                <div className="w-full bg-dark-200/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/30 font-mono-custom cursor-not-allowed">
                  {formatRoleLabel(profile?.role, profile?.id)}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block font-mono-custom text-[11px] tracking-widest text-white/30 uppercase">
                  EMAIL <span className="text-white/20">(read-only)</span>
                </label>
                <div className="w-full bg-dark-200/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/30 font-mono-custom cursor-not-allowed truncate">
                  {profile?.email || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="glass rounded-2xl p-6 border border-eg/20 space-y-3 relative overflow-hidden">
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" /> ABOUT
            </h2>
            <label htmlFor="edit-about" className="block font-mono-custom text-[11px] tracking-widest text-white/40">
              Full description / extended bio shown on your profile page
            </label>
            <textarea
              id="edit-about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Tell the world about yourself, your background, what you build..."
              rows={6}
              maxLength={2000}
              className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom resize-none leading-relaxed"
            />
            <p className="font-mono-custom text-[10px] text-white/25 text-right">{about.length}/2000</p>
          </div>

          {/* Social Links */}
          <div className="glass rounded-2xl p-6 border border-eg/20 space-y-5 relative overflow-hidden">
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
            <h2 className="font-mono-custom text-xs tracking-widest text-white/50 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eg" /> SOCIAL LINKS
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SOCIAL_PLATFORMS.map((platform) => {
                const icon = platform === 'github' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
                ) : platform === 'twitter' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                ) : platform === 'linkedin' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                ) : platform === 'instagram' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                ) : platform === 'youtube' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                ) : platform === 'discord' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963a.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeLinecap="round"/></svg>
                );
                return (
                  <div key={platform} className="space-y-1.5">
                    <label htmlFor={`social-${platform}`} className="flex items-center gap-2 font-mono-custom text-[11px] tracking-widest text-white/50 uppercase">
                      <span className="text-eg/70">{icon}</span>
                      {platform}
                    </label>
                    <input
                      id={`social-${platform}`}
                      type="url"
                      value={socialLinks[platform] || ''}
                      onChange={(e) => updateSocialLink(platform, e.target.value)}
                      placeholder={
                        platform === 'github' ? 'https://github.com/username' :
                        platform === 'twitter' ? 'https://x.com/username' :
                        platform === 'linkedin' ? 'https://linkedin.com/in/username' :
                        platform === 'instagram' ? 'https://instagram.com/username' :
                        platform === 'youtube' ? 'https://youtube.com/@channel' :
                        platform === 'discord' ? 'https://discord.gg/invite' :
                        'https://yourwebsite.com'
                      }
                      className={`w-full bg-dark-200/80 border rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom ${
                        fieldErrors[`social-${platform}`] ? 'border-red-500/50' : 'border-eg/20'
                      }`}
                    />
                    {fieldErrors[`social-${platform}`] && (
                      <p className="font-mono-custom text-[10px] text-red-400 mt-1">{fieldErrors[`social-${platform}`]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4">
            {isValidUUID(profile?.id) ? (
              <Link
                to={`/profile/${profile.id}`}
                className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors flex items-center gap-1.5"
              >
                ← View Public Profile
              </Link>
            ) : (
              <span className="font-mono-custom text-xs text-white/20">Loading profile…</span>
            )}
            <button
              type="submit"
              id="profile-save-btn"
              disabled={saving}
              className={`btn-primary flex items-center gap-2 px-8 py-3.5 text-xs tracking-widest ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-dark border-t-transparent animate-spin" />
                  SAVING...
                </>
              ) : (
                <>
                  SAVE PROFILE
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default ProfileEdit;
