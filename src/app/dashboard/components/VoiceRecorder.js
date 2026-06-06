"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

/**
 * VoiceRecorder component
 * - A button that lets users record voice notes
 * - Uses Web Audio API (MediaRecorder) for recording
 * - Shows recording state with timer and waveform visualization
 * - On stop, sends the audio to the transcription API
 * - Returns transcribed text via onTranscribe callback
 */
export default function VoiceRecorder({ onTranscribe, disabled = false, compact = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveformData, setWaveformData] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopAnalyser();
      cleanupStream();
    };
  }, [stopTimer, stopAnalyser, cleanupStream]);

  // Visualize audio levels during recording
  // Uses a ref to avoid self-referencing useCallback lint error
  const visualizeRef = useRef(null);

  const startVisualization = useCallback(() => {
    const runFrame = () => {
      if (!analyserRef.current) return;

      const analyser = analyserRef.current;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS audio level (0-1)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setAudioLevel(Math.min(rms * 5, 1)); // Amplify for visibility

      // Update waveform data for visualization
      const wavePoints = [];
      const step = Math.floor(dataArray.length / 32);
      for (let i = 0; i < 32; i++) {
        const val = (dataArray[i * step] - 128) / 128;
        wavePoints.push(val);
      }
      setWaveformData(wavePoints);

      visualizeRef.current = requestAnimationFrame(runFrame);
    };
    runFrame();
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Set up audio analyser for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopAnalyser();
        cleanupStream();

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(",")[1]; // Remove data:audio/webm;base64, prefix

          setIsTranscribing(true);
          try {
            const res = await fetch("/api/messages/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audio_base64: base64Audio,
                generate_response: false,
              }),
            });

            const data = await res.json();
            if (data.success && data.transcription) {
              onTranscribe?.(data.transcription);
            } else if (data.message) {
              onTranscribe?.(data.message);
            }
          } catch (err) {
            console.error("Transcription error:", err);
            onTranscribe?.("[Transcription failed — please type your message]");
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data in 100ms chunks
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Start visualization
      startVisualization();
    } catch (err) {
      console.error("Microphone access error:", err);
      if (err.name === "NotAllowedError") {
        alert("Microphone access denied. Please allow microphone access in your browser settings.");
      } else {
        alert("Could not access microphone. Please check your device.");
      }
    }
  }, [disabled, onTranscribe, startVisualization, stopAnalyser, cleanupStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioLevel(0);
    setWaveformData([]);
    stopTimer();
  }, [stopTimer]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Compact mode: just a mic button (for CopilotPanel)
  if (compact) {
    return (
      <button
        type="button"
        className={`voice-recorder-compact ${isRecording ? "recording" : ""} ${isTranscribing ? "transcribing" : ""}`}
        onClick={toggleRecording}
        disabled={disabled || isTranscribing}
        title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Record voice message"}
      >
        {isTranscribing ? (
          <Loader2 size={16} className="spin" />
        ) : isRecording ? (
          <>
            <span className="voice-pulse-dot" />
            <MicOff size={16} />
          </>
        ) : (
          <Mic size={16} />
        )}
        {isRecording && (
          <span className="voice-timer-compact">{formatTime(recordingTime)}</span>
        )}
      </button>
    );
  }

  // Full mode: with waveform visualization (for conversations page)
  return (
    <div className="voice-recorder">
      {/* Recording overlay */}
      {isRecording && (
        <div className="voice-recording-overlay">
          <div className="voice-recording-info">
            <span className="voice-pulse-dot" />
            <span className="voice-recording-label">Recording</span>
            <span className="voice-timer">{formatTime(recordingTime)}</span>
          </div>

          {/* Waveform visualization */}
          <div className="voice-waveform">
            {waveformData.map((val, i) => (
              <div
                key={i}
                className="voice-waveform-bar"
                style={{
                  height: `${Math.max(Math.abs(val) * 100, 8)}%`,
                  backgroundColor: `rgba(255, 82, 82, ${0.4 + Math.abs(val) * 0.6})`,
                }}
              />
            ))}
          </div>

          <button
            type="button"
            className="voice-stop-btn"
            onClick={stopRecording}
          >
            <MicOff size={16} />
            <span>Stop & Transcribe</span>
          </button>
        </div>
      )}

      {/* Transcribing state */}
      {isTranscribing && (
        <div className="voice-transcribing">
          <Loader2 size={18} className="spin" />
          <span>Transcribing your voice...</span>
        </div>
      )}

      {/* Mic button */}
      {!isRecording && !isTranscribing && (
        <button
          type="button"
          className="voice-mic-btn"
          onClick={startRecording}
          disabled={disabled}
          title="Record voice message"
        >
          <Mic size={18} />
        </button>
      )}
    </div>
  );
}
