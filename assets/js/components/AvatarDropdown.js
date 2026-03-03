/**
 * AvatarDropdown Component
 * Hiển thị avatar người dùng với dropdown menu chứa các tùy chọn
 */

import { auth } from "../firebaseConfig.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { cacheManager } from "../utils/cache-manager.js";
import { destroyNotificationBell } from "./NotificationBell.js";

/**
 * AvatarDropdown - Quản lý avatar và dropdown menu
 */
export class AvatarDropdown {
  constructor(options = {}) {
    this.rootPath = options.rootPath || "./";
    this.wrapper = null;
    this.mobileSection = null;
    this.dropdownOpen = false;
    this.userData = null;
  }

  /**
   * Khởi tạo component với user data
   * @param {Object} userData - Dữ liệu người dùng từ localStorage
   */
  init(userData) {
    if (!userData) return;

    this.userData = userData;

    // Render UI
    this._render();

    // Đóng dropdown khi click ngoài
    document.addEventListener("click", this._handleOutsideClick.bind(this));
  }

  /**
   * Render avatar dropdown vào user-area
   */
  _render() {
    // Desktop - render vào user-area
    const userArea = document.querySelector(".user-area");
    if (userArea) {
      this._renderDesktop(userArea);
    }

    // Mobile - render vào nav-mobile-list
    const navMobileList = document.querySelector(".nav-mobile-list");
    if (navMobileList) {
      this._renderMobile(navMobileList);
    }
  }

  /**
   * Render cho desktop
   */
  _renderDesktop(userArea) {
    // Xóa wrapper cũ nếu có
    const existing = userArea.querySelector(".avatar-dropdown-wrapper");
    if (existing) existing.remove();

    // Tạo wrapper
    this.wrapper = document.createElement("div");
    this.wrapper.className = "avatar-dropdown-wrapper";

    const isAdmin = this.userData.role === 1;
    const avatarUrl =
      this.userData.photoURL ||
      `${this.rootPath}assets/images/avatar-default.jpg`;
    const displayName = this.userData.displayName || "Người dùng";
    const email = this.userData.email || "";

    this.wrapper.innerHTML = `
      <button class="avatar-btn" title="${displayName}">
        <img src="${avatarUrl}" alt="${displayName}" class="avatar-img" onerror="this.src='${this.rootPath}assets/images/avatar-default.jpg'" />
        <i class="fas fa-chevron-down avatar-chevron"></i>
      </button>
      <div class="avatar-dropdown">
        <div class="avatar-dropdown-header">
          <img src="${avatarUrl}" alt="${displayName}" class="dropdown-avatar" onerror="this.src='${this.rootPath}assets/images/avatar-default.jpg'" />
          <div class="dropdown-user-info">
            <span class="dropdown-user-name">${displayName}</span>
            <span class="dropdown-user-email">${email}</span>
          </div>
        </div>
        <div class="avatar-dropdown-menu">
          ${
            isAdmin
              ? `
          <a href="${this.rootPath}admin.html" class="dropdown-menu-item">
            <i class="fas fa-cog"></i>
            <span>Quản trị</span>
          </a>
          `
              : `
          <a href="${this.rootPath}profile.html" class="dropdown-menu-item">
            <i class="fas fa-user"></i>
            <span>Hồ sơ của tôi</span>
          </a>
          <a href="${this.rootPath}my-blog.html" class="dropdown-menu-item">
            <i class="fas fa-pen"></i>
            <span>Blog của tôi</span>
          </a>
          `
          }
        </div>
        <div class="avatar-dropdown-footer">
          <button class="dropdown-logout-btn">
            <i class="fas fa-sign-out-alt"></i>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    `;

    userArea.appendChild(this.wrapper);

    // Attach events
    this._attachDesktopEvents();
  }

  /**
   * Render cho mobile (trong slide-in nav)
   */
  _renderMobile(navMobileList) {
    // Xóa các items auth cũ
    this._removeMobileAuthItems(navMobileList);

    const isAdmin = this.userData.role === 1;
    const avatarUrl =
      this.userData.photoURL ||
      `${this.rootPath}assets/images/avatar-default.jpg`;
    const displayName = this.userData.displayName || "Người dùng";

    // Thêm divider
    const divider = document.createElement("li");
    divider.className = "nav-mobile-divider auth-item";
    navMobileList.appendChild(divider);

    // Thêm user info section
    const userSection = document.createElement("li");
    userSection.className = "nav-mobile-user auth-item";
    userSection.innerHTML = `
      <img src="${avatarUrl}" alt="${displayName}" class="mobile-avatar" onerror="this.src='${this.rootPath}assets/images/avatar-default.jpg'" />
      <span class="mobile-user-name">${displayName}</span>
    `;
    navMobileList.appendChild(userSection);

    // Thêm menu items
    if (isAdmin) {
      const adminLi = document.createElement("li");
      adminLi.className = "auth-item";
      adminLi.innerHTML = `
        <a href="${this.rootPath}admin.html">
          <i class="icon fas fa-cog"></i>Quản trị
        </a>
      `;
      navMobileList.appendChild(adminLi);
    } else {
      const profileLi = document.createElement("li");
      profileLi.className = "auth-item";
      profileLi.innerHTML = `
        <a href="${this.rootPath}profile.html">
          <i class="icon fas fa-user"></i>Hồ sơ của tôi
        </a>
      `;
      navMobileList.appendChild(profileLi);

      const myBlogLi = document.createElement("li");
      myBlogLi.className = "auth-item";
      myBlogLi.innerHTML = `
        <a href="${this.rootPath}my-blog.html">
          <i class="icon fas fa-pen"></i>Blog của tôi
        </a>
      `;
      navMobileList.appendChild(myBlogLi);
    }

    // Thêm logout button
    const logoutLi = document.createElement("li");
    logoutLi.className = "auth-item";
    logoutLi.innerHTML = `
      <button id="mobile-logout-btn">
        <i class="icon fas fa-sign-out-alt"></i>Đăng xuất
      </button>
    `;
    navMobileList.appendChild(logoutLi);

    // Attach logout event
    const mobileLogoutBtn = logoutLi.querySelector("#mobile-logout-btn");
    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener("click", (e) => this._handleLogout(e));
    }

    this.mobileSection = navMobileList;
  }

  /**
   * Xóa các items auth cũ trong mobile nav
   */
  _removeMobileAuthItems(navMobileList) {
    const authItems = navMobileList.querySelectorAll(".auth-item");
    authItems.forEach((item) => item.remove());

    // Xóa cả items được thêm bởi cách cũ (login, profile, logout)
    Array.from(navMobileList.children).forEach((li) => {
      const link = li.querySelector("a");
      const button = li.querySelector("button");
      if (
        (link &&
          (link.getAttribute("href")?.includes("login.html") ||
            link.getAttribute("href")?.includes("profile.html") ||
            link.getAttribute("href")?.includes("admin.html"))) ||
        (button && button.id === "logout-btn")
      ) {
        li.remove();
      }
    });
  }

  /**
   * Attach events cho desktop dropdown
   */
  _attachDesktopEvents() {
    if (!this.wrapper) return;

    // Toggle dropdown
    const avatarBtn = this.wrapper.querySelector(".avatar-btn");
    if (avatarBtn) {
      avatarBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._toggleDropdown();
      });
    }

    // Logout button
    const logoutBtn = this.wrapper.querySelector(".dropdown-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => this._handleLogout(e));
    }

    // Menu items - close dropdown on click
    const menuItems = this.wrapper.querySelectorAll(".dropdown-menu-item");
    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        this._closeDropdown();
      });
    });
  }

  /**
   * Toggle dropdown
   */
  _toggleDropdown() {
    const dropdown = this.wrapper?.querySelector(".avatar-dropdown");
    if (!dropdown) return;

    this.dropdownOpen = !this.dropdownOpen;
    dropdown.classList.toggle("show", this.dropdownOpen);
    this.wrapper.classList.toggle("active", this.dropdownOpen);
  }

  /**
   * Đóng dropdown
   */
  _closeDropdown() {
    const dropdown = this.wrapper?.querySelector(".avatar-dropdown");
    if (dropdown) {
      dropdown.classList.remove("show");
      this.wrapper?.classList.remove("active");
      this.dropdownOpen = false;
    }
  }

  /**
   * Xử lý click bên ngoài dropdown
   */
  _handleOutsideClick(e) {
    if (!this.dropdownOpen) return;

    if (this.wrapper && !this.wrapper.contains(e.target)) {
      this._closeDropdown();
    }
  }

  /**
   * Xử lý đăng xuất
   */
  async _handleLogout(e) {
    e.preventDefault();

    const currentUserId = auth.currentUser?.uid;

    try {
      await signOut(auth);
      localStorage.removeItem("codemaster_user");

      // Clear user-specific cache
      if (currentUserId) {
        cacheManager.clearUserCache(currentUserId);
      }

      // Hủy notification bell
      destroyNotificationBell();

      // Hủy avatar dropdown
      this.destroy();

      // Redirect
      window.location.href = this.rootPath + "index.html";
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  /**
   * Dọn dẹp
   */
  destroy() {
    // Remove desktop
    if (this.wrapper) {
      this.wrapper.remove();
      this.wrapper = null;
    }

    // Remove mobile auth items
    const navMobileList = document.querySelector(".nav-mobile-list");
    if (navMobileList) {
      this._removeMobileAuthItems(navMobileList);
    }

    // Remove event listener
    document.removeEventListener("click", this._handleOutsideClick.bind(this));

    this.dropdownOpen = false;
    this.userData = null;
  }
}

// Singleton instance
let avatarDropdownInstance = null;

/**
 * Lấy instance của AvatarDropdown (singleton)
 */
export function getAvatarDropdown(options = {}) {
  if (!avatarDropdownInstance) {
    avatarDropdownInstance = new AvatarDropdown(options);
  }
  return avatarDropdownInstance;
}

/**
 * Khởi tạo AvatarDropdown khi user đăng nhập
 * @param {Object} userData - Dữ liệu người dùng
 * @param {Object} options - Tùy chọn
 */
export function initAvatarDropdown(userData, options = {}) {
  const dropdown = getAvatarDropdown(options);
  dropdown.init(userData);
  return dropdown;
}

/**
 * Hủy AvatarDropdown khi user đăng xuất
 */
export function destroyAvatarDropdown() {
  if (avatarDropdownInstance) {
    avatarDropdownInstance.destroy();
    avatarDropdownInstance = null;
  }
}

/**
 * Render login button cho user chưa đăng nhập
 */
export function renderLoginButton(rootPath = "./") {
  const userArea = document.querySelector(".user-area");
  if (userArea) {
    // Xóa avatar dropdown nếu có
    const existing = userArea.querySelector(".avatar-dropdown-wrapper");
    if (existing) existing.remove();

    // Xóa login button cũ nếu có
    const existingLogin = userArea.querySelector(".login-btn");
    if (existingLogin) existingLogin.remove();

    // Thêm login button
    const loginBtn = document.createElement("a");
    loginBtn.href = rootPath + "login.html";
    loginBtn.className = "login-btn";
    loginBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Đăng Nhập`;
    userArea.appendChild(loginBtn);
  }

  // Mobile
  const navMobileList = document.querySelector(".nav-mobile-list");
  if (navMobileList) {
    // Xóa auth items cũ
    const authItems = navMobileList.querySelectorAll(".auth-item");
    authItems.forEach((item) => item.remove());

    // Thêm login
    const loginLi = document.createElement("li");
    loginLi.className = "auth-item";
    loginLi.innerHTML = `
      <a href="${rootPath}login.html">
        <i class="icon fas fa-sign-in-alt"></i>Đăng Nhập
      </a>
    `;
    navMobileList.appendChild(loginLi);
  }
}
