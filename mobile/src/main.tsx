import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { teacherQueryClient } from '@/api/queryClient'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={teacherQueryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
