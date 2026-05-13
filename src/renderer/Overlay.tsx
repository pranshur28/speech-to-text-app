import React, { useEffect, useRef, useState } from 'react';
import './overlay.css';

type OverlayState = 'idle' | 'recording' | 'paused';

export default function Overlay() {
  const [overlayState, setOverlayState] = useState<OverlayState>('idle');
  const [waveform, setWaveform] = useState<number[]>(new Array(12).fill(0));
  const overlayStateRef = useRef<OverlayState>('idle');
  // offsetX/Y: pointer's clientX/clientY at drag start = distance from window top-left to pointer
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  // Keep ref in sync so the stable audio callback always reads current state
  useEffect(() => {
    overlayStateRef.current = overlayState;
  }, [overlayState]);

  useEffect(() => {
    document.body.style.background = 'transparent';

    const unsubscribeState = window.electronAPI.onOverlayState((state: OverlayState) => {
      setOverlayState(state);
    });

    const unsubscribeAudio = window.electronAPI.onAudioData((data: any) => {
      // Only update waveform while actively recording; paused state keeps the
      // last captured bars frozen at their actual heights.
      if (data?.waveform && overlayStateRef.current === 'recording') {
        setWaveform(data.waveform.slice(0, 12));
      }
    });

    return () => {
      unsubscribeState();
      unsubscribeAudio();
    };
  }, []);

  // Resize the BrowserWindow to match the visible pill so transparent margins
  // never exist to intercept clicks. Idle = 48x48; recording/paused = 240x65.
  // setBounds (in the IPC handler) re-centers the window so it doesn't jump.
  useEffect(() => {
    if (overlayState === 'idle') {
      window.electronAPI.resizeOverlayWindow(48, 48);
    } else {
      window.electronAPI.resizeOverlayWindow(240, 65);
    }
  }, [overlayState]);

  // isPaused is derived entirely from overlayState pushed by the main process,
  // so it can never drift when pause/resume is triggered from outside the overlay.
  const isPaused = overlayState === 'paused';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.overlay-btn')) return;

    const pill = e.currentTarget;
    pill.setPointerCapture(e.pointerId);

    // clientX/clientY is the pointer's offset within the BrowserWindow content area,
    // i.e. clientX === screenX - windowLeft. Storing it lets us recompute the
    // window's top-left from screenX on every move without an async IPC round-trip.
    dragOffsetRef.current = {
      offsetX: e.clientX,
      offsetY: e.clientY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffsetRef.current) return;

    // screenX/Y is the pointer's absolute screen position regardless of where
    // the BrowserWindow currently sits, so subtracting the fixed offset gives
    // the correct window top-left even as the window moves during drag.
    const newX = e.screenX - dragOffsetRef.current.offsetX;
    const newY = e.screenY - dragOffsetRef.current.offsetY;

    window.electronAPI.moveOverlayWindow(Math.round(newX), Math.round(newY));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffsetRef.current) return;

    const pill = e.currentTarget;
    pill.releasePointerCapture(e.pointerId);

    const finalX = e.screenX - dragOffsetRef.current.offsetX;
    const finalY = e.screenY - dragOffsetRef.current.offsetY;

    window.electronAPI.saveOverlayPosition(Math.round(finalX), Math.round(finalY));
    dragOffsetRef.current = null;
  };

  const handlePointerCancel = () => {
    dragOffsetRef.current = null;
  };

  const handleStop = () => {
    window.electronAPI.overlayAction('stop');
  };

  // Derive the action from authoritative overlayState, not a local toggle.
  const handlePause = () => {
    window.electronAPI.overlayAction(overlayState === 'paused' ? 'resume' : 'pause');
  };

  if (overlayState === 'idle') {
    return (
      <div className="overlay-container">
        <div
          className="overlay-pill overlay-pill-idle"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div className="idle-indicator">
            {/* Microphone icon */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 16.91c-1.48 1.46-3.51 2.36-5.77 2.36s-4.29-.9-5.77-2.36M19 12h2c0 .46-.08.92-.23 1.36" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Recording/Paused pill render
  return (
    <div className="overlay-container">
      <div
        className="overlay-pill"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="waveform-capsule">
          {waveform.map((value, index) => {
            const centerIndex = waveform.length / 2;
            const distanceFromCenter = Math.abs(index - centerIndex + 0.5);
            const mirrorIndex = index < centerIndex
              ? Math.floor(centerIndex - distanceFromCenter)
              : Math.floor(centerIndex + distanceFromCenter - 1);
            const mirroredValue = waveform[Math.min(mirrorIndex, waveform.length - 1)];

            // Use the actual last-captured value so paused bars freeze in place
            // rather than collapsing. The .paused CSS class desaturates the color.
            const height = 4 + mirroredValue * 22;
            const r = Math.round(mirroredValue > 0.5 ? 255 : mirroredValue * 2 * 255);
            const g = Math.round(mirroredValue < 0.5 ? 200 + mirroredValue * 110 : (1 - mirroredValue) * 2 * 255);
            const color = `rgb(${r}, ${g}, 50)`;

            return (
              <div
                key={index}
                className={`eq-bar ${isPaused ? 'paused' : ''}`}
                style={{
                  height: `${height}px`,
                  backgroundColor: color,
                }}
              />
            );
          })}
        </div>
        <div className="overlay-controls">
          <button
            className={`overlay-btn pause-btn ${isPaused ? 'paused' : ''}`}
            onClick={handlePause}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              // Play icon
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            ) : (
              // Pause icon
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="4" height="18" />
                <rect x="15" y="3" width="4" height="18" />
              </svg>
            )}
          </button>
          <button
            className="overlay-btn stop-btn"
            onClick={handleStop}
            title="Stop Recording"
          >
            {/* Stop icon */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
