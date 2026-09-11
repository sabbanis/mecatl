import c from './confetti.module.css';

/** Mecatito's palette: rope teal, ear coral, medallion gold, rope tangerine, body ink. */
const COLORS = ['#3dbdad', '#ee7a63', '#ffcf6b', '#f4a261', '#3b3735'];

/**
 * Scatter a handful of paper pieces from the centre of `host` (which must be
 * `position: relative`). Touches the DOM, so call it from an event handler only.
 * Respects prefers-reduced-motion by doing nothing.
 */
export function burst(host: HTMLElement, count = 22): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layer = document.createElement('span');
  layer.className = c.layer;
  layer.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = i % 3 === 0 ? `${c.piece} ${c.round}` : c.piece;
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 70 + Math.random() * 120;
    p.style.setProperty('--dx', `${Math.round(Math.cos(angle) * dist)}px`);
    p.style.setProperty('--dy', `${Math.round(Math.sin(angle) * dist * 0.7 - 70)}px`);
    p.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 720)}deg`);
    p.style.setProperty('--c', COLORS[i % COLORS.length]);
    p.style.animationDelay = `${Math.round(Math.random() * 90)}ms`;
    layer.appendChild(p);
  }

  host.appendChild(layer);
  window.setTimeout(() => layer.remove(), 1400);
}
