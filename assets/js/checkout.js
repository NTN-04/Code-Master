/**
 * Checkout Page - Xử lý thanh toán khóa học
 * CodeMaster - Hệ thống khóa học lập trình
 */

import { database, auth } from "./firebaseConfig.js";
import {
  ref,
  get,
  onValue,
  off,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { showFloatingNotification as showNotification } from "./utils/notifications.js";
import { sanitizeText } from "./utils/sanitize.js";
import { formatDateTime } from "./utils/date.js";

// Import payment services
import {
  createOrder,
  getOrderById,
  getPendingOrder,
  updateOrderStatus,
  enrollAfterPayment,
  checkPurchaseStatus,
  isOrderExpired,
  cancelOrderByOwner,
  ORDER_STATUS,
  ORDER_TIMEOUT_MINUTES,
  ERROR_MESSAGES,
} from "./pay/payment-service.js";

import {
  generateVietQRUrl,
  getBankInfo,
  getTransferContent,
  formatCurrency,
  formatAmount,
} from "./pay/vietqr-service.js";

// ============ STATE MANAGEMENT ============
let currentUser = null;
let currentCourseId = null;
let currentCourse = null;
let currentOrder = null;
let countdownInterval = null;
let orderCheckInterval = null;
let orderRealtimeRef = null;
let qrRetryCount = 0;
const MAX_QR_RETRIES = 3;

// ============ INITIALIZATION ============
document.addEventListener("DOMContentLoaded", async () => {
  // Get courseId from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentCourseId = urlParams.get("courseId");

  if (!currentCourseId) {
    showNotification("Không tìm thấy thông tin khóa học.", "error");
    setTimeout(() => {
      window.location.href = "courses.html";
    }, 2000);
    return;
  }

  // Set back link
  document.getElementById("back-link").href =
    `course-intro.html?id=${currentCourseId}`;

  // Listen to auth state
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showNotification("Vui lòng đăng nhập để thanh toán.", "error");
      setTimeout(() => {
        window.location.href = `login.html?redirect=checkout.html?courseId=${currentCourseId}`;
      }, 2000);
      return;
    }

    currentUser = user;
    await initCheckout();
  });

  // Setup event listeners
  setupEventListeners();
});

// ============ MAIN FUNCTIONS ============

/**
 * Khởi tạo trang checkout
 */
async function initCheckout() {
  try {
    // 1. Load course info
    await loadCourseInfo();

    // 2. Check if already purchased
    const hasPurchased = await checkPurchaseStatus(
      currentUser.uid,
      currentCourseId,
    );
    if (hasPurchased) {
      showNotification(
        ERROR_MESSAGES.ALREADY_PURCHASED || "Bạn đã sở hữu khóa học này!",
        "info",
      );
      setTimeout(() => {
        window.location.href = `course-detail.html?id=${currentCourseId}`;
      }, 2000);
      return;
    }

    // 3. Check for existing pending order
    const pendingOrder = await getPendingOrder(
      currentUser.uid,
      currentCourseId,
    );

    if (pendingOrder) {
      // Check if pending order is expired
      if (isOrderExpired(pendingOrder)) {
        showNotification("Đơn hàng cũ đã hết hạn. Đang tạo đơn mới...", "info");
        currentOrder = await createOrder(currentUser.uid, currentCourseId, {
          title: currentCourse.title,
          price: currentCourse.price,
          thumbnail: currentCourse.image,
        });
      } else {
        // Resume existing order
        currentOrder = pendingOrder;
        showNotification("Đang tiếp tục đơn hàng trước đó...", "info");
      }
    } else {
      // Create new order
      currentOrder = await createOrder(currentUser.uid, currentCourseId, {
        title: currentCourse.title,
        price: currentCourse.price,
        thumbnail: currentCourse.image,
      });
    }

    // 4. Generate QR code
    await generateQRCode();

    // 5. Start countdown
    startCountdown();

    // 6. Start polling for payment status
    startOrderStatusPolling();
  } catch (error) {
    console.error("Error initializing checkout:", error);

    // Show user-friendly error message
    const errorMessage =
      error.message ||
      ERROR_MESSAGES.CREATE_FAILED ||
      "Có lỗi xảy ra. Vui lòng thử lại.";
    showNotification(errorMessage, "error");

    // Show error state in UI
    const qrLoading = document.getElementById("qr-loading");
    if (qrLoading) {
      qrLoading.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <p>${sanitizeText(errorMessage)}</p>
        <a href="course-intro.html?id=${currentCourseId}" class="btn btn-primary">
          Quay lại
        </a>
      `;
    }
  }
}

/**
 * Load thông tin khóa học
 */
async function loadCourseInfo() {
  try {
    const courseRef = ref(database, `courses/${currentCourseId}`);
    const snapshot = await get(courseRef);

    if (!snapshot.exists()) {
      throw new Error("Course not found");
    }

    currentCourse = snapshot.val();

    // Check if free course (shouldn't be here)
    if (!currentCourse.price || currentCourse.price <= 0) {
      showNotification("Khóa học này miễn phí!", "info");
      setTimeout(() => {
        window.location.href = `course-intro.html?id=${currentCourseId}`;
      }, 2000);
      return;
    }

    // Render course info
    renderCourseInfo();
  } catch (error) {
    console.error("Error loading course:", error);
    throw error;
  }
}

/**
 * Render thông tin khóa học lên UI
 */
function renderCourseInfo() {
  // Course summary - use sanitized text for safety
  const thumbnailEl = document.getElementById("checkout-course-thumbnail");
  const titleEl = document.getElementById("checkout-course-title");
  const levelEl = document.getElementById("checkout-course-level");
  const instructorEl = document.getElementById("checkout-course-instructor");

  // Use course.image field from Firebase (not sanitizeText for URLs)
  const imageUrl = currentCourse.image || "./assets/images/img-course/html-css.png";
  thumbnailEl.src = imageUrl;
  thumbnailEl.alt = sanitizeText(currentCourse.title || "Khóa học");
  thumbnailEl.onerror = function() {
    this.src = "./assets/images/img-course/html-css.png";
  };
  
  titleEl.textContent = sanitizeText(currentCourse.title || "");
  levelEl.textContent = getLevelText(currentCourse.level);
  instructorEl.textContent = sanitizeText(
    currentCourse.instructor || "CodeMaster",
  );

  // Price - sử dụng originalPrice nếu có, nếu không thì dùng price
  const price = Number(currentCourse.price) || 0;
  const originalPrice = Number(currentCourse.originalPrice) || 0;
  const displayOriginalPrice = originalPrice > price ? originalPrice : price;
  const hasDiscount = originalPrice > price && price > 0;
  
  // Hiển thị giá gốc
  const originalPriceEl = document.getElementById("checkout-original-price");
  originalPriceEl.textContent = formatCurrency(displayOriginalPrice);
  
  // Hiển thị giảm giá nếu có
  const discountRow = document.getElementById("checkout-discount-row");
  const discountEl = document.getElementById("checkout-discount");
  if (hasDiscount) {
    const discountAmount = originalPrice - price;
    const discountPercent = Math.round((discountAmount / originalPrice) * 100);
    discountRow.style.display = "flex";
    discountEl.textContent = `-${formatCurrency(discountAmount)} (-${discountPercent}%)`;
    originalPriceEl.style.textDecoration = "line-through";
    originalPriceEl.style.color = "#888";
  } else {
    discountRow.style.display = "none";
    originalPriceEl.style.textDecoration = "none";
    originalPriceEl.style.color = "";
  }
  
  // Tổng thanh toán (luôn là price - giá thực tế)
  document.getElementById("checkout-total-price").textContent =
    formatCurrency(price);
  document.getElementById("transfer-amount").textContent =
    formatCurrency(price);
}

/**
 * Tạo và hiển thị QR code
 */
async function generateQRCode() {
  const qrLoading = document.getElementById("qr-loading");
  const qrImage = document.getElementById("qr-code-image");
  const qrContainer =
    qrImage.closest(".qr-code-container") || qrImage.parentElement;

  // Show loading
  qrLoading.style.display = "flex";
  qrLoading.innerHTML = `
    <i class="fas fa-spinner fa-spin"></i>
    <p>Đang tạo mã QR...</p>
  `;
  qrImage.style.display = "none";

  try {
    // Generate QR URL
    const qrUrl = generateVietQRUrl(currentOrder.amount, currentOrder.orderId);

    // Load image with retry
    qrImage.onload = () => {
      qrLoading.style.display = "none";
      qrImage.style.display = "block";
      qrRetryCount = 0; // Reset retry count on success
    };

    qrImage.onerror = () => {
      if (qrRetryCount < MAX_QR_RETRIES) {
        qrRetryCount++;
        setTimeout(() => {
          qrImage.src = qrUrl + "&retry=" + qrRetryCount;
        }, 1000 * qrRetryCount);
      } else {
        qrLoading.innerHTML = `
          <i class="fas fa-exclamation-triangle"></i>
          <p>Không thể tạo mã QR</p>
          <button class="retry-qr-btn" onclick="window.retryQR()">
            <i class="fas fa-redo"></i> Thử lại
          </button>
        `;
      }
    };

    qrImage.src = qrUrl;

    // Update bank info with sanitized text
    const bankInfo = getBankInfo();
    document.getElementById("bank-name").textContent = sanitizeText(
      bankInfo.bankName,
    );
    document.querySelector("#account-number span").textContent = sanitizeText(
      bankInfo.accountNo,
    );
    document.querySelector("#transfer-content span").textContent = sanitizeText(
      getTransferContent(currentOrder.orderId),
    );
  } catch (error) {
    console.error("Error generating QR:", error);
    qrLoading.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <p>Có lỗi xảy ra</p>
      <button class="retry-qr-btn" onclick="window.retryQR()">
        <i class="fas fa-redo"></i> Thử lại
      </button>
    `;
  }
}

// Global retry function for QR
window.retryQR = function () {
  qrRetryCount = 0;
  generateQRCode();
};

/**
 * Bắt đầu đếm ngược thời gian
 */
function startCountdown() {
  const timerEl = document.getElementById("countdown-timer");
  const orderCreatedAt = new Date(currentOrder.createdAt);
  const expiresAt = new Date(
    orderCreatedAt.getTime() + ORDER_TIMEOUT_MINUTES * 60 * 1000,
  );

  countdownInterval = setInterval(() => {
    const now = new Date();
    const diff = expiresAt - now;

    if (diff <= 0) {
      clearInterval(countdownInterval);
      timerEl.textContent = "00:00";
      handleOrderExpired();
      return;
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    timerEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    // Warning when less than 5 minutes
    if (minutes < 5) {
      timerEl.classList.add("warning");
    }
  }, 1000);
}

/**
 * Bắt đầu polling kiểm tra trạng thái đơn hàng
 */
function startOrderStatusPolling() {
  // Poll every 5 seconds
  orderCheckInterval = setInterval(async () => {
    try {
      const order = await getOrderById(currentOrder.orderId);

      if (order && order.status === ORDER_STATUS.COMPLETED) {
        handlePaymentSuccess(order);
      } else if (order && order.status === ORDER_STATUS.FAILED) {
        handlePaymentFailed();
      } else if (order && order.status === ORDER_STATUS.CANCELLED) {
        handleOrderCancelled();
      }
    } catch (error) {
      console.error("Error checking order status:", error);
    }
  }, 5000);

  // Also listen to realtime updates
  orderRealtimeRef = ref(database, `orders/${currentOrder.orderId}`);
  onValue(orderRealtimeRef, (snapshot) => {
    if (snapshot.exists()) {
      const order = snapshot.val();
      if (order.status === ORDER_STATUS.COMPLETED) {
        handlePaymentSuccess(order);
      } else if (order.status === ORDER_STATUS.FAILED) {
        handlePaymentFailed();
      } else if (order.status === ORDER_STATUS.CANCELLED) {
        handleOrderCancelled();
      }
    }
  });
}

/**
 * Xử lý khi đơn hàng hết hạn
 */
async function handleOrderExpired() {
  cleanupListeners();

  try {
    // Sử dụng cancelOrderByOwner để user có quyền cập nhật
    if (currentUser && currentOrder) {
      await cancelOrderByOwner(
        currentUser.uid,
        currentOrder.orderId,
        "Đơn hàng hết hạn",
      );
    }
  } catch (error) {
    console.error("Error cancelling expired order:", error);
  }

  // Show expired message
  document.getElementById("status-waiting").style.display = "none";
  document.getElementById("status-failed").style.display = "flex";
  document.querySelector("#status-failed span").textContent =
    "Đơn hàng đã hết hạn";

  showNotification("Đơn hàng đã hết hạn. Vui lòng thử lại.", "error");
}

/**
 * Xử lý khi đơn hàng bị hủy
 */
function handleOrderCancelled() {
  cleanupListeners();

  document.getElementById("status-waiting").style.display = "none";
  document.getElementById("status-failed").style.display = "flex";
  document.querySelector("#status-failed span").textContent =
    "Đơn hàng đã bị hủy";

  showNotification("Đơn hàng đã bị hủy.", "error");
}

/**
 * Xử lý khi thanh toán thành công
 */
async function handlePaymentSuccess(order) {
  cleanupListeners();

  // Update UI
  document.getElementById("status-waiting").style.display = "none";
  document.getElementById("status-success").style.display = "flex";

  try {
    // Enroll user in course
    await enrollAfterPayment(currentUser.uid, currentCourseId, order.orderId);

    showNotification("Thanh toán thành công!", "success");

    // Show success modal
    showSuccessModal();
  } catch (error) {
    console.error("Error enrolling after payment:", error);
    showNotification(
      "Thanh toán thành công! Đang xử lý đăng ký khóa học...",
      "info",
    );
  }
}

/**
 * Xử lý khi thanh toán thất bại
 */
function handlePaymentFailed() {
  cleanupListeners();

  document.getElementById("status-waiting").style.display = "none";
  document.getElementById("status-failed").style.display = "flex";

  showNotification("Thanh toán thất bại. Vui lòng thử lại.", "error");
}

/**
 * Hiển thị modal thành công
 */
function showSuccessModal() {
  const modal = document.getElementById("success-modal");
  modal.style.display = "flex";

  document.getElementById("start-learning-btn").onclick = () => {
    window.location.href = `course-detail.html?id=${currentCourseId}`;
  };
}

// ============ EVENT LISTENERS ============

function setupEventListeners() {
  // Copy buttons
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", handleCopy);
  });

  // Payment method selection
  document
    .querySelectorAll(".payment-option:not(.disabled)")
    .forEach((option) => {
      option.addEventListener("click", () => {
        document
          .querySelectorAll(".payment-option")
          .forEach((o) => o.classList.remove("active"));
        option.classList.add("active");
        option.querySelector("input").checked = true;
      });
    });
}

/**
 * Xử lý copy nội dung
 */
async function handleCopy(e) {
  const copyableEl = e.target.closest(".copyable");
  const textToCopy = copyableEl.querySelector("span").textContent;

  try {
    await navigator.clipboard.writeText(textToCopy);
    showNotification("Đã sao chép!", "success");

    // Visual feedback
    const btn = copyableEl.querySelector(".copy-btn i");
    const originalClass = btn.className;
    btn.className = "fas fa-check";
    setTimeout(() => {
      btn.className = originalClass;
    }, 2000);
  } catch (error) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showNotification("Đã sao chép!", "success");
    } catch (fallbackError) {
      showNotification("Không thể sao chép. Vui lòng copy thủ công.", "error");
    }
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Chuyển đổi level code thành text
 */
function getLevelText(level) {
  const levelMap = {
    beginner: "Cơ bản",
    intermediate: "Trung cấp",
    advanced: "Nâng cao",
  };
  return levelMap[level] || level || "N/A";
}

/**
 * Cleanup tất cả listeners và intervals
 */
function cleanupListeners() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (orderCheckInterval) {
    clearInterval(orderCheckInterval);
    orderCheckInterval = null;
  }
  if (orderRealtimeRef) {
    off(orderRealtimeRef);
    orderRealtimeRef = null;
  }
}

/**
 * Hủy đơn hàng hiện tại
 */
async function cancelCurrentOrder() {
  if (!currentOrder || !currentUser) return;

  const confirmed = confirm("Bạn có chắc muốn hủy đơn hàng này?");
  if (!confirmed) return;

  try {
    // Sử dụng cancelOrderByOwner thay vì updateOrderStatus
    // để user có quyền hủy đơn hàng của chính mình
    await cancelOrderByOwner(
      currentUser.uid,
      currentOrder.orderId,
      "Người dùng tự hủy",
    );
    showNotification("Đã hủy đơn hàng.", "info");

    // Redirect back to course intro
    setTimeout(() => {
      window.location.href = `course-intro.html?id=${currentCourseId}`;
    }, 1500);
  } catch (error) {
    console.error("Error cancelling order:", error);
    showNotification(
      error.message || "Không thể hủy đơn hàng. Vui lòng thử lại.",
      "error",
    );
  }
}

// Export for global access
window.cancelOrder = cancelCurrentOrder;

// ============ CLEANUP ============
window.addEventListener("beforeunload", () => {
  cleanupListeners();
});
