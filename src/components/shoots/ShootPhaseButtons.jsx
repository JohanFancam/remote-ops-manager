import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Check, Wrench, Camera, AlertTriangle, Volume2, Flag } from 'lucide-react';
import ShootCompleteModal from './ShootCompleteModal';

const PHASES = [
  { key: 'setup_complete', label: 'Setup Complete', Icon: Wrench, requiresRig: null },
  { key: 'pre_shoot_started', label: 'Pre-Shoot Started', Icon: Camera, requiresRig: null },
  { key: 'attention_started', label: 'Attention Started', Icon: AlertTriangle, requiresRig: 'attention_camera' },
  { key: 'sound_started', label: 'Sound Started', Icon: Volume2, requiresRig: 'sound' },
  { key: 'shoot_complete', label: 'Shoot Complete', Icon: Flag, requiresRig: null, isComplete: true },
];

function CopyableMessage({ message, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-zinc-100 border border-zinc-200 rounded-lg p-3 mt-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-zinc-500">📢 Copy to Slack:</p>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-5 text-xs text-zinc-500 hover:text-zinc-900 px-2"
            onClick={() => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <><Check className="h-3 w-3 mr-1 text-emerald-700" />Copied!</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
          </Button>
          <Button size="sm" variant="ghost" className="h-5 text-xs text-zinc-400 hover:text-zinc-900 px-1" onClick={onClose}>✕</Button>
        </div>
      </div>
      <pre className="text-xs text-zinc-600 whitespace-pre-wrap font-mono">{message}</pre>
    </div>
  );
}

export default function ShootPhaseButtons({ shoot, user, rigSetting, slackMessages, onUpdate }) {
  const [activeMessage, setActiveMessage] = useState(null);
  const [showComplete, setShowComplete] = useState(false);

  const phases = shoot.phase_status || {};

  const getSlackMessage = (phaseKey, label) => {
    const custom = slackMessages?.[phaseKey];
    const team = shoot.client || shoot.title;
    if (custom) return custom.replace('{team}', team).replace('{label}', label);
    return `${label} — ${team} shoot 🎬`;
  };

  const handlePhaseClick = async (phase) => {
    if (phase.isComplete) {
      setShowComplete(true);
      return;
    }
    const ts = new Date().toISOString();
    const updated = { ...phases, [phase.key]: ts };
    await onUpdate(shoot.id, { phase_status: updated });
    const msg = getSlackMessage(phase.key, phase.label);
    setActiveMessage({ key: phase.key, msg });
  };

  const visiblePhases = PHASES.filter(p => {
    if (!p.requiresRig) return true;
    if (p.requiresRig === 'attention_camera') return rigSetting?.attention_enabled === true;
    if (p.requiresRig === 'sound') return rigSetting?.sound_enabled === true;
    return true;
  });

  return (
    <div className="space-y-2 mt-3 pt-3 border-t border-zinc-200">
      <p className="text-xs text-zinc-400 uppercase tracking-wider">Phase Updates</p>
      {visiblePhases.map(phase => {
        const done = !!phases[phase.key];
        const isLast = phase.isComplete;
        return (
          <div key={phase.key}>
            <button
              onClick={() => !done && handlePhaseClick(phase)}
              disabled={done && !isLast}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between transition-all
                ${done
                  ? isLast
                    ? 'bg-green-900/60 border border-green-700 text-green-300 cursor-default'
                    : 'bg-zinc-200/40 border border-zinc-200 text-zinc-400 cursor-default'
                  : isLast
                    ? 'bg-red-900/30 border border-red-800 text-red-700 hover:bg-red-900/50'
                    : 'bg-zinc-100 border border-zinc-200 text-gray-200 hover:bg-zinc-200 hover:border-teal-700'
                }`}
            >
              <span className="flex items-center gap-2"><phase.Icon className="h-3.5 w-3.5 flex-shrink-0" />{phase.label}</span>
              {done && !isLast && <span className="text-xs text-emerald-700">✓ Done</span>}
            </button>
            {activeMessage?.key === phase.key && (
              <CopyableMessage message={activeMessage.msg} onClose={() => setActiveMessage(null)} />
            )}
          </div>
        );
      })}

      {showComplete && (
        <ShootCompleteModal
          shoot={shoot}
          user={user}
          onClose={() => setShowComplete(false)}
        />
      )}
    </div>
  );
}