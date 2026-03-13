/**
 * Export Utility
 * Xuất dữ liệu ra file CSV và Excel
 * Sử dụng SheetJS (xlsx) library cho Excel export
 */

/**
 * Export data to CSV file
 * @param {Array<Object>} data - Data array to export
 * @param {string} filename - Output filename (without extension)
 * @param {Object} options - Export options
 * @param {Array<{key: string, label: string}>} options.headers - Column headers mapping
 */
export function exportToCSV(data, filename, options = {}) {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return false;
  }

  const { headers } = options;

  // Build header row
  let headerRow = [];
  let keys = [];

  if (headers && headers.length > 0) {
    headerRow = headers.map((h) => h.label);
    keys = headers.map((h) => h.key);
  } else {
    // Auto-detect headers from first object
    keys = Object.keys(data[0]);
    headerRow = keys;
  }

  // Build data rows
  const rows = data.map((item) => {
    return keys
      .map((key) => {
        let value = item[key];

        // Handle null/undefined
        if (value === null || value === undefined) {
          value = "";
        }

        // Escape quotes and wrap in quotes if contains comma
        value = String(value);
        if (
          value.includes(",") ||
          value.includes('"') ||
          value.includes("\n")
        ) {
          value = `"${value.replace(/"/g, '""')}"`;
        }

        return value;
      })
      .join(",");
  });

  // Combine header and data
  const csvContent = [headerRow.join(","), ...rows].join("\n");

  // Add UTF-8 BOM for Vietnamese characters
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  // Download file
  downloadBlob(blob, `${filename}.csv`);
  return true;
}

/**
 * Export data to Excel file using SheetJS
 * @param {Array<Object>} data - Data array to export
 * @param {string} filename - Output filename (without extension)
 * @param {Object} options - Export options
 * @param {string} options.sheetName - Sheet name (default: "Data")
 * @param {Array<{key: string, label: string, width?: number}>} options.headers - Column headers
 */
export function exportToExcel(data, filename, options = {}) {
  // Check if SheetJS is available
  if (typeof XLSX === "undefined") {
    console.error("SheetJS (XLSX) library is not loaded");
    alert("Lỗi: Thư viện xuất Excel chưa được tải. Vui lòng thử lại sau.");
    return false;
  }

  if (!data || data.length === 0) {
    console.warn("No data to export");
    return false;
  }

  const { headers, sheetName = "Data" } = options;

  // Prepare data with headers
  let worksheetData = [];
  let keys = [];
  let columnWidths = [];

  if (headers && headers.length > 0) {
    // Add header row
    worksheetData.push(headers.map((h) => h.label));
    keys = headers.map((h) => h.key);
    columnWidths = headers.map((h) => ({ wch: h.width || 15 }));
  } else {
    // Auto-detect headers
    keys = Object.keys(data[0]);
    worksheetData.push(keys);
    columnWidths = keys.map(() => ({ wch: 15 }));
  }

  // Add data rows
  data.forEach((item) => {
    const row = keys.map((key) => {
      const value = item[key];
      return value !== null && value !== undefined ? value : "";
    });
    worksheetData.push(row);
  });

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  worksheet["!cols"] = columnWidths;

  // Style header row (bold)
  const headerRange = XLSX.utils.decode_range(worksheet["!ref"]);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "4361EE" } },
      };
    }
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate Excel file and download
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  downloadBlob(blob, `${filename}.xlsx`);
  return true;
}

/**
 * Export users data
 * @param {Array} users - Users array
 * @param {string} format - "csv" or "excel"
 */
export function exportUsers(users, format = "excel") {
  const headers = [
    { key: "username", label: "Tên người dùng", width: 20 },
    { key: "email", label: "Email", width: 30 },
    { key: "role", label: "Vai trò", width: 12 },
    { key: "status", label: "Trạng thái", width: 12 },
    { key: "createAt", label: "Ngày tạo", width: 15 },
  ];

  // Transform data for export
  const exportData = users.map((user) => ({
    username: user.username || "",
    email: user.email || "",
    role: user.role === 1 ? "Admin" : "Người dùng",
    status: user.status === "suspended" ? "Tạm ngừng" : "Hoạt động",
    createAt: user.createAt || "",
  }));

  const filename = `danh-sach-nguoi-dung-${getDateString()}`;

  if (format === "csv") {
    return exportToCSV(exportData, filename, { headers });
  } else {
    return exportToExcel(exportData, filename, {
      headers,
      sheetName: "Người dùng",
    });
  }
}

/**
 * Export orders data
 * @param {Array} orders - Orders array
 * @param {Object} courses - Courses lookup object
 * @param {Object} users - Users lookup object
 * @param {string} format - "csv" or "excel"
 */
export function exportOrders(orders, courses, users, format = "excel") {
  const headers = [
    { key: "orderId", label: "Mã đơn hàng", width: 20 },
    { key: "userName", label: "Khách hàng", width: 20 },
    { key: "userEmail", label: "Email", width: 25 },
    { key: "courseName", label: "Khóa học", width: 30 },
    { key: "amount", label: "Số tiền", width: 15 },
    { key: "status", label: "Trạng thái", width: 12 },
    { key: "createdAt", label: "Ngày tạo", width: 18 },
  ];

  const statusLabels = {
    pending: "Chờ xử lý",
    completed: "Hoàn thành",
    refunded: "Hoàn tiền",
    cancelled: "Đã hủy",
  };

  // Transform data for export
  const exportData = orders.map((order) => {
    const user = users[order.userId] || {};
    const course = courses[order.courseId] || {};

    return {
      orderId: order.orderId || order.id || "",
      userName: user.username || "",
      userEmail: user.email || "",
      courseName: course.title || "",
      amount: order.amount || 0,
      status: statusLabels[order.status] || order.status || "",
      createdAt: order.createdAt
        ? new Date(order.createdAt).toLocaleString("vi-VN")
        : "",
    };
  });

  const filename = `danh-sach-don-hang-${getDateString()}`;

  if (format === "csv") {
    return exportToCSV(exportData, filename, { headers });
  } else {
    return exportToExcel(exportData, filename, {
      headers,
      sheetName: "Đơn hàng",
    });
  }
}

/**
 * Export revenue report
 * @param {Object} revenueData - Revenue data object
 * @param {string} period - Period label
 * @param {string} format - "csv" or "excel"
 */
export function exportRevenueReport(revenueData, period, format = "excel") {
  const { completed, pending, refunded, growthPercent, topCourses } =
    revenueData;

  // Summary sheet data
  const summaryData = [
    { metric: "Doanh thu hoàn thành", value: completed },
    { metric: "Đang chờ xử lý", value: pending },
    { metric: "Hoàn tiền", value: refunded },
    { metric: "Tăng trưởng (%)", value: `${growthPercent.toFixed(1)}%` },
  ];

  const summaryHeaders = [
    { key: "metric", label: "Chỉ số", width: 25 },
    { key: "value", label: "Giá trị", width: 20 },
  ];

  // Top courses sheet data
  const coursesHeaders = [
    { key: "rank", label: "Hạng", width: 8 },
    { key: "title", label: "Khóa học", width: 40 },
    { key: "count", label: "Số đơn", width: 10 },
    { key: "revenue", label: "Doanh thu", width: 15 },
  ];

  const coursesData = topCourses.map((course, index) => ({
    rank: index + 1,
    title: course.title,
    count: course.count,
    revenue: course.revenue,
  }));

  const filename = `bao-cao-doanh-thu-${period}ngay-${getDateString()}`;

  if (format === "csv") {
    // For CSV, combine both tables
    const allData = [
      ...summaryData.map((s) => ({ ...s, title: "", count: "", revenue: "" })),
      { metric: "", value: "", title: "", count: "", revenue: "" },
      { metric: "TOP KHÓA HỌC", value: "", title: "", count: "", revenue: "" },
      ...coursesData.map((c) => ({
        metric: c.rank,
        value: c.title,
        title: c.count,
        count: c.revenue,
        revenue: "",
      })),
    ];
    return exportToCSV(allData, filename, {});
  } else {
    // For Excel, create multi-sheet workbook
    if (typeof XLSX === "undefined") {
      console.error("SheetJS (XLSX) library is not loaded");
      return false;
    }

    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["BÁO CÁO DOANH THU - CODEMASTER"],
      [`Thời gian: ${period} ngày gần nhất`],
      [`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`],
      [],
      ["Chỉ số", "Giá trị"],
      ...summaryData.map((s) => [s.metric, s.value]),
    ]);
    summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Tổng quan");

    // Top courses sheet
    const coursesSheet = XLSX.utils.aoa_to_sheet([
      coursesHeaders.map((h) => h.label),
      ...coursesData.map((c) => [c.rank, c.title, c.count, c.revenue]),
    ]);
    coursesSheet["!cols"] = coursesHeaders.map((h) => ({ wch: h.width }));
    XLSX.utils.book_append_sheet(workbook, coursesSheet, "Top khóa học");

    // Download
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    downloadBlob(blob, `${filename}.xlsx`);
    return true;
  }
}

/**
 * Helper: Download blob as file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Output filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Helper: Get date string for filename
 * @returns {string} Date string in format YYYY-MM-DD
 */
function getDateString() {
  return new Date().toISOString().split("T")[0];
}
