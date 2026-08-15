import { getErrorMessage, isNotFoundError } from '@/api/errors'
import { Card, EmptyState, IconDocument, SectionHeader } from '@/components'
import { useSchoolRecordQuery } from '@/features/groups/schoolRecordsApi'
import { useTeacherSession } from '@/session/TeacherSessionContext'

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SchoolRecordScreen({
  studentId,
  studentName,
  onBack,
}: {
  studentId: string
  studentName?: string
  onBack: () => void
}) {
  const session = useTeacherSession()
  const year = session.academicYear
  const query = useSchoolRecordQuery(studentId, year?.id ?? null)

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader
        title="Registro escolar"
        subtitle={[studentName, year ? String(year.year) : null]
          .filter(Boolean)
          .join(' · ')}
        onBack={onBack}
      />
      <div className="flex-1 overflow-y-auto p-4">
        {query.isLoading && (
          <p className="text-sm text-slate-400 text-center py-8">
            Generando registro…
          </p>
        )}
        {query.isError && (
          <EmptyState
            icon={<IconDocument size={24} />}
            title={isNotFoundError(query.error) ? 'No disponible' : 'Error'}
            body={getErrorMessage(
              query.error,
              'No hay matrícula activa o el estudiante está fuera de alcance.',
            )}
          />
        )}
        {query.data && (
          <Card className="divide-y divide-slate-100">
            <Row label="Estudiante" value={query.data.student_name} />
            <Row label="Grupo" value={query.data.group_name} />
            <Row label="Sede" value={query.data.campus_name} />
            <Row label="Institución" value={query.data.institution_name} />
            <Row label="Generado" value={formatDateTime(query.data.generated_at)} />
          </Card>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}
