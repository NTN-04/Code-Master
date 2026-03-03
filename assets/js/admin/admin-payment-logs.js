import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
  query,
  orderByChild,
  limitToLast,
  onValue,
  off,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { formatDateTime } from "../utils/date.js";
import { sanitizeText } from "../utils/sanitize.js";

/**
 * Admin Payment Logs Manager
 * Xem logs thanh toán từ SePay webhook
 */
export default class PaymentLogsManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.logs = [];
    this.logsListenerRef = null;
    this.logsListenerCallback = null;
  }

  /**
   * Load payment logs với realtime listener
   */
  async loadData() {
    const container = document.getElementById("payment-logs-body");
    if (container) {
      container.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            <div class="loading-courses">
              <span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span>
              <span>Đang tải logs...</span>
            </div>
          </td>
        </tr>
      `;
    }

    // Cleanup previous listener
    this.cleanupListener();

    // Setup realtime listener
    this.logsListenerRef = query(
      ref(database, "paymentLogs"),
      orderByChild("timestamp"),
      limitToLast(100),
    );

    this.logsListenerCallback = (snapshot) => {
      if (snapshot.exists()) {
        this.logs = Object.entries(snapshot.val())
          .map(([id, data]) => ({
            id,
            ...data,
          }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      } else {
        this.logs = [];
      }

      this.renderLogsTable();
      this.updateStatistics();
    };

    onValue(this.logsListenerRef, this.logsListenerCallback, (error) => {
      console.error("Error loading payment logs:", error);
      this.adminPanel.showNotification("Lỗi tải logs thanh toán", "error");
    });
  }

  /**
   * Cleanup listener
   */
  cleanupListener() {
    if (this.logsListenerRef && this.logsListenerCallback) {
      off(this.logsListenerRef, "value", this.logsListenerCallback);
      this.logsListenerRef = null;
      this.logsListenerCallback = null;
    }
  }

  /**
   * Render logs table
   */
  renderLogsTable() {
    const tbody = document.getElementById("payment-logs-body");
    if (!tbody) return;

    if (this.logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            <div class="empty-state">
              <i class="fas fa-file-alt"></i>
              <p>Chưa có logs thanh toán</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.logs.map((log) => this.renderLogRow(log)).join("");
  }

  /**
   * Render single log row
   */
  renderLogRow(log) {
    const safeOrderId = sanitizeText(log.orderId || "");
    const safeTransactionId = sanitizeText(log.transactionId || "N/A");
    const logTime = formatDateTime(log.timestamp);

    const statusClass =
      log.type === "success" ? "status-active" : "status-inactive";
    const statusText = log.type === "success" ? "Thành công" : "Lỗi";
    const statusIcon =
      log.type === "success" ? "fa-check-circle" : "fa-times-circle";

    return `
      <tr>
        <td>
          <span class="status-badge ${statusClass}">
            <i class="fas ${statusIcon}"></i> ${statusText}
          </span>
        </td>
        <td><code>${safeOrderId}</code></td>
        <td><code>${safeTransactionId}</code></td>
        <td>${log.amount ? log.amount.toLocaleString("vi-VN") + " đ" : "N/A"}</td>
        <td>${logTime}</td>
        <td>
          ${log.type === "error" ? `<span class="error-message">${sanitizeText(log.error || "")}</span>` : "-"}
        </td>
      </tr>
    `;
  }

  /**
   * Update statistics
   */
  updateStatistics() {
    const successCount = this.logs.filter((l) => l.type === "success").length;
    const errorCount = this.logs.filter((l) => l.type === "error").length;

    const successEl = document.getElementById("logs-success-count");
    const errorEl = document.getElementById("logs-error-count");

    if (successEl) successEl.textContent = successCount;
    if (errorEl) errorEl.textContent = errorCount;
  }
}
