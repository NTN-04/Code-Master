// Tiện ích định dạng ngày giờ chung cho toàn dự án

// Định dạng ngày/giờ theo locale Việt Nam, fallback nếu timestamp không hợp lệ
export function formatDateTime(timestamp, options = {}) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const locale = options.locale || "vi-VN";
  const formatterOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...options.formatOptions,
  };
  return date.toLocaleString(locale, formatterOptions);
}

// Định dạng ngày (không kèm giờ)
export function formatDate(timestamp, options = {}) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const locale = options.locale || "vi-VN";
  const formatterOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...options.formatOptions,
  };
  return date.toLocaleDateString(locale, formatterOptions);
}
