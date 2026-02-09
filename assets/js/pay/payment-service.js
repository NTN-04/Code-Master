/**
 * Payment Service - Quản lý đơn hàng và thanh toán
 * CodeMaster - Hệ thống khóa học lập trình
 */

import { database } from "../firebaseConfig.js";
import {
  ref,
  set,
  get,
  update,
  query,
  orderByChild,
  equalTo,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

// ============ CONSTANTS ============
export const ORDER_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

export const PAYMENT_METHODS = {
  VIETQR: "vietqr",
  VNPAY: "vnpay",
  MOMO: "momo",
};

// Order timeout in minutes
export const ORDER_TIMEOUT_MINUTES = 30;

// Error messages - user-friendly
export const ERROR_MESSAGES = {
  INVALID_USER_ID: "Vui lòng đăng nhập để thực hiện thanh toán.",
  INVALID_COURSE_ID: "Không tìm thấy thông tin khóa học.",
  INVALID_PRICE: "Giá khóa học không hợp lệ.",
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng.",
  ORDER_EXPIRED: "Đơn hàng đã hết hạn. Vui lòng tạo đơn mới.",
  ALREADY_PURCHASED: "Bạn đã sở hữu khóa học này.",
  CREATE_FAILED: "Không thể tạo đơn hàng. Vui lòng thử lại.",
  UPDATE_FAILED: "Không thể cập nhật đơn hàng. Vui lòng thử lại.",
  ENROLL_FAILED: "Không thể ghi danh. Vui lòng liên hệ hỗ trợ.",
  NETWORK_ERROR: "Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.",
};

// ============ VALIDATION HELPERS ============

/**
 * Validate userId
 * @param {string} userId
 * @returns {{valid: boolean, error?: string}}
 */
export function validateUserId(userId) {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return { valid: false, error: ERROR_MESSAGES.INVALID_USER_ID };
  }
  return { valid: true };
}

/**
 * Validate courseId
 * @param {string} courseId
 * @returns {{valid: boolean, error?: string}}
 */
export function validateCourseId(courseId) {
  if (!courseId || typeof courseId !== "string" || courseId.trim() === "") {
    return { valid: false, error: ERROR_MESSAGES.INVALID_COURSE_ID };
  }
  return { valid: true };
}

/**
 * Validate price
 * @param {number} price
 * @returns {{valid: boolean, error?: string}}
 */
export function validatePrice(price) {
  if (typeof price !== "number" || price <= 0 || !Number.isFinite(price)) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_PRICE };
  }
  return { valid: true };
}

/**
 * Validate order inputs
 * @param {string} userId
 * @param {string} courseId
 * @param {object} courseInfo
 * @returns {{valid: boolean, error?: string}}
 */
export function validateOrderInput(userId, courseId, courseInfo) {
  const userValidation = validateUserId(userId);
  if (!userValidation.valid) return userValidation;

  const courseValidation = validateCourseId(courseId);
  if (!courseValidation.valid) return courseValidation;

  const priceValidation = validatePrice(courseInfo?.price);
  if (!priceValidation.valid) return priceValidation;

  return { valid: true };
}

/**
 * Check if order is expired
 * @param {object} order
 * @returns {boolean}
 */
export function isOrderExpired(order) {
  if (!order || !order.createdAt) return true;

  const createdAt = new Date(order.createdAt);
  const now = new Date();
  const diffMinutes = (now - createdAt) / (1000 * 60);

  return diffMinutes > ORDER_TIMEOUT_MINUTES;
}

// ============ ORDER ID GENERATOR ============
/**
 * Tạo mã đơn hàng unique
 * Format: CM-{timestamp}-{random}
 * @returns {string} Order ID
 */
export function generateOrderId() {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CM-${timestamp}-${randomStr}`;
}

// Maximum pending orders per user (rate limiting)
const MAX_PENDING_ORDERS_PER_USER = 3;

// ============ ORDER CRUD OPERATIONS ============

/**
 * Tạo đơn hàng mới
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @param {object} courseInfo - Thông tin khóa học {title, price, thumbnail}
 * @param {string} paymentMethod - Phương thức thanh toán
 * @returns {Promise<object>} Order data
 * @throws {Error} Validation error or network error
 */
export async function createOrder(
  userId,
  courseId,
  courseInfo,
  paymentMethod = PAYMENT_METHODS.VIETQR,
) {
  // Validate inputs
  const validation = validateOrderInput(userId, courseId, courseInfo);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Rate limiting: Check pending orders count
  const pendingCount = await countPendingOrdersByUser(userId);
  if (pendingCount >= MAX_PENDING_ORDERS_PER_USER) {
    throw new Error(
      `Bạn đã có ${pendingCount} đơn hàng đang chờ. Vui lòng hoàn thành hoặc hủy trước khi tạo đơn mới.`,
    );
  }

  try {
    const orderId = generateOrderId();
    const now = new Date().toISOString();

    const orderData = {
      orderId,
      userId: userId.trim(),
      courseId: courseId.trim(),
      courseName: String(courseInfo.title || "Khóa học").trim(),
      courseThumbnail: courseInfo.thumbnail || null,
      amount: Math.round(courseInfo.price), // Ensure integer
      status: ORDER_STATUS.PENDING,
      paymentMethod,
      transactionId: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      expiresAt: new Date(
        Date.now() + ORDER_TIMEOUT_MINUTES * 60 * 1000,
      ).toISOString(),
      orderDescription: `CODEMASTER ${orderId}`,
      transferContent: `CODEMASTER ${orderId}`, // Nội dung chuyển khoản để tracking
      // Metadata for audit
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      ipAddress: null, // Sẽ được cập nhật từ server nếu có
    };

    const orderRef = ref(database, `orders/${orderId}`);
    await set(orderRef, orderData);

    console.log(`✅ Order created: ${orderId} for user ${userId}`);
    return orderData;
  } catch (error) {
    console.error("❌ Error creating order:", error);
    // Re-throw with user-friendly message
    if (error.message.includes("PERMISSION_DENIED")) {
      throw new Error(ERROR_MESSAGES.INVALID_USER_ID);
    }
    throw new Error(ERROR_MESSAGES.CREATE_FAILED);
  }
}

/**
 * Lấy thông tin đơn hàng theo ID
 * @param {string} orderId - Order ID
 * @returns {Promise<object|null>} Order data or null
 */
export async function getOrderById(orderId) {
  try {
    const orderRef = ref(database, `orders/${orderId}`);
    const snapshot = await get(orderRef);

    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error("❌ Error getting order:", error);
    throw error;
  }
}

/**
 * Lấy danh sách đơn hàng của user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of orders
 */
export async function getOrdersByUser(userId) {
  try {
    const ordersRef = ref(database, "orders");
    const snapshot = await get(ordersRef);

    if (!snapshot.exists()) {
      return [];
    }

    const orders = [];
    snapshot.forEach((childSnapshot) => {
      const order = childSnapshot.val();
      if (order.userId === userId) {
        orders.push(order);
      }
    });

    // Sắp xếp theo thời gian tạo mới nhất
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return orders;
  } catch (error) {
    console.error("❌ Error getting user orders:", error);
    throw error;
  }
}

/**
 * Lấy tất cả đơn hàng (cho admin)
 * @param {string} statusFilter - Filter theo status (optional)
 * @returns {Promise<Array>} List of all orders
 */
export async function getAllOrders(statusFilter = null) {
  try {
    const ordersRef = ref(database, "orders");
    const snapshot = await get(ordersRef);

    if (!snapshot.exists()) {
      return [];
    }

    const orders = [];
    snapshot.forEach((childSnapshot) => {
      const order = childSnapshot.val();
      if (!statusFilter || order.status === statusFilter) {
        orders.push(order);
      }
    });

    // Sắp xếp theo thời gian tạo mới nhất
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return orders;
  } catch (error) {
    console.error("❌ Error getting all orders:", error);
    throw error;
  }
}

/**
 * Cập nhật trạng thái đơn hàng
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @param {string} transactionId - Transaction ID from payment gateway (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function updateOrderStatus(orderId, status, transactionId = null) {
  try {
    const orderRef = ref(database, `orders/${orderId}`);

    const updateData = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (transactionId) {
      updateData.transactionId = transactionId;
    }

    if (status === ORDER_STATUS.COMPLETED) {
      updateData.completedAt = new Date().toISOString();
    }

    await update(orderRef, updateData);
    console.log(`✅ Order ${orderId} updated to ${status}`);
    return true;
  } catch (error) {
    console.error("❌ Error updating order:", error);
    throw error;
  }
}

/**
 * Hủy đơn hàng (Admin only)
 * @param {string} orderId - Order ID
 * @param {string} reason - Lý do hủy (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function cancelOrder(orderId, reason = null) {
  try {
    const orderRef = ref(database, `orders/${orderId}`);

    await update(orderRef, {
      status: ORDER_STATUS.CANCELLED,
      updatedAt: new Date().toISOString(),
      cancelReason: reason,
    });

    console.log(`✅ Order ${orderId} cancelled`);
    return true;
  } catch (error) {
    console.error("❌ Error cancelling order:", error);
    throw error;
  }
}

/**
 * User tự hủy đơn hàng của mình (chỉ pending order)
 * Ghi vào node riêng để Firebase rules cho phép
 * @param {string} userId - User ID (owner)
 * @param {string} orderId - Order ID
 * @param {string} reason - Lý do hủy (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function cancelOrderByOwner(userId, orderId, reason = null) {
  try {
    // Verify order belongs to user first by reading it
    const orderRef = ref(database, `orders/${orderId}`);
    const orderSnap = await get(orderRef);

    if (!orderSnap.exists()) {
      throw new Error(ERROR_MESSAGES.ORDER_NOT_FOUND);
    }

    const order = orderSnap.val();

    // Check ownership
    if (order.userId !== userId) {
      throw new Error("Bạn không có quyền hủy đơn hàng này.");
    }

    // Only pending orders can be cancelled by user
    if (order.status !== ORDER_STATUS.PENDING) {
      throw new Error("Chỉ có thể hủy đơn hàng đang chờ thanh toán.");
    }

    // Update order status
    await update(orderRef, {
      status: ORDER_STATUS.CANCELLED,
      updatedAt: new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
      cancelReason: reason || "Người dùng tự hủy",
      cancelledBy: userId,
    });

    console.log(`✅ Order ${orderId} cancelled by owner ${userId}`);
    return true;
  } catch (error) {
    console.error("❌ Error cancelling order by owner:", error);
    throw error;
  }
}

// ============ ENROLLMENT AFTER PAYMENT ============

/**
 * Tự động đăng ký khóa học sau khi thanh toán thành công
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @param {string} orderId - Order ID
 * @returns {Promise<boolean>} Success status
 */
export async function enrollAfterPayment(userId, courseId, orderId) {
  try {
    // 0. Kiểm tra xem đã enrolled chưa để tránh duplicate
    const enrollmentRef = ref(database, `enrollments/${userId}/${courseId}`);
    const existingEnrollment = await get(enrollmentRef);

    if (existingEnrollment.exists()) {
      console.log(`ℹ️ User ${userId} already enrolled in course ${courseId}`);
      return true; // Already enrolled, skip
    }

    // 1. Tạo enrollment record

    const enrollmentData = {
      enrolledAt: new Date().toISOString(),
      status: "active",
      userId,
      courseId,
      progress: 0,
      lastAccessed: new Date().toISOString(),
      paidOrder: orderId, // Liên kết với đơn hàng
      enrollmentType: "paid", // Đánh dấu là đăng ký qua thanh toán
    };

    await set(enrollmentRef, enrollmentData);

    // 2. Thêm courseId vào danh sách đã mua của user
    const userRef = ref(database, `users/${userId}`);
    const userSnapshot = await get(userRef);

    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      const purchasedCourses = userData.purchasedCourses || [];

      if (!purchasedCourses.includes(courseId)) {
        purchasedCourses.push(courseId);
        await update(userRef, {
          purchasedCourses,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    console.log(
      `✅ User ${userId} enrolled in course ${courseId} after payment`,
    );
    return true;
  } catch (error) {
    console.error("❌ Error enrolling after payment:", error);
    throw error;
  }
}

// ============ PURCHASE STATUS CHECK ============

/**
 * Kiểm tra user đã mua khóa học chưa
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @returns {Promise<boolean>} True nếu đã mua
 */
export async function checkPurchaseStatus(userId, courseId) {
  try {
    // Cách 1: Kiểm tra trong enrollments với enrollmentType = "paid"
    const enrollmentRef = ref(database, `enrollments/${userId}/${courseId}`);
    const enrollmentSnapshot = await get(enrollmentRef);

    if (enrollmentSnapshot.exists()) {
      // Nếu đã enroll (dù free hay paid) thì coi như đã "mua"
      return true;
    }

    // Cách 2: Kiểm tra có order completed không - sử dụng query cho user hiện tại
    // Sử dụng query với userId để chỉ đọc orders của user này (đúng theo Firebase rules)
    const ordersRef = ref(database, "orders");
    const userOrdersQuery = query(
      ordersRef,
      orderByChild("userId"),
      equalTo(userId),
    );
    const ordersSnapshot = await get(userOrdersQuery);

    if (ordersSnapshot.exists()) {
      let hasPurchased = false;
      ordersSnapshot.forEach((childSnapshot) => {
        const order = childSnapshot.val();
        if (
          order.courseId === courseId &&
          order.status === ORDER_STATUS.COMPLETED
        ) {
          hasPurchased = true;
        }
      });
      return hasPurchased;
    }

    return false;
  } catch (error) {
    console.error("❌ Error checking purchase status:", error);
    return false;
  }
}

/**
 * Kiểm tra xem khóa học có yêu cầu thanh toán không
 * @param {object} course - Course object
 * @returns {boolean} True nếu là khóa học trả phí
 */
export function isPaidCourse(course) {
  return course && course.price && Number(course.price) > 0;
}

/**
 * Lấy đơn hàng pending của user cho 1 khóa học
 * (Để kiểm tra xem có đơn hàng chờ thanh toán không)
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @returns {Promise<object|null>} Pending order or null
 */
export async function getPendingOrder(userId, courseId) {
  try {
    // Sử dụng query với userId để chỉ đọc orders của user này (đúng theo Firebase rules)
    const ordersRef = ref(database, "orders");
    const userOrdersQuery = query(
      ordersRef,
      orderByChild("userId"),
      equalTo(userId),
    );
    const snapshot = await get(userOrdersQuery);

    if (!snapshot.exists()) {
      return null;
    }

    let pendingOrder = null;
    snapshot.forEach((childSnapshot) => {
      const order = childSnapshot.val();
      if (
        order.userId === userId &&
        order.courseId === courseId &&
        order.status === ORDER_STATUS.PENDING
      ) {
        // Kiểm tra order còn hạn không (30 phút)
        const createdAt = new Date(order.createdAt);
        const now = new Date();
        const diffMinutes = (now - createdAt) / (1000 * 60);

        if (diffMinutes <= 30) {
          pendingOrder = order;
        }
      }
    });

    return pendingOrder;
  } catch (error) {
    console.error("❌ Error getting pending order:", error);
    return null;
  }
}

/**
 * Đếm số đơn hàng pending của user (để rate limiting)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Số lượng pending orders
 */
async function countPendingOrdersByUser(userId) {
  try {
    const ordersRef = ref(database, "orders");
    const userOrdersQuery = query(
      ordersRef,
      orderByChild("userId"),
      equalTo(userId),
    );
    const snapshot = await get(userOrdersQuery);

    if (!snapshot.exists()) {
      return 0;
    }

    let count = 0;
    const now = new Date();

    snapshot.forEach((childSnapshot) => {
      const order = childSnapshot.val();
      if (order.status === ORDER_STATUS.PENDING) {
        // Chỉ đếm đơn còn hạn
        const createdAt = new Date(order.createdAt);
        const diffMinutes = (now - createdAt) / (1000 * 60);
        if (diffMinutes <= ORDER_TIMEOUT_MINUTES) {
          count++;
        }
      }
    });

    return count;
  } catch (error) {
    console.error("❌ Error counting pending orders:", error);
    return 0;
  }
}
// ============ STATISTICS (for Admin) ============

/**
 * Lấy thống kê đơn hàng
 * @returns {Promise<object>} Statistics object
 */
export async function getOrderStatistics() {
  try {
    const orders = await getAllOrders();

    const stats = {
      total: orders.length,
      pending: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalRevenue: 0,
      todayOrders: 0,
      todayRevenue: 0,
    };

    const today = new Date().toDateString();

    orders.forEach((order) => {
      // Đếm theo status
      switch (order.status) {
        case ORDER_STATUS.PENDING:
          stats.pending++;
          break;
        case ORDER_STATUS.COMPLETED:
          stats.completed++;
          stats.totalRevenue += order.amount || 0;
          break;
        case ORDER_STATUS.FAILED:
          stats.failed++;
          break;
        case ORDER_STATUS.CANCELLED:
          stats.cancelled++;
          break;
      }

      // Đếm đơn hàng hôm nay
      const orderDate = new Date(order.createdAt).toDateString();
      if (orderDate === today) {
        stats.todayOrders++;
        if (order.status === ORDER_STATUS.COMPLETED) {
          stats.todayRevenue += order.amount || 0;
        }
      }
    });

    return stats;
  } catch (error) {
    console.error("❌ Error getting order statistics:", error);
    return null;
  }
}
