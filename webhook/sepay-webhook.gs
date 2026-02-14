/**
 * SePay Webhook Handler for CodeMaster
 * =====================================
 *
 * Google Apps Script để nhận webhook từ SePay
 * và tự động xác nhận thanh toán trong Firebase
 *
 */

// ============ CẤU HÌNH - CẬP NHẬT THEO PROJECT CỦA BẠN ============
const CONFIG = {
  // Firebase Realtime Database URL (không có .json ở cuối)
  FIREBASE_URL: "https://db-code-master-default-rtdb.firebaseio.com",

  // Firebase Database Secret
  // ⚠️ QUAN TRỌNG
  FIREBASE_SECRET: "xxx",

  // SePay API Key - Lấy từ SePay Dashboard > Cài đặt > API
  // Dùng để verify webhook request đến từ SePay
  SEPAY_API_KEY: "xxx",

  // Prefix trong nội dung chuyển khoản để nhận diện đơn hàng CodeMaster
  TRANSFER_PREFIX: "CODEMASTER",

  // Cho phép chênh lệch số tiền (VNĐ) - Phòng trường hợp bank fee
  AMOUNT_TOLERANCE: 0,

  // Bật/tắt logging chi tiết
  DEBUG_MODE: true,
};

// ============ WEBHOOK HANDLER ============

/**
 * Xử lý POST request từ SePay webhook
 * SePay sẽ gọi endpoint này mỗi khi có giao dịch mới
 */
function doPost(e) {
  const startTime = new Date();

  try {
    // 1. Parse request body
    const requestBody = e.postData.contents;
    log("📨 Received webhook:", requestBody);

    const data = JSON.parse(requestBody);

    // 2. Verify webhook từ SePay (optional nhưng recommended)
    // SePay gửi API key trong header hoặc body
    // Uncomment nếu SePay hỗ trợ verification
    // if (!verifyWebhook(e, data)) {
    //   log("❌ Webhook verification failed");
    //   return createResponse(401, "Unauthorized");
    // }

    // 3. Extract transaction info từ SePay payload
    // Cấu trúc payload SePay: https://docs.sepay.vn/webhook
    const transaction = {
      id: data.id || data.transactionId || generateId(),
      amount: parseFloat(data.transferAmount || data.amount || 0),
      content: String(data.content || data.description || ""),
      accountNumber: data.accountNumber || data.bankAccount || "",
      bankCode: data.bankCode || data.gateway || "",
      transactionDate:
        data.transactionDate || data.when || new Date().toISOString(),
      referenceCode: data.referenceCode || data.code || "",
    };

    log("💰 Transaction parsed:", JSON.stringify(transaction));

    // 4. Kiểm tra nội dung có chứa CODEMASTER không
    if (!transaction.content.toUpperCase().includes(CONFIG.TRANSFER_PREFIX)) {
      log("ℹ️ Not a CodeMaster transaction, skipping...");
      return createResponse(200, "Not CodeMaster transaction");
    }

    // 5. Parse Order ID từ nội dung chuyển khoản
    // Format: CODEMASTER CM-1234567890-ABCDEF
    log("🔎 DEBUG - Content to parse:", transaction.content);
    log("🔎 DEBUG - Content type:", typeof transaction.content);
    log("🔎 DEBUG - Content length:", transaction.content.length);

    const orderId = parseOrderId(transaction.content);

    log("🔎 DEBUG - Parsed orderId:", orderId);

    if (!orderId) {
      log("❌ Cannot parse Order ID from content:", transaction.content);
      // Log thêm chi tiết để debug
      logPaymentError("PARSE_FAILED", "Cannot parse Order ID", {
        content: transaction.content,
        contentType: typeof transaction.content,
        words: transaction.content.split(/\s+/),
        id: transaction.id,
        amount: transaction.amount,
      });
      return createResponse(400, "Invalid order ID format");
    }

    log("🔍 Order ID extracted:", orderId);

    // 6. Convert Order ID về format chuẩn của Firebase (có dấu -)
    // SePay gửi: CM17698329860259Q3103 → Firebase lưu: CM-1769832986025-9Q3103
    const firebaseOrderId = convertToOriginalFormat(orderId);
    log("🔄 Firebase Order ID:", firebaseOrderId);

    // 7. Lấy thông tin order từ Firebase
    const order = getOrderFromFirebase(firebaseOrderId);

    if (!order) {
      log("❌ Order not found in Firebase:", firebaseOrderId);
      logPaymentError(firebaseOrderId, "Order not found", {
        originalOrderId: orderId,
        firebaseOrderId: firebaseOrderId,
        content: transaction.content,
        amount: transaction.amount,
      });
      return createResponse(404, "Order not found");
    }

    log("📋 Order found:", JSON.stringify(order));

    // 7. Validate order
    const validation = validateOrder(order, transaction);

    if (!validation.valid) {
      log("❌ Validation failed:", validation.message);

      // Ghi log lỗi vào Firebase để admin xem
      logPaymentError(orderId, validation.message, transaction);

      return createResponse(400, validation.message);
    }

    // 8. Kiểm tra order đã được xử lý chưa (tránh duplicate)
    if (order.status === "completed") {
      log("ℹ️ Order already completed, skipping...");
      return createResponse(200, "Order already completed");
    }

    // 9. Cập nhật order status = completed
    const updateResult = updateOrderStatus(firebaseOrderId, transaction);

    if (!updateResult) {
      log("❌ Failed to update order status");
      return createResponse(500, "Failed to update order");
    }

    // 10. Enroll user vào khóa học
    const enrollResult = enrollUserToCourse(
      order.userId,
      order.courseId,
      firebaseOrderId,
    );

    if (!enrollResult) {
      log("⚠️ Failed to enroll user, but order is completed");
      // Không return error vì order đã complete, admin có thể enroll thủ công
    }

    // 11. Log success
    const duration = new Date() - startTime;
    log(
      `✅ Payment confirmed successfully! Order: ${firebaseOrderId}, Duration: ${duration}ms`,
    );

    // 12. Ghi log transaction thành công
    logSuccessfulPayment(firebaseOrderId, transaction);

    return createResponse(200, "Payment confirmed");
  } catch (error) {
    log("❌ Error processing webhook:", error.toString());
    return createResponse(500, "Internal server error: " + error.message);
  }
}

/**
 * Xử lý GET request (dùng để test webhook đang hoạt động)
 */
function doGet(e) {
  return createResponse(200, "CodeMaster Payment Webhook is running! 🚀");
}

// ============ FIREBASE OPERATIONS ============

/**
 * Lấy thông tin order từ Firebase
 */
function getOrderFromFirebase(orderId) {
  try {
    const url = `${CONFIG.FIREBASE_URL}/orders/${orderId}.json?auth=${CONFIG.FIREBASE_SECRET}`;

    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      log("Firebase GET error:", response.getContentText());
      return null;
    }

    const data = JSON.parse(response.getContentText());
    return data;
  } catch (error) {
    log("Error fetching order from Firebase:", error.toString());
    return null;
  }
}

/**
 * Cập nhật trạng thái order thành completed
 */
function updateOrderStatus(orderId, transaction) {
  try {
    const url = `${CONFIG.FIREBASE_URL}/orders/${orderId}.json?auth=${CONFIG.FIREBASE_SECRET}`;

    // MB Bank - Mã ngân hàng: MB
    const updateData = {
      status: "completed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Thông tin từ SePay
      transactionId: transaction.id,
      transactionAmount: transaction.amount,
      transactionDate: transaction.transactionDate,
      bankReferenceCode: transaction.referenceCode,

      // Đánh dấu xác nhận tự động
      confirmedBy: "sepay-webhook",
      confirmMethod: "auto",
    };

    const response = UrlFetchApp.fetch(url, {
      method: "PATCH",
      contentType: "application/json",
      payload: JSON.stringify(updateData),
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      log("Firebase PATCH error:", response.getContentText());
      return false;
    }

    log("✅ Order status updated to completed");
    return true;
  } catch (error) {
    log("Error updating order status:", error.toString());
    return false;
  }
}

/**
 * Enroll user vào khóa học sau khi thanh toán
 */
function enrollUserToCourse(userId, courseId, orderId) {
  try {
    // 1. Tạo enrollment record
    const enrollmentUrl = `${CONFIG.FIREBASE_URL}/enrollments/${userId}/${courseId}.json?auth=${CONFIG.FIREBASE_SECRET}`;

    const enrollmentData = {
      enrolledAt: new Date().toISOString(),
      status: "active",
      userId: userId,
      courseId: courseId,
      progress: 0,
      lastAccessed: new Date().toISOString(),
      paidOrder: orderId,
      enrollmentType: "paid",
      enrolledBy: "sepay-webhook",
    };

    const enrollResponse = UrlFetchApp.fetch(enrollmentUrl, {
      method: "PUT",
      contentType: "application/json",
      payload: JSON.stringify(enrollmentData),
      muteHttpExceptions: true,
    });

    if (enrollResponse.getResponseCode() !== 200) {
      log("Enrollment error:", enrollResponse.getContentText());
      return false;
    }

    // 2. Cập nhật purchasedCourses của user
    updateUserPurchasedCourses(userId, courseId);

    // 3. Tạo thông báo thanh toán thành công
    createPaymentNotification(userId, courseId, orderId);

    log(`✅ User ${userId} enrolled in course ${courseId}`);
    return true;
  } catch (error) {
    log("Error enrolling user:", error.toString());
    return false;
  }
}

/**
 * Tạo thông báo thanh toán thành công
 */
function createPaymentNotification(userId, courseId, orderId) {
  try {
    // Lấy tên khóa học
    let courseName = "Khóa học mới";
    const courseUrl = `${CONFIG.FIREBASE_URL}/courses/${courseId}.json?auth=${CONFIG.FIREBASE_SECRET}`;
    const courseResponse = UrlFetchApp.fetch(courseUrl, {
      method: "GET",
      muteHttpExceptions: true,
    });

    if (courseResponse.getResponseCode() === 200) {
      const courseData = JSON.parse(courseResponse.getContentText());
      if (courseData && courseData.title) {
        courseName = courseData.title;
      }
    }

    // Tạo notification trong Firebase
    const notificationsUrl = `${CONFIG.FIREBASE_URL}/notifications/${userId}.json?auth=${CONFIG.FIREBASE_SECRET}`;

    const notificationData = {
      type: "payment_success",
      title: "Thanh toán thành công",
      message: `Bạn đã mua thành công khóa học "${courseName}". Bắt đầu học ngay nhé!`,
      link: `course-detail.html?id=${courseId}`,
      data: {
        courseId: courseId,
        courseName: courseName,
        orderId: orderId,
      },
      read: false,
      createdAt: Date.now(),
    };

    const notifResponse = UrlFetchApp.fetch(notificationsUrl, {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify(notificationData),
      muteHttpExceptions: true,
    });

    if (notifResponse.getResponseCode() === 200) {
      log(`✅ Payment notification created for user ${userId}`);
    }
  } catch (error) {
    log("Warning: Could not create payment notification:", error.toString());
    // Không throw error vì notification không critical
  }
}

/**
 * Thêm courseId vào danh sách đã mua của user
 */
function updateUserPurchasedCourses(userId, courseId) {
  try {
    // Lấy user hiện tại
    const userUrl = `${CONFIG.FIREBASE_URL}/users/${userId}.json?auth=${CONFIG.FIREBASE_SECRET}`;

    const userResponse = UrlFetchApp.fetch(userUrl, {
      method: "GET",
      muteHttpExceptions: true,
    });

    if (userResponse.getResponseCode() !== 200) {
      return false;
    }

    const userData = JSON.parse(userResponse.getContentText());

    if (!userData) return false;

    // Thêm courseId vào purchasedCourses
    let purchasedCourses = userData.purchasedCourses || [];

    if (!purchasedCourses.includes(courseId)) {
      purchasedCourses.push(courseId);

      // Update user
      UrlFetchApp.fetch(userUrl, {
        method: "PATCH",
        contentType: "application/json",
        payload: JSON.stringify({
          purchasedCourses: purchasedCourses,
          updatedAt: new Date().toISOString(),
        }),
        muteHttpExceptions: true,
      });
    }

    return true;
  } catch (error) {
    log("Error updating user purchased courses:", error.toString());
    return false;
  }
}

// ============ VALIDATION ============

/**
 * Validate order trước khi confirm
 */
function validateOrder(order, transaction) {
  // Kiểm tra order tồn tại
  if (!order) {
    return { valid: false, message: "Order not found" };
  }

  // Kiểm tra order còn pending
  if (order.status !== "pending") {
    return {
      valid: false,
      message: `Order status is ${order.status}, not pending`,
    };
  }

  // Kiểm tra order chưa hết hạn
  if (order.expiresAt) {
    const expiresAt = new Date(order.expiresAt);
    if (new Date() > expiresAt) {
      return { valid: false, message: "Order has expired" };
    }
  }

  // Kiểm tra số tiền
  const orderAmount = parseFloat(order.amount);
  const paidAmount = parseFloat(transaction.amount);
  const difference = Math.abs(orderAmount - paidAmount);

  if (difference > CONFIG.AMOUNT_TOLERANCE) {
    return {
      valid: false,
      message: `Amount mismatch: expected ${orderAmount}, received ${paidAmount}`,
    };
  }

  return { valid: true, message: "OK" };
}

// ============ HELPER FUNCTIONS ============

/**
 * Convert Order ID từ format không có dấu - về format gốc có dấu -
 * Input: CM17698329860259Q3103 (không có dấu -)
 * Output: CM-1769832986025-9Q3103 (có dấu -)
 *
 * Format gốc: CM-{timestamp 13 số}-{random 6 ký tự}
 */
function convertToOriginalFormat(orderId) {
  if (!orderId) return null;

  // Nếu đã có dấu - thì trả về nguyên
  if (orderId.includes("-")) {
    return orderId;
  }

  // Kiểm tra format: CM + 13 số timestamp + 6 ký tự random = 21 ký tự tổng cộng
  // CM17698329860259Q3103
  // CM + 1769832986025 (13 số) + 9Q3103 (6 ký tự)

  const match = orderId.match(/^CM(\d{13})([A-Z0-9]{6})$/i);
  if (match) {
    const timestamp = match[1];
    const random = match[2];
    const converted = `CM-${timestamp}-${random}`;
    log("🔄 Converted Order ID:", orderId, "→", converted);
    return converted;
  }

  // Thử với timestamp ngắn hơn (có thể là 12 hoặc 14 số)
  const match2 = orderId.match(/^CM(\d{12,14})([A-Z0-9]{5,7})$/i);
  if (match2) {
    const timestamp = match2[1];
    const random = match2[2];
    const converted = `CM-${timestamp}-${random}`;
    log("🔄 Converted Order ID (alt):", orderId, "→", converted);
    return converted;
  }

  log("⚠️ Cannot convert Order ID:", orderId);
  return orderId;
}

/**
 * Parse Order ID từ nội dung chuyển khoản
 * Input: "CODEMASTER CM-1234567890-ABCDEF" hoặc "CM-1234567890-ABCDEF CODEMASTER"
 * Output: "CM-1234567890-ABCDEF"
 */
function parseOrderId(content) {
  if (!content) return null;

  log("🔍 Parsing Order ID from content:", content);

  // Cách tốt nhất: Tách content theo khoảng trắng và tìm phần tử bắt đầu bằng CM
  const words = content.toUpperCase().split(/\s+/);

  for (const word of words) {
    // Kiểm tra word bắt đầu bằng CM
    if (word.startsWith("CM")) {
      // Pattern 1: CM-{timestamp}-{random} (có dấu -)
      if (/^CM-\d+-[A-Z0-9]+$/i.test(word)) {
        log("✅ Found Order ID (pattern 1):", word);
        return word;
      }

      // Pattern 2: CM{timestamp}{random} (không có dấu -, ít nhất 15 ký tự tổng cộng)
      if (/^CM[0-9A-Z]{15,}$/i.test(word)) {
        log("✅ Found Order ID (pattern 2):", word);
        return word;
      }

      // Pattern 3: CM + ít nhất 10 số + chữ cái tùy chọn
      if (/^CM\d{10,}[A-Z0-9]*$/i.test(word)) {
        log("✅ Found Order ID (pattern 3):", word);
        return word;
      }
    }
  }

  log("❌ No Order ID found in content");
  return null;
}

/**
 * Verify webhook request từ SePay
 */
function verifyWebhook(e, data) {
  // SePay có thể gửi API key trong header hoặc body
  // Kiểm tra theo docs của SePay

  const apiKey =
    e.parameter.api_key ||
    e.parameter.apiKey ||
    data.api_key ||
    data.apiKey ||
    (e.headers && e.headers["X-API-Key"]);

  return apiKey === CONFIG.SEPAY_API_KEY;
}

/**
 * Tạo HTTP response
 */
function createResponse(statusCode, message) {
  const output = ContentService.createTextOutput(
    JSON.stringify({
      success: statusCode === 200,
      message: message,
      timestamp: new Date().toISOString(),
    }),
  );

  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Generate random ID
 */
function generateId() {
  return (
    "TXN-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substr(2, 6).toUpperCase()
  );
}

/**
 * Logging helper
 */
function log(...args) {
  if (CONFIG.DEBUG_MODE) {
    console.log(new Date().toISOString(), ...args);
  }
}

// ============ LOGGING TO FIREBASE ============

/**
 * Ghi log payment thành công vào Firebase
 */
function logSuccessfulPayment(orderId, transaction) {
  try {
    const logId = generateId();
    const logUrl = `${CONFIG.FIREBASE_URL}/paymentLogs/${logId}.json?auth=${CONFIG.FIREBASE_SECRET}`;

    const logData = {
      type: "success",
      orderId: orderId,
      transactionId: transaction.id,
      amount: transaction.amount,
      content: transaction.content,
      timestamp: new Date().toISOString(),
      source: "sepay-webhook",
    };

    UrlFetchApp.fetch(logUrl, {
      method: "PUT",
      contentType: "application/json",
      payload: JSON.stringify(logData),
      muteHttpExceptions: true,
    });
  } catch (error) {
    log("Error logging successful payment:", error.toString());
  }
}

/**
 * Ghi log lỗi payment vào Firebase
 */
function logPaymentError(orderId, errorMessage, transaction) {
  try {
    const logId = generateId();
    const logUrl = `${CONFIG.FIREBASE_URL}/paymentLogs/${logId}.json?auth=${CONFIG.FIREBASE_SECRET}`;

    const logData = {
      type: "error",
      orderId: orderId,
      error: errorMessage,
      transaction: transaction,
      timestamp: new Date().toISOString(),
      source: "sepay-webhook",
    };

    UrlFetchApp.fetch(logUrl, {
      method: "PUT",
      contentType: "application/json",
      payload: JSON.stringify(logData),
      muteHttpExceptions: true,
    });
  } catch (error) {
    log("Error logging payment error:", error.toString());
  }
}

// ============ TEST FUNCTIONS ============

/**
 * Test convert Order ID - CHẠY HÀM NÀY TRƯỚC
 */
function testConvertOrderId() {
  console.log("=== Testing Order ID Conversion ===\n");

  // Test case: Order ID từ SePay (không có dấu -)
  const sepayOrderId = "CM17698329860259Q3103";
  console.log("SePay Order ID:", sepayOrderId);
  console.log("Length:", sepayOrderId.length);

  // Convert về format gốc
  const converted = convertToOriginalFormat(sepayOrderId);
  console.log("Converted:", converted);

  // Thử tìm trong Firebase
  console.log("\n=== Testing Firebase lookup ===");
  const order = getOrderFromFirebase(converted);
  if (order) {
    console.log("✅ Order found!");
    console.log("Order data:", JSON.stringify(order, null, 2));
  } else {
    console.log("❌ Order not found with converted ID");

    // Thử tìm với ID gốc
    const order2 = getOrderFromFirebase(sepayOrderId);
    if (order2) {
      console.log("✅ Order found with original ID!");
    } else {
      console.log("❌ Order not found with original ID either");
    }
  }
}

/**
 * Test với payload thực tế từ SePay - CHẠY HÀM NÀY ĐỂ DEBUG
 */
function testRealPayload() {
  // Payload thực tế từ SePay
  const realPayload = {
    postData: {
      contents: JSON.stringify({
        gateway: "MBBank",
        transactionDate: "2026-01-31 11:19:00",
        accountNumber: "0000825590247",
        subAccount: null,
        code: null,
        content:
          "IBFT CODEMASTER CM17698329860259Q3103 Ma giao dich Trace543496 Trace 543496",
        transferType: "in",
        description: "BankAPINotify IBFT CODEMASTER CM17698329860259Q3103",
        transferAmount: 2000,
        referenceCode: "FT26031648220367",
        accumulated: 14000,
        id: 40666066,
      }),
    },
  };

  console.log("=== Testing with REAL SePay payload ===");

  // Test parseOrderId trực tiếp
  const content =
    "IBFT CODEMASTER CM17698329860259Q3103 Ma giao dich Trace543496 Trace 543496";
  console.log("Content:", content);

  const words = content.toUpperCase().split(/\s+/);
  console.log("Words:", words);

  for (const word of words) {
    if (word.startsWith("CM")) {
      console.log("\nChecking word:", word);
      console.log("Length:", word.length);

      const p1 = /^CM-\d+-[A-Z0-9]+$/i.test(word);
      console.log("Pattern 1 (CM-xxx-xxx):", p1);

      const p2 = /^CM[0-9A-Z]{15,}$/i.test(word);
      console.log("Pattern 2 (CM + 15+ chars):", p2);

      const p3 = /^CM\d{10,}[A-Z0-9]*$/i.test(word);
      console.log("Pattern 3 (CM + 10+ digits):", p3);
    }
  }

  const orderId = parseOrderId(content);
  console.log("\n=== parseOrderId result:", orderId);

  // Test full doPost
  console.log("\n=== Testing doPost ===");
  const result = doPost(realPayload);
  console.log("Result:", result.getContent());
}

/**
 * Test function - Chạy thủ công trong Apps Script để test
 */
function testWebhook() {
  // Giả lập payload từ SePay
  const mockPayload = {
    postData: {
      contents: JSON.stringify({
        id: "TEST-" + Date.now(),
        transferAmount: 2000,
        content: "CODEMASTER CM-1769827671562-ZRBNVO",
        accountNumber: "0000825590247",
        transactionDate: new Date().toISOString(),
      }),
    },
  };

  const result = doPost(mockPayload);
  console.log("Test result:", result.getContent());
}

/**
 * Test Firebase connection
 */
function testFirebaseConnection() {
  const url = `${CONFIG.FIREBASE_URL}/.json?auth=${CONFIG.FIREBASE_SECRET}&shallow=true`;

  try {
    const response = UrlFetchApp.fetch(url);
    console.log("Firebase connection: OK");
    console.log("Response:", response.getContentText().substring(0, 200));
  } catch (error) {
    console.log("Firebase connection: FAILED");
    console.log("Error:", error.toString());
  }
}
// Hàm này dùng để hiển thị thông báo khi bạn truy cập bằng trình duyệt
function doGet(e) {
  return ContentService.createTextOutput(
    "Trạng thái: Webhook đang hoạt động bình thường!",
  );
}
