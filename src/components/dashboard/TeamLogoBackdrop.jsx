import React, { useState } from 'react';
import { readTileLogoSettings, resolveTeamMarks } from '@/utils/teamLogos';

function Watermark({ mark, side, sizePercent }) {
  const [failed, setFailed] = useState(false);
  if (!mark) return null;
  const position = side === 'left'
    ? 'left-[-8%] bottom-[-18%]'
    : 'right-[-8%] bottom-[-18%]';
  const origin = side === 'left' ? 'left bottom' : 'right bottom';
  const showImage = mark.url && !failed;
  return (
    <div
      className={`pointer-events-none absolute ${position} h-[145%] w-[58%] max-w-none`}
      style={{ transform: `scale(${sizePercent / 100})`, transformOrigin: origin }}
    >
      {showImage ? (
        <img
          src={mark.url}
          alt=""
          className="h-full w-full object-contain opacity-[0.16] select-none"
          style={{ filter: 'grayscale(1) brightness(0) invert(1)' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-end justify-center text-[9.5rem] font-black leading-none text-white/[0.12] select-none">
          {mark.monogram}
        </span>
      )}
    </div>
  );
}

export default function TeamLogoBackdrop({ title, sport, appSettings = [] }) {
  const { enabled, sizePercent } = readTileLogoSettings(appSettings);
  if (!enabled) return null;
  const marks = resolveTeamMarks(title, sport);
  if (marks.length === 0) return null;
  const left = marks[0];
  const right = marks.length > 1 ? marks[1] : null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
      <Watermark mark={left} side="left" sizePercent={sizePercent} />
      {right ? <Watermark mark={right} side="right" sizePercent={sizePercent} /> : null}
    </div>
  );
}
