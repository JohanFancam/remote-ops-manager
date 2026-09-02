import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAssistant } from '@/lib/AssistantContext'
import TaskItem from '@/components/tasks/TaskItem'
import TaskForm from '@/components/tasks/TaskForm'
import { cn } from '@/lib/utils'

const filters = [
  { id: 'all', label: 'All' },
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' },
  { id: 'done', label: 'Done' },
]

export default function TasksPage() {
  const { tasks } = useAssistant()
  const [filter, setFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const list = useMemo(() => {
    let next = [...tasks]
    if (filter === 'done') next = next.filter((t) => t.completed)
    else if (filter === 'personal' || filter === 'work') {
      next = next.filter((t) => !t.completed && t.category === filter)
    } else {
      next = next.filter((t) => !t.completed)
    }
    return next.sort((a, b) => {
      if (!a.dueAt) return 1
      if (!b.dueAt) return -1
      return new Date(a.dueAt) - new Date(b.dueAt)
    })
  }, [tasks, filter])

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Tasks</h2>
          <p className="text-sm text-ink/55">Personal and work — one list.</p>
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

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-paper/70 p-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition',
              filter === f.id ? 'bg-ink text-paper' : 'text-ink/55 hover:text-ink'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-paper/70 px-4">
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink/45">No tasks here yet.</p>
        ) : (
          list.map((t) => (
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
