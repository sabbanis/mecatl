import React, {useId} from 'react';
import clsx from 'clsx';
import d from './Doodles.module.css';

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

/* ─── band top edges ───────────────────────────────────────────────────────── */

export type WaveVariant = 'wave' | 'zig';

const ZIG = (() => {
  let p = 'M0 60V46';
  for (let x = 0; x < 1440; x += 120) p += `L${x + 60} 12L${x + 120} 46`;
  return `${p}V60Z`;
})();

/* `wave` — one gentle swell, used on the statement, outcomes and Stacklok bands. */
const WAVES: Record<WaveVariant, string> = {
  wave: 'M0 36C160 0 340 74 520 38S880 0 1060 36S1340 22 1440 34V60H0Z',
  zig: ZIG,
};

/** Sits on the top edge of a band and fills the gap above with the band colour (`--band-bg`). */
export function Wave({variant = 'wave', className}: {variant?: WaveVariant; className?: string}): React.ReactElement {
  return (
    <svg className={clsx(d.wave, className)} viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={WAVES[variant]} />
    </svg>
  );
}

/* ─── hand-drawn strokes (draw in via stroke-dashoffset) ───────────────────── */

type StrokeProps = {className?: string; /** CSS time, e.g. "1.1s" — offsets the draw-in. */ delay?: string};

export function Squiggle({className, delay}: StrokeProps): React.ReactElement {
  return (
    <svg
      className={clsx(d.stroke, className)}
      viewBox="0 0 200 22"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={{'--dd': delay} as Vars}
    >
      <path className={clsx(d.ink, d.path)} pathLength={1} d="M3 13C22 3 38 20 58 11S96 3 116 13S154 20 172 9S190 7 197 13" />
    </svg>
  );
}

export function WobblyArrow({className, delay}: StrokeProps): React.ReactElement {
  return (
    <svg className={clsx(d.stroke, className)} viewBox="0 0 170 110" aria-hidden="true" focusable="false" style={{'--dd': delay} as Vars}>
      <path className={clsx(d.ink, d.path)} pathLength={1} d="M10 8C18 50 56 92 154 82" />
      <path className={clsx(d.ink, d.path, d.late)} pathLength={1} d="M134 66l20 16-24 9" />
    </svg>
  );
}

const STAR4 = 'M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z';

export function Sparkles({className}: {className?: string}): React.ReactElement {
  return (
    <svg className={clsx(d.sparkles, className)} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g transform="translate(30 0) scale(1.35)">
        <g className={d.spark} style={{'--dd': '0.9s'} as Vars}>
          <path d={STAR4} />
        </g>
      </g>
      <g transform="translate(2 30) scale(0.95)">
        <g className={d.spark} style={{'--dd': '1.05s'} as Vars}>
          <path d={STAR4} />
        </g>
      </g>
      <g transform="translate(42 42) scale(0.7)">
        <g className={d.spark} style={{'--dd': '1.2s'} as Vars}>
          <path d={STAR4} />
        </g>
      </g>
    </svg>
  );
}

const STAR5 = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 4.2 : 10;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push(`${(10 + r * Math.cos(a)).toFixed(2)},${(10 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
})();

/** Small filled star — the drawn "Copied ★" glyph. */
export function StarGlyph({className}: {className?: string}): React.ReactElement {
  return (
    <svg className={clsx(d.star, className)} viewBox="-2 -2 24 24" aria-hidden="true" focusable="false">
      <polygon points={STAR5} />
    </svg>
  );
}

/* ─── stickers & stamps ────────────────────────────────────────────────────── */

export type StickerTone = 'gold' | 'teal' | 'paper' | 'tangerine' | 'ink';

const TONES: Record<StickerTone, string | undefined> = {
  gold: undefined,
  teal: d.teal,
  paper: d.paper,
  tangerine: d.tangerine,
  ink: d.inkTone,
};

type StickerProps = {
  tone?: StickerTone;
  /** Resting rotation in degrees. */
  rotate?: number;
  /** Sentence case instead of the default chunky uppercase. */
  lower?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Sticker({tone = 'gold', rotate = -4, lower = false, className, children}: StickerProps): React.ReactElement {
  return (
    <span className={clsx(d.sticker, TONES[tone], lower && d.lower, className)} style={{'--rot': `${rotate}deg`} as Vars}>
      {children}
    </span>
  );
}

const BURST_POINTS = (() => {
  const pts: string[] = [];
  const n = 14;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 40 : 49;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
})();

export function Starburst({rotate = -8, className, children}: {rotate?: number; className?: string; children: React.ReactNode}): React.ReactElement {
  return (
    <span className={clsx(d.burst, className)} style={{'--rot': `${rotate}deg`} as Vars}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <polygon points={BURST_POINTS} />
      </svg>
      <span className={d.burstText}>{children}</span>
    </span>
  );
}

/** Circular text stamp; spins slowly only while `run` (the parent gates it on visibility + reduced motion). */
export function RingStamp({text, run = false, className}: {text: string; run?: boolean; className?: string}): React.ReactElement {
  const pid = `studio-ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className={clsx(d.stamp, run && d.run, className)} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <path id={pid} d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1-148 0" fill="none" />
      </defs>
      <text className={d.stampText}>
        <textPath href={`#${pid}`}>{text.repeat(3).trim()}</textPath>
      </text>
    </svg>
  );
}
