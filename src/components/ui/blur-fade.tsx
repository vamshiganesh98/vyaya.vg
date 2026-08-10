import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Magic UI–style blur fade entrance */
export function BlurFade({
  children,
  className,
  delay = 0,
  yOffset = 12,
}: {
  children: ReactNode
  className?: string
  delay?: number
  yOffset?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: yOffset, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
