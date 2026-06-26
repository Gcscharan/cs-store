import React from 'react';
import { DeliveryState } from '../../../hooks/delivery/useDeliveryState';
import { Order, DeliveryBoy } from '../../../hooks/delivery/useOrders';
import { IdleCard } from './IdleCard';
import { NewOrderCard } from './NewOrderCard';
import { ActiveOrderCard } from './ActiveOrderCard';

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

interface StateCardProps {
  state: DeliveryState;
  activeOrders: Order[];
  availableOrders: Order[];
  deliveryBoy: DeliveryBoy | null;
  deliveryAttempted: Record<string, boolean>;
  codCollectionByOrderId: Record<string, CodCollection | null | undefined>;
  otpInputs: Record<string, string>;
  onOtpChange: (orderId: string, value: string) => void;
  onToggleOnline: () => void;
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
  onPickup: (orderId: string) => void;
  onStartDelivery: (orderId: string) => void;
  onMarkArrived: (orderId: string) => void;
  onStartDeliveryAttempt: (orderId: string) => void;
  onResendOtp: (orderId: string) => Promise<void>;
  onVerifyOtp: (orderId: string, otp: string) => void | Promise<void>;
  onCollectCOD: (orderId: string, mode: 'CASH' | 'UPI') => void;
  onFailDelivery: (orderId: string, reason: string, notes?: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StateCard: React.FC<StateCardProps> = ({ state, ...props }) => {
  switch (state) {
    case 'IDLE':
      return (
        <IdleCard
          earnings={props.deliveryBoy?.earnings ?? 0}
          onRefresh={props.onToggleOnline}
        />
      );
    case 'NEW_ORDER':
      return (
        <NewOrderCard
          availableOrders={props.availableOrders}
          onAccept={props.onAccept}
          onReject={props.onReject}
        />
      );
    case 'ACTIVE_DELIVERY':
      return (
        <ActiveOrderCard
          activeOrders={props.activeOrders}
          deliveryAttempted={props.deliveryAttempted}
          codCollectionByOrderId={props.codCollectionByOrderId}
          otpInputs={props.otpInputs}
          onOtpChange={props.onOtpChange}
          onPickup={props.onPickup}
          onStartDelivery={props.onStartDelivery}
          onMarkArrived={props.onMarkArrived}
          onStartDeliveryAttempt={props.onStartDeliveryAttempt}
          onResendOtp={props.onResendOtp}
          onVerifyOtp={props.onVerifyOtp}
          onCollectCOD={props.onCollectCOD}
          onFailDelivery={props.onFailDelivery}
        />
      );
  }
};
