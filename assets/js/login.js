import { auth, database } from "./firebaseConfig.js";
import {
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  GithubAuthProvider,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

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

// Hàm kiểm tra trạng thái tài khoản
async function checkAccountStatus(userId) {
  try {
    const userRef = ref(database, "users/" + userId);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      const userData = snapshot.val();
      return userData.status || "active";
    }
    return "active";
  } catch (e) {
    return "active";
  }
}
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
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value.trim();

      // validate form
      if (!email || !password) {
        showNotification("Vui lòng nhập email và mật khẩu!", "error");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showNotification("Email không hợp lệ!", "error");
        return;
      }

      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;

        // Kiểm tra trạng thái tài khoản
        const status = await checkAccountStatus(user.uid);
        if (status === "suspended") {
          await signOut(auth);
          showNotification(
            "Tài khoản của bạn đã bị tạm ngừng. Vui lòng liên hệ hỗ trợ để được khôi phục.",
            "error"
          );
          return;
        }

        // Lưu thông tin người dùng vào local (đồng bộ từ Database)
        await saveUserData(user, "email");

        // chuyển trang khi thành công
        window.location.href = "index.html";
      } catch (error) {
        console.error("Lỗi đăng nhập: ", error);

        let errorMessage = "Đăng nhập thất bại: ";

        switch (error.code) {
          case "auth/invalid-email":
            errorMessage = "Email không hợp lệ!";
            break;
          case "auth/user-disabled":
            errorMessage =
              "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.";
            break;
          case "auth/user-not-found":
            errorMessage =
              "Không tìm thấy tài khoản với email này. Vui lòng kiểm tra lại.";
            break;
          case "auth/wrong-password":
            errorMessage = "Mật khẩu không đúng. Vui lòng thử lại.";
            break;
          case "auth/invalid-credential":
            errorMessage = "Thông tin đăng nhập không hợp lệ.";
            break;
          case "auth/too-many-requests":
            errorMessage =
              "Quá nhiều lần thử đăng nhập thất bại. Vui lòng thử lại sau hoặc đặt lại mật khẩu.";
            break;
          case "auth/network-request-failed":
            errorMessage =
              "Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet và thử lại.";
            break;
          case "auth/internal-error":
            errorMessage = "Lỗi hệ thống. Vui lòng thử lại sau.";
            break;
          default:
            errorMessage += error.message;
        }

        showNotification(errorMessage, "error");

        // Focus vào trường email hoặc password khi lỗi
        if (
          error.code === "auth/user-not-found" ||
          error.code === "auth/invalid-email"
        ) {
          document.getElementById("login-email").focus();
        } else if (
          error.code === "auth/wrong-password" ||
          error.code === "auth/invalid-credential"
        ) {
          document.getElementById("login-password").focus();
          // Clear trường password
          document.getElementById("login-password").value = "";
        }
      }
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
            showNotification(
              "Email đã được gửi! Vui lòng kiểm tra hộp thư của bạn.",
              "success"
            );
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

    // Kiểm tra trạng thái tài khoản
    const status = await checkAccountStatus(user.uid);
    if (status === "suspended") {
      await signOut(auth);
      showNotification(
        "Tài khoản của bạn đã bị tạm ngừng. Vui lòng liên hệ hỗ trợ để được khôi phục.",
        "error"
      );
      return { success: false, error: "suspended" };
    }

    // Lưu user vào database
    await saveUserToDatabase(user, providerName);
    // Lưu thông tin người dùng vào local (đồng bộ từ Database)
    await saveUserData(user, providerName);

    // Nếu là popup, gửi thông điệp về trang gốc rồi tự đóng (tránh lỗi window.close call)
    if (window.opener) {
      window.opener.postMessage(
        { type: "login-success", provider: providerName },
        window.location.origin
      );
      window.close();
      return { success: true, user };
    }

    // Thông báo và chuyển hướng
    window.location.href = "index.html";
    return { success: true, user };
  } catch (error) {
    // Xử lý lỗi
    handleAuthError(error, providerName);
    return { success: false, error };
  }
}

// Lưu user vào Realtime Database nếu chưa có
async function saveUserToDatabase(user, provider) {
  const userRef = ref(database, "users/" + user.uid);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) {
    await set(userRef, {
      id: user.uid,
      role: 2,
      username: user.displayName || user.email?.split("@")[0] || "Người dùng",
      email: user.email || "",
      bio: "",
      avatar: user.photoURL || "assets/images/avatar-default.jpg",
      createAt: new Date().toISOString().slice(0, 10),
      provider: provider,
    });
  }
}

// Lưu người dùng vào localStorage (đồng bộ từ Database nếu có)
async function saveUserData(user, provider) {
  const userRef = ref(database, "users/" + user.uid);
  // khởi tạo mặc định từ Auth
  let userData = {
    uid: user.uid,
    displayName:
      user.displayName ||
      (user.email ? user.email.split("@")[0] : `Người dùng ${provider}`),
    photoURL: user.photoURL,
    provider: provider,
    bio: "",
    role: 2, // default role
  };
  try {
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      const dbUser = snapshot.val();
      // ghi đè từ realtime db
      userData = {
        uid: user.uid,
        displayName:
          dbUser.username || user.displayName || user.email?.split("@")[0],
        photoURL: dbUser.avatar || user.photoURL,
        provider: dbUser.provider || provider,
        bio: dbUser.bio || "",
        role: dbUser.role || 2, // role từ database
      };
    }
  } catch (e) {
    // Nếu lỗi, userData sẽ là null
    console.error("Lỗi khi lấy dữ liệu user từ Realtime DB:", e);
  }
  localStorage.setItem("codemaster_user", JSON.stringify(userData));
}

// Xử lý lỗi xác thực
function handleAuthError(error, providerName) {
  console.error(`Lỗi đăng nhập ${providerName}: `, error);

  let errorMessage = ` Đăng nhập ${providerName} thất bại: `;

  switch (error.code) {
    case "auth/popup-closed-by-user":
      errorMessage = "Bạn đã đóng cửa sổ đăng nhập.";
      break;
    case "auth/popup-blocked":
      errorMessage = "Cửa sổ đăng nhập bị chặn. Vui lòng cho phép popup.";
      break;
    case "auth/account-exists-with-different-credential":
      errorMessage =
        "Email này đã được sử dụng với phương thức đăng nhập khác.";
      break;
    case "auth/unauthorized-domain":
      errorMessage =
        "Domain này không được phép sử dụng GitHub Authentication. Vui lòng liên hệ quản trị viên.";
      break;
    default:
      errorMessage += error.message;
  }
  showNotification(errorMessage, "error");
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
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // Kiểm tra trạng thái tài khoản
      const status = await checkAccountStatus(user.uid);
      if (status === "suspended") {
        await signOut(auth);
        showNotification(
          "Tài khoản của bạn đã bị tạm ngừng. Vui lòng liên hệ hỗ trợ để được khôi phục.",
          "error"
        );
        return;
      }

      // Xác định provider
      const providerData = user.providerData[0];
      let providerName = "email";

      if (providerData.providerId === "google.com") {
        providerName = "google";
      } else if (providerData.providerId === "github.com") {
        providerName = "github";
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
// Hiển thị thông báo
function showNotification(message, type = "success") {
  // Kiểm tra xem đã có thông báo nào chưa
  let notification = document.querySelector(".notification");

  // Nếu chưa có, tạo một thông báo mới
  if (!notification) {
    notification = document.createElement("div");
    notification.classList.add("notification");
    document.body.appendChild(notification);
  }

  // Đặt lớp kiểu và nội dung thông báo
  notification.className = "notification";
  notification.classList.add(type);
  notification.textContent = message;

  // Hiển thị thông báo
  notification.classList.add("show");

  // Tự động ẩn thông báo sau 3 giây
  setTimeout(() => {
    notification.classList.remove("show");
  }, 4000);
}
