import React, { useEffect, useRef, useState } from 'react';
import './overlay.css';
import { tailText } from './format';

const BAR_COUNT = 12;
// Enough for about two lines in the bubble; older words scroll off the front
const MAX_LIVE_CHARS = 110;

export default function Overlay() {
    const [waveform, setWaveform] = useState<number[]>(new Array(BAR_COUNT).fill(0));
    const [isPaused, setIsPaused] = useState(false);
    const [liveText, setLiveText] = useState('');
    const isPausedRef = useRef(false);
    const finalsRef = useRef('');

    // Keep ref in sync with state
    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
        // Make body transparent for overlay window
        document.body.style.background = 'transparent';

        // Audio levels from the main app
        const unsubAudio = window.electronAPI.onAudioData((data: any) => {
            if (data?.waveform && !isPausedRef.current) {
                setWaveform(data.waveform.slice(0, BAR_COUNT));
            }
        });

        // Live words from Deepgram: confirmed phrases plus the current interim guess
        const unsubTranscript = window.electronAPI.onDeepgramTranscript(({ text, isFinal }) => {
            if (isFinal) {
                finalsRef.current += (finalsRef.current ? ' ' : '') + text;
                setLiveText(finalsRef.current);
            } else {
                setLiveText(finalsRef.current + (finalsRef.current ? ' ' : '') + text);
            }
        });

        // New recording: clear the previous session
        const unsubReset = window.electronAPI.onOverlayReset(() => {
            finalsRef.current = '';
            setLiveText('');
            setIsPaused(false);
            setWaveform(new Array(BAR_COUNT).fill(0));
        });

        return () => {
            unsubAudio();
            unsubTranscript();
            unsubReset();
        };
    }, []);

    // Handle mouse enter/leave for enabling/disabling click-through
    const handleMouseEnterInteractive = () => {
        window.electronAPI.setOverlayInteractive(true);
    };

    const handleMouseLeaveInteractive = () => {
        window.electronAPI.setOverlayInteractive(false);
    };

    const handleStop = () => {
        window.electronAPI.overlayAction('stop');
    };

    const handlePause = () => {
        setIsPaused(!isPaused);
        window.electronAPI.overlayAction(isPaused ? 'resume' : 'pause');
    };

    return (
        <div className="overlay-container">
            <div className={`overlay-text ${liveText ? 'is-visible' : ''}`} aria-live="polite">
                {tailText(liveText, MAX_LIVE_CHARS)}
            </div>
            <div className="overlay-pill">
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
                <div
                    className="overlay-controls"
                    onMouseEnter={handleMouseEnterInteractive}
                    onMouseLeave={handleMouseLeaveInteractive}
                >
                    <button
                        className={`overlay-btn pause-btn ${isPaused ? 'paused' : ''}`}
                        onClick={handlePause}
                        title={isPaused ? 'Resume' : 'Pause'}
                        aria-label={isPaused ? 'Resume' : 'Pause'}
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
                        aria-label="Stop recording"
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
