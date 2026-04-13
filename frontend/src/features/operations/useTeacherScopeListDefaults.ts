import { useEffect, useRef } from 'react'

import type { AppRole } from '@/app/roleMatrix'
import type { AcademicYear, CourseAssignment } from '@/types/schemas'

/**
 * Para rol TEACHER: al entrar con institución y años cargados, ajusta filtros de listas
 * según las asignaciones docente–curso (año activo o primero disponible, documento,
 * área y grupo cuando el conjunto es unívoco).
 */
export function useTeacherScopeListDefaults(
  effectiveRole: AppRole,
  teacherId: string | null | undefined,
  institutionId: string | null | undefined,
  academicYears: AcademicYear[],
  teacherAssignments: CourseAssignment[] | undefined,
  setFilterYearId: (v: string | null) => void,
  setFilterTeacherDocExact: (v: string) => void,
  setFilterAcademicAreaId: (v: string | null) => void,
  setFilterGroupId: (v: string | null) => void,
) {
  const appliedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (effectiveRole !== 'TEACHER' || !teacherId || !institutionId) {
      appliedKeyRef.current = null
      return
    }
    const applyKey = `${teacherId}::${institutionId}`
    if (appliedKeyRef.current === applyKey) return
    if (!teacherAssignments?.length || !academicYears.length) return

    const doc = String(teacherAssignments[0].teacher_document_number ?? '').trim()
    if (doc) setFilterTeacherDocExact(doc)

    const yearIds = new Set(teacherAssignments.map((a) => a.academic_year))
    const activeYear = academicYears.find((y) => y.is_active && yearIds.has(y.id))
    const pickedYear =
      activeYear ?? academicYears.find((y) => yearIds.has(y.id)) ?? null
    if (pickedYear) {
      setFilterYearId(pickedYear.id)
      const inYear = teacherAssignments.filter(
        (a) => a.academic_year === pickedYear.id,
      )
      const areaIds = [
        ...new Set(
          inYear.map((a) => a.subject_academic_area).filter((id) => Boolean(id)),
        ),
      ]
      if (areaIds.length === 1) setFilterAcademicAreaId(areaIds[0]!)
      const groupIds = [...new Set(inYear.map((a) => a.group))]
      if (groupIds.length === 1) setFilterGroupId(groupIds[0]!)
    }

    appliedKeyRef.current = applyKey
  }, [
    effectiveRole,
    teacherId,
    institutionId,
    academicYears,
    teacherAssignments,
    setFilterYearId,
    setFilterTeacherDocExact,
    setFilterAcademicAreaId,
    setFilterGroupId,
  ])
}
