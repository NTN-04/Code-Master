import { auth } from "./firebaseConfig.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Cập nhật UI dựa trên trạng thái đăng nhập
function updateUIBasedOnLoginState() {
  console.log("Updating UI based on login state");
  const userData = getUserData();
  updateNavigationMenu(!!userData);

  // Nếu đang ở trang hồ sơ và chưa đăng nhập, chuyển hướng đến trang đăng nhập
  if (window.location.pathname.includes("profile.html") && !userData) {
    window.location.href = "login.html";
  }
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

  // Xử lý cho nav-mobile nếu có
  const navMobile = document.querySelector(".nav-mobile-list");
  if (navMobile) updateNavList(navMobile, isLoggedIn);
}

function updateNavList(navList, isLoggedIn) {
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
    // Thêm "Hồ Sơ Của Tôi"
    const profileLi = document.createElement("li");
    const profileLink = document.createElement("a");
    profileLink.href = "profile.html";
    profileLink.innerHTML = `<i class="icon fa-solid fa-user"></i> Tài khoản`;
    profileLi.appendChild(profileLink);
    navList.appendChild(profileLi);

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
      signOut(auth).then(() => {
        localStorage.removeItem("codemaster_user");
        updateNavigationMenu(false);
        window.location.href = "index.html";
      });
    };
  } else {
    // Thêm "Đăng Nhập"
    const loginLi = document.createElement("li");
    const loginLink = document.createElement("a");
    loginLink.href = "login.html";
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
