import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("experimental voice mode", () => {
  it("persists an opt-in setting that defaults off", () => {
    const store = read("src/store/settingsStore.ts");
    const general = read("src/features/settings/tabs/GeneralTab.tsx");

    expect(store).toContain("voiceModeExperimental: boolean");
    expect(store).toContain("voiceModeExperimental: false");
    expect(store).toContain("const SETTINGS_VERSION = 22");
    expect(general).toContain('title="Voice mode (experimental)"');
    expect(general).toContain("voiceModeExperimental");
  });

  it("uses the send-button slot for voice only when the composer is empty", () => {
    const input = read("src/features/chat/components/ChatInput.tsx");

    expect(input).toContain("onOpenVoiceMode?: () => void");
    expect(input).toContain("voiceModeExperimental");
    expect(input).toContain("showVoiceModeAction");
    expect(input).toContain('"Open voice mode"');
    expect(input).toContain("<AudioLines");
    expect(input).toContain('"Stop generation"');
    expect(input).toContain('"Send message"');
    expect(input.match(/className="size-9 rounded-full"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps one orb surface alive while palettes transition", () => {
    const target = "src/features/chat/components/HeroOrb.tsx";
    expect(existsSync(target)).toBe(true);
    if (!existsSync(target)) return;
    const orb = read(target);

    expect(orb).toContain("interpolatePalette");
    expect(orb).toContain("PALETTE_TRANSITION_MS");
    expect(orb).toContain("transitionStartedAt");
    expect(orb.match(/<Surface /g)).toHaveLength(1);
    expect(orb).not.toContain("outgoing &&");
    expect(orb).toContain("const FRAG = `");
  });

  it("provides the in-workspace voice overlay and existing speech pipeline", () => {
    const target = "src/features/chat/components/VoiceModeOverlay.tsx";
    expect(existsSync(target)).toBe(true);
    if (!existsSync(target)) return;
    const overlay = read(target);
    const workspace = read("src/features/chat/components/ChatWorkspace.tsx");

    // In-workspace layer, not a body portal — the sidebar stays visible.
    expect(overlay).not.toContain("createPortal");
    expect(overlay).toContain("absolute inset-0");
    // Orb click docks the orb small above the input with the chat visible.
    expect(overlay).toContain("onToggleCompact");
    expect(overlay).toContain('"Expand voice mode"');
    expect(workspace).toContain("voiceCompact");
    expect(workspace).toContain("toggleVoiceCompact");
    expect(overlay).toContain("#0A0A0A");
    expect(overlay).toContain("#2A2A2A");
    expect(overlay).toContain("<HeroOrb state={orbState} size={180}");
    expect(overlay).toContain('placeholder="Type"');
    expect(overlay).toContain("Poly can make mistakes. Check important info.");
    expect(overlay).toContain('event.key === "Escape"');
    expect(overlay).toContain("useDictation");
    expect(overlay).toContain("await onSubmit(transcript)");
    expect(overlay).toContain("tts.actions.beginUtterance");
    expect(overlay).toContain("tts.actions.speakChunk");
    expect(overlay).toContain("tts.actions.endUtterance");
    expect(overlay).toContain("tts.actions.stop");
  });

  it("streams sentences to TTS, supports barge-in, and warms models", () => {
    const overlay = read("src/features/chat/components/VoiceModeOverlay.tsx");

    expect(overlay).toContain("speakableSentencePrefix");
    expect(overlay).toContain("advanceBargeIn");
    expect(overlay).toContain("createBargeInState");
    expect(overlay).toContain("onInterrupt");
    expect(overlay).toContain('invoke("preload_whisper_model")');
    expect(overlay).toContain("warmTtsEngine");
    expect(overlay).toContain("{caption}");
  });

  it("sleeps on spoken command and wakes on orb click", () => {
    const overlay = read("src/features/chat/components/VoiceModeOverlay.tsx");

    expect(overlay).toContain("matchesSleepCommand");
    expect(overlay).toContain('"unavailable"');
    expect(overlay).toContain("Asleep — click the orb to wake");
    expect(overlay).toContain("handleOrbClick");
  });

  it("transcribes natively in one IPC call with fast whisper params", () => {
    const dictation = read("src/hooks/useDictation.ts");
    const rust = read("src-tauri/src/commands/dictation_commands.rs");

    expect(dictation).toContain('"stop_native_dictation_and_transcribe"');
    expect(rust).toContain("pub async fn stop_native_dictation_and_transcribe");
    expect(rust).toContain("set_audio_ctx");
    expect(rust).toContain("set_n_threads");
  });

  it("correlates barge-in with playback output and guards restart echo", () => {
    const overlay = read("src/features/chat/components/VoiceModeOverlay.tsx");
    const vad = read("src/lib/dictation/voiceActivity.ts");

    expect(vad).toContain("echoGain");
    expect(vad).toContain("outputLevel");
    expect(overlay).toContain("tts.outputLevel,");
    expect(overlay).toContain("PLAYBACK_ECHO_GRACE_MS");
    expect(overlay).toContain("playbackEndedAtRef");
  });

  it("recovers from errors via orb tap and cues the mic audibly", () => {
    const overlay = read("src/features/chat/components/VoiceModeOverlay.tsx");
    const dictation = read("src/hooks/useDictation.ts");

    expect(dictation).toContain("clearError");
    expect(overlay).toContain("clearError();");
    expect(overlay).toContain('"Retry voice mode"');
    expect(overlay).toContain("tap the orb to retry");
    expect(overlay).toContain("playMicCue");
  });

  it("exposes a VAD sensitivity setting and soft turn cap", () => {
    const store = read("src/store/settingsStore.ts");
    const speech = read("src/features/settings/tabs/SpeechTab.tsx");
    const vad = read("src/lib/dictation/voiceActivity.ts");
    const overlay = read("src/features/chat/components/VoiceModeOverlay.tsx");

    expect(store).toContain("vadSensitivity: number");
    expect(store).toContain("vadSensitivity: 1");
    expect(speech).toContain("vadSensitivity");
    expect(vad).toContain("MAX_TURN_HARD_MS");
    expect(vad).toContain("SOFT_STOP_SILENCE_MS");
    expect(overlay).toContain("vadSensitivity");
  });

  it("streams partial transcripts in realtime and guards against repeats", () => {
    const dictation = read("src/hooks/useDictation.ts");
    const overlay = read("src/features/chat/components/VoiceModeOverlay.tsx");
    const input = read("src/features/chat/components/ChatInput.tsx");
    const rust = read("src-tauri/src/commands/dictation_commands.rs");
    const lib = read("src-tauri/src/lib.rs");

    expect(dictation).toContain('"transcribe_native_dictation_partial"');
    expect(dictation).toContain("partialTranscript");
    expect(overlay).toContain("partials: !tts.isPlaying");
    expect(overlay).toContain("livePartial");
    expect(input).toContain("partials: true");
    expect(input).toContain("dictationBaseRef");
    expect(rust).toContain("pub async fn transcribe_native_dictation_partial");
    expect(rust).toContain("collapse_repeated_transcript");
    expect(rust).toContain(".clamp(512, 1500)");
    expect(lib).toContain("transcribe_native_dictation_partial");
  });

  it("cancels discarded audio and keeps one workspace-owned overlay", () => {
    const dictation = read("src/hooks/useDictation.ts");
    const workspace = read("src/features/chat/components/ChatWorkspace.tsx");
    const folder = read("src/features/folders/FolderHome.tsx");

    expect(dictation).toContain("const cancel = useCallback");
    expect(dictation).toContain("cancel,");
    expect(dictation).toContain("captureGenerationRef");
    expect(workspace).toContain('import("@/features/chat/components/VoiceModeOverlay")');
    expect(workspace).toContain("onOpenVoiceMode");
    expect(workspace).toContain("<VoiceModeOverlayLazy");
    expect(folder).toContain("onOpenVoiceMode");
  });

  it("exposes live browser and native microphone levels", () => {
    const dictation = read("src/hooks/useDictation.ts");
    const rust = read("src-tauri/src/commands/dictation_commands.rs");
    const lib = read("src-tauri/src/lib.rs");

    expect(dictation).toContain("audioLevel");
    expect(dictation).toContain("createAnalyser");
    expect(dictation).toContain('invoke<number>("native_dictation_audio_level")');
    expect(rust).toContain("pub fn native_dictation_audio_level");
    expect(lib).toContain("native_dictation_audio_level,");
  });

  it("runs hands-free turns with status and mute controls", () => {
    const overlay = read("src/features/chat/components/VoiceModeOverlay.tsx");

    expect(overlay).toContain("createVoiceActivityState");
    expect(overlay).toContain("advanceVoiceActivity");
    expect(overlay).toContain("audioLevel");
    expect(overlay).toContain("void start()");
    expect(overlay).toContain("void stop()");
    expect(overlay).toContain('"Listening"');
    expect(overlay).toContain('"Thinking…"');
    expect(overlay).toContain('"Speaking"');
    expect(overlay).toContain('"Muted"');
    expect(overlay).toContain("<MicOff");
    expect(overlay).toContain('"Mute microphone"');
    expect(overlay).toContain('"Unmute microphone"');
    expect(overlay).not.toContain("handleMic");
  });
});
