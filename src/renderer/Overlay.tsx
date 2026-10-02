import React, { useEffect, useRef, useState } from 'react';
import './overlay.css';
import { formatElapsed } from './format';
import type { OverlayPhase, OverlayState } from '../preload';

// Odd count so there's a center bar; low (voice) frequencies sit in the middle, mirrored outward
const BAR_COUNT = 13;
const CENTER = (BAR_COUNT - 1) / 2;
const MIN_SCALE = 0.14;

// Smoothing: rise quickly with the voice, fall slowly so bars don't flicker
const ATTACK = 0.45;
const RELEASE = 0.12;

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
  const targets = useRef(new Float32Array(BAR_COUNT));
  const levels = useRef(new Float32Array(BAR_COUNT));
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);

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
      const waveform: number[] | undefined = data?.waveform;
      if (!waveform) return;
      for (let i = 0; i < BAR_COUNT; i++) {
        // Skip bin 0 (DC); spread the next bands from the center outward
        const band = Math.min(waveform.length - 1, Math.round(Math.abs(i - CENTER)) + 1);
        const value = waveform[band] || 0;
        targets.current[i] = Math.min(1, Math.pow(value, 1.3) * 1.25);
      }
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

  // Bar animation, written straight to the DOM each frame (no React re-render per frame)
  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const phase = phaseRef.current;

      for (let i = 0; i < BAR_COUNT; i++) {
        let target = targets.current[i];
        if (phase === 'connecting') {
          // A soft wave travelling across the bars while we connect
          target = reduceMotion ? 0.2 : 0.18 + 0.22 * Math.max(0, Math.sin(t * 6 - i * 0.55));
        } else if (phase !== 'listening') {
          target = 0;
        } else if (target < 0.05 && !reduceMotion) {
          // Silence: a gentle breathing motion so the pill reads as "alive"
          target = 0.05 + 0.035 * (1 + Math.sin(t * 2.4 - Math.abs(i - CENTER) * 0.6));
        }

        const current = levels.current[i];
        const next = current + (target - current) * (target > current ? ATTACK : RELEASE);
        levels.current[i] = next;

        const bar = barRefs.current[i];
        if (bar) {
          const scale = MIN_SCALE + (1 - MIN_SCALE) * Math.min(1, next);
          bar.style.transform = `scaleY(${scale.toFixed(3)})`;
        }
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
          'pill',
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
        <span className="pill-indicator" aria-hidden="true">
          {phase === 'finishing' ? <span className="pill-spinner" /> : <span className="pill-dot" />}
        </span>

        <span className="pill-bars" aria-hidden="true">
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <span key={i} className="pill-bar" ref={(el) => { barRefs.current[i] = el; }} />
          ))}
        </span>

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
                <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2.2" /></svg>
              </button>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
