import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../lib/types';
import { OWNER_ID } from '../lib/constants';
import { isAdminRole, isCreatorRole, resolveUserRole } from '../lib/roles';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireCreator?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireCreator = false,
}) => {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
            setUserId(null);
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setSession(session);
          setUserId(session.user.id);
        }

        let rawRole: string = 'user';
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!error && profile?.role) {
            rawRole = profile.role;
          }
        } catch (err) {
          console.warn('[ProtectedRoute] Profile query notice:', err);
        }

        const effectiveRole = resolveUserRole(session.user.id, rawRole);

        if (isMounted) {
          setUserRole(effectiveRole);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setUserRole(session?.user?.id === OWNER_ID ? 'owner' : 'user');
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
          setUserId(null);
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

  if (!session?.user) {
    return <Navigate to={requireAdmin ? "/admin/login" : "/login"} replace />;
  }

  if (requireAdmin && !isAdminRole(userRole, userId)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireCreator && !isCreatorRole(userRole, userId)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
