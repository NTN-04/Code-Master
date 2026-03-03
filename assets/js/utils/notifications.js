// Tiện ích hiển thị thông báo cho toàn bộ dự án
import { database } from "../firebaseConfig.js";
import {
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  onChildAdded,
  query,
  orderByChild,
  limitToLast,
  get,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

const FEEDBACK_CLASSES = ["success", "error", "warning", "info"];

function resolveElement(target) {
  if (!target) return null;
  if (typeof target === "string") {
    return document.getElementById(target);
  }
  return target;
}

function resetFeedbackClasses(el) {
  FEEDBACK_CLASSES.forEach((cls) => el.classList.remove(cls));
}

// Tạo thông báo nổi (thêm vào body) và tự ẩn sau thời gian quy định
export function showFloatingNotification(
  message,
  type = "success",
  options = {},
) {
  const { autoHideDelay = 4000 } = options;
  const el = document.createElement("div");
  el.className = `notification ${type}`;
  el.textContent = message;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add("show");
  });

  let hideTimer = null;
  const hide = () => {
    if (!el.classList.contains("show")) return;
    el.classList.remove("show");
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 300);
  };

  if (autoHideDelay > 0) {
    hideTimer = setTimeout(hide, autoHideDelay);
  }

  return {
    element: el,
    hide,
    cancelAutoHide: () => {
      if (hideTimer) clearTimeout(hideTimer);
    },
  };
}

// Tạo bộ điều khiển thông báo sử dụng một container có sẵn (ví dụ #notification trong trang admin)
export function createNotificationManager(options = {}) {
  const {
    containerId = "notification",
    autoHideDelay = 5000,
    fallbackToFloating = true,
  } = options;

  let hideTimer = null;

  const show = (message, type = "success") => {
    const container = resolveElement(containerId);
    if (!container) {
      if (fallbackToFloating) {
        return showFloatingNotification(message, type, { autoHideDelay });
      }
      return null;
    }

    const messageEl =
      container.querySelector(".notification-message") || container;
    resetFeedbackClasses(container);
    container.classList.add(type, "show");
    messageEl.textContent = message;

    if (autoHideDelay > 0) {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => hide(), autoHideDelay);
    }

    return container;
  };

  const hide = () => {
    const container = resolveElement(containerId);
    if (!container) return;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    container.classList.remove("show");
  };

  return { show, hide };
}

// ============================================================
// NOTIFICATION SERVICE - Hệ thống thông báo realtime với Firebase
// ============================================================

// Các loại thông báo
export const NOTIFICATION_TYPES = {
  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_FAILED: "payment_failed",
  COURSE_ENROLLED: "course_enrolled",
  COURSE_COMPLETED: "course_completed",
  PROGRESS_MILESTONE: "progress_milestone",
  COMMENT_REPLY: "comment_reply",
  COMMENT_MENTION: "comment_mention",
  NEW_COURSE: "new_course",
  PROMOTION: "promotion",
  SYSTEM: "system",
};

// Icon mapping cho từng loại thông báo
const NOTIFICATION_ICONS = {
  [NOTIFICATION_TYPES.PAYMENT_SUCCESS]: "fa-check-circle",
  [NOTIFICATION_TYPES.PAYMENT_FAILED]: "fa-times-circle",
  [NOTIFICATION_TYPES.COURSE_ENROLLED]: "fa-graduation-cap",
  [NOTIFICATION_TYPES.COURSE_COMPLETED]: "fa-trophy",
  [NOTIFICATION_TYPES.PROGRESS_MILESTONE]: "fa-star",
  [NOTIFICATION_TYPES.COMMENT_REPLY]: "fa-comment",
  [NOTIFICATION_TYPES.COMMENT_MENTION]: "fa-at",
  [NOTIFICATION_TYPES.NEW_COURSE]: "fa-book",
  [NOTIFICATION_TYPES.PROMOTION]: "fa-tag",
  [NOTIFICATION_TYPES.SYSTEM]: "fa-bell",
};

// Color mapping cho từng loại thông báo
const NOTIFICATION_COLORS = {
  [NOTIFICATION_TYPES.PAYMENT_SUCCESS]: "#10b981",
  [NOTIFICATION_TYPES.PAYMENT_FAILED]: "#ef4444",
  [NOTIFICATION_TYPES.COURSE_ENROLLED]: "#8b5cf6",
  [NOTIFICATION_TYPES.COURSE_COMPLETED]: "#f59e0b",
  [NOTIFICATION_TYPES.PROGRESS_MILESTONE]: "#3b82f6",
  [NOTIFICATION_TYPES.COMMENT_REPLY]: "#06b6d4",
  [NOTIFICATION_TYPES.COMMENT_MENTION]: "#ec4899",
  [NOTIFICATION_TYPES.NEW_COURSE]: "#6366f1",
  [NOTIFICATION_TYPES.PROMOTION]: "#f97316",
  [NOTIFICATION_TYPES.SYSTEM]: "#64748b",
};

/**
 * NotificationService - Quản lý thông báo realtime với Firebase
 */
export class NotificationService {
  constructor() {
    this.userId = null;
    this.unsubscribers = [];
    this.notifications = [];
    this.unreadCount = 0;
    this.listeners = new Set();
    this.isInitialized = false;
    // Tracking để tránh hiển thị toast trùng lặp
    this._initTime = 0; // Thời điểm listener được khởi tạo
    this._shownToastIds = new Set(); // Các notification ID đã hiển thị toast
    this._initialLoadComplete = false; // Đánh dấu đã load xong dữ liệu ban đầu
  }

  /**
   * Khởi tạo service với userId
   * @param {string} userId - ID của người dùng
   */
  init(userId) {
    if (!userId) {
      console.warn("NotificationService: userId is required");
      return;
    }

    if (this.isInitialized && this.userId === userId) {
      return; // Đã khởi tạo cho user này
    }

    // Hủy listener cũ nếu có
    this.destroy();

    this.userId = userId;
    this.isInitialized = true;
    this._initTime = Date.now(); // Lưu thời điểm khởi tạo
    this._initialLoadComplete = false;
    this._setupRealtimeListeners();
  }

  /**
   * Thiết lập listeners realtime cho notifications
   */
  _setupRealtimeListeners() {
    const notificationsRef = ref(database, `notifications/${this.userId}`);

    // Thử query với orderByChild, fallback sang query đơn giản nếu lỗi index
    this._trySetupWithOrder(notificationsRef);
  }

  /**
   * Thử thiết lập listener với orderByChild
   */
  _trySetupWithOrder(notificationsRef) {
    try {
      const recentQuery = query(
        notificationsRef,
        orderByChild("createdAt"),
        limitToLast(50),
      );

      // Listener cho danh sách thông báo với error handling
      const unsubscribe = onValue(
        recentQuery,
        (snapshot) => {
          this._processNotifications(snapshot);
        },
        (error) => {
          console.warn(
            "NotificationService: Query với index thất bại, sử dụng query đơn giản",
            error.message,
          );
          // Fallback sang query không có orderByChild
          this._setupSimpleListener(notificationsRef);
        },
      );

      this.unsubscribers.push(unsubscribe);

      // Listener cho thông báo mới (để hiển thị toast)
      onChildAdded(
        recentQuery,
        (snapshot) => {
          this._handleNewNotification(snapshot);
        },
        (error) => {
          // Lỗi đã được xử lý ở trên, không cần làm gì thêm
        },
      );
    } catch (error) {
      console.warn("NotificationService: Lỗi thiết lập listener:", error);
      this._setupSimpleListener(notificationsRef);
    }
  }

  /**
   * Fallback: thiết lập listener đơn giản không cần index
   */
  _setupSimpleListener(notificationsRef) {
    const simpleQuery = query(notificationsRef, limitToLast(50));

    const unsubscribe = onValue(
      simpleQuery,
      (snapshot) => {
        this._processNotifications(snapshot);
      },
      (error) => {
        console.error("NotificationService: Không thể tải thông báo:", error);
      },
    );

    this.unsubscribers.push(unsubscribe);

    // Listener cho thông báo mới
    onChildAdded(
      simpleQuery,
      (snapshot) => {
        this._handleNewNotification(snapshot);
      },
      (error) => {
        // Bỏ qua lỗi
      },
    );
  }

  /**
   * Xử lý snapshot notifications
   */
  _processNotifications(snapshot) {
    this.notifications = [];
    this.unreadCount = 0;

    // Đánh dấu đã load xong dữ liệu ban đầu (sau khi xử lý xong)
    // Dùng setTimeout để đảm bảo tất cả onChildAdded đã fire xong
    if (!this._initialLoadComplete) {
      setTimeout(() => {
        this._initialLoadComplete = true;
      }, 500);
    }

    if (snapshot.exists()) {
      const notifArray = [];
      snapshot.forEach((child) => {
        notifArray.push({
          id: child.key,
          ...child.val(),
        });
      });

      // Sắp xếp theo createdAt giảm dần (mới nhất lên đầu)
      notifArray.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      this.notifications = notifArray;
      this.unreadCount = notifArray.filter((n) => !n.read).length;
    }

    this._notifyListeners("update", {
      notifications: this.notifications,
      unreadCount: this.unreadCount,
    });
  }

  /**
   * Xử lý thông báo mới cho toast
   */
  _handleNewNotification(snapshot) {
    // Bỏ qua trong quá trình load dữ liệu ban đầu
    if (!this._initialLoadComplete) {
      return;
    }

    const notification = {
      id: snapshot.key,
      ...snapshot.val(),
    };

    // Bỏ qua nếu đã hiển thị toast cho notification này
    if (this._shownToastIds.has(notification.id)) {
      return;
    }

    // Chỉ hiển thị toast cho thông báo:
    // 1. Được tạo SAU khi listener khởi tạo
    // 2. Chưa đọc
    // 3. Được tạo trong vòng 30 giây gần đây (để tránh delay network)
    const now = Date.now();
    const notifTime = notification.createdAt || 0;
    const isNewSinceInit = notifTime > this._initTime;
    const isRecent = now - notifTime < 30000;

    if (isNewSinceInit && isRecent && !notification.read) {
      this._shownToastIds.add(notification.id);
      this._showToast(notification);
    }
  }

  /**
   * Hiển thị toast cho thông báo mới
   */
  _showToast(notification) {
    const icon = NOTIFICATION_ICONS[notification.type] || "fa-bell";
    const color = NOTIFICATION_COLORS[notification.type] || "#64748b";

    // Tạo toast element
    const toast = document.createElement("div");
    toast.className = "notification-toast";
    toast.innerHTML = `
      <div class="notification-toast-icon" style="background: ${color}20; color: ${color}">
        <i class="fas ${icon}"></i>
      </div>
      <div class="notification-toast-content">
        <div class="notification-toast-title">${notification.title || "Thông báo mới"}</div>
        <div class="notification-toast-message">${notification.message}</div>
      </div>
      <button class="notification-toast-close">
        <i class="fas fa-times"></i>
      </button>
    `;

    document.body.appendChild(toast);

    // Animation in
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    // Click để đóng
    const closeBtn = toast.querySelector(".notification-toast-close");
    closeBtn.addEventListener("click", () => {
      this._hideToast(toast);
    });

    // Click toast để mở link (nếu có)
    toast.addEventListener("click", (e) => {
      if (!e.target.closest(".notification-toast-close")) {
        if (notification.link) {
          window.location.href = notification.link;
        }
        this.markAsRead(notification.id);
        this._hideToast(toast);
      }
    });

    // Auto hide sau 5 giây
    setTimeout(() => {
      this._hideToast(toast);
    }, 5000);
  }

  _hideToast(toast) {
    if (!toast.parentNode) return;
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Thêm listener để nhận cập nhật
   * @param {Function} callback - Hàm callback (event, data)
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Thông báo cho tất cả listeners
   */
  _notifyListeners(event, data) {
    this.listeners.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error("NotificationService listener error:", error);
      }
    });
  }

  /**
   * Lấy danh sách thông báo
   */
  getNotifications() {
    return this.notifications;
  }

  /**
   * Lấy số thông báo chưa đọc
   */
  getUnreadCount() {
    return this.unreadCount;
  }

  /**
   * Đánh dấu một thông báo là đã đọc
   * @param {string} notificationId - ID thông báo
   */
  async markAsRead(notificationId) {
    if (!this.userId || !notificationId) return;

    try {
      const notifRef = ref(
        database,
        `notifications/${this.userId}/${notificationId}`,
      );
      await update(notifRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  /**
   * Đánh dấu tất cả thông báo là đã đọc
   */
  async markAllAsRead() {
    if (!this.userId) return;

    try {
      const updates = {};
      this.notifications.forEach((notif) => {
        if (!notif.read) {
          updates[`notifications/${this.userId}/${notif.id}/read`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }

  /**
   * Xóa một thông báo
   * @param {string} notificationId - ID thông báo
   */
  async deleteNotification(notificationId) {
    if (!this.userId || !notificationId) return;

    try {
      const notifRef = ref(
        database,
        `notifications/${this.userId}/${notificationId}`,
      );
      await remove(notifRef);
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  }

  /**
   * Xóa tất cả thông báo
   */
  async clearAllNotifications() {
    if (!this.userId) return;

    try {
      const notificationsRef = ref(database, `notifications/${this.userId}`);
      await remove(notificationsRef);
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  }

  /**
   * Hủy tất cả listeners và cleanup
   */
  destroy() {
    this.unsubscribers.forEach((unsub) => {
      if (typeof unsub === "function") {
        unsub();
      }
    });
    this.unsubscribers = [];
    this.notifications = [];
    this.unreadCount = 0;
    this.userId = null;
    this.isInitialized = false;
    this.listeners.clear();
    // Reset tracking variables
    this._initTime = 0;
    this._shownToastIds.clear();
    this._initialLoadComplete = false;
  }
}

// ============================================================
// HELPER FUNCTIONS - Tạo thông báo
// ============================================================

/**
 * Tạo thông báo mới cho một user
 * @param {string} userId - ID của user nhận thông báo
 * @param {Object} notificationData - Dữ liệu thông báo
 */
export async function createNotification(userId, notificationData) {
  if (!userId) {
    console.error("createNotification: userId is required");
    return null;
  }

  try {
    const notificationsRef = ref(database, `notifications/${userId}`);
    const newNotifRef = push(notificationsRef);

    const notification = {
      type: notificationData.type || NOTIFICATION_TYPES.SYSTEM,
      title: notificationData.title || "Thông báo",
      message: notificationData.message || "",
      link: notificationData.link || null,
      data: notificationData.data || null,
      read: false,
      createdAt: Date.now(),
    };

    await set(newNotifRef, notification);
    return { id: newNotifRef.key, ...notification };
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

/**
 * Tạo thông báo cho nhiều users (broadcast)
 * @param {string[]} userIds - Mảng ID của users
 * @param {Object} notificationData - Dữ liệu thông báo
 */
export async function broadcastNotification(userIds, notificationData) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    console.error("broadcastNotification: userIds array is required");
    return;
  }

  const promises = userIds.map((userId) =>
    createNotification(userId, notificationData),
  );

  try {
    await Promise.all(promises);
    console.log(`Broadcast notification to ${userIds.length} users`);
  } catch (error) {
    console.error("Error broadcasting notification:", error);
  }
}

// Singleton instance
let notificationServiceInstance = null;

/**
 * Lấy instance của NotificationService (singleton)
 */
export function getNotificationService() {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}
