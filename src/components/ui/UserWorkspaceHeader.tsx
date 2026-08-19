import React from 'react';
import { Link } from 'react-router-dom';
import { IsomerLogo } from '../ui';
import NotificationBell from '../NotificationBell';

interface UserWorkspaceHeaderProps {
  badge?: string;
  backTo?: { label: string; path: string };
  actions?: React.ReactNode;
}

export const UserWorkspaceHeader: React.FC<UserWorkspaceHeaderProps> = ({
  badge = 'WORKSPACE',
  backTo,
  actions,
}) => (
  <header className="glass-dark border-b border-eg/10 sticky top-0 z-30 py-3 px-4 sm:px-6">
    <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Link to="/" className="flex-shrink-0">
          <IsomerLogo size="md" />
        </Link>
        <div className="h-4 w-px bg-eg/20 hidden sm:block flex-shrink-0" />
        <span className="font-mono-custom text-[10px] tracking-widest text-eg/80 uppercase bg-eg/10 px-2 py-0.5 rounded border border-eg/30 hidden sm:inline-block truncate">
          {badge}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <NotificationBell />
        {backTo && (
          <Link
            to={backTo.path}
            className="font-mono-custom text-xs text-white/50 hover:text-eg transition-colors px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-eg/30 hidden sm:inline-flex"
          >
            {backTo.label}
          </Link>
        )}
        {actions}
      </div>
    </div>
  </header>
);
