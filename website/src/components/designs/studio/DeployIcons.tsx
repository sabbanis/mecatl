import React from 'react';
import clsx from 'clsx';
import {Frame, hex, type IconProps} from './FeatureIcons';
import s from './FeatureIcons.module.css';

/**
 * Sticker-style icons for the four deployment tiles — same family as the
 * bento's FeatureIcons: 64×64 grid, chunky ink outline, one or two flat fills
 * (white, gold and the tile's `--dot` accent) and a hard 3px ink shadow behind
 * the main silhouette. Decorative only — the frame is aria-hidden.
 */
export type DeployIconName = 'terminal' | 'pods' | 'pipeline' | 'embed';

const STAR4 = 'M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z';

/* Local or remote — terminal window: gold title bar, `>` prompt, accent block cursor */
const TERM = 'M11 10h42c4.5 0 8 3.5 8 8v28c0 4.5-3.5 8-8 8H11c-4.5 0-8-3.5-8-8V18c0-4.5 3.5-8 8-8z';
const TERM_BAR = 'M11 10h42c4.5 0 8 3.5 8 8v3H3v-3c0-4.5 3.5-8 8-8z';

export function TerminalIcon({className}: IconProps): React.ReactElement {
  return (
    <Frame className={className}>
      <g className={s.sh} transform="translate(3 3)">
        <path d={TERM} />
      </g>
      <path className={s.wh} d={TERM} />
      <path className={s.gd} d={TERM_BAR} />
      <path className={clsx(s.ln, s.bold)} d="M13 31l8 7.5-8 7.5" />
      <rect className={s.ac} x="26" y="34" width="13" height="9" rx="2" />
    </Frame>
  );
}

/* Cloud-native — three hexagon pods in a honeycomb cluster */
const PODS = [hex(32, 20, 12.5), hex(19.5, 41.5, 12.5), hex(44.5, 41.5, 12.5)];
const POD_FILL = [s.wh, s.ac, s.gd];

export function PodsIcon({className}: IconProps): React.ReactElement {
  return (
    <Frame className={className}>
      <g className={s.sh} transform="translate(3 3)">
        {PODS.map((p) => (
          <polygon key={p} points={p} />
        ))}
      </g>
      {PODS.map((p, i) => (
        <polygon key={p} className={POD_FILL[i]} points={p} />
      ))}
    </Frame>
  );
}

/* CI — pipeline arrow with two accent segments and a gold check disc at the end */
const PIPE = 'M3 25h27v-10l15 17-15 17v-10H3z';

export function PipelineIcon({className}: IconProps): React.ReactElement {
  return (
    <Frame className={className}>
      <g className={s.sh} transform="translate(3 3)">
        <path d={PIPE} />
        <circle cx="50" cy="32" r="11" />
      </g>
      <path className={s.wh} d={PIPE} />
      <rect className={clsx(s.ac, s.thin)} x="8" y="28.5" width="8" height="7" rx="2" />
      <rect className={clsx(s.ac, s.thin)} x="20.5" y="28.5" width="8" height="7" rx="2" />
      <circle className={s.gd} cx="50" cy="32" r="11" />
      <path className={clsx(s.ln, s.bold)} d="M44.5 32.5l3.8 3.8 7.5-8.5" />
    </Frame>
  );
}

/* Embed — rounded box with `{ }` braces around an accent block, sparkle on the corner */
const EMBED_BOX = 'M12 8h34c4.5 0 8 3.5 8 8v34c0 4.5-3.5 8-8 8H12c-4.5 0-8-3.5-8-8V16c0-4.5 3.5-8 8-8z';
const BRACE_L = 'M21 19c-5 0-7 2-7 6v4c0 2.5-1.5 4.5-4 4.5 2.5 0 4 2 4 4.5v4c0 4 2 6 7 6';
const BRACE_R = 'M37 19c5 0 7 2 7 6v4c0 2.5 1.5 4.5 4 4.5-2.5 0-4 2-4 4.5v4c0 4-2 6-7 6';

export function EmbedIcon({className}: IconProps): React.ReactElement {
  return (
    <Frame className={className}>
      <g className={s.sh} transform="translate(3 3)">
        <path d={EMBED_BOX} />
      </g>
      <path className={s.wh} d={EMBED_BOX} />
      <path className={clsx(s.ln, s.bold)} d={BRACE_L} />
      <path className={clsx(s.ln, s.bold)} d={BRACE_R} />
      <rect className={s.ac} x="25.5" y="29.5" width="7" height="7" rx="2" />
      <g transform="translate(51 0) scale(0.45)">
        <path className={clsx(s.gd, s.thin)} d={STAR4} />
      </g>
    </Frame>
  );
}

const ICONS: Record<DeployIconName, (p: IconProps) => React.ReactElement> = {
  terminal: TerminalIcon,
  pods: PodsIcon,
  pipeline: PipelineIcon,
  embed: EmbedIcon,
};

export default function DeployIcon({name, className}: IconProps & {name: DeployIconName}): React.ReactElement {
  const Icon = ICONS[name];
  return <Icon className={className} />;
}
