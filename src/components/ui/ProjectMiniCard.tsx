import React from 'react';
import { Link } from 'react-router-dom';
import type { ProjectWithCreator } from '../../lib/types';

interface ProjectMiniCardProps {
  project: Pick<
    ProjectWithCreator,
    'id' | 'title' | 'slug' | 'description' | 'thumbnail_url' | 'views_count' | 'creator_name'
  > & { like_count?: number };
  index?: number;
}

export const ProjectMiniCard: React.FC<ProjectMiniCardProps> = ({ project, index = 0 }) => (
  <Link
    to={`/projects/${project.slug}`}
    className="group glass-dark rounded-xl overflow-hidden border border-eg/15 hover:border-eg/40 transition-all duration-300 hover:-translate-y-0.5 flex flex-col h-full"
    style={{ animationDelay: `${index * 50}ms` }}
  >
    <div className="relative h-32 overflow-hidden bg-dark-300 flex-shrink-0">
      {project.thumbnail_url ? (
        <img
          src={project.thumbnail_url}
          alt=""
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="font-display text-lg text-eg/30">{project.title.charAt(0)}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
    <div className="p-3.5 flex-1 flex flex-col min-w-0">
      <h3 className="font-display text-xs font-semibold text-white truncate group-hover:text-eg transition-colors">
        {project.title}
      </h3>
      {project.creator_name && (
        <p className="font-mono-custom text-[10px] text-white/40 mt-0.5 truncate">
          {project.creator_name}
        </p>
      )}
      {project.description && (
        <p className="font-sans text-[11px] text-white/45 mt-1.5 line-clamp-2 leading-relaxed flex-1">
          {project.description}
        </p>
      )}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5 font-mono-custom text-[10px] text-white/35">
        {project.like_count !== undefined && (
          <span className="flex items-center gap-1">
            <span className="text-eg/60">♥</span> {project.like_count}
          </span>
        )}
        {project.views_count != null && project.views_count > 0 && (
          <span>{project.views_count} views</span>
        )}
      </div>
    </div>
  </Link>
);

export function formatRelativeTime(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
