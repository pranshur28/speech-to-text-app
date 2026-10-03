import React, { useEffect, useRef, useState } from 'react';
import './overlay.css';
import { formatElapsed } from './format';
import type { OverlayPhase, OverlayState } from '../preload';

// Sphere canvas size in CSS pixels; larger than the pill so scattered dots and their glow are never clipped
const SPHERE_SIZE = 44;
// How much of the canvas the pill's layout reserves (the rest overflows invisibly)
const SPHERE_FOOTPRINT = 22;
// Sphere radius when silent (a tight ball) and at full voice
const RADIUS_MIN = 1;
const RADIUS_MAX = 10;
const PIXEL_COUNT = 90;

// Smoothing: swell quickly with the voice, contract slowly back into a ball
const ATTACK = 0.5;
const RELEASE = 0.05;

// Palette, pole to pole (matches the ring in overlay.css)
const PALETTE = ['#5b8cff', '#9f6bff', '#ff5fa8', '#ffa552'];
const PAUSED_COLOR = '#ff9f0a';
// Soft glow around each dot, in CSS pixels
const DOT_GLOW = 3;

/** Pixels spread evenly over a unit sphere (Fibonacci lattice), each with a little looseness for scattering. */
function makePixels() {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: PIXEL_COUNT }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / PIXEL_COUNT;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * i;
    return {
      x: Math.cos(theta) * ring,
      y,
      z: Math.sin(theta) * ring,
      looseness: 0.7 + Math.random() * 0.6,
      color: PALETTE[Math.min(PALETTE.length - 1, Math.floor(((y + 1) / 2) * PALETTE.length))],
    };
  });
}

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
      const volume = Math.min(1, Number(data?.volume) || 0);
      // Curve lifts normal speech so the sphere reacts without shouting
      loudness.current = Math.min(1, Math.pow(volume * 2.5, 0.7));
    });

    // Ask for the current state in case it was sent before this page loaded
    window.electronAPI.overlayReady();

    return () => {
      unsubState();
      unsubAudio();
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

  // Pixel sphere, drawn straight to the canvas each frame (no React re-render per frame)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(SPHERE_SIZE * dpr);
    canvas.height = Math.round(SPHERE_SIZE * dpr);
    ctx.scale(dpr, dpr);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const pixels = makePixels();
    const center = SPHERE_SIZE / 2;
    // Tilt the spin axis so the rotation reads as 3D
    const tiltCos = Math.cos(0.45);
    const tiltSin = Math.sin(0.45);
    let level = 0;
    let spin = 0;
    let frame = 0;
    let last = performance.now();
    const start = last;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const phase = phaseRef.current;

      let target = 0;
      let spinSpeed = 0.6;
      let alpha = 1;
      if (phase === 'listening') {
        target = loudness.current;
      } else if (phase === 'connecting') {
        // A gentle pulse while we connect
        target = reduceMotion ? 0.15 : 0.1 + 0.12 * (1 + Math.sin(t * 4));
      } else if (phase === 'paused') {
        target = 0.1;
        spinSpeed = 0.25;
      } else if (phase === 'finishing') {
        spinSpeed = 7;
        alpha = 0.6;
      }
      level += (target - level) * (target > level ? ATTACK : RELEASE);
      if (!reduceMotion) spin += dt * (spinSpeed + level * 3);

      const radius = RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * level;
      const cosY = Math.cos(spin);
      const sinY = Math.sin(spin);

      ctx.clearRect(0, 0, SPHERE_SIZE, SPHERE_SIZE);
      ctx.globalCompositeOperation = 'lighter';

      ctx.shadowBlur = DOT_GLOW * dpr;

      for (const p of pixels) {
        // Louder voice pulls each pixel off the surface by its own amount, scattering the sphere
        const r = radius * (1 + (p.looseness - 1) * level);
        // Spin around Y, then tilt around X
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        const y2 = p.y * tiltCos - z1 * tiltSin;
        const z2 = p.y * tiltSin + z1 * tiltCos;

        // Nearer pixels are bigger and brighter
        const depth = (z2 + 1) / 2;
        const size = 0.9 + depth * 0.7;
        ctx.globalAlpha = alpha * (0.25 + depth * 0.75);
        const color = phase === 'paused' ? PAUSED_COLOR : p.color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.fillRect(center + x1 * r - size / 2, center + y2 * r - size / 2, size, size);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const { phase, holdMode } = state;
  const showControls = !holdMode && (phase === 'listening' || phase === 'paused');
  const timeText = formatElapsed(elapsed);

  // Hovering the pill makes it clickable and reveals the timer and controls
  const handleMouseEnter = () => {
    setExpanded(true);
    window.electronAPI.setOverlayInteractive(true);
  };

  const handleMouseLeave = () => {
    setExpanded(false);
    window.electronAPI.setOverlayInteractive(false);
  };

  return (
    <div className="overlay-root">
      <div
        className={[
          'pill-shell',
          `pill--${phase}`,
          phase !== 'hidden' ? 'is-shown' : '',
          expanded ? 'is-expanded' : '',
          showControls ? 'has-controls' : '',
        ].join(' ')}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="status"
        aria-label={`${PHASE_LABELS[phase]}, ${timeText}`}
      >
        <div className="pill">
          <canvas
            ref={canvasRef}
            className="pill-sphere"
            style={{
              width: SPHERE_SIZE,
              height: SPHERE_SIZE,
              margin: (SPHERE_FOOTPRINT - SPHERE_SIZE) / 2,
            }}
            aria-hidden="true"
          />

          <span className="pill-extra">
            <span className="pill-timer">{phase === 'connecting' ? 'Connecting' : timeText}</span>
            {showControls && (
              <>
                <span className="pill-divider" aria-hidden="true" />
                <button
                  type="button"
                  className="pill-btn"
                  onClick={() => window.electronAPI.overlayAction(phase === 'paused' ? 'resume' : 'pause')}
                  aria-label={phase === 'paused' ? 'Resume' : 'Pause'}
                  title={phase === 'paused' ? 'Resume' : 'Pause'}
                >
                  {phase === 'paused' ? (
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" /></svg>
                  ) : (
                    <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1" /><rect x="9.5" y="2.5" width="3" height="11" rx="1" /></svg>
                  )}
                </button>
                <button
                  type="button"
                  className="pill-btn pill-btn--stop"
                  onClick={() => window.electronAPI.overlayAction('stop')}
                  aria-label="Stop"
                  title="Stop"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2.4" /></svg>
                </button>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
