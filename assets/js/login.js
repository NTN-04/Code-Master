import { auth } from "./firebaseConfig.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Chức năng Trang Đăng Nhập
document.addEventListener("DOMContentLoaded", function () {
  // Xử lý biểu mẫu đăng nhập
  HandlerLogin();
  // Khởi tạo tabs
  initTabs();
  // Khởi tạo chức năng hiện/ẩn mật khẩu
  initPasswordToggles();
});

// Khởi tạo điều hướng tab
function initTabs() {
  const tabButtons = document.querySelectorAll(".login-tabs .tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Thêm sự kiện click cho các nút tab
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Loại bỏ lớp active từ tất cả các nút và nội dung
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // Thêm lớp active cho nút được nhấp vào
      button.classList.add("active");

      // Hiển thị nội dung tương ứng
      const tabId = button.getAttribute("data-tab");
      const tabContent = document.getElementById(tabId);
      if (tabContent) {
        tabContent.classList.add("active");
      }
    });
  });
}

// Xử lý biểu mẫu đăng nhập
function HandlerLogin() {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value.trim();
      const rememberMe = document.getElementById("remember-me").checked;

      // validate form
      if (!email || !password) {
        alert("Vui lòng nhập email và password !");
        return;
      }

      signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          const user = userCredential.user;

          // Lưu uid/email vào localStorage để kiểm tra trạng thái đăng nhập
          localStorage.setItem(
            "codemaster_user",
            JSON.stringify({
              uid: user.uid,
              email: user.email,
            })
          );
          alert("Đăng nhập thành công!");
          window.location.href = "profile.html";
        })
        .catch((error) => {
          alert("Lỗi :" + error.message);
        });
    });
  }
}

// Khởi tạo nút hiện/ẩn mật khẩu
function initPasswordToggles() {
  const toggleButtons = document.querySelectorAll(".toggle-password");

  toggleButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const passwordField = this.previousElementSibling;
      const icon = this.querySelector("i");

      // Chuyển đổi loại trường
      if (passwordField.type === "password") {
        passwordField.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
      } else {
        passwordField.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
      }
    });
  });
}
