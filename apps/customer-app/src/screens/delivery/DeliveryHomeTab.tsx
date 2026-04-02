import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
  Linking,
  Modal,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { RootState } from '../../store';
import {
  useGetDeliveryOrdersQuery,
  useAcceptOrderMutation,
  useRejectOrderMutation,
  usePickupOrderMutation,
  useStartDeliveryMutation,
  useMarkArrivedMutation,
  useDeliverAttemptMutation,
  useVerifyDeliveryOtpMutation,
  useFailDeliveryMutation,
  useGetCodCollectionQuery,
  useCreateCodCollectionMutation,
  useToggleStatusMutation,
} from '../../api/deliveryApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Order {
  _id: string;
  orderStatus: string;
  deliveryStatus?: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus?: string;
  arrivedAt?: string;
  address: {
    addressLine: string;
    city: string;
    pincode?: string;
    lat?: number;
    lng?: number;
  };
  userId?: {
    name?: string;
    phone?: string;
  };
}

const ACTIVE_STATUSES = ['assigned', 'picked_up', 'in_transit', 'arrived', 'packed', 'out_for_delivery'];

const getStatusBadgeConfig = (status: string) => {
  const s = status.toLowerCase();
  switch (s) {
    case 'assigned':
      return { label: 'Assigned', color: Colors.info, bgColor: '#dbeafe' };
    case 'picked_up':
      return { label: 'Picked Up', color: '#7c3aed', bgColor: '#ede9fe' };
    case 'in_transit':
    case 'out_for_delivery':
      return { label: 'In Transit', color: Colors.warning, bgColor: '#fef3c7' };
    case 'delivered':
      return { label: 'Delivered', color: Colors.success, bgColor: '#dcfce7' };
    case 'cancelled':
      return { label: 'Cancelled', color: Colors.error, bgColor: '#fee2e2' };
    default:
      return { label: status, color: Colors.textSecondary, bgColor: Colors.surface };
  }
};

const DeliveryHomeTab: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [otpInputs, setOtpInputs] = useState<{ [orderId: string]: string }>({});
  const [deliveryAttempted, setDeliveryAttempted] = useState<Set<string>>(new Set());
  const [resendTimers, setResendTimers] = useState<{ [orderId: string]: number }>({});
  const [codModalVisible, setCodModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [codMode, setCodMode] = useState<'CASH' | 'UPI'>('CASH');
  const [upiRef, setUpiRef] = useState('');
  const [failModalVisible, setFailModalVisible] = useState(false);
  const [selectedFailReason, setSelectedFailReason] = useState('');
  const [isOnDuty, setIsOnDuty] = useState(true);

  const { data, isLoading, isFetching, refetch, error } = useGetDeliveryOrdersQuery();
  const [acceptOrder, { isLoading: isAccepting }] = useAcceptOrderMutation();
  const [rejectOrder, { isLoading: isRejecting }] = useRejectOrderMutation();
  const [pickupOrder, { isLoading: isPickingUp }] = usePickupOrderMutation();
  const [startDelivery, { isLoading: isStartingDelivery }] = useStartDeliveryMutation();
  const [markArrived, { isLoading: isMarkingArrived }] = useMarkArrivedMutation();
  const [deliverAttempt, { isLoading: isDeliverAttempting }] = useDeliverAttemptMutation();
  const [verifyDeliveryOtp, { isLoading: isVerifying }] = useVerifyDeliveryOtpMutation();
  const [failDelivery, { isLoading: isFailing }] = useFailDeliveryMutation();
  const [createCodCollection, { isLoading: isCreatingCod }] = useCreateCodCollectionMutation();
  const [toggleStatus, { isLoading: isTogglingStatus }] = useToggleStatusMutation();

  const deliveryBoy = data?.deliveryBoy;
  const orders: Order[] = data?.orders || [];

  const availableOrders = orders.filter(
    (o) => !ACTIVE_STATUSES.includes(o.orderStatus.toLowerCase()) && o.orderStatus.toLowerCase() !== 'delivered' && o.orderStatus.toLowerCase() !== 'cancelled'
  );
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.orderStatus.toLowerCase()));

  const completedCount = deliveryBoy?.completedOrdersCount || 0;
  const pendingCount = activeOrders.length;
  const todayEarnings = deliveryBoy?.earnings || 0;

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleToggleStatus = async () => {
    try {
      const result = await toggleStatus({ isOnline: !isOnDuty }).unwrap();
      setIsOnDuty(result.availability === 'available');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to update status');
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await acceptOrder(orderId).unwrap();
      Alert.alert('Success', 'Order accepted!');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to accept order');
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      await rejectOrder({ orderId }).unwrap();
      Alert.alert('Success', 'Order rejected');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to reject order');
    }
  };

  const handlePickup = async (orderId: string) => {
    try {
      await pickupOrder(orderId).unwrap();
      Alert.alert('Success', 'Order marked as picked up!');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to pickup order');
    }
  };

  const handleStartDelivery = async (orderId: string) => {
    try {
      await startDelivery(orderId).unwrap();
      Alert.alert('Success', 'Delivery started!');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to start delivery');
    }
  };

  const handleMarkArrived = async (orderId: string) => {
    try {
      await markArrived(orderId).unwrap();
      Alert.alert('Success', 'Marked as arrived!');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to mark arrived');
    }
  };

  const handleStartDeliveryAttempt = async (orderId: string) => {
    try {
      await deliverAttempt(orderId).unwrap();
      setDeliveryAttempted((prev) => new Set(prev).add(orderId));
      // Start 30s resend timer
      setResendTimers((prev) => ({ ...prev, [orderId]: 30 }));
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to start delivery attempt');
    }
  };

  const handleVerifyOtp = async (orderId: string) => {
    const otp = otpInputs[orderId];
    if (!otp || otp.length !== 4) {
      Alert.alert('Error', 'Please enter 4-digit OTP');
      return;
    }
    try {
      await verifyDeliveryOtp({ orderId, otp }).unwrap();
      Alert.alert('Success', 'Delivery completed!', [{ text: 'OK', onPress: () => refetch() }]);
      setOtpInputs((prev) => ({ ...prev, [orderId]: '' }));
      setDeliveryAttempted((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Invalid OTP');
    }
  };

  const openCodModal = (orderId: string, mode: 'CASH' | 'UPI') => {
    setSelectedOrderId(orderId);
    setCodMode(mode);
    setUpiRef('');
    setCodModalVisible(true);
  };

  const handleConfirmCod = async () => {
    if (!selectedOrderId) return;
    const idempotencyKey = `cod_collection_idem_${selectedOrderId}`;
    try {
      await createCodCollection({
        orderId: selectedOrderId,
        mode: codMode,
        idempotencyKey,
        upiRef: codMode === 'UPI' ? upiRef : undefined,
      }).unwrap();
      await AsyncStorage.setItem(idempotencyKey, 'true');
      setCodModalVisible(false);
      Alert.alert('Success', 'Payment collected!');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to record payment');
    }
  };

  const openFailModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setSelectedFailReason('');
    setFailModalVisible(true);
  };

  const handleFailDelivery = async () => {
    if (!selectedOrderId || !selectedFailReason) {
      Alert.alert('Error', 'Please select a reason');
      return;
    }
    try {
      await failDelivery({
        orderId: selectedOrderId,
        failureReasonCode: selectedFailReason,
      }).unwrap();
      setFailModalVisible(false);
      Alert.alert('Success', 'Delivery marked as failed');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to mark delivery as failed');
    }
  };

  const openNavigation = (order: Order) => {
    const lat = order.address?.lat;
    const lng = order.address?.lng;
    if (lat && lng) {
      const url = `https://maps.google.com/?q=${lat},${lng}`;
      Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Location not available for this order');
    }
  };

  const callCustomer = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  // Timer effect for resend OTP
  useEffect(() => {
    const interval = setInterval(() => {
      setResendTimers((prev) => {
        const next: { [orderId: string]: number } = {};
        for (const [orderId, timer] of Object.entries(prev)) {
          if (timer > 0) {
            next[orderId] = timer - 1;
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const renderAvailableOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderId}>Order #{String(item._id || '').slice(-6)}</Text>
          <Text style={styles.orderAmount}>₹{item.totalAmount.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      </View>

      <View style={styles.orderInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="person" size={16} color={Colors.info} style={{ marginRight: 8 }} />
          <Text style={styles.infoText}>{item.userId?.name || 'Unknown Customer'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call" size={16} color={Colors.success} style={{ marginRight: 8 }} />
          <Text style={styles.infoText}>{item.userId?.phone || 'No Phone'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location" size={16} color={Colors.error} style={{ marginRight: 8 }} />
          <Text style={styles.infoText}>{item.address?.addressLine}, {item.address?.city}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.acceptBtn, { marginRight: 12 }]}
          onPress={() => handleAcceptOrder(item._id)}
          disabled={isAccepting}
        >
          <Ionicons name="checkmark-circle" size={20} color={Colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => handleRejectOrder(item._id)}
          disabled={isRejecting}
        >
          <Ionicons name="close-circle" size={20} color={Colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActiveOrder = ({ item }: { item: Order }) => {
    const status = item.orderStatus.toLowerCase();
    const isExpanded = expandedOrders.has(item._id);
    const statusConfig = getStatusBadgeConfig(item.orderStatus);
    const isCod = item.paymentMethod?.toLowerCase() === 'cod';
    const hasArrived = !!item.arrivedAt;
    const isDelivered = status === 'delivered';
    const isCancelled = status === 'cancelled';
    const codCollected = false; // Would need to check from codCollection query
    const canSendOtp = !isCancelled && !isDelivered && hasArrived && (!isCod || codCollected);
    const hasDeliveryAttempt = deliveryAttempted.has(item._id);

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity
          style={styles.orderHeader}
          onPress={() => toggleOrderExpansion(item._id)}
          activeOpacity={0.7}
        >
          <View>
            <Text style={styles.orderId}>Order #{String(item._id || '').slice(-6)}</Text>
            <Text style={styles.orderAmount}>₹{item.totalAmount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.orderHeaderRight}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Payment Status */}
        <View style={styles.paymentBadge}>
          <Text style={styles.paymentText}>
            {isCod ? '💵 COD' : '💳 Online'} • {item.paymentStatus || 'Pending'}
          </Text>
        </View>

        {/* COD Collection UI */}
        {isCod && hasArrived && !isDelivered && !isCancelled && !codCollected && (
          <View style={styles.codBanner}>
            <Ionicons name="warning" size={20} color={Colors.warning} />
            <Text style={styles.codBannerText}>Collect Payment Before Delivery</Text>
            <Text style={styles.codAmount}>₹{item.totalAmount.toLocaleString('en-IN')}</Text>
            <View style={styles.codButtons}>
              <TouchableOpacity
                style={[styles.codBtn, { marginRight: 12 }]}
                onPress={() => openCodModal(item._id, 'CASH')}
              >
                <Ionicons name="cash" size={20} color={Colors.success} style={{ marginRight: 6 }} />
                <Text style={styles.codBtnText}>Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.codBtn}
                onPress={() => openCodModal(item._id, 'UPI')}
              >
                <Ionicons name="phone-portrait" size={20} color={Colors.info} style={{ marginRight: 6 }} />
                <Text style={styles.codBtnText}>UPI</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Primary Action Button */}
        {!isCancelled && !isDelivered && (
          <View style={styles.primaryAction}>
            {status === 'assigned' && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => handlePickup(item._id)}
                disabled={isPickingUp}
              >
                {isPickingUp ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Mark as Picked Up</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {(status === 'picked_up' || status === 'packed') && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => handleStartDelivery(item._id)}
                disabled={isStartingDelivery}
              >
                {isStartingDelivery ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="navigate" size={20} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Start Delivery</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {status === 'in_transit' && !hasArrived && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => handleMarkArrived(item._id)}
                disabled={isMarkingArrived}
              >
                {isMarkingArrived ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="location" size={20} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Mark as Arrived</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {status === 'in_transit' && canSendOtp && !hasDeliveryAttempt && (
              <TouchableOpacity
                style={[styles.primaryBtn, styles.successBtn]}
                onPress={() => handleStartDeliveryAttempt(item._id)}
                disabled={isDeliverAttempting}
              >
                {isDeliverAttempting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Start Delivery Attempt</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* OTP Input */}
        {hasDeliveryAttempt && !isDelivered && !isCancelled && (
          <View style={styles.otpSection}>
            <Text style={styles.otpLabel}>Enter 4-digit OTP sent to customer</Text>
            <TextInput
              style={styles.otpInput}
              maxLength={4}
              keyboardType="number-pad"
              placeholder="----"
              value={otpInputs[item._id] || ''}
              onChangeText={(text) =>
                setOtpInputs((prev) => ({ ...prev, [item._id]: text.replace(/\D/g, '') }))
              }
            />
            <TouchableOpacity
              style={[
                styles.verifyBtn,
                (!otpInputs[item._id] || otpInputs[item._id].length !== 4) && styles.verifyBtnDisabled,
              ]}
              onPress={() => handleVerifyOtp(item._id)}
              disabled={!otpInputs[item._id] || otpInputs[item._id].length !== 4 || isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.verifyBtnText}>Verify OTP & Complete</Text>
              )}
            </TouchableOpacity>
            {resendTimers[item._id] > 0 ? (
              <Text style={styles.resendTimer}>Resend in {resendTimers[item._id]}s</Text>
            ) : (
              <TouchableOpacity onPress={() => handleStartDeliveryAttempt(item._id)}>
                <Text style={styles.resendBtn}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Fail Delivery Button */}
        {status === 'in_transit' && hasArrived && !isDelivered && !isCancelled && (
          <TouchableOpacity
            style={styles.failBtn}
            onPress={() => openFailModal(item._id)}
          >
            <Ionicons name="alert-circle" size={18} color={Colors.error} style={{ marginRight: 6 }} />
            <Text style={styles.failBtnText}>Customer Not Available</Text>
          </TouchableOpacity>
        )}

        {/* Expanded Details */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            {/* Progress Bar */}
            <View style={styles.progressBar}>
              <View style={[styles.progressStep, status !== 'assigned' && styles.progressComplete]} />
              <View style={[styles.progressStep, ['picked_up', 'in_transit', 'delivered'].includes(status) && styles.progressComplete]} />
              <View style={[styles.progressStep, ['in_transit', 'delivered'].includes(status) && styles.progressComplete]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>Assigned</Text>
              <Text style={styles.progressLabel}>Picked Up</Text>
              <Text style={styles.progressLabel}>In Transit</Text>
            </View>

            {/* Customer Details */}
            <View style={styles.customerDetails}>
              <View style={styles.infoRow}>
                <Ionicons name="person" size={16} color={Colors.info} style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>{item.userId?.name || 'Unknown'}</Text>
              </View>
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => callCustomer(item.userId?.phone)}
              >
                <Ionicons name="call" size={16} color={Colors.success} style={{ marginRight: 8 }} />
                <Text style={[styles.infoText, styles.phoneLink]}>{item.userId?.phone || 'No Phone'}</Text>
              </TouchableOpacity>
              <View style={styles.infoRow}>
                <Ionicons name="location" size={16} color={Colors.error} style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>
                  {item.address?.addressLine}, {item.address?.city} {item.address?.pincode}
                </Text>
              </View>
            </View>

            {/* Navigate Button */}
            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={() => openNavigation(item)}
            >
              <Ionicons name="map" size={20} color={Colors.info} style={{ marginRight: 8 }} />
              <Text style={styles.navigateBtnText}>Navigate to Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Failed to load orders</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'Partner'}</Text>
          <Text style={styles.subGreeting}>Ready to deliver?</Text>
        </View>
        <View style={styles.dutyToggle}>
          <Text style={[styles.dutyLabel, isOnDuty && styles.dutyLabelActive, { marginRight: 8 }]}>
            {isOnDuty ? 'On Duty' : 'Off Duty'}
          </Text>
          <Switch
            value={isOnDuty}
            onValueChange={handleToggleStatus}
            trackColor={{ false: Colors.border, true: Colors.successLight }}
            thumbColor={isOnDuty ? Colors.success : Colors.surface}
            disabled={isTogglingStatus}
          />
        </View>
      </View>

      {/* Today's Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{completedCount}</Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>₹{todayEarnings}</Text>
          <Text style={styles.summaryLabel}>Earnings</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>⭐ 4.8</Text>
          <Text style={styles.summaryLabel}>Rating</Text>
        </View>
      </View>

      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={
          <>
            {/* Available Orders */}
            {availableOrders.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>New Requests ({availableOrders.length})</Text>
                <FlatList
                  data={availableOrders}
                  renderItem={renderAvailableOrder}
                  keyExtractor={(item) => item._id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Deliveries ({activeOrders.length})</Text>
                <FlatList
                  data={activeOrders}
                  renderItem={renderActiveOrder}
                  keyExtractor={(item) => item._id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {/* Empty State */}
            {availableOrders.length === 0 && activeOrders.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={64} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Active Orders</Text>
                <Text style={styles.emptySubtitle}>
                  {isOnDuty ? 'Stay online to receive delivery requests' : 'Go online to start receiving orders'}
                </Text>
              </View>
            )}
          </>
        }
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[Colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* COD Collection Modal */}
      <Modal visible={codModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Payment</Text>
            <Text style={styles.modalSubtitle}>Mode: {codMode}</Text>
            {codMode === 'UPI' && (
              <TextInput
                style={styles.modalInput}
                placeholder="Enter UPI Reference"
                value={upiRef}
                onChangeText={setUpiRef}
              />
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { marginRight: 12 }]}
                onPress={() => setCodModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmCod}
                disabled={isCreatingCod}
              >
                {isCreatingCod ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fail Delivery Modal */}
      <Modal visible={failModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Delivery</Text>
            <Text style={styles.modalSubtitle}>Select a reason</Text>
            {['CUSTOMER_NOT_AVAILABLE', 'ADDRESS_ISSUE', 'CUSTOMER_REJECTED'].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonOption,
                  selectedFailReason === reason && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedFailReason(reason)}
              >
                <Text
                  style={[
                    styles.reasonText,
                    selectedFailReason === reason && styles.reasonTextSelected,
                  ]}
                >
                  {reason.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { marginRight: 12 }]}
                onPress={() => setFailModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleFailDelivery}
                disabled={!selectedFailReason || isFailing}
              >
                {isFailing ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subGreeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dutyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dutyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  dutyLabelActive: {
    color: Colors.success,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 100,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success,
    marginTop: 4,
  },
  orderHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentBadge: {
    backgroundColor: Colors.background,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  orderInfo: {
    marginTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  phoneLink: {
    color: Colors.info,
    textDecorationLine: 'underline',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  acceptBtn: {
    backgroundColor: Colors.success,
  },
  rejectBtn: {
    backgroundColor: Colors.error,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  primaryAction: {
    marginTop: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
    marginLeft: 8,
  },
  successBtn: {
    backgroundColor: Colors.success,
  },
  codBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  codBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginTop: 4,
  },
  codAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  codButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  codBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  otpSection: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 12,
  },
  otpInput: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    letterSpacing: 8,
  },
  verifyBtn: {
    backgroundColor: Colors.success,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  verifyBtnDisabled: {
    backgroundColor: Colors.border,
  },
  verifyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  resendTimer: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  resendBtn: {
    fontSize: 14,
    color: Colors.info,
    fontWeight: '600',
    marginTop: 8,
  },
  failBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  failBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  progressBar: {
    flexDirection: 'row',
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginRight: 4,
  },
  progressComplete: {
    backgroundColor: Colors.primary,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  customerDetails: {
    marginTop: 12,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.info,
  },
  navigateBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.info,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  reasonOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.background,
    marginBottom: 8,
  },
  reasonOptionSelected: {
    backgroundColor: Colors.primary,
  },
  reasonText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  reasonTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
});

export default DeliveryHomeTab;
