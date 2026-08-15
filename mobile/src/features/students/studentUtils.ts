import { useEffect, useState } from 'react'

import type { Enrollment } from '@/types/schemas'

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

const STATUS_LABEL: Record<Enrollment['status'], string> = {
  active: 'Activa',
  withdrawn: 'Retirada',
  graduated: 'Graduado',
}

export function enrollmentStatusLabel(status: Enrollment['status']): string {
  return STATUS_LABEL[status] ?? status
}

export function documentLabel(
  documentType: string | null | undefined,
  documentNumber: string | null | undefined,
): string {
  const type = (documentType ?? '').trim() || 'Doc.'
  const number = (documentNumber ?? '').trim()
  return number ? `${type} ${number}` : type
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`
}

export function matchesStudentSearch(
  name: string,
  documentNumber: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    name.toLowerCase().includes(q) || documentNumber.toLowerCase().includes(q)
  )
}
