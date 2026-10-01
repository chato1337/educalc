import { useEffect, useState, type ReactNode } from 'react'

import { getErrorMessage } from '@/api/errors'
import { RangeField } from '@/components'
import { ActivityFormFields } from '@/features/grading/ActivityFormFields'
import { formatScoreDisplay } from '@/features/grading/activityStatus'
import {
  useCreateComponentSegmentMutation,
  useCreateGradingActivityMutation,
  useGradingSchemeBreakdownQuery,
  usePatchGradingActivityMutation,
  usePatchSegmentWeightsMutation,
  type ComponentSegment,
  type GradingActivity,
  type SubjectComponent,
} from '@/features/grading/gradingApi'
import { SegmentWeightRange } from '@/features/grading/SegmentWeightRange'
import {
  SEGMENT_TEMPLATES,
  SEGMENT_WEIGHT_MIN,
  WEIGHT_SUM_TOLERANCE,
  canResizeSegmentWeights,
  formatWeight,
  parseWeightPercent,
  remainingWeightForComponent,
} from '@/features/grading/planUtils'
import { todayIso } from '@/session/periodUtils'

function SheetFrame({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 min-w-11 text-sm font-semibold text-slate-500"
        >
          Cerrar
        </button>
      </div>
      {children}
    </div>
  )
}

export function GradeGridActivitySheet({
  segmentId,
  segmentName,
  editing,
  existingCount,
  onClose,
}: {
  segmentId: string
  segmentName: string
  editing: GradingActivity | null
  existingCount: number
  onClose: () => void
}) {
  const createActivity = useCreateGradingActivityMutation()
  const patchActivity = usePatchGradingActivityMutation()
  const [name, setName] = useState(editing?.name ?? '')
  const [date, setDate] = useState(editing?.activity_date ?? todayIso())
  const [maxScore, setMaxScore] = useState(editing?.max_score ?? '5.00')
  const [error, setError] = useState('')
  const busy = createActivity.isPending || patchActivity.isPending

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('La actividad necesita un nombre.')
      return
    }
    if (!date) {
      setError('Indica la fecha de la actividad.')
      return
    }
    const max = parseWeightPercent(maxScore) ?? 5
    setError('')
    try {
      if (editing) {
        await patchActivity.mutateAsync({
          id: editing.id,
          body: {
            name: trimmed,
            activity_date: date,
            max_score: formatWeight(max),
          },
        })
      } else {
        await createActivity.mutateAsync({
          segment: segmentId,
          name: trimmed,
          activity_date: date,
          max_score: formatWeight(max),
          sort_order: existingCount,
        })
      }
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo guardar la actividad.'))
    }
  }

  return (
    <SheetFrame
      title={editing ? 'Editar actividad' : 'Nueva actividad'}
      subtitle={segmentName}
      onClose={onClose}
    >
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ActivityFormFields
        form={{ segmentId, editing, name, date, maxScore }}
        onChange={(next) => {
          setName(next.name)
          setDate(next.date)
          setMaxScore(next.maxScore)
        }}
        onSave={() => void save()}
        onCancel={onClose}
        busy={busy}
      />
    </SheetFrame>
  )
}

export function GradeGridWeightSheet({
  schemeId,
  component,
  segments,
  onClose,
}: {
  schemeId: string
  component: SubjectComponent
  segments: ComponentSegment[]
  onClose: () => void
}) {
  const createSegment = useCreateComponentSegmentMutation()
  const patchWeights = usePatchSegmentWeightsMutation()
  const componentSegments = segments
    .filter((segment) => segment.subject_component === component.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const remaining = remainingWeightForComponent(segments, component.id)
  const resizeWeights = canResizeSegmentWeights(componentSegments.length, remaining)
  const single = componentSegments.length === 1 ? componentSegments[0] : null
  const singleIsFull =
    single != null &&
    Math.abs((parseWeightPercent(single.weight_percent) ?? 0) - 100) <=
      WEIGHT_SUM_TOLERANCE
  const canAdd = remaining + 1e-9 >= SEGMENT_WEIGHT_MIN
  const [error, setError] = useState('')
  const [customName, setCustomName] = useState('')
  const [takeRest, setTakeRest] = useState(false)
  const [singleDraft, setSingleDraft] = useState(single?.weight_percent ?? '100.00')
  const [releaseId, setReleaseId] = useState(componentSegments[0]?.id ?? '')
  const [releaseDraft, setReleaseDraft] = useState('')
  const busy = createSegment.isPending || patchWeights.isPending
  const existingNames = new Set(
    componentSegments.map((segment) => segment.name.trim().toLowerCase()),
  )

  async function commitWeights(next: { id: string; weight: number }[]) {
    const updates = next
      .filter((item) => {
        const current = componentSegments.find((segment) => segment.id === item.id)
        const currentWeight = parseWeightPercent(current?.weight_percent) ?? 0
        return Math.abs(currentWeight - item.weight) > WEIGHT_SUM_TOLERANCE
      })
      .map((item) => ({
        id: item.id,
        weight_percent: formatWeight(item.weight),
      }))
    if (updates.length === 0) return
    setError('')
    try {
      await patchWeights.mutateAsync(updates)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron actualizar los pesos.'))
      throw err
    }
  }

  async function lowerSegment(segmentId: string, nextWeight: number) {
    const current = componentSegments.find((segment) => segment.id === segmentId)
    const currentWeight = parseWeightPercent(current?.weight_percent) ?? 0
    const freed = currentWeight - nextWeight
    if (freed + 1e-9 < SEGMENT_WEIGHT_MIN) {
      setError('Libera al menos 5% para poder crear un segmento.')
      return
    }
    setError('')
    try {
      await patchWeights.mutateAsync([
        { id: segmentId, weight_percent: formatWeight(nextWeight) },
      ])
      setTakeRest(true)
      setReleaseDraft('')
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo actualizar el peso.'))
    }
  }

  async function addSegment(name: string) {
    if (!canAdd) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('El segmento necesita un nombre.')
      return
    }
    if (existingNames.has(trimmed.toLowerCase())) {
      setError('Ya hay un segmento con ese nombre.')
      return
    }
    const weight = takeRest
      ? remaining
      : Math.min(
          Number(
            SEGMENT_TEMPLATES.find(
              (template) => template.name.toLowerCase() === trimmed.toLowerCase(),
            )?.defaultWeight ?? remaining,
          ),
          remaining,
        )
    setError('')
    try {
      await createSegment.mutateAsync({
        grading_scheme: schemeId,
        subject_component: component.id,
        name: trimmed,
        weight_percent: formatWeight(weight),
        sort_order: componentSegments.length,
      })
      setTakeRest(false)
      setCustomName('')
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo crear el segmento.'))
    }
  }

  return (
    <SheetFrame
      title={`Pesos · ${component.name}`}
      subtitle={`Catálogo ${component.weight_percent}% · solo lectura`}
      onClose={onClose}
    >
      <p className="text-xs text-slate-500">
        Restante {formatWeight(remaining)}%.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {resizeWeights && (
        <SegmentWeightRange
          segments={componentSegments.map((segment) => ({
            id: segment.id,
            name: segment.name,
            weight: parseWeightPercent(segment.weight_percent) ?? 0,
          }))}
          disabled={busy}
          onCommit={commitWeights}
        />
      )}

      {singleIsFull && single && (
        <div
          onPointerUp={() => {
            const next = parseWeightPercent(singleDraft)
            const current = parseWeightPercent(single.weight_percent) ?? 100
            if (next == null || Math.abs(next - current) <= WEIGHT_SUM_TOLERANCE) return
            void lowerSegment(single.id, next)
          }}
        >
          <RangeField
            label={`Peso de ${single.name}`}
            value={singleDraft}
            min={SEGMENT_WEIGHT_MIN}
            max={100}
            step={5}
            suffix="%"
            formatValue={formatWeight}
            onChange={setSingleDraft}
          />
          <p className="text-[11px] text-slate-400">
            Sin divisor. Baja el peso y suelta para liberar al menos 5%.
          </p>
        </div>
      )}

      {!canAdd && componentSegments.length >= 2 && (
        <div className="space-y-2">
          <p className="text-[11px] text-amber-800">
            La suma está en 100%. Baja un segmento al menos 5% para crear otro.
          </p>
          <select
            value={releaseId}
            onChange={(event) => setReleaseId(event.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm bg-white"
          >
            {componentSegments.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.name} ({segment.weight_percent}%)
              </option>
            ))}
          </select>
          <input
            value={releaseDraft}
            onChange={(event) => setReleaseDraft(event.target.value)}
            inputMode="decimal"
            placeholder="Nuevo peso"
            className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-mono"
          />
          <button
            type="button"
            disabled={busy || !releaseDraft.trim()}
            onClick={() => {
              const next = parseWeightPercent(releaseDraft)
              if (next == null) {
                setError('Escribe un peso válido.')
                return
              }
              void lowerSegment(releaseId, next)
            }}
            className="w-full min-h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Liberar peso
          </button>
        </div>
      )}

      {componentSegments.map((segment) => (
        <label key={segment.id} className="block space-y-1">
          <span className="text-[11px] font-semibold text-slate-500">
            Nombre · {segment.weight_percent}%
          </span>
          <input
            value={segment.name}
            readOnly
            aria-readonly="true"
            className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-700"
          />
        </label>
      ))}

      <div className="flex gap-2">
        <input
          value={customName}
          disabled={!canAdd || busy}
          onChange={(event) => setCustomName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void addSegment(customName)
          }}
          placeholder="Nombre del segmento"
          className="min-w-0 flex-1 h-11 px-3 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-40"
        />
        <button
          type="button"
          disabled={!canAdd || busy || !customName.trim()}
          onClick={() => void addSegment(customName)}
          className="min-h-11 shrink-0 rounded-xl bg-[#1E3A5F] px-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Crear
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SEGMENT_TEMPLATES.map((template) => {
          const exists = existingNames.has(template.name.toLowerCase())
          return (
            <button
              key={template.id}
              type="button"
              disabled={!canAdd || exists || busy}
              onClick={() => void addSegment(template.name)}
              className="min-h-11 text-[11px] font-semibold px-3 rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
            >
              {exists ? template.name : `+ ${template.name}`}
            </button>
          )
        })}
      </div>
      {!canAdd && (
        <p className="text-[11px] text-slate-400">
          Sin 5% libres no se crea un segmento.
        </p>
      )}
    </SheetFrame>
  )
}

function sameTwoDecimals(
  shown: string,
  api: string | number | null | undefined,
): boolean {
  if (api == null) return false
  const raw = String(api).trim()
  if (raw === '') return false
  const parsed = Number(raw.replace(',', '.'))
  if (!Number.isFinite(parsed)) return false
  return parsed.toFixed(2) === shown
}

export function GradeGridDetailSheet({
  schemeId,
  studentId,
  studentName,
  defText,
  onClose,
}: {
  schemeId: string
  studentId: string
  studentName: string
  defText: string
  onClose: () => void
}) {
  const breakdownQuery = useGradingSchemeBreakdownQuery(schemeId, studentId)
  const breakdown = breakdownQuery.data

  useEffect(() => {
    if (defText === '0' || !breakdown?.suggested_grade) return
    if (!sameTwoDecimals(defText, breakdown.suggested_grade)) {
      console.warn('displayDef no coincide con el breakdown', {
        studentId,
        displayDef: defText,
        suggested_grade: breakdown.suggested_grade,
      })
    }
  }, [breakdown?.suggested_grade, defText, studentId])

  return (
    <SheetFrame title={studentName} subtitle="Detalle del periodo" onClose={onClose}>
      <p className="font-mono text-4xl font-bold text-slate-900">{defText}</p>
      <p className="text-[11px] text-slate-400">
        Promedio del periodo. No es la nota oficial hasta aplicar la fila.
      </p>
      {breakdownQuery.isLoading && (
        <p className="text-sm text-slate-400">Cargando desglose…</p>
      )}
      {breakdownQuery.isError && (
        <p className="text-sm text-red-600">
          {getErrorMessage(breakdownQuery.error, 'No se pudo cargar el desglose.')}
        </p>
      )}
      {breakdown?.components.map((component) => (
        <section key={component.component_id} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {component.name}{' '}
            <span className="font-mono normal-case tracking-normal text-slate-400">
              {component.weight_percent}%
            </span>
          </p>
          {component.segments.map((segment) => (
            <div key={segment.segment_id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">
                {segment.name}{' '}
                <span className="font-mono text-[11px] font-normal text-slate-400">
                  {segment.weight_percent}%
                </span>
              </p>
              <ul className="mt-2 space-y-1">
                {segment.activities.map((activity) => (
                  <li
                    key={activity.activity_id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate text-slate-700">{activity.name}</span>
                    <span className="font-mono text-slate-900">
                      {formatScoreDisplay(
                        activity.score == null ? null : String(activity.score),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </SheetFrame>
  )
}
