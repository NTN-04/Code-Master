// import phương thức cần dùng
import { auth, database } from "./firebaseConfig.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  ref,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { showFloatingNotification as showNotification } from "./utils/notifications.js";

const inputName = document.querySelector("#register-name");
const inputEmail = document.querySelector("#register-email");
const inputPassword = document.querySelector("#register-password");
const inputConfirmPwd = document.querySelector("#register-password-confirm");
const registerForm = document.getElementById("register-form");

// Xử lý đăng ký firebase
const handleRegister = function (event) {
  event.preventDefault();
  let userName = inputName.value.trim();
  let email = inputEmail.value.trim();
  let password = inputPassword.value.trim();
  let confirmPassword = inputConfirmPwd.value.trim();
  let termsAgreed = document.getElementById("terms-agree")?.checked;
  let role = 2; // 1 : admin , 2: user

  // validate form
  const isValid = validateDataForm({
    userName,
    email,
    password,
    confirmPassword,
    role,
  });
  if (!isValid) return;
  if (!termsAgreed) {
    showNotification("Vui lòng đồng ý với Điều khoản dịch vụ.", "error");
    return;
  }

  // đăng ký trên firebase
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // Lưu vào realtime db
      set(ref(database, "users/" + user.uid), {
        id: user.uid,
        role: role,
        username: userName,
        email: email,
        bio: "",
        avatar: "assets/images/avatar-default.jpg",
        createAt: new Date().toISOString().slice(0, 10), // yyyy-mm-dd
      })
        .then(() => {
          showNotification("Đăng ký thành công!", "success");
          // Xóa biểu mẫu và chuyển sang tab đăng nhập sau 1 giây
          setTimeout(() => {
            registerForm.reset();
            document.querySelector('.tab-btn[data-tab="login"]').click();
            // Điền email vào biểu mẫu đăng nhập
            document.getElementById("login-email").value = email;
            successMsg.textContent = "";
          }, 1000);
        })
        .catch((error) => {
          console.error("Lưu thông tin thất bại: " + error.message);
          showNotification("Lưu thông tin thất bại!", "error");
        });
    })
    .catch((error) => {
      if (error.code === "auth/email-already-in-use") {
        showNotification("Email đã tồn tại trên hệ thống!", "error");
      } else if (error.code === "auth/weak-password") {
        showNotification("Mật khẩu quá yếu!", "error");
      } else {
        console.error("Đăng ký thất bại: " + error.message);
        showNotification("Đăng ký thất bại!", "error");
      }
    });
};

// Hàm hiển thị lỗi
function showValidateError(input, message) {
  let errorEl = input.closest(".form-group").querySelector(".valid-error");
  if (errorEl) {
    errorEl.textContent = message;
    input.classList.add("valid-error-border");
  }
}

function clearValidateError(input) {
  let errorEl = input.closest(".form-group").querySelector(".valid-error");
  if (errorEl) errorEl.textContent = "";
  input.classList.remove("valid-error-border");
}

// Hàm validate form đăng ký
function validateDataForm({
  userName,
  email,
  password,
  confirmPassword,
  role,
}) {
  let valid = true;
  // Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showValidateError(inputEmail, "Email không hợp lệ!");
    valid = false;
  } else {
    clearValidateError(inputEmail);
  }
  // Username
  if (!userName || userName.length < 3 || userName.length > 32) {
    showValidateError(inputName, "Tên người dùng phải từ 3-32 ký tự!");
    valid = false;
  } else {
    clearValidateError(inputName);
  }
  // Password
  const pw = password || "";
  const pwValid =
    pw.length >= 6 &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw);
  if (!pwValid) {
    showValidateError(
      inputPassword,
      "Mật khẩu tối thiểu 6 ký tự, có chữ hoa, số và ký tự đặc biệt!"
    );
    valid = false;
  } else {
    clearValidateError(inputPassword);
  }
  // Confirm password
  if (confirmPassword !== password) {
    showValidateError(inputConfirmPwd, "Mật khẩu xác nhận không khớp!");
    valid = false;
  } else {
    clearValidateError(inputConfirmPwd);
  }
  return valid;
}

registerForm.addEventListener("submit", handleRegister);
