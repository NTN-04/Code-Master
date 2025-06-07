import { auth, database } from "./firebaseConfig.js";
import {
  updateProfile,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  ref,
  get,
  update,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

// Chức năng Trang Hồ Sơ
document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo tabs
  initTabs();

  // Khởi tạo bộ lọc khóa học
  initCourseFilters();

  // Khởi tạo bộ lọc tài nguyên
  initResourceFilters();

  // Khởi tạo chức năng tìm kiếm
  initSearch();

  // Khởi tạo xử lý biểu mẫu cài đặt
  loadUserProfile();
  initSettingsForms();

  // xác thực form thay đổi password
  checkFormPasswordChange();
});

// Khởi tạo điều hướng tab
function initTabs() {
  const tabButtons = document.querySelectorAll(".profile-tabs .tab-btn");
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

// Khởi tạo bộ lọc khóa học
function initCourseFilters() {
  const filterButtons = document.querySelectorAll(
    ".courses-filter .filter-btn"
  );
  const courseCards = document.querySelectorAll(".course-card");

  // Thêm sự kiện click cho các nút lọc
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Loại bỏ lớp active từ tất cả các nút
      filterButtons.forEach((btn) => btn.classList.remove("active"));

      // Thêm lớp active cho nút được nhấp vào
      button.classList.add("active");

      // Lọc khóa học
      const filterValue = button.getAttribute("data-filter");

      courseCards.forEach((card) => {
        if (filterValue === "all") {
          card.style.display = "flex";
        } else {
          const cardStatus = card.getAttribute("data-status");
          card.style.display = cardStatus === filterValue ? "flex" : "none";
        }
      });
    });
  });
}

// Khởi tạo bộ lọc tài nguyên
function initResourceFilters() {
  const filterButtons = document.querySelectorAll(
    ".resources-filter .filter-btn"
  );
  const resourceItems = document.querySelectorAll(".resource-item");

  // Thêm sự kiện click cho các nút lọc
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Loại bỏ lớp active từ tất cả các nút
      filterButtons.forEach((btn) => btn.classList.remove("active"));

      // Thêm lớp active cho nút được nhấp vào
      button.classList.add("active");

      // Lọc tài nguyên
      const filterValue = button.getAttribute("data-filter");

      resourceItems.forEach((item) => {
        if (filterValue === "all") {
          item.style.display = "flex";
        } else {
          const itemType = item.getAttribute("data-type");
          item.style.display = itemType === filterValue ? "flex" : "none";
        }
      });
    });
  });
}

// Khởi tạo chức năng tìm kiếm
function initSearch() {
  // Tìm kiếm khóa học
  const courseSearchInput = document.getElementById("course-search");
  if (courseSearchInput) {
    courseSearchInput.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase().trim();
      const courseCards = document.querySelectorAll(".course-card");

      courseCards.forEach((card) => {
        const courseTitle = card.querySelector("h3").textContent.toLowerCase();
        const shouldShow = courseTitle.includes(searchTerm);
        card.style.display = shouldShow ? "flex" : "none";
      });
    });
  }

  // Tìm kiếm tài nguyên
  const resourceSearchInput = document.getElementById("resource-search");
  if (resourceSearchInput) {
    resourceSearchInput.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase().trim();
      const resourceItems = document.querySelectorAll(".resource-item");

      resourceItems.forEach((item) => {
        const resourceTitle = item
          .querySelector("h3")
          .textContent.toLowerCase();
        const resourceDesc = item.querySelector("p").textContent.toLowerCase();
        const shouldShow =
          resourceTitle.includes(searchTerm) ||
          resourceDesc.includes(searchTerm);
        item.style.display = shouldShow ? "flex" : "none";
      });
    });
  }
}

// Tải dữ liệu người dùng từ Realtime Database và hiển thị lên form
function loadUserProfile() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = ref(database, "users/" + user.uid);
      const snapshot = await get(userRef);
      let data = {};
      if (snapshot.exists()) {
        data = snapshot.val();
      }
      // Hiển thị lên form
      document.querySelector(".profile-username").textContent =
        data.username || user.displayName || "";
      document.querySelector(".profile-email").textContent =
        data.email || user.email || "";
      document.getElementById("full-name").value =
        data.username || user.displayName || "";
      document.getElementById("email").value = data.email || user.email || "";
      document.getElementById("username").value = data.username || "";
      document.getElementById("bio").value = data.bio || "";
      //  ảnh đại diện
      const avatarImg = document.querySelector(".profile-avatar img");
      avatarImg.src =
        data.avatar || user.photoURL || "assets/images/avatar-default.jpg";
    } else {
      window.location.href = "login.html";
    }
  });
}

// Khởi tạo xử lý biểu mẫu cài đặt
function initSettingsForms() {
  // Xử lý biểu mẫu thông tin cá nhân
  const personalInfoForm = document.querySelector(
    "#settings .settings-section:nth-child(1) form"
  );
  if (personalInfoForm) {
    personalInfoForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const displayName = document.getElementById("full-name").value.trim();
      const bio = document.getElementById("bio").value.trim();
      const username = document.getElementById("username").value.trim();
      const fileInput = document.getElementById("profile-picture");
      let avatarDefault = "assets/images/avatar-default.jpg";
      let avatar = null;

      // Hiển thị trạng thái đang xử lý
      const submitBtn = personalInfoForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...';

      try {
        // Nếu người dùng chọn ảnh mới
        if (fileInput && fileInput.files && fileInput.files[0]) {
          // Tạm thời dùng URL cho xem trước (load sẽ mất)
          avatar = URL.createObjectURL(fileInput.files[0]);
          const avatarImg = document.querySelector(".profile-avatar img");
          if (avatarImg) avatarImg.src = avatar;
        }

        const user = auth.currentUser;
        if (user) {
          // Cập nhật trên Firebase Auth (tên, ảnh)
          await updateProfile(user, {
            displayName: displayName,
            photoURL: avatar || user.photoURL || avatarDefault,
          });

          // Cập nhật trên Realtime Database (avatar, username, bio)
          const userRef = ref(database, "users/" + user.uid);
          await update(userRef, {
            username: username,
            bio: bio,
            avatar: avatar || user.photoURL || avatarDefault,
          });

          showNotification("Thông tin cá nhân đã được cập nhật thành công!");
        }
      } catch (err) {
        showNotification("Có lỗi khi cập nhật hồ sơ: " + err.message, "error");
      } finally {
        // Khôi phục nút submit
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Xử lý biểu mẫu thay đổi mật khẩu
  const passwordForm = document.querySelector(
    "#settings .settings-section:nth-child(2) form"
  );
  if (passwordForm) {
    passwordForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const currentPassword = document.getElementById("current-password").value;
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification("Vui lòng nhập đầy đủ thông tin!", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        showNotification("Mật khẩu xác nhận không khớp!", "error");
        return;
      }

      if (newPassword.length < 6) {
        showNotification("Mật khẩu mới phải có ít nhất 6 ký tự!", "error");
        return;
      }

      if (currentPassword === newPassword) {
        showNotification("Mật khẩu mới phải khác mật khẩu hiện tại!", "error");
        return;
      }

      // Hiển thị trạng thái đang xử lý
      const submitBtn = passwordForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...';

      try {
        const user = auth.currentUser;
        // Xác thực lại với mật khẩu hiện tại
        const credential = EmailAuthProvider.credential(
          user.email,
          currentPassword
        );
        await reauthenticateWithCredential(user, credential);

        // Cập nhật mật khẩu mới
        await updatePassword(user, newPassword);

        // Đặt lại giá trị trường
        document.getElementById("current-password").value = "";
        document.getElementById("new-password").value = "";
        document.getElementById("confirm-password").value = "";

        showNotification("Mật khẩu đã được cập nhật thành công!");
      } catch (error) {
        let errorMessage = "Có lỗi khi cập nhật mật khẩu: ";

        switch (error.code) {
          case "auth/wrong-password":
            errorMessage = "Mật khẩu hiện tại không đúng!";
            break;
          case "auth/weak-password":
            errorMessage = "Mật khẩu mới quá yếu!";
            break;
          case "auth/requires-recent-login":
            errorMessage =
              "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!";
            setTimeout(() => {
              window.location.href = "login.html";
            }, 2000);
            break;
          case "auth/too-many-requests":
            errorMessage = "Quá nhiều yêu cầu. Vui lòng thử lại sau!";
            break;
          default:
            errorMessage += error.message;
        }

        showNotification(errorMessage, "error");
        console.error("Password update error:", error);
      } finally {
        // Khôi phục nút submit
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Xử lý biểu mẫu tùy chọn thông báo
  const notificationForm = document.querySelector(
    "#settings .settings-section:nth-child(3) form"
  );
  if (notificationForm) {
    notificationForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Hiển thị thông báo
      showNotification("Tùy chọn thông báo đã được lưu!");
    });
  }

  // Xử lý form tạm ngừng
  handleSuspendAccount();
  // xử lý xóa tài khoản
  handleDeleteAccount();
}

// Kiểm tra và hiển thị form thay đổi mật khẩu chỉ cho user đăng nhập bằng email/password
function checkFormPasswordChange() {
  onAuthStateChanged(auth, (user) => {
    const passwordSection = document.querySelector(
      "#settings .settings-section:nth-child(2)"
    );

    if (user && passwordSection) {
      const providerData = user.providerData[0];
      if (providerData.providerId !== "password") {
        // Ẩn form khi đăng nhập bằng Google/GitHub
        passwordSection.style.display = "none";

        // Thêm thông báo
        const infoDiv = document.createElement("div");
        infoDiv.className = "settings-section";
        infoDiv.innerHTML = `
          <h3>Thay Đổi Mật Khẩu</h3>
          <div class="info-message">
            <i class="fas fa-info-circle"></i>
            <p>Tài khoản của bạn đăng nhập bằng ${
              providerData.providerId === "google.com" ? "Google" : "GitHub"
            }. 
            Để thay đổi mật khẩu, vui lòng truy cập trang cài đặt của ${
              providerData.providerId === "google.com" ? "Google" : "GitHub"
            }.</p>
          </div>
        `;
        passwordSection.parentNode.insertBefore(
          infoDiv,
          passwordSection.nextSibling
        );
      }
    }
  });
}

// Xử lý xóa tài khoản
function handleDeleteAccount() {
  const deleteBtn = document.getElementById("delete-account-btn");
  if (!deleteBtn) return;

  deleteBtn.addEventListener("click", function (e) {
    e.preventDefault();
    // Nếu đã có form xác nhận thì không thêm nữa
    if (document.querySelector(".danger-inline-confirm")) return;

    // Tạo form xác nhận inline
    const confirmDiv = document.createElement("div");
    confirmDiv.className = "danger-inline-confirm";
    confirmDiv.innerHTML = `
      <label>Nhập <b>XÓA TÀI KHOẢN</b> để xác nhận:</label>
      <input type="text" id="delete-confirm-text" placeholder="Nhập XÓA TÀI KHOẢN">
      <label>Nhập mật khẩu tài khoản:</label>
      <input type="password" id="delete-confirm-password" placeholder="Mật khẩu hiện tại">
      <div class="validation-message" id="delete-validation-message"></div>
      <div class="danger-actions">
        <button class="btn btn-danger" id="delete-confirm-btn" disabled>Xác Nhận Xóa</button>
        <button class="btn btn-outline" id="delete-cancel-btn">Hủy</button>
      </div>
    `;
    deleteBtn.parentNode.appendChild(confirmDiv);

    // Xử lý xác nhận
    const confirmText = confirmDiv.querySelector("#delete-confirm-text");
    const confirmPassword = confirmDiv.querySelector(
      "#delete-confirm-password"
    );
    const confirmBtn = confirmDiv.querySelector("#delete-confirm-btn");
    const cancelBtn = confirmDiv.querySelector("#delete-cancel-btn");
    const validationMsg = confirmDiv.querySelector(
      "#delete-validation-message"
    );

    function validate() {
      let valid = true;
      if (confirmText.value.trim().toUpperCase() !== "XÓA TÀI KHOẢN") {
        validationMsg.textContent = "Bạn phải nhập chính xác: XÓA TÀI KHOẢN";
        valid = false;
      } else if (confirmPassword.value.trim().length < 6) {
        validationMsg.textContent = "Mật khẩu phải từ 6 ký tự trở lên";
        valid = false;
      } else {
        validationMsg.textContent = "Xác nhận hợp lệ";
        validationMsg.className = "validation-message valid";
      }
      confirmBtn.disabled = !valid;
      if (!valid) validationMsg.className = "validation-message";
    }

    confirmText.addEventListener("input", validate);
    confirmPassword.addEventListener("input", validate);

    cancelBtn.addEventListener("click", function () {
      confirmDiv.remove();
    });

    confirmBtn.addEventListener("click", async function () {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang xóa...';
      try {
        // Xác thực lại và xóa tài khoản
        const user = auth.currentUser;
        if (!user) throw new Error("Bạn chưa đăng nhập!");
        const credential = EmailAuthProvider.credential(
          user.email,
          confirmPassword.value
        );
        await reauthenticateWithCredential(user, credential);

        // Xóa vĩnh viễn dữ liệu trong database
        const userRef = ref(database, "users/" + user.uid);
        await remove(userRef);

        // Xóa tài khoản Firebase Auth
        await deleteUser(user);

        localStorage.clear();
        showNotification(
          "Tài khoản đã được xóa vĩnh viễn. Tạm biệt!",
          "success"
        );
        setTimeout(() => (window.location.href = "index.html"), 2000);
      } catch (err) {
        console.error("Delete account error:", err);

        let errorMessage = "Có lỗi khi xóa tài khoản: ";

        switch (err.code) {
          case "auth/wrong-password":
            errorMessage = "Mật khẩu không đúng!";
            break;
          case "auth/requires-recent-login":
            errorMessage =
              "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!";
            setTimeout(() => (window.location.href = "login.html"), 2000);
            break;
          case "auth/too-many-requests":
            errorMessage = "Quá nhiều yêu cầu. Vui lòng thử lại sau!";
            break;
          case "auth/network-request-failed":
            errorMessage = "Lỗi kết nối mạng. Vui lòng kiểm tra internet!";
            break;
          default:
            errorMessage += err.message;
        }

        showNotification(errorMessage, "error");
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = "Xác Nhận Xóa";
      }
    });
  });
}
// Xử lý tạm ngừng tài khoản
function handleSuspendAccount() {
  const suspendBtn = document.getElementById("suspend-account-btn");
  if (!suspendBtn) return;

  suspendBtn.addEventListener("click", function (e) {
    e.preventDefault();
    // Nếu đã có form xác nhận thì không thêm nữa
    if (document.querySelector(".danger-inline-confirm")) return;

    // Tạo form xác nhận inline
    const confirmDiv = document.createElement("div");
    confirmDiv.className = "danger-inline-confirm";
    confirmDiv.innerHTML = `
      <label>Nhập <b>TẠM NGỪNG</b> để xác nhận:</label>
      <input type="text" id="suspend-confirm-text" placeholder="Nhập TẠM NGỪNG">
      <label>Nhập mật khẩu tài khoản:</label>
      <input type="password" id="suspend-confirm-password" placeholder="Mật khẩu hiện tại">
      <div class="validation-message" id="suspend-validation-message"></div>
      <div class="danger-actions">
        <button class="btn btn-warning" id="suspend-confirm-btn" disabled>Xác Nhận Tạm Ngừng</button>
        <button class="btn btn-outline" id="suspend-cancel-btn">Hủy</button>
      </div>
    `;
    suspendBtn.parentNode.appendChild(confirmDiv);

    // Xử lý xác nhận
    const confirmText = confirmDiv.querySelector("#suspend-confirm-text");
    const confirmPassword = confirmDiv.querySelector(
      "#suspend-confirm-password"
    );
    const confirmBtn = confirmDiv.querySelector("#suspend-confirm-btn");
    const cancelBtn = confirmDiv.querySelector("#suspend-cancel-btn");
    const validationMsg = confirmDiv.querySelector(
      "#suspend-validation-message"
    );

    function validate() {
      let valid = true;
      if (confirmText.value.trim().toUpperCase() !== "TẠM NGỪNG") {
        validationMsg.textContent = "Bạn phải nhập chính xác: TẠM NGỪNG";
        valid = false;
      } else if (confirmPassword.value.trim().length < 6) {
        validationMsg.textContent = "Mật khẩu phải từ 6 ký tự trở lên";
        valid = false;
      } else {
        validationMsg.textContent = "Xác nhận hợp lệ";
        validationMsg.className = "validation-message valid";
      }
      confirmBtn.disabled = !valid;
      if (!valid) validationMsg.className = "validation-message";
    }

    confirmText.addEventListener("input", validate);
    confirmPassword.addEventListener("input", validate);

    cancelBtn.addEventListener("click", function () {
      confirmDiv.remove();
    });

    confirmBtn.addEventListener("click", async function () {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang tạm ngừng...';

      try {
        const user = auth.currentUser;
        if (!user) throw new Error("Bạn chưa đăng nhập!");

        //  Xác thực lại người dùng
        const credential = EmailAuthProvider.credential(
          user.email,
          confirmPassword.value
        );
        await reauthenticateWithCredential(user, credential);

        // Cập nhật trạng thái tạm ngừng trong Database
        const userRef = ref(database, "users/" + user.uid);
        await update(userRef, {
          status: "suspended",
          suspendedAt: new Date().toISOString(),
          suspendedBy: user.uid,
          suspendedReason: "User requested suspension",
          // Giữ lại tất cả dữ liệu khác
        });

        showNotification(
          "Tài khoản đã được tạm ngừng. Email khôi phục sẽ được gửi.",
          "success"
        );

        // Đăng xuất sau 3 giây
        setTimeout(async () => {
          try {
            await signOut(auth);
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "login.html";
          } catch (signOutError) {
            console.error("Sign out error:", signOutError);
            // Vẫn chuyển hướng dù có lỗi đăng xuất
            window.location.href = "login.html";
          }
        }, 3000);
      } catch (err) {
        console.error("Lỗi tạm ngừng tài khoản:", err);

        let errorMessage = "Có lỗi khi tạm ngừng tài khoản: ";

        switch (err.code) {
          case "auth/wrong-password":
            errorMessage = "Mật khẩu không đúng!";
            break;
          case "auth/requires-recent-login":
            errorMessage =
              "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!";
            setTimeout(() => (window.location.href = "login.html"), 2000);
            break;
          case "auth/too-many-requests":
            errorMessage = "Quá nhiều yêu cầu. Vui lòng thử lại sau!";
            break;
          case "auth/network-request-failed":
            errorMessage = "Lỗi kết nối mạng. Vui lòng kiểm tra internet!";
            break;
          default:
            errorMessage += err.message;
        }

        showNotification(errorMessage, "error");
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = "Xác Nhận Tạm Ngừng";
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

// Xử lý xóa dấu trang
const removeBookmarkButtons = document.querySelectorAll(".remove-bookmark");
if (removeBookmarkButtons) {
  removeBookmarkButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const resourceItem = this.closest(".resource-item");
      if (
        resourceItem &&
        confirm("Bạn có chắc muốn xóa dấu trang này không?")
      ) {
        resourceItem.classList.add("fade-out");

        // Xóa phần tử sau khi hoàn thành hiệu ứng
        setTimeout(() => {
          resourceItem.remove();
        }, 300);
      }
    });
  });
}
