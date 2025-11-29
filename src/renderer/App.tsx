import React, { useState, useRef, useEffect } from 'react';
import './styles.css';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Press ⌘+⇧+Space to record');
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    // Listen for global shortcut toggle from main process
    window.electronAPI.onToggleRecording(() => {
      if (isProcessingRef.current) return;

      if (isRecordingRef.current) {
        stopRecording();
      } else {
        startRecording();
      }
    });
  }, []); // Run once on mount

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setStatus('Recording... Press ⌘+⇧+Space to stop');
    } catch (error) {
      setStatus('Mic access denied');
      setTimeout(() => setStatus('Press ⌘+⇧+Space to record'), 3000);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    const mediaRecorder = mediaRecorderRef.current;

    mediaRecorder.onstop = async () => {
      setIsRecording(false);
      setIsProcessing(true);
      setStatus('Transcribing...');

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      const buffer = await audioBlob.arrayBuffer();

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      try {
        // Transcribe
        setStatus('Transcribing...');
        const transcribeResult = await window.electronAPI.transcribeAudio(buffer);

        if (transcribeResult.success) {
          // Format
          setStatus('Formatting...');
          const formatResult = await window.electronAPI.formatText(transcribeResult.transcript);

          if (formatResult.success) {
            // Paste
            setStatus('Pasting...');
            await window.electronAPI.pasteText(formatResult.formatted);
            setStatus('Done! ✓');
          }
        }
      } catch (error) {
        setStatus('Error: ' + (error instanceof Error ? error.message : 'Unknown'));
      } finally {
        setIsProcessing(false);
        setTimeout(() => setStatus('Press ⌘+⇧+Space to record'), 2000);
      }
    };

    mediaRecorder.stop();
  };

  return (
    <div className={`widget ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}>
      <div className="indicator">
        {isRecording && <div className="pulse-ring"></div>}
        <div className={`dot ${isRecording ? 'active' : ''}`}></div>
      </div>
      <div className="status">{status}</div>
    </div>
  );
}
