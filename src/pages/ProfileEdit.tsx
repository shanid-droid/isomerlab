import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserProfile } from '../lib/hooks';
import { IsomerLogo, ArrowRight } from '../components/ui';
import type { SocialLinks } from '../lib/types';

const SOCIAL_PLATFORMS = ['github', 'twitter', 'linkedin', 'instagram', 'youtube', 'website'] as const;

const ProfileEdit: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading, refreshProfile } = useUserProfile();
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
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
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
    setSuccess(false);

    try {
      let avatarUrl = currentAvatar;

      // Upload avatar if changed
      if (avatarFile) {
        avatarUrl = await uploadAvatar(profile.id);
      }

      // Update profile — role is NOT in the update payload (preserved by RLS WITH CHECK)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
          about: about.trim() || null,
          social_links: socialLinks,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) {
        console.error(
          '[ProfileEdit] Supabase UPDATE failed.',
          '\n→ Possible RLS issue: check "Users update own profile non-role fields" policy.',
          '\n→ Error details:',
          { code: updateError.code, message: updateError.message, details: updateError.details, hint: updateError.hint }
        );
        throw new Error(updateError.message);
      }

      // Re-fetch the saved row from Supabase to confirm persisted values.
      // This is the authoritative source of truth — avoids stale in-memory state.
      const { data: savedRow, error: refetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .maybeSingle();

      if (refetchErr) {
        console.error(
          '[ProfileEdit] Post-save re-fetch failed. The update likely succeeded but we cannot confirm.',
          '\n→ Error details:',
          { code: refetchErr.code, message: refetchErr.message, details: refetchErr.details, hint: refetchErr.hint }
        );
        // Still mark success — the update itself didn't error
        setAvatarFile(null);
        if (avatarUrl) setCurrentAvatar(avatarUrl);
      } else if (savedRow) {
        // Update all form fields from the DB-confirmed values
        const saved = savedRow as typeof profile;
        setFullName(saved.full_name || '');
        setBio(saved.bio || '');
        setAbout(saved.about || '');
        setSocialLinks((saved.social_links as SocialLinks) || {});
        setCurrentAvatar(saved.avatar_url || null);
        setAvatarFile(null);
        console.log('[ProfileEdit] Profile saved and verified from DB:', {
          full_name: saved.full_name,
          bio: saved.bio,
          about: saved.about,
          social_links: saved.social_links,
          avatar_url: saved.avatar_url,
        });
      } else {
        // Saved but re-fetch returned null — possible RLS gap
        console.warn(
          '[ProfileEdit] Post-save re-fetch returned null for id:', profile.id,
          '\n→ Update succeeded but cannot read back the row.',
          '\n→ Verify SELECT policy "Public can read profiles" exists on public.profiles.'
        );
        setAvatarFile(null);
        if (avatarUrl) setCurrentAvatar(avatarUrl);
      }

      // Also trigger the hook to refresh in case other parts of the UI use it
      await refreshProfile();

      setSuccess(true);
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
      <div className="min-h-screen bg-dark bg-circuit flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
          <span className="font-mono-custom text-xs tracking-widest text-eg/70 uppercase">LOADING PROFILE...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      {/* Header */}
      <header className="glass-dark border-b border-eg/10 sticky top-0 z-30 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link to="/"><IsomerLogo size="md" /></Link>
            <div className="h-5 w-px bg-eg/20 hidden sm:block" />
            <span className="font-mono-custom text-[10px] tracking-widest text-eg/80 uppercase bg-eg/10 px-2.5 py-1 rounded border border-eg/30 hidden sm:inline-block">
              EDIT PROFILE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/profile/${profile?.id}`}
              className="font-mono-custom text-xs text-white/60 hover:text-eg transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10"
            >
              View Public Profile ↗
            </Link>
            <Link
              to="/dashboard"
              className="font-mono-custom text-xs text-white/60 hover:text-eg transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

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

        {/* Success Banner */}
        {success && (
          <div className="p-4 rounded-xl border border-eg/40 bg-eg/10 flex items-center gap-3 animate-fade-in">
            <svg className="w-5 h-5 text-eg flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="font-mono-custom text-xs text-eg tracking-wider">PROFILE UPDATED SUCCESSFULLY</p>
          </div>
        )}

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
              <span className="w-1.5 h-1.5 rounded-full bg-eg" /> BASIC INFORMATION
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
                  {profile?.role?.toUpperCase() || 'USER'}
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
              {SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform} className="space-y-1.5">
                  <label
                    htmlFor={`social-${platform}`}
                    className="block font-mono-custom text-[11px] tracking-widest text-white/50 uppercase"
                  >
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
                      'https://yourwebsite.com'
                    }
                    className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4">
            <Link
              to={`/profile/${profile?.id}`}
              className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors flex items-center gap-1.5"
            >
              ← View Public Profile
            </Link>
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
