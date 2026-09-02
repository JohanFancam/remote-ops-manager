import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AssistantProvider } from '@/lib/AssistantContext'
import AppShell from '@/components/layout/AppShell'
import TodayPage from '@/pages/Today'
import TasksPage from '@/pages/Tasks'
import CalendarPage from '@/pages/Calendar'
import SettingsPage from '@/pages/Settings'

export default function App() {
  return (
    <AssistantProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<TodayPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </AssistantProvider>
  )
}
