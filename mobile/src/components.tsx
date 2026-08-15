import { type PerformanceLevel, type AttendanceStatus, LEVEL_CONFIG, ATTENDANCE_CONFIG } from './data'

// ─── Icons ────────────────────────────────────────────────────────────────────

export function IconHome({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h4a1 1 0 001-1v-3h2v3a1 1 0 001 1h4a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  )
}

export function IconBook({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
    </svg>
  )
}

export function IconUsers({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  )
}

export function IconMenu({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
    </svg>
  )
}

export function IconCalendar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  )
}

export function IconStar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

export function IconClipboard({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  )
}

export function IconPencil({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  )
}

export function IconArrowLeft({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  )
}

export function IconChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  )
}

export function IconChevronDown({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

export function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  )
}

export function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

export function IconAlert({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  )
}

export function IconRefresh({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
  )
}

export function IconDocument({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  )
}

export function IconLogout({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
  )
}

export function IconLock({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Shared Components ────────────────────────────────────────────────────────

export function LevelChip({ level, compact = false }: { level: PerformanceLevel; compact?: boolean }) {
  const cfg = LEVEL_CONFIG[level]
  return (
    <span className={`inline-flex items-center gap-1 rounded font-mono font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border} ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'}`}>
      {level}
      {!compact && <span className="font-sans font-normal text-[10px] opacity-70">{cfg.label}</span>}
    </span>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
  return (
    <div className={`${sizeClass} rounded-full bg-blue-100 text-blue-800 font-semibold flex items-center justify-center shrink-0 select-none`}>
      {initials}
    </div>
  )
}

export function AttendanceButton({ status, active, onClick }: { status: AttendanceStatus; active: boolean; onClick: () => void }) {
  const cfg = ATTENDANCE_CONFIG[status]
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] min-w-[44px] rounded-lg text-xs font-semibold transition-colors border ${
        active
          ? `${cfg.activeBg} ${cfg.activeColor} border-transparent`
          : `${cfg.bg} ${cfg.color} border-slate-200 hover:border-slate-300`
      }`}
      style={{ padding: '0 10px' }}
    >
      {cfg.short}
    </button>
  )
}

export function PendingBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
      {count}
    </span>
  )
}

export function SectionHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
      {onBack && (
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 -ml-1 text-slate-600">
          <IconArrowLeft size={20} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 ${className}`}>
      {children}
    </div>
  )
}

export function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-8 gap-4">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-slate-700">{title}</p>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

export function WriteError({
  message,
  onRetry,
  disabled,
}: {
  message: string
  onRetry?: () => void
  disabled?: boolean
}) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2 text-xs text-red-700">
      <IconAlert size={14} />
      <span className="flex-1 min-w-0 leading-relaxed">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="shrink-0 font-semibold hover:underline disabled:opacity-50"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

export function LoadMoreButton({
  hasMore,
  isLoadingMore,
  onLoadMore,
  loaded,
  total,
}: {
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  loaded?: number
  total?: number
}) {
  if (!hasMore) return null
  const label =
    total != null && loaded != null
      ? `Cargar más (${loaded}/${total})`
      : 'Cargar más'
  return (
    <button
      type="button"
      onClick={onLoadMore}
      disabled={isLoadingMore}
      className="w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
    >
      {isLoadingMore ? 'Cargando…' : label}
    </button>
  )
}

export function Pill({ children, color = 'default' }: { children: React.ReactNode; color?: 'default' | 'blue' | 'green' | 'amber' | 'red' }) {
  const colors = {
    default: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

export function CourseBadge({ subject, group, campus }: { subject: string; group: string; campus: string }) {
  return (
    <div className="flex items-start gap-2 bg-[#EBF2FB] border border-blue-200 rounded-xl px-3 py-2.5">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-blue-900 truncate">{subject} · {group}</p>
        <p className="text-xs text-blue-600 truncate">{campus}</p>
      </div>
    </div>
  )
}

export function ScoreKeypad({
  value,
  maxScore,
  onChange,
  onClose,
  studentName,
}: {
  value: string
  maxScore: number
  onChange: (v: string) => void
  onClose: () => void
  studentName: string
}) {
  const handleKey = (k: string) => {
    if (k === 'DEL') {
      onChange(value.slice(0, -1))
      return
    }
    if (k === '.') {
      if (value.includes('.')) return
      onChange(value + '.')
      return
    }
    const next = value + k
    const num = parseFloat(next)
    if (!isNaN(num) && num > maxScore) return
    if (next.split('.')[1]?.length > 2) return
    onChange(next)
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL']
  const num = parseFloat(value)
  const valid = value === '' || (!isNaN(num) && num >= 0 && num <= maxScore)

  return (
    <div className="bg-white border-t border-slate-200 p-4 safe-area-bottom">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-slate-500">Calificando</p>
          <p className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">{studentName}</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-2xl font-bold ${valid ? 'text-slate-900' : 'text-red-500'}`}>
            {value || <span className="text-slate-300">—</span>}
          </p>
          <p className="text-xs text-slate-400">máx {maxScore.toFixed(1)}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {keys.map(k => (
          <button
            key={k}
            onClick={() => handleKey(k)}
            className={`h-12 rounded-xl font-mono text-lg font-semibold transition-colors ${
              k === 'DEL'
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300'
            }`}
          >
            {k === 'DEL' ? '⌫' : k}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full h-12 rounded-xl bg-[#1E3A5F] text-white font-semibold text-sm hover:bg-[#2D5A8E] transition-colors"
      >
        Aceptar
      </button>
    </div>
  )
}
