import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export function AuroraBackdrop({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      {!reduce && (
        <>
          <motion.div
            className="absolute -top-28 right-[-12%] h-80 w-80 rounded-full bg-gold/25 blur-3xl"
            animate={{ x: [0, -40, 0], y: [0, 28, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[-22%] left-[-12%] h-96 w-96 rounded-full bg-info/20 blur-3xl"
            animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/3 left-1/3 h-56 w-56 rounded-full bg-accent/15 blur-3xl"
            animate={{ opacity: [0.2, 0.45, 0.2] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
    </div>
  )
}
