export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return reg
  } catch (err) {
    console.warn('Service worker registration failed', err)
    return null
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return { ok: false, reason: 'unsupported' }
  }
  if (Notification.permission === 'granted') {
    return { ok: true, permission: 'granted' }
  }
  if (Notification.permission === 'denied') {
    return { ok: false, reason: 'denied', permission: 'denied' }
  }
  const permission = await Notification.requestPermission()
  return {
    ok: permission === 'granted',
    permission,
    reason: permission === 'granted' ? undefined : permission,
  }
}

export async function showNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false

  const payload = {
    body: options.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: options.tag || 'the-assistant',
    renotify: true,
    data: options.data || {},
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg?.showNotification) {
      await reg.showNotification(title, payload)
    } else {
      new Notification(title, payload)
    }
    return true
  } catch (err) {
    console.warn('Notification failed', err)
    return false
  }
}

/** Schedule in-page reminders for upcoming tasks (works while app/tab is open). */
export function createReminderScheduler({ getTasks, getSettings, onFire }) {
  const timers = new Map()

  function clearAll() {
    for (const id of timers.keys()) {
      clearTimeout(timers.get(id))
    }
    timers.clear()
  }

  function reschedule() {
    clearAll()
    const settings = getSettings()
    if (!settings.notificationsEnabled) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const now = Date.now()
    for (const task of getTasks()) {
      if (task.completed || !task.dueAt) continue
      const due = new Date(task.dueAt).getTime()
      const remindAt = task.remindAt
        ? new Date(task.remindAt).getTime()
        : due - (settings.reminderMinutes ?? 15) * 60_000

      const delay = remindAt - now
      if (delay <= 0 || delay > 7 * 24 * 60 * 60_000) continue

      const timerId = setTimeout(() => {
        timers.delete(task.id)
        onFire?.(task)
        showNotification(task.title, {
          body: task.category === 'work' ? 'Work task due soon' : 'Personal task due soon',
          tag: `task-${task.id}`,
          data: { taskId: task.id },
        })
      }, delay)

      timers.set(task.id, timerId)
    }
  }

  return { reschedule, clearAll }
}
