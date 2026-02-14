/**
 * NotificationBell Component
 * Hiển thị icon chuông thông báo với dropdown danh sách thông báo
 */

import {
  getNotificationService,
  NOTIFICATION_TYPES,
} from "../utils/notifications.js";

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
 * Tạo và quản lý NotificationBell component
 */
export class NotificationBell {
  constructor(options = {}) {
    this.container = null;
    this.dropdownOpen = false;
    this.notificationService = getNotificationService();
    this.rootPath = options.rootPath || "./";
    this.unsubscribe = null;
  }

  /**
   * Khởi tạo component sau khi user đăng nhập
   * @param {string} userId - ID của user
   */
  init(userId) {
    if (!userId) return;

    // Khởi tạo notification service
    this.notificationService.init(userId);

    // Render UI
    this._render();

    // Lắng nghe cập nhật
    this.unsubscribe = this.notificationService.addListener((event, data) => {
      if (event === "update") {
        this._updateBadge(data.unreadCount);
        if (this.dropdownOpen) {
          this._renderNotificationList(data.notifications);
        }
      }
    });

    // Đóng dropdown khi click ngoài
    document.addEventListener("click", this._handleOutsideClick.bind(this));
  }

  /**
   * Render icon chuông vào user-area (desktop) và nav-mobile (mobile)
   */
  _render() {
    // Desktop - render vào user-area
    const userArea = document.querySelector(".user-area");
    if (userArea) {
      this._insertBellIconDesktop(userArea);
    }

    // Mobile - render vào nav-mobile-list
    const navMobile = document.querySelector(".nav-mobile-list");
    if (navMobile) {
      this._insertBellIconMobile(navMobile);
    }
  }

  /**
   * Chèn bell icon vào user-area (desktop)
   */
  _insertBellIconDesktop(userArea) {
    // Xóa bell cũ nếu có
    const existingBell = userArea.querySelector(".notification-bell-wrapper");
    if (existingBell) {
      existingBell.remove();
    }

    // Tạo wrapper (div thay vì li)
    const wrapper = document.createElement("div");
    wrapper.className = "notification-bell-wrapper";

    wrapper.innerHTML = `
      <button class="notification-bell-btn" title="Thông báo">
        <i class="fas fa-bell"></i>
        <span class="notification-badge" style="display: none;">0</span>
      </button>
      <div class="notification-dropdown">
        <div class="notification-dropdown-header">
          <h4>Thông Báo</h4>
          <div class="notification-header-actions">
            <button class="mark-all-read-btn" title="Đánh dấu tất cả đã đọc">
              <i class="fas fa-check-double"></i>
            </button>
          </div>
        </div>
        <div class="notification-list">
          <div class="notification-empty">
            <i class="fas fa-bell-slash"></i>
            <p>Không có thông báo mới</p>
          </div>
        </div>
        <div class="notification-dropdown-footer">
          <a href="${this.rootPath}notifications.html">Xem tất cả thông báo</a>
        </div>
      </div>
    `;

    // Event listeners
    const bellBtn = wrapper.querySelector(".notification-bell-btn");
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleDropdown(wrapper);
    });

    const markAllBtn = wrapper.querySelector(".mark-all-read-btn");
    markAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.notificationService.markAllAsRead();
    });

    // Chèn vào user-area (sau theme toggle, trước avatar)
    const avatarWrapper = userArea.querySelector(".avatar-dropdown-wrapper");
    if (avatarWrapper) {
      userArea.insertBefore(wrapper, avatarWrapper);
    } else {
      userArea.appendChild(wrapper);
    }

    this.container = wrapper;
  }

  /**
   * Chèn bell icon vào mobile navigation
   */
  _insertBellIconMobile(navList) {
    // Xóa bell cũ nếu có
    const existingBell = navList.querySelector(".notification-bell-wrapper");
    if (existingBell) {
      existingBell.remove();
    }

    // Tạo wrapper (li cho mobile nav)
    const wrapper = document.createElement("li");
    wrapper.className = "notification-bell-wrapper auth-item";

    wrapper.innerHTML = `
      <button class="notification-bell-btn" title="Thông báo">
        <i class="fas fa-bell"></i>
        <span class="notification-badge" style="display: none;">0</span>
      </button>
      <div class="notification-dropdown">
        <div class="notification-dropdown-header">
          <h4>Thông Báo</h4>
          <div class="notification-header-actions">
            <button class="mark-all-read-btn" title="Đánh dấu tất cả đã đọc">
              <i class="fas fa-check-double"></i>
            </button>
          </div>
        </div>
        <div class="notification-list">
          <div class="notification-empty">
            <i class="fas fa-bell-slash"></i>
            <p>Không có thông báo mới</p>
          </div>
        </div>
        <div class="notification-dropdown-footer">
          <a href="${this.rootPath}notifications.html">Xem tất cả thông báo</a>
        </div>
      </div>
    `;

    // Event listeners
    const bellBtn = wrapper.querySelector(".notification-bell-btn");
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleDropdown(wrapper);
    });

    const markAllBtn = wrapper.querySelector(".mark-all-read-btn");
    markAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.notificationService.markAllAsRead();
    });

    // Chèn sau các menu items chính, trước auth items
    const divider = navList.querySelector(".nav-mobile-divider");
    if (divider) {
      navList.insertBefore(wrapper, divider);
    } else {
      // Fallback: chèn ở cuối
      navList.appendChild(wrapper);
    }
  }

  /**
   * Toggle dropdown
   */
  _toggleDropdown(wrapper) {
    const dropdown = wrapper.querySelector(".notification-dropdown");
    this.dropdownOpen = !this.dropdownOpen;

    if (this.dropdownOpen) {
      dropdown.classList.add("show");
      this._renderNotificationList(this.notificationService.getNotifications());
    } else {
      dropdown.classList.remove("show");
    }
  }

  /**
   * Xử lý click bên ngoài dropdown
   */
  _handleOutsideClick(e) {
    if (!this.dropdownOpen) return;

    const bellWrappers = document.querySelectorAll(
      ".notification-bell-wrapper",
    );
    let clickedInside = false;

    bellWrappers.forEach((wrapper) => {
      if (wrapper.contains(e.target)) {
        clickedInside = true;
      }
    });

    if (!clickedInside) {
      this.dropdownOpen = false;
      bellWrappers.forEach((wrapper) => {
        const dropdown = wrapper.querySelector(".notification-dropdown");
        if (dropdown) dropdown.classList.remove("show");
      });
    }
  }

  /**
   * Cập nhật badge số thông báo
   */
  _updateBadge(count) {
    const badges = document.querySelectorAll(".notification-badge");
    badges.forEach((badge) => {
      if (count > 0) {
        badge.textContent = count > 99 ? "99+" : count;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    });
  }

  /**
   * Render danh sách thông báo trong dropdown
   */
  _renderNotificationList(notifications) {
    const lists = document.querySelectorAll(
      ".notification-dropdown .notification-list",
    );

    lists.forEach((list) => {
      if (!notifications || notifications.length === 0) {
        list.innerHTML = `
          <div class="notification-empty">
            <i class="fas fa-bell-slash"></i>
            <p>Không có thông báo mới</p>
          </div>
        `;
        return;
      }

      // Hiển thị tối đa 10 thông báo gần nhất
      const recentNotifs = notifications.slice(0, 10);

      list.innerHTML = recentNotifs
        .map((notif) => this._renderNotificationItem(notif))
        .join("");

      // Gắn event listeners
      list.querySelectorAll(".notification-item").forEach((item) => {
        const notifId = item.dataset.id;

        item.addEventListener("click", () => {
          const notif = notifications.find((n) => n.id === notifId);
          if (notif) {
            this.notificationService.markAsRead(notifId);
            if (notif.link) {
              window.location.href = notif.link;
            }
          }
        });

        // Delete button
        const deleteBtn = item.querySelector(".notification-delete-btn");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.notificationService.deleteNotification(notifId);
          });
        }
      });
    });
  }

  /**
   * Render một notification item
   */
  _renderNotificationItem(notif) {
    const icon = NOTIFICATION_ICONS[notif.type] || "fa-bell";
    const color = NOTIFICATION_COLORS[notif.type] || "#64748b";
    const timeAgo = this._formatTimeAgo(notif.createdAt);
    const readClass = notif.read ? "read" : "unread";

    return `
      <div class="notification-item ${readClass}" data-id="${notif.id}">
        <div class="notification-item-icon" style="background: ${color}15; color: ${color}">
          <i class="fas ${icon}"></i>
        </div>
        <div class="notification-item-content">
          <div class="notification-item-title">${notif.title || "Thông báo"}</div>
          <div class="notification-item-message">${notif.message}</div>
          <div class="notification-item-time">${timeAgo}</div>
        </div>
        <button class="notification-delete-btn" title="Xóa">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }

  /**
   * Format thời gian tương đối
   */
  _formatTimeAgo(timestamp) {
    if (!timestamp) return "";

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;

    // Format date
    const date = new Date(timestamp);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  /**
   * Dọn dẹp khi đăng xuất
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.notificationService.destroy();

    // Xóa UI
    const bellWrappers = document.querySelectorAll(
      ".notification-bell-wrapper",
    );
    bellWrappers.forEach((wrapper) => wrapper.remove());

    document.removeEventListener("click", this._handleOutsideClick);
  }
}

// Singleton instance
let notificationBellInstance = null;

/**
 * Lấy instance của NotificationBell (singleton)
 */
export function getNotificationBell(options = {}) {
  if (!notificationBellInstance) {
    notificationBellInstance = new NotificationBell(options);
  }
  return notificationBellInstance;
}

/**
 * Khởi tạo NotificationBell khi user đăng nhập
 * @param {string} userId - ID của user
 * @param {Object} options - Tùy chọn
 */
export function initNotificationBell(userId, options = {}) {
  const bell = getNotificationBell(options);
  bell.init(userId);
  return bell;
}

/**
 * Hủy NotificationBell khi user đăng xuất
 */
export function destroyNotificationBell() {
  if (notificationBellInstance) {
    notificationBellInstance.destroy();
    notificationBellInstance = null;
  }
}
