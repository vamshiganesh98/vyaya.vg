import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export function AuroraBackdrop({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('pointer-events-none fixed inset-0 overflow-hidden', className)}>
      {!reduce && (
        <>
          <motion.div
            className="absolute -top-28 right-[-8%] h-96 w-96 rounded-full bg-accent/10 blur-3xl"
            animate={{ x: [0, -40, 0], y: [0, 28, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[-18%] left-[-8%] h-[28rem] w-[28rem] rounded-full bg-info/8 blur-3xl"
            animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
    </div>
  )
}
