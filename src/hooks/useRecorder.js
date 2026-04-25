// src/hooks/useRecorder.js
// MediaRecorder hook — graba audio real desde el micrófono
// Maneja compatibilidad iOS Safari (WAV fallback) y Android Chrome (WebM)

import { useState, useRef, useCallback, useEffect } from 'react';
import { meetings, upload, process } from '../utils/api.js';

const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function getSupportedMimeType() {
  for (const type of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return ''; // iOS fallback — usa el default del navegador
}

export function useRecorder() {
  const [state, setState]         = useState('idle');   // idle | requesting | recording | paused | uploading | processing
  const [elapsed, setElapsed]     = useState(0);
  const [amplitude, setAmplitude] = useState(Array(20).fill(0.15));
  const [error, setError]         = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentMeetingId, setCurrentMeetingId] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef        = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const audioCtxRef      = useRef(null);

  // ── Cleanup al desmontar ─────────────────────────────────
  useEffect(() => {
    return () => {
      stopStream();
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  // ── Visualizador de amplitude real ──────────────────────
  const startAmplitudeAnalyser = (stream) => {
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source   = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array(20).fill(0).map((_, i) => {
          const idx = Math.floor((i / 20) * dataArray.length);
          return Math.max(0.05, dataArray[idx] / 255);
        });
        setAmplitude(bars);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Fallback: animación aleatoria si AudioContext no disponible
      animFrameRef.current = setInterval(() => {
        setAmplitude(Array(20).fill(0).map(() => 0.1 + Math.random() * 0.9));
      }, 150);
    }
  };

  // ── START ─────────────────────────────────────────────────
  const startRecording = useCallback(async (meetingTitle) => {
    setError(null);
    setState('requesting');

    try {
      // Pedir permisos de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate:       16000, // óptimo para STT
        },
      });
      streamRef.current = stream;

      // Crear meeting en BD
      const { data: meeting } = await meetings.create({
        title: meetingTitle || `Reunión ${new Date().toLocaleDateString('es-ES')}`,
      });
      setCurrentMeetingId(meeting.id);

      // Configurar MediaRecorder
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Recoger chunks cada 1s (permite ver tamaño en tiempo real)
      recorder.start(1000);

      // Timer
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

      // Visualizador
      startAmplitudeAnalyser(stream);

      setState('recording');
      return meeting;

    } catch (err) {
      setState('idle');
      if (err.name === 'NotAllowedError') {
        setError('Permiso de micrófono denegado. Actívalo en los ajustes del navegador.');
      } else {
        setError(`Error iniciando grabación: ${err.message}`);
      }
      return null;
    }
  }, []);

  // ── PAUSE / RESUME ────────────────────────────────────────
  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (state === 'recording') {
      recorder.pause();
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      setAmplitude(Array(20).fill(0.05));
      setState('paused');
    } else if (state === 'paused') {
      recorder.resume();
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
      startAmplitudeAnalyser(streamRef.current);
      setState('recording');
    }
  }, [state]);

  // ── STOP + UPLOAD + PROCESS ──────────────────────────────
  const stopAndProcess = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !currentMeetingId) return null;

    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);

    // Esperar a que MediaRecorder termine de escribir
    await new Promise(resolve => {
      recorder.onstop = resolve;
      recorder.stop();
    });

    stopStream();
    setAmplitude(Array(20).fill(0.05));
    setState('uploading');

    try {
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });

      // Decidir estrategia de upload según tamaño
      const SIZE_THRESHOLD = 8 * 1024 * 1024; // 8MB

      let audioBase64 = null;
      let driveFileId = null;

      if (blob.size <= SIZE_THRESHOLD) {
        // Audio pequeño — enviar base64 directo al pipeline
        audioBase64 = await upload.uploadBase64(blob);
      } else {
        // Audio grande — upload resumable a Drive
        try {
          const fileName = `recording_${currentMeetingId}`;
          const { mode, uploadUrl } = await upload.getPresignedUrl({
            meetingId: currentMeetingId,
            fileName,
            mimeType,
            fileSize: blob.size,
          });

          if (mode === 'drive' && uploadUrl) {
            await upload.uploadToDrive(uploadUrl, blob, setUploadProgress);
            // Drive devuelve el fileId en la respuesta — para simplificar usamos base64
            // En V2: parsear respuesta de Drive para obtener fileId real
            audioBase64 = await upload.uploadBase64(blob);
          } else {
            // Drive no conectado — base64 igualmente
            audioBase64 = await upload.uploadBase64(blob);
          }
        } catch {
          // Fallback a base64 si falla Drive
          audioBase64 = await upload.uploadBase64(blob);
        }
      }

      setState('processing');

      // Lanzar pipeline de procesamiento
      const result = await process.run(currentMeetingId, {
        audioBase64,
        mimeType,
        driveFileId,
      });

      setState('idle');
      setElapsed(0);
      setUploadProgress(0);

      return { meetingId: currentMeetingId, ...result };

    } catch (err) {
      setState('idle');
      setError(`Error procesando el audio: ${err.message}`);
      return null;
    }
  }, [currentMeetingId]);

  // ── CANCEL ────────────────────────────────────────────────
  const cancelRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopStream();
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    chunksRef.current = [];
    setState('idle');
    setElapsed(0);
    setError(null);
    setCurrentMeetingId(null);
  }, []);

  return {
    state,          // 'idle' | 'requesting' | 'recording' | 'paused' | 'uploading' | 'processing'
    elapsed,        // segundos grabados
    amplitude,      // array[20] de 0-1 para el visualizador
    error,          // mensaje de error o null
    uploadProgress, // 0-100 durante upload a Drive
    currentMeetingId,
    startRecording,
    togglePause,
    stopAndProcess,
    cancelRecording,
  };
}
