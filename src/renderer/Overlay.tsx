import React, { useEffect, useRef, useState } from 'react';
import './overlay.css';

type OverlayState = 'idle' | 'recording' | 'paused';

export default function Overlay() {
  const [overlayState, setOverlayState] = useState<OverlayState>('idle');
  const [waveform, setWaveform] = useState<number[]>(new Array(12).fill(0));
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const dragOffsetRef = useRef<{ pointerX: number; pointerY: number; windowX: number; windowY: number } | null>(null);

  // Keep pause ref in sync with state
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    // Make body transparent for overlay window
    document.body.style.background = 'transparent';

    // Listen for overlay state changes
    const unsubscribeState = window.electronAPI.onOverlayState((state: OverlayState) => {
      setOverlayState(state);
      // Reset pause state when transitioning out of recording
      if (state !== 'recording' && state !== 'paused') {
        setIsPaused(false);
      }
    });

    // Listen for audio data from main app
    const unsubscribeAudio = window.electronAPI.onAudioData((data: any) => {
      if (data?.waveform && (overlayState === 'recording' || overlayState === 'paused')) {
        // Take only 12 bars for a smaller display
        const reducedWaveform = data.waveform.slice(0, 12);
        setWaveform(reducedWaveform);
      }
    });

    return () => {
      unsubscribeState();
      unsubscribeAudio();
    };
  }, [overlayState]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only allow dragging from the pill chrome, not from buttons
    if ((e.target as HTMLElement).closest('.overlay-btn')) {
      return;
    }

    const pill = e.currentTarget;
    pill.setPointerCapture(e.pointerId);

    // Store the initial pointer position and window position
    // The window is 240x65, and the pill is centered in it
    // We'll calculate the window position relative to the viewport center
    const windowWidth = 240;
    const windowHeight = 65;

    dragOffsetRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      // Approximate current window position (pill is centered)
      windowX: e.clientX - windowWidth / 2,
      windowY: e.clientY - windowHeight / 2,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffsetRef.current) return;

    // Calculate how much the pointer has moved since drag start
    const deltaX = e.clientX - dragOffsetRef.current.pointerX;
    const deltaY = e.clientY - dragOffsetRef.current.pointerY;

    // Calculate new window position
    const newX = dragOffsetRef.current.windowX + deltaX;
    const newY = dragOffsetRef.current.windowY + deltaY;

    window.electronAPI.moveOverlayWindow(newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffsetRef.current) return;

    const pill = e.currentTarget;
    pill.releasePointerCapture(e.pointerId);

    // Calculate final position and persist
    const deltaX = e.clientX - dragOffsetRef.current.pointerX;
    const deltaY = e.clientY - dragOffsetRef.current.pointerY;
    const finalX = dragOffsetRef.current.windowX + deltaX;
    const finalY = dragOffsetRef.current.windowY + deltaY;

    window.electronAPI.saveOverlayPosition(finalX, finalY);
    dragOffsetRef.current = null;
  };

  const handleStop = () => {
    console.log('[OVERLAY] Stop clicked');
    window.electronAPI.overlayAction('stop');
  };

  const handlePause = () => {
    console.log('[OVERLAY] Pause clicked, current state:', isPaused);
    setIsPaused(!isPaused);
    window.electronAPI.overlayAction(isPaused ? 'resume' : 'pause');
  };

  // Idle pill render
  if (overlayState === 'idle') {
    return (
      <div className="overlay-container">
        <div
          className="overlay-pill overlay-pill-idle"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
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
      >
        <div className="waveform-capsule">
          {waveform.map((value, index) => {
            const centerIndex = waveform.length / 2;
            const distanceFromCenter = Math.abs(index - centerIndex + 0.5);
            const mirrorIndex = index < centerIndex
              ? Math.floor(centerIndex - distanceFromCenter)
              : Math.floor(centerIndex + distanceFromCenter - 1);
            const mirroredValue = waveform[Math.min(mirrorIndex, waveform.length - 1)];

            const height = isPaused ? 4 : 4 + mirroredValue * 22;
            const intensity = isPaused ? 0 : mirroredValue;

            // Green → Yellow → Red based on intensity
            const r = Math.round(intensity > 0.5 ? 255 : intensity * 2 * 255);
            const g = Math.round(intensity < 0.5 ? 200 + intensity * 110 : (1 - intensity) * 2 * 255);
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
