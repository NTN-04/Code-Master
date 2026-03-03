import { auth, database } from "./firebaseConfig.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
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
import {
  checkUserPreferences,
  showOnboardingSurvey,
} from "./components/onboarding-survey.js";

// Cập nhật UI dựa trên trạng thái đăng nhập
async function updateUIBasedOnLoginState() {
  const userData = getUserData();
  const isLoggedIn = !!userData;
  const rootPath = typeof getRootPath === "function" ? getRootPath() : "./";

  if (isLoggedIn && userData.uid) {
    // Khởi tạo NotificationBell
    initNotificationBell(userData.uid, { rootPath });

    // Khởi tạo AvatarDropdown
    initAvatarDropdown(userData, { rootPath });

    // Kiểm tra và hiển thị onboarding survey nếu chưa có preferences
    await checkAndShowOnboardingSurvey(userData.uid);
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

/**
 * Kiểm tra và hiển thị onboarding survey nếu user chưa làm
 * - Không hiển thị cho admin (role = 1)
 * - Không hiển thị nếu user đã bỏ qua survey
 * - Chỉ hiển thị 1 lần duy nhất khi đăng nhập
 */
async function checkAndShowOnboardingSurvey(userId) {
  // Chỉ hiển thị survey trên các trang chính (không phải login, admin, course-detail)
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const excludedPages = ["login.html", "admin.html", "course-detail.html"];

  if (excludedPages.includes(currentPage)) return;

  // Kiểm tra đã hiện survey trong session này chưa (tránh hiện lại khi navigate)
  const sessionKey = `survey_shown_${userId}`;
  if (sessionStorage.getItem(sessionKey)) return;

  try {
    // Lấy user data để check role
    const userData = getUserData();

    // Admin (role = 1) không cần hiển thị survey
    if (userData?.role === 1) return;

    // Kiểm tra user đã skip survey chưa (lưu trong localStorage)
    const skipKey = `survey_skipped_${userId}`;
    if (localStorage.getItem(skipKey)) return;

    const preferences = await checkUserPreferences(userId);
    if (!preferences) {
      // Đánh dấu đã hiện survey trong session này
      sessionStorage.setItem(sessionKey, "true");

      // Delay một chút để trang load xong
      setTimeout(() => {
        showOnboardingSurvey(userId);
      }, 500);
    }
  } catch (error) {
    console.error("Error checking user preferences:", error);
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
