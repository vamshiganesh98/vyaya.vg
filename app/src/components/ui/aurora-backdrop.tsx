import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/** Soft aurora / glow plane */
export function AuroraBackdrop({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,159,138,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,159,138,0.06)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      {!reduce && (
        <>
          <motion.div
            className="absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-accent-3/35 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, 20, 0], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[-20%] left-[-10%] h-80 w-80 rounded-full bg-info/20 blur-3xl"
            animate={{ x: [0, 40, 0], y: [0, -25, 0], opacity: [0.3, 0.55, 0.3] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
    </div>
  )
}
