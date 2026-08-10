import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase, siteUrl } from '../lib/supabase';
import { IsomerLogo, ArrowRight } from '../components/ui';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailPending = searchParams.get('verified') === 'pending';

  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://isomerlab.vercel.app',
      },
    });
    if (oauthError) {
      setError(oauthError.message || 'Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
    // On success, browser navigates to Google — no further action needed
  };

  // Redirect if already authenticated
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          navigate('/dashboard', { replace: true });
        } else if (isMounted) {
          setCheckingAuth(false);
        }
      } catch (err) {
        if (isMounted) setCheckingAuth(false);
      }
    }

    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Email confirmation not required — session created immediately
      // Ensure profile row exists
      try {
        await supabase.from('profiles').upsert(
          {
            id: data.user!.id,
            full_name: fullName.trim(),
            email: email.trim(),
            role: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (err) {
        console.warn('Profile upsert fallback handled by trigger:', err);
      }
      navigate('/dashboard', { replace: true });
    } else if (data.user) {
      // Email confirmation required — show success message
      setError(null);
      setLoading(false);
      // Navigate to a confirmation pending state
      navigate('/signup?verified=pending', { replace: false });
    } else {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-dark bg-circuit flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
          <span className="font-mono-custom text-xs tracking-widest text-eg/70 uppercase">
            VERIFYING AUTHENTICATION...
          </span>
        </div>
      </div>
    );
  }

  if (emailPending) {
    return (
      <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-eg/5 rounded-full blur-3xl pointer-events-none" />
        <header className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between z-10">
          <Link to="/" className="focus:outline-none"><IsomerLogo size="md" /></Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-12 z-10">
          <div className="w-full max-w-md glass rounded-2xl p-10 border border-eg/20 shadow-2xl relative text-center">
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-eg/60" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-eg/60" />
            <div className="w-16 h-16 rounded-full border-2 border-eg/40 bg-eg/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-eg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-eg/30 bg-eg/10 mb-4">
              <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
              <span className="font-mono-custom text-[10px] tracking-widest text-eg uppercase">VERIFICATION SENT</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-widest text-white mb-3">CHECK YOUR EMAIL</h1>
            <p className="font-sans text-sm text-white/60 leading-relaxed mb-6">
              We've sent a verification link to your email address. Click the link to activate your account and you'll be redirected back to the site automatically.
            </p>
            <Link to="/login" className="btn-primary inline-flex items-center gap-2 text-xs">
              BACK TO SIGN IN <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
        <footer className="p-6 text-center z-10">
          <p className="font-mono-custom text-[10px] tracking-widest text-white/20 uppercase">© 2025 ISOMER. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col justify-between relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-eg/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between z-10">
        <Link to="/" className="focus:outline-none">
          <IsomerLogo size="md" />
        </Link>
        <Link
          to="/"
          className="font-mono-custom text-xs text-white/40 hover:text-eg transition-colors flex items-center gap-1.5"
        >
          ← Back to Site
        </Link>
      </header>

      {/* Form Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 z-10">
        <div className="w-full max-w-md glass rounded-2xl p-8 border border-eg/20 shadow-2xl relative">
          {/* Corner Accents */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-eg/60" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-eg/60" />

          {/* Form Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-eg/30 bg-eg/10 mb-4">
              <span className="w-2 h-2 rounded-full bg-eg animate-pulse" />
              <span className="font-mono-custom text-[10px] tracking-widest text-eg uppercase">
                NEW USER REGISTRATION
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-widest text-white mb-2">
              CREATE ACCOUNT
            </h1>
            <p className="font-sans text-xs text-white/40">
              Sign up to access your personal member dashboard.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 flex items-start gap-3 animate-fade-in">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
              <div className="flex-1">
                <p className="font-mono-custom text-xs font-semibold text-red-400 tracking-wider">
                  REGISTRATION ERROR
                </p>
                <p className="font-sans text-xs text-red-300/80 mt-0.5 leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            id="google-signup-btn"
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 transition-all duration-200 font-mono-custom text-xs tracking-widest text-white/80 hover:text-white ${
              (googleLoading || loading) ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {googleLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            CONTINUE WITH GOOGLE
          </button>

          {/* OR Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-eg/10" />
            <span className="font-mono-custom text-[10px] tracking-widest text-white/25 uppercase">OR</span>
            <div className="flex-1 h-px bg-eg/10" />
          </div>

          {/* Email / Password Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="signup-name"
                className="block font-mono-custom text-[11px] tracking-widest text-white/60 uppercase"
              >
                FULL NAME
              </label>
              <input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                disabled={loading}
                required
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-email"
                className="block font-mono-custom text-[11px] tracking-widest text-white/60 uppercase"
              >
                EMAIL ADDRESS
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                disabled={loading}
                required
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-password"
                className="block font-mono-custom text-[11px] tracking-widest text-white/60 uppercase"
              >
                PASSWORD
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  disabled={loading}
                  required
                  className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-eg transition-colors p-1 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-confirm-password"
                className="block font-mono-custom text-[11px] tracking-widest text-white/60 uppercase"
              >
                CONFIRM PASSWORD
              </label>
              <input
                id="signup-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                disabled={loading}
                required
                className="w-full bg-dark-200/80 border border-eg/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-eg focus:ring-1 focus:ring-eg transition-all font-mono-custom"
              />
            </div>

            <button
              type="submit"
              id="signup-submit-btn"
              disabled={loading}
              className={`w-full btn-primary py-3.5 flex items-center justify-center gap-2 text-xs tracking-widest ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-dark border-t-transparent animate-spin" />
                  CREATING ACCOUNT...
                </>
              ) : (
                <>
                  COMPLETE SIGN UP
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Bottom link to Login */}
          <div className="mt-8 pt-4 border-t border-eg/10 text-center">
            <p className="font-sans text-xs text-white/50">
              Already have an account?{' '}
              <Link to="/login" className="text-eg hover:underline font-mono-custom text-xs">
                LOG IN
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="p-6 text-center z-10">
        <p className="font-mono-custom text-[10px] tracking-widest text-white/20 uppercase">
          © 2025 ISOMER. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Signup;
