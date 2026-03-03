/**
 * VietQR Service - Tạo mã QR thanh toán động
 * CodeMaster - Hệ thống khóa học lập trình
 *
 * VietQR API Documentation: https://vietqr.io/danh-sach-api/api-tao-ma-qr-code
 */

// ============ BANK CONFIGURATION ============
// MB Bank - MB
export const BANK_CONFIG = {
  bankId: "MB", // Mã ngân hàng MB Bank
  bankName: "MB Bank",
  accountNo: "0000825590247", // ⚠️ CẦN CẬP NHẬT: Số tài khoản thực
  accountName: "NGUYEN TRONG NGHIA", // ⚠️ CẦN CẬP NHẬT: Tên chủ tài khoản
  template: "compact2", // Template QR: compact, compact2, qr_only, print
};

// VietQR API Base URL
const VIETQR_BASE_URL = "https://img.vietqr.io/image";

// ============ QR CODE GENERATION ============

/**
 * Tạo URL hình ảnh QR code VietQR
 * @param {number} amount - Số tiền thanh toán
 * @param {string} orderId - Mã đơn hàng (sẽ nằm trong nội dung chuyển khoản)
 * @param {string} additionalInfo - Thông tin bổ sung (optional)
 * @returns {string} URL hình ảnh QR code
 */
export function generateVietQRUrl(amount, orderId, additionalInfo = "") {
  const { bankId, accountNo, template } = BANK_CONFIG;

  // Nội dung chuyển khoản - quan trọng để định danh đơn hàng
  const description = `CODEMASTER ${orderId}${additionalInfo ? " " + additionalInfo : ""}`;

  // Tạo URL theo format VietQR
  // Format: https://img.vietqr.io/image/{bankId}-{accountNo}-{template}.png?amount={amount}&addInfo={description}
  const url = new URL(
    `${VIETQR_BASE_URL}/${bankId}-${accountNo}-${template}.png`,
  );

  url.searchParams.append("amount", amount.toString());
  url.searchParams.append("addInfo", description);
  url.searchParams.append("accountName", BANK_CONFIG.accountName);

  return url.toString();
}

/**
 * Tạo URL QR với đầy đủ options
 * @param {object} options - Options object
 * @param {number} options.amount - Số tiền
 * @param {string} options.orderId - Mã đơn hàng
 * @param {string} options.template - Template QR (optional)
 * @param {string} options.description - Mô tả bổ sung (optional)
 * @returns {string} URL hình ảnh QR code
 */
export function generateVietQRUrlAdvanced(options) {
  const {
    amount,
    orderId,
    template = BANK_CONFIG.template,
    description = "",
  } = options;

  const { bankId, accountNo, accountName } = BANK_CONFIG;

  // Nội dung chuyển khoản
  const addInfo = `CODEMASTER ${orderId}${description ? " " + description : ""}`;

  const url = new URL(
    `${VIETQR_BASE_URL}/${bankId}-${accountNo}-${template}.png`,
  );

  url.searchParams.append("amount", amount.toString());
  url.searchParams.append("addInfo", addInfo);
  url.searchParams.append("accountName", accountName);

  return url.toString();
}

/**
 * Lấy thông tin ngân hàng để hiển thị
 * @returns {object} Bank info for display
 */
export function getBankInfo() {
  return {
    bankName: BANK_CONFIG.bankName,
    bankId: BANK_CONFIG.bankId,
    accountNo: BANK_CONFIG.accountNo,
    accountName: BANK_CONFIG.accountName,
  };
}

/**
 * Tạo nội dung chuyển khoản chuẩn
 * @param {string} orderId - Mã đơn hàng
 * @returns {string} Transfer content
 */
export function getTransferContent(orderId) {
  return `CODEMASTER ${orderId}`;
}

/**
 * Format số tiền theo định dạng VNĐ
 * @param {number} amount - Số tiền
 * @returns {string} Formatted amount
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

/**
 * Format số tiền đơn giản (không có ký hiệu tiền tệ)
 * @param {number} amount - Số tiền
 * @returns {string} Formatted amount
 */
export function formatAmount(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

// ============ QR TEMPLATES ============

/**
 * Danh sách các template QR có sẵn
 */
export const QR_TEMPLATES = {
  COMPACT: "compact", // Compact với logo bank
  COMPACT2: "compact2", // Compact 2 với logo bank (recommended)
  QR_ONLY: "qr_only", // Chỉ QR code, không có thông tin
  PRINT: "print", // Để in, bao gồm đầy đủ thông tin
};

/**
 * Lấy URL QR với template cụ thể
 * @param {number} amount - Số tiền
 * @param {string} orderId - Mã đơn hàng
 * @param {string} templateType - Loại template
 * @returns {string} URL hình ảnh QR code
 */
export function getQRWithTemplate(
  amount,
  orderId,
  templateType = QR_TEMPLATES.COMPACT2,
) {
  const { bankId, accountNo, accountName } = BANK_CONFIG;
  const description = `CODEMASTER ${orderId}`;

  const url = new URL(
    `${VIETQR_BASE_URL}/${bankId}-${accountNo}-${templateType}.png`,
  );

  url.searchParams.append("amount", amount.toString());
  url.searchParams.append("addInfo", description);
  url.searchParams.append("accountName", accountName);

  return url.toString();
}

// ============ VALIDATION ============

/**
 * Validate số tiền thanh toán
 * @param {number} amount - Số tiền
 * @returns {object} Validation result
 */
export function validateAmount(amount) {
  if (!amount || isNaN(amount)) {
    return { valid: false, message: "Số tiền không hợp lệ" };
  }

  if (amount < 1000) {
    return { valid: false, message: "Số tiền tối thiểu là 1,000 VNĐ" };
  }

  if (amount > 500000000) {
    return { valid: false, message: "Số tiền vượt quá giới hạn" };
  }

  return { valid: true, message: "" };
}

/**
 * Validate mã đơn hàng
 * @param {string} orderId - Mã đơn hàng
 * @returns {boolean} Valid or not
 */
export function validateOrderId(orderId) {
  if (!orderId || typeof orderId !== "string") {
    return false;
  }

  // Format: CM-{timestamp}-{random}
  const pattern = /^CM-\d+-[A-Z0-9]+$/;
  return pattern.test(orderId);
}

// ============ HELPER FUNCTIONS ============

/**
 * Kiểm tra nội dung chuyển khoản có đúng format không
 * @param {string} content - Nội dung chuyển khoản từ webhook/manual check
 * @returns {object|null} Parsed order info or null
 */
export function parseTransferContent(content) {
  if (!content || typeof content !== "string") {
    return null;
  }

  // Tìm pattern CODEMASTER CM-xxx-xxx
  const pattern = /CODEMASTER\s+(CM-\d+-[A-Z0-9]+)/i;
  const match = content.match(pattern);

  if (match && match[1]) {
    return {
      orderId: match[1],
      raw: content,
    };
  }

  return null;
}

/**
 * Tạo deep link mở app ngân hàng (nếu có)
 * @param {number} amount - Số tiền
 * @param {string} orderId - Mã đơn hàng
 * @returns {string} Deep link URL
 */
export function generateDeepLink(amount, orderId) {
  // VietQR deep link format
  const { bankId, accountNo, accountName } = BANK_CONFIG;
  const description = encodeURIComponent(`CODEMASTER ${orderId}`);

  return `https://dl.vietqr.io/pay?app=&ba=${bankId}${accountNo}&am=${amount}&tn=${description}`;
}
