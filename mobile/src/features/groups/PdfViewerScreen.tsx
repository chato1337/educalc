import { useEffect, useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import { EmptyState, IconDocument, SectionHeader } from '@/components'
import {
  downloadBlob,
  fetchGradesBulletinPdf,
  type AcademicGradesBulletinQuery,
} from '@/features/groups/gradesBulletinApi'

export function PdfViewerScreen({
  title,
  subtitle,
  query,
  onBack,
}: {
  title: string
  subtitle?: string
  query: AcademicGradesBulletinQuery | null
  onBack: () => void
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState('boletin.pdf')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    if (!query) {
      setLoading(false)
      setError('Falta el año lectivo o el destinatario del boletín.')
      return
    }
    setLoading(true)
    setError('')
    void fetchGradesBulletinPdf(query)
      .then((pdf) => {
        if (cancelled) {
          URL.revokeObjectURL(pdf.objectUrl)
          return
        }
        revoked = pdf.objectUrl
        setObjectUrl(pdf.objectUrl)
        setFilename(pdf.filename)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(getErrorMessage(err, 'No se pudo generar el boletín.'))
        setLoading(false)
      })
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [query?.academic_year, query?.group, query?.student, query?.period_ids])

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader title={title} subtitle={subtitle} onBack={onBack} />
      {objectUrl && (
        <div className="px-4 py-2 bg-white border-b border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={() => downloadBlob(objectUrl, filename)}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Descargar PDF
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        {loading && (
          <p className="text-sm text-slate-400 text-center py-10">Generando PDF…</p>
        )}
        {error && !loading && (
          <EmptyState
            icon={<IconDocument size={24} />}
            title="No se pudo abrir el boletín"
            body={error}
          />
        )}
        {objectUrl && !loading && (
          <iframe
            title={title}
            src={objectUrl}
            className="w-full h-full border-0 bg-white"
          />
        )}
      </div>
    </div>
  )
}
