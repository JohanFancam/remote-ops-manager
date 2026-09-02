import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { loadSettings, loadTasks, saveSettings, saveTasks } from '@/lib/storage'
import { createReminderScheduler, registerServiceWorker, requestNotificationPermission } from '@/lib/notifications'
import { uid } from '@/lib/utils'

const AssistantContext = createContext(null)

export function AssistantProvider({ children }) {
  const [tasks, setTasks] = useState(() => loadTasks())
  const [settings, setSettings] = useState(() => loadSettings())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    registerServiceWorker().finally(() => setReady(true))
  }, [])

  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    const scheduler = createReminderScheduler({
      getTasks: () => tasks,
      getSettings: () => settings,
    })
    scheduler.reschedule()
    return () => scheduler.clearAll()
  }, [tasks, settings])

  const api = useMemo(() => {
    function upsertTask(input) {
      const now = new Date().toISOString()
      setTasks((prev) => {
        if (input.id) {
          return prev.map((t) =>
            t.id === input.id
              ? {
                  ...t,
                  ...input,
                  updatedAt: now,
                }
              : t
          )
        }
        const task = {
          id: uid('task'),
          title: input.title?.trim() || 'Untitled',
          notes: input.notes || '',
          category: input.category || settings.defaultCategory || 'personal',
          priority: input.priority || 'medium',
          dueAt: input.dueAt || null,
          remindAt: input.remindAt || null,
          completed: false,
          createdAt: now,
          updatedAt: now,
        }
        return [task, ...prev]
      })
    }

    function toggleComplete(id) {
      const now = new Date().toISOString()
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, completed: !t.completed, updatedAt: now } : t
        )
      )
    }

    function deleteTask(id) {
      setTasks((prev) => prev.filter((t) => t.id !== id))
    }

    async function enableNotifications() {
      const result = await requestNotificationPermission()
      if (result.ok) {
        setSettings((s) => ({ ...s, notificationsEnabled: true }))
      }
      return result
    }

    function updateSettings(patch) {
      setSettings((s) => ({ ...s, ...patch }))
    }

    return {
      tasks,
      settings,
      ready,
      upsertTask,
      toggleComplete,
      deleteTask,
      enableNotifications,
      updateSettings,
    }
  }, [tasks, settings, ready])

  return (
    <AssistantContext.Provider value={api}>{children}</AssistantContext.Provider>
  )
}

export function useAssistant() {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistant must be used within AssistantProvider')
  return ctx
}
