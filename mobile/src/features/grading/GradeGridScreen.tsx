import { getErrorMessage } from '@/api/errors'
import {
  EmptyState,
  IconBook,
  IconClipboard,
  SectionHeader,
  WriteError,
} from '@/components'
import { useCourseActivitiesBundle } from '@/features/grading/gradingApi'
import {
  useSessionCourse,
  useTeacherSession,
} from '@/session/TeacherSessionContext'

export type GradeGridFocus = {
  student?: string
  activity?: string
}

export interface GradeGridProps {
  courseId: string
  periodId: string
  studentId?: string
  activityId?: string
  onFocus: (focus: GradeGridFocus) => void
  onBack: () => void
  onGoToPlan: () => void
}

export function GradeGridScreen({
  courseId,
  periodId,
  studentId: _studentId,
  activityId: _activityId,
  onFocus: _onFocus,
  onBack,
  onGoToPlan,
}: GradeGridProps) {
  const course = useSessionCourse(courseId)
  const session = useTeacherSession()
  const period = session.periods.find((item) => item.id === periodId)
  const bundleQuery = useCourseActivitiesBundle(
    course?.groupId && course.subjectId && periodId && session.academicYear
      ? {
          courseAssignmentId: course.id,
          academicPeriodId: periodId,
          groupId: course.groupId,
          academicYearId: session.academicYear.id,
          subjectId: course.subjectId,
        }
      : null,
  )

  if (!course) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Calificar el grupo" onBack={onBack} />
        <EmptyState
          icon={<IconBook size={24} />}
          title="Curso no encontrado"
          body="Esa asignación ya no está en tu lista. Vuelve a Mis cursos."
        />
      </div>
    )
  }

  const subtitle = [course.subject_name, course.group_name, period?.name]
    .filter(Boolean)
    .join(' · ')

  if (!periodId) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader
          title="Calificar el grupo"
          subtitle={subtitle}
          onBack={onBack}
        />
        <EmptyState
          icon={<IconClipboard size={22} />}
          title="No hay periodos para este año"
          body="Pide a coordinación que configure el periodo lectivo. Sin periodo no se puede calificar el grupo."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader
        title="Calificar el grupo"
        subtitle={subtitle}
        onBack={onBack}
      />
      <div className="flex-1 overflow-y-auto">
        {bundleQuery.isLoading && (
          <p className="text-sm text-slate-400 text-center py-12">
            Cargando malla…
          </p>
        )}
        {bundleQuery.isError && (
          <div className="px-6 py-12">
            <WriteError
              message={getErrorMessage(
                bundleQuery.error,
                'No se pudo cargar el esquema.',
              )}
              onRetry={() => void bundleQuery.refetch()}
            />
          </div>
        )}
        {bundleQuery.data && !bundleQuery.data.scheme && (
          <div className="p-4 space-y-3">
            <EmptyState
              icon={<IconClipboard size={22} />}
              title="Este periodo no tiene esquema de actividades"
              body="Crea el plan para definir segmentos, pesos y el calendario. Sin esquema no se puede calificar."
            />
            <button
              type="button"
              onClick={onGoToPlan}
              className="w-full h-11 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold"
            >
              Ir al plan
            </button>
          </div>
        )}
        {bundleQuery.data?.scheme && (
          <p className="text-sm text-slate-500 text-center py-12 px-6">
            La lista de estudiantes llega en el siguiente paso.
          </p>
        )}
      </div>
    </div>
  )
}
