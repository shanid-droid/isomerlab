import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { IsomerLogo } from '../components/ui';
import { logAuthEvent } from '../lib/activityLog';
import { getPostLoginPath } from '../lib/roles';
import type { UserRole } from '../lib/types';

/**
 * /auth/callback
 *
 * Supabase sends the user here after email verification / password reset.
 * With PKCE flow, Supabase's client-side JS automatically exchanges the
 * code in the URL for a session. We just need to wait for that exchange
 * and then redirect the user appropriately.
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Supabase PKCE flow: detectSessionInUrl:true handles the exchange
    // automatically. We listen for the auth state change to know when it's done.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        const provider = session.user.app_metadata?.provider;
        const isGoogle = provider === 'google';
        const createdAt = new Date(session.user.created_at).getTime();
        const isNewUser = Date.now() - createdAt < 60_000;

        if (isGoogle && isNewUser) {
          await logAuthEvent('google_oauth_registration', {
            email: session.user.email ?? undefined,
            provider: 'google',
          });
        } else if (isGoogle) {
          await logAuthEvent('google_oauth_login', {
            email: session.user.email ?? undefined,
            provider: 'google',
          });
        } else {
          await logAuthEvent('user_login', {
            email: session.user.email ?? undefined,
            method: 'email_verification',
          });
        }

        // Ensure profile exists (may have been created by trigger already)
        try {
          await supabase.from('profiles').upsert(
            {
              id: session.user.id,
              full_name:
                session.user.user_metadata?.full_name ||
                session.user.email?.split('@')[0] ||
                'User',
              email: session.user.email || '',
              role: 'user',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        } catch (err) {
          // Profile trigger handles this; non-fatal
          console.warn('[AuthCallback] Profile upsert notice:', err);
        }

        // Redirect based on role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (isMounted) {
          navigate(getPostLoginPath(profile?.role as UserRole | undefined, session.user.id), { replace: true });
        }
      } else if (event === 'PASSWORD_RECOVERY') {
        // Password reset flow — send to dashboard where they can update
        if (isMounted) navigate('/dashboard', { replace: true });
      } else if (event === 'USER_UPDATED') {
        if (isMounted) navigate('/dashboard', { replace: true });
      }
    });

    // Fallback: if no auth event fires within 5s, check session manually
    const timeout = setTimeout(async () => {
      if (!isMounted) return;
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (isMounted) {
          navigate(getPostLoginPath(profile?.role as UserRole | undefined, session.user.id), { replace: true });
        }
      } else {
        if (isMounted) {
          setError(sessionError?.message || 'Verification failed. The link may have expired.');
        }
      }
    }, 5000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col items-center justify-center gap-8 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-eg/5 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 flex flex-col items-center gap-6">
        <IsomerLogo size="lg" />

        {error ? (
          <div className="w-full max-w-md glass rounded-2xl p-8 border border-red-500/30 text-center mt-4">
            <div className="w-14 h-14 rounded-full border border-red-500/40 bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            </div>
            <p className="font-mono-custom text-xs tracking-widest text-red-400 uppercase font-semibold mb-2">VERIFICATION FAILED</p>
            <p className="font-sans text-sm text-white/50 mb-6">{error}</p>
            <a href="/signup" className="btn-primary inline-flex items-center gap-2 text-xs">
              TRY AGAIN
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-eg/30 border-t-eg animate-spin" />
            <div className="text-center space-y-1">
              <p className="font-mono-custom text-xs tracking-widest text-eg/90 uppercase">
                VERIFYING YOUR ACCOUNT...
              </p>
              <p className="font-sans text-xs text-white/30">
                Please wait while we confirm your email address.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
