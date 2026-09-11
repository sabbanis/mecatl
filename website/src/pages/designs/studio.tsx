import React, {useCallback, useEffect, useRef, useState} from 'react';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import styles from './studio.module.css';
import {Sparkles, Squiggle, Starburst, StarGlyph, Sticker, Wave, WobblyArrow} from '@site/src/components/designs/studio/Doodles';
import FeatureIcon, {type FeatureIconName} from '@site/src/components/designs/studio/FeatureIcons';
import DeployIcon, {type DeployIconName} from '@site/src/components/designs/studio/DeployIcons';
import Mascot from '@site/src/components/designs/studio/Mascot';
import {RingStamp} from '@site/src/components/designs/studio/Doodles';
import useLoopActive from '@site/src/components/designs/studio/useLoopActive';
import {burst} from '@site/src/components/designs/studio/confetti';

/* ─── constants ────────────────────────────────────────────────────────────── */

const RELEASE = 'v0.0.33';
const INSTALL_CMD = 'brew install stacklok/tap/mecatl';
const MOCK_CMD = 'mecatui --mock';
const RELEASES_URL = 'https://github.com/stacklok/mecatl/releases/latest';
const GITHUB_URL = 'https://github.com/stacklok/mecatl';
const DISCORD_URL = 'https://discord.gg/stacklok';
const TOOLHIVE_URL = 'https://github.com/stacklok/toolhive';
const STACKLOK_URL = 'https://stacklok.com';
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=JetBrains+Mono:wght@500;700&display=swap';

/** Dark line-art mark — the brand sits on the white sheet (nav) and the mist footer; the page has no dark surfaces. */
const LOGO = '/img/logo-line-dark.svg';

/** Base width of the nav indicator pill; it is scaled to the hovered item. */
const IND_BASE = 80;

const NAV = [
  {label: 'Docs', to: '/docs'},
  {label: 'mecatui', to: '/docs/mecatui'},
  {label: 'Building', to: '/docs/building'},
  {label: 'GitHub', to: GITHUB_URL},
  {label: 'Discord', to: DISCORD_URL},
];

/** Short factual phrases for the coral band's ticker — none of these repeat a sticker or label elsewhere on the page. */
type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/* ─── scroll reveal ────────────────────────────────────────────────────────── */

/**
 * Marks an element once it scrolls into view. SSR-safe: nothing touches the
 * DOM outside useEffect, and content is visible by default — the page root only
 * opts into hiding once JS has mounted (see `.js` in the stylesheet).
 */
function useInView<T extends HTMLElement>(): {ref: React.RefObject<T | null>; inView: boolean} {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        // Reveal when in view — or when already scrolled past (e.g. a reload
        // that restores a mid-page scroll position), so nothing stays hidden.
        if (entries.some((e) => e.isIntersecting || e.boundingClientRect.bottom < 0)) {
          setInView(true);
          io.disconnect();
        }
      },
      {threshold: 0.1, rootMargin: '0px 0px -8% 0px'},
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return {ref, inView};
}

type RevealProps = {
  as?: 'div' | 'section' | 'header' | 'footer';
  /** `block` slides the element itself; `group` staggers its `.cell` children; `none` only flags in-view (for doodles). */
  mode?: 'block' | 'group' | 'none';
  className?: string;
  id?: string;
  children?: React.ReactNode;
};

/** Also sets the global `mec-in` hook that the doodle components key their draw-in / pop-in off. */
function Reveal({as = 'div', mode = 'block', className, id, children}: RevealProps): React.ReactElement {
  const {ref, inView} = useInView<HTMLElement>();
  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      id={id}
      className={clsx(mode === 'group' && styles.grp, mode === 'block' && styles.rv, inView && styles.in, inView && 'mec-in', className)}
    >
      {children}
    </Tag>
  );
}

/** Grid child: owns the entrance stagger (`--i`), the resting tilt (`--tilt`) and the springy straighten on hover. */
function Cell({i, tilt, className, children}: {i: number; tilt?: number; className?: string; children: React.ReactNode}): React.ReactElement {
  const vars: CSSVars = {'--i': i};
  if (tilt !== undefined) vars['--tilt'] = `${tilt}deg`;
  return (
    <div className={clsx(styles.cell, className)} style={vars}>
      {children}
    </div>
  );
}

/* ─── command bars + the two-step install stack ────────────────────────────── */

type CommandBarProps = {
  /** The exact text the Copy button puts on the clipboard. */
  cmd: string;
  /** Accessible name of the Copy button while idle. */
  copyLabel: string;
  /** On the teal closing band: paper fill, ink shadow. */
  onBand?: boolean;
  /**
   * The step to do now: full width, 74px, solid outline, hard shadow, filled Copy.
   * `false` is the "next" step — narrower, 56px, dashed, ghost Copy. The two
   * roles swap (animated) once step one has been copied.
   */
  primary?: boolean;
  /** Fires after a successful copy, once the "Copied" feedback has started. */
  onCopied?: () => void;
  /** Stickers / numeral badges pinned to the bar's corners. */
  children?: React.ReactNode;
};

/** One command with its own Copy button: "Copied ★" + a confetti burst, then back to "Copy" after 1.5s. */
function CommandBar({cmd, copyLabel, onBand = false, primary = true, onCopied, children}: CommandBarProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = useCallback(() => {
    const done = () => {
      setCopied(true);
      if (wrapRef.current) burst(wrapRef.current);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
      if (onCopied) onCopied();
    };
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = cmd;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) done();
      } catch {
        /* clipboard unavailable — leave the command selectable */
      }
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmd).then(done, fallback);
    } else {
      fallback();
    }
  }, [cmd, onCopied]);

  return (
    <div className={clsx(styles.bar, onBand && styles.barOnBand, !primary && styles.barSecondary)}>
      {children}
      <code className={styles.barCmd}>
        <span className={styles.prompt} aria-hidden="true">
          $
        </span>
        {cmd}
      </code>
      <span ref={wrapRef} className={styles.barBtnWrap}>
        <button
          type="button"
          className={clsx(styles.barBtn, copied && styles.barBtnDone)}
          onClick={onCopy}
          aria-label={copied ? 'Copied to clipboard' : copyLabel}
        >
          {copied ? (
            <>
              Copied
              <StarGlyph className={styles.copiedStar} />
            </>
          ) : (
            'Copy'
          )}
        </button>
      </span>
    </div>
  );
}

const STEPS: {label: string; cmd: string; copyLabel: string}[] = [
  {label: 'Install', cmd: INSTALL_CMD, copyLabel: 'Copy install command'},
  {label: 'Try it — no API key needed', cmd: MOCK_CMD, copyLabel: 'Copy try-it command'},
];

/** Beat between "Copied ★" appearing on step one and the two steps swapping roles. */
const SWAP_DELAY_MS = 320;

/** Hand-drawn tick that appears beside step one's label once its command has been copied. */
function DoneCheck({className}: {className?: string}): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path pathLength={1} d="M4 12.5l5.5 5.5L20.5 6.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type InstallStepsProps = {
  onBand?: boolean;
  sticker?: boolean;
  /** Fires once, when the steps swap roles after step one is copied (the hero re-aims its arrow). */
  onAdvance?: () => void;
};

/**
 * Numbered two-step stack: 1 install, 2 try it. The `<ol>` carries the order for
 * assistive tech; the wonky "1" / "2" badges pinned to the bars are decorative.
 *
 * Step one starts as the primary bar and step two sits beneath it as a smaller
 * "next" bar. Copying step one swaps the roles for the rest of the visit (per
 * instance): step one shrinks and gets a tick, step two grows into the primary.
 * Copying step two never swaps back. SSR renders the default state.
 */
function InstallSteps({onBand = false, sticker = false, onAdvance}: InstallStepsProps): React.ReactElement {
  const [advanced, setAdvanced] = useState(false);
  const [announce, setAnnounce] = useState('');
  const fired = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onStepOneCopied = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    timer.current = setTimeout(() => {
      setAdvanced(true);
      setAnnounce(`Step 1 copied. Next: ${MOCK_CMD}`);
      if (onAdvance) onAdvance();
    }, SWAP_DELAY_MS);
  }, [onAdvance]);

  return (
    <>
      <ol className={clsx(styles.steps, advanced && styles.stepsAdvanced)} role="list">
        {STEPS.map((s, i) => {
          const primary = advanced ? i === 1 : i === 0;
          const done = advanced && i === 0;
          return (
            <li key={s.cmd} className={clsx(styles.step, !primary && styles.stepSecondary)}>
              <span className={styles.stepLabel}>
                {s.label}
                {done && (
                  <>
                    <DoneCheck className={styles.stepCheck} />
                    <span className={styles.srOnly}> (copied)</span>
                  </>
                )}
              </span>
              <CommandBar cmd={s.cmd} copyLabel={s.copyLabel} onBand={onBand} primary={primary} onCopied={i === 0 ? onStepOneCopied : undefined}>
                <span className={clsx(styles.stepNum, i === 1 && styles.stepNum2)} aria-hidden="true">
                  {i + 1}
                </span>
                {sticker && i === 0 && (
                  <Sticker tone="gold" rotate={6} lower className={clsx(styles.barSticker, done && styles.barStickerOff)}>
                    yes, really one line
                  </Sticker>
                )}
              </CommandBar>
            </li>
          );
        })}
      </ol>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announce}
      </span>
    </>
  );
}

/* ─── navigation ───────────────────────────────────────────────────────────── */

function Nav(): React.ReactElement {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [pos, setPos] = useState<{x: number; w: number}>({x: 4, w: IND_BASE});
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  // Handlers live on the <li>, not the Link: Docusaurus' Link overrides
  // onMouseEnter on internal links (route prefetch). Focus bubbles up to the li.
  const show = useCallback((e: React.SyntheticEvent<HTMLLIElement>) => {
    const li = e.currentTarget;
    setPos({x: li.offsetLeft, w: li.offsetWidth});
    setVisible(true);
  }, []);
  const hide = useCallback(() => setVisible(false), []);
  const onListBlur = useCallback((e: React.FocusEvent<HTMLUListElement>) => {
    if (!listRef.current || !listRef.current.contains(e.relatedTarget as Node | null)) setVisible(false);
  }, []);

  return (
    <header className={styles.nav}>
      <Link to="/" className={styles.brand} aria-label="Mecatl home">
        <img src={LOGO} alt="" width={28} height={28} />
        <span>Mecatl</span>
      </Link>

      <nav className={styles.navCenter} aria-label="Primary">
        <ul
          id="studio-nav-list"
          ref={listRef}
          className={clsx(styles.pill, open && styles.pillOpen)}
          onMouseLeave={hide}
          onBlur={onListBlur}
        >
          <span
            aria-hidden="true"
            className={styles.ind}
            style={{
              transform: `translateX(${pos.x}px) scaleX(${pos.w / IND_BASE})`,
              opacity: visible ? 1 : 0,
            }}
          />
          {NAV.map((item) => (
            <li key={item.label} onMouseEnter={show} onFocus={show}>
              <Link to={item.to} className={styles.pillLink}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.navRight}>
        <a href="#install" className={styles.navCta}>
          Install
        </a>
        <button
          type="button"
          className={styles.menuBtn}
          aria-expanded={open}
          aria-controls="studio-nav-list"
          onClick={() => setOpen((o) => !o)}
        >
          <span className={styles.srOnly}>{open ? 'Close menu' : 'Open menu'}</span>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            {open ? (
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}

/* ─── eyebrow tag ──────────────────────────────────────────────────────────── */

type Tone = 'teal' | 'coral' | 'tangerine' | 'ink';

const TONE_CLASS: Record<Tone, string> = {
  teal: styles.tagTeal,
  coral: styles.tagCoral,
  tangerine: styles.tagTangerine,
  ink: styles.tagInk,
};

/** Chunky rotated section label — each chapter of the page carries its own hue. */
function Tag({tone, children}: {tone: Tone; children: React.ReactNode}): React.ReactElement {
  return <span className={clsx(styles.tag, TONE_CLASS[tone])}>{children}</span>;
}

/* ─── glyphs ───────────────────────────────────────────────────────────────── */

function ArrowChip(): React.ReactElement {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M3 8h9M8.5 3.5L13 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/* ─── hero ─────────────────────────────────────────────────────────────────── */

function CtaLinks({withDocs = false}: {withDocs?: boolean}): React.ReactElement {
  return (
    <p className={styles.ctaLinks}>
      <Link to={RELEASES_URL}>Download {RELEASE}</Link>
      <span aria-hidden="true">·</span>
      <Link to="/docs/install">Install guide</Link>
      {withDocs && (
        <>
          <span aria-hidden="true">·</span>
          <Link to="/docs">Explore the docs</Link>
        </>
      )}
    </p>
  );
}

/** The headline, word by word: each word sits a touch off its baseline; three get special treatment. */
const H1_WORDS: {t: string; r: number; kind?: 'outline' | 'hi' | 'squig'}[] = [
  {t: 'The', r: -1.5},
  {t: 'open', r: 1.2, kind: 'outline'},
  {t: 'cloud-native', r: -1.8, kind: 'hi'},
  {t: 'harness', r: 1},
  {t: 'for', r: -1.2},
  {t: 'developers', r: 0.8},
  {t: 'who', r: -1},
  {t: 'are', r: 1.4},
  {t: 'building', r: -0.8},
  {t: 'platforms', r: 1.2, kind: 'squig'},
];

/** One soft tint per bento tile, each with a matching saturated icon accent (`--dot`, see the stylesheet). */
const TINTS = [styles.tTealTint, styles.tCoralTint, styles.tTangerineTint, styles.tGoldTint, styles.tCharcoalTint, styles.tMist];

/** Resting tilt per bento tile, degrees. */
const TILTS = [-1.4, 2, -2.4, 1.6, -1.8, 2.2];

/** Sticker icon per bento tile — see FeatureIcons. */
const ICONS: FeatureIconName[] = ['loop', 'port', 'cloud', 'code', 'lens', 'badge'];

/** The six key capabilities — the hero bento. Index 0 and 5 span two columns. */
const CAPABILITIES: {title: string; body: React.ReactNode}[] = [
  {title: 'Complete agent loop', body: 'Multi-turn reasoning, tool dispatch, compaction, permission gating, and event streaming are built in.'},
  {title: 'Port model', body: 'Modular design. Swap LLM backends, persistence, distributed locks, or permission logic without touching the engine. Reference adapters included for every port.'},
  {title: 'Cloud-native by design', body: <>Disposable process, externalized state, durable event record. <code>mecak8s</code> pre-wires Redis and Kubernetes leases so you can scale stateless pods from day one.</>},
  {title: 'Importable engine', body: <><code>github.com/<wbr />stacklok/<wbr />mecatl/engine</code> is its own Go module with a tiny dependency closure. Embed the loop directly, no server required.</>},
  {title: 'Full observability', body: 'OpenTelemetry traces, LLM resilience decorator, slow-turn ring buffer, and an MCP-accessible perf server.'},
  {title: 'Identity at the core', body: 'Every agent acts under a verifiable identity. Mecatl stamps identity at every agent action, not just at the login gate.'},
];

function Hero(): React.ReactElement {
  /** Set once the hero's steps have swapped roles — the wobbly arrow drops to point at step two. */
  const [next, setNext] = useState(false);
  const onAdvance = useCallback(() => setNext(true), []);

  return (
    <Reveal as="section" mode="none" className={clsx(styles.hero, styles.wrap)}>
      <div className={styles.heroText}>
        <h1 className={styles.h1} style={{'--k': 0} as CSSVars}>
          {H1_WORDS.map((w, i) => (
            <React.Fragment key={w.t}>
              {i > 0 && ' '}
              <span
                className={clsx(
                  styles.w,
                  w.kind === 'outline' && styles.wOutline,
                  w.kind === 'hi' && clsx(styles.wHi, styles.nowrap),
                  w.kind === 'squig' && styles.wSquig,
                )}
                style={{'--r': `${w.r}deg`, '--i': i} as CSSVars}
              >
                {w.t}
                {w.kind === 'hi' && <Sparkles className={styles.sparkles} />}
                {w.kind === 'squig' && <Squiggle className={styles.squiggle} delay="1.15s" />}
              </span>
            </React.Fragment>
          ))}
        </h1>
        <p className={styles.sub} style={{'--k': 1} as CSSVars}>
          We blew up the harness and then put it back together: more secure, more scalable, more extensible.
        </p>
        <div className={styles.ctaRow} style={{'--k': 2} as CSSVars}>
          <InstallSteps onAdvance={onAdvance} />
          <CtaLinks />
          <span className={clsx(styles.arrowWrap, next && styles.arrowWrapNext)} aria-hidden="true">
            <span className={styles.arrowLabel}>{next ? 'now this one!' : 'this one!'}</span>
            <WobblyArrow className={styles.arrowSvg} delay="1.35s" />
          </span>
        </div>
      </div>

      <header className={styles.gridHead}>
        <Tag tone="teal">Key features</Tag>
        <h2 className={styles.h2}>What you don’t have to build</h2>
        <p className={styles.lede}>Mecatl gives you the hard parts. Use what you need.</p>
      </header>

      <div className={styles.heroGrid}>
        {CAPABILITIES.map((c, i) => {
          const wide = i === 0 || i === CAPABILITIES.length - 1;
          return (
            <Cell key={c.title} i={i} tilt={TILTS[i]} className={clsx(wide && styles.cWide2)}>
              <article className={clsx(styles.tile, TINTS[i], styles.tileCap, i === 2 && styles.tTorn)}>
                <FeatureIcon name={ICONS[i]} className={styles.ico} />
                <div className={styles.tileFoot}>
                  <h3 className={styles.h3}>{c.title}</h3>
                  <p className={styles.tileBody}>{c.body}</p>
                </div>
              </article>
              {i === 2 && (
                <Sticker tone="teal" rotate={-7} className={clsx(styles.stk, styles.stkTL)}>
                  Runs on Kubernetes
                </Sticker>
              )}
              {i === 3 && (
                <Sticker tone="paper" rotate={5} className={clsx(styles.stk, styles.stkBR)}>
                  Apache-2.0
                </Sticker>
              )}
            </Cell>
          );
        })}
      </div>
    </Reveal>
  );
}

/* ─── statement + mascot ───────────────────────────────────────────────────── */

/** The teal circle behind Mecatito (above the tile, below the pup), with the "MEH-KAH-TL" ring text on its edge. */
function TealBleed(): React.ReactElement {
  const {ref, active} = useLoopActive<HTMLSpanElement>();
  return (
    <span ref={ref} className={clsx(styles.bleed, styles.bleedTeal)} aria-hidden="true">
      <RingStamp className={styles.bleedRing} run={active} text="MEH-KAH-TL · " />
    </span>
  );
}

function Intro(): React.ReactElement {
  return (
    <section className={clsx(styles.band, styles.bandTealTint)}>
      <Wave variant="wave" />
      <Reveal mode="group" className={clsx(styles.wrap, styles.grid2)}>
        <Cell i={0} className={styles.cellStatic}>
          <div className={styles.plain}>
            <Tag tone="teal">Why Mecatl</Tag>
            <p className={styles.statement}>
              Built from the ground up to run in the cloud. <span className={styles.accent}>Get your harness off your laptop</span> and run fleets of agents anywhere.
            </p>
          </div>
        </Cell>
        <Cell i={1} tilt={1.5}>
          <Mascot src="/img/mecatito-cutout.png" className={clsx(styles.tile, styles.tTeal, styles.tileImg)}>
            <TealBleed />
            <figcaption className={styles.imgCaption}>
              <span className={styles.eyebrow}>Meet Mecatito</span>
              <p className={styles.imgLine}>Mecatl (MEH-kah-tl) is hard to say, but easy to use.</p>
            </figcaption>
          </Mascot>
        </Cell>
      </Reveal>
    </section>
  );
}

/* ─── outcomes ─────────────────────────────────────────────────────────────── */

const OUTCOMES = [
  {title: 'Get your harness off the desktop', body: 'Start locally, then deploy a fleet of agents on Kubernetes with your choice of cloud and model provider.'},
  {title: 'Separate the agent loop from the sandbox', body: 'Separate control from execution to keep bad code outside your trust boundary.'},
  {title: 'Pick and choose what you need', body: 'Use Mecatl’s library of components to assemble a custom harness.'},
  {title: 'Control what your agents can do', body: 'Set permissions and choose which tool calls require your approval.'},
];

function Outcomes(): React.ReactElement {
  return (
    <section className={clsx(styles.band, styles.bandCoral)}>
      <Wave variant="wave" />
      <div className={styles.wrap}>
        <Reveal as="header" className={styles.sectionHead}>
          <Tag tone="coral">Outcomes</Tag>
          <h2 className={styles.h2}>What can you do with Mecatl?</h2>
        </Reveal>
        <Reveal mode="group" className={styles.grid2}>
          {OUTCOMES.map((o, i) => (
            <Cell key={o.title} i={i}>
              <article className={styles.oCard}>
                <span className={styles.bigNum} aria-hidden="true">
                  0{i + 1}
                </span>
                <div className={styles.tileFoot}>
                  <h3 className={styles.h3}>{o.title}</h3>
                  <p className={styles.tileBody}>{o.body}</p>
                </div>
              </article>
            </Cell>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ─── deployment ───────────────────────────────────────────────────────────── */

/** Each tile carries a sticker icon (see DeployIcons) above its title. */
const DEPLOY: {label: string; desc: React.ReactNode; to: string; icon: DeployIconName}[] = [
  {label: 'Local or remote', desc: <>Run locally with <code>mecatui</code>, or connect to <code>mecated</code> over gRPC or HTTP/SSE.</>, to: '/docs/mecatui', icon: 'terminal'},
  {label: 'Cloud-native', desc: <><code>mecak8s</code>: stateless pods, Redis-backed state, and multi-replica coordination.</>, to: '/docs/building/deployment/mecak8s', icon: 'pods'},
  {label: 'CI', desc: <>Use <code>mecatequi</code> to turn one prompt into a patch and a pass/fail result for your pipeline.</>, to: '/docs/building/deployment/mecatequi', icon: 'pipeline'},
  {label: 'Embed', desc: 'Import the engine directly into your Go project.', to: '/docs/building/deployment/embed-engine', icon: 'embed'},
];

function Deployment(): React.ReactElement {
  return (
    <section className={clsx(styles.band, styles.bandGold)}>
      <Wave variant="zig" />
      <div className={styles.wrap}>
        <Reveal as="header" className={styles.sectionHead}>
          <Tag tone="teal">Deployment</Tag>
          <h2 className={styles.h2}>Four deployment options to get you started</h2>
        </Reveal>
        <Reveal mode="group" className={styles.grid4}>
          {DEPLOY.map((d, i) => (
            <Cell key={d.label} i={i}>
              <Link to={d.to} className={clsx(styles.tile, styles.tPaper, styles.tileLink, styles.tileDeploy)}>
                <span className={styles.deployTop}>
                  <DeployIcon name={d.icon} className={styles.deployIco} />
                  <h3 className={styles.h3}>{d.label}</h3>
                  <span className={styles.tileBody}>{d.desc}</span>
                </span>
                <ArrowChip />
              </Link>
              {i === 0 && (
                <Sticker tone="teal" rotate={4} lower className={clsx(styles.stk, styles.stkTR)}>
                  your laptop → their cluster
                </Sticker>
              )}
            </Cell>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ─── stacklok ─────────────────────────────────────────────────────────────── */

function Stacklok(): React.ReactElement {
  return (
    <section className={clsx(styles.band, styles.bandTangerine)}>
      <Wave variant="wave" />
      <span className={clsx(styles.bleed, styles.bleedTangerine)} aria-hidden="true" />
      <Reveal mode="group" className={clsx(styles.wrap, styles.grid2, styles.gridStacklok)}>
        <Cell i={0} className={styles.cellStatic}>
          <div className={styles.plain}>
            <Tag tone="tangerine">Stacklok</Tag>
            <h2 className={styles.quote}>
              Mecatl is part of Stacklok’s commitment to building a more open alternative to vertically integrated agent stacks.
            </h2>
          </div>
        </Cell>
        <Cell i={1}>
          <article className={clsx(styles.tile, styles.tPaper, styles.tileFeature)}>
            <span className={styles.eyebrow}>Featured project</span>
            <span className={styles.logoDisc}>
              <img src="/img/toolhive-logo.svg" alt="" width={24} height={24} />
            </span>
            <div className={styles.tileFoot}>
              <h3 className={styles.h3}>ToolHive</h3>
              <p className={styles.tileBody}>The open source MCP platform trusted by enterprises, securing 10M tool calls each month.</p>
              <Link to={TOOLHIVE_URL} className={styles.btn}>
                View on GitHub
              </Link>
            </div>
          </article>
          <Starburst rotate={-10} className={styles.burstTH}>
            Open source!
          </Starburst>
        </Cell>
      </Reveal>
    </section>
  );
}

/* ─── closing cta ──────────────────────────────────────────────────────────── */

function Closing(): React.ReactElement {
  return (
    <section className={clsx(styles.band, styles.bandTeal, styles.bandClosing)} id="install">
      <Reveal className={clsx(styles.wrap, styles.closing)}>
        <Tag tone="ink">Install</Tag>
        <h2 className={styles.closingTitle}>Go on. Paste it.</h2>
        <p className={styles.closingLede}>One line to install. Anywhere to run.</p>
        <InstallSteps onBand sticker />
        <CtaLinks withDocs />
      </Reveal>
    </section>
  );
}

/* ─── footer ───────────────────────────────────────────────────────────────── */

const FOOTER = [
  {title: 'Get started', links: [{label: 'Install', to: '/docs/install'}, {label: 'Use mecatui', to: '/docs/mecatui'}, {label: 'Getting started', to: '/docs/building/getting-started/demo'}]},
  {title: 'Build', links: [{label: 'Build on Mecatl', to: '/docs/building'}, {label: 'Extension points', to: '/docs/building/extension-points'}, {label: 'Deployment', to: '/docs/building/deployment'}]},
  {title: 'More', links: [{label: 'GitHub', to: GITHUB_URL}, {label: 'Discord', to: DISCORD_URL}, {label: 'Stacklok', to: STACKLOK_URL}]},
];

function Footer(): React.ReactElement {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Link to="/" className={styles.brand} aria-label="Mecatl home">
            <img src={LOGO} alt="" width={24} height={24} />
            <span>Mecatl</span>
          </Link>
          <p className={styles.footerNote}>The open cloud-native harness.</p>
        </div>
        {FOOTER.map((g) => (
          <div key={g.title} className={styles.footerGroup}>
            <p className={styles.footerTitle}>{g.title}</p>
            <ul>
              {g.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className={styles.copyright}>Copyright © 2026 Stacklok, Inc.</p>
      </div>
    </footer>
  );
}

/* ─── page ─────────────────────────────────────────────────────────────────── */

export default function Studio(): React.ReactElement {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add('mec-studio');
    return () => document.documentElement.classList.remove('mec-studio');
  }, []);

  return (
    <>
      <Head>
        <title>Mecatl — The open cloud-native harness</title>
        <meta name="description" content="The open cloud-native harness for developers who are building platforms." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONT_URL} rel="stylesheet" />
      </Head>
      <div className={clsx(styles.page, mounted && styles.js, mounted && 'mec-js')}>
        <div className={styles.sheet}>
          <span className={clsx(styles.blob, styles.blobTeal)} aria-hidden="true" />
          <span className={clsx(styles.blob, styles.blobGold)} aria-hidden="true" />
          <Nav />
          <main className={styles.main}>
            <Hero />
            <Intro />
            <Outcomes />
            <Deployment />
            <Stacklok />
            <Closing />
          </main>
          <Footer />
        </div>
      </div>
    </>
  );
}
