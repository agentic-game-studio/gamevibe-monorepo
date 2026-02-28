'use client';

import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-[oklch(var(--muted))] dark:bg-[oklch(var(--muted))/0.3]';

  const variantStyles = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={clsx(baseStyles, variantStyles[variant], className)}
      style={{
        width: width,
        height: height,
      }}
      aria-hidden="true"
    />
  );
}

// Game card skeleton for loading states
export function GameCardSkeleton() {
  return (
    <div className="game-card h-full">
      <div className="relative aspect-video overflow-hidden">
        <Skeleton className="absolute inset-0" />
      </div>
      <div className="p-4">
        <Skeleton className="mb-2 h-6 w-3/4" variant="text" />
        <Skeleton className="mb-4 h-4 w-full" variant="text" />
        <Skeleton className="mb-4 h-4 w-2/3" variant="text" />
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-12" variant="text" />
            <Skeleton className="h-4 w-12" variant="text" />
          </div>
          <Skeleton className="h-4 w-16" variant="text" />
        </div>
      </div>
    </div>
  );
}

// Creator card skeleton for loading states
export function CreatorCardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-[oklch(var(--border))] bg-white p-6 dark:bg-gray-800">
      <div className="mb-4 flex items-center gap-4">
        <Skeleton variant="circular" width={64} height={64} />
        <div className="flex-1">
          <Skeleton className="mb-2 h-5 w-24" variant="text" />
          <Skeleton className="h-4 w-16" variant="text" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
