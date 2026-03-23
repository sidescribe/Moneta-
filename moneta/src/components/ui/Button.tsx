import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient' | 'glow';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  effect?: 'none' | 'glow' | 'shimmer' | 'magnetic' | 'ripple';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  effect = 'none',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation will-change-transform';

  const variantClasses = {
    primary: 'btn-primary text-white',
    secondary: 'btn-secondary text-white',
    outline: 'border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900 shadow-soft hover:shadow-medium focus:ring-primary-500',
    ghost: 'btn-ghost',
    gradient: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95',
    glow: 'bg-primary-500 hover:bg-primary-600 text-white shadow-glow hover:shadow-glow transform hover:scale-105 active:scale-95'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl'
  };

  const effectClasses = {
    none: '',
    glow: 'hover:shadow-glow',
    shimmer: 'relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700',
    magnetic: 'transform hover:scale-110 active:scale-95',
    ripple: 'relative overflow-hidden before:absolute before:inset-0 before:bg-white/30 before:rounded-full before:scale-0 before:opacity-0 hover:before:scale-150 hover:before:opacity-100 before:transition-all before:duration-500'
  };

  const combinedClasses = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    effectClasses[effect],
    effect !== 'none' ? 'hover-lift' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={combinedClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!loading && Icon && <Icon className="w-4 h-4 mr-2 flex-shrink-0" />}
      <span className="relative z-10">{children}</span>
    </button>
  );
};