/**
 * VoiceListeningModal — Google Gboard-style voice input UI
 *
 * voicePhase drives all UX decisions:
 *   'waiting'   → "Listening..." (mic open, no speech)
 *   'patient'   → "Keep speaking..." (3s no speech)
 *   'receiving' → live text streams in
 *   'finalizing'→ "Got it..." (graceful wrap-up)
 *   'done'      → modal closes
 *
 * Design principles:
 *  - Text streams smoothly, never resets or flickers
 *  - No error messages for no-speech (shows hint instead)
 *  - Wave bars respond only to real speech (voicePhase === 'receiving')
 *  - Pulsating mic is always on while listening — calming, not alarming
 */

import React, { useEffect, useRef, memo, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated,
  TouchableOpacity, TouchableWithoutFeedback,
  Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import type { VoiceSearchState, VoicePhase } from '../hooks/useVoiceSearch';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 64, 320);

// ─── Wave Bar ────────────────────────────────────────────────────
const WaveBar = memo(({ delay, isListening, isReceiving }: {
  delay: number;
  isListening: boolean;
  isReceiving: boolean;
}) => {
  const heightAnim = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    let cancelled = false;

    const runLoop = () => {
      if (cancelled || !isListening) return;
      const minH = isReceiving ? 12 : 6;
      const maxH = isReceiving ? 44 : 10;
      const dur  = isReceiving ? 160 : 400;
      const target = minH + Math.random() * (maxH - minH);
      Animated.sequence([
        Animated.timing(heightAnim, { toValue: target, duration: dur, useNativeDriver: false }),
        Animated.timing(heightAnim, { toValue: minH, duration: dur, useNativeDriver: false }),
      ]).start(({ finished }) => { if (finished) runLoop(); });
    };

    if (isListening) {
      const tid = setTimeout(() => { if (!cancelled) runLoop(); }, delay);
      return () => { cancelled = true; clearTimeout(tid); heightAnim.stopAnimation(); };
    } else {
      Animated.timing(heightAnim, { toValue: 6, duration: 250, useNativeDriver: false }).start();
    }

    return () => { cancelled = true; heightAnim.stopAnimation(); };
  }, [isListening, isReceiving, delay, heightAnim]);

  return (
    <Animated.View style={[
      styles.waveBar,
      {
        height: heightAnim,
        backgroundColor: isReceiving ? Colors.primary : (isListening ? '#CBD5E1' : Colors.border),
        opacity: isListening ? (isReceiving ? 1 : 0.7) : 0.35,
      },
    ]} />
  );
});

// ─── Pulsating Mic ───────────────────────────────────────────────
const PulsatingMic = memo(({ isListening, isReceiving }: {
  isListening: boolean;
  isReceiving: boolean;
}) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  const opacA  = useRef(new Animated.Value(0.15)).current;
  const scaleB = useRef(new Animated.Value(1)).current;
  const opacB  = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    if (!isListening) {
      Animated.parallel([
        Animated.timing(scaleA, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(opacA,  { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleB, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(opacB,  { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      return;
    }

    // Pulse speed: faster when receiving speech
    const speed = isReceiving ? 500 : 800;
    const toScale = isReceiving ? 1.5 : 1.35;

    const loopA = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleA, { toValue: toScale, duration: speed, useNativeDriver: true }),
        Animated.timing(opacA,  { toValue: 0.04,    duration: speed, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scaleA, { toValue: 1,    duration: speed, useNativeDriver: true }),
        Animated.timing(opacA,  { toValue: 0.15, duration: speed, useNativeDriver: true }),
      ]),
    ]));

    const loopB = Animated.loop(Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(scaleB, { toValue: toScale, duration: speed, useNativeDriver: true }),
        Animated.timing(opacB,  { toValue: 0.04,    duration: speed, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scaleB, { toValue: 1,    duration: speed, useNativeDriver: true }),
        Animated.timing(opacB,  { toValue: 0.1,  duration: speed, useNativeDriver: true }),
      ]),
    ]));

    loopA.start();
    loopB.start();
    return () => { loopA.stop(); loopB.stop(); };
  }, [isListening, isReceiving, scaleA, opacA, scaleB, opacB]);

  return (
    <View style={styles.micContainer}>
      <Animated.View style={[styles.pulseRing, styles.pulseRingOuter, { transform: [{ scale: scaleA }], opacity: opacA }]} />
      <Animated.View style={[styles.pulseRing, styles.pulseRingInner, { transform: [{ scale: scaleB }], opacity: opacB }]} />
      <View style={[styles.micCircle, isListening && styles.micCircleActive]}>
        <Ionicons
          name={isListening ? 'mic' : 'mic-outline'}
          size={38}
          color={isListening ? Colors.white : Colors.textMuted}
        />
      </View>
    </View>
  );
});

// ─── Main Modal ──────────────────────────────────────────────────

interface VoiceListeningModalProps {
  visible: boolean;
  state: VoiceSearchState;
  voicePhase: VoicePhase;
  partialText: string;
  finalText: string;
  errorMessage: string | null;
  onCancel: () => void;
  onRetry?: () => void;
  // Legacy compat (not used internally, kept for backward compatibility)
  showSpeakHint?: boolean;
  isRestarting?: boolean;
}

const VoiceListeningModal: React.FC<VoiceListeningModalProps> = ({
  visible,
  state,
  voicePhase,
  partialText,
  finalText,
  errorMessage,
  onCancel,
  onRetry,
}) => {
  // ──── Derived states ─────────────────────────────────────────
  const isListening  = state === 'listening' || state === 'speaking';
  const isProcessing = state === 'processing';
  const isError      = state === 'error';
  const isReceiving  = voicePhase === 'receiving';

  // Current displayed text — never flickers: partial flows in, final replaces it smoothly
  const displayText = `${finalText} ${partialText}`.trim();

  // ──── Animated dots ──────────────────────────────────────────
  const [dotCount, setDotCount] = useState(1);
  useEffect(() => {
    if (!isListening && !isProcessing) return;
    const id = setInterval(() => setDotCount(d => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, [isListening, isProcessing]);

  // ──── Text slide-in ──────────────────────────────────────────
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(8)).current;
  const prevTextRef   = useRef('');

  useEffect(() => {
    if (displayText && displayText !== prevTextRef.current) {
      prevTextRef.current = displayText;
      Animated.parallel([
        Animated.timing(textOpacity,    { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    } else if (!displayText) {
      textOpacity.setValue(0);
      textTranslateY.setValue(8);
    }
  }, [displayText, textOpacity, textTranslateY]);

  // ──── Card open/close ────────────────────────────────────────
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale      = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, tension: 90, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(cardScale,      { toValue: 0.96, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, overlayOpacity, cardScale]);

  // ──── Status text (Google-style messaging) ───────────────────
  const getStatusText = useCallback(() => {
    const dots = '.'.repeat(dotCount);

    if (isError) {
      // Non-scary: "Didn't catch that" not "ERROR"
      return errorMessage?.toLowerCase().includes('permission')
        ? errorMessage
        : "Didn't catch that — tap to try again";
    }
    if (isProcessing) return `Processing${dots}`;
    if (voicePhase === 'patient') return `Keep speaking${dots}`;
    if (voicePhase === 'waiting') return `Listening${dots}`;
    return `Listening${dots}`;
  }, [dotCount, isError, isProcessing, voicePhase, errorMessage]);

  const WAVE_DELAYS = [0, 55, 110, 165, 220, 275];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.card, { transform: [{ scale: cardScale }] }]}>

              {/* Pulsating Mic */}
              <View style={styles.micWrapper}>
                <PulsatingMic isListening={isListening} isReceiving={isReceiving} />
              </View>

              {/* Waveform */}
              <View style={styles.waveform}>
                {WAVE_DELAYS.map((delay, i) => (
                  <View key={i} style={{ marginRight: i < 5 ? 7 : 0 }}>
                    <WaveBar
                      delay={delay}
                      isListening={isListening}
                      isReceiving={isReceiving}
                    />
                  </View>
                ))}
              </View>

              {/* Text Area — smooth streaming, never resets */}
              <View style={styles.textArea}>
                {displayText ? (
                  <Animated.Text
                    style={[
                      styles.liveTextFinal,
                      { opacity: textOpacity, transform: [{ translateY: textTranslateY }] },
                    ]}
                    numberOfLines={3}
                  >
                    {finalText}
                    <Text style={styles.liveText}>
                      {partialText ? (finalText ? ' ' + partialText : partialText) : ''}
                    </Text>
                  </Animated.Text>
                ) : (
                  <Text style={[styles.statusText, isError && styles.errorText]}>
                    {getStatusText()}
                  </Text>
                )}
              </View>

              {/* Retry only on hard errors (permission, network) */}
              {isError && onRetry && (
                <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.75}>
                  <Ionicons name="mic" size={16} color={Colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
              )}

            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default VoiceListeningModal;

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: CARD_W,
    backgroundColor: Colors.white,
    borderRadius: 36,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
      android: { elevation: 10 },
    }),
  },
  micWrapper: { marginBottom: 20, marginTop: 4 },
  micContainer: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', borderRadius: 100, backgroundColor: Colors.primary },
  pulseRingOuter: { width: 100, height: 100 },
  pulseRingInner: { width: 76, height: 76 },
  micCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  micCircleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  waveform: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 48, marginBottom: 18,
  },
  waveBar: { width: 5, borderRadius: 3 },

  textArea: { minHeight: 52, alignItems: 'center', justifyContent: 'center', width: '100%' },

  liveText: {
    fontSize: 20, fontWeight: '500',
    color: Colors.textSecondary,   // partials are slightly muted
    textAlign: 'center', letterSpacing: 0.2, lineHeight: 28,
  },
  liveTextFinal: {
    color: Colors.textPrimary,     // final text is bold/dark
    fontWeight: '700',
  },
  statusText: {
    fontSize: 16, fontWeight: '500',
    color: Colors.textSecondary, textAlign: 'center', letterSpacing: 0.1,
  },
  errorText: { color: '#EF4444' },
  subHint: {
    fontSize: 13, color: Colors.textMuted,
    marginTop: 8, textAlign: 'center', letterSpacing: 0.1,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 24, paddingVertical: 12, paddingHorizontal: 32,
    borderRadius: 24, backgroundColor: '#FFF5F0',
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  retryText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
});
