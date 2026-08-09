import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../lib/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (isMounted) {
            setSession(null);
            setUserRole(null);
            setLoading(false);
          }
          return;
        }

        if (isMounted) setSession(session);

        // Fetch user profile role from public.profiles table using auth.uid() (session.user.id)
        let fetchedRole: UserRole = 'user';
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!error && profile?.role === 'admin') {
            fetchedRole = 'admin';
          }
        } catch (err) {
          console.warn('[ProtectedRoute] Profile query notice:', err);
        }

        if (isMounted) {
          setUserRole(fetchedRole);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setUserRole('user');
          setLoading(false);
        }
      }
    }

    checkAuthAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        if (!session) {
          setSession(null);
          setUserRole(null);
          setLoading(false);
        } else {
          checkAuthAndRole();
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
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

  // 1. Unauthenticated users
  if (!session?.user) {
    return <Navigate to={requireAdmin ? "/admin/login" : "/login"} replace />;
  }

  // 2. Authenticated non-admin attempting admin route
  if (requireAdmin && userRole !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
