import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAssistant } from '@/lib/AssistantContext'
import TaskItem from '@/components/tasks/TaskItem'
import TaskForm from '@/components/tasks/TaskForm'
import { cn } from '@/lib/utils'

export default function CalendarPage() {
  const { tasks } = useAssistant()
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor))
    const end = endOfWeek(endOfMonth(cursor))
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const tasksByDay = useMemo(() => {
    const map = new Map()
    for (const t of tasks) {
      if (!t.dueAt || t.completed) continue
      const key = format(parseISO(t.dueAt), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(t)
    }
    return map
  }, [tasks])

  const selectedKey = format(selected, 'yyyy-MM-dd')
  const dayTasks = (tasksByDay.get(selectedKey) || []).sort(
    (a, b) => new Date(a.dueAt) - new Date(b.dueAt)
  )

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Calendar</h2>
          <p className="text-sm text-ink/55">Tasks on the days they belong.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sea text-paper shadow-lg shadow-sea/25"
          aria-label="New task"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      <section className="rounded-[1.4rem] bg-paper/80 p-3 shadow-sm shadow-ink/5">
        <div className="mb-3 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="rounded-xl p-2 text-ink/60 hover:bg-mist"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="font-display text-xl font-semibold text-ink">
            {format(cursor, 'MMMM yyyy')}
          </h3>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="rounded-xl p-2 text-ink/60 hover:bg-mist"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-bold uppercase tracking-wider text-ink/40">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const count = tasksByDay.get(key)?.length || 0
            const inMonth = isSameMonth(day, cursor)
            const active = isSameDay(day, selected)
            const today = isToday(day)

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(day)}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold transition',
                  !inMonth && 'text-ink/25',
                  inMonth && !active && 'text-ink hover:bg-mist',
                  active && 'bg-ink text-paper',
                  today && !active && 'ring-2 ring-sea/40'
                )}
              >
                {format(day, 'd')}
                {count > 0 ? (
                  <span
                    className={cn(
                      'mt-0.5 h-1 w-1 rounded-full',
                      active ? 'bg-sun' : 'bg-sea'
                    )}
                  />
                ) : (
                  <span className="mt-0.5 h-1 w-1" />
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-ink/45">
          {format(selected, 'EEEE, MMM d')}
        </h3>
        <div className="rounded-2xl bg-paper/70 px-4">
          {dayTasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/45">No tasks on this day.</p>
          ) : (
            dayTasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onEdit={(task) => {
                  setEditing(task)
                  setFormOpen(true)
                }}
              />
            ))
          )}
        </div>
      </section>

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
