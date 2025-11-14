// Offline Sync Utility using IndexedDB for delivery partner app
// Handles offline order status updates and syncs when online

const DB_NAME = "DeliveryAppDB";
const DB_VERSION = 1;
const STORE_NAME = "pendingActions";

interface PendingAction {
  id: string;
  type: "status_update" | "location_update" | "order_complete";
  orderId?: string;
  payload: any;
  timestamp: number;
  retryCount: number;
}

class OfflineSync {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  constructor() {
    this.initDB();
    this.setupOnlineListener();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("IndexedDB failed to open");
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("✅ IndexedDB initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
          });
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
          objectStore.createIndex("type", "type", { unique: false });
        }
      };
    });
  }

  private setupOnlineListener(): void {
    window.addEventListener("online", () => {
      console.log("📶 Network connection restored");
      this.isOnline = true;
      this.syncPendingActions();
    });

    window.addEventListener("offline", () => {
      console.log("📵 Network connection lost");
      this.isOnline = false;
    });
  }

  /**
   * Save action to be performed when online
   */
  async saveAction(action: Omit<PendingAction, "id" | "timestamp" | "retryCount">): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    const pendingAction: PendingAction = {
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(pendingAction);

      request.onsuccess = () => {
        console.log("💾 Action saved for offline sync:", action.type);
        resolve();
      };

      request.onerror = () => {
        console.error("Failed to save action:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all pending actions
   */
  async getPendingActions(): Promise<PendingAction[]> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete a pending action
   */
  async deleteAction(id: string): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Update retry count for an action
   */
  async updateRetryCount(id: string, retryCount: number): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.retryCount = retryCount;
          const updateRequest = store.put(action);

          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * Sync all pending actions to server
   */
  async syncPendingActions(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    console.log("🔄 Starting offline sync...");

    try {
      const pendingActions = await this.getPendingActions();
      
      if (pendingActions.length === 0) {
        console.log("✅ No pending actions to sync");
        this.syncInProgress = false;
        return;
      }

      console.log(`📦 Syncing ${pendingActions.length} pending actions`);

      for (const action of pendingActions) {
        try {
          // Skip if too many retries
          if (action.retryCount >= 3) {
            console.warn(`⚠️ Action ${action.id} exceeded retry limit, deleting`);
            await this.deleteAction(action.id);
            continue;
          }

          // Execute the action
          const success = await this.executeAction(action);

          if (success) {
            await this.deleteAction(action.id);
            console.log(`✅ Synced action: ${action.type}`);
          } else {
            // Increment retry count
            await this.updateRetryCount(action.id, action.retryCount + 1);
            console.warn(`⚠️ Failed to sync action: ${action.type}, will retry`);
          }
        } catch (error) {
          console.error(`❌ Error syncing action ${action.id}:`, error);
          await this.updateRetryCount(action.id, action.retryCount + 1);
        }
      }

      console.log("✅ Offline sync completed");
    } catch (error) {
      console.error("❌ Offline sync failed:", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Execute a pending action
   */
  private async executeAction(action: PendingAction): Promise<boolean> {
    const token = this.getAuthToken();
    if (!token) {
      console.error("No auth token available");
      return false;
    }

    try {
      let url = "";
      let method = "PUT";
      let body: any = null;

      switch (action.type) {
        case "status_update":
          url = `/api/delivery/orders/${action.orderId}/status`;
          body = action.payload;
          break;

        case "location_update":
          url = "/api/delivery/location";
          body = action.payload;
          break;

        case "order_complete":
          url = `/api/delivery/orders/${action.orderId}/complete`;
          method = "POST";
          body = action.payload;
          break;

        default:
          console.error("Unknown action type:", action.type);
          return false;
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      return response.ok;
    } catch (error) {
      console.error("Failed to execute action:", error);
      return false;
    }
  }

  /**
   * Get auth token from localStorage
   */
  private getAuthToken(): string | null {
    try {
      const auth = localStorage.getItem("auth");
      if (auth) {
        const parsed = JSON.parse(auth);
        return parsed.tokens?.accessToken || null;
      }
    } catch (error) {
      console.error("Failed to get auth token:", error);
    }
    return null;
  }

  /**
   * Check if online
   */
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Clear all pending actions (use with caution)
   */
  async clearAllActions(): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log("🗑️ All pending actions cleared");
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Export singleton instance
export const offlineSync = new OfflineSync();

// Export helper functions
export const saveOfflineAction = (
  action: Omit<PendingAction, "id" | "timestamp" | "retryCount">
) => offlineSync.saveAction(action);

export const syncOfflineActions = () => offlineSync.syncPendingActions();

export const isOnline = () => offlineSync.isNetworkOnline();

export default offlineSync;
