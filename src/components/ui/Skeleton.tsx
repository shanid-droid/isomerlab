import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded-lg bg-white/5 ${className}`}
    aria-hidden="true"
  />
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-8 animate-fade-in">
    <div className="flex items-center gap-4">
      <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-48 rounded-2xl" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  </div>
);

export const FormSkeleton: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    <Skeleton className="h-8 w-64 mx-auto" />
    <Skeleton className="h-4 w-48 mx-auto" />
    <div className="glass rounded-2xl p-6 border border-eg/15 space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ))}
    </div>
  </div>
);
