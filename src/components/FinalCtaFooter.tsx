import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FinalCtaFooter: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  // Contact form state
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVis(true);
      },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    const email = formData.email.trim();
    const message = formData.message.trim();

    if (!name || !email || !message) {
      setError('Please fill in all fields.');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from('contact_messages')
        .insert({ name, email, message });

      if (insertError) throw insertError;
      setSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
    } catch {
      setError('Unable to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer ref={ref} className="bg-dark text-white relative overflow-hidden select-none">
      {/* ── 1. SIGNATURE FINAL CTA ── */}
      <div className="py-24 sm:py-32 md:py-40 border-t border-white/5 relative">
        {/* Subtle ambient green glow behind CTA */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] pointer-events-none opacity-30 blur-[100px]"
          style={{ background: 'radial-gradient(ellipse, rgba(0, 255, 136, 0.15) 0%, transparent 70%)' }}
        />

        <div
          className={`max-w-7xl mx-auto px-6 relative z-10 text-center space-y-8 transition-all duration-700 ${
            vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="font-mono-custom text-xs tracking-[0.3em] text-eg/60 uppercase block">
            NEXT HORIZON
          </span>

          <Link
            to="/apply-creator"
            id="final-cta-link"
            className="group inline-flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-white hover:text-eg transition-colors duration-300"
          >
            <h2 className="font-display font-black text-3xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-none">
              WHAT WILL YOU BUILD?
            </h2>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-eg/30 bg-eg/10 flex items-center justify-center text-eg group-hover:border-eg group-hover:bg-eg group-hover:text-dark transition-all duration-300 group-hover:scale-110 shadow-lg shadow-eg/10">
              <svg className="w-8 h-8 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>

          <p className="font-sans text-sm sm:text-base text-white/40 max-w-md mx-auto pt-2 font-light">
            Publish your experimental architectures, prototypes, and engineering systems.
          </p>
        </div>
      </div>

      {/* ── 2. MINIMAL CONTACT FORM ── */}
      <div id="contact" className="py-16 md:py-24 border-t border-white/5 bg-dark-100/40">
        <div className="max-w-3xl mx-auto px-6 space-y-8">
          <div className="text-center space-y-2">
            <h3 className="font-display text-2xl font-bold tracking-wide text-white">
              GET IN TOUCH
            </h3>
            <p className="font-sans text-xs sm:text-sm text-white/40">
              Direct inquiries, collaboration requests, and laboratory support.
            </p>
          </div>

          <div className="glass-dark rounded-2xl p-6 sm:p-8 border border-white/10">
            {submitted ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-eg/10 border border-eg/30 text-eg mx-auto flex items-center justify-center">
                  ✓
                </div>
                <h4 className="font-display text-sm font-bold text-white tracking-widest uppercase">
                  MESSAGE TRANSMITTED
                </h4>
                <p className="font-sans text-xs text-white/50">
                  Thank you. An ISOMER team member will review and respond promptly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && (
                  <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-300 font-mono-custom">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-custom text-[10px] text-white/40 uppercase mb-1">
                      NAME
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-dark-200/80 border border-white/15 focus:border-eg rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none transition-all font-mono-custom"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-custom text-[10px] text-white/40 uppercase mb-1">
                      EMAIL
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-dark-200/80 border border-white/15 focus:border-eg rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none transition-all font-mono-custom"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono-custom text-[10px] text-white/40 uppercase mb-1">
                    MESSAGE
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe your inquiry..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-dark-200/80 border border-white/15 focus:border-eg rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none transition-all font-mono-custom resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center text-xs py-3 font-bold"
                >
                  {loading ? 'TRANSMITTING...' : 'TRANSMIT MESSAGE →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. MINIMAL TECHNICAL FOOTER ── */}
      <div className="py-12 border-t border-white/5 bg-dark">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand Mark */}
          <div className="flex flex-col items-center md:items-start space-y-1">
            <span className="font-display font-black text-xl tracking-widest text-white">
              ISOM<span className="text-eg">≡</span>R
            </span>
            <span className="font-mono-custom text-[10px] tracking-[0.25em] text-white/30 uppercase">
              FOCUS · CREATE · ELEVATE
            </span>
          </div>

          {/* Center: Copyright */}
          <p className="font-mono-custom text-[10px] tracking-wider text-white/30">
            © 2026 ISOMER LAB. All systems nominal.
          </p>

          {/* Right: Back to top */}
          <button
            onClick={scrollToTop}
            className="font-mono-custom text-[10px] tracking-widest text-white/40 hover:text-eg transition-colors uppercase flex items-center gap-1.5"
          >
            <span>BACK TO TOP</span>
            <span>↑</span>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default FinalCtaFooter;
