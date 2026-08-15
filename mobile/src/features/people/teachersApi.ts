import { apiClient } from '@/api/client'
import type { Teacher } from '@/types/schemas'

export async function fetchTeacher(teacherId: string): Promise<Teacher> {
  const { data } = await apiClient.get<Teacher>(`/api/teachers/${teacherId}/`)
  return data
}
