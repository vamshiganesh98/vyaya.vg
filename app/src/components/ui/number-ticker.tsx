import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'

export function NumberTicker({
  value,
  className,
  decimals = 0,
}: {
  value: number
  className?: string
  decimals?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 90, damping: 28 })
  const inView = useInView(ref, { once: true, margin: '-20px' })

  useEffect(() => {
    if (inView) motionVal.set(value)
  }, [inView, motionVal, value])

  useEffect(() => {
    const unsub = spring.on('change', (v) => {
      if (!ref.current) return
      ref.current.textContent = Math.round(v).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    })
    return unsub
  }, [decimals, spring])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      0
    </span>
  )
}
