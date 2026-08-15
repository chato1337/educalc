import { useMemo, useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import {
  Avatar,
  EmptyState,
  IconBook,
  LevelChip,
  LoadMoreButton,
  WriteError,
} from '@/components'
import {
  flatInfinitePages,
  infiniteListCount,
} from '@/api/useInfiniteList'
import type { Course } from '@/data'
import { useGradesQuery } from '@/features/grades/gradesApi'
import { levelFromGrade } from '@/features/grades/scaleUtils'
import { useActiveEnrollmentsInfiniteQuery } from '@/features/students/enrollmentsApi'
import { useDebouncedValue } from '@/features/students/studentUtils'
import { useTeacherSession } from '@/session/TeacherSessionContext'
import type { Enrollment } from '@/types/schemas'

export function StudentsSection({
  course,
  groupId: groupIdProp,
  academicYearId,
  selectedStudentId,
  onSelectStudent,
}: {
  course?: Course
  groupId?: string
  academicYearId?: string
  selectedStudentId?: string
  onSelectStudent: (id: string) => void
}) {
  const session = useTeacherSession()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const groupId = groupIdProp ?? course?.groupId
  const yearId = academicYearId ?? session.academicYear?.id
  const periodId = session.selectedPeriodId

  const enrollmentsQuery = useActiveEnrollmentsInfiniteQuery(
    groupId && yearId
      ? {
          group: groupId,
          academic_year: yearId,
          search: debouncedSearch.trim() || undefined,
        }
      : null,
  )
  const gradesQuery = useGradesQuery(
    course && periodId
      ? { course_assignment: course.id, academic_period: periodId }
      : null,
  )

  const levelByStudent = useMemo(() => {
    const map = new Map<string, ReturnType<typeof levelFromGrade>>()
    for (const g of gradesQuery.data ?? []) {
      map.set(g.student, levelFromGrade(g, session.gradingScales))
    }
    return map
  }, [gradesQuery.data, session.gradingScales])

  const rows = useMemo(() => {
    return [...flatInfinitePages(enrollmentsQuery.data)].sort((a, b) =>
      a.student_name.localeCompare(b.student_name, 'es'),
    )
  }, [enrollmentsQuery.data])
  const total = infiniteListCount(enrollmentsQuery.data)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 bg-white border-b border-slate-100">
        <input
          type="text"
          placeholder="Buscar por nombre o documento…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {enrollmentsQuery.isLoading && (
          <p className="text-sm text-slate-400 text-center py-6">Cargando estudiantes…</p>
        )}
        {enrollmentsQuery.isError && (
          <div className="px-1 py-4">
            <WriteError
              message={getErrorMessage(enrollmentsQuery.error, 'No se pudo cargar el grupo.')}
              onRetry={() => void enrollmentsQuery.refetch()}
            />
          </div>
        )}
        {!enrollmentsQuery.isLoading &&
          !enrollmentsQuery.isError &&
          rows.length === 0 && (
            <EmptyState
              icon={<IconBook size={24} />}
              title={search ? 'Sin coincidencias' : 'Sin estudiantes'}
              body={
                search
                  ? 'Prueba con otro nombre o documento.'
                  : 'No hay matrículas activas en este grupo.'
              }
            />
          )}
        {rows.map((s) => (
          <StudentRow
            key={s.id}
            enrollment={s}
            selected={selectedStudentId === s.student}
            level={levelByStudent.get(s.student) ?? null}
            onSelect={() => onSelectStudent(s.student)}
          />
        ))}
        <LoadMoreButton
          hasMore={Boolean(enrollmentsQuery.hasNextPage)}
          isLoadingMore={enrollmentsQuery.isFetchingNextPage}
          onLoadMore={() => void enrollmentsQuery.fetchNextPage()}
          loaded={rows.length}
          total={total}
        />
      </div>
    </div>
  )
}

function StudentRow({
  enrollment,
  selected,
  level,
  onSelect,
}: {
  enrollment: Enrollment
  selected: boolean
  level: ReturnType<typeof levelFromGrade>
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border flex items-center px-3.5 py-3 gap-3 transition-colors ${
        selected
          ? 'bg-[#EBF2FB] border-blue-300'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <Avatar name={enrollment.student_name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {enrollment.student_name}
        </p>
        <p className="text-xs text-slate-400 font-mono">
          {enrollment.student_document_number}
        </p>
      </div>
      {level && <LevelChip level={level} compact />}
    </button>
  )
}
