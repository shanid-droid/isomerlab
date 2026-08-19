import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserProfile, useCreatorApplication } from '../lib/hooks';
import { UserWorkspaceHeader } from '../components/ui/UserWorkspaceHeader';
import { ArrowRight } from '../components/ui';
import { FormSkeleton } from '../components/ui/Skeleton';
import { isAdminRole, isCreatorRole } from '../lib/roles';
import { isValidUrl } from '../lib/validation';

const STEPS = ['About You', 'Your Work', 'Links', 'Review'] as const;
type Step = 0 | 1 | 2 | 3;

function calculateAge(dobStr: string): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

const PRESET_PROFESSIONS = [
  'Student', 'Software Developer', 'Web Developer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'Mobile App Developer', 'UI/UX Designer', 'Graphic Designer',
  'Product Designer', 'Game Developer', 'AI/ML Developer', 'Data Scientist', 'Data Analyst',
  'Cybersecurity Specialist', 'Cloud Engineer', 'DevOps Engineer', 'Embedded Systems Developer',
  'IoT Developer', 'Robotics Engineer', 'Hardware Engineer', 'Electronics Engineer',
  'Researcher', 'Teacher / Educator', 'Content Creator', 'Video Editor', 'Photographer',
  '3D Artist', 'Animator', 'Entrepreneur', 'Freelancer', 'Maker / DIY', 'Other',
];

const PRESET_ROLES = [
  'Student', 'Founder', 'Co-Founder', 'Developer', 'Designer', 'Engineer', 'Researcher',
  'Teacher', 'Freelancer', 'Content Creator', 'Project Lead', 'Team Member', 'Entrepreneur', 'Intern', 'Volunteer', 'Other',
];

const PRESET_EDUCATION = [
  'High School', 'Higher Secondary', 'ITI', 'Diploma', 'Undergraduate', "Bachelor's Degree",
  'Postgraduate', "Master's Degree", 'PhD', 'Self-Taught', 'Other',
];

const PRESET_EXPERIENCE = ['Beginner', 'Intermediate', 'Advanced', 'Professional', 'Expert'];

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

const IC = 'w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-eg font-mono-custom transition-colors';
const SC = `${IC} cursor-pointer`;
const LC = 'block font-mono-custom text-[11px] text-white/60 uppercase tracking-wider mb-1.5';

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-mono-custom text-xs border transition-all ${
                  done
                    ? 'bg-eg/20 border-eg text-eg'
                    : active
                    ? 'bg-eg/10 border-eg text-eg shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                    : 'bg-dark-200 border-white/15 text-white/30'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className={`font-mono-custom text-[9px] tracking-wider uppercase hidden sm:block truncate max-w-[72px] text-center ${
                active ? 'text-eg' : 'text-white/35'
              }`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-6 sm:w-12 flex-shrink-0 ${done ? 'bg-eg/40' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ApplicationStatusPage({
  variant,
  rejectionReason,
}: {
  variant: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
}) {
  const config = {
    pending: {
      label: 'Application Under Review',
      title: 'Your application has been received',
      body: 'We will notify you once your creator application has been reviewed. You can continue exploring ISOMER in the meantime.',
      accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    },
    approved: {
      label: "You're In",
      title: 'Your creator account is ready',
      body: 'Head to your creator dashboard to publish your first project.',
      accent: 'text-eg border-eg/30 bg-eg/10',
    },
    rejected: {
      label: 'Application Not Approved',
      title: 'Your application was not approved at this time',
      body: rejectionReason || 'You may submit a new application when you are ready.',
      accent: 'text-red-400 border-red-500/30 bg-red-500/10',
    },
  }[variant];

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
      <UserWorkspaceHeader badge="CREATOR APPLICATION" backTo={{ label: '← Dashboard', path: '/dashboard' }} />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="glass rounded-2xl p-8 sm:p-10 border border-eg/20 max-w-lg w-full text-center space-y-5 animate-fade-in">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${config.accent}`}>
            {variant === 'pending' && (
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4l2 2" strokeLinecap="round" />
              </svg>
            )}
            {variant === 'approved' && <span className="text-2xl text-eg">✓</span>}
            {variant === 'rejected' && (
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <p className="font-mono-custom text-[10px] tracking-widest text-eg/80 uppercase">{config.label}</p>
          <h1 className="font-display text-xl font-bold text-white">{config.title}</h1>
          <p className="font-sans text-sm text-white/55 leading-relaxed">{config.body}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {variant === 'approved' ? (
              <Link to="/creator" className="btn-primary py-2.5 px-6 text-xs font-mono-custom inline-flex items-center justify-center gap-2">
                OPEN CREATOR DASHBOARD <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : variant === 'rejected' ? (
              <>
                <Link to="/dashboard" className="btn-outline py-2.5 px-6 text-xs font-mono-custom">BACK TO DASHBOARD</Link>
              </>
            ) : (
              <Link to="/dashboard" className="btn-primary py-2.5 px-6 text-xs font-mono-custom inline-block">
                BACK TO DASHBOARD
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const ApplyCreator: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useUserProfile();
  const { application, loading: appLoading, refresh } = useCreatorApplication();

  const [step, setStep] = useState<Step>(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [motivation, setMotivation] = useState('');

  const [profession, setProfession] = useState('');
  const [professionOther, setProfessionOther] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [roleOther, setRoleOther] = useState('');
  const [education, setEducation] = useState('');
  const [educationDetails, setEducationDetails] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<string[]>([]);

  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [otherUrl, setOtherUrl] = useState('');

  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reapplying, setReapplying] = useState(false);

  const loading = profileLoading || appLoading;
  const computedAge = calculateAge(dateOfBirth);
  const todayISO = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
        <UserWorkspaceHeader badge="CREATOR APPLICATION" />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10">
          <FormSkeleton />
        </main>
      </div>
    );
  }

  if (isAdminRole(profile?.role) || isCreatorRole(profile?.role)) {
    navigate(profile?.role === 'creator' ? '/creator' : '/dashboard', { replace: true });
    return null;
  }

  if (application?.status === 'pending' || submitted) {
    return <ApplicationStatusPage variant="pending" />;
  }

  if (application?.status === 'approved') {
    return <ApplicationStatusPage variant="approved" />;
  }

  if (application?.status === 'rejected' && !reapplying) {
    return (
      <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col">
        <UserWorkspaceHeader badge="CREATOR APPLICATION" backTo={{ label: '← Dashboard', path: '/dashboard' }} />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="glass rounded-2xl p-8 sm:p-10 border border-eg/20 max-w-lg w-full text-center space-y-5 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl border border-red-500/30 bg-red-500/10 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            </div>
            <p className="font-mono-custom text-[10px] tracking-widest text-red-400 uppercase">Application Not Approved</p>
            <h1 className="font-display text-xl font-bold text-white">Your application was not approved at this time</h1>
            {application.rejection_reason && (
              <p className="font-sans text-sm text-white/55 leading-relaxed border-l-2 border-red-500/40 pl-4 text-left">
                {application.rejection_reason}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button type="button" onClick={() => setReapplying(true)} className="btn-primary py-2.5 px-6 text-xs font-mono-custom">
                SUBMIT NEW APPLICATION
              </button>
              <Link to="/dashboard" className="btn-outline py-2.5 px-6 text-xs font-mono-custom">BACK TO DASHBOARD</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleProjectType = (type: string) => {
    setSelectedProjectTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const validateStep = (s: Step): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (s === 0) {
      if (!fullName.trim()) errors.fullName = 'Full name is required.';
      if (!dateOfBirth) errors.dateOfBirth = 'Date of birth is required.';
      else if (new Date(dateOfBirth) > new Date()) errors.dateOfBirth = 'Date of birth cannot be in the future.';
      else if (computedAge === null || computedAge < 10 || computedAge > 120) errors.dateOfBirth = 'Please select a valid date of birth.';
      if (bio.trim().length < 20) errors.bio = 'Bio must be at least 20 characters.';
      if (motivation.trim().length < 30) errors.motivation = 'Motivation must be at least 30 characters.';
    }
    if (s === 1) {
      if (!profession) errors.profession = 'Profession is required.';
      if (profession === 'Other' && !professionOther.trim()) errors.professionOther = 'Please specify your profession.';
      if (!currentRole) errors.currentRole = 'Current role is required.';
      if (currentRole === 'Other' && !roleOther.trim()) errors.roleOther = 'Please specify your role.';
      if (selectedSkills.length === 0) errors.skills = 'Select at least one skill.';
      if (selectedProjectTypes.length === 0) errors.projectTypes = 'Select at least one project type.';
    }
    if (s === 2) {
      if (!isValidUrl(githubUrl)) errors.githubUrl = 'Invalid GitHub URL.';
      if (!isValidUrl(portfolioUrl)) errors.portfolioUrl = 'Invalid portfolio URL.';
      if (!isValidUrl(linkedinUrl)) errors.linkedinUrl = 'Invalid LinkedIn URL.';
      if (!isValidUrl(otherUrl)) errors.otherUrl = 'Invalid URL.';
    }
    return errors;
  };

  const goNext = () => {
    const errors = validateStep(step);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please fix the highlighted fields before continuing.');
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setStep((s) => Math.min(3, s + 1) as Step);
  };

  const goBack = () => {
    setFieldErrors({});
    setFormError(null);
    setStep((s) => Math.max(0, s - 1) as Step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allErrors = { ...validateStep(0), ...validateStep(1), ...validateStep(2) };
    if (!acknowledged) allErrors.acknowledged = 'You must acknowledge the creator requirements.';
    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors);
      setFormError('Please complete all required fields.');
      return;
    }

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

      await supabase.from('profiles').update({ date_of_birth: dateOfBirth }).eq('id', user.id);
      await supabase.rpc('check_and_generate_birthday_notification', { p_user_id: user.id });

      await refresh();
      setSubmitted(true);
    } catch (err: unknown) {
      setFormError((err as Error)?.message ?? 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <p className="font-mono-custom text-[10px] text-red-400 mt-1">{fieldErrors[name]}</p>
    ) : null;

  const TagButton = ({
    label,
    selected,
    onClick,
    color = 'eg',
  }: {
    label: string;
    selected: boolean;
    onClick: () => void;
    color?: 'eg' | 'purple';
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg font-mono-custom text-xs border transition-all ${
        selected
          ? color === 'purple'
            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
            : 'bg-eg/20 border-eg text-eg'
          : 'bg-dark-200/50 border-white/10 text-white/60 hover:border-white/30'
      }`}
    >
      {selected ? '✓ ' : '+ '}{label}
    </button>
  );

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col selection:bg-eg/30">
      <UserWorkspaceHeader badge="CREATOR APPLICATION" backTo={{ label: '← Dashboard', path: '/dashboard' }} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="text-center mb-6">
          <p className="font-mono-custom text-[10px] tracking-[0.3em] text-eg/80 uppercase mb-2">ISOMER LAB</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-wider text-white">Become a Creator</h1>
          <p className="font-sans text-sm text-white/50 mt-2">Share what you build. Inspire what comes next.</p>
        </div>

        <StepIndicator current={step} />

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 sm:p-8 border border-eg/20 space-y-6">
          {formError && (
            <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 font-mono-custom text-xs text-red-300">
              {formError}
            </div>
          )}

          {/* Step 0: About You */}
          {step === 0 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-mono-custom text-xs font-bold tracking-widest text-eg uppercase">About You</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LC}>Full Name *</label>
                  <input className={IC} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
                  <FieldError name="fullName" />
                </div>
                <div>
                  <label className={LC}>Date of Birth *</label>
                  <input type="date" max={todayISO} className={IC} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  <FieldError name="dateOfBirth" />
                  {dateOfBirth && computedAge !== null && (
                    <p className="font-mono-custom text-[10px] text-eg/70 mt-1">Age: {computedAge} years</p>
                  )}
                </div>
              </div>
              <div>
                <label className={LC}>Location (optional)</label>
                <input className={IC} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
              </div>
              <div>
                <label className={LC}>Short Bio *</label>
                <textarea rows={3} className={`${IC} font-sans`} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself (min 20 characters)" />
                <FieldError name="bio" />
              </div>
              <div>
                <label className={LC}>Why do you want to become a Creator? *</label>
                <textarea rows={3} className={`${IC} font-sans`} value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder="What drives you to create and share? (min 30 characters)" />
                <FieldError name="motivation" />
              </div>
            </div>
          )}

          {/* Step 1: Your Work */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-mono-custom text-xs font-bold tracking-widest text-eg uppercase">Your Work</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LC}>Profession *</label>
                  <select className={SC} value={profession} onChange={(e) => setProfession(e.target.value)}>
                    <option value="">Select...</option>
                    {PRESET_PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <FieldError name="profession" />
                </div>
                <div>
                  <label className={LC}>Current Role *</label>
                  <select className={SC} value={currentRole} onChange={(e) => setCurrentRole(e.target.value)}>
                    <option value="">Select...</option>
                    {PRESET_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <FieldError name="currentRole" />
                </div>
              </div>
              {profession === 'Other' && (
                <div>
                  <label className={LC}>Specify Profession *</label>
                  <input className={IC} value={professionOther} onChange={(e) => setProfessionOther(e.target.value)} />
                  <FieldError name="professionOther" />
                </div>
              )}
              {currentRole === 'Other' && (
                <div>
                  <label className={LC}>Specify Role *</label>
                  <input className={IC} value={roleOther} onChange={(e) => setRoleOther(e.target.value)} />
                  <FieldError name="roleOther" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LC}>Education</label>
                  <select className={SC} value={education} onChange={(e) => setEducation(e.target.value)}>
                    <option value="">Select...</option>
                    {PRESET_EDUCATION.map((ed) => <option key={ed} value={ed}>{ed}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LC}>Experience Level</label>
                  <select className={SC} value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                    <option value="">Select...</option>
                    {PRESET_EXPERIENCE.map((exp) => <option key={exp} value={exp}>{exp}</option>)}
                  </select>
                </div>
              </div>
              {education && (
                <div>
                  <label className={LC}>Education Details (Degree / Major / Institution)</label>
                  <input className={IC} value={educationDetails} onChange={(e) => setEducationDetails(e.target.value)} placeholder="e.g. B.Tech in Computer Science, MIT" />
                </div>
              )}
              <div>
                <label className={LC}>Primary Skills *</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_SKILLS.map((s) => (
                    <TagButton key={s} label={s} selected={selectedSkills.includes(s)} onClick={() => toggleSkill(s)} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className={IC}
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = customSkillInput.trim();
                        if (t && !selectedSkills.includes(t)) {
                          setSelectedSkills((p) => [...p, t]);
                          setCustomSkillInput('');
                        }
                      }
                    }}
                    placeholder="Add custom skill"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const t = customSkillInput.trim();
                      if (t && !selectedSkills.includes(t)) {
                        setSelectedSkills((p) => [...p, t]);
                        setCustomSkillInput('');
                      }
                    }}
                    className="px-4 py-2 rounded-xl border border-eg/30 bg-eg/10 text-eg font-mono-custom text-xs flex-shrink-0"
                  >
                    Add
                  </button>
                </div>
                <FieldError name="skills" />
              </div>
              <div>
                <label className={LC}>Project Types *</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_PROJECT_TYPES.map((pt) => (
                    <TagButton key={pt} label={pt} selected={selectedProjectTypes.includes(pt)} onClick={() => toggleProjectType(pt)} color="purple" />
                  ))}
                </div>
                <FieldError name="projectTypes" />
              </div>
            </div>
          )}

          {/* Step 2: Links */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-mono-custom text-xs font-bold tracking-widest text-eg uppercase">Links</h3>
              <p className="font-sans text-xs text-white/45">Optional but recommended — helps us understand your work.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LC}>GitHub</label>
                  <input type="url" className={IC} value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." />
                  <FieldError name="githubUrl" />
                </div>
                <div>
                  <label className={LC}>Portfolio</label>
                  <input type="url" className={IC} value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://..." />
                  <FieldError name="portfolioUrl" />
                </div>
                <div>
                  <label className={LC}>LinkedIn</label>
                  <input type="url" className={IC} value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
                  <FieldError name="linkedinUrl" />
                </div>
                <div>
                  <label className={LC}>Website / Social</label>
                  <input type="url" className={IC} value={otherUrl} onChange={(e) => setOtherUrl(e.target.value)} placeholder="https://..." />
                  <FieldError name="otherUrl" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-mono-custom text-xs font-bold tracking-widest text-eg uppercase">Review & Submit</h3>
              <div className="space-y-3 text-sm">
                {[
                  ['Name', fullName],
                  ['Profession', profession === 'Other' ? professionOther : profession],
                  ['Role', currentRole === 'Other' ? roleOther : currentRole],
                  ['Skills', selectedSkills.join(', ')],
                  ['Project Types', selectedProjectTypes.join(', ')],
                  ['Bio', bio],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3 py-2 border-b border-white/5">
                    <span className="font-mono-custom text-[10px] text-white/40 uppercase w-28 flex-shrink-0">{k}</span>
                    <span className="font-sans text-xs text-white/75 flex-1">{v || '—'}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                <p className="font-mono-custom text-[10px] tracking-widest text-amber-400 uppercase">Creator Responsibility</p>
                <p className="font-sans text-xs text-white/70 leading-relaxed">
                  Creators are expected to upload at least one project within 2 days of approval.
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-eg/40 text-eg focus:ring-eg bg-dark" />
                  <span className="font-mono-custom text-xs text-white/80">I understand and agree to the creator requirements.</span>
                </label>
                <FieldError name="acknowledged" />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-eg/10">
            {step > 0 ? (
              <button type="button" onClick={goBack} className="btn-outline py-2 px-5 text-xs font-mono-custom">
                ← Back
              </button>
            ) : (
              <Link to="/dashboard" className="font-mono-custom text-xs text-white/40 hover:text-eg transition-colors">
                Cancel
              </Link>
            )}
            {step < 3 ? (
              <button type="button" onClick={goNext} className="btn-primary py-2 px-6 text-xs font-mono-custom flex items-center gap-2">
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button type="submit" disabled={submitting || !acknowledged} className="btn-primary py-2 px-6 text-xs font-mono-custom disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-dark border-t-transparent animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>Submit Application <ArrowRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
};

export default ApplyCreator;
