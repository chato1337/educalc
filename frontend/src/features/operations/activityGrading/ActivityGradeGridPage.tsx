import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import GroupsIcon from '@mui/icons-material/Groups'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import type { AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import { useTheme, type PaletteMode } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AllCommunityModule,
  ModuleRegistry,
  colorSchemeDark,
  colorSchemeLight,
  themeQuartz,
  type CellValueChangedEvent,
  type ColDef,
  type ColGroupDef,
  type ICellRendererParams,
  type IHeaderGroupParams,
  type IHeaderParams,
  type SuppressKeyboardEventParams,
  type TabToNextCellParams,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { useAcademicYearsQuery } from '@/features/academic-structure/academicQueries'
import { todayIsoDate } from '@/features/operations/activityPlanning/activityPlanningUtils'
import { usePlanningSchemeSelection } from '@/features/operations/activityPlanning/planningQueries'
import { PlanningActivityDialog } from '@/features/operations/activityPlanning/PlanningActivityDialog'
import {
  displayDef,
  groupCanApplySuggestion,
} from '@/features/operations/activityGrading/gradeGridMath'
import { SegmentWeightDialog } from '@/features/operations/activityGrading/SegmentWeightDialog'
import { StudentGradeDetailDialog } from '@/features/operations/activityGrading/StudentGradeDetailDialog'
import {
  applyGradingSchemeSuggestion,
  applyGradingSchemeSuggestionBulk,
  fetchComponentSegmentsForScheme,
  fetchGradingActivitiesForScheme,
  fetchGradingScheme,
  fetchStudentActivityScoresForScheme,
  fetchSubjectComponentsForSubject,
  formatGradingSchemeOptionLabel,
  patchStudentActivityScore,
  createStudentActivityScore,
  type ComponentSegment,
  type GradingActivity,
  type GradingScheme,
  type StudentActivityScore,
  type SubjectComponent,
} from '@/features/operations/gradingApi'
import {
  fetchAllEnrollments,
  useAcademicPeriodsForYear,
} from '@/features/operations/operationsQueries'
import { useUiStore } from '@/stores/uiStore'
import type { AcademicPeriod, Enrollment } from '@/types/schemas'

ModuleRegistry.registerModules([AllCommunityModule])

const SCORE_MIN_WIDTH = 96
const SCORE_PATTERN = /^-?\d{0,2}(\.\d{0,2})?$/

type SegmentTint = {
  cell: string
  cellText: string
  header: string
  headerText: string
}

const SEGMENT_TINTS: Record<PaletteMode, SegmentTint[]> = {
  light: [
    { cell: '#DBEAFE', cellText: '#172554', header: '#1D4ED8', headerText: '#FFFFFF' },
    { cell: '#FEF3C7', cellText: '#78350F', header: '#9A3412', headerText: '#FFFFFF' },
    { cell: '#D1FAE5', cellText: '#064E3B', header: '#065F46', headerText: '#FFFFFF' },
    { cell: '#EDE9FE', cellText: '#4C1D95', header: '#5B21B6', headerText: '#FFFFFF' },
  ],
  dark: [
    { cell: '#1A3358', cellText: '#E0F2FE', header: '#1D4ED8', headerText: '#FFFFFF' },
    { cell: '#3A2A12', cellText: '#FEF3C7', header: '#9A3412', headerText: '#FFFFFF' },
    { cell: '#12352A', cellText: '#D1FAE5', header: '#065F46', headerText: '#FFFFFF' },
    { cell: '#2C2148', cellText: '#EDE9FE', header: '#5B21B6', headerText: '#FFFFFF' },
  ],
}

const COMPONENT_HEADER: Record<PaletteMode, { background: string; color: string }> = {
  light: { background: '#0F172A', color: '#FFFFFF' },
  dark: { background: '#475569', color: '#F8FAFC' },
}

type GradeRow = {
  id: string
  studentName: string
  documentNumber: string
  scores: Record<string, string>
  scoreIds: Record<string, string>
}

type GradeModel = {
  weightsValid: boolean
  activityIds: string[]
  activitiesById: Map<string, GradingActivity>
  componentOrder: Array<{
    id: string
    weightPercent: string
    segments: Array<{ id: string; weightPercent: string; activityIds: string[] }>
  }>
}

type GridActions = {
  onEditActivity: (activity: GradingActivity) => void
  onAddActivity: (segmentId: string) => void
  onOpenWeights: (componentId: string) => void
  onOpenDetail: (row: GradeRow) => void
  onApplyRow: (row: GradeRow) => void
  applyingStudentId: string | null
}

type GridContext = {
  actions: { current: GridActions }
  model: { current: GradeModel }
}

function periodCoversToday(period: AcademicPeriod, today: string): boolean {
  const start = period.start_date?.slice(0, 10)
  const end = period.end_date?.slice(0, 10)
  if (!start || !end) return false
  return start <= today && today <= end
}

function currentAcademicPeriod(periods: AcademicPeriod[], today: string): AcademicPeriod | null {
  const current = periods.filter((period) => periodCoversToday(period, today))
  current.sort((a, b) => b.number - a.number)
  return current[0] ?? null
}

function formatPeriodLabel(period: AcademicPeriod): string {
  return `${period.academic_year_year} · ${period.name}`
}

function labelWidth(label: string): number {
  return Math.min(280, Math.max(SCORE_MIN_WIDTH, Math.ceil(label.length * 7.5 + 52)))
}

function compareByOrder(
  a: { sort_order?: number; name: string },
  b: { sort_order?: number; name: string },
): number {
  const order = (a.sort_order ?? 0) - (b.sort_order ?? 0)
  if (order !== 0) return order
  return a.name.localeCompare(b.name, 'es')
}

function activityColumnIds(api: TabToNextCellParams<GradeRow>['api']): string[] {
  return (api.getColumns() ?? [])
    .map((column) => column.getColId())
    .filter((id) => id.startsWith('score:'))
}

function activityNeighbor(
  api: TabToNextCellParams<GradeRow>['api'],
  rowIndex: number,
  colId: string,
  backwards: boolean,
): { rowIndex: number; colId: string } | null {
  const ids = activityColumnIds(api)
  const rowCount = api.getDisplayedRowCount()
  if (ids.length === 0 || rowCount === 0 || rowIndex < 0) return null
  const index = ids.indexOf(colId)
  if (index >= 0) {
    let nextIndex = index + (backwards ? -1 : 1)
    let nextRow = rowIndex
    if (nextIndex < 0) {
      nextRow -= 1
      nextIndex = ids.length - 1
    } else if (nextIndex >= ids.length) {
      nextRow += 1
      nextIndex = 0
    }
    if (nextRow < 0 || nextRow >= rowCount) return null
    return { rowIndex: nextRow, colId: ids[nextIndex]! }
  }

  const displayed = api.getAllDisplayedColumns?.() ?? api.getColumns() ?? []
  const positions = displayed.map((column) => column.getColId())
  const currentPos = positions.indexOf(colId)
  const firstPos = positions.indexOf(ids[0]!)
  const beforeActivities = currentPos >= 0 && firstPos >= 0 && currentPos < firstPos
  if (beforeActivities) {
    if (!backwards) return { rowIndex, colId: ids[0]! }
    if (rowIndex <= 0) return null
    return { rowIndex: rowIndex - 1, colId: ids[ids.length - 1]! }
  }
  if (backwards) return { rowIndex, colId: ids[ids.length - 1]! }
  if (rowIndex >= rowCount - 1) return null
  return { rowIndex: rowIndex + 1, colId: ids[0]! }
}

function tabToNextCell(params: TabToNextCellParams<GradeRow>) {
  const current = params.previousCellPosition
  const next = activityNeighbor(
    params.api,
    current.rowIndex,
    current.column.getColId(),
    params.backwards,
  )
  if (!next) return true
  const column = params.api.getColumn(next.colId)
  if (!column) return true
  return { rowIndex: next.rowIndex, rowPinned: null, column }
}

function suppressActivityEnter(
  params: SuppressKeyboardEventParams<GradeRow>,
): boolean {
  if (params.event.key !== 'Enter' || !params.editing) return false
  const colId = params.column.getColId()
  if (!colId.startsWith('score:')) return false
  const rowIndex = params.node.rowIndex
  if (rowIndex == null) return true
  const next = activityNeighbor(params.api, rowIndex, colId, false)
  params.api.stopEditing()
  if (next) {
    queueMicrotask(() => {
      params.api.setFocusedCell(next.rowIndex, next.colId)
      params.api.startEditingCell({
        rowIndex: next.rowIndex,
        colKey: next.colId,
      })
    })
  }
  return true
}

function normalizeScore(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(',', '.')
}

function sameScore(a: string, b: string): boolean {
  if (a === '' && b === '') return true
  if (a === '' || b === '') return false
  const left = Number(a)
  const right = Number(b)
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.001
}

function validateScore(
  raw: unknown,
  maxScore: string,
):
  | { ok: true; value: string | null }
  | { ok: false; reason: 'format' | 'max' } {
  const text = normalizeScore(raw)
  if (text === '') return { ok: true, value: null }
  if (!SCORE_PATTERN.test(text)) return { ok: false, reason: 'format' }
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return { ok: false, reason: 'format' }
  const max = Number(String(maxScore).replace(',', '.'))
  if (Number.isFinite(max) && value > max) return { ok: false, reason: 'max' }
  return { ok: true, value: text }
}

function defForRow(row: GradeRow, model: GradeModel): string {
  const scoreByActivity = new Map(
    model.activityIds.map((activityId) => [activityId, row.scores[activityId] ?? '']),
  )
  return displayDef({
    weightsValid: model.weightsValid,
    activityIds: model.activityIds,
    scoreByActivity,
    components: model.componentOrder.map((component) => ({
      weightPercent: component.weightPercent,
      segments: component.segments.map((segment) => ({
        weightPercent: segment.weightPercent,
        scores: segment.activityIds.map((activityId) => row.scores[activityId] || null),
      })),
    })),
  })
}

function ComponentGroupHeader(
  props: IHeaderGroupParams<GradeRow, GridContext> & {
    componentId: string
    label: string
    tint: string
    textColor: string
  },
) {
  const { t } = useTranslation()
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        width: '100%',
        height: '100%',
        minWidth: 0,
        px: 1,
        py: 0.75,
        bgcolor: props.tint,
        color: props.textColor,
      }}
    >
      <Typography
        variant="caption"
        noWrap
        sx={{ fontWeight: 700, flex: 1, minWidth: 0, color: 'inherit' }}
      >
        {props.label}
      </Typography>
      <Tooltip title={t('activityGrading.gradeGrid.openWeights')}>
        <IconButton
          size="small"
          aria-label={t('activityGrading.gradeGrid.openWeights')}
          sx={{ color: 'inherit' }}
          onClick={() => props.context.actions.current.onOpenWeights(props.componentId)}
        >
          <TuneOutlinedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

function SegmentGroupHeader(
  props: IHeaderGroupParams<GradeRow, GridContext> & {
    segmentId: string
    label: string
    tint: string
    textColor: string
  },
) {
  const { t } = useTranslation()
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        width: '100%',
        height: '100%',
        minWidth: 0,
        px: 1,
        py: 0.75,
        bgcolor: props.tint,
        color: props.textColor,
      }}
    >
      <Typography
        variant="caption"
        noWrap
        sx={{ fontWeight: 600, flex: 1, minWidth: 0, color: 'inherit' }}
      >
        {props.label}
      </Typography>
      <Tooltip title={t('activityGrading.gradeGrid.addActivity')}>
        <IconButton
          size="small"
          aria-label={t('activityGrading.gradeGrid.addActivity')}
          sx={{ color: 'inherit' }}
          onClick={() => props.context.actions.current.onAddActivity(props.segmentId)}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

function ActivityColumnHeader(
  props: IHeaderParams<GradeRow, GridContext> & { activityId: string; textColor: string },
) {
  const activity = props.context.model.current.activitiesById.get(props.activityId)
  return (
    <Box
      component="button"
      type="button"
      title={props.displayName}
      onClick={() => {
        if (activity) props.context.actions.current.onEditActivity(activity)
      }}
      sx={{
        border: 0,
        p: 0,
        m: 0,
        bgcolor: 'transparent',
        color: props.textColor,
        cursor: 'pointer',
        font: 'inherit',
        fontWeight: 600,
        fontSize: 12,
        textAlign: 'left',
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {props.displayName}
    </Box>
  )
}

function ActionsCell(props: ICellRendererParams<GradeRow, string, GridContext>) {
  const { t } = useTranslation()
  const row = props.data
  if (!row) return null
  const grade = defForRow(row, props.context.model.current)
  const applying = props.context.actions.current.applyingStudentId === row.id
  const disabled = grade === '0' || applying
  return (
    <Stack direction="row" spacing={0} alignItems="center">
      <Tooltip title={t('activityGrading.gradeGrid.openDetail')}>
        <IconButton
          size="small"
          aria-label={t('activityGrading.gradeGrid.openDetail')}
          onClick={() => props.context.actions.current.onOpenDetail(row)}
        >
          <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Tooltip
        title={
          disabled
            ? t('activityGrading.gradeGrid.applyRowDisabled')
            : t('activityGrading.gradeGrid.applyRow')
        }
      >
        <span>
          <IconButton
            size="small"
            aria-label={t('activityGrading.gradeGrid.applyRow')}
            disabled={disabled}
            onClick={() => props.context.actions.current.onApplyRow(row)}
          >
            <CheckIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  )
}

function buildColumnDefs(
  readModel: () => GradeModel,
  components: SubjectComponent[],
  segments: ComponentSegment[],
  activities: GradingActivity[],
  labels: { student: string; document: string; def: string; actions: string },
  mode: PaletteMode,
): Array<ColDef<GradeRow> | ColGroupDef<GradeRow>> {
  const segmentTints = SEGMENT_TINTS[mode]
  const componentHeader = COMPONENT_HEADER[mode]
  const segmentsByComponent = new Map<string, ComponentSegment[]>()
  for (const segment of segments) {
    const list = segmentsByComponent.get(segment.subject_component) ?? []
    list.push(segment)
    segmentsByComponent.set(segment.subject_component, list)
  }
  for (const list of segmentsByComponent.values()) list.sort(compareByOrder)

  const activitiesBySegment = new Map<string, GradingActivity[]>()
  for (const activity of activities) {
    const list = activitiesBySegment.get(activity.segment) ?? []
    list.push(activity)
    activitiesBySegment.set(activity.segment, list)
  }
  for (const list of activitiesBySegment.values()) {
    list.sort((a, b) => {
      const order = (a.sort_order ?? 0) - (b.sort_order ?? 0)
      if (order !== 0) return order
      const date = a.activity_date.localeCompare(b.activity_date)
      if (date !== 0) return date
      return a.name.localeCompare(b.name, 'es')
    })
  }

  let colorIndex = 0
  const groups: ColGroupDef<GradeRow>[] = components.map((component) => {
    const componentSegments = segmentsByComponent.get(component.id) ?? []
    const componentLabel = `${component.name} ${component.weight_percent}%`
    const children: ColGroupDef<GradeRow>[] | ColDef<GradeRow>[] =
      componentSegments.length > 0
        ? componentSegments.map((segment) => {
            const tint = segmentTints[colorIndex % segmentTints.length]!
            colorIndex += 1
            const segmentActivities = activitiesBySegment.get(segment.id) ?? []
            const segmentLabel = `${segment.name} ${segment.weight_percent}%`
            const leaves: ColDef<GradeRow>[] =
              segmentActivities.length > 0
                ? segmentActivities.map((activity) => ({
                    colId: `score:${activity.id}`,
                    headerName: activity.name,
                    headerTooltip: activity.name,
                    minWidth: SCORE_MIN_WIDTH,
                    width: 128,
                    editable: true,
                    sortable: false,
                    suppressMovable: true,
                    suppressHeaderMenuButton: true,
                    cellDataType: 'text',
                    headerStyle: {
                      backgroundColor: tint.header,
                      color: tint.headerText,
                    },
                    cellStyle: {
                      backgroundColor: tint.cell,
                      color: tint.cellText,
                      textAlign: 'center',
                    },
                    headerComponent: ActivityColumnHeader,
                    headerComponentParams: {
                      activityId: activity.id,
                      textColor: tint.headerText,
                    },
                    suppressKeyboardEvent: suppressActivityEnter,
                    valueGetter: (params) =>
                      params.data?.scores[activity.id] ?? '',
                    valueSetter: (params) => {
                      if (!params.data) return false
                      const next = normalizeScore(params.newValue)
                      if ((params.data.scores[activity.id] ?? '') === next) return false
                      params.data.scores[activity.id] = next
                      return true
                    },
                  }))
                : [
                    {
                      colId: `placeholder:${segment.id}`,
                      headerName: '',
                      minWidth: labelWidth(segmentLabel),
                      width: labelWidth(segmentLabel),
                      editable: false,
                      sortable: false,
                      suppressMovable: true,
                      suppressHeaderMenuButton: true,
                      headerStyle: {
                        backgroundColor: tint.header,
                        color: tint.headerText,
                      },
                      cellStyle: {
                        backgroundColor: tint.cell,
                        color: tint.cellText,
                      },
                      valueGetter: () => '',
                    },
                  ]
            const floor = labelWidth(segmentLabel)
            const sum = leaves.reduce((total, leaf) => total + (leaf.minWidth ?? SCORE_MIN_WIDTH), 0)
            if (sum < floor && leaves[0]) {
              leaves[0].minWidth = (leaves[0].minWidth ?? SCORE_MIN_WIDTH) + (floor - sum)
            }
            return {
              headerName: segmentLabel,
              headerGroupComponent: SegmentGroupHeader,
              headerGroupComponentParams: {
                segmentId: segment.id,
                label: segmentLabel,
                tint: tint.header,
                textColor: tint.headerText,
              },
              children: leaves,
            }
          })
        : [
            (() => {
              const tint = segmentTints[colorIndex % segmentTints.length]!
              colorIndex += 1
              return {
                colId: `placeholder:component:${component.id}`,
                headerName: '',
                minWidth: labelWidth(componentLabel),
                width: labelWidth(componentLabel),
                editable: false,
                sortable: false,
                suppressMovable: true,
                suppressHeaderMenuButton: true,
                headerStyle: {
                  backgroundColor: tint.header,
                  color: tint.headerText,
                },
                cellStyle: {
                  backgroundColor: tint.cell,
                  color: tint.cellText,
                },
                valueGetter: () => '',
              } satisfies ColDef<GradeRow>
            })(),
          ]

    const group: ColGroupDef<GradeRow> = {
      headerName: componentLabel,
      headerGroupComponent: ComponentGroupHeader,
      headerGroupComponentParams: {
        componentId: component.id,
        label: componentLabel,
        tint: componentHeader.background,
        textColor: componentHeader.color,
      },
      children,
    }
    return group
  })

  const pinnedLeft: ColDef<GradeRow>[] = [
    {
      colId: 'studentName',
      field: 'studentName',
      headerName: labels.student,
      pinned: 'left',
      lockPinned: true,
      suppressMovable: true,
      sortable: false,
      suppressHeaderMenuButton: true,
      minWidth: 160,
      width: 220,
    },
    {
      colId: 'documentNumber',
      field: 'documentNumber',
      headerName: labels.document,
      pinned: 'left',
      lockPinned: true,
      suppressMovable: true,
      sortable: false,
      suppressHeaderMenuButton: true,
      minWidth: 110,
      width: 140,
    },
  ]
  const pinnedRight: ColDef<GradeRow>[] = [
    {
      colId: 'def',
      headerName: labels.def,
      pinned: 'right',
      lockPinned: true,
      suppressMovable: true,
      sortable: false,
      suppressHeaderMenuButton: true,
      minWidth: 72,
      width: 88,
      editable: false,
      cellStyle: { textAlign: 'center', fontWeight: 700 },
      valueGetter: (params) =>
        params.data ? defForRow(params.data, readModel()) : '',
    },
    {
      colId: 'actions',
      headerName: labels.actions,
      pinned: 'right',
      lockPinned: true,
      suppressMovable: true,
      sortable: false,
      suppressHeaderMenuButton: true,
      minWidth: 88,
      width: 104,
      editable: false,
      cellRenderer: ActionsCell,
      valueGetter: (params) =>
        params.data ? defForRow(params.data, readModel()) : '',
    },
  ]
  return [...pinnedLeft, ...groups, ...pinnedRight]
}

function scoredCount(row: GradeRow, activityIds: string[]): number {
  return activityIds.filter((activityId) => (row.scores[activityId] ?? '').trim() !== '')
    .length
}

export function ActivityGradeGridPage() {
  const { t } = useTranslation()
  const muiTheme = useTheme()
  const queryClient = useQueryClient()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const { schemeId, setSchemeId, schemes, schemesLoading, selectedScheme } =
    usePlanningSchemeSelection(selectedInstitutionId)
  const yearsQuery = useAcademicYearsQuery(selectedInstitutionId)
  const activeYear = useMemo(
    () => (yearsQuery.data ?? []).find((year) => year.is_active) ?? null,
    [yearsQuery.data],
  )
  const periodsQuery = useAcademicPeriodsForYear(activeYear?.id ?? null)
  const currentPeriod = useMemo(
    () => currentAcademicPeriod(periodsQuery.data ?? [], todayIsoDate()),
    [periodsQuery.data],
  )
  const periodSchemes = useMemo(
    () =>
      currentPeriod
        ? schemes.filter((scheme) => scheme.academic_period === currentPeriod.id)
        : [],
    [schemes, currentPeriod],
  )
  const schemeInPeriod =
    selectedScheme && currentPeriod && selectedScheme.academic_period === currentPeriod.id
      ? selectedScheme
      : null

  useEffect(() => {
    if (!selectedInstitutionId || yearsQuery.isLoading || periodsQuery.isLoading) return
    if (!selectedScheme) return
    if (!currentPeriod || selectedScheme.academic_period !== currentPeriod.id) {
      setSchemeId(null)
    }
  }, [
    selectedInstitutionId,
    yearsQuery.isLoading,
    periodsQuery.isLoading,
    selectedScheme,
    currentPeriod,
    setSchemeId,
  ])
  const gridRef = useRef<AgGridReact<GradeRow>>(null)
  const revertingRef = useRef(false)
  const refreshTimerRef = useRef<number | null>(null)
  const modelRef = useRef<GradeModel>({
    weightsValid: false,
    activityIds: [],
    activitiesById: new Map(),
    componentOrder: [],
  })
  const actionsRef = useRef<GridActions>({
    onEditActivity: () => {},
    onAddActivity: () => {},
    onOpenWeights: () => {},
    onOpenDetail: () => {},
    onApplyRow: () => {},
    applyingStudentId: null,
  })
  const gridContext = useMemo<GridContext>(
    () => ({ actions: actionsRef, model: modelRef }),
    [],
  )

  const [saveError, setSaveError] = useState<string | null>(null)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)
  const [weightComponentId, setWeightComponentId] = useState<string | null>(null)
  const [activityDialog, setActivityDialog] = useState<
    | { mode: 'create'; segmentId: string }
    | { mode: 'edit'; activity: GradingActivity }
    | null
  >(null)
  const [detail, setDetail] = useState<{
    studentId: string
    studentName: string
    headlineGrade: string
  } | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [applyingStudentId, setApplyingStudentId] = useState<string | null>(null)

  const schemeQuery = useQuery({
    queryKey: queryKeys.gradingScheme(schemeId ?? ''),
    queryFn: () => fetchGradingScheme(schemeId!),
    enabled: Boolean(schemeId),
    retry: false,
  })
  const scheme: GradingScheme | null = schemeQuery.data ?? selectedScheme

  const assignmentQuery = useQuery({
    queryKey: ['course-assignments', 'detail', scheme?.course_assignment ?? ''],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        group: string
        academic_year: string
        subject: string
      }>(`/api/course-assignments/${scheme!.course_assignment}/`)
      return data
    },
    enabled: Boolean(scheme?.course_assignment),
  })

  const structureKey = queryKeys.gradingSchemeStructure(scheme?.id ?? '')
  const componentsQuery = useQuery({
    queryKey: [...structureKey, 'components', assignmentQuery.data?.subject ?? ''],
    queryFn: () => fetchSubjectComponentsForSubject(assignmentQuery.data!.subject),
    enabled: Boolean(scheme?.id && assignmentQuery.data?.subject),
  })
  const segmentsQuery = useQuery({
    queryKey: [...structureKey, 'segments'],
    queryFn: () => fetchComponentSegmentsForScheme(scheme!.id),
    enabled: Boolean(scheme?.id),
  })
  const activitiesQuery = useQuery({
    queryKey: [...structureKey, 'activities'],
    queryFn: () => fetchGradingActivitiesForScheme(scheme!.id),
    enabled: Boolean(scheme?.id),
  })
  const scoresQuery = useQuery({
    queryKey: [...structureKey, 'scores'],
    queryFn: () => fetchStudentActivityScoresForScheme(scheme!.id),
    enabled: Boolean(scheme?.id),
  })
  const enrollmentsQuery = useQuery({
    queryKey: queryKeys.enrollments({
      academic_year: assignmentQuery.data?.academic_year,
      group: assignmentQuery.data?.group,
      status: 'active',
    }),
    queryFn: () =>
      fetchAllEnrollments({
        academic_year: assignmentQuery.data!.academic_year,
        group: assignmentQuery.data!.group,
        status: 'active',
      }),
    enabled: Boolean(assignmentQuery.data?.academic_year && assignmentQuery.data?.group),
  })

  const components = useMemo(
    () => [...(componentsQuery.data ?? [])].sort(compareByOrder),
    [componentsQuery.data],
  )
  const segments = useMemo(
    () => [...(segmentsQuery.data ?? [])].sort(compareByOrder),
    [segmentsQuery.data],
  )
  const activities = useMemo(() => {
    return [...(activitiesQuery.data ?? [])].sort((a, b) => {
      const order = (a.sort_order ?? 0) - (b.sort_order ?? 0)
      if (order !== 0) return order
      const date = a.activity_date.localeCompare(b.activity_date)
      if (date !== 0) return date
      return a.name.localeCompare(b.name, 'es')
    })
  }, [activitiesQuery.data])

  const model = useMemo<GradeModel>(() => {
    const activitiesById = new Map(activities.map((activity) => [activity.id, activity]))
    const segmentsByComponent = new Map<string, ComponentSegment[]>()
    for (const segment of segments) {
      const list = segmentsByComponent.get(segment.subject_component) ?? []
      list.push(segment)
      segmentsByComponent.set(segment.subject_component, list)
    }
    const activitiesBySegment = new Map<string, GradingActivity[]>()
    for (const activity of activities) {
      const list = activitiesBySegment.get(activity.segment) ?? []
      list.push(activity)
      activitiesBySegment.set(activity.segment, list)
    }
    const componentOrder = components.map((component) => ({
      id: component.id,
      weightPercent: component.weight_percent,
      segments: (segmentsByComponent.get(component.id) ?? []).map((segment) => ({
        id: segment.id,
        weightPercent: segment.weight_percent,
        activityIds: (activitiesBySegment.get(segment.id) ?? []).map((activity) => activity.id),
      })),
    }))
    return {
      weightsValid: scheme
        ? scheme.subject_component_weights_valid === true &&
          scheme.segment_weights_valid === true
        : false,
      activityIds: activities.map((activity) => activity.id),
      activitiesById,
      componentOrder,
    }
  }, [activities, components, scheme, segments])
  modelRef.current = model

  const rows = useMemo<GradeRow[]>(() => {
    const byStudentActivity = new Map<string, StudentActivityScore>()
    for (const score of scoresQuery.data ?? []) {
      byStudentActivity.set(`${score.student}:${score.activity}`, score)
    }
    return [...(enrollmentsQuery.data ?? [])]
      .sort((a: Enrollment, b: Enrollment) =>
        a.student_name.localeCompare(b.student_name, 'es'),
      )
      .map((enrollment) => {
        const scores: Record<string, string> = {}
        const scoreIds: Record<string, string> = {}
        for (const activityId of model.activityIds) {
          const existing = byStudentActivity.get(`${enrollment.student}:${activityId}`)
          scores[activityId] =
            existing?.score != null && existing.score !== '' ? existing.score : ''
          if (existing?.id) scoreIds[activityId] = existing.id
        }
        return {
          id: enrollment.student,
          studentName: enrollment.student_name,
          documentNumber: enrollment.student_document_number ?? '',
          scores,
          scoreIds,
        }
      })
  }, [enrollmentsQuery.data, model.activityIds, scoresQuery.data])

  const studentLabel = t('gradingSchemes.student')
  const documentLabel = t('gradingSchemes.document')
  const defLabel = t('activityGrading.gradeGrid.def')
  const actionsLabel = t('activityGrading.gradeGrid.actions')
  const columnSignature = [
    components
      .map(
        (component) =>
          `${component.id}:${component.name}:${component.weight_percent}:${component.sort_order ?? 0}`,
      )
      .join('|'),
    segments
      .map(
        (segment) =>
          `${segment.id}:${segment.subject_component}:${segment.name}:${segment.weight_percent}:${segment.sort_order ?? 0}`,
      )
      .join('|'),
    activities
      .map(
        (activity) =>
          `${activity.id}:${activity.segment}:${activity.name}:${activity.max_score ?? ''}:${activity.sort_order ?? 0}:${activity.activity_date}`,
      )
      .join('|'),
    studentLabel,
    documentLabel,
    defLabel,
    actionsLabel,
    muiTheme.palette.mode,
  ].join('||')
  const columnCache = useRef<{
    signature: string
    defs: Array<ColDef<GradeRow> | ColGroupDef<GradeRow>>
  } | null>(null)
  if (
    !columnCache.current ||
    columnCache.current.signature !== columnSignature
  ) {
    columnCache.current = {
      signature: columnSignature,
      defs: buildColumnDefs(
        () => modelRef.current,
        components,
        segments,
        activities,
        {
          student: studentLabel,
          document: documentLabel,
          def: defLabel,
          actions: actionsLabel,
        },
        muiTheme.palette.mode,
      ),
    }
  }
  const columnDefs = columnCache.current.defs

  const gridTheme = useMemo(() => {
    const dark = muiTheme.palette.mode === 'dark'
    return themeQuartz
      .withPart(dark ? colorSchemeDark : colorSchemeLight)
      .withParams({
        fontFamily: String(muiTheme.typography.fontFamily),
        headerFontFamily: String(muiTheme.typography.fontFamily),
        fontSize: 13,
        headerFontSize: 12,
        headerFontWeight: 600,
        backgroundColor: muiTheme.palette.background.paper,
        foregroundColor: muiTheme.palette.text.primary,
        dataBackgroundColor: muiTheme.palette.background.paper,
        chromeBackgroundColor: dark ? '#243044' : muiTheme.palette.background.default,
        headerBackgroundColor: dark ? '#334155' : '#EAECF0',
        headerTextColor: dark ? '#F8FAFC' : '#101828',
        oddRowBackgroundColor: dark ? '#243044' : '#F8FAFC',
        rowHoverColor: dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.04)',
        borderColor: dark ? 'rgba(255, 255, 255, 0.12)' : muiTheme.palette.divider,
        accentColor: muiTheme.palette.primary.main,
        browserColorScheme: muiTheme.palette.mode,
        wrapperBorderRadius: 8,
      })
  }, [muiTheme])

  const canApplyGroup = groupCanApplySuggestion({
    weightsValid: model.weightsValid,
    activityCount: model.activityIds.length,
    scoredCounts: rows.map((row) => scoredCount(row, model.activityIds)),
  })

  function invalidateApplied(nextSchemeId: string) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.gradingSchemeStructure(nextSchemeId),
    })
    void queryClient.invalidateQueries({
      queryKey: ['grading-schemes', nextSchemeId, 'breakdown'],
    })
    void queryClient.invalidateQueries({ queryKey: ['grades'] })
    void queryClient.invalidateQueries({ queryKey: ['student-activity-scores'] })
  }

  function scheduleScoreRefresh(nextSchemeId: string) {
    if (refreshTimerRef.current != null) {
      window.clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      const editing = gridRef.current?.api.getEditingCells() ?? []
      if (editing.length > 0) {
        scheduleScoreRefresh(nextSchemeId)
        return
      }
      invalidateApplied(nextSchemeId)
    }, 400)
  }

  useEffect(
    () => () => {
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    gridRef.current?.api?.refreshCells({ columns: ['def', 'actions'], force: true })
  }, [model.weightsValid])

  const applyRowMutation = useMutation({
    mutationFn: (studentId: string) =>
      applyGradingSchemeSuggestion(scheme!.id, studentId),
    onMutate: (studentId) => {
      setApplyingStudentId(studentId)
      actionsRef.current.applyingStudentId = studentId
    },
    onSuccess: (data) => {
      setSaveError(null)
      setApplyMessage(
        t('gradingSchemes.applySuccess', {
          grade: data.numerical_grade,
          level: data.performance_level_name ?? '—',
          created: data.created
            ? t('gradingSchemes.gradeCreated')
            : t('gradingSchemes.gradeUpdated'),
        }),
      )
      if (scheme) invalidateApplied(scheme.id)
    },
    onError: (error) => {
      setApplyMessage(null)
      setSaveError(getErrorMessage(error))
    },
    onSettled: () => {
      setApplyingStudentId(null)
      actionsRef.current.applyingStudentId = null
      gridRef.current?.api?.refreshCells({ columns: ['actions'], force: true })
    },
  })

  const applyBulkMutation = useMutation({
    mutationFn: () => applyGradingSchemeSuggestionBulk(scheme!.id),
    onSuccess: (result) => {
      setBulkOpen(false)
      setSaveError(null)
      setApplyMessage(
        [
          t('gradingSchemes.bulkApplySuccess', {
            applied: result.applied_count,
            created: result.created_count,
            updated: result.updated_count,
            skipped: result.skipped_count,
          }),
          result.ranking_recalculated
            ? t('gradingSchemes.bulkApplyRankingRecalculated')
            : null,
        ]
          .filter(Boolean)
          .join(' '),
      )
      if (scheme) invalidateApplied(scheme.id)
    },
    onError: (error) => {
      setApplyMessage(null)
      setSaveError(getErrorMessage(error))
    },
  })

  actionsRef.current = {
    onEditActivity: (activity) => setActivityDialog({ mode: 'edit', activity }),
    onAddActivity: (segmentId) => setActivityDialog({ mode: 'create', segmentId }),
    onOpenWeights: (componentId) => setWeightComponentId(componentId),
    onOpenDetail: (row) =>
      setDetail({
        studentId: row.id,
        studentName: row.studentName,
        headlineGrade: defForRow(row, modelRef.current),
      }),
    onApplyRow: (row) => {
      if (defForRow(row, modelRef.current) === '0') return
      setApplyMessage(null)
      applyRowMutation.mutate(row.id)
    },
    applyingStudentId,
  }

  async function onCellValueChanged(event: CellValueChangedEvent<GradeRow>) {
    if (revertingRef.current) return
    const colId = event.column.getColId()
    if (!colId.startsWith('score:') || !event.data || !scheme) return
    const activityId = colId.slice('score:'.length)
    const activity = modelRef.current.activitiesById.get(activityId)
    if (!activity) return
    const previous = normalizeScore(event.oldValue)
    const nextText = normalizeScore(event.newValue)
    if (sameScore(previous, nextText)) return

    const parsed = validateScore(nextText, activity.max_score ?? '5.00')
    if (!parsed.ok) {
      setApplyMessage(null)
      setSaveError(
        parsed.reason === 'max'
          ? t('gradingSchemes.scoreAboveMax', { max: activity.max_score ?? '5.00' })
          : t('gradingSchemes.invalidScore'),
      )
      revertingRef.current = true
      event.node.setDataValue(colId, event.oldValue ?? '')
      revertingRef.current = false
      return
    }

    const scoreId = event.data.scoreIds[activityId]
    if (parsed.value == null && !scoreId) {
      event.data.scores[activityId] = ''
      event.api.refreshCells({
        rowNodes: [event.node],
        columns: ['def', 'actions'],
        force: true,
      })
      return
    }

    try {
      const saved =
        parsed.value == null
          ? await patchStudentActivityScore(scoreId!, { score: null })
          : scoreId
            ? await patchStudentActivityScore(scoreId, { score: parsed.value })
            : await createStudentActivityScore({
                activity: activityId,
                student: event.data.id,
                score: parsed.value,
              })
      event.data.scoreIds[activityId] = saved.id
      event.data.scores[activityId] = saved.score ?? ''
      setSaveError(null)
      event.api.refreshCells({
        rowNodes: [event.node],
        columns: [colId, 'def', 'actions'],
        force: true,
      })
      scheduleScoreRefresh(scheme.id)
    } catch (error) {
      setSaveError(getErrorMessage(error))
      revertingRef.current = true
      event.node.setDataValue(colId, event.oldValue ?? '')
      revertingRef.current = false
    }
  }

  const loading =
    Boolean(schemeId) &&
    (schemeQuery.isLoading ||
      assignmentQuery.isLoading ||
      componentsQuery.isLoading ||
      segmentsQuery.isLoading ||
      activitiesQuery.isLoading ||
      scoresQuery.isLoading ||
      enrollmentsQuery.isLoading)

  const weightComponent =
    components.find((component) => component.id === weightComponentId) ?? null
  const structureSignature = [
    components.map((component) => component.id).join(','),
    segments.map((segment) => segment.id).join(','),
    activities.map((activity) => activity.id).join(','),
  ].join('|')

  return (
    <Box className="flex flex-col gap-4">
      <Typography variant="h6">{t('activityGrading.gradeGrid.title')}</Typography>

      {!selectedInstitutionId ? (
        <Alert severity="info">{t('gradingSchemes.selectInstitution')}</Alert>
      ) : null}
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {applyMessage ? <Alert severity="success">{applyMessage}</Alert> : null}
      {schemeQuery.error ? (
        <Alert severity="error">{getErrorMessage(schemeQuery.error)}</Alert>
      ) : null}
      {scheme && !model.weightsValid && !loading ? (
        <Alert severity="warning">{t('activityGrading.gradeGrid.invalidWeights')}</Alert>
      ) : null}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ md: 'center' }}
      >
        {selectedInstitutionId ? (
          <>
            <Autocomplete
              options={currentPeriod ? [currentPeriod] : []}
              value={currentPeriod}
              readOnly
              forcePopupIcon={false}
              disableClearable={Boolean(currentPeriod)}
              loading={yearsQuery.isLoading || periodsQuery.isLoading}
              sx={{ width: { xs: '100%', md: 240 }, flexShrink: 0 }}
              getOptionKey={(option: AcademicPeriod) => option.id}
              getOptionLabel={formatPeriodLabel}
              renderInput={(params: AutocompleteRenderInputParams) => (
                <TextField
                  {...params}
                  label={t('gradingSchemes.period')}
                  helperText={
                    !yearsQuery.isLoading && !periodsQuery.isLoading && !currentPeriod
                      ? t('activityGrading.gradeGrid.noCurrentPeriod')
                      : undefined
                  }
                />
              )}
            />
            <Autocomplete
              options={periodSchemes}
              loading={schemesLoading}
              sx={{ flex: 1, minWidth: 0, maxWidth: { md: 720 } }}
              getOptionKey={(option: GradingScheme) => option.id}
              getOptionLabel={formatGradingSchemeOptionLabel}
              value={schemeInPeriod}
              onChange={(_, value) => setSchemeId(value?.id ?? null)}
              renderInput={(params: AutocompleteRenderInputParams) => (
                <TextField
                  {...params}
                  label={t('activityGrading.schemeFilter')}
                  required
                />
              )}
            />
          </>
        ) : null}
        <Button
          variant="contained"
          color="secondary"
          startIcon={<GroupsIcon />}
          disabled={!canApplyGroup || applyBulkMutation.isPending || !scheme}
          onClick={() => {
            setApplyMessage(null)
            setBulkOpen(true)
          }}
          sx={
            Boolean(scheme) && canApplyGroup && !applyBulkMutation.isPending
              ? {
                  flexShrink: 0,
                  ml: { md: 'auto' },
                  color: '#FFFFFF',
                  backgroundColor: '#1D4ED8',
                  '@keyframes gradeGridApplyReady': {
                    '0%, 100%': { backgroundColor: '#1D4ED8' },
                    '50%': { backgroundColor: '#2563EB' },
                  },
                  animation: 'gradeGridApplyReady 2.8s ease-in-out infinite',
                  '&:hover': {
                    animation: 'none',
                    backgroundColor: '#1E40AF',
                    color: '#FFFFFF',
                  },
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                    backgroundColor: '#1D4ED8',
                  },
                }
              : { flexShrink: 0, ml: { md: 'auto' } }
          }
        >
          {t('gradingSchemes.applySuggestionBulk')}
        </Button>
      </Stack>

      {selectedInstitutionId && !schemeId ? (
        <Alert severity="info">{t('activityGrading.gradeGrid.selectSchemeHint')}</Alert>
      ) : null}

      {scheme ? (
        <Box
          sx={{
            height: 'calc(100vh - 280px)',
            minHeight: 420,
            width: '100%',
            '& .ag-header-group-cell': {
              paddingInline: 0,
              alignItems: 'stretch',
            },
            '& .ag-header-group-cell .ag-header-cell-comp-wrapper': {
              height: '100%',
              maxHeight: 'none',
            },
          }}
        >
          <AgGridReact<GradeRow>
            ref={gridRef}
            key={structureSignature}
            theme={gridTheme}
            context={gridContext}
            rowData={rows}
            columnDefs={columnDefs}
            getRowId={(params) => params.data.id}
            loading={loading}
            headerHeight={40}
            groupHeaderHeight={48}
            singleClickEdit
            stopEditingWhenCellsLoseFocus
            tabToNextCell={tabToNextCell}
            onCellValueChanged={(event) => void onCellValueChanged(event)}
            defaultColDef={{
              resizable: true,
              sortable: false,
              suppressMovable: true,
              suppressHeaderMenuButton: true,
            }}
            overlayNoRowsTemplate={`<span>${t('activityGrading.gradeGrid.emptyStudents')}</span>`}
            suppressDragLeaveHidesColumns
            animateRows={false}
          />
        </Box>
      ) : null}

      {scheme ? (
        <SegmentWeightDialog
          open={Boolean(weightComponent)}
          onClose={() => setWeightComponentId(null)}
          schemeId={scheme.id}
          component={weightComponent}
          segments={segments}
        />
      ) : null}
      {scheme ? (
        <PlanningActivityDialog
          open={activityDialog != null}
          onClose={() => setActivityDialog(null)}
          schemeId={scheme.id}
          segmentId={
            activityDialog?.mode === 'create'
              ? activityDialog.segmentId
              : activityDialog?.mode === 'edit'
                ? activityDialog.activity.segment
                : undefined
          }
          editing={activityDialog?.mode === 'edit' ? activityDialog.activity : null}
          defaultDate={todayIsoDate()}
        />
      ) : null}
      {scheme && detail ? (
        <StudentGradeDetailDialog
          open
          onClose={() => setDetail(null)}
          schemeId={scheme.id}
          studentId={detail.studentId}
          studentName={detail.studentName}
          headlineGrade={detail.headlineGrade}
        />
      ) : null}

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('gradingSchemes.bulkApplyDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ pt: 1 }}>
            {t('activityGrading.gradeGrid.bulkConfirm', { count: rows.length })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={applyBulkMutation.isPending}
            onClick={() => applyBulkMutation.mutate()}
          >
            {t('gradingSchemes.applySuggestionBulk')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
