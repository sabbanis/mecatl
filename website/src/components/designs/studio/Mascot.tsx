import React, {useEffect, useState} from 'react';
import clsx from 'clsx';
import s from './Mascot.module.css';
import useLoopActive from './useLoopActive';

/** Short factual lines Mecatito cycles through while on screen. */
const LINES = ['no API key needed', 'your laptop → their cluster', 'hard to say. easy to use.'];

function SpeechBubble({lines, active, className}: {lines: string[]; active: boolean; className?: string}): React.ReactElement {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    const t = window.setInterval(() => setI((n) => (n + 1) % lines.length), 2800);
    return () => window.clearInterval(t);
  }, [active, lines.length]);

  // Re-keying on each line remounts the bubble so its spring pop replays.
  return (
    <p key={i} className={clsx(s.bubble, className)}>
      {lines[i]}
    </p>
  );
}

type MascotProps = {
  src: string;
  className?: string;
  /** The tile's caption (verbatim copy lives in the page). */
  children?: React.ReactNode;
};

/**
 * Mecatito with a role: pokes above his tile, talks in a popping speech bubble
 * and hops on hover. (The "MEH-KAH-TL" ring lives on the teal blob behind the tile.)
 * All loops are gated on visibility + reduced-motion via useLoopActive.
 */
export default function Mascot({src, className, children}: MascotProps): React.ReactElement {
  const {ref, active} = useLoopActive<HTMLElement>();
  return (
    <figure ref={ref} className={clsx(s.stage, className)}>
      {children}
      <div className={s.figure}>
        <img className={s.mascot} src={src} alt="" width={920} height={1176} />
      </div>
      <SpeechBubble lines={LINES} active={active} />
    </figure>
  );
}
