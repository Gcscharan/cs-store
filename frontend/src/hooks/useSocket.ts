import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

import { getApiOrigin } from "../config/runtime";

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const verboseLoggingEnabled =
    String(import.meta.env.VITE_DEV_LOW_POWER || "").toLowerCase() !== "true";

  useEffect(() => {
    const socketInstance = io(
      getApiOrigin() || "/",
      {
        transports: ["websocket"],
      }
    );

    socketInstance.on("connect", () => {
      if (verboseLoggingEnabled) {
        console.log("Connected to server");
      }
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      if (verboseLoggingEnabled) {
        console.log("Disconnected from server");
      }
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { socket, isConnected };
};

export const useOrderUpdates = (orderId: string) => {
  const { socket } = useSocket();
  const [orderStatus, setOrderStatus] = useState<string>("created");
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");

  useEffect(() => {
    if (!socket || !orderId) return;

    // Listen for order status updates
    socket.on("order:status:update", (data) => {
      if (data.orderId === orderId) {
        setOrderStatus(data.status);
      }
    });

    // Listen for payment success
    socket.on("order:payment:success", (data) => {
      if (data.orderId === orderId) {
        setPaymentStatus("paid");
      }
    });

    // Listen for payment failure
    socket.on("order:payment:failed", (data) => {
      if (data.orderId === orderId) {
        setPaymentStatus("failed");
      }
    });

    return () => {
      socket.off("order:status:update");
      socket.off("order:payment:success");
      socket.off("order:payment:failed");
    };
  }, [socket, orderId]);

  return { orderStatus, paymentStatus };
};
