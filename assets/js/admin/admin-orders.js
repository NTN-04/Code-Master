import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
  update,
  onValue,
  off,
  query,
  orderByChild,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { formatCurrency } from "../pay/vietqr-service.js";
import { sanitizeText } from "../utils/sanitize.js";
import { formatDateTime } from "../utils/date.js";

/**
 * Admin Orders Manager
 * Quản lý đơn hàng thanh toán khóa học PRO
 */
export default class OrdersManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.orders = [];
    this.courses = {};
    this.users = {};

    // Listener management
    this.ordersListenerRef = null;
    this.ordersListenerCallback = null;

    // Filter state
    this.currentFilter = {
      status: "all",
      search: "",
      dateFrom: "",
      dateTo: "",
    };
  }

  /**
   * Load orders data with realtime listener
   */
  async loadData() {
    const container = document.getElementById("orders-table-body");
    if (container) {
      container.innerHTML = `
        <tr>
          <td colspan="8" class="text-center">
            <div class="loading-courses">
              <span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span>
              <span>Đang tải danh sách đơn hàng...</span>
            </div>
          </td>
        </tr>
      `;
    }

    // Load courses and users for reference
    await this.loadReferenceData();

    // Cleanup previous listener
    this.cleanupListener();

    // Setup realtime listener for orders
    this.ordersListenerRef = ref(database, "orders");
    this.ordersListenerCallback = (snapshot) => {
      if (snapshot.exists()) {
        this.orders = Object.entries(snapshot.val())
          .map(([id, data]) => ({
            id,
            ...data,
          }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else {
        this.orders = [];
      }

      this.renderOrdersTable();
      this.updateStatistics();
    };

    onValue(this.ordersListenerRef, this.ordersListenerCallback, (error) => {
      console.error("Error loading orders:", error);
      this.adminPanel.showNotification("Lỗi tải dữ liệu đơn hàng", "error");
    });
  }

  /**
   * Load courses and users for display
   */
  async loadReferenceData() {
    try {
      const [coursesSnap, usersSnap] = await Promise.all([
        get(ref(database, "courses")),
        get(ref(database, "users")),
      ]);

      if (coursesSnap.exists()) {
        this.courses = coursesSnap.val();
      }
      if (usersSnap.exists()) {
        this.users = usersSnap.val();
      }
    } catch (error) {
      console.error("Error loading reference data:", error);
    }
  }

  /**
   * Cleanup realtime listener
   */
  cleanupListener() {
    if (this.ordersListenerRef && this.ordersListenerCallback) {
      off(this.ordersListenerRef, "value", this.ordersListenerCallback);
      this.ordersListenerRef = null;
      this.ordersListenerCallback = null;
    }
  }

  /**
   * Get filtered orders based on current filter state
   */
  getFilteredOrders() {
    return this.orders.filter((order) => {
      // Status filter
      if (
        this.currentFilter.status !== "all" &&
        order.status !== this.currentFilter.status
      ) {
        return false;
      }

      // Search filter (order ID, user email, course name)
      if (this.currentFilter.search) {
        const searchLower = this.currentFilter.search.toLowerCase();
        const user = this.users[order.userId];
        const course = this.courses[order.courseId];

        const matchOrderId = order.orderId?.toLowerCase().includes(searchLower);
        const matchEmail = user?.email?.toLowerCase().includes(searchLower);
        const matchCourse = course?.title?.toLowerCase().includes(searchLower);
        const matchUserName = user?.username
          ?.toLowerCase()
          .includes(searchLower);

        if (!matchOrderId && !matchEmail && !matchCourse && !matchUserName) {
          return false;
        }
      }

      // Date range filter
      if (this.currentFilter.dateFrom) {
        const orderDate = new Date(order.createdAt);
        const fromDate = new Date(this.currentFilter.dateFrom);
        if (orderDate < fromDate) return false;
      }

      if (this.currentFilter.dateTo) {
        const orderDate = new Date(order.createdAt);
        const toDate = new Date(this.currentFilter.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (orderDate > toDate) return false;
      }

      return true;
    });
  }

  /**
   * Render orders table
   */
  renderOrdersTable() {
    const tbody = document.getElementById("orders-table-body");
    if (!tbody) return;

    const filteredOrders = this.getFilteredOrders();

    if (filteredOrders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center">
            <div class="empty-state">
              <i class="fas fa-receipt"></i>
              <p>Không có đơn hàng nào</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredOrders
      .map((order) => this.renderOrderRow(order))
      .join("");
  }

  /**
   * Render single order row
   */
  renderOrderRow(order) {
    const user = this.users[order.userId] || {};
    const course = this.courses[order.courseId] || {};

    const statusConfig = this.getStatusConfig(order.status);
    const createdDate = formatDateTime(order.createdAt);

    // Sanitize all dynamic data for XSS protection
    const safeOrderId = sanitizeText(order.orderId || "");
    const safeUserName = sanitizeText(user.username || "N/A");
    const safeUserEmail = sanitizeText(user.email || "N/A");
    const safeUserAvatar = sanitizeText(
      user.avatar || "./assets/images/default-avatar.png",
    );
    const safeCourseTitle = sanitizeText(
      course.title || order.courseId || "N/A",
    );
    const safePaymentMethod = sanitizeText(order.paymentMethod || "VietQR");

    return `
      <tr data-order-id="${safeOrderId}">
        <td>
          <div class="order-id">
            <code>${safeOrderId}</code>
            <button class="btn-icon btn-copy" onclick="navigator.clipboard.writeText('${safeOrderId}')" title="Copy">
              <i class="fas fa-copy"></i>
            </button>
          </div>
        </td>
        <td>
          <div class="user-info-cell">
            <img src="${safeUserAvatar}" alt="Avatar" class="user-avatar-small">
            <div>
              <div class="user-name">${safeUserName}</div>
              <div class="user-email">${safeUserEmail}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="course-info-cell">
            <span class="course-name">${safeCourseTitle}</span>
          </div>
        </td>
        <td class="amount-cell">
          <strong>${formatCurrency(order.amount)}</strong>
        </td>
        <td>
          <span class="status-badge ${statusConfig.class}">${statusConfig.text}</span>
        </td>
        <td>${safePaymentMethod}</td>
        <td>${createdDate}</td>
        <td>
          <div class="action-buttons">
            ${
              order.status === "pending"
                ? `
              <button class="btn btn-sm btn-success" onclick="window.adminPanel.orders.confirmPayment('${safeOrderId}')" title="Xác nhận thanh toán">
                <i class="fas fa-check"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="window.adminPanel.orders.cancelOrder('${safeOrderId}')" title="Hủy đơn">
                <i class="fas fa-times"></i>
              </button>
            `
                : ""
            }
            <button class="btn btn-sm btn-secondary" onclick="window.adminPanel.orders.viewOrderDetail('${safeOrderId}')" title="Xem chi tiết">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Get status configuration for display
   */
  getStatusConfig(status) {
    const configs = {
      pending: { class: "status-pending", text: "Chờ thanh toán" },
      completed: { class: "status-active", text: "Hoàn thành" },
      failed: { class: "status-inactive", text: "Thất bại" },
      cancelled: { class: "status-inactive", text: "Đã hủy" },
      refunded: { class: "status-warning", text: "Hoàn tiền" },
    };
    return configs[status] || { class: "status-inactive", text: status };
  }

  /**
   * Update statistics cards
   */
  updateStatistics() {
    const stats = {
      total: this.orders.length,
      pending: this.orders.filter((o) => o.status === "pending").length,
      completed: this.orders.filter((o) => o.status === "completed").length,
      revenue: this.orders
        .filter((o) => o.status === "completed")
        .reduce((sum, o) => sum + (o.amount || 0), 0),
    };

    // Update stat cards
    const totalEl = document.getElementById("orders-total");
    const pendingEl = document.getElementById("orders-pending");
    const completedEl = document.getElementById("orders-completed");
    const revenueEl = document.getElementById("orders-revenue");

    if (totalEl) totalEl.textContent = stats.total;
    if (pendingEl) pendingEl.textContent = stats.pending;
    if (completedEl) completedEl.textContent = stats.completed;
    if (revenueEl) revenueEl.textContent = formatCurrency(stats.revenue);
  }

  /**
   * Confirm payment manually
   */
  async confirmPayment(orderId) {
    if (
      !confirm(
        `Xác nhận đã nhận thanh toán cho đơn hàng ${orderId}?\n\nHành động này sẽ:\n- Cập nhật trạng thái đơn hàng thành "Hoàn thành"\n- Tự động ghi danh học viên vào khóa học`,
      )
    ) {
      return;
    }

    try {
      const order = this.orders.find((o) => o.orderId === orderId);
      if (!order) {
        throw new Error("Không tìm thấy đơn hàng");
      }

      const { userId, courseId } = order;
      if (!userId || !courseId) {
        throw new Error("Đơn hàng thiếu thông tin userId hoặc courseId");
      }

      // Import enrollAfterPayment
      const { enrollAfterPayment } = await import("../pay/payment-service.js");

      // Enroll user to course with correct parameters
      await enrollAfterPayment(userId, courseId, orderId);

      // Update order status to completed
      const orderRef = ref(database, `orders/${orderId}`);
      await update(orderRef, {
        status: "completed",
        completedAt: new Date().toISOString(),
        confirmedBy: this.adminPanel.currentUser?.uid || "admin",
      });

      this.adminPanel.showNotification(
        `Đã xác nhận thanh toán và ghi danh học viên thành công!`,
        "success",
      );

      // Log activity
      this.adminPanel.logActivity(
        "order",
        "Xác nhận thanh toán",
        `Đơn hàng ${orderId} đã được xác nhận thanh toán`,
        "fas fa-check-circle",
      );
    } catch (error) {
      console.error("Error confirming payment:", error);
      this.adminPanel.showNotification(
        `Lỗi xác nhận thanh toán: ${error.message}`,
        "error",
      );
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId) {
    if (!confirm(`Bạn có chắc muốn hủy đơn hàng ${orderId}?`)) {
      return;
    }

    try {
      const orderRef = ref(database, `orders/${orderId}`);
      await update(orderRef, {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledBy: this.adminPanel.currentUser?.uid || "admin",
      });

      this.adminPanel.showNotification(`Đã hủy đơn hàng ${orderId}`, "success");

      // Log activity
      this.adminPanel.logActivity(
        "order",
        "Hủy đơn hàng",
        `Đơn hàng ${orderId} đã bị hủy`,
        "fas fa-times-circle",
      );
    } catch (error) {
      console.error("Error cancelling order:", error);
      this.adminPanel.showNotification(
        `Lỗi hủy đơn hàng: ${error.message}`,
        "error",
      );
    }
  }

  /**
   * View order detail in modal
   */
  viewOrderDetail(orderId) {
    const order = this.orders.find((o) => o.orderId === orderId);
    if (!order) {
      this.adminPanel.showNotification("Không tìm thấy đơn hàng", "error");
      return;
    }

    const user = this.users[order.userId] || {};
    const course = this.courses[order.courseId] || {};
    const statusConfig = this.getStatusConfig(order.status);

    // Sanitize all dynamic data
    const safeOrderId = sanitizeText(order.orderId || "");
    const safeUserId = sanitizeText(order.userId || "");
    const safeCourseId = sanitizeText(order.courseId || "");
    const safeUserName = sanitizeText(user.username || "N/A");
    const safeUserEmail = sanitizeText(user.email || "N/A");
    const safeCourseTitle = sanitizeText(
      course.title || order.courseId || "N/A",
    );
    const safePaymentMethod = sanitizeText(order.paymentMethod || "VietQR");
    const safeTransferContent = order.transferContent
      ? sanitizeText(order.transferContent)
      : null;

    // Format dates
    const createdDate = formatDateTime(order.createdAt);
    const completedDate = order.completedAt
      ? formatDateTime(order.completedAt)
      : null;
    const cancelledDate = order.cancelledAt
      ? formatDateTime(order.cancelledAt)
      : null;

    const modalBody = document.getElementById("order-detail-body");
    if (!modalBody) return;

    modalBody.innerHTML = `
      <div class="order-detail">
        <div class="order-detail-section">
          <h4><i class="fas fa-receipt"></i> Thông tin đơn hàng</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Mã đơn hàng:</label>
              <span><code>${safeOrderId}</code></span>
            </div>
            <div class="detail-item">
              <label>Trạng thái:</label>
              <span class="status-badge ${statusConfig.class}">${statusConfig.text}</span>
            </div>
            <div class="detail-item">
              <label>Số tiền:</label>
              <span class="amount">${formatCurrency(order.amount)}</span>
            </div>
            <div class="detail-item">
              <label>Phương thức:</label>
              <span>${safePaymentMethod}</span>
            </div>
            <div class="detail-item">
              <label>Ngày tạo:</label>
              <span>${createdDate}</span>
            </div>
            ${
              completedDate
                ? `
              <div class="detail-item">
                <label>Ngày hoàn thành:</label>
                <span>${completedDate}</span>
              </div>
            `
                : ""
            }
            ${
              cancelledDate
                ? `
              <div class="detail-item">
                <label>Ngày hủy:</label>
                <span>${cancelledDate}</span>
              </div>
            `
                : ""
            }
          </div>
        </div>

        <div class="order-detail-section">
          <h4><i class="fas fa-user"></i> Thông tin khách hàng</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Tên:</label>
              <span>${safeUserName}</span>
            </div>
            <div class="detail-item">
              <label>Email:</label>
              <span>${safeUserEmail}</span>
            </div>
            <div class="detail-item">
              <label>User ID:</label>
              <span><code>${safeUserId}</code></span>
            </div>
          </div>
        </div>

        <div class="order-detail-section">
          <h4><i class="fas fa-book"></i> Thông tin khóa học</h4>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <label>Tên khóa học:</label>
              <span>${safeCourseTitle}</span>
            </div>
            <div class="detail-item">
              <label>Giá gốc:</label>
              <span>${formatCurrency(course.price || order.amount)}</span>
            </div>
            <div class="detail-item">
              <label>Course ID:</label>
              <span><code>${safeCourseId}</code></span>
            </div>
          </div>
        </div>

        ${
          safeTransferContent
            ? `
          <div class="order-detail-section">
            <h4><i class="fas fa-university"></i> Thông tin chuyển khoản</h4>
            <div class="detail-grid">
              <div class="detail-item full-width">
                <label>Nội dung CK:</label>
                <span><code>${safeTransferContent}</code></span>
              </div>
            </div>
          </div>
        `
            : ""
        }
      </div>
    `;

    this.adminPanel.showModal("order-detail-modal");
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Status filter
    const statusFilter = document.getElementById("orders-status-filter");
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        this.currentFilter.status = e.target.value;
        this.renderOrdersTable();
      });
    }

    // Search filter
    const searchInput = document.getElementById("orders-search");
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.currentFilter.search = e.target.value;
          this.renderOrdersTable();
        }, 300);
      });
    }

    // Date filters
    const dateFrom = document.getElementById("orders-date-from");
    const dateTo = document.getElementById("orders-date-to");

    if (dateFrom) {
      dateFrom.addEventListener("change", (e) => {
        this.currentFilter.dateFrom = e.target.value;
        this.renderOrdersTable();
      });
    }

    if (dateTo) {
      dateTo.addEventListener("change", (e) => {
        this.currentFilter.dateTo = e.target.value;
        this.renderOrdersTable();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById("orders-refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.loadData();
        this.adminPanel.showNotification(
          "Đã làm mới danh sách đơn hàng",
          "success",
        );
      });
    }

    // Export button
    const exportBtn = document.getElementById("orders-export-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportOrders());
    }
  }

  /**
   * Export orders to CSV
   */
  exportOrders() {
    const filteredOrders = this.getFilteredOrders();
    if (filteredOrders.length === 0) {
      this.adminPanel.showNotification("Không có dữ liệu để xuất", "warning");
      return;
    }

    const headers = [
      "Mã đơn hàng",
      "Khách hàng",
      "Email",
      "Khóa học",
      "Số tiền",
      "Trạng thái",
      "Phương thức",
      "Ngày tạo",
    ];

    const rows = filteredOrders.map((order) => {
      const user = this.users[order.userId] || {};
      const course = this.courses[order.courseId] || {};
      return [
        order.orderId,
        user.username || "N/A",
        user.email || "N/A",
        course.title || order.courseId,
        order.amount,
        order.status,
        order.paymentMethod || "VietQR",
        new Date(order.createdAt).toLocaleString("vi-VN"),
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Download file
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `orders_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    this.adminPanel.showNotification(
      `Đã xuất ${filteredOrders.length} đơn hàng`,
      "success",
    );
  }
}
