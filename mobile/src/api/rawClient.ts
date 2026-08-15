import axios from 'axios'

import { getApiBaseUrl } from '@/api/config'

/** Requests without Authorization (login, refresh). */
export const rawClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})
