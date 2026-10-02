import { useEffect, useReducer, useRef, useState } from 'react';
import { initialRecordingState, recordingReducer } from '../recordingState';

// Deepgram recommends ~80ms audio chunks for Flux; works equally well for Nova-3
const AUDIO_TIMESLICE_MS = 80;

interface UseRecorderOptions {
  /** Called after a transcription was saved to the database. */
  onSaved: () => void;
}

// Surface errors even when the main window is hidden in the tray (e.g. using a global shortcut)
function notifyIfHidden(message: string) {
  if (!document.hidden && document.hasFocus()) return;
  try {
    new Notification('Speech to Text', { body: message });
  } catch {
    // Notifications unavailable — the in-app error message still shows
  }
}

function describeStopError(error: any): string {
  const errorMsg = error?.message || 'An error occurred';
  if (errorMsg.includes('401')) return 'Deepgram rejected the API key. Check it in Settings.';
  if (errorMsg.includes('network') || errorMsg.includes('ENOTFOUND')) {
    return 'Network error. Please check your internet connection.';
  }
  return errorMsg;
}

/** Microphone capture + Deepgram streaming session, driven by global shortcuts or the in-app button. */
export function useRecorder({ onSaved }: UseRecorderOptions) {
  const [state, dispatch] = useReducer(recordingReducer, initialRecordingState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);

  // Live transcript from Deepgram while recording
  const [liveTranscript, setLiveTranscript] = useState('');
  const finalsTextRef = useRef('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingStopRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioDataIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Audio chunks are forwarded in order; stop waits for the last one before finalizing
  const sendChainRef = useRef<Promise<void>>(Promise.resolve());

  const resetLater = (ms: number) => setTimeout(() => dispatch({ type: 'RESET' }), ms);

  const fail = (status: string, errorMessage: string) => {
    dispatch({ type: 'ERROR', status, errorMessage });
    notifyIfHidden(errorMessage);
  };

  const clearLiveTranscript = () => {
    setLiveTranscript('');
    finalsTextRef.current = '';
  };

  const releaseMicrophone = () => {
    if (audioDataIntervalRef.current) {
      clearInterval(audioDataIntervalRef.current);
      audioDataIntervalRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startAudioAnalysis = (stream: MediaStream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    sourceRef.current = source;

    const dataArray = new Uint8Array(analyser.fftSize);
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);

    const sendAudioData = () => {
      const { phase } = stateRef.current;
      if (phase !== 'recording' && phase !== 'paused') return;

      analyser.getByteTimeDomainData(dataArray);
      analyser.getByteFrequencyData(frequencyData);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const amplitude = (dataArray[i] - 128) / 128;
        sum += amplitude * amplitude;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const volume = Math.min(1, rms * 5);

      const barCount = 16;
      const waveform: number[] = [];
      for (let i = 0; i < barCount; i++) {
        const freqIndex = Math.floor(i * (frequencyData.length / 4) / barCount);
        waveform.push(frequencyData[freqIndex] / 255);
      }

      window.electronAPI.sendAudioData({ volume, waveform });
    };

    audioDataIntervalRef.current = setInterval(sendAudioData, 16);
  };

  const startRecording = async () => {
    dispatch({ type: 'START_REQUESTED' });
    pendingStopRef.current = false;
    clearLiveTranscript();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      pendingStopRef.current = false;
      fail('Mic Error', 'Could not access the microphone.');
      return;
    }

    // Connect to Deepgram before recording; without it nothing would be transcribed
    const dgResult = await window.electronAPI.deepgramStartSession();
    if (!dgResult.success) {
      stream.getTracks().forEach((track) => track.stop());
      pendingStopRef.current = false;
      fail('Error', dgResult.error || 'Could not connect to Deepgram.');
      return;
    }

    streamRef.current = stream;
    startAudioAnalysis(stream);

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    sendChainRef.current = Promise.resolve();
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      const data = event.data;
      sendChainRef.current = sendChainRef.current
        .then(() => data.arrayBuffer())
        .then((buffer) => window.electronAPI.deepgramSendAudioChunk(buffer))
        .catch((err) => console.error('Error forwarding audio chunk:', err));
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(AUDIO_TIMESLICE_MS);
    dispatch({ type: 'RECORDING_STARTED' });
    window.electronAPI.setOverlayVisible(true);

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      stopRecording();
    }
  };

  /** Stop recording and finalize. `interruption` is set when the connection dropped mid-session. */
  const stopRecording = async (interruption?: string) => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    const recorderStopped = new Promise<void>((resolve) => {
      mediaRecorder.addEventListener('stop', () => resolve(), { once: true });
    });
    mediaRecorder.stop();

    dispatch({ type: 'STOP_PROCESSING' });
    clearLiveTranscript();
    window.electronAPI.setOverlayVisible(false);

    try {
      // Make sure the final audio chunk reaches Deepgram before asking it to finalize
      await recorderStopped;
      await sendChainRef.current;
      releaseMicrophone();

      const result = await window.electronAPI.deepgramStopSession();
      const saved = result.success && !!result.formatted;
      if (saved) onSavedRef.current();

      if (interruption) {
        fail('Connection lost', saved
          ? `${interruption} Everything transcribed before that was pasted and saved.`
          : interruption);
      } else if (saved) {
        dispatch({ type: 'DONE', status: 'Done' });
        resetLater(5000);
      } else if (result.success) {
        dispatch({ type: 'DONE', status: 'No speech detected' });
        resetLater(5000);
      } else {
        fail('Error', result.error || 'Transcription failed');
      }
    } catch (error: any) {
      releaseMicrophone();
      fail('Error', interruption || describeStopError(error));
    }
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
    mediaRecorderRef.current.pause();
    dispatch({ type: 'PAUSE' });
  };

  const resumeRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'paused') return;
    mediaRecorderRef.current.resume();
    dispatch({ type: 'RESUME' });
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    mediaRecorderRef.current.stop();
    releaseMicrophone();
    window.electronAPI.deepgramCancelSession();

    dispatch({ type: 'CANCEL' });
    clearLiveTranscript();
    window.electronAPI.setOverlayVisible(false);

    resetLater(1500);
  };

  // Global shortcut, overlay and Deepgram events from the main process
  useEffect(() => {
    const unsubToggle = window.electronAPI.onToggleRecording(() => {
      const { phase } = stateRef.current;
      if (phase === 'recording' || phase === 'paused') {
        stopRecording();
      } else if (phase === 'ready') {
        startRecording();
      }
    });

    const unsubStart = window.electronAPI.onStartRecording(() => {
      if (stateRef.current.phase !== 'ready') return;
      startRecording();
    });

    const unsubStop = window.electronAPI.onStopRecording(() => {
      const { phase } = stateRef.current;
      if (phase === 'starting') {
        pendingStopRef.current = true;
        return;
      }
      if (phase !== 'recording' && phase !== 'paused') return;
      stopRecording();
    });

    const unsubPause = window.electronAPI.onPauseRecording(() => {
      if (stateRef.current.phase !== 'recording') return;
      pauseRecording();
    });

    const unsubResume = window.electronAPI.onResumeRecording(() => {
      if (stateRef.current.phase !== 'paused') return;
      resumeRecording();
    });

    const unsubTranscript = window.electronAPI.onDeepgramTranscript(({ text, isFinal }) => {
      if (isFinal) {
        finalsTextRef.current += (finalsTextRef.current ? ' ' : '') + text;
        setLiveTranscript(finalsTextRef.current);
      } else {
        // Show confirmed finals + current interim
        setLiveTranscript(finalsTextRef.current + (finalsTextRef.current ? ' ' : '') + text);
      }
    });

    const unsubConnectionLost = window.electronAPI.onDeepgramConnectionLost(({ message }) => {
      const { phase } = stateRef.current;
      if (phase !== 'recording' && phase !== 'paused') return;
      stopRecording(message);
    });

    return () => {
      unsubToggle();
      unsubStart();
      unsubStop();
      unsubPause();
      unsubResume();
      unsubTranscript();
      unsubConnectionLost();
    };
  }, []);

  return {
    phase: state.phase,
    status: state.status,
    errorMessage: state.errorMessage,
    isRecording: state.phase === 'recording' || state.phase === 'paused',
    isPaused: state.phase === 'paused',
    isProcessing: state.phase === 'processing',
    liveTranscript,
    startRecording,
    stopRecording: () => stopRecording(),
    cancelRecording,
    showError: (errorMessage: string) => dispatch({ type: 'ERROR', status: 'Ready', errorMessage }),
    dismissError: () => dispatch({ type: 'DISMISS_ERROR' }),
  };
}
