import type { GradingActivity } from '@/types/schemas'

export type ActivityForm = {
  segmentId: string
  editing: GradingActivity | null
  name: string
  date: string
  maxScore: string
}

export function ActivityFormFields({
  form,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  form: ActivityForm
  onChange: (form: ActivityForm) => void
  onSave: () => void
  onCancel: () => void
  busy: boolean
  showSegment?: boolean
}) {
  return (
    <div className="space-y-2">
      <input
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        placeholder="Nombre de la actividad"
        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={form.date}
          onChange={(e) => onChange({ ...form, date: e.target.value })}
          className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
        />
        <input
          value={form.maxScore}
          onChange={(e) => onChange({ ...form, maxScore: e.target.value })}
          placeholder="Máx."
          inputMode="decimal"
          className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 font-mono"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="flex-1 h-10 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
