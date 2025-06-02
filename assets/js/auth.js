import { auth } from "./firebaseConfig.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Cập nhật UI dựa trên trạng thái đăng nhập
function updateUIBasedOnLoginState() {
  const userData = getUserData();
  updateNavigationMenu(!!userData);

  // Nếu đang ở trang hồ sơ và chưa đăng nhập, chuyển hướng đến trang đăng nhập
  if (window.location.pathname.includes("profile.html") && !userData) {
    window.location.href = "login.html";
  }

  // Nếu đang ở trang đăng nhập và đã đăng nhập, hiển thị thông báo
  if (window.location.pathname.includes("login.html") && userData) {
    showLoginStatus(userData);
  }
}

// Lấy dữ liệu người dùng từ localStorage
function getUserData() {
  return JSON.parse(localStorage.getItem("codemaster_user") || "null");
}

// Cập nhật menu điều hướng dựa trên trạng thái đăng nhập
function updateNavigationMenu(isLoggedIn) {
  const navList = document.querySelector("nav ul");
  if (!navList) return;

  let authNavItem = Array.from(navList.children).find((li) => {
    const link = li.querySelector("a");
    return (
      link &&
      (link.href.includes("login.html") || link.href.includes("profile.html"))
    );
  });

  if (!authNavItem) {
    authNavItem = document.createElement("li");
    navList.appendChild(authNavItem);
  }

  authNavItem.innerHTML = isLoggedIn
    ? '<a href="profile.html">Hồ Sơ Của Tôi</a> <a href="#" id="logout-btn" style="margin-left:10px">Đăng Xuất</a>'
    : '<a href="login.html">Đăng Nhập</a>';

  // Đặt lớp active nếu đang ở trang hiện tại
  const navLinks = navList.querySelectorAll("a");
  const currentPath = window.location.pathname.split("/").pop();

  navLinks.forEach((link) => {
    if (link.getAttribute("href") === currentPath) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Gắn sự kiện đăng xuất nếu đã đăng nhập
  if (isLoggedIn) {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.onclick = function (e) {
        e.preventDefault();
        signOut(auth).then(() => {
          localStorage.removeItem("codemaster_user");
          window.location.href = "index.html";
        });
      };
    }
  }
}

// Hiển thị trạng thái đăng nhập trên trang đăng nhập
function showLoginStatus(userData) {
  const loginContainer = document.querySelector(".login-container");
  if (!loginContainer) return;

  const logoutNotice = document.createElement("div");
  logoutNotice.className = "logout-notice";
  logoutNotice.innerHTML = `
        <p>Bạn đã đăng nhập với tài khoản <strong>${
          userData ? userData.email : "Không xác định"
        }</strong>.</p>
        <div class="logout-actions">
            <a href="profile.html" class="btn btn-primary">Đi đến Hồ Sơ</a>
            <button class="btn btn-outline" id="logout-btn-page">Đăng Xuất</button>
        </div>
    `;
  loginContainer.insertBefore(logoutNotice, loginContainer.firstChild);

  // Gắn sự kiện đăng xuất trên trang login
  document.getElementById("logout-btn-page").onclick = function () {
    signOut(auth).then(() => {
      localStorage.removeItem("codemaster_user");
      window.location.href = "index.html";
    });
  };
}

// Khởi tạo khi DOM ready
document.addEventListener("DOMContentLoaded", function () {
  updateUIBasedOnLoginState();
});
