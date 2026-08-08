import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from './ui';

/* ── Intersection-observer hook ─────────────────────────────────── */
function useVisible(threshold = 0.15) {
  const ref  = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

/* ── Social icons ─────────────────────────────────────────────────── */
const SocialIcon: React.FC<{ href: string; label: string; children: React.ReactNode }> = ({
  href, label, children,
}) => (
  <a
    href={href}
    aria-label={label}
    target="_blank"
    rel="noopener noreferrer"
    className="w-9 h-9 rounded-sm glass border border-eg/15 flex items-center justify-center
               text-white/50 hover:text-eg hover:border-eg/40 hover:shadow-eg-sm
               transition-all duration-300"
  >
    {children}
  </a>
);

/* ── Contact section ────────────────────────────────────────────── */
const Contact: React.FC = () => {
  const { ref, vis } = useVisible(0.1);
  const [formData, setFormData]   = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  };

  const inputClass = `w-full bg-dark-200/60 border border-eg/15 rounded px-4 py-3
    font-sans text-sm text-white placeholder-white/25 outline-none
    transition-all duration-300 focus:border-eg/50 focus:shadow-eg-sm`;

  return (
    <section id="contact" ref={ref} className="py-20 md:py-28 relative bg-circuit">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-eg/20 to-transparent" />

      {/* Ambient radial */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 80%, rgba(0,255,136,0.05) 0%, transparent 70%)' }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div
            className={`text-center mb-12 transition-all duration-700 ${
              vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <p className="section-label justify-center">
              <span className="w-6 h-px bg-eg/50" />
              Let's Connect
              <span className="w-6 h-px bg-eg/50" />
            </p>
            <h2 className="font-display text-2xl md:text-3xl tracking-widest text-white mb-4">
              GET IN TOUCH
            </h2>
            <p className="font-sans text-sm text-white/40 leading-relaxed">
              Have a project in mind or want to collaborate? Drop a message — we read every one.
            </p>
          </div>

          {/* Form or success */}
          <div
            className={`card p-8 transition-all duration-700 delay-200 ${
              vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            {submitted ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-full border border-eg/40 shadow-eg mx-auto flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-eg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="font-display text-sm tracking-widest text-white mb-2">MESSAGE SENT</h3>
                <p className="font-sans text-xs text-white/40">
                  We'll get back to you shortly. Stay focused.
                </p>
              </div>
            ) : (
              <form id="contact-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-name" className="block font-mono-custom text-[10px] tracking-widest text-eg/60 uppercase mb-2">
                      Name
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      required
                      placeholder="Your name"
                      value={formData.name}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block font-mono-custom text-[10px] tracking-widest text-eg/60 uppercase mb-2">
                      Email
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block font-mono-custom text-[10px] tracking-widest text-eg/60 uppercase mb-2">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={5}
                    placeholder="Tell us about your project..."
                    value={formData.message}
                    onChange={handleChange}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <button
                  id="contact-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center text-xs py-3 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ── Footer ─────────────────────────────────────────────────────── */
export const Footer: React.FC = () => {
  const { ref, vis } = useVisible(0.1);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const links = [
    { id: 'home',     label: 'Home' },
    { id: 'about',    label: 'About' },
    { id: 'projects', label: 'Projects' },
    { id: 'contact',  label: 'Contact' },
  ];

  return (
    <footer
      ref={ref}
      className="relative bg-dark border-t border-eg/10 py-10"
    >
      {/* Top gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-eg/20 to-transparent" />

      {/* Dot matrix decoration */}
      <div className="absolute right-8 bottom-6 hidden md:grid grid-cols-6 gap-1.5 opacity-20">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="w-1 h-1 rounded-full bg-eg" />
        ))}
      </div>
      {/* Diagonal lines decoration */}
      <div className="absolute right-20 bottom-6 hidden md:flex flex-col gap-1.5 opacity-20">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-8 h-px bg-eg" style={{ transform: `translateX(${i * 4}px) rotate(-30deg)` }} />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div
          className={`flex flex-col md:flex-row items-center md:items-start justify-between gap-8 transition-all duration-700 ${
            vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Brand */}
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold tracking-widest text-xl text-white">
                ISOM<span className="text-eg">≡</span>R
              </span>
              <span className="font-mono-custom font-light italic text-eg/70 tracking-wider text-[10px] mt-0.5">
                Be inspire!
              </span>
            </div>
          </div>

          {/* Center: copyright + social */}
          <div className="flex flex-col items-center gap-4">
            <p className="font-mono-custom text-[10px] tracking-wider text-white/30">
              © 2025 ISOMER. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <SocialIcon href="#" label="Facebook">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                </svg>
              </SocialIcon>
              <SocialIcon href="#" label="Twitter / X">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </SocialIcon>
              <SocialIcon href="#" label="Instagram">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                </svg>
              </SocialIcon>
              <SocialIcon href="#" label="LinkedIn">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </SocialIcon>
            </div>
          </div>

          {/* Right nav links */}
          <nav className="flex flex-col items-center md:items-end gap-2">
            {links.map(l => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="font-mono-custom text-[10px] tracking-widest uppercase text-white/30 hover:text-eg transition-colors duration-300"
              >
                {l.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom micro tag */}
        <div className="mt-8 pt-6 border-t border-eg/5 flex items-center justify-center">
          <p className="font-mono-custom text-[9px] tracking-widest text-white/15 uppercase">
            Focus · Create · Elevate — ISOMER EST. 2024
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Contact;
