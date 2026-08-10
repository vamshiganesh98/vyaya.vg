import { motion } from 'motion/react'
import { CHART_COLORS } from '@/lib/types'
import { fmtAmt } from '@/lib/utils'

export function DonutChart({
  total,
  slices,
  onSlice,
}: {
  total: number
  slices: { label: string; value: number; icon?: string }[]
  onSlice?: (label: string) => void
}) {
  const r = 52
  const cx = 60
  const cy = 60
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 120 120" className="drop-shadow-lg">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
          {slices.map((s, i) => {
            const pct = total > 0 ? s.value / total : 0
            const dash = pct * circ
            const thisOffset = offset
            offset += dash
            return (
              <motion.circle
                key={s.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-thisOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.92 }}
                transition={{ delay: 0.05 * i }}
                className="cursor-pointer transition-[stroke-width]"
                onClick={() => onSlice?.(s.label)}
                onMouseEnter={(e) => e.currentTarget.setAttribute('stroke-width', '18')}
                onMouseLeave={(e) => e.currentTarget.setAttribute('stroke-width', '14')}
              />
            )
          })}
          <text
            x={cx}
            y={cy + 5}
            textAnchor="middle"
            fill="currentColor"
            className="fill-foam"
            fontSize="12"
            fontWeight="700"
            fontFamily="Bricolage Grotesque, sans-serif"
          >
            {fmtAmt(total)}
          </text>
        </svg>
      </div>
      <div className="w-full flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSlice?.(s.label)}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/5"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {s.icon} {s.label}
            </span>
            <span className="text-xs font-bold tabular-nums">{fmtAmt(s.value)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
