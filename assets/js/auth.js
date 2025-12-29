import { auth } from "./firebaseConfig.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { cacheManager } from "./utils/cache-manager.js";

// Cập nhật UI dựa trên trạng thái đăng nhập
function updateUIBasedOnLoginState() {
  const userData = getUserData();
  updateNavigationMenu(!!userData);
}

// Export hàm để có thể gọi từ components.js
window.updateUIBasedOnLoginState = updateUIBasedOnLoginState;

// Lấy dữ liệu người dùng từ localStorage
function getUserData() {
  return JSON.parse(localStorage.getItem("codemaster_user") || "null");
}

// Cập nhật menu điều hướng dựa trên trạng thái đăng nhập
function updateNavigationMenu(isLoggedIn) {
  // Xử lý cho nav-pc
  const navPC = document.querySelector(".nav-pc ul");
  if (navPC) updateNavList(navPC, isLoggedIn);

  // Xử lý cho nav-mobile
  const navMobile = document.querySelector(".nav-mobile-list");
  if (navMobile) updateNavList(navMobile, isLoggedIn);
}

function updateNavList(navList, isLoggedIn) {
  // Lấy rootPath đúng cho trang hiện tại
  const rootPath = typeof getRootPath === "function" ? getRootPath() : "./";

  // Xóa các mục login/profile/logout cũ
  Array.from(navList.children).forEach((li) => {
    const link = li.querySelector("a");
    const button = li.querySelector("button");
    if (
      (link &&
        (link.getAttribute("href") === "login.html" ||
          link.getAttribute("href") === "profile.html")) ||
      (button && button.id === "logout-btn")
    ) {
      navList.removeChild(li);
    }
  });
  if (isLoggedIn) {
    // Kiểm tra role để hiển thị link Admin
    const userData = getUserData();
    if (userData && userData.role === 1) {
      // Thêm "Quản Trị"
      const adminLi = document.createElement("li");
      const adminLink = document.createElement("a");
      adminLink.href = rootPath + "admin.html";
      adminLink.innerHTML = `<i class="icon fa-solid fa-cog"></i> Admin`;
      adminLi.appendChild(adminLink);
      navList.appendChild(adminLi);
    }

    // ẩn link nếu là admin
    if (!userData || userData.role !== 1) {
      // Thêm "Hồ Sơ Của Tôi"
      const profileLi = document.createElement("li");
      const profileLink = document.createElement("a");
      profileLink.href = rootPath + "profile.html";
      profileLink.innerHTML = `<i class="icon fa-solid fa-user"></i> ${
        userData.displayName || "Tài Khoản"
      } `;
      profileLi.appendChild(profileLink);
      navList.appendChild(profileLi);
    }

    // Thêm "Đăng Xuất"
    const logoutLi = document.createElement("li");
    const logoutBtn = document.createElement("button");
    logoutBtn.innerHTML = `<i class="icon fa-solid fa-right-from-bracket"></i> Đăng Xuất`;
    logoutBtn.id = "logout-btn";
    logoutLi.appendChild(logoutBtn);
    navList.appendChild(logoutLi);

    // Gắn sự kiện đăng xuất
    logoutBtn.onclick = function (e) {
      e.preventDefault();

      //Lấy userId trước khi đăng xuất
      const currentUserId = auth.currentUser?.uid;

      signOut(auth).then(() => {
        localStorage.removeItem("codemaster_user");

        //Clear user-specific cache khi logout
        if (currentUserId) {
          cacheManager.clearUserCache(currentUserId);
        }

        updateNavigationMenu(false);
        window.location.href = rootPath + "index.html";
      });
    };
  } else {
    // Thêm "Đăng Nhập"
    const loginLi = document.createElement("li");
    const loginLink = document.createElement("a");
    loginLink.href = rootPath + "login.html";
    loginLink.innerHTML = `<i class="icon fa-solid fa-right-to-bracket"></i> Đăng Nhập`;
    loginLi.appendChild(loginLink);
    navList.appendChild(loginLi);
  }

  // Gọi lại setActiveLink từ components.js để cập nhật trạng thái active
  if (typeof setActiveLink === "function") {
    setActiveLink();
  }
}

// Khởi tạo khi DOM ready
document.addEventListener("DOMContentLoaded", function () {
  updateUIBasedOnLoginState();
});
