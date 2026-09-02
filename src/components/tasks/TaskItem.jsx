import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { Briefcase, Home, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAssistant } from '@/lib/AssistantContext'

function dueLabel(dueAt) {
  if (!dueAt) return 'No due date'
  const d = parseISO(dueAt)
  if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`
  if (isTomorrow(d)) return `Tomorrow · ${format(d, 'h:mm a')}`
  return format(d, 'EEE, MMM d · h:mm a')
}

const priorityDot = {
  high: 'bg-coral',
  medium: 'bg-sun',
  low: 'bg-sea-bright',
}

export default function TaskItem({ task, onEdit }) {
  const { toggleComplete, deleteTask } = useAssistant()

  return (
    <article
      className={cn(
        'group flex items-start gap-3 border-b border-ink/10 py-3.5 last:border-b-0',
        task.completed && 'opacity-55'
      )}
    >
      <button
        type="button"
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        onClick={() => toggleComplete(task.id)}
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          task.completed
            ? 'border-sea bg-sea text-paper'
            : 'border-ink/25 hover:border-sea'
        )}
      >
        {task.completed ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M2 6.5l2.5 2.5L10 3.5" />
          </svg>
        ) : null}
      </button>

      <button type="button" onClick={() => onEdit?.(task)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5 rounded-full', priorityDot[task.priority] || priorityDot.medium)} />
          <h3
            className={cn(
              'truncate text-[0.98rem] font-semibold text-ink',
              task.completed && 'line-through'
            )}
          >
            {task.title}
          </h3>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/55">
          <span className="inline-flex items-center gap-1">
            {task.category === 'work' ? (
              <Briefcase className="h-3 w-3" />
            ) : (
              <Home className="h-3 w-3" />
            )}
            {task.category === 'work' ? 'Work' : 'Personal'}
          </span>
          <span>{dueLabel(task.dueAt)}</span>
        </div>
        {task.notes ? (
          <p className="mt-1 line-clamp-2 text-sm text-ink/60">{task.notes}</p>
        ) : null}
      </button>

      <button
        type="button"
        aria-label="Delete task"
        onClick={() => deleteTask(task.id)}
        className="rounded-lg p-1.5 text-ink/30 opacity-0 transition hover:bg-coral/10 hover:text-coral group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </article>
  )
}
