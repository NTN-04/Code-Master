import { auth } from "./firebaseConfig.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  GithubAuthProvider,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Chức năng Trang Đăng Nhập
document.addEventListener("DOMContentLoaded", function () {
  // Xử lý đăng nhập bằng email/password
  handlerLoginEmailPassword();
  // Khởi tạo tabs
  initTabs();
  // Khởi tạo chức năng hiện/ẩn mật khẩu
  initPasswordToggles();

  // Quên mật khẩu
  handleForgotPassword();

  // Khởi tạo chức năng login google/github
  setupGoogleSignIn();
  setupGithubSignIn();

  // Giám sát trạng thái xác thực
  setupAuthStateMonitoring();
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

// Xử lý đăng nhập bằng email/password
function handlerLoginEmailPassword() {
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
              displayName: user.displayName || email.split("@")[0],
            })
          );
          alert("Đăng nhập thành công!");
          window.location.href = "index.html";
        })
        .catch((error) => {
          alert("Lỗi :" + error.message);
        });
    });
  }
}

// Xử lý quên mật khẩu
function handleForgotPassword() {
  const forgotPasswordLink = document.querySelector(".forgot-password");

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", function (e) {
      e.preventDefault();

      // Hiển thị modal quên mật khẩu
      const modalContainer = document.getElementById("forgot-password-modal");
      if (modalContainer) {
        // xử lý đóng modal
        const closeBtn = document.querySelector(".close-modal");
        closeBtn.addEventListener("click", () => {
          modalContainer.style.display = "none";
        });
        // Đóng modal khi click bên ngoài nội dung
        modalContainer.addEventListener("click", (e) => {
          if (e.target === modalContainer) {
            modalContainer.style.display = "none";
          }
        });

        // Xử lý submit form quên mật khẩu
        const resetForm = document.getElementById("forgot-password-form");
        resetForm.addEventListener("submit", async (e) => {
          e.preventDefault();

          const resetEmail = document
            .getElementById("reset-email")
            .value.trim();

          if (!resetEmail) {
            alert("Vui lòng nhập địa chỉ email!");
            return;
          }

          // Hiển thị trạng thái đang xử lý khi submit
          const submitBtn = resetForm.querySelector('button[type="submit"]');
          const originalText = submitBtn.innerHTML;
          submitBtn.disabled = true;
          submitBtn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

          try {
            await sendPasswordResetEmail(auth, resetEmail);
            alert("Email đã được gửi! Vui lòng kiểm tra hộp thư của bạn.");
            modalContainer.style.display = "none";
          } catch (error) {
            let errorMessage = "";

            switch (error.code) {
              case "auth/invalid-email":
                errorMessage = "Email không hợp lệ.";
                break;
              case "auth/user-not-found":
                errorMessage = "Không tìm thấy tài khoản với email này.";
                break;
              case "auth/too-many-requests":
                errorMessage = "Quá nhiều yêu cầu. Vui lòng thử lại sau.";
                break;
              default:
                errorMessage = error.message;
            }

            alert("Lỗi: " + errorMessage);
            console.error("Password reset error:", error);
          } finally {
            // Khôi phục nút submit
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
          }
        });

        // Hiển thị modal
        modalContainer.style.display = "flex";
      }
    });
  }
}
// Hàm chung xử lý đăng nhập với Firebase gg/github
async function signInWithProvider(provider, providerName) {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Xử lý thông tin bổ sung nếu cần (như access token)
    let additionalInfo = {};
    if (providerName === "github") {
      const credential = GithubAuthProvider.credentialFromResult(result);
      additionalInfo.accessToken = credential.accessToken;
    }

    // Lưu thông tin người dùng
    saveUserData(user, providerName);

    // Thông báo và chuyển hướng
    // alert(`Đăng nhập ${providerName} thành công!`);
    window.location.href = "index.html";
    return { success: true, user };
  } catch (error) {
    // Xử lý lỗi
    handleAuthError(error, providerName);
    return { success: false, error };
  }
}

// Lưu người dùng vào localStorage
function saveUserData(user, provider) {
  let userData = {
    uid: user.uid,
    email: user.email || `${user.displayName}@${provider}.user`,
    displayName:
      user.displayName ||
      (user.email ? user.email.split("@")[0] : `Người dùng ${provider}`),
    photoURL: user.photoURL,
    provider: provider,
  };
  localStorage.setItem("codemaster_user", JSON.stringify(userData));
}

// Xử lý lỗi xác thực
function handleAuthError(error, providerName) {
  console.error(`Lỗi đăng nhập ${providerName}: `, error);

  let errorMessage = ` Đăng nhập ${providerName} thất bại: `;

  switch (error.code) {
    case "auth/popup-closed-by-user":
      errorMessage += "Bạn đã đóng cửa sổ đăng nhập.";
      break;
    case "auth/popup-blocked":
      errorMessage += "Cửa sổ đăng nhập bị chặn. Vui lòng cho phép popup.";
      break;
    case "auth/account-exists-with-different-credential":
      errorMessage +=
        "Email này đã được sử dụng với phương thức đăng nhập khác.";
      break;
    case "auth/unauthorized-domain":
      errorMessage +=
        "Domain này không được phép sử dụng GitHub Authentication. Vui lòng liên hệ quản trị viên.";
      break;
    default:
      errorMessage += error.message;
  }
  alert(errorMessage);
}

// Xử lý đăng nhập Google
function setupGoogleSignIn() {
  const googleProvider = new GoogleAuthProvider();
  // Thêm các tham số để luôn hiển thị trang chọn tài khoản
  googleProvider.setCustomParameters({
    prompt: "select_account",
  });

  document.querySelector(".btn-google").addEventListener("click", async () => {
    await signInWithProvider(googleProvider, "google");
  });
}

// Xử lý đăng nhập Github
function setupGithubSignIn() {
  const githubProvider = new GithubAuthProvider();

  document.querySelector(".btn-github").addEventListener("click", async () => {
    await signInWithProvider(githubProvider, "github");
  });
}

// Giám sát trạng thái xác thực
function setupAuthStateMonitoring() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      // Xác định provider
      const providerData = user.providerData[0];
      let providerName = "email";

      if (providerData.providerId === "google.com") {
        providerName = "google";
      } else if (providerData.providerId === "github.com") {
        providerName = "github";
      }

      // Đồng bộ localStorage nếu cần
      if (!localStorage.getItem("codemaster_user")) {
        saveUserData(user, providerName);
      }
    } else {
      // Xóa dữ liệu khi đăng xuất
      if (localStorage.getItem("codemaster_user")) {
        localStorage.removeItem("codemaster_user");
      }
    }
  });
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
