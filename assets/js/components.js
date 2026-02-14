/**
 * Script để tải các components chung (header, footer) vào tất cả các trang
 */

// Apply theme ngay lập tức để tránh flash (chạy trước DOMContentLoaded)
(function applyThemeEarly() {
  const THEME_KEY = "codemaster_theme";
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

document.addEventListener("DOMContentLoaded", function () {
  const rootPath = typeof getRootPath === "function" ? getRootPath() : "./";
  let headerLoaded = false;
  let footerLoaded = false;

  // hiển thị main content khi đã load header và footer
  function showMainContentIfReady() {
    if (headerLoaded && footerLoaded) {
      const mainContent = document.querySelector(".main-content");
      if (mainContent) mainContent.classList.add("visible");
    }
  }

  // Load Header
  const headerPlaceholder = document.querySelector("#header-placeholder");
  if (headerPlaceholder) {
    fetch(rootPath + "components/header.html")
      .then((response) => response.text())
      .then((data) => {
        data = data.replace(/\{\{rootPath\}\}/g, rootPath);
        headerPlaceholder.innerHTML = data;
        headerPlaceholder.classList.add("loaded");
        headerLoaded = true;
        showMainContentIfReady();

        // Khởi tạo ThemeToggle ngay sau khi header load
        initThemeToggleUI();

        if (typeof updateUIBasedOnLoginState === "function") {
          updateUIBasedOnLoginState();
        }
        if (typeof setActiveLink === "function") {
          setActiveLink();
        }
      })
      .catch((error) => console.error("Error loading header:", error));
  } else {
    headerLoaded = true;
    showMainContentIfReady();
  }

  // Load Footer
  const footerPlaceholder = document.querySelector("#footer-placeholder");
  if (footerPlaceholder) {
    fetch(rootPath + "components/footer.html")
      .then((response) => response.text())
      .then((data) => {
        data = data.replace(/\{\{rootPath\}\}/g, rootPath);
        footerPlaceholder.innerHTML = data;
        footerPlaceholder.classList.add("loaded");
        footerLoaded = true;
        showMainContentIfReady();
      })
      .catch((error) => console.error("Error loading footer:", error));
  } else {
    footerLoaded = true;
    showMainContentIfReady();
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

/**
 * ThemeToggle UI - Tạo và quản lý nút chuyển đổi theme
 * Sử dụng ThemeToggleModule nếu có (từ ThemeToggle.js),
 * fallback về inline implementation nếu không
 */
const THEME_KEY = "codemaster_theme";

function initThemeToggleUI() {
  // Nếu ThemeToggleModule đã được load (từ ThemeToggle.js), sử dụng nó
  if (window.ThemeToggleModule) {
    window.ThemeToggleModule.initThemeToggle();
    return;
  }

  // Fallback: inline implementation cho các trang chưa load ThemeToggle.js
  const currentTheme =
    localStorage.getItem(THEME_KEY) ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");

  // Desktop - thêm vào user-area
  const userArea = document.querySelector(".user-area");
  if (userArea && !userArea.querySelector(".theme-toggle-btn")) {
    const btn = createThemeToggleButton(currentTheme);
    userArea.insertBefore(btn, userArea.firstChild);
  }

  // Mobile - thêm vào nav-mobile-list (bên trong menu, không phải header)
  const navMobileList = document.querySelector(".nav-mobile-list");
  if (navMobileList && !navMobileList.querySelector(".theme-toggle-item")) {
    const themeItem = document.createElement("li");
    themeItem.className = "theme-toggle-item";
    themeItem.innerHTML = `
      <button class="theme-toggle-mobile-btn">
        <i class="icon fas ${currentTheme === "dark" ? "fa-sun" : "fa-moon"}"></i>
        <span>${currentTheme === "dark" ? "Chế độ sáng" : "Chế độ tối"}</span>
      </button>
    `;

    // Chèn sau Blog (trước các auth items)
    const blogItem = navMobileList.querySelector('a[href*="blog.html"]');
    if (blogItem && blogItem.parentElement) {
      blogItem.parentElement.after(themeItem);
    } else {
      navMobileList.appendChild(themeItem);
    }

    // Attach event
    const mobileThemeBtn = themeItem.querySelector(".theme-toggle-mobile-btn");
    if (mobileThemeBtn) {
      mobileThemeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
      });
    }
  }
}

function createThemeToggleButton(currentTheme) {
  const btn = document.createElement("button");
  btn.className = "theme-toggle-btn";
  if (currentTheme === "dark") {
    btn.classList.add("dark-mode");
  }
  btn.title = "Chuyển đổi chế độ sáng/tối";
  btn.innerHTML = `
    <i class="fas fa-sun theme-icon-light"></i>
    <i class="fas fa-moon theme-icon-dark"></i>
  `;

  btn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleTheme();
  });

  return btn;
}

function toggleTheme() {
  // Nếu ThemeToggleModule có, sử dụng nó để đảm bảo đồng bộ
  if (window.ThemeToggleModule) {
    window.ThemeToggleModule.toggleTheme();
    return;
  }

  // Fallback
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = currentTheme === "light" ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem(THEME_KEY, newTheme);

  // Update all toggle buttons
  syncAllThemeButtons(newTheme);
}

/**
 * Đồng bộ trạng thái tất cả các nút toggle theme
 */
function syncAllThemeButtons(theme) {
  const buttons = document.querySelectorAll(".theme-toggle-btn");
  buttons.forEach((btn) => {
    if (theme === "dark") {
      btn.classList.add("dark-mode");
    } else {
      btn.classList.remove("dark-mode");
    }
  });

  // Sync mobile buttons
  document.querySelectorAll(".theme-toggle-mobile-btn").forEach((btn) => {
    const icon = btn.querySelector("i");
    const span = btn.querySelector("span");
    if (icon) {
      icon.className = `icon fas ${theme === "dark" ? "fa-sun" : "fa-moon"}`;
    }
    if (span) {
      span.textContent = theme === "dark" ? "Chế độ sáng" : "Chế độ tối";
    }
  });
}
