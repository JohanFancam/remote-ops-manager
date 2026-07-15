const NEXT = {
  scheduled: 'setup_started',
  setup_started: 'setup_complete',
  setup_complete: 'game_started',
  game_started: 'completed',
};

const LABELS = {
  setup_started: 'Setup started',
  setup_complete: 'Setup complete',
  game_started: 'Game started',
  completed: 'Complete shoot',
};

export default function ShootCard({ shoot, emphasized, onAdvance, canAdvance }) {
  const next = NEXT[shoot.status];
  const ops = shoot.assignedOperators || [];

  return (
    <article className={`border-t border-ink-600 pt-4 ${emphasized ? 'pb-2' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={`font-display font-bold text-mist ${emphasized ? 'text-2xl' : 'text-lg'}`}>
          {shoot.teamName || shoot.title}
        </h3>
        <span className="font-mono text-xs uppercase tracking-wider text-blue-bright">
          {String(shoot.status || '').replaceAll('_', ' ')}
        </span>
      </div>
      <p className="mt-1 text-sm text-mist-muted">{shoot.title}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <Item label="Date" value={shoot.date} />
        <Item label="Setup" value={shoot.setupTime || '—'} />
        <Item label="Game" value={shoot.gameTime} />
        <Item label="Venue" value={shoot.venue || '—'} />
        <Item label="Type" value={shoot.shootType || '—'} />
        <Item label="Rig" value={shoot.rig?.name || '—'} />
      </dl>
      <p className="mt-3 text-sm text-mist-muted">
        Operators:{' '}
        <span className="text-mist">
          {ops.length ? ops.map((o) => o.fullName).join(', ') : '—'}
        </span>
      </p>
      {canAdvance && next && onAdvance && (
        <button
          type="button"
          onClick={() => onAdvance(shoot, next)}
          className="touch-target mt-4 bg-blue px-4 py-2.5 font-display text-sm font-bold text-white hover:bg-blue-deep"
        >
          {LABELS[next]}
        </button>
      )}
    </article>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-mist-muted">{label}</dt>
      <dd className="text-mist">{value}</dd>
    </div>
  );
}
