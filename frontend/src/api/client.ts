import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { getApiBaseUrl } from '@/api/config'
import { rawClient } from '@/api/rawClient'
import { useAuthStore } from '@/stores/authStore'

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
})

function isRefreshRequest(config: InternalAxiosRequestConfig) {
  return config.url?.includes('/api/auth/refresh/')
}

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  const token = useAuthStore.getState().access
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isRefreshRequest(original)
    ) {
      return Promise.reject(error)
    }

    const refresh = useAuthStore.getState().refresh
    if (!refresh) {
      useAuthStore.getState().clearSession()
      window.location.assign('/login')
      return Promise.reject(error)
    }

    original._retry = true
    try {
      const { data } = await rawClient.post<{ access: string }>(
        '/api/auth/refresh/',
        { refresh },
      )
      useAuthStore.getState().setAccessToken(data.access)
      original.headers.Authorization = `Bearer ${data.access}`
      return apiClient(original)
    } catch {
      useAuthStore.getState().clearSession()
      window.location.assign('/login')
      return Promise.reject(error)
    }
  },
)
