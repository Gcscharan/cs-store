import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useGetDeliveryPartnersQuery } from '../../api/adminApi';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_MAX_HEIGHT = SCREEN_HEIGHT * 0.75;
const SWIPE_THRESHOLD = 50;

interface DeliveryPartner {
  _id: string;
  name: string;
  phone?: string;
  vehicleType?: string;
  isAvailable?: boolean;
  currentLoad?: number;
}

interface DeliveryPartnerSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPartner: (partnerId: string) => void;
  isAssigning?: boolean;
}

const DeliveryPartnerSelectionModal: React.FC<DeliveryPartnerSelectionModalProps> = ({
  visible,
  onClose,
  onSelectPartner,
  isAssigning = false,
}) => {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  
  const {
    data: partnersResponse,
    isLoading,
    error,
    refetch,
  } = useGetDeliveryPartnersQuery(undefined, {
    skip: !visible,
  });

  const partners = partnersResponse?.deliveryPartners || partnersResponse || [];

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SWIPE_THRESHOLD) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  // Animate modal in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      translateY.setValue(0);
    }
  }, [visible, slideAnim, backdropOpacity, translateY]);

  const handleSelectPartner = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
  };

  const handleConfirmSelection = () => {
    if (selectedPartnerId) {
      onSelectPartner(selectedPartnerId);
      setSelectedPartnerId(null);
    }
  };

  const handleClose = () => {
    setSelectedPartnerId(null);
    onClose();
  };

  const renderPartnerItem = ({ item, index }: { item: DeliveryPartner; index: number }) => {
    const isSelected = selectedPartnerId === item._id;
    const isAvailable = item.isAvailable !== false;

    const handlePress = () => {
      if (!isAvailable) return;
      handleSelectPartner(item._id);
    };

    return (
      <TouchableOpacity
        style={[
          styles.partnerCard,
          isSelected && styles.partnerCardSelected,
          !isAvailable && styles.partnerCardUnavailable,
        ]}
        onPress={handlePress}
        disabled={!isAvailable}
        activeOpacity={0.85}
      >
        {/* Selection Indicator */}
        {isSelected && <View style={styles.selectionIndicator} />}

        <View style={styles.partnerCardContent}>
          {/* Left: Avatar + Info */}
          <View style={styles.partnerLeft}>
            {/* Avatar Circle */}
            <View style={[styles.avatar, !isAvailable && styles.avatarUnavailable]}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            {/* Partner Info */}
            <View style={styles.partnerInfo}>
              <Text style={[styles.partnerName, !isAvailable && styles.textMuted]}>
                {item.name}
              </Text>
              <View style={styles.partnerMeta}>
                {item.phone && (
                  <View style={styles.metaItem}>
                    <Ionicons name="call" size={12} color={isAvailable ? Colors.textSecondary : Colors.textMuted} />
                    <Text style={[styles.metaText, !isAvailable && styles.textMuted]}>
                      {item.phone}
                    </Text>
                  </View>
                )}
                {item.vehicleType && (
                  <View style={styles.metaItem}>
                    <Ionicons name="car" size={12} color={isAvailable ? Colors.textSecondary : Colors.textMuted} />
                    <Text style={[styles.metaText, !isAvailable && styles.textMuted]}>
                      {item.vehicleType}
                    </Text>
                  </View>
                )}
              </View>
              {typeof item.currentLoad === 'number' && (
                <View style={styles.loadContainer}>
                  <Ionicons name="cube" size={12} color={isAvailable ? '#FF9500' : Colors.textMuted} />
                  <Text style={[styles.currentLoad, !isAvailable && styles.textMuted]}>
                    {item.currentLoad} active {item.currentLoad === 1 ? 'order' : 'orders'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Right: Status or Checkmark */}
          <View style={styles.partnerRight}>
            {isSelected ? (
              <View style={styles.checkmarkCircle}>
                <Ionicons name="checkmark" size={20} color={Colors.white} />
              </View>
            ) : (
              <View
                style={[
                  styles.statusBadge,
                  isAvailable ? styles.statusAvailable : styles.statusUnavailable,
                ]}
              >
                <View style={[styles.statusDot, isAvailable && styles.statusDotActive]} />
                <Text
                  style={[
                    styles.statusText,
                    isAvailable ? styles.statusTextAvailable : styles.statusTextUnavailable,
                  ]}
                >
                  {isAvailable ? 'Available' : 'Busy'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading delivery partners...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>Failed to load delivery partners</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!partners || partners.length === 0) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="bicycle-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No delivery partners available</Text>
          <Text style={styles.emptySubtext}>Please try again later</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={partners}
        renderItem={renderPartnerItem}
        keyExtractor={(item) => item._id}
        style={styles.partnersList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Animated Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [
                { translateY: slideAnim },
                { translateY: translateY },
              ],
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header - Fixed */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="people" size={22} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.title}>Select Delivery Partner</Text>
                  <Text style={styles.subtitle}>
                    {partners.length} partner{partners.length !== 1 ? 's' : ''} available
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content - Scrollable */}
          <View style={styles.content}>
            {renderContent()}
          </View>

          {/* Footer - Fixed */}
          {selectedPartnerId && !isLoading && !error && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.assignButton, isAssigning && styles.assignButtonDisabled]}
                onPress={handleConfirmSelection}
                disabled={isAssigning}
                activeOpacity={0.9}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <View style={styles.assignButtonIcon}>
                      <Ionicons name="checkmark-done" size={22} color={Colors.white} />
                    </View>
                    <Text style={styles.assignButtonText}>Assign to Partner</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: MODAL_MAX_HEIGHT,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
    marginRight: -4,
  },
  content: {
    maxHeight: MODAL_MAX_HEIGHT - 200,
  },
  centerContent: {
    paddingVertical: 60,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.error,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  partnersList: {
    flex: 1,
  },
  partnerCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  partnerCardSelected: {
    borderWidth: 2,
    borderColor: Colors.success,
    backgroundColor: '#F0FDF4',
  },
  partnerCardUnavailable: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  selectionIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.success,
  },
  partnerCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  partnerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarUnavailable: {
    backgroundColor: '#9CA3AF',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  partnerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginLeft: 4,
  },
  loadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  currentLoad: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 4,
  },
  textMuted: {
    color: Colors.textMuted,
  },
  partnerRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  checkmarkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 85,
    justifyContent: 'center',
  },
  statusAvailable: {
    backgroundColor: '#D1FAE5',
  },
  statusUnavailable: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusTextAvailable: {
    color: '#065F46',
  },
  statusTextUnavailable: {
    color: '#991B1B',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  assignButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  assignButtonDisabled: {
    opacity: 0.6,
  },
  assignButtonIcon: {
    marginRight: 8,
  },
  assignButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default DeliveryPartnerSelectionModal;