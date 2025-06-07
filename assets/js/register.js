// import phương thức cần dùng
import { auth, database } from "./firebaseConfig.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  ref,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

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
  if (!userName || !email || !password || !confirmPassword) {
    alert("Vui lòng nhập đầy đủ các trường dữ liệu !");
    return;
  }
  if (password !== confirmPassword) {
    alert("Mật khẩu không hợp lệ !");
    return;
  }
  if (!termsAgreed) {
    alert("Bạn phải đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.");
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
          alert("Đăng ký thành công!");
          // Xóa biểu mẫu và chuyển sang tab đăng nhập sau 1 giây
          setTimeout(() => {
            registerForm.reset();
            document.querySelector('.tab-btn[data-tab="login"]').click();

            // Điền email vào biểu mẫu đăng nhập
            document.getElementById("login-email").value = email;
          }, 1000);
        })
        .catch((error) => {
          alert("Lưu thông tin thất bại: " + error.message);
        });
    })
    .catch((error) => {
      alert("Đăng Ký thất bại: " + error.message);
    });
};

registerForm.addEventListener("submit", handleRegister);
