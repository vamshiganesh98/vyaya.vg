import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'

/** Magic UI–style number ticker */
export function NumberTicker({
  value,
  className,
  prefix = '',
}: {
  value: number
  className?: string
  prefix?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { damping: 40, stiffness: 120 })
  const inView = useInView(ref, { once: true, margin: '0px' })

  useEffect(() => {
    if (inView) motionValue.set(value)
  }, [inView, motionValue, value])

  useEffect(() => {
    const unsub = spring.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = prefix + Math.round(latest).toLocaleString('en-IN')
      }
    })
    return unsub
  }, [spring, prefix])

  // Keep updating when value changes after first view
  useEffect(() => {
    motionValue.set(value)
  }, [motionValue, value])

  return <span ref={ref} className={cn('tabular-nums', className)} />
}
