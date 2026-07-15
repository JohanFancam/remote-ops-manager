export default function CompleteModal({ shoot, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 p-0 md:items-center md:p-6">
      <button type="button" className="absolute inset-0" aria-label="Cancel" onClick={onCancel} />
      <div
        className="relative z-10 w-full max-w-md animate-rise-in border border-ink-600 bg-ink-900 p-5"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <h2 className="font-display text-xl font-bold text-mist">Complete shoot?</h2>
        <p className="mt-2 text-sm text-mist-muted">
          Confirm that <span className="text-mist">{shoot.title}</span> is finished. Closing this
          dialog will not complete the shoot.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="touch-target flex-1 bg-blue py-3 font-display text-sm font-bold text-white"
          >
            Confirm complete
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="touch-target flex-1 border border-ink-600 py-3 text-sm text-mist-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
