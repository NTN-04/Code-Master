/**
 * notifications-page.js
 * Trang hiển thị tất cả thông báo của người dùng
 */

import { database } from "./firebaseConfig.js";
import {
  ref,
  query,
  orderByChild,
  limitToLast,
  get,
  update,
  remove,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { NOTIFICATION_TYPES } from "./utils/notifications.js";

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

// Filter type mapping
const FILTER_TYPE_MAP = {
  all: null,
  unread: "unread",
  payment: [
    NOTIFICATION_TYPES.PAYMENT_SUCCESS,
    NOTIFICATION_TYPES.PAYMENT_FAILED,
  ],
  course: [
    NOTIFICATION_TYPES.COURSE_ENROLLED,
    NOTIFICATION_TYPES.COURSE_COMPLETED,
    NOTIFICATION_TYPES.PROGRESS_MILESTONE,
    NOTIFICATION_TYPES.NEW_COURSE,
  ],
  comment: [
    NOTIFICATION_TYPES.COMMENT_REPLY,
    NOTIFICATION_TYPES.COMMENT_MENTION,
  ],
  system: [NOTIFICATION_TYPES.SYSTEM, NOTIFICATION_TYPES.PROMOTION],
};

// State
let currentFilter = "all";
let allNotifications = [];
let filteredNotifications = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 20;

function normalizeTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function isNotificationRead(notif) {
  if (typeof notif?.read === "boolean") return notif.read;
  if (typeof notif?.isRead === "boolean") return notif.isRead;
  return false;
}

function normalizeNotification(notif) {
  const read = isNotificationRead(notif);
  return {
    ...notif,
    read,
    isRead: read,
    createdAt: normalizeTimestamp(notif?.createdAt),
    title: typeof notif?.title === "string" ? notif.title : "Thông báo",
    message: typeof notif?.message === "string" ? notif.message : "",
  };
}

// DOM Elements
const container = document.getElementById("notifications-container");
const actionsContainer = document.getElementById("notifications-actions");
const filterContainer = document.getElementById("notifications-filter");
const paginationContainer = document.getElementById("notifications-pagination");

/**
 * Lấy user data từ localStorage
 */
function getUserData() {
  return JSON.parse(localStorage.getItem("codemaster_user") || "null");
}

/**
 * Khởi tạo trang
 */
async function init() {
  const userData = getUserData();

  if (!userData || !userData.uid) {
    showLoginRequired();
    return;
  }

  // Setup filter tabs
  setupFilterTabs();

  // Setup action buttons
  setupActionButtons(userData.uid);

  // Load notifications
  await loadNotifications(userData.uid);
}

/**
 * Hiển thị yêu cầu đăng nhập
 */
function showLoginRequired() {
  container.innerHTML = `
    <div class="login-required">
      <i class="fas fa-lock"></i>
      <h3>Yêu cầu đăng nhập</h3>
      <p>Vui lòng đăng nhập để xem thông báo của bạn.</p>
      <a href="login.html">Đăng nhập ngay</a>
    </div>
  `;
  actionsContainer.style.display = "none";
  filterContainer.style.display = "none";
}

/**
 * Thiết lập các tab filter
 */
function setupFilterTabs() {
  const tabs = filterContainer.querySelectorAll(".filter-tab");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Update active state
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Apply filter
      currentFilter = tab.dataset.filter;
      currentPage = 1;
      applyFilter();
      renderNotifications();
    });
  });
}

/**
 * Thiết lập các nút action
 */
function setupActionButtons(userId) {
  const markAllBtn = document.getElementById("mark-all-btn");
  const clearAllBtn = document.getElementById("clear-all-btn");

  markAllBtn.addEventListener("click", async () => {
    await markAllAsRead(userId);
  });

  clearAllBtn.addEventListener("click", async () => {
    if (confirm("Bạn có chắc muốn xóa tất cả thông báo?")) {
      await clearAllNotifications(userId);
    }
  });

  // Pagination
  const prevBtn = document.getElementById("prev-page-btn");
  const nextBtn = document.getElementById("next-page-btn");

  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderNotifications();
    }
  });

  nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      renderNotifications();
    }
  });
}

/**
 * Tải danh sách thông báo
 */
async function loadNotifications(userId) {
  try {
    showLoading();

    const notificationsRef = ref(database, `notifications/${userId}`);

    // Thử query với orderByChild trước, fallback sang query đơn giản
    let snapshot;
    try {
      const notificationsQuery = query(
        notificationsRef,
        orderByChild("createdAt"),
        limitToLast(100),
      );
      snapshot = await get(notificationsQuery);
    } catch (indexError) {
      console.warn(
        "Index chưa được cấu hình, sử dụng query đơn giản:",
        indexError.message,
      );
      // Fallback: query không có orderByChild
      const simpleQuery = query(notificationsRef, limitToLast(100));
      snapshot = await get(simpleQuery);
    }

    allNotifications = [];

    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        allNotifications.push(
          normalizeNotification({
            id: child.key,
            ...child.val(),
          }),
        );
      });

      // Sắp xếp theo createdAt giảm dần (mới nhất lên đầu)
      allNotifications.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    applyFilter();
    renderNotifications();
  } catch (error) {
    console.error("Error loading notifications:", error);
    showError();
  }
}

/**
 * Áp dụng filter
 */
function applyFilter() {
  if (currentFilter === "all") {
    filteredNotifications = [...allNotifications];
  } else if (currentFilter === "unread") {
    filteredNotifications = allNotifications.filter(
      (n) => !isNotificationRead(n),
    );
  } else {
    const types = FILTER_TYPE_MAP[currentFilter];
    if (types) {
      filteredNotifications = allNotifications.filter((n) =>
        types.includes(n.type),
      );
    } else {
      filteredNotifications = [...allNotifications];
    }
  }
}

/**
 * Render danh sách thông báo
 */
function renderNotifications() {
  if (filteredNotifications.length === 0) {
    showEmpty();
    paginationContainer.style.display = "none";
    return;
  }

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageNotifications = filteredNotifications.slice(startIndex, endIndex);

  container.innerHTML = pageNotifications
    .map((notif) => renderNotificationItem(notif))
    .join("");

  // Attach event listeners
  attachEventListeners();

  // Update pagination
  updatePagination(totalPages);
}

/**
 * Render một notification item
 */
function renderNotificationItem(notif) {
  const icon = NOTIFICATION_ICONS[notif.type] || "fa-bell";
  const color = NOTIFICATION_COLORS[notif.type] || "#64748b";
  const timeAgo = formatTimeAgo(notif.createdAt);
  const readClass = isNotificationRead(notif) ? "" : "unread";

  return `
    <div class="page-notification-item ${readClass}" data-id="${notif.id}">
      <div class="page-notification-icon" style="background: ${color}15; color: ${color}">
        <i class="fas ${icon}"></i>
      </div>
      <div class="page-notification-content">
        <div class="page-notification-title">${notif.title || "Thông báo"}</div>
        <div class="page-notification-message">${notif.message}</div>
        <div class="page-notification-time">
          <i class="far fa-clock"></i> ${timeAgo}
        </div>
      </div>
      <div class="page-notification-actions">
        ${
          !isNotificationRead(notif)
            ? `<button class="mark-read-btn" title="Đánh dấu đã đọc">
                <i class="fas fa-check"></i>
              </button>`
            : ""
        }
        <button class="delete-btn" title="Xóa">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners cho các notification items
 */
function attachEventListeners() {
  const userData = getUserData();
  if (!userData) return;

  const items = container.querySelectorAll(".page-notification-item");

  items.forEach((item) => {
    const notifId = item.dataset.id;
    const notif = allNotifications.find((n) => n.id === notifId);

    // Click item to open link
    item.addEventListener("click", (e) => {
      if (!e.target.closest("button")) {
        if (notif && notif.link) {
          markAsRead(userData.uid, notifId);
          window.location.href = notif.link;
        }
      }
    });

    // Mark as read button
    const markReadBtn = item.querySelector(".mark-read-btn");
    if (markReadBtn) {
      markReadBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await markAsRead(userData.uid, notifId);

        // Update local state
        const notifIndex = allNotifications.findIndex((n) => n.id === notifId);
        if (notifIndex !== -1) {
          allNotifications[notifIndex].read = true;
          allNotifications[notifIndex].isRead = true;
        }

        applyFilter();
        renderNotifications();
      });
    }

    // Delete button
    const deleteBtn = item.querySelector(".delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteNotification(userData.uid, notifId);

        // Update local state
        const notifIndex = allNotifications.findIndex((n) => n.id === notifId);
        if (notifIndex !== -1) {
          allNotifications.splice(notifIndex, 1);
        }

        applyFilter();
        renderNotifications();
      });
    }
  });
}

/**
 * Cập nhật pagination
 */
function updatePagination(totalPages) {
  if (totalPages <= 1) {
    paginationContainer.style.display = "none";
    return;
  }

  paginationContainer.style.display = "flex";

  const prevBtn = document.getElementById("prev-page-btn");
  const nextBtn = document.getElementById("next-page-btn");

  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

/**
 * Đánh dấu đã đọc
 */
async function markAsRead(userId, notificationId) {
  try {
    const notifRef = ref(database, `notifications/${userId}/${notificationId}`);
    await update(notifRef, { read: true, isRead: true });
  } catch (error) {
    console.error("Error marking as read:", error);
  }
}

/**
 * Đánh dấu tất cả đã đọc
 */
async function markAllAsRead(userId) {
  try {
    const updates = {};
    allNotifications.forEach((notif) => {
      if (!isNotificationRead(notif)) {
        updates[`notifications/${userId}/${notif.id}/read`] = true;
        updates[`notifications/${userId}/${notif.id}/isRead`] = true;
      }
    });

    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);

      // Update local state
      allNotifications.forEach((notif) => {
        notif.read = true;
        notif.isRead = true;
      });

      applyFilter();
      renderNotifications();
    }
  } catch (error) {
    console.error("Error marking all as read:", error);
  }
}

/**
 * Xóa một thông báo
 */
async function deleteNotification(userId, notificationId) {
  try {
    const notifRef = ref(database, `notifications/${userId}/${notificationId}`);
    await remove(notifRef);
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
}

/**
 * Xóa tất cả thông báo
 */
async function clearAllNotifications(userId) {
  try {
    const notificationsRef = ref(database, `notifications/${userId}`);
    await remove(notificationsRef);

    // Update local state
    allNotifications = [];
    applyFilter();
    renderNotifications();
  } catch (error) {
    console.error("Error clearing all notifications:", error);
  }
}

/**
 * Hiển thị loading state
 */
function showLoading() {
  container.innerHTML = `
    <div class="notifications-loading">
      <i class="fas fa-spinner"></i>
      <p>Đang tải thông báo...</p>
    </div>
  `;
}

/**
 * Hiển thị empty state
 */
function showEmpty() {
  const message =
    currentFilter === "all"
      ? "Bạn chưa có thông báo nào."
      : "Không có thông báo nào trong danh mục này.";

  container.innerHTML = `
    <div class="notifications-empty">
      <i class="fas fa-bell-slash"></i>
      <h3>Không có thông báo</h3>
      <p>${message}</p>
    </div>
  `;
}

/**
 * Hiển thị error state
 */
function showError() {
  container.innerHTML = `
    <div class="notifications-empty">
      <i class="fas fa-exclamation-triangle"></i>
      <h3>Đã xảy ra lỗi</h3>
      <p>Không thể tải thông báo. Vui lòng thử lại sau.</p>
    </div>
  `;
}

/**
 * Format thời gian tương đối
 */
function formatTimeAgo(timestamp) {
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", init);
