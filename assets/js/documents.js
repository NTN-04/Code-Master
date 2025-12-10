import { database, auth } from "./firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { showFloatingNotification as showNotification } from "./utils/notifications.js";

// Biến toàn cục lưu giới hạn tải, chỉ lấy 1 lần khi load trang
let GLOBAL_DOWNLOAD_LIMIT = 10;
// Hàm lấy giới hạn từ database khi load trang
async function fetchGlobalDownloadLimit() {
  try {
    const globalRef = ref(database, "settings/global/downloadLimit");
    const snap = await get(globalRef);
    if (snap.exists()) {
      const val = snap.val();
      if (!isNaN(val) && Number(val) >= 0) {
        GLOBAL_DOWNLOAD_LIMIT = Number(val);
      }
    }
  } catch (e) {
    // Nếu lỗi thì giữ mặc định 10
  }
}

// Loading đơn giản
function showButtonLoading(btn, message = "Đang tải...") {
  if (!btn) return () => {};
  const oldHtml = btn.innerHTML;
  btn.innerHTML = `<span class="spinner-btn"></span>${message}`;
  btn.disabled = true;
  // Trả về hàm khôi phục
  return function hideBtnLoading() {
    btn.innerHTML = oldHtml;
    btn.disabled = false;
  };
}

function downloadDocs() {
  const btnDownload = document.getElementById("download-pdf");
  if (btnDownload) {
    btnDownload.addEventListener("click", async function () {
      // kiểm tra user
      const user = auth.currentUser;
      if (!user) {
        showNotification("Bạn cần đăng nhập để tải tài liệu.", "warning");
        return;
      }

      // Lấy giới hạn tải toàn cục từ database
      if (!limitDownload(GLOBAL_DOWNLOAD_LIMIT)) {
        return;
      }

      // Lấy tiêu đề làm tên file
      const title =
        document.querySelector(".document-header h1")?.textContent?.trim() ||
        "tai-lieu";
      // Chuyển tiêu đề thành tên file không dấu, không khoảng trắng
      const filename =
        title
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") + ".pdf";
      // Hiển thị loading
      const hideLoading = showButtonLoading(btnDownload, "Đang tải...");

      // chế độ css print
      document.body.classList.add("print-mode");
      // Chọn phần nội dung cần xuất PDF
      const element = document.querySelector(".document-main");
      element.classList.add("pdf-export");
      // Tạo header cho file
      const pdfHeader = document.createElement("div");
      pdfHeader.classList.add("pdf-header");
      pdfHeader.style.display = "block";
      pdfHeader.textContent = `${title} - CodeMaster`;
      element.prepend(pdfHeader);

      const opt = {
        margin: 0.4,
        filename: filename,
        image: { type: "jpeg", quality: 1 },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      };
      html2pdf()
        .set(opt)
        .from(element)
        .toPdf() // lấy đôi tượng jsPDF
        .get("pdf")
        .then(function (pdf) {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(10);
            pdf.setTextColor(126); // màu xám
            // Lấy kích thước trang (đơn vị: in)
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            pdf.text(
              `Trang ${i} / ${totalPages}`,
              pageWidth / 2, // tọa độ trục x
              pageHeight - 0.5, // tọa độ trục y : cách mép dưới 0.5 inch
              { align: "center" }
            );
          }
        })
        .save()
        .then(() => {
          // Ẩn loading khi PDF đã tạo xong
          hideLoading();
          document.body.classList.remove("print-mode");
          element.classList.remove("pdf-export");
          pdfHeader.remove();
        })
        .catch((error) => {
          // Ẩn loading nếu có lỗi
          hideLoading();
          showNotification(`Có lỗi khi tạo PDF: ${error.message}`, "error");
          console.error("PDF error:", error);
        });
    });
  }
}

function limitDownload(max) {
  // Lấy key cho ngày hiện tại
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  const todayKey = `downloads_${year}-${month}-${date}`; // Thay / bằng - để tránh lỗi với key

  // Dọn dẹp các key cũ trong local
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("downloads_") && key !== todayKey) {
      localStorage.removeItem(key);
      i--;
    }
  }

  // Kiểm tra số lần tải
  const downloadCount = Number(localStorage.getItem(todayKey) || 0);
  if (downloadCount >= max) {
    showNotification(
      `Vượt quá số lần tải trong ngày! (${max} lần/ngày)`,
      "warning"
    );
    return false; // Trả về false nếu vượt giới hạn
  }

  // Tăng số lần tải lên 1 và lưu lại
  localStorage.setItem(todayKey, downloadCount + 1);
  return true; // Trả về true nếu còn trong giới hạn
}

downloadDocs();
// Gọi lấy giới hạn ngay khi load file
fetchGlobalDownloadLimit();
