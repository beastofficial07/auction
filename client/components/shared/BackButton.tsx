'use client';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

export default function BackButton({ href, label = 'Back', className = '' }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      // Smart back: try browser history, fall back to home
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 group transition-all duration-200 ${className}`}
      aria-label={`Go back — ${label}`}
    >
      {/* Icon pill */}
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
          bg-secondary/40 border border-border/50 text-muted-foreground
          group-hover:border-primary/40 group-hover:bg-primary/8 group-hover:text-primary
          group-active:scale-95"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <path d="M8.5 2L3.5 6.5L8.5 11" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>

      {/* Label */}
      <span className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted-foreground group-hover:text-primary transition-colors">
        {label}
      </span>
    </button>
  );
}
