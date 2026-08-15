import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Navbar }      from './components/ui';
import Hero            from './components/Hero';
import AboutMission    from './components/AboutMission';
import Projects        from './components/Projects';
import Contact, { Footer } from './components/ContactFooter';
import AdminLogin      from './pages/AdminLogin';
import AdminDashboard  from './pages/AdminDashboard';
import ProjectDetail   from './pages/ProjectDetail';
import ProtectedRoute  from './components/ProtectedRoute';
import MaintenanceGuard from './components/MaintenanceGuard';
import Login           from './pages/Login';
import Signup          from './pages/Signup';
import UserDashboard   from './pages/UserDashboard';
import AuthCallback    from './pages/AuthCallback';
import PublicProfile   from './pages/PublicProfile';
import ProfileEdit     from './pages/ProfileEdit';
import ApplyCreator    from './pages/ApplyCreator';
import CreatorDashboard from './pages/CreatorDashboard';
import NotificationsPage from './pages/Notifications';
import Leaderboard     from './pages/Leaderboard';
import { supabase } from './lib/supabase';
import { getPostLoginPath } from './lib/roles';

/* ── Home page (single-page layout) ──────────────────────────────── */

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          navigate(getPostLoginPath(profile?.role as 'user' | 'admin' | 'creator' | undefined, session.user.id), { replace: true });
        }
      }
    );
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-dark text-white overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <AboutMission />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

/* ── App with router ─────────────────────────────────────────────── */
const App: React.FC = () => (
  <BrowserRouter>
    <MaintenanceGuard>
      <Routes>
        {/* Public routes */}
        <Route path="/"                element={<HomePage />} />
        <Route path="/projects/:slug"  element={<ProjectDetail />} />
        <Route path="/leaderboard"     element={<Leaderboard />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/signup"          element={<Signup />} />
        <Route path="/admin/login"     element={<AdminLogin />} />

        {/* Auth callback — handles Supabase email verification redirect */}
        <Route path="/auth/callback"   element={<AuthCallback />} />

        {/* Public creator profile page — no auth required */}
        <Route path="/profile/:id"     element={<PublicProfile />} />

        {/* Protected: authenticated user routes */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute>
              <ProfileEdit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/apply-creator"
          element={
            <ProtectedRoute>
              <ApplyCreator />
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator"
          element={
            <ProtectedRoute requireCreator>
              <CreatorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected: admin-only routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch-all: redirect unknown paths to home */}
        <Route path="*" element={<HomePage />} />
      </Routes>
    </MaintenanceGuard>
  </BrowserRouter>
);

export default App;
