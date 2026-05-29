interface RunDictationTranscriptionOptions {
  transcribe: () => Promise<string>;
  isCurrentSession: () => boolean;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

export async function runDictationTranscription({
  transcribe,
  isCurrentSession,
  onTranscript,
  onError,
}: RunDictationTranscriptionOptions): Promise<void> {
  try {
    const transcript = (await transcribe()).trim();
    if (isCurrentSession()) {
      onTranscript(transcript);
    }
  } catch (error) {
    if (isCurrentSession()) {
      const message = error instanceof Error ? error.message : String(error);
      onError?.(message);
    }
  }
}
