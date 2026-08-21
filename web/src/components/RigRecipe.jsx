export default function RigRecipe({ rig }) {
  if (!rig) return null;

  const cams = [
    rig.dataEnabled && rig.dataHd && { label: 'Data HD', ...rig.dataHd },
    rig.dataWide && { label: 'Data Wide', ...rig.dataWide },
    rig.attentionEnabled && rig.attentionHd && { label: 'Attention', ...rig.attentionHd },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Meta label="Venue" value={rig.venueType} />
        <Meta label="Sport" value={rig.sport} />
        <Meta label="Type" value={rig.rigType} />
        {rig.soundEnabled && <Meta label="Sound" value="Enabled" />}
      </div>
      {rig.shootPlan && (
        <p className="max-w-2xl text-sm leading-relaxed text-mist">{rig.shootPlan}</p>
      )}
      {cams.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cams.map((c) => (
            <div key={c.label} className="border-t border-ink-600 pt-3">
              <p className="font-mono text-xs uppercase tracking-widest text-blue-bright">{c.label}</p>
              <p className="mt-2 font-mono text-sm text-mist">
                {c.shutter} · {c.aperture} · ISO {c.iso}
              </p>
            </div>
          ))}
        </div>
      )}
      {rig.remoteRigs?.length > 0 && (
        <p className="text-sm text-mist-muted">Remotes: {rig.remoteRigs.join(' · ')}</p>
      )}
      {rig.notes && <p className="text-sm text-mist-muted">{rig.notes}</p>}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <p>
      <span className="text-mist-muted">{label} </span>
      <span className="text-mist">{value}</span>
    </p>
  );
}
