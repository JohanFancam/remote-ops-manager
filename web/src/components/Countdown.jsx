import { useEffect, useState } from 'react';

export default function Countdown({ targetIso }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(targetIso).getTime();
  const diff = target - now;
  const past = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.24em] text-mist-muted">
        {past ? 'Game clock' : 'Countdown to game'}
      </p>
      <p
        className={`mt-2 font-mono text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl ${
          past ? 'text-mist' : 'animate-pulse-glow text-lime'
        }`}
      >
        {past ? '+' : '−'}
        {pad(h)}:{pad(m)}:{pad(s)}
      </p>
    </div>
  );
}
