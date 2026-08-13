import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserProfile, useCreatorApplication } from '../lib/hooks';
import { IsomerLogo } from '../components/ui';
import { isAdminRole, isCreatorRole } from '../lib/roles';

const URL_REGEX = /^https?:\/\/.+\..+/i;

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return URL_REGEX.test(url.href);
  } catch {
    return false;
  }
}

const ApplyCreator: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useUserProfile();
  const { application, loading: appLoading, refresh } = useCreatorApplication();

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [profession, setProfession] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [education, setEducation] = useState('');
  const [location, setLocation] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [otherUrl, setOtherUrl] = useState('');
  const [motivation, setMotivation] = useState('');
  const [projectTypes, setProjectTypes] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const loading = profileLoading || appLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-dark bg-circuit flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
          <span className="font-mono-custom text-xs tracking-widest text-eg/70 uppercase">LOADING...</span>
        </div>
      </div>
    );
  }

  if (isAdminRole(profile?.role) || isCreatorRole(profile?.role)) {
    navigate(profile?.role === 'creator' ? '/creator' : '/dashboard', { replace: true });
    return null;
  }

  if (application?.status === 'pending' || submitted) {
    return (
      <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
        <header className="glass-dark border-b border-eg/10 py-4 px-6">
          <div className="max-w-3xl mx-auto">
            <Link to="/dashboard"><IsomerLogo size="md" /></Link>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="glass rounded-2xl p-10 border border-eg/20 max-w-lg w-full text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl border border-eg/30 bg-eg/10 flex items-center justify-center mx-auto text-2xl">✓</div>
            <p className="font-mono-custom text-[10px] tracking-widest text-eg uppercase">APPLICATION SUBMITTED</p>
            <h1 className="font-display text-xl font-bold text-white">Your Creator application has been sent for review.</h1>
            <p className="font-sans text-sm text-white/60">You will receive Creator access after approval.</p>
            <Link to="/dashboard" className="btn-primary py-2.5 px-6 text-xs font-mono-custom inline-block">BACK TO DASHBOARD</Link>
          </div>
        </main>
      </div>
    );
  }

  const validate = (): string | null => {
    if (!fullName.trim()) return 'Full name is required.';
    const ageNum = parseInt(age, 10);
    if (!age.trim() || isNaN(ageNum) || ageNum < 13 || ageNum > 120) return 'Please enter a valid age (13–120).';
    if (!profession.trim()) return 'Profession is required.';
    if (!currentRole.trim()) return 'Current role is required.';
    if (bio.trim().length < 20) return 'Bio must be at least 20 characters.';
    if (!skills.trim()) return 'Skills / technologies are required.';
    if (motivation.trim().length < 30) return 'Motivation must be at least 30 characters.';
    if (!projectTypes.trim()) return 'Please describe the types of projects you plan to upload.';
    if (!isValidUrl(githubUrl)) return 'GitHub URL is invalid.';
    if (!isValidUrl(portfolioUrl)) return 'Portfolio URL is invalid.';
    if (!isValidUrl(linkedinUrl)) return 'LinkedIn URL is invalid.';
    if (!isValidUrl(otherUrl)) return 'Other URL is invalid.';
    if (!acknowledged) return 'You must acknowledge the Creator requirements.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setFormError(err); return; }

    setSubmitting(true);
    setFormError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to apply.');

      const { error } = await supabase.from('creator_applications').insert([{
        user_id: user.id,
        full_name: fullName.trim(),
        age: parseInt(age, 10),
        profession: profession.trim(),
        applicant_role: currentRole.trim(),
        bio: bio.trim(),
        skills: skills.trim(),
        education: education.trim() || null,
        location: location.trim() || null,
        github_url: githubUrl.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        other_url: otherUrl.trim() || null,
        motivation: motivation.trim(),
        project_types: projectTypes.trim(),
        status: 'pending',
      }]);

      if (error) throw error;
      await refresh();
      setSubmitted(true);
    } catch (err: unknown) {
      setFormError((err as Error)?.message ?? 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg font-mono-custom';
  const labelClass = 'block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider mb-1.5';

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      <header className="glass-dark border-b border-eg/10 sticky top-0 z-30 py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/dashboard"><IsomerLogo size="md" /></Link>
          <Link to="/dashboard" className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors">← BACK</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8 text-center">
          <p className="font-mono-custom text-[10px] tracking-[0.3em] text-eg/80 uppercase mb-2">ISOMER LAB</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-wider text-white text-glow-sm">BECOME A CREATOR</h1>
          <p className="font-sans text-sm text-white/50 mt-2 italic">Share what you build. Inspire what comes next.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 md:p-8 border border-eg/20 space-y-6">
          {formError && (
            <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 font-mono-custom text-xs text-red-300">{formError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Full Name *</label><input required className={inputClass} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" /></div>
            <div><label className={labelClass}>Age *</label><input required type="number" min={13} max={120} className={inputClass} value={age} onChange={e => setAge(e.target.value)} placeholder="25" /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Profession / Occupation *</label><input required className={inputClass} value={profession} onChange={e => setProfession(e.target.value)} placeholder="Software Engineer" /></div>
            <div><label className={labelClass}>Current Role *</label><input required className={inputClass} value={currentRole} onChange={e => setCurrentRole(e.target.value)} placeholder="Full-stack Developer" /></div>
          </div>

          <div><label className={labelClass}>Short Bio *</label><textarea required rows={3} className={`${inputClass} font-sans leading-relaxed`} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself (min 20 characters)..." /></div>
          <div><label className={labelClass}>Skills / Technologies *</label><input required className={inputClass} value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, TypeScript, Python, AI/ML..." /></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Education</label><input className={inputClass} value={education} onChange={e => setEducation(e.target.value)} placeholder="Optional" /></div>
            <div><label className={labelClass}>Location / Country</label><input className={inputClass} value={location} onChange={e => setLocation(e.target.value)} placeholder="Optional" /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>GitHub URL</label><input type="url" className={inputClass} value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/..." /></div>
            <div><label className={labelClass}>Portfolio URL</label><input type="url" className={inputClass} value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="https://..." /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>LinkedIn URL</label><input type="url" className={inputClass} value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." /></div>
            <div><label className={labelClass}>Other Website / Social</label><input type="url" className={inputClass} value={otherUrl} onChange={e => setOtherUrl(e.target.value)} placeholder="Optional" /></div>
          </div>

          <div><label className={labelClass}>Why do you want to become a Creator? *</label><textarea required rows={3} className={`${inputClass} font-sans leading-relaxed`} value={motivation} onChange={e => setMotivation(e.target.value)} placeholder="Min 30 characters..." /></div>
          <div><label className={labelClass}>What type of projects do you plan to upload? *</label><textarea required rows={2} className={`${inputClass} font-sans leading-relaxed`} value={projectTypes} onChange={e => setProjectTypes(e.target.value)} placeholder="Web apps, AI tools, hardware projects..." /></div>

          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
            <p className="font-mono-custom text-[10px] tracking-widest text-amber-400 uppercase">Creator Responsibility</p>
            <p className="font-sans text-xs text-white/70 leading-relaxed">
              Creators are expected to upload at least one project within 2 days of approval. Accounts that do not meet this requirement may be reviewed or have Creator access removed.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-eg/40 text-eg focus:ring-eg bg-dark" />
              <span className="font-mono-custom text-xs text-white/80">I understand and agree to the Creator requirements.</span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={submitting || !acknowledged} className="btn-primary py-2.5 px-8 text-xs font-mono-custom disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? 'SUBMITTING...' : 'SUBMIT APPLICATION'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default ApplyCreator;
