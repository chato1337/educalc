import AddIcon from '@mui/icons-material/Add'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PageHeader } from '@/components/PageHeader'
import type { Student } from '@/types/schemas'

export function StudentsPage() {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [documentTypeFilter, setDocumentTypeFilter] = useState('')
  const [documentNumberFilter, setDocumentNumberFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [sisbenFilter, setSisbenFilter] = useState('')
  const [stratumFilter, setStratumFilter] = useState('')
  const [ordering, setOrdering] = useState('')

  const params = {
    search: appliedSearch.trim() || undefined,
    document_type: documentTypeFilter.trim() || undefined,
    document_number: documentNumberFilter.trim() || undefined,
    gender: genderFilter.trim() || undefined,
    sisben: sisbenFilter.trim() || undefined,
    stratum: stratumFilter.trim() || undefined,
    ordering: ordering || undefined,
  }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: queryKeys.students(JSON.stringify(params)),
    queryFn: async () => {
      const { data } = await apiClient.get<Student[]>('/api/students/', {
        params,
      })
      return data
    },
  })

  return (
    <Box className="p-4 md:p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
      <Box className="flex flex-wrap justify-between items-center gap-2">
        <PageHeader
          title={t('students.title')}
          subtitle={
            <>
              {`${t('students.detailPrefix')} `}
              <Link
                to="/students/bulk-load"
                className="text-blue-600 underline"
              >
                {t('students.bulkLoadCsv')}
              </Link>
              .
            </>
          }
        />
        <Button
          variant="contained"
          component={Link}
          to="/students/new"
          startIcon={<AddIcon />}
        >
          {t('students.newStudent')}
        </Button>
      </Box>

      <Paper className="p-3 flex flex-wrap gap-2 items-center">
        <TextField
          size="small"
          label={t('common.search')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setAppliedSearch(searchInput)
          }}
          slotProps={{
            input: { 'aria-label': t('students.searchAria') },
          }}
        />
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={() => setAppliedSearch(searchInput)}
        >
          {t('common.apply')}
        </Button>
        <TextField
          size="small"
          label={t('students.documentTypeExact')}
          value={documentTypeFilter}
          onChange={(e) => setDocumentTypeFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('students.documentNumberExact')}
          value={documentNumberFilter}
          onChange={(e) => setDocumentNumberFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('students.genderExact')}
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('students.sisbenExact')}
          value={sisbenFilter}
          onChange={(e) => setSisbenFilter(e.target.value)}
        />
        <TextField
          size="small"
          label={t('students.stratumExact')}
          value={stratumFilter}
          onChange={(e) => setStratumFilter(e.target.value)}
        />
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel>{t('students.order')}</InputLabel>
          <Select
            label={t('students.order')}
            value={ordering}
            onChange={(e) => setOrdering(String(e.target.value))}
          >
            <MenuItem value="">{t('students.defaultOrder')}</MenuItem>
            <MenuItem value="full_name">{t('students.nameAsc')}</MenuItem>
            <MenuItem value="-full_name">{t('students.nameDesc')}</MenuItem>
            <MenuItem value="document_number">{t('students.documentAsc')}</MenuItem>
            <MenuItem value="-document_number">{t('students.documentDesc')}</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="text"
          startIcon={<FilterAltOffIcon />}
          onClick={() => {
            setSearchInput('')
            setAppliedSearch('')
            setDocumentTypeFilter('')
            setDocumentNumberFilter('')
            setGenderFilter('')
            setSisbenFilter('')
            setStratumFilter('')
            setOrdering('')
          }}
        >
          {t('common.clear')}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
          {t('students.globalSearchHint')}
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('students.name')}</TableCell>
              <TableCell>{t('students.document')}</TableCell>
              <TableCell>{t('students.documentType')}</TableCell>
              <TableCell>{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>{t('common.loading')}</TableCell>
              </TableRow>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>{t('common.none')}</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.full_name}</TableCell>
                <TableCell>{row.document_number}</TableCell>
                <TableCell>{row.document_type}</TableCell>
                <TableCell>
                  <Link
                    to={`/students/${row.id}`}
                    className="text-blue-600 underline"
                  >
                    {t('common.view')}
                  </Link>
                  {' · '}
                  <Link
                    to={`/students/${row.id}/grades-summary`}
                    className="text-blue-600 underline"
                  >
                    {t('students.gradesSummary')}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
