import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ShimmerButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={cn(
        'shimmer-btn relative inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5',
        'font-display text-sm font-extrabold shadow-[0_12px_36px_rgba(232,197,71,0.28)]',
        'transition-transform active:scale-[0.97] disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
