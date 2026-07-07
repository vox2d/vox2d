"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import { useEffect, useRef, useState } from "react";
import type { SttProvider } from "@/lib/types";

/**
 * Audio recorder. Two paths:
 *  - "webspeech": Web Speech API (no network, free, Chrome/Edge/Safari)
 *  - "whisper": MediaRecorder → POST /api/speech
 *  - "none": component shouldn't be rendered
 *
 * The component is self-contained: it records, transcribes, and calls
 * `onTranscript(text)` when done.
 */
export default function AudioRecorder({
  provider,
  onTranscript,
  onClose,
}: {
  provider: SttProvider;
  onTranscript: (text: string) => void;
  onClose: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<unknown>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      // Clean up on unmount
      const rec = recognitionRef.current as { stop?: () => void } | null;
      try {
        rec?.stop?.();
      } catch {
        // ignore
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  async function startWhisperRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      stream.getTracks().forEach((t) => t.stop());
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const resp = await fetch("/api/speech", { method: "POST", body: form });
      if (resp.ok) {
        const json = (await resp.json()) as { text?: string };
        if (json.text) onTranscript(json.text);
      } else {
        window.alert("Whisper transcription failed.");
      }
    };
    mr.start();
    setRecording(true);
  }

  function stopWhisperRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function startWebSpeech() {
    type SR = {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: (e: { results: { transcript: string; isFinal?: boolean }[][] }) => void;
      onerror: (e: unknown) => void;
      onend: () => void;
    };
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      window.alert(
        "Web Speech API is not available in this browser. Switch STT provider to Whisper in Settings.",
      );
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onerror = (e) => {
      console.error("Speech recognition error", e);
    };
    rec.onend = () => {
      setRecording(false);
      if (transcript.trim().length > 0) onTranscript(transcript);
    };
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
  }

  function stopWebSpeech() {
    const rec = recognitionRef.current as { stop?: () => void } | null;
    rec?.stop?.();
  }

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        p: 1.5,
        bgcolor: "background.default",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {!recording ? (
          <Button
            size="small"
            variant="contained"
            startIcon={<MicIcon />}
            onClick={() =>
              provider === "whisper" ? startWhisperRecording() : startWebSpeech()
            }
          >
            Start
          </Button>
        ) : (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<StopIcon />}
            onClick={() =>
              provider === "whisper" ? stopWhisperRecording() : stopWebSpeech()
            }
          >
            Stop
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {provider === "whisper"
            ? "Recording — transcribed on stop"
            : "Web Speech — partial transcript shown live"}
        </Typography>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </Stack>
      {transcript && (
        <Typography variant="body2" sx={{ mt: 1, fontStyle: "italic" }}>
          {transcript}
        </Typography>
      )}
    </Box>
  );
}
