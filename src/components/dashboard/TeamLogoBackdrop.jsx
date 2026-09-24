import React, { useState } from 'react';
import { readTileLogoSettings, resolveTeamMarks, TILE_LOGO_TONE_FILTER } from '@/utils/teamLogos';

function CornerMark({ mark, side, sizePercent, opacityPercent }) {
  const [failed, setFailed] = useState(false);
  if (!mark) return null;
  const position = side === 'left' ? 'left-3 bottom-3' : 'right-3 bottom-3';
  const px = Math.round(48 * (sizePercent / 100));
  const showImage = mark.url && !failed;
  const tone = {
    filter: TILE_LOGO_TONE_FILTER,
    opacity: opacityPercent / 100,
  };
  return (
    <div
      className={`pointer-events-none absolute ${position} z-0`}
      style={{ width: px, height: px }}
    >
      {showImage ? (
        <img
          src={mark.url}
          alt=""
          className="h-full w-full object-contain select-none"
          style={tone}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-md bg-slate-800/40 text-sm font-black text-white select-none"
          style={{ opacity: opacityPercent / 100 }}
        >
          {mark.monogram}
        </span>
      )}
    </div>
  );
}

export default function TeamLogoBackdrop({ title, sport, appSettings = [] }) {
  const { enabled, sizePercent, opacityPercent, overrides } = readTileLogoSettings(appSettings);
  if (!enabled) return null;
  const marks = resolveTeamMarks(title, sport, overrides);
  if (marks.length === 0) return null;
  const left = marks[0];
  const right = marks.length > 1 ? marks[1] : null;
  return (
    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden rounded-xl lg:block" aria-hidden>
      <CornerMark mark={left} side="left" sizePercent={sizePercent} opacityPercent={opacityPercent} />
      {right ? <CornerMark mark={right} side="right" sizePercent={sizePercent} opacityPercent={opacityPercent} /> : null}
    </div>
  );
}
