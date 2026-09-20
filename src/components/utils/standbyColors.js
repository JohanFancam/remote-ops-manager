import { normalizeEmail } from '@/utils/assignmentApproval';

/** Distinct palette so each standby person stays recognizable on the calendar. */
export const STANDBY_PALETTE = [
  {
    key: 'sky',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    highlight: 'bg-sky-500/20 text-sky-200',
    chip: 'bg-sky-950/50 text-sky-300 border-sky-500/40',
    button: 'border-sky-500/40 bg-sky-600/15 text-sky-300 hover:bg-sky-500/20',
    accent: 'border-l-sky-400',
  },
  {
    key: 'violet',
    dot: 'bg-violet-400',
    text: 'text-violet-300',
    highlight: 'bg-violet-500/20 text-violet-200',
    chip: 'bg-violet-950/50 text-violet-300 border-violet-500/40',
    button: 'border-violet-500/40 bg-violet-600/15 text-violet-300 hover:bg-violet-500/20',
    accent: 'border-l-violet-400',
  },
  {
    key: 'teal',
    dot: 'bg-teal-400',
    text: 'text-teal-300',
    highlight: 'bg-teal-500/20 text-teal-200',
    chip: 'bg-teal-950/50 text-teal-300 border-teal-500/40',
    button: 'border-teal-500/40 bg-teal-600/15 text-teal-300 hover:bg-teal-500/20',
    accent: 'border-l-teal-400',
  },
  {
    key: 'rose',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
    highlight: 'bg-rose-500/20 text-rose-200',
    chip: 'bg-rose-950/50 text-rose-300 border-rose-500/40',
    button: 'border-rose-500/40 bg-rose-600/15 text-rose-300 hover:bg-rose-500/20',
    accent: 'border-l-rose-400',
  },
  {
    key: 'amber',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    highlight: 'bg-amber-500/20 text-amber-100',
    chip: 'bg-amber-950/50 text-amber-200 border-amber-500/40',
    button: 'border-amber-500/40 bg-amber-600/15 text-amber-200 hover:bg-amber-500/20',
    accent: 'border-l-amber-400',
  },
  {
    key: 'lime',
    dot: 'bg-lime-400',
    text: 'text-lime-300',
    highlight: 'bg-lime-500/20 text-lime-200',
    chip: 'bg-lime-950/50 text-lime-300 border-lime-500/40',
    button: 'border-lime-500/40 bg-lime-600/15 text-lime-300 hover:bg-lime-500/20',
    accent: 'border-l-lime-400',
  },
  {
    key: 'fuchsia',
    dot: 'bg-fuchsia-400',
    text: 'text-fuchsia-300',
    highlight: 'bg-fuchsia-500/20 text-fuchsia-200',
    chip: 'bg-fuchsia-950/50 text-fuchsia-300 border-fuchsia-500/40',
    button: 'border-fuchsia-500/40 bg-fuchsia-600/15 text-fuchsia-300 hover:bg-fuchsia-500/20',
    accent: 'border-l-fuchsia-400',
  },
  {
    key: 'cyan',
    dot: 'bg-cyan-400',
    text: 'text-cyan-300',
    highlight: 'bg-cyan-500/20 text-cyan-200',
    chip: 'bg-cyan-950/50 text-cyan-300 border-cyan-500/40',
    button: 'border-cyan-500/40 bg-cyan-600/15 text-cyan-300 hover:bg-cyan-500/20',
    accent: 'border-l-cyan-400',
  },
];

export const EMPTY_STANDBY_COLOR = {
  key: 'empty',
  dot: 'bg-slate-500',
  text: 'text-slate-400',
  highlight: '',
  chip: 'bg-slate-800/70 text-slate-400 border-slate-700',
  button: 'border-slate-700 text-slate-400 hover:text-slate-100 hover:bg-slate-800',
  accent: 'border-l-transparent',
};

function hashEmail(email) {
  const s = normalizeEmail(email);
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function standbyColorForEmail(email) {
  if (!normalizeEmail(email)) return EMPTY_STANDBY_COLOR;
  return STANDBY_PALETTE[hashEmail(email) % STANDBY_PALETTE.length];
}

export function uniqueStandbyPeople(standbyDays = []) {
  const map = new Map();
  (standbyDays || []).forEach((day) => {
    const email = normalizeEmail(day?.admin_email);
    if (!email || map.has(email)) return;
    map.set(email, {
      email,
      name: day.admin_name || day.admin_email || email,
      color: standbyColorForEmail(email),
    });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
