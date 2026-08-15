import { isAxiosError } from 'axios'

import { apiClient } from '@/api/client'
import type { operations } from '@/types/openapi'

export type AcademicGradesBulletinQuery =
  operations['academic_grades_bulletin_retrieve']['parameters']['query']

function parseFilenameFromContentDisposition(cd: string): string | null {
  const star = cd.match(/filename\*\s*=\s*UTF-8''([^;\s]+)/i)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      /* ignore */
    }
  }
  const quoted = cd.match(/filename\s*=\s*"([^"]+)"/i)
  if (quoted?.[1]) return quoted[1].trim()
  const plain = cd.match(/filename\s*=\s*([^;\s]+)/i)
  if (plain?.[1]) return plain[1].replace(/^["']|["']$/g, '').trim()
  return null
}

function fallbackBulletinFilename(params: AcademicGradesBulletinQuery): string {
  if (params.group) return `boletin_grupo_${params.group.slice(0, 8)}.pdf`
  if (params.student) return `boletin_estudiante_${params.student.slice(0, 8)}.pdf`
  return 'boletin.pdf'
}

async function detailFromBlob(data: Blob): Promise<string | null> {
  try {
    const text = await data.text()
    const j = JSON.parse(text) as { detail?: unknown }
    return typeof j.detail === 'string' ? j.detail : null
  } catch {
    return null
  }
}

export type BulletinPdf = {
  blob: Blob
  filename: string
  objectUrl: string
}

export async function fetchGradesBulletinPdf(
  params: AcademicGradesBulletinQuery,
): Promise<BulletinPdf> {
  const hasStudent = Boolean(params.student)
  const hasGroup = Boolean(params.group)
  if (hasStudent === hasGroup) {
    throw new Error(
      'Indica exactamente uno: estudiante o grupo, más el año lectivo.',
    )
  }
  try {
    const res = await apiClient.get<Blob>('/api/academic-grades/bulletin/', {
      params,
      responseType: 'blob',
    })
    const blob = res.data
    const ctype = String(res.headers['content-type'] ?? '')
    if (ctype.includes('application/json')) {
      const detail = await detailFromBlob(blob)
      throw new Error(detail ?? 'No se pudo generar el boletín.')
    }
    const cdRaw = res.headers['content-disposition']
    const cd = typeof cdRaw === 'string' ? cdRaw : undefined
    const parsed = cd ? parseFilenameFromContentDisposition(cd) : null
    const filename = parsed ?? fallbackBulletinFilename(params)
    return { blob, filename, objectUrl: URL.createObjectURL(blob) }
  } catch (e) {
    if (isAxiosError(e) && e.response?.data instanceof Blob) {
      const detail = await detailFromBlob(e.response.data)
      if (detail) throw new Error(detail)
    }
    throw e
  }
}

export function downloadBlob(objectUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
