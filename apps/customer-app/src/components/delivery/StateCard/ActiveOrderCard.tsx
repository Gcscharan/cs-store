import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Order } from '../../../hooks/delivery/useOrders';
import { getStatusConfig, getCustomerDisplayName } from '../../../utils/deliveryUtils';
import { getDeliveryFlowState } from '../../../utils/deliveryOrderFlow';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
  DELIVERY_SHADOW,
} from '../../../constants/deliveryTheme';
import { DELIVERY_CONFIG } from '../../../constants/deliveryConfig';
import { RouteProgressHeader } from '../RouteProgressHeader';
import { useDistanceEta } from '../../../hooks/delivery/useDistanceEta';
import { AttemptState } from '../../../hooks/delivery/useAttemptTracker';
import { AttemptBadge } from '../AttemptBadge/AttemptBadge';
import { RetryLockExplanation } from '../RetryLockExplanation';
import { useNetworkStatus } from '../../../hooks/delivery/useNetworkStatus';

// ─── Canonical Failure Reasons ────────────────────────────────────────────────

export const FAILURE_REASONS = [
  { key: 'CUSTOMER_NOT_AVAILABLE', label: 'Customer not reachable' },
  { key: 'ADDRESS_ISSUE',          label: 'Address incorrect' },
  { key: 'CUSTOMER_REJECTED',      label: 'Customer refused delivery' },
] as const;

export type FailureReasonKey = typeof FAILURE_REASONS[number]['key'];

// ─── Types ────────────────────────────────────────────────────────────────────

type CodCollection = {
  _id: string;
  orderId: string;
  mode: 'CASH' | 'UPI';
  amount: number;
  currency: string;
  collectedAt: string;
  idempotencyKey: string;
};

interface ActiveOrderCardProps {
  activeOrders: Order[];
  deliveryAttempted: Record<string, boolean>;
  codCollectionByOrderId: Record<string, CodCollection | null | undefined>;
  otpInputs: Record<string, string>;
  onOtpChange: (orderId: string, value: string) => void;
  onPickup: (orderId: string) => void;
  onStartDelivery: (orderId: string) => void;
  onMarkArrived: (orderId: string) => void;
  onStartDeliveryAttempt: (orderId: string) => void;
  onResendOtp: (orderId: string) => Promise<void>;
  onVerifyOtp: (orderId: string, otp: string) => void | Promise<void>;
  onCollectCOD: (orderId: string, mode: 'CASH' | 'UPI') => void;
  onFailDelivery: (orderId: string, reason: FailureReasonKey, notes?: string) => void;
  onRefetch?: () => void;
  // Route arrangement props
  canArrangeRoute?: boolean;
  isArranging?: boolean;
  isArranged?: boolean;
  onArrangeRoute?: () => void;
  onResetRoute?: () => void;
  isOrderLocked?: (orderId: string) => boolean;
  isOrderCurrent?: (orderId: string) => boolean;
  sortedOrderIds?: string[];
  driverLocation?: { lat: number; lng: number } | null;
  // Attempt tracker props
  getAttemptState?: (orderId: string) => AttemptState | null;
  isOrderRetryLocked?: (orderId: string) => boolean;
  getOrderRemainingSeconds?: (orderId: string) => number;
}

interface SingleOrderCardProps extends Omit<ActiveOrderCardProps, 'activeOrders'> {
  order: Order;
  isLocked?: boolean;
  isCurrent?: boolean;
  stopIndex?: number;   // 1-based position in route
  totalStops?: number;
  isOffline?: boolean;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const PROGRESS_STEPS = ['Assigned', 'Picked Up', 'In Transit'] as const;

const isSegmentFilled = (segmentIndex: number, status: string): boolean => {
  switch (segmentIndex) {
    case 0: return ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(status);
    case 1: return ['picked_up', 'in_transit', 'out_for_delivery'].includes(status);
    case 2: return ['in_transit', 'out_for_delivery'].includes(status);
    default: return false;
  }
};

// ─── Payment Badge ────────────────────────────────────────────────────────────

const getPaymentBadge = (paymentStatus: string) => {
  const s = (paymentStatus ?? '').toLowerCase();
  if (s === 'paid') return { label: 'Paid', color: DELIVERY_COLORS.success, bg: DELIVERY_COLORS.successBg };
  if (s === 'awaiting_upi_approval') return { label: 'Awaiting UPI Approval', color: DELIVERY_COLORS.warning, bg: DELIVERY_COLORS.warningBg };
  return { label: 'Pending', color: DELIVERY_COLORS.textSecondary, bg: DELIVERY_COLORS.cardElevated };
};

// ─── Navigation ───────────────────────────────────────────────────────────────

const validCoords = (lat?: number, lng?: number): boolean => {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
};

const openNavigation = (order: Order) => {
  const lat = order.address?.lat;
  const lng = order.address?.lng;
  if (validCoords(lat, lng)) {
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  } else {
    Alert.alert('Error', 'Location not available for this order');
  }
};

// ─── Syncing Skeleton ─────────────────────────────────────────────────────────

/**
 * Shown when allowedActions is absent from the server response.
 * Fix #23: 10s timeout → Refresh button.
 * Fix 3: after GIVE_UP_RETRIES refreshes, shows stronger message.
 * Fix 5: shows elapsed time to reduce driver anxiety ("Still syncing… 12s").
 */
const SYNCING_TIMEOUT_MS = 10_000;
const GIVE_UP_RETRIES    = 2;

const SyncingSkeleton: React.FC<{ onRefetch?: () => void }> = ({ onRefetch }) => {
  const [timedOut, setTimedOut]       = React.useState(false);
  const [retryCount, setRetryCount]   = React.useState(0);
  const [elapsedSec, setElapsedSec]   = React.useState(0);
  const startTimeRef                  = React.useRef(Date.now());

  // Tick elapsed seconds while waiting
  React.useEffect(() => {
    const ticker = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1_000);
    return () => clearInterval(ticker);
  }, []);

  // Timeout timer — re-armed on each retry
  React.useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), SYNCING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [retryCount]); // re-run when retryCount changes (retry re-arms timer)

  const handleRetry = React.useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    setTimedOut(false);
    setRetryCount(c => c + 1);
    onRefetch?.();
  }, [onRefetch]);

  if (timedOut) {
    const isGivenUp = retryCount >= GIVE_UP_RETRIES;
    return (
      <View style={styles.syncingContainer}>
        <Ionicons
          name={isGivenUp ? 'alert-circle-outline' : 'warning-outline'}
          size={16}
          color={isGivenUp ? DELIVERY_COLORS.danger : DELIVERY_COLORS.warning}
        />
        <Text style={styles.syncingText}>
          {isGivenUp
            ? "Something's wrong. Pull to refresh or restart the app."
            : 'Actions unavailable'}
        </Text>
        {!isGivenUp && onRefetch && (
          <TouchableOpacity
            onPress={handleRetry}
            style={styles.syncingRefreshBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={14} color={DELIVERY_COLORS.primary} />
            <Text style={styles.syncingRefreshText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.syncingContainer}>
      <ActivityIndicator size="small" color={DELIVERY_COLORS.primary} />
      {/* Fix 5 — show elapsed time to reduce driver anxiety */}
      <Text style={styles.syncingText}>
        {elapsedSec > 0 ? `Still syncing… (${elapsedSec}s)` : 'Syncing state…'}
      </Text>
    </View>
  );
};

// ─── Single Order Card ────────────────────────────────────────────────────────

const SingleOrderCard: React.FC<SingleOrderCardProps> = ({
  order,
  deliveryAttempted,
  codCollectionByOrderId,
  otpInputs,
  onOtpChange,
  onPickup,
  onStartDelivery,
  onMarkArrived,
  onStartDeliveryAttempt,
  onResendOtp,
  onVerifyOtp,
  onCollectCOD,
  onFailDelivery,
  onRefetch,
  isLocked = false,
  isCurrent = false,
  stopIndex,
  totalStops,
  driverLocation,
  getAttemptState,
  isOrderRetryLocked,
  getOrderRemainingSeconds,
  isOffline = false,
}) => {
  const status = (order.orderStatus ?? '').toLowerCase();
  const isCod = order.paymentMethod?.toLowerCase() === 'cod';
  const codCollection = codCollectionByOrderId[order._id];
  // Derive from server-side deliveryOtpGeneratedAt as fallback — prevents "Start Delivery Attempt"
  // reappearing after screen remount when OTP is already in-flight
  const isDeliveryAttempted = deliveryAttempted[order._id] ?? !!order.deliveryOtpGeneratedAt;
  const isCancelled = status === 'cancelled';

  // Web-aligned flow gates (EnhancedHomeTab.tsx)
  const flow = getDeliveryFlowState(order, codCollection, isDeliveryAttempted);

  // ── Removed auto-refetch timer - rely on socket events for real-time updates ──

  // ── Failure reason modal state ────────────────────────────────────────────
  const [failModalVisible, setFailModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<FailureReasonKey | ''>('');
  const [failNotes, setFailNotes] = useState('');

  // ── OTP verification state (Task 9.3) ─────────────────────────────────────
  // Tracks whether OTP was submitted offline (queued) or verified/incorrect
  const [otpStatus, setOtpStatus] = useState<
    'idle' | 'verified' | 'incorrect' | 'queued'
  >('idle');
  // Auto-submit ref to prevent double-submission
  const otpSubmittedRef = useRef(false);

  // ── COD confirmation state (Task 9.2) ─────────────────────────────────────
  // Tracks whether COD confirmation modal is visible
  const [codConfirmVisible, setCodConfirmVisible] = useState(false);
  const [pendingCodMode, setPendingCodMode] = useState<'CASH' | 'UPI' | null>(null);
  const [codStatus, setCodStatus] = useState<'idle' | 'collected' | 'queued'>('idle');

  // ── Attempt state + countdown timer (Task 8.1) ────────────────────────────
  const attemptState = getAttemptState?.(order._id) ?? null;
  const isRetryLocked = isOrderRetryLocked?.(order._id) ?? false;
  const attemptCount = attemptState?.attemptCount ?? 0;

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!isRetryLocked) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, DELIVERY_CONFIG.COUNTDOWN_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [isRetryLocked]);

  const remainingSeconds = isRetryLocked && attemptState
    ? Math.max(0, Math.ceil((attemptState.retryAvailableAt - currentTime) / 1000))
    : 0;

  const handleOpenFailModal = () => {
    setSelectedReason('');
    setFailNotes('');
    setFailModalVisible(true);
  };

  const handleConfirmFail = () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a cancellation reason');
      return;
    }
    setFailModalVisible(false);
    onFailDelivery(order._id, selectedReason, failNotes.trim() || undefined);
  };

  const statusConfig = getStatusConfig(status);
  const paymentBadge = getPaymentBadge(order.paymentStatus ?? '');

  // ── Distance + ETA from driver to this stop ───────────────────────────────
  const { distanceKm, formattedDistance, formattedEta } = useDistanceEta({
    driverLocation,
    address: order.address,
  });

  // ── Progress Bar ─────────────────────────────────────────────────────────
  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressRow}>
        {PROGRESS_STEPS.map((label, i) => {
          const filled = isSegmentFilled(i, status);
          return (
            <React.Fragment key={label}>
              <View style={styles.progressStepWrapper}>
                <View style={[styles.progressDot, filled && styles.progressDotFilled]}>
                  <Ionicons
                    name={filled ? 'checkmark' : 'ellipse-outline'}
                    size={12}
                    color={filled ? DELIVERY_COLORS.white : DELIVERY_COLORS.textMuted}
                  />
                </View>
                <Text style={[styles.progressLabel, filled && styles.progressLabelFilled]}>
                  {label}
                </Text>
              </View>
              {i < PROGRESS_STEPS.length - 1 && (
                <View style={[styles.progressLine, filled && styles.progressLineFilled]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );

  // ── Customer Info ─────────────────────────────────────────────────────────
  const customerPhone = order.userId?.phone?.trim() ?? '';
  const customerDisplayName = getCustomerDisplayName(order.userId?.name, customerPhone);

  const renderCustomerInfo = () => (
    <View style={styles.customerRow}>
      <View style={styles.customerDetails}>
        <Text style={styles.customerName}>{customerDisplayName}</Text>
        {customerPhone ? (
          <TouchableOpacity
            style={styles.phoneRow}
            onPress={() => Linking.openURL(`tel:${customerPhone}`)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Call customer at ${customerPhone}`}
          >
            <Ionicons name="call-outline" size={14} color={DELIVERY_COLORS.primary} />
            <Text style={styles.customerPhone}>{customerPhone}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.addressText} numberOfLines={3}>
          {[order.address?.addressLine, order.address?.city, order.address?.pincode]
            .filter(Boolean)
            .join(', ')}
        </Text>
      </View>
      {customerPhone ? (
        <TouchableOpacity
          style={styles.callFab}
          onPress={() => Linking.openURL(`tel:${customerPhone}`)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Call customer"
        >
          <Ionicons name="call" size={20} color={DELIVERY_COLORS.white} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // ── COD Section ───────────────────────────────────────────────────────────
  // Same gates as web: COD after arrival, before OTP
  const renderCodSection = () => {
    if (flow.showCodCollectedBanner && codCollection) {
      return (
        <View style={styles.codCollectedBanner}>
          <Ionicons name="checkmark-circle" size={20} color={DELIVERY_COLORS.success} />
          <Text style={styles.codCollectedText}>
            Payment Collected ({codCollection.mode === 'CASH' ? 'Cash' : 'UPI'})
          </Text>
        </View>
      );
    }

    if (!flow.showCodCollect) {
      return null;
    }

    // ── Offline queued state ───────────────────────────────────────────────
    if (codStatus === 'queued') {
      return (
        <View style={styles.codQueuedBanner}>
          <Ionicons name="cloud-upload-outline" size={20} color={DELIVERY_COLORS.warning} />
          <Text style={styles.codQueuedText}>
            Payment recorded — will confirm when back online
          </Text>
        </View>
      );
    }

    // ── Already collected (local confirmation) ────────────────────────────
    if (codStatus === 'collected') {
      return (
        <View style={styles.codCollectedBanner}>
          <Ionicons name="checkmark-circle" size={20} color={DELIVERY_COLORS.success} />
          <Text style={styles.codCollectedText}>Payment Collected</Text>
        </View>
      );
    }

    // ── COD collection prompt ─────────────────────────────────────────────
    return (
      <>
        <View style={styles.codBanner}>
          <View style={styles.codBannerHeader}>
            <Ionicons name="warning" size={18} color={DELIVERY_COLORS.warning} />
            <Text style={styles.codBannerTitle}>Collect Payment Before Delivery</Text>
          </View>
          {/* 24sp bold COD amount — Requirement 9.5 */}
          <Text style={styles.codAmountLarge}>
            Collect ₹{order.totalAmount.toLocaleString('en-IN')}
          </Text>
          <View style={styles.codBtnRow}>
            <TouchableOpacity
              style={[styles.codMethodBtn, styles.codCashBtn]}
              onPress={() => {
                setPendingCodMode('CASH');
                setCodConfirmVisible(true);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Collect cash payment of ₹${order.totalAmount.toLocaleString('en-IN')}`}
            >
              <Ionicons name="cash" size={18} color={DELIVERY_COLORS.success} />
              <Text style={styles.codMethodText}>Collect Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.codMethodBtn, styles.codUpiBtn]}
              onPress={() => {
                setPendingCodMode('UPI');
                setCodConfirmVisible(true);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Collect UPI payment of ₹${order.totalAmount.toLocaleString('en-IN')}`}
            >
              <Ionicons name="phone-portrait" size={18} color={DELIVERY_COLORS.info} />
              <Text style={styles.codMethodText}>Collect UPI</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* COD Confirmation Modal — Requirement 9.2 */}
        <Modal visible={codConfirmVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirm Payment Collection</Text>
              <Text style={styles.codConfirmSubtitle}>
                {pendingCodMode === 'CASH' ? 'Cash' : 'UPI'} payment from customer
              </Text>
              {/* Large amount display — Requirement 9.5 */}
              <Text style={styles.codConfirmAmount}>
                ₹{order.totalAmount.toLocaleString('en-IN')}
              </Text>
              {isOffline && (
                <View style={styles.codOfflineNote}>
                  <Ionicons name="cloud-upload-outline" size={14} color={DELIVERY_COLORS.warning} />
                  <Text style={styles.codOfflineNoteText}>
                    You are offline — payment will be confirmed when you reconnect
                  </Text>
                </View>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setCodConfirmVisible(false);
                    setPendingCodMode(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel payment collection"
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.codConfirmBtn}
                  onPress={async () => {
                    if (!pendingCodMode) return;
                    setCodConfirmVisible(false);
                    // Haptic feedback for critical action — Requirement 15.6
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    if (isOffline) {
                      // Offline — queue for later sync (Requirement 9.6)
                      setCodStatus('queued');
                      onCollectCOD(order._id, pendingCodMode);
                    } else {
                      // Online — collect immediately
                      onCollectCOD(order._id, pendingCodMode);
                      setCodStatus('collected');
                    }
                    setPendingCodMode(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm payment collection"
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.codConfirmBtnText}>Confirm Collection</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  };

  // ── OTP Section ───────────────────────────────────────────────────────────
  const renderOtpSection = () => {
    if (!flow.showOtpInput) return null;
    const otpValue = otpInputs[order._id] ?? '';
    const isComplete = otpValue.length === 4;

    // ── OTP Queued (offline) state — Requirement 10.5, 10.7 ──────────────
    if (otpStatus === 'queued') {
      return (
        <View style={styles.otpContainer}>
          <View style={styles.otpStatusBanner}>
            <Ionicons name="cloud-upload-outline" size={18} color={DELIVERY_COLORS.warning} />
            <Text style={styles.otpQueuedText}>
              OTP submitted — will verify when back online
            </Text>
          </View>
        </View>
      );
    }

    // ── OTP Verified state — Requirement 10.3 ────────────────────────────
    if (otpStatus === 'verified') {
      return (
        <View style={styles.otpContainer}>
          <View style={styles.otpStatusBanner}>
            <Ionicons name="checkmark-circle" size={18} color={DELIVERY_COLORS.success} />
            <Text style={styles.otpVerifiedText}>OTP Verified</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.otpContainer}>
        <Text style={styles.otpTitle}>Enter OTP</Text>

        {/* Incorrect OTP feedback — Requirement 10.4 */}
        {otpStatus === 'incorrect' && (
          <View style={styles.otpErrorBanner}>
            <Ionicons name="close-circle" size={16} color={DELIVERY_COLORS.danger} />
            <Text style={styles.otpErrorText}>Incorrect OTP — try again</Text>
          </View>
        )}

        {/* Numeric keyboard, 4-digit input — Requirement 10.6 */}
        <TextInput
          style={[
            styles.otpInput,
            otpStatus === 'incorrect' && styles.otpInputError,
          ]}
          value={otpValue}
          onChangeText={async (val) => {
            const digits = val.replace(/\D/g, '');
            onOtpChange(order._id, digits);
            // Reset error state when user starts typing again
            if (otpStatus === 'incorrect') setOtpStatus('idle');
            // Auto-submit when 4 digits entered — Requirement 10.2
            if (digits.length === 4 && !otpSubmittedRef.current) {
              otpSubmittedRef.current = true;
              // Haptic feedback — Requirement 15.6
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              if (isOffline) {
                // Offline — queue for later sync — Requirement 10.7
                setOtpStatus('queued');
                onVerifyOtp(order._id, digits);
              } else {
                // Online — submit immediately and await for inline feedback
                try {
                  await onVerifyOtp(order._id, digits);
                  setOtpStatus('verified');
                } catch {
                  setOtpStatus('incorrect');
                } finally {
                  // Reset ref after a short delay to allow re-entry if needed
                  setTimeout(() => { otpSubmittedRef.current = false; }, 1000);
                }
              }
            }
          }}
          keyboardType="numeric"
          maxLength={4}
          placeholder="_ _ _ _"
          placeholderTextColor={DELIVERY_COLORS.textMuted}
          textAlign="center"
          accessibilityLabel="Enter 4-digit OTP"
          accessibilityHint="OTP will be submitted automatically when 4 digits are entered"
        />

        {/* Resend OTP link */}
        <TouchableOpacity
          onPress={() => onResendOtp(order._id)}
          style={styles.resendOtpButton}
          disabled={isOffline}
        >
          <Text style={styles.resendOtpText}>Resend OTP</Text>
        </TouchableOpacity>

        {isOffline && (
          <Text style={styles.otpOfflineHint}>
            Offline — OTP will be verified when you reconnect
          </Text>
        )}
      </View>
    );
  };

  // ── Action Buttons (web EnhancedHomeTab flow) ─────────────────────────────
  const renderActionButtons = (phase: 'primary' | 'completion' | 'all' = 'all') => {
    if (flow.isCancelled) return null;

    const showPrimary = phase === 'primary' || phase === 'all';
    const showCompletion = phase === 'completion' || phase === 'all';

    return (
      <View style={styles.actionsContainer}>
        {showPrimary && flow.showUnassignedWarning && (
          <View style={styles.unassignedBanner}>
            <Ionicons name="time-outline" size={18} color={DELIVERY_COLORS.warning} />
            <View style={styles.unassignedTextWrap}>
              <Text style={styles.unassignedTitle}>Order not yet assigned to you</Text>
              <Text style={styles.unassignedSubtitle}>Waiting for assignment…</Text>
            </View>
          </View>
        )}

        {showPrimary && flow.showPickup && (
          <TouchableOpacity
            style={[styles.primaryBtn, isLocked && styles.primaryBtnDisabled]}
            onPress={() => {
              if (isLocked) return;
              onPickup(order._id);
            }}
            activeOpacity={isLocked ? 1 : 0.85}
            disabled={isLocked}
            accessibilityRole="button"
            accessibilityLabel="Mark as picked up"
          >
            <Ionicons name="cube" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Mark as Picked Up</Text>
          </TouchableOpacity>
        )}

        {showPrimary && flow.showStartDelivery && (
          <TouchableOpacity
            style={[styles.primaryBtn, isLocked && styles.primaryBtnDisabled]}
            onPress={() => {
              if (isLocked) return;
              onStartDelivery(order._id);
            }}
            activeOpacity={isLocked ? 1 : 0.85}
            disabled={isLocked}
            accessibilityRole="button"
            accessibilityLabel="Start delivery"
          >
            <Ionicons name="navigate" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Start Delivery</Text>
          </TouchableOpacity>
        )}

        {showPrimary && flow.showMarkArrived && (
          <TouchableOpacity
            style={[styles.primaryBtn, isLocked && styles.primaryBtnDisabled]}
            onPress={() => {
              if (isLocked) return;
              onMarkArrived(order._id);
            }}
            activeOpacity={isLocked ? 1 : 0.85}
            disabled={isLocked}
            accessibilityRole="button"
            accessibilityLabel="Mark as arrived"
          >
            <Ionicons name="location" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Mark as Arrived</Text>
          </TouchableOpacity>
        )}

        {showCompletion && flow.showStartDeliveryAttempt && (
          <TouchableOpacity
            style={[styles.primaryBtn, isLocked && styles.primaryBtnDisabled]}
            onPress={() => {
              if (isLocked) return;
              onStartDeliveryAttempt(order._id);
            }}
            activeOpacity={isLocked ? 1 : 0.85}
            disabled={isLocked}
            accessibilityRole="button"
            accessibilityLabel="Start delivery attempt"
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Start Delivery Attempt</Text>
          </TouchableOpacity>
        )}

        {showCompletion && !isLocked && renderOtpSection()}

        {showCompletion && flow.showCancelDelivery && !isLocked && (
          <TouchableOpacity
            style={styles.failBtn}
            onPress={handleOpenFailModal}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Customer not available"
          >
            <Ionicons name="close-circle" size={20} color="#FFFFFF" />
            <Text style={styles.failBtnText}>Customer Not Available</Text>
          </TouchableOpacity>
        )}

        {showCompletion && flow.showNavigate && validCoords(order.address?.lat, order.address?.lng) && (
          <TouchableOpacity
            style={[styles.navigateBtn, isLocked && styles.navigateBtnDisabled]}
            onPress={() => {
              if (isLocked) return;
              openNavigation(order);
            }}
            activeOpacity={isLocked ? 1 : 0.85}
            disabled={isLocked}
            accessibilityRole="button"
            accessibilityLabel="Navigate to location"
          >
            <Ionicons name="navigate-outline" size={20} color={DELIVERY_COLORS.info} />
            <Text style={styles.navigateBtnText}>Navigate to Location</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Cancellation Summary ──────────────────────────────────────────────────
  const renderCancellationSummary = () => (
    <View style={styles.cancelledBanner}>
      <Ionicons name="close-circle" size={18} color={DELIVERY_COLORS.danger} />
      <View style={styles.cancelledDetails}>
        <Text style={styles.cancelledTitle}>Order Cancelled</Text>
        {order.cancelReason ? <Text style={styles.cancelledReason}>{order.cancelReason}</Text> : null}
      </View>
    </View>
  );

  const showRetryPanel = attemptCount > 0;

  return (
    <View>
      {showRetryPanel && (
        <RetryLockExplanation
          orderId={order._id}
          attemptCount={attemptCount}
          remainingSeconds={remainingSeconds}
          isLocked={isRetryLocked}
          onRetry={handleOpenFailModal}
        />
      )}
      <View pointerEvents={(isLocked || isRetryLocked) ? 'none' : 'auto'}>
      <View style={[
        styles.card,
        isCurrent && styles.cardCurrent,
        isLocked && styles.cardLocked,
        isRetryLocked && styles.cardRetryLocked,
      ]}>
        {/* CURRENT indicator strip */}
        {isCurrent && !isLocked && (
          <View style={styles.currentStrip}>
            <Ionicons name="navigate-circle" size={14} color={DELIVERY_COLORS.white} />
            <Text style={styles.currentStripText}>
              DELIVERING NOW
              {stopIndex != null && totalStops != null
                ? `  ·  Stop ${stopIndex} of ${totalStops}`
                : ''}
            </Text>
            {distanceKm !== null && formattedDistance && formattedEta && (
              <Text style={styles.currentStripEta}>
                {formattedDistance} · {formattedEta}
              </Text>
            )}
          </View>
        )}

      {/* NEXT indicator strip */}
      {!isCurrent && !isLocked && stopIndex != null && stopIndex === 2 && (
        <View style={styles.nextStrip}>
          <Ionicons name="arrow-forward-circle" size={13} color={DELIVERY_COLORS.warning} />
          <Text style={styles.nextStripText}>UP NEXT</Text>
          {distanceKm !== null && formattedDistance && (
            <Text style={styles.nextStripDist}>{formattedDistance}</Text>
          )}
        </View>
      )}

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.orderIdRow}>
          <Text style={[styles.orderId, isLocked && styles.orderIdLocked]}>
            Order #{order._id.slice(-6).toUpperCase()}
          </Text>
          {isCurrent && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>CURRENT</Text>
            </View>
          )}
          {isLocked && (
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={12} color={DELIVERY_COLORS.textMuted} />
              <Text style={styles.lockedBadgeText}>
                {stopIndex != null ? `STOP ${stopIndex}` : 'LOCKED'}
              </Text>
            </View>
          )}
          {attemptCount > 0 && (
            <AttemptBadge
              attemptCount={attemptCount}
              maxAttempts={DELIVERY_CONFIG.MAX_DELIVERY_ATTEMPTS}
              isRetryLocked={isRetryLocked}
              remainingSeconds={remainingSeconds}
            />
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
      </View>

      {/* Amount + Payment */}
      <View style={styles.amountRow}>
        <Text style={styles.orderAmount}>
          ₹{(order.totalAmount ?? 0).toLocaleString('en-IN')}
        </Text>
        <View style={styles.paymentBadgesRow}>
          <View style={[styles.paymentBadge, { backgroundColor: paymentBadge.bg }]}>
            <Text style={[styles.paymentBadgeText, { color: paymentBadge.color }]}>{paymentBadge.label}</Text>
          </View>
          <View style={styles.paymentMethodBadge}>
            <Text style={styles.paymentMethodText}>{isCod ? 'COD' : 'Prepaid'}</Text>
          </View>
        </View>
      </View>

      {/* Web order: pickup → start → mark arrived → COD → OTP → cancel → navigate */}
      {/* Hard guard: never render action buttons when order is delivered — prevents stale cache ghost buttons */}
      {!isCancelled && !flow.isDelivered && isCurrent && renderActionButtons('primary')}

      {renderProgressBar()}
      {renderCustomerInfo()}
      {!flow.isDelivered && renderCodSection()}

      {!isCancelled && !flow.isDelivered && isCurrent && renderActionButtons('completion')}

      {isCancelled ? renderCancellationSummary() : !isCurrent && !flow.isDelivered && renderActionButtons('all')}

      {/* Failure Reason Modal */}
      <Modal visible={failModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Failure Reason</Text>
            {FAILURE_REASONS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.reasonOption, selectedReason === key && styles.reasonOptionSelected]}
                onPress={() => setSelectedReason(key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.reasonText, selectedReason === key && styles.reasonTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.notesInput}
              value={failNotes}
              onChangeText={setFailNotes}
              placeholder="Additional notes (optional)"
              placeholderTextColor={DELIVERY_COLORS.textMuted}
              maxLength={200}
              multiline
            />
            {attemptCount === DELIVERY_CONFIG.MAX_DELIVERY_ATTEMPTS - 1 && (
              <View style={styles.finalAttemptWarning}>
                <Ionicons name="warning" size={16} color={DELIVERY_COLORS.danger} />
                <Text style={styles.finalAttemptWarningText}>
                  This is your final attempt. Confirming will escalate this order for reassignment.
                </Text>
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setFailModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !selectedReason && styles.modalConfirmBtnDisabled]}
                onPress={handleConfirmFail}
                disabled={!selectedReason}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  </View>
</View>
  );
};

// ─── Main Export ──────────────────────────────────────────────────────────────

export const ActiveOrderCard: React.FC<ActiveOrderCardProps> = ({ 
  activeOrders, 
  canArrangeRoute = false,
  isArranging = false,
  isArranged = false,
  onArrangeRoute,
  onResetRoute,
  isOrderLocked,
  isOrderCurrent,
  sortedOrderIds = [],
  driverLocation,
  ...props 
}) => {
  // Sort orders if route is arranged
  const displayOrders = isArranged && sortedOrderIds.length > 0
    ? sortedOrderIds
        .map(id => activeOrders.find(o => o._id === id))
        .filter((o): o is Order => o !== undefined)
    : activeOrders;

  const totalStops = displayOrders.length;
  const currentIndex = displayOrders.findIndex(o => isOrderCurrent?.(o._id));
  const completedCount = currentIndex >= 0 ? currentIndex : 0;
  const remainingCount = totalStops - completedCount;

  // Derive offline status for child cards (Task 9.1, 9.2, 9.3)
  const { isOnline } = useNetworkStatus();
  const isOffline = !isOnline;

  return (
    <View>
      {/* Arrange Route Button */}
      {canArrangeRoute && (
        <View style={styles.arrangeRouteContainer}>
          {!isArranged ? (
            <TouchableOpacity 
              style={[styles.arrangeRouteBtn, isArranging && styles.arrangeRouteBtnDisabled]} 
              onPress={onArrangeRoute}
              disabled={isArranging}
              activeOpacity={0.85}
            >
              <Ionicons name="map" size={18} color={DELIVERY_COLORS.white} />
              <Text style={styles.arrangeRouteBtnText}>
                {isArranging ? 'Arranging Route...' : 'Arrange Route by Distance'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.arrangeRouteActiveRow}>
              <View style={styles.arrangeRouteActiveBadge}>
                <Ionicons name="checkmark-circle" size={16} color={DELIVERY_COLORS.success} />
                <Text style={styles.arrangeRouteActiveText}>Route Arranged</Text>
              </View>
              <TouchableOpacity 
                style={styles.resetRouteBtn}
                onPress={onResetRoute}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={14} color={DELIVERY_COLORS.textSecondary} />
                <Text style={styles.resetRouteBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Route Progress Header — shown when route is arranged */}
      {isArranged && totalStops > 0 && (
        <RouteProgressHeader
          completedCount={completedCount}
          remainingCount={remainingCount}
          totalStops={totalStops}
          orders={displayOrders}
          isOrderCurrent={isOrderCurrent ?? (() => false)}
          currentIndex={currentIndex}
        />
      )}

      {/* Order Cards */}
      {displayOrders.map((order, index) => (
        <SingleOrderCard 
          key={order._id} 
          order={order} 
          isLocked={isOrderLocked?.(order._id) ?? false}
          isCurrent={
            isOrderCurrent?.(order._id) ??
            (!isArranged && displayOrders.length === 1)
          }
          stopIndex={isArranged ? index + 1 : undefined}
          totalStops={isArranged ? totalStops : undefined}
          driverLocation={driverLocation}
          isOffline={isOffline}
          {...props} 
        />
      ))}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  arrangeRouteContainer: {
    paddingHorizontal: DELIVERY_SPACING.lg,
    paddingVertical: DELIVERY_SPACING.sm,
  },
  arrangeRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.info,
    borderRadius: DELIVERY_RADIUS.md,
    paddingVertical: DELIVERY_SPACING.md,
    borderWidth: 2,
    borderColor: DELIVERY_COLORS.info,
  },
  arrangeRouteBtnDisabled: {
    backgroundColor: DELIVERY_COLORS.border,
    borderColor: DELIVERY_COLORS.border,
  },
  arrangeRouteBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  arrangeRouteActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DELIVERY_COLORS.successBg,
    borderRadius: DELIVERY_RADIUS.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.success,
    paddingHorizontal: DELIVERY_SPACING.md,
    paddingVertical: DELIVERY_SPACING.sm,
  },
  arrangeRouteActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
  },
  arrangeRouteActiveText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.success,
    fontWeight: '700',
  },
  resetRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.border,
    backgroundColor: DELIVERY_COLORS.card,
  },
  resetRouteBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '600',
  },
  // ── Card variants ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: DELIVERY_RADIUS.lg,
    padding: DELIVERY_SPACING.lg,
    marginHorizontal: DELIVERY_SPACING.lg, // 16dp edge padding — Requirement 5.6
    marginVertical: DELIVERY_SPACING.sm,
    ...DELIVERY_SHADOW.card,
  },
  cardCurrent: {
    borderWidth: 2,
    borderColor: DELIVERY_COLORS.primary,
    ...DELIVERY_SHADOW.elevated,
  },
  cardLocked: {
    opacity: 0.55,
  },
  cardRetryLocked: {
    opacity: 0.6,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.warning,
  },
  // ── CURRENT strip ──────────────────────────────────────────────────────────
  currentStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: DELIVERY_COLORS.primary,
    borderRadius: DELIVERY_RADIUS.sm,
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    marginBottom: DELIVERY_SPACING.sm,
    flexWrap: 'wrap',
  },
  currentStripText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.white,
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
  },
  currentStripEta: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  // ── NEXT strip ─────────────────────────────────────────────────────────────
  nextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: DELIVERY_COLORS.warningBg,
    borderRadius: DELIVERY_RADIUS.sm,
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    marginBottom: DELIVERY_SPACING.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.warning,
  },
  nextStripText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.warning,
    fontWeight: '700',
    flex: 1,
  },
  nextStripDist: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.warning,
    fontWeight: '600',
  },
  orderIdLocked: {
    color: DELIVERY_COLORS.textMuted,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DELIVERY_SPACING.sm,
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    flex: 1,
  },
  orderId: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '600',
  },
  currentBadge: {
    paddingHorizontal: DELIVERY_SPACING.xs,
    paddingVertical: 2,
    borderRadius: DELIVERY_RADIUS.sm,
    backgroundColor: DELIVERY_COLORS.success,
  },
  currentBadgeText: {
    fontSize: 10,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: DELIVERY_SPACING.xs,
    paddingVertical: 2,
    borderRadius: DELIVERY_RADIUS.sm,
    backgroundColor: DELIVERY_COLORS.cardElevated,
  },
  lockedBadgeText: {
    fontSize: 10,
    color: DELIVERY_COLORS.textMuted,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.full,
  },
  statusBadgeText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DELIVERY_SPACING.md,
  },
  orderAmount: {
    fontSize: DELIVERY_TYPOGRAPHY.md,
    color: DELIVERY_COLORS.earnings,
    fontWeight: '700',
  },
  paymentBadgesRow: {
    flexDirection: 'row',
    gap: DELIVERY_SPACING.xs,
    alignItems: 'center',
  },
  paymentBadge: {
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.full,
  },
  paymentBadgeText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    fontWeight: '600',
  },
  paymentMethodBadge: {
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.full,
    backgroundColor: DELIVERY_COLORS.cardElevated,
  },
  paymentMethodText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: DELIVERY_SPACING.lg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressStepWrapper: {
    alignItems: 'center',
    width: 64,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: DELIVERY_RADIUS.full,
    backgroundColor: DELIVERY_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DELIVERY_SPACING.xs,
  },
  progressDotFilled: {
    backgroundColor: DELIVERY_COLORS.success,
  },
  progressLabel: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textMuted,
    textAlign: 'center',
  },
  progressLabelFilled: {
    color: DELIVERY_COLORS.success,
    fontWeight: '600',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: DELIVERY_COLORS.border,
    marginTop: 13,
    marginHorizontal: -4,
  },
  progressLineFilled: {
    backgroundColor: DELIVERY_COLORS.success,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: DELIVERY_COLORS.cardElevated,
    borderRadius: DELIVERY_RADIUS.md,
    padding: DELIVERY_SPACING.md,
    marginBottom: DELIVERY_SPACING.md,
    gap: DELIVERY_SPACING.sm,
  },
  customerDetails: {
    flex: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    marginTop: DELIVERY_SPACING.xs,
    marginBottom: DELIVERY_SPACING.xs,
  },
  callFab: {
    width: 44,
    height: 44,
    borderRadius: DELIVERY_RADIUS.full,
    backgroundColor: DELIVERY_COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  customerName: {
    fontSize: DELIVERY_TYPOGRAPHY.base,   // 16sp minimum — Requirement 5.3
    lineHeight: 20,
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '700',
  },
  customerPhone: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.primary,
    fontWeight: '600',
  },
  addressText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,   // 16sp minimum — Requirement 5.3
    color: DELIVERY_COLORS.textSecondary,
    lineHeight: 20,
  },
  codBanner: {
    backgroundColor: DELIVERY_COLORS.warningBg,
    borderRadius: DELIVERY_RADIUS.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.warning,
    padding: DELIVERY_SPACING.md,
    marginBottom: DELIVERY_SPACING.md,
  },
  codBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    marginBottom: DELIVERY_SPACING.xs,
  },
  codBannerTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.base,  // 16sp — Requirement 5.3
    color: DELIVERY_COLORS.warning,
    fontWeight: '700',
  },
  // 24sp bold COD amount — Requirement 9.5
  codAmountLarge: {
    fontSize: DELIVERY_TYPOGRAPHY.xl,   // 24sp
    lineHeight: 28,
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
    marginBottom: DELIVERY_SPACING.md,
    textAlign: 'center',
  },
  // Legacy codAmount kept for backward compat
  codAmount: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: DELIVERY_SPACING.md,
  },
  codBtnRow: {
    flexDirection: 'row',
    gap: DELIVERY_SPACING.sm,
  },
  codMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.xs,
    paddingVertical: DELIVERY_SPACING.sm,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1.5,
    minHeight: 48,  // 48dp minimum — Requirement 5.1
  },
  codCashBtn: {
    borderColor: DELIVERY_COLORS.success,
    backgroundColor: DELIVERY_COLORS.successBg,
  },
  codUpiBtn: {
    borderColor: DELIVERY_COLORS.info,
    backgroundColor: DELIVERY_COLORS.card,
  },
  codMethodText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,  // 16sp — Requirement 5.3
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '700',
  },
  codCollectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: DELIVERY_COLORS.successBg,
    borderRadius: DELIVERY_RADIUS.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.success,
    padding: DELIVERY_SPACING.md,
    marginBottom: DELIVERY_SPACING.md,
  },
  codCollectedText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.success,
    fontWeight: '600',
  },
  actionsContainer: {
    gap: DELIVERY_SPACING.sm,
    marginBottom: DELIVERY_SPACING.md,
  },
  unassignedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.warningBg,
    borderRadius: DELIVERY_RADIUS.md,
    padding: DELIVERY_SPACING.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.warning,
  },
  unassignedTextWrap: {
    flex: 1,
  },
  unassignedTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    fontWeight: '700',
    color: DELIVERY_COLORS.warning,
  },
  unassignedSubtitle: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textSecondary,
    marginTop: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.primary,  // Orange primary button
    borderRadius: DELIVERY_RADIUS.md,
    paddingVertical: DELIVERY_SPACING.md,
    minHeight: 48,
    paddingHorizontal: DELIVERY_SPACING.lg,
  },
  primaryBtnDisabled: {
    backgroundColor: DELIVERY_COLORS.border,  // Disabled state
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    lineHeight: 20,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.info,
    borderRadius: DELIVERY_RADIUS.md,
    paddingVertical: DELIVERY_SPACING.md,
    minHeight: 48,          // 48dp minimum — Requirement 5.1
    paddingHorizontal: DELIVERY_SPACING.lg,
    borderWidth: 2,
    borderColor: DELIVERY_COLORS.info,
  },
  navigateBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  navigateBtnDisabled: {
    opacity: 0.6,
    backgroundColor: DELIVERY_COLORS.border,
    borderColor: DELIVERY_COLORS.border,
  },
  failBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.danger,
    borderRadius: DELIVERY_RADIUS.md,
    paddingVertical: DELIVERY_SPACING.md,
    minHeight: 48,
    paddingHorizontal: DELIVERY_SPACING.lg,
  },
  failBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  otpContainer: {
    backgroundColor: DELIVERY_COLORS.cardElevated,
    borderRadius: DELIVERY_RADIUS.md,
    padding: DELIVERY_SPACING.md,
    gap: DELIVERY_SPACING.sm,
  },
  otpTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.base,  // 16sp — Requirement 5.3
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '700',
  },
  otpInput: {
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: DELIVERY_COLORS.border,
    color: DELIVERY_COLORS.textPrimary,
    fontSize: DELIVERY_TYPOGRAPHY.xl,
    fontWeight: '700',
    paddingVertical: DELIVERY_SPACING.sm,
    letterSpacing: 8,
    minHeight: 48,  // 48dp minimum — Requirement 5.1
  },
  otpInputError: {
    borderColor: DELIVERY_COLORS.danger,
    backgroundColor: '#FFF5F5',
  },
  otpStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    paddingVertical: DELIVERY_SPACING.sm,
  },
  otpVerifiedText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.success,
    fontWeight: '700',
  },
  otpQueuedText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.warning,
    fontWeight: '700',
    flex: 1,
  },
  otpErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: '#FFF5F5',
    borderRadius: DELIVERY_RADIUS.sm,
    padding: DELIVERY_SPACING.xs,
  },
  otpErrorText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.danger,
    fontWeight: '600',
    flex: 1,
  },
  otpOfflineHint: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.warning,
    fontWeight: '500',
    textAlign: 'center',
  },
  resendOtpButton: {
    marginTop: DELIVERY_SPACING.xs,
    alignSelf: 'center',
  },
  resendOtpText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Legacy verifyBtn kept for backward compat (no longer rendered but avoids TS errors)
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.success,
    borderRadius: DELIVERY_RADIUS.md,
    paddingVertical: DELIVERY_SPACING.md,
    minHeight: 48,
  },
  verifyBtnDisabled: {
    backgroundColor: DELIVERY_COLORS.border,
  },
  verifyBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  // ── COD Queued / Confirm styles (Task 9.2) ───────────────────────────────
  codQueuedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: '#FEEBC8',
    borderRadius: DELIVERY_RADIUS.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.warning,
    padding: DELIVERY_SPACING.md,
    marginBottom: DELIVERY_SPACING.md,
  },
  codQueuedText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: '#744210',
    fontWeight: '700',
    flex: 1,
  },
  codConfirmSubtitle: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: DELIVERY_SPACING.xs,
  },
  codConfirmAmount: {
    fontSize: DELIVERY_TYPOGRAPHY.xl,   // 24sp — Requirement 9.5
    lineHeight: 28,
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: DELIVERY_SPACING.md,
  },
  codOfflineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: '#FEEBC8',
    borderRadius: DELIVERY_RADIUS.sm,
    padding: DELIVERY_SPACING.sm,
    marginBottom: DELIVERY_SPACING.sm,
  },
  codOfflineNoteText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: '#744210',
    fontWeight: '500',
    flex: 1,
  },
  codConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.xs,
    paddingVertical: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.md,
    borderRadius: DELIVERY_RADIUS.sm,
    backgroundColor: DELIVERY_COLORS.success,
    minHeight: 48,  // 48dp — Requirement 5.1
  },
  codConfirmBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.dangerBg,
    borderRadius: DELIVERY_RADIUS.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.danger,
    padding: DELIVERY_SPACING.md,
  },
  cancelledDetails: {
    flex: 1,
  },
  cancelledTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.danger,
    fontWeight: '700',
    marginBottom: DELIVERY_SPACING.xs,
  },
  cancelledReason: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.md,
    backgroundColor: DELIVERY_COLORS.cardElevated,
    borderRadius: DELIVERY_RADIUS.md,
  },
  syncingText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '500',
  },
  syncingRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: 4,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.primary,
  },
  syncingRefreshText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.primary,
    fontWeight: '600',
  },
  // ── Failure Reason Modal ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DELIVERY_SPACING.lg,
  },
  modalContent: {
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: DELIVERY_RADIUS.lg,
    padding: DELIVERY_SPACING.lg,
    width: '100%',
    gap: DELIVERY_SPACING.sm,
  },
  modalTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: DELIVERY_SPACING.xs,
  },
  reasonOption: {
    paddingVertical: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.md,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: DELIVERY_COLORS.border,
  },
  reasonOptionSelected: {
    borderColor: DELIVERY_COLORS.primary,
    backgroundColor: DELIVERY_COLORS.cardElevated,
  },
  reasonText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '500',
  },
  reasonTextSelected: {
    color: DELIVERY_COLORS.primary,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: DELIVERY_COLORS.cardElevated,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.border,
    color: DELIVERY_COLORS.textPrimary,
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    padding: DELIVERY_SPACING.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: DELIVERY_SPACING.xs,
    gap: DELIVERY_SPACING.sm,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.md,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.border,
  },
  modalCancelText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.md,
    borderRadius: DELIVERY_RADIUS.sm,
    backgroundColor: DELIVERY_COLORS.danger,
  },
  modalConfirmBtnDisabled: {
    backgroundColor: DELIVERY_COLORS.border,
  },
  modalConfirmText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  finalAttemptWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: DELIVERY_COLORS.dangerBg,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.danger,
    padding: DELIVERY_SPACING.sm,
    marginBottom: DELIVERY_SPACING.sm,
  },
  finalAttemptWarningText: {
    flex: 1,
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.danger,
    fontWeight: '600',
  },
});

export default ActiveOrderCard;
