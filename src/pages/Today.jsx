import { useMemo, useState } from 'react'
import { isToday, isPast, parseISO, startOfDay } from 'date-fns'
import { Plus } from 'lucide-react'
import { useAssistant } from '@/lib/AssistantContext'
import TaskItem from '@/components/tasks/TaskItem'
import TaskForm from '@/components/tasks/TaskForm'

export default function TodayPage() {
  const { tasks } = useAssistant()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const { dueToday, overdue, upcoming } = useMemo(() => {
    const open = tasks.filter((t) => !t.completed)
    const dueToday = []
    const overdue = []
    const upcoming = []
    const todayStart = startOfDay(new Date())

    for (const t of open) {
      if (!t.dueAt) {
        upcoming.push(t)
        continue
      }
      const due = parseISO(t.dueAt)
      if (isToday(due)) dueToday.push(t)
      else if (isPast(due) && due < todayStart) overdue.push(t)
      else upcoming.push(t)
    }

    const byDue = (a, b) => {
      if (!a.dueAt) return 1
      if (!b.dueAt) return -1
      return new Date(a.dueAt) - new Date(b.dueAt)
    }

    return {
      dueToday: dueToday.sort(byDue),
      overdue: overdue.sort(byDue),
      upcoming: upcoming.sort(byDue).slice(0, 5),
    }
  }, [tasks])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(task) {
    setEditing(task)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="relative overflow-hidden rounded-[1.6rem] bg-ink px-5 py-6 text-paper">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sea-bright/30 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 left-8 h-32 w-32 rounded-full bg-sun/25 blur-2xl"
          aria-hidden
        />
        <p className="text-sm font-medium text-paper/70">{greeting}</p>
        <h2 className="mt-1 font-display text-[1.85rem] font-semibold leading-tight tracking-tight">
          {dueToday.length === 0
            ? 'Your day is clear.'
            : `${dueToday.length} task${dueToday.length === 1 ? '' : 's'} for today.`}
        </h2>
        <p className="mt-2 max-w-[18rem] text-sm text-paper/65">
          Capture work and personal to-dos, then let The Assistant keep the calendar honest.
        </p>
        <button
          type="button"
          onClick={openNew}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sun px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add a task
        </button>
      </section>

      {overdue.length > 0 ? (
        <section>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-coral">
            Overdue
          </h3>
          <div className="rounded-2xl bg-paper/70 px-4">
            {overdue.map((t) => (
              <TaskItem key={t.id} task={t} onEdit={openEdit} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-ink/45">
          Today
        </h3>
        <div className="rounded-2xl bg-paper/70 px-4">
          {dueToday.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/45">Nothing due today — nice.</p>
          ) : (
            dueToday.map((t) => <TaskItem key={t.id} task={t} onEdit={openEdit} />)
          )}
        </div>
      </section>

      {upcoming.length > 0 ? (
        <section>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-ink/45">
            Coming up
          </h3>
          <div className="rounded-2xl bg-paper/70 px-4">
            {upcoming.map((t) => (
              <TaskItem key={t.id} task={t} onEdit={openEdit} />
            ))}
          </div>
        </section>
      ) : null}

      <TaskForm
        open={formOpen}
        task={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}
