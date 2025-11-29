import React, { useEffect, useState } from 'react';
import './overlay.css';

export default function Overlay() {
    const [waveform, setWaveform] = useState<number[]>(new Array(16).fill(0));

    useEffect(() => {
        // Make body transparent for overlay window
        document.body.style.background = 'transparent';

        // Listen for audio data from main app
        const unsubscribe = window.electronAPI.onAudioData((data: any) => {
            if (data?.waveform) {
                setWaveform(data.waveform);
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return (
        <div className="overlay-container">
            <div className="soundwave-container">
                {waveform.map((value, index) => {
                    // Mirror the bars around center for symmetry
                    const centerIndex = waveform.length / 2;
                    const distanceFromCenter = Math.abs(index - centerIndex + 0.5);
                    const mirrorIndex = index < centerIndex 
                        ? Math.floor(centerIndex - distanceFromCenter)
                        : Math.floor(centerIndex + distanceFromCenter - 1);
                    const mirroredValue = waveform[Math.min(mirrorIndex, waveform.length - 1)];
                    
                    // Minimum height + scaled height based on audio
                    const height = 4 + mirroredValue * 36;
                    const opacity = 0.4 + mirroredValue * 0.6;
                    
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
        </div>
    );
}
