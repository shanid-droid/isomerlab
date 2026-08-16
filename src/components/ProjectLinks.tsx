import React from 'react';
import type { ProjectLink, ProjectLinkType } from '../lib/types';

/* ── 1. Type Metadata & Options ──────────────────────────────────── */
export interface LinkTypeOption {
  type: ProjectLinkType;
  label: string;
  defaultTitle: string;
  placeholder: string;
}

export const LINK_TYPE_OPTIONS: LinkTypeOption[] = [
  { type: 'website', label: 'Website', defaultTitle: 'Official Website', placeholder: 'https://example.com' },
  { type: 'github', label: 'GitHub', defaultTitle: 'GitHub Repository', placeholder: 'https://github.com/org/repo' },
  { type: 'demo', label: 'Live Demo', defaultTitle: 'Live Demo', placeholder: 'https://app.example.com' },
  { type: 'youtube', label: 'YouTube', defaultTitle: 'Video Walkthrough', placeholder: 'https://youtube.com/watch?v=...' },
  { type: 'docs', label: 'Documentation', defaultTitle: 'Documentation', placeholder: 'https://docs.example.com' },
  { type: 'figma', label: 'Figma', defaultTitle: 'Figma Design', placeholder: 'https://figma.com/file/...' },
  { type: 'download', label: 'Download', defaultTitle: 'Download Build', placeholder: 'https://example.com/download.zip' },
  { type: 'other', label: 'Other', defaultTitle: 'Project Link', placeholder: 'https://...' },
];

/* ── 2. Smart Link Auto-Detection ────────────────────────────────── */
export function autoDetectLinkType(url: string): { type: ProjectLinkType; defaultTitle: string } | null {
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.includes('github.com')) {
    return { type: 'github', defaultTitle: 'GitHub Repository' };
  }
  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    return { type: 'youtube', defaultTitle: 'Video Walkthrough' };
  }
  if (trimmed.includes('figma.com')) {
    return { type: 'figma', defaultTitle: 'Figma Design' };
  }
  if (
    trimmed.includes('docs.') ||
    trimmed.includes('/docs') ||
    trimmed.includes('gitbook.io') ||
    trimmed.includes('readme.io')
  ) {
    return { type: 'docs', defaultTitle: 'Documentation' };
  }
  if (
    trimmed.endsWith('.zip') ||
    trimmed.endsWith('.exe') ||
    trimmed.endsWith('.dmg') ||
    trimmed.endsWith('.apk') ||
    trimmed.endsWith('.tar.gz') ||
    trimmed.includes('/releases/download')
  ) {
    return { type: 'download', defaultTitle: 'Download Build' };
  }
  if (
    trimmed.includes('vercel.app') ||
    trimmed.includes('netlify.app') ||
    trimmed.includes('pages.dev') ||
    trimmed.includes('app.') ||
    trimmed.includes('demo')
  ) {
    return { type: 'demo', defaultTitle: 'Live Demo' };
  }

  return null;
}

/** Ensure URL has https:// protocol if user typed example.com */
export function formatValidUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/* ── 3. High-Tech Minimalist Link Icons ──────────────────────────── */
export const ProjectLinkIcon: React.FC<{ type: ProjectLinkType; className?: string }> = ({
  type,
  className = 'w-4 h-4',
}) => {
  switch (type) {
    case 'github':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'figma':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
          <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
          <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
          <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
          <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
        </svg>
      );
    case 'demo':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    case 'docs':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="16" y2="10" />
        </svg>
      );
    case 'download':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case 'website':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'other':
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      );
  }
};

/* ── 4. Project Links Display Component (Public View) ─────────────── */
export const ProjectLinksDisplay: React.FC<{
  links?: ProjectLink[] | null;
  fallbackGithubUrl?: string | null;
  className?: string;
  variant?: 'hero' | 'compact' | 'footer';
}> = ({ links, fallbackGithubUrl, className = '', variant = 'hero' }) => {
  // Normalize links list with backward compatibility fallback
  const finalLinks: ProjectLink[] = React.useMemo(() => {
    if (links && links.length > 0) {
      return links.filter(l => l.url && l.url.trim() !== '');
    }
    if (fallbackGithubUrl && fallbackGithubUrl.trim() !== '') {
      return [
        {
          id: 'fallback_gh',
          type: 'github',
          title: 'GitHub Repository',
          url: fallbackGithubUrl.trim(),
        },
      ];
    }
    return [];
  }, [links, fallbackGithubUrl]);

  if (finalLinks.length === 0) return null;

  // Single link rendering: Clean, prominent button
  if (finalLinks.length === 1) {
    const single = finalLinks[0];
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <a
          href={formatValidUrl(single.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-xs flex items-center gap-2.5 px-5 py-2.5 shadow-lg group hover:scale-[1.02] transition-transform"
        >
          <ProjectLinkIcon type={single.type} className="w-4 h-4" />
          <span>{single.title || 'View Project Resource'}</span>
          <span className="text-dark/60 font-mono-custom text-[10px]">↗</span>
        </a>
      </div>
    );
  }

  // Multiple links rendering: Responsive, high-tech cyber button grid
  return (
    <div className={`space-y-3 ${className}`}>
      {variant === 'hero' && (
        <div className="font-mono-custom text-[10px] tracking-widest text-white/50 uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-eg" />
          PROJECT LINKS & RESOURCES ({finalLinks.length})
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {finalLinks.map((link) => (
          <a
            key={link.id}
            href={formatValidUrl(link.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="glass px-4 py-2 rounded-xl border border-eg/20 hover:border-eg/60 bg-dark-200/60 hover:bg-eg/10 text-white hover:text-eg transition-all flex items-center gap-2 text-xs font-mono-custom group shadow-sm hover:shadow-eg-sm"
          >
            <span className="text-eg/80 group-hover:text-eg transition-colors">
              <ProjectLinkIcon type={link.type} className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold">{link.title || link.type.toUpperCase()}</span>
            <span className="text-white/30 group-hover:text-eg/60 text-[10px]">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
};

/* ── 5. Project Links Editor Component (Creator / Admin) ─────────── */
export const ProjectLinksEditor: React.FC<{
  links: ProjectLink[];
  onChange: (links: ProjectLink[]) => void;
}> = ({ links, onChange }) => {
  const handleAddLink = () => {
    const newLink: ProjectLink = {
      id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'website',
      title: 'Official Website',
      url: '',
    };
    onChange([...links, newLink]);
  };

  const handleUpdateLink = (id: string, updates: Partial<ProjectLink>) => {
    onChange(
      links.map((link) => {
        if (link.id !== id) return link;
        const updated = { ...link, ...updates };

        // If URL was updated and title is empty/default, auto-detect type & title
        if (updates.url !== undefined) {
          const detected = autoDetectLinkType(updates.url);
          if (detected) {
            // Auto update type if currently default or mismatched
            if (link.type === 'website' || link.type === 'other') {
              updated.type = detected.type;
            }
            // Auto update title if empty or matches standard default
            if (!link.title || link.title === 'Official Website' || link.title === 'Project Link') {
              updated.title = detected.defaultTitle;
            }
          }
        }

        // If type was changed and title matches default title of previous type, update title to new default
        if (updates.type !== undefined && updates.type !== link.type) {
          const prevDefault = LINK_TYPE_OPTIONS.find((o) => o.type === link.type)?.defaultTitle;
          const newDefault = LINK_TYPE_OPTIONS.find((o) => o.type === updates.type)?.defaultTitle;
          if (link.title === prevDefault && newDefault) {
            updated.title = newDefault;
          }
        }

        return updated;
      })
    );
  };

  const handleDeleteLink = (id: string) => {
    onChange(links.filter((l) => l.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...links];
    const item = next[index];
    next[index] = next[index - 1];
    next[index - 1] = item;
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= links.length - 1) return;
    const next = [...links];
    const item = next[index];
    next[index] = next[index + 1];
    next[index + 1] = item;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-mono-custom text-[10px] text-white/60 uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-eg" />
          PROJECT LINKS & REPOSITORIES ({links.length})
        </label>

        <button
          type="button"
          onClick={handleAddLink}
          className="text-xs font-mono-custom text-eg hover:text-white px-2.5 py-1 rounded-lg border border-eg/30 hover:border-eg bg-eg/5 transition-colors flex items-center gap-1"
        >
          <span>+</span> Add Link
        </button>
      </div>

      {links.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-white/15 bg-dark-200/30 text-center space-y-2">
          <p className="font-mono-custom text-xs text-white/40">
            No external links added yet (GitHub, YouTube, Live Demo, Figma, Docs, etc.)
          </p>
          <button
            type="button"
            onClick={handleAddLink}
            className="text-xs font-mono-custom text-eg underline"
          >
            + Add first project link
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {links.map((link, idx) => (
            <div
              key={link.id}
              className="p-3 rounded-xl border border-white/10 bg-dark-200/50 space-y-2.5 hover:border-eg/30 transition-colors"
            >
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Reorder Buttons */}
                <div className="flex items-center gap-1 text-white/40">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveUp(idx)}
                    title="Move link up"
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-xs font-mono-custom"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={idx === links.length - 1}
                    onClick={() => handleMoveDown(idx)}
                    title="Move link down"
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-xs font-mono-custom"
                  >
                    ▼
                  </button>
                </div>

                {/* Type Dropdown */}
                <div className="w-32 sm:w-36 flex-shrink-0">
                  <select
                    value={link.type}
                    onChange={(e) =>
                      handleUpdateLink(link.id, {
                        type: e.target.value as ProjectLinkType,
                      })
                    }
                    className="w-full bg-dark-300 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-custom focus:outline-none focus:border-eg"
                  >
                    {LINK_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.type} value={opt.type}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title / Label Input */}
                <div className="flex-1 min-w-[130px]">
                  <input
                    type="text"
                    required
                    value={link.title}
                    placeholder="Link Label (e.g. Live Demo)"
                    onChange={(e) => handleUpdateLink(link.id, { title: e.target.value })}
                    className="w-full bg-dark-300 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white font-mono-custom focus:outline-none focus:border-eg placeholder-white/20"
                  />
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteLink(link.id)}
                  title="Remove Link"
                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-xs font-mono-custom transition-colors ml-auto"
                >
                  ✕
                </button>
              </div>

              {/* URL Input */}
              <div>
                <input
                  type="text"
                  required
                  value={link.url}
                  placeholder={
                    LINK_TYPE_OPTIONS.find((o) => o.type === link.type)?.placeholder || 'https://...'
                  }
                  onChange={(e) => handleUpdateLink(link.id, { url: e.target.value })}
                  className="w-full bg-dark border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white font-mono-custom focus:outline-none focus:border-eg placeholder-white/20"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
