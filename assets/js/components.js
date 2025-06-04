/**
 * Script để tải các components chung (header, footer) vào tất cả các trang
 */
document.addEventListener("DOMContentLoaded", function () {
  // Xác định đường dẫn gốc dựa vào cấu trúc URL
  const rootPath = getRootPath();

  // Load Header
  const headerPlaceholder = document.querySelector("#header-placeholder");
  if (headerPlaceholder) {
    fetch(rootPath + "components/header.html")
      .then((response) => response.text())
      .then((data) => {
        // Thay thế {{rootPath}} bằng đường dẫn gốc thực tế
        data = data.replace(/\{\{rootPath\}\}/g, rootPath);
        headerPlaceholder.innerHTML = data;

        // Sau khi load xong header, cập nhật UI dựa trên trạng thái đăng nhập
        // Hàm này được định nghĩa trong auth.js
        if (typeof updateUIBasedOnLoginState === "function") {
          updateUIBasedOnLoginState();
        }

        // Đánh dấu link active dựa vào trang hiện tại
        setActiveLink();
      })
      .catch((error) => console.error("Error loading header:", error));
  }

  // Load Footer
  const footerPlaceholder = document.querySelector("#footer-placeholder");
  if (footerPlaceholder) {
    fetch(rootPath + "components/footer.html")
      .then((response) => response.text())
      .then((data) => {
        // Thay thế {{rootPath}} bằng đường dẫn gốc thực tế
        data = data.replace(/\{\{rootPath\}\}/g, rootPath);
        footerPlaceholder.innerHTML = data;
      })
      .catch((error) => console.error("Error loading footer:", error));
  }
});

/**
 * Đặt class active cho link trong navbar theo trang hiện tại
 */
function setActiveLink() {
  // chờ DOM cập nhật
  setTimeout(() => {
    // Lấy đường dẫn gốc và tên file từ URL hiện tại
    let currentPath = window.location.pathname.split("/").pop() || "index.html";

    // Kiểm tra URL đặc biệt
    if (
      window.location.pathname === "/" ||
      window.location.pathname.endsWith("/")
    ) {
      currentPath = "index.html";
    }

    // Đặt active cho links trên desktop nav
    const desktopLinks = document.querySelectorAll(".nav-pc a");
    desktopLinks.forEach((link) => {
      const href = link.getAttribute("href");
      // Chỉ so sánh tên file, bỏ qua đường dẫn
      const hrefFile = href ? href.split("/").pop() : "";

      if (hrefFile === currentPath && link.id !== "logout-btn") {
        link.classList.add("active");
        console.log("Active desktop link:", href);
      } else {
        link.classList.remove("active");
      }
    });

    // Đặt active cho links trên mobile nav
    const mobileLinks = document.querySelectorAll(".nav-mobile-list a");
    mobileLinks.forEach((link) => {
      const href = link.getAttribute("href");
      // Chỉ so sánh tên file, bỏ qua đường dẫn
      const hrefFile = href ? href.split("/").pop() : "";

      if (hrefFile === currentPath && link.id !== "logout-btn") {
        link.classList.add("active");
        console.log("Active mobile link:", href);
      } else {
        link.classList.remove("active");
      }
    });
  }, 50);
}

/**
 * Xác định đường dẫn gốc tương đối dựa vào vị trí trang hiện tại
 * Đường dẫn gốc dạng "./" hoặc "../"
 */
function getRootPath() {
  // Lấy đường dẫn hiện tại và phân tích
  const path = window.location.pathname;

  // Kiểm tra xem URL có chứa thư mục con không (như /courses/, /documents/, v.v.)
  if (
    path.includes("/courses/") ||
    path.includes("/documents/") ||
    path.includes("/paths/")
  ) {
    return "../"; // Đường dẫn gốc là "../" (lên một cấp)
  }

  return "./"; // Mặc định đường dẫn gốc là "./"
}
