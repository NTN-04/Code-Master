/**
 * ThemeToggle Component - Central Theme Management
 * Quản lý chế độ sáng/tối cho toàn bộ ứng dụng
 *
 * Hỗ trợ:
 * - Tạo nút mới cho header thông thường
 * - Bind vào nút có sẵn (learning layout)
 * - Đồng bộ trạng thái tất cả các nút toggle
 * - Export cho cả ES modules và non-module scripts
 */

const THEME_KEY = "codemaster_theme";
const THEMES = {
  LIGHT: "light",
  DARK: "dark",
};

/**
 * ThemeToggle - Singleton class quản lý theme
 */
class ThemeToggle {
  constructor() {
    this.theme = THEMES.LIGHT;
    this.boundButtons = new Set(); // Track các button đã bind
  }

  /**
   * Khởi tạo component
   * @param {Object} options - Tùy chọn khởi tạo
   * @param {boolean} options.renderToHeader - Có render nút vào header không (default: true)
   * @param {string} options.existingSelector - Selector của nút có sẵn cần bind
   */
  init(options = {}) {
    const { renderToHeader = true, existingSelector = null } = options;

    // Lấy theme từ localStorage hoặc detect system preference
    this.theme = this._getSavedTheme() || this._getSystemTheme();

    // Apply theme ngay lập tức
    this._applyTheme(this.theme, false);

    // Render toggle button vào header nếu cần
    if (renderToHeader) {
      this._renderToHeader();
    }

    // Bind vào nút có sẵn nếu có
    if (existingSelector) {
      this.bindToExisting(existingSelector);
    }

    // Đồng bộ trạng thái tất cả các nút
    this._syncAllButtons();
  }

  /**
   * Lấy theme đã lưu từ localStorage
   */
  _getSavedTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  /**
   * Detect system preference
   */
  _getSystemTheme() {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return THEMES.DARK;
    }
    return THEMES.LIGHT;
  }

  /**
   * Lấy theme hiện tại
   */
  getCurrentTheme() {
    return this.theme;
  }

  /**
   * Apply theme vào document
   * @param {string} theme - Theme cần apply
   * @param {boolean} save - Có lưu vào localStorage không
   */
  _applyTheme(theme, save = true) {
    document.documentElement.setAttribute("data-theme", theme);
    if (save) {
      localStorage.setItem(THEME_KEY, theme);
    }
    this.theme = theme;

    // Đồng bộ tất cả buttons
    this._syncAllButtons();
  }

  /**
   * Toggle giữa light và dark
   */
  toggle() {
    const newTheme = this.theme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
    this._applyTheme(newTheme);
  }

  /**
   * Bind vào button có sẵn trong DOM
   * @param {string} selector - CSS selector của button
   */
  bindToExisting(selector) {
    const btn = document.querySelector(selector);
    if (!btn || this.boundButtons.has(btn)) return;

    // Đánh dấu đã bind
    this.boundButtons.add(btn);

    // Thêm event listener
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });

    // Đồng bộ trạng thái
    this._syncButton(btn);
  }

  /**
   * Render toggle button vào header (user-area và mobile nav)
   */
  _renderToHeader() {
    // Desktop - thêm vào user-area
    const userArea = document.querySelector(".user-area");
    if (userArea && !userArea.querySelector(".theme-toggle-btn")) {
      const btn = this._createToggleButton();
      userArea.insertBefore(btn, userArea.firstChild);
      this.boundButtons.add(btn);
    }

    // Mobile - thêm vào nav-mobile-list
    const navMobileList = document.querySelector(".nav-mobile-list");
    if (navMobileList && !navMobileList.querySelector(".theme-toggle-item")) {
      const themeItem = document.createElement("li");
      themeItem.className = "theme-toggle-item";
      themeItem.innerHTML = `
        <button class="theme-toggle-mobile-btn">
          <i class="icon fas ${this.theme === THEMES.DARK ? "fa-sun" : "fa-moon"}"></i>
          <span>${this.theme === THEMES.DARK ? "Chế độ sáng" : "Chế độ tối"}</span>
        </button>
      `;

      // Chèn sau Blog
      const blogItem = navMobileList.querySelector('a[href*="blog.html"]');
      if (blogItem && blogItem.parentElement) {
        blogItem.parentElement.after(themeItem);
      } else {
        navMobileList.appendChild(themeItem);
      }

      // Attach event
      const mobileBtn = themeItem.querySelector(".theme-toggle-mobile-btn");
      if (mobileBtn) {
        this.boundButtons.add(mobileBtn);
        mobileBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggle();
        });
      }
    }
  }

  /**
   * Tạo toggle button element
   */
  _createToggleButton() {
    const btn = document.createElement("button");
    btn.className = "theme-toggle-btn";
    btn.title = "Chuyển đổi chế độ sáng/tối";
    btn.innerHTML = `
      <i class="fas fa-sun theme-icon-light"></i>
      <i class="fas fa-moon theme-icon-dark"></i>
    `;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });

    return btn;
  }

  /**
   * Đồng bộ trạng thái một button
   */
  _syncButton(btn) {
    if (!btn) return;

    const isDark = this.theme === THEMES.DARK;

    // Xử lý .theme-toggle-btn (desktop)
    if (btn.classList.contains("theme-toggle-btn")) {
      btn.classList.toggle("dark-mode", isDark);
    }

    // Xử lý .theme-toggle-mobile-btn (mobile menu)
    if (btn.classList.contains("theme-toggle-mobile-btn")) {
      const icon = btn.querySelector("i");
      const span = btn.querySelector("span");
      if (icon) {
        icon.className = `icon fas ${isDark ? "fa-sun" : "fa-moon"}`;
      }
      if (span) {
        span.textContent = isDark ? "Chế độ sáng" : "Chế độ tối";
      }
    }
  }

  /**
   * Đồng bộ tất cả các buttons
   */
  _syncAllButtons() {
    // Sync tất cả .theme-toggle-btn
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      this._syncButton(btn);
    });

    // Sync tất cả .theme-toggle-mobile-btn
    document.querySelectorAll(".theme-toggle-mobile-btn").forEach((btn) => {
      this._syncButton(btn);
    });
  }

  /**
   * Dọn dẹp - unbind tất cả
   */
  destroy() {
    this.boundButtons.clear();
  }
}

// ============================================
// SINGLETON & EXPORTS
// ============================================

// Singleton instance
let themeToggleInstance = null;

/**
 * Lấy instance của ThemeToggle (singleton)
 */
export function getThemeToggle() {
  if (!themeToggleInstance) {
    themeToggleInstance = new ThemeToggle();
  }
  return themeToggleInstance;
}

/**
 * Khởi tạo ThemeToggle cho header thông thường
 * Dùng cho components.js sau khi load header
 */
export function initThemeToggle() {
  const toggle = getThemeToggle();
  toggle.init({ renderToHeader: true });
  return toggle;
}

/**
 * Khởi tạo ThemeToggle cho Learning Layout
 * Dùng cho course.js - bind vào nút có sẵn
 * @param {string} selector - CSS selector của nút toggle
 */
export function initThemeToggleForLearning(
  selector = "#learning-theme-toggle",
) {
  const toggle = getThemeToggle();
  toggle.init({ renderToHeader: false, existingSelector: selector });
  return toggle;
}

/**
 * Toggle theme - hàm tiện ích
 */
export function toggleTheme() {
  getThemeToggle().toggle();
}

/**
 * Lấy theme hiện tại
 */
export function getCurrentTheme() {
  return getThemeToggle().getCurrentTheme();
}

/**
 * Apply theme sớm để tránh flash (gọi trước khi DOM ready)
 * Dùng trong IIFE ở đầu trang
 */
export function applyThemeEarly() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    document.documentElement.setAttribute("data-theme", THEMES.DARK);
  }
}

// ============================================
// GLOBAL EXPOSURE cho non-module scripts
// ============================================

// Expose ra window để components.js (non-module) có thể sử dụng
if (typeof window !== "undefined") {
  window.ThemeToggleModule = {
    getThemeToggle,
    initThemeToggle,
    initThemeToggleForLearning,
    toggleTheme,
    getCurrentTheme,
    applyThemeEarly,
    THEME_KEY,
    THEMES,
  };
}

// Export class cho advanced usage
export { ThemeToggle, THEME_KEY, THEMES };
