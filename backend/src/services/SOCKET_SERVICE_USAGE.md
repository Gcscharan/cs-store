# Low Stock Socket Service - Usage Guide

## Overview

The `LowStockSocketService` provides real-time broadcasting capabilities for low stock notifications via Socket.io. It integrates with the existing Socket.io instance and broadcasts alerts to admin clients.

## Installation

The service is already implemented in `backend/src/services/lowStockSocketService.ts`.

## Basic Usage

### 1. Import the Service

```typescript
import { createLowStockSocketService } from './services/lowStockSocketService';
import { Application } from 'express';
```

### 2. Initialize the Service

```typescript
// In your Express app setup (e.g., index.ts or app.ts)
const app: Application = express();

// After Socket.io is set up and stored in app
app.set('io', io);

// Create socket service instance
const socketService = createLowStockSocketService(app);
```

### 3. Broadcast Low Stock Alerts

```typescript
// In your notification service or controller
import { ILowStockNotification } from '../models/LowStockNotification';

// After creating a notification
const notification: ILowStockNotification = await LowStockNotification.create({
  type: 'LOW_STOCK',
  productId: productId,
  productName: 'Organic Tomatoes',
  currentStock: 8,
  priority: 'LOW',
  message: 'Low stock: Organic Tomatoes has only 8 left',
  isRead: false,
});

// Broadcast to all admin clients
socketService.broadcastLowStockAlert(notification);
```

### 4. Broadcast Status Updates (Optional)

```typescript
// When a notification is marked as read
const updatedNotification = await notificationService.markAsRead(notificationId);

// Broadcast the status update
socketService.broadcastNotificationStatusUpdate(
  notificationId,
  true // isRead
);
```

## Integration with Notification Service

Here's how to integrate the socket service into the existing notification service:

```typescript
// In notificationService.ts
import { createLowStockSocketService } from './lowStockSocketService';
import { Application } from 'express';

export class NotificationService {
  private socketService: ISocketService;

  constructor(app: Application) {
    this.socketService = createLowStockSocketService(app);
  }

  async createLowStockNotification(
    data: CreateLowStockNotificationDTO
  ): Promise<ILowStockNotification | null> {
    // ... existing duplicate prevention logic ...

    // Create notification
    const notification = await LowStockNotification.create({
      type: 'LOW_STOCK',
      productId: data.productId,
      productName: data.productName,
      currentStock: data.currentStock,
      priority: data.priority,
      message: this.generateMessage(data.productName, data.currentStock, data.priority),
      isRead: false,
    });

    // Broadcast to admin clients (non-blocking, graceful error handling)
    this.socketService.broadcastLowStockAlert(notification);

    return notification;
  }

  async markAsRead(notificationId: string): Promise<ILowStockNotification> {
    const notification = await LowStockNotification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    // Broadcast status update (optional)
    this.socketService.broadcastNotificationStatusUpdate(
      notificationId,
      true
    );

    return notification;
  }
}
```

## Socket.io Events

### Event: `low_stock_alert`

Emitted when a new low stock notification is created.

**Room:** `admin_room`

**Payload:**
```typescript
{
  notification: {
    _id: string;
    type: 'LOW_STOCK';
    productId: string;
    productName: string;
    currentStock: number;
    priority: 'LOW' | 'CRITICAL';
    message: string;
    isRead: boolean;
    createdAt: string; // ISO 8601 format
  }
}
```

**Client-side Listener (Admin Dashboard):**
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: adminJwtToken }
});

// Join admin room
socket.emit('join_room', { room: 'admin_room' });

// Listen for low stock alerts
socket.on('low_stock_alert', (data) => {
  console.log('New low stock alert:', data.notification);
  
  // Display toast notification
  showToast(data.notification.message, {
    type: data.notification.priority === 'CRITICAL' ? 'error' : 'warning'
  });
  
  // Add to notification list
  addNotificationToList(data.notification);
  
  // Increment unread badge
  incrementUnreadCount();
});
```

### Event: `notification:status:update`

Emitted when a notification's read status changes.

**Room:** `admin_room`

**Payload:**
```typescript
{
  notificationId: string;
  isRead: boolean;
  updatedAt: string; // ISO 8601 format
}
```

**Client-side Listener:**
```typescript
socket.on('notification:status:update', (data) => {
  console.log('Notification status updated:', data);
  
  // Update notification in list
  updateNotificationStatus(data.notificationId, data.isRead);
  
  // Update unread count
  if (data.isRead) {
    decrementUnreadCount();
  }
});
```

## Error Handling

The socket service implements graceful error handling:

1. **Socket.io Not Available:** Logs a warning and continues without throwing
2. **Broadcast Errors:** Logs the error and continues without blocking notification creation
3. **App.get Errors:** Catches and logs errors when accessing the Socket.io instance

This ensures that notification creation always succeeds, even if real-time broadcasting fails. Clients can fall back to polling the REST API.

## Testing

The service includes comprehensive unit tests:

```bash
npm test -- lowStockSocketService.test.ts
```

Tests cover:
- Broadcasting low stock alerts with complete notification objects
- Broadcasting status updates
- Handling missing Socket.io instances
- Handling Socket.io errors
- Serializing ObjectIds to strings
- Formatting timestamps as ISO 8601
- Integration with Express app

## Requirements Satisfied

- **Requirement 7.1:** Emit "low_stock_alert" event when notification created
- **Requirement 7.2:** Include complete notification object in payload
- **Requirement 7.3:** Use existing Socket.io instance via `app.get("io")`
- **Requirement 7.4:** Broadcast to all connected admin clients in admin_room
- **Requirement 7.5:** Emit event immediately after notification creation

## Next Steps

1. Integrate the socket service into the notification service (Task 12.1)
2. Implement admin dashboard Socket.io client (Task 14.4)
3. Write property tests for Socket.io event payload completeness (Task 8.2)
