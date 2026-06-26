#!/usr/bin/env node
/**
 * Socket Validation Layer
 * Monitors socket events, detects reconnect storms, validates real-time updates
 */

export class SocketMonitor {
  constructor() {
    this.connections = [];
    this.disconnections = [];
    this.reconnects = [];
    this.events = [];
    this.roomJoins = [];
    this.errors = [];
    
    this.metrics = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalReconnects: 0,
      totalEvents: 0,
      reconnectStormCount: 0,
      duplicateSocketCount: 0,
    };
  }

  setupMonitoring(page) {
    // Inject socket monitoring script
    page.addInitScript(() => {
      window.__socketMonitor = {
        connections: [],
        disconnections: [],
        reconnects: [],
        events: [],
        roomJoins: [],
        errors: [],
      };

      // Monitor WebSocket connections
      const originalWebSocket = window.WebSocket;
      window.WebSocket = function(...args) {
        const ws = new originalWebSocket(...args);
        
        ws.addEventListener("open", () => {
          window.__socketMonitor.connections.push({
            url: args[0],
            timestamp: Date.now(),
          });
        });

        ws.addEventListener("close", (event) => {
          window.__socketMonitor.disconnections.push({
            url: args[0],
            code: event.code,
            reason: event.reason,
            timestamp: Date.now(),
          });
        });

        ws.addEventListener("error", (error) => {
          window.__socketMonitor.errors.push({
            url: args[0],
            error: error.message || "Unknown error",
            timestamp: Date.now(),
          });
        });

        return ws;
      };

      // Monitor Socket.IO if present
      if (window.io) {
        const originalSocket = window.io.Socket;
        window.io.Socket = function(...args) {
          const socket = new originalSocket(...args);
          
          socket.on("connect", () => {
            window.__socketMonitor.connections.push({
            type: "socket.io",
            timestamp: Date.now(),
          });
          });

          socket.on("disconnect", (reason) => {
            window.__socketMonitor.disconnections.push({
              type: "socket.io",
              reason,
              timestamp: Date.now(),
            });
          });

          socket.on("reconnect", (attemptNumber) => {
            window.__socketMonitor.reconnects.push({
              attemptNumber,
              timestamp: Date.now(),
            });
          });

          socket.on("reconnect_attempt", (attemptNumber) => {
            window.__socketMonitor.reconnects.push({
              attemptNumber,
              type: "attempt",
              timestamp: Date.now(),
            });
          });

          socket.on("reconnect_failed", () => {
            window.__socketMonitor.errors.push({
              type: "reconnect_failed",
              timestamp: Date.now(),
            });
          });

          return socket;
        };
      }
    });

    // Periodically collect socket data
    this.collectInterval = setInterval(async () => {
      const data = await page.evaluate(() => window.__socketMonitor || {});
      this.mergeData(data);
    }, 1000);
  }

  mergeData(data) {
    if (data.connections) {
      this.connections.push(...data.connections);
      this.metrics.totalConnections += data.connections.length;
    }
    if (data.disconnections) {
      this.disconnections.push(...data.disconnections);
      this.metrics.totalDisconnections += data.disconnections.length;
    }
    if (data.reconnects) {
      this.reconnects.push(...data.reconnects);
      this.metrics.totalReconnects += data.reconnects.length;
    }
    if (data.events) {
      this.events.push(...data.events);
      this.metrics.totalEvents += data.events.length;
    }
    if (data.roomJoins) {
      this.roomJoins.push(...data.roomJoins);
    }
    if (data.errors) {
      this.errors.push(...data.errors);
    }
  }

  detectReconnectStorms() {
    const storms = [];
    const now = Date.now();
    const windowMs = 10000; // 10 seconds

    // Count reconnects in time window
    const recentReconnects = this.reconnects.filter(
      (r) => now - r.timestamp < windowMs
    );

    if (recentReconnects.length >= 5) {
      storms.push({
        type: "reconnect_storm",
        count: recentReconnects.length,
        window: windowMs,
        severity: recentReconnects.length >= 10 ? "critical" : "high",
      });
    }

    return storms;
  }

  detectDuplicateSockets() {
    const urlCounts = new Map();
    const duplicates = [];

    for (const conn of this.connections) {
      const key = conn.url || conn.type || "unknown";
      const count = urlCounts.get(key) || 0;
      urlCounts.set(key, count + 1);

      if (count >= 2) {
        duplicates.push({
          url: key,
          count: count + 1,
        });
      }
    }

    return duplicates;
  }

  detectRoomMismatch() {
    const mismatches = [];

    // Check for multiple room joins without proper leaves
    const roomJoinsByRoom = new Map();
    for (const join of this.roomJoins) {
      const joins = roomJoinsByRoom.get(join.room) || [];
      joins.push(join);
      roomJoinsByRoom.set(join.room, joins);
    }

    for (const [room, joins] of roomJoinsByRoom.entries()) {
      if (joins.length > 3) {
        mismatches.push({
          room,
          joinCount: joins.length,
          severity: "medium",
        });
      }
    }

    return mismatches;
  }

  validateOrderAssigned() {
    // Check for order_assigned event
    const orderEvents = this.events.filter(
      (e) => e.name === "order_assigned" || e.name === "new_order"
    );
    return {
      received: orderEvents.length > 0,
      count: orderEvents.length,
    };
  }

  validateOrderStatusChanged() {
    const statusEvents = this.events.filter(
      (e) => e.name === "order_status" || e.name === "status_update"
    );
    return {
      received: statusEvents.length > 0,
      count: statusEvents.length,
    };
  }

  validateEarningsCredited() {
    const earningsEvents = this.events.filter(
      (e) => e.name === "earnings_credited" || e.name === "wallet_update"
    );
    return {
      received: earningsEvents.length > 0,
      count: earningsEvents.length,
    };
  }

  validateNotificationRefresh() {
    const notificationEvents = this.events.filter(
      (e) => e.name === "notification" || e.name === "push"
    );
    return {
      received: notificationEvents.length > 0,
      count: notificationEvents.length,
    };
  }

  stopMonitoring() {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
    }
  }

  getReport() {
    const reconnectStorms = this.detectReconnectStorms();
    const duplicateSockets = this.detectDuplicateSockets();
    const roomMismatches = this.detectRoomMismatch();

    return {
      summary: {
        totalConnections: this.metrics.totalConnections,
        totalDisconnections: this.metrics.totalDisconnections,
        totalReconnects: this.metrics.totalReconnects,
        totalEvents: this.metrics.totalEvents,
        reconnectStormCount: reconnectStorms.length,
        duplicateSocketCount: duplicateSockets.length,
      },
      reconnectStorms,
      duplicateSockets,
      roomMismatches,
      errors: this.errors.slice(0, 20),
      validations: {
        orderAssigned: this.validateOrderAssigned(),
        orderStatusChanged: this.validateOrderStatusChanged(),
        earningsCredited: this.validateEarningsCredited(),
        notificationRefresh: this.validateNotificationRefresh(),
      },
      criticalIssues: [
        ...reconnectStorms.map((s) => ({ type: "reconnect_storm", severity: s.severity })),
        ...duplicateSockets.map((d) => ({ type: "duplicate_socket", url: d.url })),
      ],
    };
  }

  reset() {
    this.connections = [];
    this.disconnections = [];
    this.reconnects = [];
    this.events = [];
    this.roomJoins = [];
    this.errors = [];
    this.metrics = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalReconnects: 0,
      totalEvents: 0,
      reconnectStormCount: 0,
      duplicateSocketCount: 0,
    };
  }

  hasCriticalIssues() {
    return this.detectReconnectStorms().length > 0 || this.detectDuplicateSockets().length > 0;
  }

  getHealthScore() {
    let score = 100;

    // Deduct for reconnect storms
    score -= this.detectReconnectStorms().length * 20;

    // Deduct for duplicate sockets
    score -= this.detectDuplicateSockets().length * 10;

    // Deduct for socket errors
    score -= this.errors.length * 5;

    // Deduct for excessive reconnects
    if (this.metrics.totalReconnects > 10) {
      score -= 15;
    }

    return Math.max(0, score);
  }
}

export default SocketMonitor;
