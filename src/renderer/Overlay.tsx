import React, { useEffect, useState } from 'react';
import './overlay.css';

export default function Overlay() {
    const [waveform, setWaveform] = useState<number[]>(new Array(12).fill(0));
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        // Make body transparent for overlay window
        document.body.style.background = 'transparent';

        console.log('[OVERLAY] Component mounted, waiting for audio data...');

        // Listen for audio data from main app
        const unsubscribe = window.electronAPI.onAudioData((data: any) => {
            console.log('[OVERLAY] Received audio data:', data);
            if (data?.waveform && !isPaused) {
                // Take only 12 bars for a smaller display
                const reducedWaveform = data.waveform.slice(0, 12);
                setWaveform(reducedWaveform);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [isPaused]);

    // Handle mouse enter/leave for enabling/disabling click-through
    const handleMouseEnterInteractive = () => {
        window.electronAPI.setOverlayInteractive(true);
    };

    const handleMouseLeaveInteractive = () => {
        window.electronAPI.setOverlayInteractive(false);
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

    return (
        <div className="overlay-container">
            <div className="overlay-pill">
                <div className="soundwave-container">
                    {waveform.map((value, index) => {
                        // Mirror the bars around center for symmetry
                        const centerIndex = waveform.length / 2;
                        const distanceFromCenter = Math.abs(index - centerIndex + 0.5);
                        const mirrorIndex = index < centerIndex
                            ? Math.floor(centerIndex - distanceFromCenter)
                            : Math.floor(centerIndex + distanceFromCenter - 1);
                        const mirroredValue = waveform[Math.min(mirrorIndex, waveform.length - 1)];

                        // Minimum height + scaled height based on audio (smaller max height)
                        const height = 3 + (isPaused ? 0 : mirroredValue * 24);
                        const opacity = isPaused ? 0.3 : (0.4 + mirroredValue * 0.6);

                        return (
                            <div
                                key={index}
                                className="soundwave-bar"
                                style={{
                                    height: `${height}px`,
                                    opacity: opacity,
                                }}
                            />
                        );
                    })}
                </div>
                <div
                    className="overlay-controls"
                    onMouseEnter={handleMouseEnterInteractive}
                    onMouseLeave={handleMouseLeaveInteractive}
                >
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
