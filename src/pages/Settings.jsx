import { useEffect, useState } from 'react'
import { Bell, Download, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useAssistant } from '@/lib/AssistantContext'
import { showNotification } from '@/lib/notifications'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { settings, updateSettings, enableNotifications, tasks } = useAssistant()
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    setInstalled(standalone)

    function onPrompt(e) {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function onEnableNotifications() {
    const result = await enableNotifications()
    if (result.ok) {
      toast.success('Notifications enabled')
      await showNotification('The Assistant is ready', {
        body: 'You’ll get reminders for upcoming tasks while the app is open.',
        tag: 'welcome',
      })
    } else if (result.reason === 'denied') {
      toast.error('Notifications blocked — enable them in browser settings')
    } else if (result.reason === 'unsupported') {
      toast.error('Notifications are not supported in this browser')
    } else {
      toast.message('Notification permission not granted')
    }
  }

  async function onInstall() {
    if (!installPrompt) {
      toast.message('Use your browser’s Install / Add to Home Screen option')
      return
    }
    installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
      toast.success('The Assistant installed')
    }
    setInstallPrompt(null)
  }

  const openCount = tasks.filter((t) => !t.completed).length
  const doneCount = tasks.filter((t) => t.completed).length

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Settings</h2>
        <p className="text-sm text-ink/55">Notifications, install, and defaults.</p>
      </div>

      <section className="rounded-2xl bg-paper/80 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-mist p-2.5 text-sea">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-ink">Push reminders</h3>
            <p className="mt-0.5 text-sm text-ink/55">
              Remind you before a task is due. Works while The Assistant is open or installed.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onEnableNotifications}
                className="rounded-xl bg-sea px-3.5 py-2 text-sm font-semibold text-paper"
              >
                {settings.notificationsEnabled ? 'Re-check permission' : 'Enable notifications'}
              </button>
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <span>Remind</span>
                <select
                  value={settings.reminderMinutes}
                  onChange={(e) =>
                    updateSettings({ reminderMinutes: Number(e.target.value) })
                  }
                  className="rounded-lg border border-ink/15 bg-white px-2 py-1.5"
                >
                  <option value={5}>5 min before</option>
                  <option value={15}>15 min before</option>
                  <option value={30}>30 min before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-paper/80 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-mist p-2.5 text-sea">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-ink">Install on your phone</h3>
            <p className="mt-0.5 text-sm text-ink/55">
              Install as a Progressive Web App — home-screen icon, full-screen, no app store.
              A true APK (Capacitor/Android) can come next.
            </p>
            <button
              type="button"
              onClick={onInstall}
              disabled={installed}
              className={cn(
                'mt-3 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold',
                installed
                  ? 'bg-mist text-ink/50'
                  : 'bg-ink text-paper'
              )}
            >
              <Download className="h-4 w-4" />
              {installed ? 'Already installed' : 'Install The Assistant'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-paper/80 p-4">
        <h3 className="font-semibold text-ink">Default category</h3>
        <div className="mt-2 flex gap-1 rounded-xl bg-mist p-1">
          {['personal', 'work'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateSettings({ defaultCategory: c })}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-semibold capitalize',
                settings.defaultCategory === c ? 'bg-ink text-paper' : 'text-ink/60'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-ink/15 bg-transparent p-4 text-sm text-ink/55">
        <p>
          <span className="font-semibold text-ink">{openCount}</span> open ·{' '}
          <span className="font-semibold text-ink">{doneCount}</span> done
        </p>
        <p className="mt-1">Data stays on this device (local storage) for now.</p>
      </section>
    </div>
  )
}
