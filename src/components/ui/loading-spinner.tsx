import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div 
        className={cn(
          'animate-spin rounded-full border-4 border-muted border-t-primary',
          sizeClasses[size]
        )}
      />
    </div>
  );
}

export function LoadingCard({ className }: { className?: string }) {
  return (
    <div className={cn('premium-card p-12 text-center animate-fade-in', className)}>
      <LoadingSpinner size="lg" className="mb-6" />
      <h3 className="text-xl font-semibold text-muted-foreground">Loading...</h3>
      <p className="text-muted-foreground mt-2">Please wait while we fetch your data</p>
    </div>
  );
}

export function LoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="premium-card p-8 text-center">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-lg font-medium">Processing...</p>
      </div>
    </div>
  );
}