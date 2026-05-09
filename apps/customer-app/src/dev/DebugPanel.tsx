// apps/customer-app/src/dev/DebugPanel.tsx

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { driverSimulator } from "../simulator/DriverSimulator";
import { driverLocationStore } from "../simulator/driverLocationStore";
import { Order } from "../utils/deliveryUtils";

interface DebugPanelProps {
  activeOrders: Order[];
  sortedOrderIds: string[];
  isArranged: boolean;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  activeOrders,
  sortedOrderIds,
  isArranged,
}) => {
  if (!__DEV__) return null;

  const [state, setState] = useState(driverSimulator.getState());
  const [location, setLocation] = useState(driverLocationStore.current);

  // Update state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setState(driverSimulator.getState());
      setLocation(driverLocationStore.current);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const orderedRoute = sortedOrderIds
    .map((id) => activeOrders.find((o) => o._id === id))
    .filter((o): o is NonNullable<typeof o> => !!o && typeof o.address?.lat === 'number' && typeof o.address?.lng === 'number') as any[];

  const handleStart = () => {
    driverSimulator.start(orderedRoute, isArranged);
  };

  const handlePause = () => {
    driverSimulator.pause();
  };

  const handleResume = () => {
    driverSimulator.resume();
  };

  const handleReset = () => {
    driverSimulator.reset();
  };

  const handleSpeed = (multiplier: 1 | 2 | 5) => {
    driverSimulator.setSpeed(multiplier);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚗 Simulator</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, !isArranged && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={!isArranged}
        >
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !state.isRunning && styles.buttonDisabled]}
          onPress={handlePause}
          disabled={!state.isRunning}
        >
          <Text style={styles.buttonText}>Pause</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !state.isPaused && styles.buttonDisabled]}
          onPress={handleResume}
          disabled={!state.isPaused}
        >
          <Text style={styles.buttonText}>Resume</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleReset}>
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[
            styles.speedButton,
            state.speedMultiplier === 1 && styles.speedButtonActive,
          ]}
          onPress={() => handleSpeed(1)}
        >
          <Text style={styles.buttonText}>1×</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.speedButton,
            state.speedMultiplier === 2 && styles.speedButtonActive,
          ]}
          onPress={() => handleSpeed(2)}
        >
          <Text style={styles.buttonText}>2×</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.speedButton,
            state.speedMultiplier === 5 && styles.speedButtonActive,
          ]}
          onPress={() => handleSpeed(5)}
        >
          <Text style={styles.buttonText}>5×</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoLabel}>Position:</Text>
        <Text style={styles.infoValue}>
          {location?.lat?.toFixed(5)}, {location?.lng?.toFixed(5)}
        </Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoLabel}>Target:</Text>
        <Text style={styles.infoValue}>
          {orderedRoute[state.currentIndex]?._id?.slice(-6) || "None"}
        </Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoLabel}>Status:</Text>
        <Text style={styles.infoValue}>
          {state.isRunning
            ? state.isPaused
              ? "Paused"
              : "Running"
            : "Stopped"}
        </Text>
      </View>

      {!isArranged && (
        <Text style={styles.warning}>
          ⚠️ Arrange route first before starting simulation
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    margin: 10,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    backgroundColor: "#2563eb",
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#374151",
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  speedButton: {
    flex: 1,
    backgroundColor: "#374151",
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  speedButtonActive: {
    backgroundColor: "#10b981",
  },
  infoContainer: {
    flexDirection: "row",
    marginTop: 8,
  },
  infoLabel: {
    color: "#9ca3af",
    fontSize: 12,
    width: 70,
  },
  infoValue: {
    color: "#10b981",
    fontSize: 12,
    flex: 1,
  },
  warning: {
    color: "#fbbf24",
    fontSize: 11,
    marginTop: 8,
    fontStyle: "italic",
  },
});