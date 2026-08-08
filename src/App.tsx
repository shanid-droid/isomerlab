import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar }     from './components/ui';
import Hero           from './components/Hero';
import AboutMission   from './components/AboutMission';
import Projects       from './components/Projects';
import Contact, { Footer } from './components/ContactFooter';
import AdminLogin     from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ProjectDetail  from './pages/ProjectDetail';

/* ── Home page (single-page layout) ──────────────────────────────── */
const HomePage: React.FC = () => (
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

/* ── App with router ─────────────────────────────────────────────── */
const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects/:slug" element={<ProjectDetail />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      {/* Catch-all: redirect unknown paths to home */}
      <Route path="*" element={<HomePage />} />
    </Routes>
  </BrowserRouter>
);

export default App;
