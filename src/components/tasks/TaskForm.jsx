import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAssistant } from '@/lib/AssistantContext'
import { cn } from '@/lib/utils'

function toLocalInput(iso) {
  if (!iso) return ''
  const d = parseISO(iso)
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

const empty = {
  title: '',
  notes: '',
  category: 'personal',
  priority: 'medium',
  dueAt: '',
}

export default function TaskForm({ open, onClose, task }) {
  const { upsertTask, settings } = useAssistant()
  const [form, setForm] = useState(empty)

  useEffect(() => {
    if (!open) return
    if (task) {
      setForm({
        id: task.id,
        title: task.title || '',
        notes: task.notes || '',
        category: task.category || 'personal',
        priority: task.priority || 'medium',
        dueAt: toLocalInput(task.dueAt),
      })
    } else {
      const defaultDue = new Date()
      defaultDue.setMinutes(0, 0, 0)
      defaultDue.setHours(defaultDue.getHours() + 1)
      setForm({
        ...empty,
        category: settings.defaultCategory || 'personal',
        dueAt: format(defaultDue, "yyyy-MM-dd'T'HH:mm"),
      })
    }
  }, [open, task, settings.defaultCategory])

  function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    upsertTask({
      ...form,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    })
    onClose?.()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 flex items-end justify-center bg-ink/60 p-3 sm:items-center"
          style={{ zIndex: 200 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-md rounded-3xl bg-paper p-5 shadow-2xl shadow-ink/30"
            style={{ zIndex: 201 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-ink">
                {task ? 'Edit task' : 'New task'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-ink/50 hover:bg-mist"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="block text-sm font-semibold text-ink/70">
              Title
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="What needs doing?"
                className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-base text-ink outline-none ring-sea/40 focus:ring-2"
              />
            </label>

            <label className="mt-3 block text-sm font-semibold text-ink/70">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Optional details"
                className="mt-1.5 w-full resize-none rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-base text-ink outline-none ring-sea/40 focus:ring-2"
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <fieldset>
                <legend className="text-sm font-semibold text-ink/70">Category</legend>
                <div className="mt-1.5 flex gap-1 rounded-xl bg-mist p-1">
                  {['personal', 'work'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: c }))}
                      className={cn(
                        'flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition',
                        form.category === c ? 'bg-ink text-paper' : 'text-ink/60'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold text-ink/70">Priority</legend>
                <div className="mt-1.5 flex gap-1 rounded-xl bg-mist p-1">
                  {['low', 'medium', 'high'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, priority: p }))}
                      className={cn(
                        'flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition',
                        form.priority === p ? 'bg-ink text-paper' : 'text-ink/60'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <label className="mt-3 block text-sm font-semibold text-ink/70">
              Due
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-base text-ink outline-none ring-sea/40 focus:ring-2"
              />
            </label>

            <button
              type="submit"
              className="mt-5 w-full rounded-2xl bg-sea py-3 text-base font-semibold text-paper transition hover:bg-sea-bright"
            >
              {task ? 'Save changes' : 'Add task'}
            </button>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
