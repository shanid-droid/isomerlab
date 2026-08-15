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

function calculateAge(dobStr: string): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function formatDateDisplay(dobStr: string): string {
  if (!dobStr) return '';
  const parts = dobStr.split('-');
  if (parts.length !== 3) return dobStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const PRESET_PROFESSIONS = [
  'Student',
  'Software Developer',
  'Web Developer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Mobile App Developer',
  'UI/UX Designer',
  'Graphic Designer',
  'Product Designer',
  'Game Developer',
  'AI/ML Developer',
  'Data Scientist',
  'Data Analyst',
  'Cybersecurity Specialist',
  'Cloud Engineer',
  'DevOps Engineer',
  'Embedded Systems Developer',
  'IoT Developer',
  'Robotics Engineer',
  'Hardware Engineer',
  'Electronics Engineer',
  'Researcher',
  'Teacher / Educator',
  'Content Creator',
  'Video Editor',
  'Photographer',
  '3D Artist',
  'Animator',
  'Entrepreneur',
  'Freelancer',
  'Maker / DIY',
  'Other',
];

const PRESET_ROLES = [
  'Student',
  'Founder',
  'Co-Founder',
  'Developer',
  'Designer',
  'Engineer',
  'Researcher',
  'Teacher',
  'Freelancer',
  'Content Creator',
  'Project Lead',
  'Team Member',
  'Entrepreneur',
  'Intern',
  'Volunteer',
  'Other',
];

const PRESET_EDUCATION = [
  'High School',
  'Higher Secondary',
  'ITI',
  'Diploma',
  'Undergraduate',
  'Bachelor\'s Degree',
  'Postgraduate',
  'Master\'s Degree',
  'PhD',
  'Self-Taught',
  'Other',
];

const PRESET_EXPERIENCE = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Professional',
  'Expert',
];

const PRESET_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'C', 'C++', 'Java', 'HTML/CSS', 'React', 'Next.js', 'Node.js',
  'Flutter', 'React Native', 'SQL', 'Supabase', 'Firebase', 'Git/GitHub', 'UI/UX', 'Figma', '3D Design',
  'Blender', 'Fusion 360', 'CAD', 'AI/ML', 'Computer Vision', 'Cybersecurity', 'Robotics', 'Arduino',
  'ESP32', 'Raspberry Pi', 'IoT', 'Embedded Systems', 'Electronics', 'PCB Design', 'Game Development',
  'Video Editing', 'Photography',
];

const PRESET_PROJECT_TYPES = [
  'Websites', 'Web Apps', 'Mobile Apps', 'Desktop Apps', 'AI / Machine Learning', 'Robotics', 'IoT',
  'Electronics', 'Embedded Systems', 'Cybersecurity', 'Games', '3D / CAD', 'UI/UX', 'Hardware',
  'Research', 'Open Source', 'Creative Projects', 'Other',
];

const ApplyCreator: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useUserProfile();
  const { application, loading: appLoading, refresh } = useCreatorApplication();

  // Personal Info
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [location, setLocation] = useState('');

  // Professional Info
  const [profession, setProfession] = useState('');
  const [professionOther, setProfessionOther] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [roleOther, setRoleOther] = useState('');
  const [education, setEducation] = useState('');
  const [educationDetails, setEducationDetails] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');

  // Skills & Projects
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<string[]>([]);

  // Links
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [otherUrl, setOtherUrl] = useState('');

  // About You
  const [bio, setBio] = useState('');
  const [motivation, setMotivation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const loading = profileLoading || appLoading;
  const computedAge = calculateAge(dateOfBirth);
  const todayISO = new Date().toISOString().split('T')[0];

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

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    const trimmed = customSkillInput.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      setSelectedSkills(prev => [...prev, trimmed]);
      setCustomSkillInput('');
    }
  };

  const toggleProjectType = (type: string) => {
    setSelectedProjectTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const validate = (): string | null => {
    if (!fullName.trim()) return 'Full name is required.';
    if (!dateOfBirth) return 'Date of Birth is required.';
    if (new Date(dateOfBirth) > new Date()) return 'Date of Birth cannot be in the future.';
    if (computedAge === null || computedAge < 10 || computedAge > 120) return 'Please select a valid Date of Birth.';
    if (!profession) return 'Profession is required.';
    if (profession === 'Other' && !professionOther.trim()) return 'Please specify your profession.';
    if (!currentRole) return 'Current Role is required.';
    if (currentRole === 'Other' && !roleOther.trim()) return 'Please specify your current role.';
    if (selectedSkills.length === 0) return 'Please select at least one primary skill.';
    if (selectedProjectTypes.length === 0) return 'Please select at least one project type.';
    if (bio.trim().length < 20) return 'Bio must be at least 20 characters.';
    if (motivation.trim().length < 30) return 'Motivation must be at least 30 characters.';
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

      const finalProfession = profession === 'Other' ? professionOther.trim() : profession;
      const finalRole = currentRole === 'Other' ? roleOther.trim() : currentRole;

      const { error } = await supabase.from('creator_applications').insert([{
        user_id: user.id,
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth,
        age: computedAge,
        profession: finalProfession,
        profession_other: profession === 'Other' ? professionOther.trim() : null,
        applicant_role: finalRole,
        applicant_role_other: currentRole === 'Other' ? roleOther.trim() : null,
        bio: bio.trim(),
        skills: selectedSkills.join(', '),
        education: education || null,
        education_details: educationDetails.trim() || null,
        experience_level: experienceLevel || null,
        location: location.trim() || null,
        github_url: githubUrl.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        other_url: otherUrl.trim() || null,
        motivation: motivation.trim(),
        project_types: selectedProjectTypes.join(', '),
        status: 'pending',
      }]);

      if (error) throw error;

      // Update date_of_birth in profiles table as well
      await supabase.from('profiles').update({ date_of_birth: dateOfBirth }).eq('id', user.id);

      // Check for birthday trigger
      await supabase.rpc('check_and_generate_birthday_notification', { p_user_id: user.id });

      await refresh();
      setSubmitted(true);
    } catch (err: unknown) {
      setFormError((err as Error)?.message ?? 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg font-mono-custom';
  const selectClass = 'w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-eg font-mono-custom cursor-pointer';
  const labelClass = 'block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider mb-1.5';
  const sectionTitleClass = 'font-mono-custom text-xs font-bold tracking-widest text-eg uppercase flex items-center gap-2 pb-2 border-b border-eg/10 mb-4';

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

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 md:p-8 border border-eg/20 space-y-8">
          {formError && (
            <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 font-mono-custom text-xs text-red-300">{formError}</div>
          )}

          {/* SECTION 1: PERSONAL INFORMATION */}
          <div className="space-y-4">
            <h3 className={sectionTitleClass}>
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              1. PERSONAL INFORMATION
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Full Name <span className="text-red-400">*</span></label>
                <input required className={inputClass} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
              </div>

              <div>
                <label className={labelClass}>Date of Birth <span className="text-red-400">*</span></label>
                <input
                  required
                  type="date"
                  max={todayISO}
                  className={inputClass}
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                />
              </div>
            </div>

            {/* Calculated Age & Formatted DOB display */}
            {dateOfBirth && (
              <div className="p-3 rounded-xl bg-eg/5 border border-eg/20 flex flex-wrap gap-4 text-xs font-mono-custom">
                <div>
                  <span className="text-white/40">Date of Birth: </span>
                  <span className="text-eg font-semibold">{formatDateDisplay(dateOfBirth)}</span>
                </div>
                <div>
                  <span className="text-white/40">Calculated Age: </span>
                  <span className="text-eg font-semibold">{computedAge !== null ? `${computedAge} years` : 'Invalid'}</span>
                </div>
              </div>
            )}

            <div>
              <label className={labelClass}>Location / Country (Optional)</label>
              <input className={inputClass} value={location} onChange={e => setLocation(e.target.value)} placeholder="City, State, Country" />
            </div>
          </div>

          {/* SECTION 2: PROFESSIONAL INFORMATION */}
          <div className="space-y-4">
            <h3 className={sectionTitleClass}>
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              2. PROFESSIONAL INFORMATION
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Profession / Occupation <span className="text-red-400">*</span></label>
                <select required className={selectClass} value={profession} onChange={e => setProfession(e.target.value)}>
                  <option value="">Select Profession...</option>
                  {PRESET_PROFESSIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Current Role <span className="text-red-400">*</span></label>
                <select required className={selectClass} value={currentRole} onChange={e => setCurrentRole(e.target.value)}>
                  <option value="">Select Current Role...</option>
                  {PRESET_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {profession === 'Other' && (
              <div>
                <label className={labelClass}>Specify Profession <span className="text-red-400">*</span></label>
                <input required className={inputClass} value={professionOther} onChange={e => setProfessionOther(e.target.value)} placeholder="Your profession..." />
              </div>
            )}

            {currentRole === 'Other' && (
              <div>
                <label className={labelClass}>Specify Current Role <span className="text-red-400">*</span></label>
                <input required className={inputClass} value={roleOther} onChange={e => setRoleOther(e.target.value)} placeholder="Your role..." />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Education Level</label>
                <select className={selectClass} value={education} onChange={e => setEducation(e.target.value)}>
                  <option value="">Select Education...</option>
                  {PRESET_EDUCATION.map(ed => (
                    <option key={ed} value={ed}>{ed}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Experience Level</label>
                <select className={selectClass} value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)}>
                  <option value="">Select Experience Level...</option>
                  {PRESET_EXPERIENCE.map(exp => (
                    <option key={exp} value={exp}>{exp}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Education Details (Optional)</label>
              <input className={inputClass} value={educationDetails} onChange={e => setEducationDetails(e.target.value)} placeholder="Institution name, degree major, etc." />
            </div>
          </div>

          {/* SECTION 3: SKILLS & EXPERIENCE */}
          <div className="space-y-4">
            <h3 className={sectionTitleClass}>
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              3. SKILLS & EXPERIENCE
            </h3>

            <div>
              <label className={labelClass}>Primary Skills <span className="text-red-400">*</span></label>
              <p className="font-mono-custom text-[10px] text-white/40 mb-2">Click tags to select/unselect your primary skills & technologies:</p>

              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_SKILLS.map(s => {
                  const isSelected = selectedSkills.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSkill(s)}
                      className={`px-3 py-1.5 rounded-lg font-mono-custom text-xs border transition-all ${
                        isSelected
                          ? 'bg-eg/20 border-eg text-eg shadow-[0_0_8px_rgba(0,255,136,0.3)]'
                          : 'bg-dark-200/50 border-white/10 text-white/60 hover:border-white/30'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}{s}
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Skill Tag */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={inputClass}
                  value={customSkillInput}
                  onChange={e => setCustomSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                  placeholder="Add custom skill (e.g. ROS, SolidWorks...)"
                />
                <button
                  type="button"
                  onClick={addCustomSkill}
                  className="px-4 py-2.5 rounded-xl border border-eg/30 bg-eg/10 text-eg font-mono-custom text-xs hover:bg-eg/20 transition-all flex-shrink-0"
                >
                  + Add
                </button>
              </div>

              {/* Selected skills summary pill list */}
              {selectedSkills.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-dark-300 border border-eg/10 flex flex-wrap gap-1.5">
                  <span className="font-mono-custom text-[10px] text-white/40 w-full mb-1">Selected Skills ({selectedSkills.length}):</span>
                  {selectedSkills.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded bg-eg/15 border border-eg/30 text-eg text-[10px] font-mono-custom flex items-center gap-1">
                      {s}
                      <button type="button" onClick={() => toggleSkill(s)} className="text-white/40 hover:text-red-400">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Project Types You Plan to Upload <span className="text-red-400">*</span></label>
              <p className="font-mono-custom text-[10px] text-white/40 mb-2">Select the categories of projects you will share:</p>

              <div className="flex flex-wrap gap-2">
                {PRESET_PROJECT_TYPES.map(pt => {
                  const isSelected = selectedProjectTypes.includes(pt);
                  return (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => toggleProjectType(pt)}
                      className={`px-3 py-1.5 rounded-lg font-mono-custom text-xs border transition-all ${
                        isSelected
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                          : 'bg-dark-200/50 border-white/10 text-white/60 hover:border-white/30'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}{pt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 4: LINKS */}
          <div className="space-y-4">
            <h3 className={sectionTitleClass}>
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              4. ONLINE LINKS
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>GitHub URL</label>
                <input type="url" className={inputClass} value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/..." />
              </div>
              <div>
                <label className={labelClass}>Portfolio URL</label>
                <input type="url" className={inputClass} value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>LinkedIn URL</label>
                <input type="url" className={inputClass} value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
              </div>
              <div>
                <label className={labelClass}>Other Website / Social</label>
                <input type="url" className={inputClass} value={otherUrl} onChange={e => setOtherUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>

          {/* SECTION 5: ABOUT YOU */}
          <div className="space-y-4">
            <h3 className={sectionTitleClass}>
              <span className="w-1.5 h-1.5 rounded-full bg-eg" />
              5. ABOUT YOU
            </h3>

            <div>
              <label className={labelClass}>Short Bio <span className="text-red-400">*</span></label>
              <textarea required rows={3} className={`${inputClass} font-sans leading-relaxed`} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself (min 20 characters)..." />
            </div>

            <div>
              <label className={labelClass}>Why do you want to become a Creator? <span className="text-red-400">*</span></label>
              <textarea required rows={3} className={`${inputClass} font-sans leading-relaxed`} value={motivation} onChange={e => setMotivation(e.target.value)} placeholder="What drives you to create and share with the ISOMER community? (min 30 characters)..." />
            </div>
          </div>

          {/* RESPONSIBILITY & ACKNOWLEDGMENT */}
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
