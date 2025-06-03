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

  // Đặt lớp active cho link hiện tại
  const navLinks = navList.querySelectorAll("a");
  const currentPath = window.location.pathname.split("/").pop();

  navLinks.forEach((link) => {
    // Loại bỏ active cũ
    link.classList.remove("active");
    // Nếu href trùng với trang hiện tại và không phải là nút đăng xuất thì thêm active
    if (link.getAttribute("href") === currentPath) {
      link.classList.add("active");
    }
  });
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
