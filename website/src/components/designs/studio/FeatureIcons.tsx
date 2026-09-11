import React from 'react';
import clsx from 'clsx';
import useLoopActive from './useLoopActive';
import s from './FeatureIcons.module.css';

/**
 * Sticker-style icons for the six key-feature tiles. Pure inline SVG on a
 * 64×64 grid: wobbly ink outlines, one or two flat fills (white + the tile's
 * `--dot` accent) and a hard 3px ink shadow behind the main silhouette.
 * Decorative only — every wrapper is aria-hidden.
 */
export type FeatureIconName = 'loop' | 'port' | 'cloud' | 'code' | 'lens' | 'badge';

export type IconProps = {className?: string};

const STAR4 = 'M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z';

/** Pointy-top hexagon as a `points` string. */
export const hex = (cx: number, cy: number, r: number): string =>
  Array.from({length: 6}, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

/** Shared sticker frame (also used by DeployIcons): aria-hidden wrapper + 64×64 viewBox. */
export function Frame({className, run = false, wrapRef, children}: IconProps & {run?: boolean; wrapRef?: React.Ref<HTMLSpanElement>; children: React.ReactNode}): React.ReactElement {
  return (
    <span ref={wrapRef} className={clsx(s.wrap, run && s.run, className)} aria-hidden="true">
      <svg className={s.svg} viewBox="0 0 64 64" focusable="false">
        {children}
      </svg>
    </span>
  );
}

/* 01 — looping arrow ring with a dot travelling around it */
const DISC = 'M30 7C44 6 54.5 18 54 31.5 53.5 44.5 43.5 55.5 30 55 16.5 54.5 6.5 44.5 6 31 5.5 17.5 17 7.5 30 7Z';
const RING = 'M28.8 17.05A14 14 0 1 1 16.8 26.2';
const HEAD = 'M19.5 18.7L22.9 30 9.7 25.2Z';

export function LoopIcon({className}: IconProps): React.ReactElement {
  const {ref, active} = useLoopActive<HTMLSpanElement>();
  return (
    <Frame className={className} run={active} wrapRef={ref}>
      <g className={s.sh} transform="translate(3 3)">
        <path d={DISC} />
      </g>
      <path className={s.wh} d={DISC} />
      <path className={s.band} d={RING} />
      <path className={s.ac} d={HEAD} />
      <path className={s.bandFill} d={RING} />
      <g className={s.orbit}>
        <circle className={s.wh} cx="39.9" cy="40.9" r="4.2" />
      </g>
    </Frame>
  );
}

/* 02 — plug sitting just out of its socket, with a zap */
const SOCKET = 'M10.5 17.5h10c3.3 0 6 2.7 6 6v20c0 3.3-2.7 6-6 6h-10c-3.3 0-6-2.7-6-6v-20c0-3.3 2.7-6 6-6z';
const PLUG = 'M42.5 21h7c3 0 5.5 2.5 5.5 5.5v14c0 3-2.5 5.5-5.5 5.5h-7c-3 0-5.5-2.5-5.5-5.5v-14c0-3 2.5-5.5 5.5-5.5z';
const ZAP = 'M32 3l-5 9h4l-2 7 7-10h-4z';

export function PortIcon({className}: IconProps): React.ReactElement {
  return (
    <Frame className={className}>
      <g className={s.sh} transform="translate(3 3)">
        <path d={SOCKET} />
        <path d={PLUG} />
      </g>
      <path className={s.wh} d={SOCKET} />
      <rect className={s.ik} x="19" y="25.5" width="6" height="5" rx="1.5" />
      <rect className={s.ik} x="19" y="36.5" width="6" height="5" rx="1.5" />
      <path className={s.prong} d="M31.5 28h6M31.5 39h6" />
      <path className={s.ac} d={PLUG} />
      <path className={clsx(s.ln, s.bold)} d="M55 33.5c4.5 0 6.5-4 6-11.5" />
      <path className={clsx(s.gd, s.thin)} d={ZAP} />
    </Frame>
  );
}

/* 03 — cloud with three pods tucked underneath */
const CLOUD =
  'M12 36C6.5 36 3.5 31.5 4.5 27.5 5.5 23.5 9.5 21 13.5 21.8 14.5 13.5 21.5 8 29 8.5 35.5 9 40.5 13.5 41.5 19.5 46.5 18.5 51.5 22 51.5 27 56 27.5 58.5 31.5 57.5 34.5 56.8 36 55 36.5 53 36.5Z';
const PODS = [hex(16, 41.5, 7.5), hex(31, 43.5, 7.5), hex(46, 41.5, 7.5)];

export function CloudIcon({className}: IconProps): React.ReactElement {
  return (
    <Frame className={className}>
      <g className={s.sh} transform="translate(3 3)">
        <path d={CLOUD} />
        {PODS.map((p) => (
          <polygon key={p} points={p} />
        ))}
      </g>
      {PODS.map((p) => (
        <polygon key={p} className={s.ac} points={p} />
      ))}
      <path className={s.wh} d={CLOUD} />
    </Frame>
  );
}

/* 04 — code block: chunky window, accent title bar, </> */
const BOX = 'M13 8h34c5 0 9 4 9 9v26c0 5-4 9-9 9H13c-5 0-9-4-9-9V17c0-5 4-9 9-9z';
const BAR = 'M13 8h34c5 0 9 4 9 9v3.5H4V17c0-5 4-9 9-9z';

export function CodeIcon({className}: IconProps): React.ReactElement {
  return (
    <Frame className={className}>
      <g className={s.sh} transform="translate(3 3)">
        <path d={BOX} />
      </g>
      <path className={s.wh} d={BOX} />
      <path className={s.ac} d={BAR} />
      <path className={clsx(s.ln, s.bold)} d="M22 28l-8 7.5 8 7.5M38 28l8 7.5-8 7.5M33.5 26.5l-7 19" />
    </Frame>
  );
}

/* 05 — magnifying glass over three bars of different heights */
const BARS = [
  {x: 5, y: 40, h: 16},
  {x: 17, y: 24, h: 32},
  {x: 29, y: 32, h: 24},
];
const HANDLE = 'M51.5 30.5L58 37';

export function LensIcon({className}: IconProps): React.ReactElement {
  return (
    <Frame className={className}>
      <g className={s.sh} transform="translate(3 3)">
        {BARS.map((b) => (
          <rect key={b.x} x={b.x} y={b.y} width="9" height={b.h} rx="2.5" />
        ))}
        <circle cx="42" cy="21" r="13" />
        <path className={s.shStroke} d={HANDLE} />
      </g>
      {BARS.map((b) => (
        <rect key={b.x} className={s.ac} x={b.x} y={b.y} width="9" height={b.h} rx="2.5" />
      ))}
      <circle className={s.wh} cx="42" cy="21" r="13" />
      <path className={s.handle} d={HANDLE} />
      <path className={clsx(s.ln, s.thin)} d="M35.5 16c1.2-2.6 3.5-4.3 6.3-4.8" />
    </Frame>
  );
}

/* 06 — badge with a chunky check and a sparkle */
const SHIELD = 'M31 5.5C38 8.5 45.5 10.5 53 12c.8 15-5.5 30.5-22 45.5C14.5 42.5 8.2 27 9 12 16.5 10.5 24 8.5 31 5.5z';
const CHECK = 'M22 32.5l5.5-6 4.5 4.5 10.5-11 5 5L32 41.5z';

export function BadgeIcon({className}: IconProps): React.ReactElement {
  return (
    <Frame className={className}>
      <g className={s.sh} transform="translate(3 3)">
        <path d={SHIELD} />
      </g>
      <path className={s.ac} d={SHIELD} />
      <path className={clsx(s.wh, s.thin)} d={CHECK} />
      <g transform="translate(49 1) scale(0.42)">
        <path className={clsx(s.gd, s.thin)} d={STAR4} />
      </g>
    </Frame>
  );
}

const ICONS: Record<FeatureIconName, (p: IconProps) => React.ReactElement> = {
  loop: LoopIcon,
  port: PortIcon,
  cloud: CloudIcon,
  code: CodeIcon,
  lens: LensIcon,
  badge: BadgeIcon,
};

export default function FeatureIcon({name, className}: IconProps & {name: FeatureIconName}): React.ReactElement {
  const Icon = ICONS[name];
  return <Icon className={className} />;
}
