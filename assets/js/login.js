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
  fetchSignInMethodsForEmail,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

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
    // Nếu không tồn tại user, coi như đã bị xóa
    return "deleted";
  } catch (e) {
    return "deleted";
  }
}

// Hàm kiểm tra và chuyển hướng dựa trên vai trò và cài đặt
async function checkRoleAndRedirect(user) {
  try {
    // Lấy thông tin người dùng từ database
    const userRef = ref(database, `users/${user.uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const userData = snapshot.val();

      // Kiểm tra nếu là admin (role = 1)
      if (userData.role === 1 || userData.role === "1") {
        // Kiểm tra cài đặt adminAutoRedirect
        const autoRedirect =
          localStorage.getItem("adminAutoRedirect") === "true";

        if (autoRedirect) {
          // Chuyển hướng đến trang admin
          window.location.href = "admin.html";
          return true;
        }
      }
    }

    // Nếu không phải admin hoặc không có cài đặt auto-redirect
    window.location.href = "index.html";
    return true;
  } catch (error) {
    console.error("Lỗi khi kiểm tra vai trò:", error);
    // Mặc định chuyển về trang chủ nếu có lỗi
    window.location.href = "index.html";
    return false;
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
        if (status === "suspended" || status === "deleted") {
          await signOut(auth);
          showNotification(
            status === "suspended"
              ? "Tài khoản của bạn đã bị tạm ngừng. Vui lòng liên hệ hỗ trợ để được khôi phục."
              : "Tài khoản của bạn không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "error"
          );
          return;
        }

        // Lưu thông tin người dùng vào local (đồng bộ từ Database)
        await saveUserData(user, "email");

        // chuyển trang khi thành công
        await checkRoleAndRedirect(user);
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

            showNotification(`Lỗi: ${errorMessage}`, "error");
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
  // Biến cờ ngăn chặn nhiều lần click
  if (window.authInProgress) {
    return { success: false, error: "in-progress" };
  }
  window.authInProgress = true;

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Kiểm tra trạng thái tài khoản
    const status = await checkAccountStatus(user.uid);
    if (status === "suspended" || status === "deleted") {
      await signOut(auth);
      showNotification(
        status === "suspended"
          ? "Tài khoản của bạn đã bị tạm ngừng. Vui lòng liên hệ hỗ trợ để được khôi phục."
          : "Tài khoản của bạn không tồn tại hoặc đã bị xóa khỏi hệ thống.",
        "error"
      );
      return { success: false, error: status };
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
    await checkRoleAndRedirect(user);

    return { success: true, user };
  } catch (error) {
    // Xử lý đặc biệt cho lỗi tài khoản đã tồn tại với phương thức khác
    if (error.code === "auth/account-exists-with-different-credential") {
      try {
        // Lấy các phương thức đăng nhập cho email này
        const email = error.customData.email;
        const methods = await fetchSignInMethodsForEmail(auth, email);

        let message = `Email này (${email}) đã được sử dụng với phương thức đăng nhập khác: 
                      ${methods.join(", ")}. `;

        // Nếu có thể đăng nhập bằng Google
        if (methods.includes("google.com")) {
          message +=
            "Vui lòng đăng nhập bằng Google và liên kết tài khoản sau.";
        } else if (methods.includes("password")) {
          message += "Vui lòng đăng nhập bằng Email và mật khẩu để tiếp tục.";
        }

        showNotification(message, "info");
      } catch (err) {}
    } else {
      // Xử lý các lỗi khác
      handleAuthError(error, providerName);
    }
    return { success: false, error };
  } finally {
    // Đảm bảo reset cờ khi hoàn tất
    setTimeout(() => {
      window.authInProgress = false;
    }, 1000);
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

  let errorMessage = `Đăng nhập ${providerName} thất bại: `;
  let notificationType = "error";

  switch (error.code) {
    case "auth/popup-closed-by-user":
      // Không hiển thị thông báo khi người dùng chủ động đóng popup
      return;

    case "auth/cancelled-popup-request":
      // Không hiển thị thông báo khi popup request bị hủy (thường xảy ra khi nhiều lần click)
      return;

    case "auth/popup-blocked":
      errorMessage =
        "Cửa sổ đăng nhập bị chặn. Vui lòng cho phép popup và thử lại.";
      notificationType = "warning";
      break;

    case "auth/account-exists-with-different-credential":
      errorMessage =
        "Email này đã được sử dụng với phương thức đăng nhập khác.";
      notificationType = "warning";
      break;

    case "auth/unauthorized-domain":
      errorMessage =
        "Domain này không được phép sử dụng GitHub Authentication. Vui lòng liên hệ quản trị viên.";
      break;

    case "auth/operation-not-allowed":
      errorMessage = `Đăng nhập với ${providerName} không được bật. Vui lòng kiểm tra cấu hình Firebase.`;
      break;

    case "auth/timeout":
      errorMessage =
        "Hết thời gian kết nối, vui lòng kiểm tra mạng và thử lại.";
      notificationType = "warning";
      break;

    default:
      errorMessage += error.message;
  }

  if (errorMessage) {
    showNotification(errorMessage, notificationType);
  }
}

// Xử lý đăng nhập Google
function setupGoogleSignIn() {
  const googleProvider = new GoogleAuthProvider();
  // Thêm các tham số để luôn hiển thị trang chọn tài khoản
  googleProvider.setCustomParameters({
    prompt: "select_account",
  });

  const googleButton = document.querySelector(".btn-google");

  googleButton.addEventListener("click", async () => {
    // Disable button to prevent multiple clicks
    if (googleButton.disabled) return;

    googleButton.disabled = true;
    const originalText = googleButton.innerHTML;
    googleButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

    try {
      await signInWithProvider(googleProvider, "google");
    } finally {
      // Re-enable button after a short delay
      setTimeout(() => {
        googleButton.disabled = false;
        googleButton.innerHTML = originalText;
      }, 1500);
    }
  });
}

// Xử lý đăng nhập Github
function setupGithubSignIn() {
  const githubProvider = new GithubAuthProvider();
  // Thêm các tham số để luôn hiển thị trang chọn tài khoản
  githubProvider.setCustomParameters({
    prompt: "select_account",
  });

  // Thêm scope để lấy email public từ GitHub
  githubProvider.addScope("user:email");

  const githubButton = document.querySelector(".btn-github");

  githubButton.addEventListener("click", async () => {
    // Disable button to prevent multiple clicks
    if (githubButton.disabled) return;

    githubButton.disabled = true;
    const originalText = githubButton.innerHTML;
    githubButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

    try {
      await signInWithProvider(githubProvider, "github");
    } finally {
      // Re-enable button after a short delay
      setTimeout(() => {
        githubButton.disabled = false;
        githubButton.innerHTML = originalText;
      }, 1500);
    }
  });
}

// Giám sát trạng thái xác thực
function setupAuthStateMonitoring() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Kiểm tra trạng thái tài khoản
      const status = await checkAccountStatus(user.uid);
      if (status === "suspended" || status === "deleted") {
        await signOut(auth);
        showNotification(
          status === "suspended"
            ? "Tài khoản của bạn đã bị tạm ngừng. Vui lòng liên hệ hỗ trợ để được khôi phục."
            : "Tài khoản của bạn không tồn tại hoặc đã bị xóa khỏi hệ thống.",
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
      // Nếu trang hiện tại là login.html và người dùng đã đăng nhập
      // thực hiện kiểm tra và chuyển hướng
      // if (window.location.pathname.includes("login.html")) {
      //   await checkRoleAndRedirect(user);
      // }
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
