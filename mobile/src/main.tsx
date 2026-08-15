import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { teacherQueryClient } from '@/api/queryClient'
import { APP_NAME } from '@/app/appName'
import App from './App'
import './index.css'

document.title = APP_NAME

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={teacherQueryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
