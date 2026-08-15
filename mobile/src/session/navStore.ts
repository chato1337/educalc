import { create } from 'zustand'

import type { RollCallOrigin } from '@/features/attendance/rollCallApi'

export type Tab = 'today' | 'courses' | 'group' | 'more'
export type CourseSection = 'attendance' | 'activities' | 'grades' | 'students'
export type GroupTab = 'rollCall' | 'ranking' | 'disciplinary' | 'reports'

export type NavView =
  | { id: 'course'; courseId: string; section: CourseSection }
  | { id: 'roll-call'; courseId: string; origin: RollCallOrigin }
  | { id: 'grade-activity'; courseId: string; activityId: string }
  | { id: 'period-grades'; courseId: string }
  | { id: 'recoveries'; courseId: string }
  | { id: 'scheme-plan'; courseId: string }
  | { id: 'indicators-editor'; studentId: string; courseId?: string }
  | { id: 'student-profile'; studentId: string; courseId?: string }
  | { id: 'grades-bulletin'; studentId?: string }
  | { id: 'indicators-report'; studentId: string; studentName?: string }
  | { id: 'school-record'; studentId: string; studentName?: string }

type NavState = {
  tab: Tab
  view: NavView | null
  selectedCourseId: string | null
  courseSection: CourseSection
  groupTab: GroupTab
  setTab: (tab: Tab) => void
  selectCourse: (courseId: string) => void
  setCourseSection: (section: CourseSection) => void
  setGroupTab: (tab: GroupTab) => void
  openView: (view: NavView) => void
  closeView: () => void
  closeCourse: () => void
  reset: () => void
}

const INITIAL: Pick<
  NavState,
  'tab' | 'view' | 'selectedCourseId' | 'courseSection' | 'groupTab'
> = {
  tab: 'today',
  view: null,
  selectedCourseId: null,
  courseSection: 'attendance',
  groupTab: 'rollCall',
}

/** Phone tab bar: visible on root tabs and when viewing a course from Courses. */
export function phoneShowsTabBar(tab: Tab, view: NavView | null): boolean {
  if (!view) return true
  return view.id === 'course' && tab === 'courses'
}

export const useNavStore = create<NavState>((set, get) => ({
  ...INITIAL,
  setTab: (tab) =>
    set({
      tab,
      view: null,
      ...(tab === 'courses' ? { selectedCourseId: null } : {}),
    }),
  selectCourse: (courseId) =>
    set({
      tab: 'courses',
      selectedCourseId: courseId,
      courseSection: 'attendance',
      view: { id: 'course', courseId, section: 'attendance' },
    }),
  setCourseSection: (section) => {
    const { view, selectedCourseId } = get()
    const courseId =
      view?.id === 'course' ? view.courseId : selectedCourseId
    set({
      courseSection: section,
      ...(courseId
        ? { view: { id: 'course', courseId, section } }
        : {}),
    })
  },
  setGroupTab: (groupTab) => set({ groupTab }),
  openView: (view) => {
    const courseId =
      'courseId' in view && typeof view.courseId === 'string'
        ? view.courseId
        : undefined
    const section =
      view.id === 'course'
        ? view.section
        : view.id === 'grade-activity' || view.id === 'scheme-plan'
          ? 'activities'
          : undefined
    set({
      view,
      ...(courseId ? { selectedCourseId: courseId } : {}),
      ...(section ? { courseSection: section } : {}),
    })
  },
  closeView: () => {
    const { view } = get()
    if (view?.id === 'grade-activity') {
      set({
        courseSection: 'activities',
        view: {
          id: 'course',
          courseId: view.courseId,
          section: 'activities',
        },
      })
      return
    }
    if (view?.id === 'scheme-plan') {
      set({
        courseSection: 'activities',
        view: {
          id: 'course',
          courseId: view.courseId,
          section: 'activities',
        },
      })
      return
    }
    if (view?.id === 'indicators-editor') {
      set({
        view: {
          id: 'student-profile',
          studentId: view.studentId,
          courseId: view.courseId,
        },
      })
      return
    }
    set({ view: null })
  },
  closeCourse: () => set({ selectedCourseId: null, view: null }),
  reset: () => set(INITIAL),
}))
