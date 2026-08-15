import { useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import { Card, EmptyState, IconDocument, SectionHeader, WriteError } from '@/components'
import {
  useCreateIndicatorsReportMutation,
  useIndicatorsReportsQuery,
} from '@/features/groups/indicatorsReportsApi'
import { useTeacherSession } from '@/session/TeacherSessionContext'

export function IndicatorsReportScreen({
  studentId,
  studentName,
  onBack,
}: {
  studentId: string
  studentName?: string
  onBack: () => void
}) {
  const session = useTeacherSession()
  const director = session.gradeDirectors[0]
  const periodId = session.selectedPeriodId
  const period = session.periods.find((p) => p.id === periodId)
  const existingQuery = useIndicatorsReportsQuery(
    periodId ? { student: studentId, academic_period: periodId } : null,
  )
  const createMutation = useCreateIndicatorsReportMutation()
  const existing = existingQuery.data?.[0]
  const [text, setText] = useState('')
  const [formError, setFormError] = useState('')
  const [writeFailed, setWriteFailed] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!director || !periodId) return
    if (!text.trim()) {
      setFormError('Escribe la observación general del periodo.')
      return
    }
    setFormError('')
    setWriteFailed(false)
    try {
      await createMutation.mutateAsync({
        student: studentId,
        group: director.group,
        academic_period: periodId,
        grade_director: director.teacher,
        general_observations: text.trim(),
        generated_at: new Date().toISOString(),
      })
      setSaved(true)
    } catch (err) {
      setWriteFailed(true)
      setFormError(getErrorMessage(err, 'No se pudo generar el informe.'))
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader
        title="Informe de indicadores"
        subtitle={[studentName, period?.name].filter(Boolean).join(' · ')}
        onBack={onBack}
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {existingQuery.isLoading && (
          <p className="text-sm text-slate-400 text-center py-8">Cargando informe…</p>
        )}
        {existingQuery.isError && (
          <WriteError
            message={getErrorMessage(existingQuery.error, 'No se pudo leer el informe.')}
            onRetry={() => void existingQuery.refetch()}
          />
        )}
        {existing && (
          <Card className="p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Observación general
            </p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {existing.general_observations?.trim() || 'Sin observación registrada.'}
            </p>
            <p className="text-[11px] text-slate-400">
              Director: {existing.grade_director_name} · {existing.group_name}
            </p>
            <p className="text-[11px] text-slate-400">
              La API no permite editar un informe ya generado.
            </p>
          </Card>
        )}
        {!existingQuery.isLoading && !existing && (
          <>
            <p className="text-xs text-slate-500 leading-relaxed">
              Se crea el informe del periodo con la observación general. Requiere que
              seas director de este grupo.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Observación general del periodo…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 resize-none"
            />
            {formError && (
              <WriteError
                message={formError}
                onRetry={writeFailed ? () => void handleSave() : undefined}
                disabled={createMutation.isPending}
              />
            )}
            {saved && (
              <p className="text-xs text-emerald-700">Informe generado.</p>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={createMutation.isPending || !director || !periodId}
              className="w-full h-11 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
            >
              {createMutation.isPending ? 'Guardando…' : 'Generar informe'}
            </button>
            {!director && (
              <EmptyState
                icon={<IconDocument size={24} />}
                title="Solo el director"
                body="La generación de este informe es de director de grupo."
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
