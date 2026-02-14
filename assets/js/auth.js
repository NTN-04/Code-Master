import { auth } from "./firebaseConfig.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { cacheManager } from "./utils/cache-manager.js";
import {
  initNotificationBell,
  destroyNotificationBell,
} from "./components/NotificationBell.js";
import {
  initAvatarDropdown,
  destroyAvatarDropdown,
  renderLoginButton,
} from "./components/AvatarDropdown.js";

// Cập nhật UI dựa trên trạng thái đăng nhập
function updateUIBasedOnLoginState() {
  const userData = getUserData();
  const isLoggedIn = !!userData;
  const rootPath = typeof getRootPath === "function" ? getRootPath() : "./";

  if (isLoggedIn && userData.uid) {
    // Khởi tạo NotificationBell
    initNotificationBell(userData.uid, { rootPath });

    // Khởi tạo AvatarDropdown
    initAvatarDropdown(userData, { rootPath });
  } else {
    // Hủy các component
    destroyNotificationBell();
    destroyAvatarDropdown();

    // Hiển thị nút đăng nhập
    renderLoginButton(rootPath);
  }

  // Gọi lại setActiveLink từ components.js để cập nhật trạng thái active
  if (typeof setActiveLink === "function") {
    setActiveLink();
  }
}

// Export hàm để có thể gọi từ components.js
window.updateUIBasedOnLoginState = updateUIBasedOnLoginState;

// Lấy dữ liệu người dùng từ localStorage
function getUserData() {
  return JSON.parse(localStorage.getItem("codemaster_user") || "null");
}

// Khởi tạo khi DOM ready
document.addEventListener("DOMContentLoaded", function () {
  updateUIBasedOnLoginState();
});
