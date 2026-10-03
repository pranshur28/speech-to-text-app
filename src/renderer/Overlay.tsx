import React, { useEffect, useRef, useState } from 'react';
import './overlay.css';
import { formatElapsed } from './format';
import type { OverlayPhase, OverlayState } from '../preload';

// Canvas size in CSS pixels; larger than the pill so the outer ripples and their glow are never clipped
const RIPPLE_SIZE = 64;
// How much of the canvas the pill's layout reserves (the rest overflows invisibly)
const RIPPLE_FOOTPRINT = 22;
// Radius of the outer ring when silent (everything collapsed into a dot) and at full voice
const RADIUS_MIN = 1.2;
const RADIUS_MAX = 24;

// Loudness range in decibels: silent below DB_FLOOR, full size at DB_CEIL.
// A curve a little above 1 gives normal talking a clear ripple while still leaving room to get louder.
const DB_FLOOR = -45;
const DB_CEIL = -10;
const LOUDNESS_CURVE = 1.2;

// Dots per ring, centre outward; inner rings react first and outer rings follow, like a ripple
const RING_DOTS = [6, 10, 14, 18];
// How quickly each ring catches up with the one inside it (lower = slower ripple)
const RIPPLE_FOLLOW = 0.3;

// Smoothing: burst out quickly with the voice, drift back slowly into a dot
const ATTACK = 0.5;
const RELEASE = 0.04;

// Ring colours, centre outward (matches the app palette)
const PALETTE = ['#5b8cff', '#9f6bff', '#ff5fa8', '#ffa552'];
const PAUSED_COLOR = '#ff9f0a';
// Soft glow around each dot, in CSS pixels
const DOT_GLOW = 3;

/**
 * Dots on loose concentric rings: each sits roughly evenly around its ring, nudged a little in
 * angle and distance so the rings never read as perfect circles.
 */
function makeDots() {
  return RING_DOTS.flatMap((count, ring) => {
    const offset = Math.random() * Math.PI * 2;
    return Array.from({ length: count }, (_, i) => ({
      ring,
      angle: offset + ((i + (Math.random() - 0.5) * 0.6) / count) * Math.PI * 2,
      // Fraction of the outer radius this dot rests at
      distance: ((ring + 1) / RING_DOTS.length) * (0.88 + Math.random() * 0.24),
      // How far this dot breaks away from its ring when loud
      looseness: (Math.random() - 0.5) * 0.3,
      color: PALETTE[ring % PALETTE.length],
    }));
  });
}

// Control cards fan out radially from the dot: each sits FAN_RADIUS px from the dot's centre,
// pointing away from it at its angle (0 = straight up; left, middle, right)
const FAN_ANGLES = [-48, 0, 48];
const FAN_RADIUS = 40;

const PHASE_LABELS: Record<OverlayPhase, string> = {
  hidden: '',
  connecting: 'Connecting',
  listening: 'Recording',
  paused: 'Paused',
  finishing: 'Finishing',
};

export default function Overlay() {
  const [state, setState] = useState<OverlayState>({ phase: 'hidden', holdMode: false });
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const phaseRef = useRef<OverlayPhase>('hidden');
  const loudness = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    phaseRef.current = state.phase;
    if (state.phase === 'hidden') setExpanded(false);
  }, [state.phase]);

  // State and audio levels from the main app
  useEffect(() => {
    document.body.style.background = 'transparent';

    const unsubState = window.electronAPI.onOverlayState((next) => {
      // A new session starts the clock from zero
      if (next.phase === 'connecting' && phaseRef.current !== 'connecting') setElapsed(0);
      phaseRef.current = next.phase;
      setState(next);
    });

    const unsubAudio = window.electronAPI.onAudioData((data: any) => {
      // Older recorders only send the clipped volume (rms * 5)
      const rms = Number(data?.rms ?? (Number(data?.volume) || 0) / 5) || 0;
      const db = 20 * Math.log10(rms + 1e-6);
      const norm = Math.min(1, Math.max(0, (db - DB_FLOOR) / (DB_CEIL - DB_FLOOR)));
      loudness.current = Math.pow(norm, LOUDNESS_CURVE);
    });

    // Main noticed the cursor left (e.g. onto the taskbar) without the page seeing it
    const unsubPointerLeft = window.electronAPI.onOverlayPointerLeft(() => setExpanded(false));

    // Ask for the current state in case it was sent before this page loaded
    window.electronAPI.overlayReady();

    return () => {
      unsubState();
      unsubAudio();
      unsubPointerLeft();
    };
  }, []);

  // Recording clock — only runs while actually listening
  useEffect(() => {
    if (state.phase !== 'listening') return;
    let last = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      setElapsed((value) => value + (now - last));
      last = now;
    }, 250);
    return () => clearInterval(interval);
  }, [state.phase]);

  // Dotted ripples, drawn straight to the canvas each frame (no React re-render per frame)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(RIPPLE_SIZE * dpr);
    canvas.height = Math.round(RIPPLE_SIZE * dpr);
    ctx.scale(dpr, dpr);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dots = makeDots();
    const center = RIPPLE_SIZE / 2;
    const ringLevels = new Float32Array(RING_DOTS.length);
    const ringTurns = new Float32Array(RING_DOTS.length);
    let level = 0;
    let frame = 0;
    let last = performance.now();
    const start = last;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const phase = phaseRef.current;

      let target = 0;
      let alpha = 1;
      let turnSpeed = 0;
      if (phase === 'listening') {
        target = loudness.current;
      } else if (phase === 'connecting') {
        // A gentle repeating ripple while we connect
        target = reduceMotion ? 0.1 : 0.04 + 0.08 * Math.max(0, Math.sin(t * 4));
      } else if (phase === 'paused') {
        target = 0.04;
      } else if (phase === 'finishing') {
        // Rings slowly turn while the last words are processed
        target = 0.15;
        turnSpeed = 1.6;
        alpha = 0.6;
      }
      level += (target - level) * (target > level ? ATTACK : RELEASE);

      // Each ring follows the one inside it, so a burst of sound travels outward
      for (let k = 0; k < ringLevels.length; k++) {
        const source = k === 0 ? level : ringLevels[k - 1];
        ringLevels[k] += (source - ringLevels[k]) * RIPPLE_FOLLOW;
        if (!reduceMotion) ringTurns[k] += dt * turnSpeed * (k % 2 ? -1 : 1);
      }

      ctx.clearRect(0, 0, RIPPLE_SIZE, RIPPLE_SIZE);
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = DOT_GLOW * dpr;

      for (const dot of dots) {
        const ringLevel = ringLevels[dot.ring];
        // A small travelling wobble so the rings ripple rather than just grow
        const wobble = reduceMotion ? 0 : 0.08 * ringLevel * Math.sin(t * 6 - dot.ring * 1.2 + dot.angle * 2);
        const radius = RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * ringLevel;
        const r = radius * dot.distance * (1 + dot.looseness * ringLevel + wobble);
        const angle = dot.angle + ringTurns[dot.ring];

        const size = 1.3;
        ctx.globalAlpha = alpha * (1 - dot.ring * 0.12);
        const color = phase === 'paused' ? PAUSED_COLOR : dot.color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.fillRect(center + Math.cos(angle) * r - size / 2, center + Math.sin(angle) * r - size / 2, size, size);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const { phase, holdMode } = state;
  const showControls = !holdMode && (phase === 'listening' || phase === 'paused');
  const timeText = formatElapsed(elapsed);

  // Hovering the dot makes it clickable and fans the controls out above it
  const handleMouseEnter = () => {
    setExpanded(true);
    window.electronAPI.setOverlayInteractive(true);
  };

  const handleMouseLeave = () => {
    setExpanded(false);
    window.electronAPI.setOverlayInteractive(false);
  };

  const isPaused = phase === 'paused';
  const cards: Array<{ key: string; className?: string; label?: string; onClick?: () => void; content: React.ReactNode }> = [
    {
      key: 'timer',
      className: 'fan-card--timer',
      content: phase === 'connecting' ? '···' : timeText,
    },
  ];
  if (showControls) {
    cards.unshift({
      key: 'pause',
      label: isPaused ? 'Resume' : 'Pause',
      onClick: () => window.electronAPI.overlayAction(isPaused ? 'resume' : 'pause'),
      content: isPaused ? (
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1" /><rect x="9.5" y="2.5" width="3" height="11" rx="1" /></svg>
      ),
    });
    cards.push({
      key: 'stop',
      className: 'fan-card--stop',
      label: 'Stop',
      onClick: () => window.electronAPI.overlayAction('stop'),
      content: <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2.4" /></svg>,
    });
  }
  const angles = cards.length === 1 ? [0] : FAN_ANGLES;

  return (
    <div className="overlay-root">
      <div
        className={[
          'pill-shell',
          `pill--${phase}`,
          phase !== 'hidden' ? 'is-shown' : '',
          expanded ? 'is-expanded' : '',
        ].join(' ')}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="status"
        aria-label={`${PHASE_LABELS[phase]}, ${timeText}`}
      >
        {/* Invisible area over the fan so moving from the dot to a card doesn't close it */}
        <span className="pill-hitbox" aria-hidden="true" />

        <canvas
          ref={canvasRef}
          className="pill-ripple"
          style={{
            width: RIPPLE_SIZE,
            height: RIPPLE_SIZE,
            left: (RIPPLE_FOOTPRINT - RIPPLE_SIZE) / 2,
            top: (RIPPLE_FOOTPRINT - RIPPLE_SIZE) / 2,
          }}
          aria-hidden="true"
        />

        <div className="pill-fan">
          {cards.map((card, i) => {
            const angle = angles[i];
            // Every card starts folded into the dot, then turns to its angle and slides out along it
            const style: React.CSSProperties = {
              transform: expanded
                ? `rotate(${angle}deg) translateY(${-FAN_RADIUS}px)`
                : `rotate(${angle}deg) translateY(0) scale(0.2)`,
              transitionDelay: expanded ? `${i * 35}ms, ${i * 35}ms, 0ms, 0ms` : '0ms',
            };
            // Keep icons and the timer upright however far the card is turned
            const inner = (
              <span className="fan-card-label" style={{ transform: `rotate(${-angle}deg)` }}>
                {card.content}
              </span>
            );
            const className = ['fan-card', card.className].filter(Boolean).join(' ');
            return card.onClick ? (
              <button
                key={card.key}
                type="button"
                className={className}
                style={style}
                tabIndex={expanded ? 0 : -1}
                onClick={card.onClick}
                aria-label={card.label}
                title={card.label}
              >
                {inner}
              </button>
            ) : (
              <div key={card.key} className={className} style={style}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
