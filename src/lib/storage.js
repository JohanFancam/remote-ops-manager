const STORAGE_KEY = 'the-assistant.tasks.v1'
const SETTINGS_KEY = 'the-assistant.settings.v1'

const defaultSettings = {
  notificationsEnabled: false,
  reminderMinutes: 15,
  defaultCategory: 'personal',
}

function seedTasks() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0)
  const later = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 30)
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0)
  const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 11, 0)

  return [
    {
      id: 'seed_1',
      title: 'Plan the week',
      notes: 'Block focus time and pick one priority for work and home.',
      category: 'personal',
      priority: 'medium',
      dueAt: today.toISOString(),
      remindAt: null,
      completed: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'seed_2',
      title: 'Reply to pending emails',
      notes: '',
      category: 'work',
      priority: 'high',
      dueAt: later.toISOString(),
      remindAt: null,
      completed: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'seed_3',
      title: 'Grocery run',
      notes: 'Milk, greens, coffee',
      category: 'personal',
      priority: 'low',
      dueAt: tomorrow.toISOString(),
      remindAt: null,
      completed: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'seed_4',
      title: 'Quarterly goal check-in',
      notes: 'Review progress and adjust next steps.',
      category: 'work',
      priority: 'medium',
      dueAt: nextWeek.toISOString(),
      remindAt: null,
      completed: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ]
}

export function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeded = seedTasks()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    return JSON.parse(raw)
  } catch {
    return seedTasks()
  }
}

export function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
