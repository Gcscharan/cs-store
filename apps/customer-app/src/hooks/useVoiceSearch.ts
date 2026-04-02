/**
 * useVoiceSearch — Google-Model Voice Engine
 *
 * Architecture:
 *  - Native engine owns the full lifecycle (continuous: true)
 *  - JS has exactly ONE timer: 5s post-speech silence → graceful stop
 *  - No restart loops. No pre-speech timers. No JS-vs-native fights.
 *  - no-speech error → silently update hint message, NEVER show error
 *  - Mirrors Google Assistant / Gboard behavior exactly.
 *
 * State Machine:
 *   idle → listening → speaking → processing → done → (auto-submit)
 *                ↓ (no speech ever)
 *            graceful close (no error shown)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { Audio } from 'expo-av';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as Haptics from 'expo-haptics';

// ─── Types ──────────────────────────────────────────────────────

export type VoiceSearchState =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'speaking'
  | 'processing'
  | 'done'
  | 'error';

// voicePhase is a derived UX hint for the UI layer
export type VoicePhase =
  | 'waiting'    // Mic open, no speech yet — "Listening..."
  | 'patient'    // Still no speech after 3s — "Keep speaking..."
  | 'receiving'  // Partials flowing in
  | 'finalizing' // recognizer wrapping up
  | 'done';

export interface UseVoiceSearchReturn {
  start: (source?: string) => Promise<void>;
  stop: () => void;
  cancel: () => void;
  state: VoiceSearchState;
  voicePhase: VoicePhase;
  partialText: string;
  finalText: string;
  errorMessage: string | null;
  hasPermission: boolean | null;
  // Legacy compat fields for any existing UI
  showSpeakHint: boolean;
  isRestarting: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────

function clearTimer(ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

import { buildSearchQuery } from '../utils/voiceIntentParser';
import { correctVoiceQuery as localCorrectVoiceQuery } from '../utils/voiceCorrection';
import { useCorrectVoiceQueryMutation } from '../api/voiceApi';
import { useGetProductsQuery } from '../api/productsApi';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

// ─── Native Config (Optimized for long pauses, like Google) ──────

const NATIVE_CONFIG = {
  lang: 'en-IN',
  interimResults: true,
  maxAlternatives: 1,
  continuous: true,           // ← KEY: native owns continuity, no JS restarts
  requiresOnDeviceRecognition: false,
  addsPunctuation: false,
  iosTaskHint: 'search' as const,
  androidIntentOptions: {
    EXTRA_LANGUAGE_MODEL: 'free_form' as const,
    // Give the native engine 6 full seconds of silence before it decides done
    EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 6000,
    EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 6000,
    // Let user take at least 1.5s before any silence is judged
    EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 1500,
    // @ts-ignore
    EXTRA_MAX_RESULTS: 3,
    EXTRA_MASK_OFFENSIVE_WORDS: false,
  },
};

// ─── Hook ─────────────────────────────────────────────────────────

export function useVoiceSearch(
  onResult?: (text: string) => void,
  onError?: (message: string) => void,
): UseVoiceSearchReturn {

  const [state, setState] = useState<VoiceSearchState>('idle');
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('waiting');
  const [partialText, setPartialText] = useState('');
  const [finalText, setFinalText] = useState('');
  const finalTextRef = useRef('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Get userId from auth state
  const userId = useSelector((state: RootState) => state.auth?.user?._id);

  // Backend correction API
  const [correctVoiceQueryMutation] = useCorrectVoiceQueryMutation();

  // ── Fetch products for dynamic dictionary (DEPRECATED - backend now handles this) ──
  const { data: productsData } = useGetProductsQuery({ limit: 100 });

  // ── Build dynamic dictionary from product catalog (DEPRECATED - backend now handles this) ──
  // This is kept for backward compatibility but will be removed once backend is fully integrated
  // useEffect(() => {
  //   if (productsData?.products && productsData.products.length > 0) {
  //     if (correctionEngine.getDictionary().length === 0 || correctionEngine.needsRefresh()) {
  //       console.log('[VoiceSearch] Building dynamic dictionary from', productsData.products.length, 'products');
  //       correctionEngine.buildDictionary(productsData.products);
  //     }
  //   }
  // }, [productsData]);

  // ── Refs (not re-render triggers) ──
  const isActiveRef    = useRef(false);
  const isStartingRef  = useRef(false);
  const hasSpokenRef   = useRef(false);  // true once ANY partial arrives
  const lastStopTimeRef = useRef(0);
  const appStateRef    = useRef<AppStateStatus>(AppState.currentState);

  // ── The ONE and ONLY timer ──
  // 5s silence window, armed ONLY after first speech. No other timers exist.
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Patient hint timer (for "Keep speaking..." UX) ──
  // This is a UI-only timer — no mic control, no stop/start
  const patientHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Clear all timers ────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    clearTimer(silenceTimerRef);
    clearTimer(patientHintTimerRef);
  }, []);

  // ─── Arm 5s post-speech silence timer ────────────────────────
  // Called on every speech event. Resets on each new speech.
  // Only calls graceful stop — never abort.
  const armSilenceTimer = useCallback(() => {
    clearTimer(silenceTimerRef);
    silenceTimerRef.current = setTimeout(() => {
      // 🛑 DISABLED 5s SILENCE TIMEOUT TEMPORARILY FOR DEBUGGING
      /*
      if (!isActiveRef.current) return;
      // Graceful stop — lets native finalize its last result
      isActiveRef.current = false;
      lastStopTimeRef.current = Date.now();
      setVoicePhase('finalizing');
      setState('processing');
      */
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Auto-submit after Google-style finalization pause
      setTimeout(() => {
        const result = finalTextRef.current.trim();
        if (result.length > 0) {
          onResult?.(result);
        }
      }, 300);
    }, 5000);
  }, [onResult]);

  // ─── App Background: abort mic ────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (
        appStateRef.current === 'active' &&
        (next === 'background' || next === 'inactive')
      ) {
        if (isActiveRef.current) {
          clearAllTimers();
          ExpoSpeechRecognitionModule.abort();
          isActiveRef.current = false;
          lastStopTimeRef.current = Date.now();
          setState('idle');
          setVoicePhase('waiting');
        }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [clearAllTimers]);

  // ─── Native Event: start ──────────────────────────────────────
  useSpeechRecognitionEvent('start', () => {
    console.log("🎤 START EVENT FIRED");
    setState('listening');
    setVoicePhase('waiting');
    hasSpokenRef.current = false;

    // UI-only timer: after 3s of silence with no speech → "Keep speaking..."
    clearTimer(patientHintTimerRef);
    patientHintTimerRef.current = setTimeout(() => {
      if (isActiveRef.current && !hasSpokenRef.current) {
        setVoicePhase('patient');
      }
    }, 3000);
  });

  // ─── Native Event: result (partials + final) ──────────────────
  useSpeechRecognitionEvent('result', async event => {
    console.log("🎯 RAW EVENT:", JSON.stringify(event, null, 2));
    
    const raw =
      event.results?.[0]?.transcript ||
      // @ts-ignore — OEM fallback for Samsung/Xiaomi
      event.results?.[0]?.alternatives?.[0]?.transcript ||
      '';

    if (!raw.trim()) return;

    let text = raw; // Default to raw transcript
    
    // STEP 1: Apply backend-controlled voice correction (with experiment support)
    try {
      // Generate idempotent request ID to prevent duplicate processing on timeout/retry
      const requestId = `${userId || 'anon'}:${raw}:${Date.now()}`;
      
      const correctionResult = await correctVoiceQueryMutation({
        query: raw,
        userId: userId || undefined,
        requestId, // 🔥 Idempotency key
      }).unwrap();
      
      if (correctionResult.success && correctionResult.matched) {
        text = correctionResult.corrected;
        
        console.log('[VoiceSearch] ✅ Backend correction applied:', {
          original: raw,
          corrected: correctionResult.corrected,
          confidence: correctionResult.confidence,
          source: correctionResult.source,
          variant: correctionResult.variant,
          experimentName: correctionResult.experimentName,
          thresholdUsed: correctionResult.thresholdUsed,
          requestId,
        });
      } else {
        // No correction found, use original
        text = raw;
      }
    } catch (error) {
      // Backend correction failed, fallback to local correction for resilience
      console.warn('[VoiceSearch] ⚠️ Backend correction failed, using local fallback:', error);
      
      try {
        const localResult = localCorrectVoiceQuery(raw, 0.6);
        if (localResult.matched) {
          text = localResult.corrected;
          console.log('[VoiceSearch] ✅ Local fallback correction applied:', {
            original: raw,
            corrected: localResult.corrected,
            confidence: localResult.confidence,
          });
        } else {
          text = raw;
        }
      } catch (localError) {
        // Even local correction failed, use original
        console.error('[VoiceSearch] ❌ Local fallback also failed, using original query');
        text = raw;
      }
    }
    
    // STEP 2: Apply intent parsing
    text = buildSearchQuery(text);

    if (!hasSpokenRef.current) {
      // First speech — cancel patient hint, switch to speaking state
      hasSpokenRef.current = true;
      clearTimer(patientHintTimerRef);
      setState('speaking');
      setVoicePhase('receiving');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (event.isFinal) {
      setFinalText(prev => {
        if (!prev) {
          finalTextRef.current = text;
          return text;
        }

        const words = prev.split(' ');
        const newWords = text.split(' ');

        // remove overlap words
        const filtered = newWords.filter(word => !words.includes(word));
        
        const next = [...words, ...filtered].join(' ');
        finalTextRef.current = next;
        return next;
      });
      setPartialText('');
      // After final, re-arm silence timer for natural continued listening
      armSilenceTimer();
    } else {
      setPartialText(text);
      // Reset silence timer on every partial — user is still speaking
      armSilenceTimer();
    }
  });

  // ─── Native Event: end ────────────────────────────────────────
  useSpeechRecognitionEvent('end', () => {
    isActiveRef.current = false;
    clearAllTimers();

    setState(prev => {
      if (prev === 'speaking' || prev === 'listening' || prev === 'processing') {
        return 'done';
      }
      return prev;
    });
    setVoicePhase('done');
  });

  // ─── Native Event: error ──────────────────────────────────────
  //
  // GOOGLE MODEL RULE:
  //  - 'no-speech'  → NEVER show error. Silently update hint. Keep going.
  //  - 'aborted'    → User cancelled. Silent.
  //  - 'network'    → Show message, close gracefully.
  //  - 'not-allowed'→ Show permission alert.
  //  - everything else → subtle message, close gracefully.
  //
  useSpeechRecognitionEvent('error', async event => {
    if (event.error === 'aborted') return; // User-initiated cancel — ignore

    if (event.error === 'no-speech') {
      // Google behavior: completely ignore it. Don't stop. Don't show error.
      // The native engine will retry internally.
      return;
    }

    // Absolute failures only
    const msg = resolveErrorMessage(event.error);
    clearAllTimers();
    isActiveRef.current = false;
    setErrorMessage(msg);
    setState('error');
    onError?.(msg);
  });

  // ─── Permission ───────────────────────────────────────────────
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    console.log("MIC PERMISSION:", result);
    const allowed = result.granted;
    setHasPermission(allowed);
    if (!allowed) {
      showPermissionDeniedAlert(!result.canAskAgain);
    }
    return allowed;
  }, []);

  // ─── START ────────────────────────────────────────────────────
  const start = useCallback(async (source = 'unknown') => {
    console.log(`[Voice] start(${source})`);

    if (isActiveRef.current || isStartingRef.current) {
      console.log('[Voice] blocked: already running');
      return;
    }

    isStartingRef.current = true;

    try {
      // Hardware cooldown: ensure 400ms between stop and start
      const timeSinceStop = Date.now() - lastStopTimeRef.current;
      if (timeSinceStop < 400) {
        await new Promise(r => setTimeout(r, 400 - timeSinceStop));
      }

      // Reset all state
      setPartialText('');
      setFinalText('');
      finalTextRef.current = '';
      setErrorMessage(null);
      setVoicePhase('waiting');
      hasSpokenRef.current = false;
      clearAllTimers();
      setState('requesting_permission');

      const allowed = await requestPermission();
      if (!allowed) {
        setState('error');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      isActiveRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await ExpoSpeechRecognitionModule.start(NATIVE_CONFIG);

    } catch (e) {
      console.error('[Voice] start error:', e);
      isActiveRef.current = false;
      setState('error');
    } finally {
      isStartingRef.current = false;
    }
  }, [requestPermission, clearAllTimers]);

  // ─── STOP (graceful — commits current result) ─────────────────
  const stop = useCallback(() => {
    clearAllTimers();
    if (isActiveRef.current) {
      isActiveRef.current = false;
      lastStopTimeRef.current = Date.now();
      setState('processing');
      setVoicePhase('finalizing');
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [clearAllTimers]);

  // ─── CANCEL (abort — discards result) ────────────────────────
  const cancel = useCallback(() => {
    clearAllTimers();
    if (isActiveRef.current) {
      isActiveRef.current = false;
      lastStopTimeRef.current = Date.now();
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch (_) {}
    }
    setState('idle');
    setVoicePhase('waiting');
    setPartialText('');
    setFinalText('');
    finalTextRef.current = '';
    setErrorMessage(null);
    hasSpokenRef.current = false;
  }, [clearAllTimers]);

  // ─── Unmount cleanup ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearAllTimers();
      if (isActiveRef.current) {
        try { ExpoSpeechRecognitionModule.abort(); } catch (_) {}
        isActiveRef.current = false;
      }
    };
  }, [clearAllTimers]);

  return {
    start,
    stop,
    cancel,
    state,
    voicePhase,
    partialText,
    finalText,
    errorMessage,
    hasPermission,
    // Legacy compat — map to new system
    showSpeakHint: voicePhase === 'patient',
    isRestarting: false,
  };
}

// ─── Error Message Map ────────────────────────────────────────────

function resolveErrorMessage(code: string): string {
  const map: Record<string, string> = {
    'audio-capture':          'Microphone not available.',
    'not-allowed':            'Microphone permission denied.',
    'network':                'Network error. Check your connection.',
    'service-not-allowed':    'Speech service unavailable on this device.',
    'language-not-supported': 'Language not supported.',
    'interrupted':            'Audio interrupted. Please try again.',
    'busy':                   'Microphone is busy. Please try again.',
    'client':                 'Device error. Please try again.',
    'unknown':                'Something went wrong. Please try again.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

function showPermissionDeniedAlert(isPermanent: boolean) {
  Alert.alert(
    'Microphone Access Required',
    isPermanent
      ? 'Microphone permission was permanently denied. Please enable it in Settings → App Permissions → Microphone.'
      : 'Vyapara Setu needs microphone access to search by voice.',
    [{ text: 'OK', style: isPermanent ? 'cancel' : 'default' }],
  );
}
