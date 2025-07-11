import { auth, database } from "../firebaseConfig.js";
import {
  ref,
  update,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

/**
 * Quản lý cài đặt cho Admin Panel
 */
export default class SettingsManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.currentUser = null;
    this.userDetails = null;
  }

  //   Khởi tạo các thành phần UI và sự kiện
  async init() {
    this.currentUser = auth.currentUser;
    if (!this.currentUser) return;

    // Tải thông tin chi tiết của admin từ database
    await this.loadUserDetails();

    // Thiết lập các sự kiện
    this.setupEventListeners();
  }

  //  Tải thông tin chi tiết của người dùng từ database
  async loadUserDetails() {
    try {
      const userRef = ref(database, `users/${this.currentUser.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        this.userDetails = snapshot.val();
      } else {
        // Nếu không có thông tin trong database, tạo mới từ thông tin auth
        this.userDetails = {
          username: this.currentUser.displayName || "Admin",
          email: this.currentUser.email,
          role: "1",
          avatar: this.currentUser.photoURL || "",
          createdAt: Date.now(),
        };

        // Lưu thông tin vào database
        await set(userRef, this.userDetails);
      }

      // tải thông tin tab profile
      document.getElementById("settings-avatar-preview").src =
        this.userDetails.avatar;
      document.getElementById("settings-username").value =
        this.userDetails.username;
      document.getElementById("settings-email").value = this.userDetails.email;

      // Cập nhật avatar và tên trên header
      this.updateHeaderInfo();
    } catch (error) {
      console.error("Error loading user details:", error);
      this.adminPanel.showNotification(
        "Không thể tải thông tin người dùng",
        "error"
      );
    }
  }

  //  Cập nhật avatar và tên trên header
  updateHeaderInfo() {
    const headerAvatar = document.getElementById("admin-avatar");
    const headerName = document.getElementById("admin-name");

    if (headerAvatar && this.userDetails.avatar) {
      headerAvatar.src = this.userDetails.avatar;
    }

    if (headerName) {
      headerName.textContent = this.userDetails.username || "Admin";
    }
  }

  //  Thiết lập các sự kiện cho phần cài đặt
  setupEventListeners() {
    // Chuyển tab cài đặt
    const tabButtons = document.querySelectorAll(".settings-tab-btn");
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tabName = button.dataset.tab;
        this.switchSettingsTab(tabName);
      });
    });

    // Xử lý form thông tin cá nhân
    const profileForm = document.getElementById("profile-settings-form");
    if (profileForm) {
      profileForm.addEventListener("submit", (e) =>
        this.handleProfileSubmit(e)
      );
    }

    // Xử lý form đổi mật khẩu
    const passwordForm = document.getElementById("password-settings-form");
    if (passwordForm) {
      passwordForm.addEventListener("submit", (e) =>
        this.handlePasswordSubmit(e)
      );
    }

    // Xử lý form tùy chọn ứng dụng
    const appSettingsForm = document.getElementById("app-settings-form");
    if (appSettingsForm) {
      appSettingsForm.addEventListener("submit", (e) =>
        this.handleAppSettingsSubmit(e)
      );

      // Lấy giá trị từ localStorage
      const autoRedirect = localStorage.getItem("adminAutoRedirect") === "true";
      document.getElementById("adminAutoRedirect").checked = autoRedirect;

      // Thêm sự kiện cho checkbox
      document
        .getElementById("adminAutoRedirect")
        .addEventListener("change", (e) => {
          localStorage.setItem("adminAutoRedirect", e.target.checked);
        });
    }

    // Xử lý upload avatar
    const avatarUpload = document.getElementById("avatar-upload");
    if (avatarUpload) {
      avatarUpload.addEventListener("change", (e) =>
        this.handleAvatarUpload(e)
      );
    }
  }

  /**
   * Chuyển đổi giữa các tab cài đặt
   * @param tabName Tên tab cần hiển thị
   */
  switchSettingsTab(tabName) {
    // Xóa active class khỏi tất cả các tab
    document.querySelectorAll(".settings-tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    document.querySelectorAll(".settings-tab-pane").forEach((pane) => {
      pane.classList.remove("active");
    });

    // Thêm active class cho tab được chọn
    document
      .querySelector(`.settings-tab-btn[data-tab="${tabName}"]`)
      .classList.add("active");

    // Hiển thị pane tương ứng
    const targetPane = document.getElementById(`${tabName}-settings`);
    if (targetPane) {
      targetPane.classList.add("active");
    }
  }

  // Xử lý upload avatar, event là sự kiện change file
  handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Kiểm tra kích thước file (tối đa 2MB)
    if (file.size > 2 * 1024 * 1024) {
      this.adminPanel.showNotification(
        "Kích thước file quá lớn (tối đa 2MB)",
        "error"
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Image = e.target.result;

      // Hiển thị avatar mới trong preview
      const avatarPreview = document.getElementById("settings-avatar-preview");
      if (avatarPreview) {
        avatarPreview.src = base64Image;
      }

      // Lưu base64 vào biến để sử dụng khi submit
      this.newAvatarBase64 = base64Image;
    };

    reader.readAsDataURL(file);
  }

  /**
   * Xử lý submit form thông tin cá nhân
   * @param event Sự kiện submit của form
   */
  async handleProfileSubmit(event) {
    event.preventDefault();

    const username = document.getElementById("settings-username").value.trim();

    if (!username) {
      this.adminPanel.showNotification("Vui lòng nhập tên hiển thị", "error");
      return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    try {
      // Hiển thị trạng thái loading
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

      // Cập nhật thông tin trong database
      const userRef = ref(database, `users/${this.currentUser.uid}`);
      const updateData = {
        username: username,
      };

      // Nếu có avatar mới, thêm vào dữ liệu cập nhật
      if (this.newAvatarBase64) {
        updateData.avatar = this.newAvatarBase64;
      }

      await update(userRef, updateData);

      // Cập nhật trong Auth (chỉ displayName, không cập nhật photoURL vì dễ bị lỗi khi base64 quá dài)
      await updateProfile(this.currentUser, {
        displayName: username,
      });

      // Đồng bộ lại với localStorage
      let localStoreDataUser = localStorage.getItem("codemaster_user");
      let userData = {};
      if (localStoreDataUser) {
        userData = JSON.parse(localStoreDataUser);
      }
      userData.displayName = username;
      localStorage.setItem("codemaster_user", JSON.stringify(userData));

      // Cập nhật biến local
      this.userDetails = {
        ...this.userDetails,
        username: username,
      };
      if (this.newAvatarBase64) {
        this.userDetails.avatar = this.newAvatarBase64;
      }

      // Cập nhật UI header
      this.updateHeaderInfo();

      // Reset biến avatar
      this.newAvatarBase64 = null;

      this.adminPanel.showNotification(
        "Cập nhật thông tin thành công",
        "success"
      );
    } catch (error) {
      console.error("Error updating profile:", error);
      this.adminPanel.showNotification("Không thể cập nhật thông tin", "error");
    } finally {
      // Khôi phục nút submit
      const submitBtn = event.target.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }

  // Xử lý submit form đổi mật khẩu
  async handlePasswordSubmit(event) {
    event.preventDefault();

    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    // Kiểm tra các trường dữ liệu
    if (!currentPassword || !newPassword || !confirmPassword) {
      this.adminPanel.showNotification(
        "Vui lòng điền đầy đủ thông tin",
        "error"
      );
      return;
    }

    if (newPassword.length < 6) {
      this.adminPanel.showNotification(
        "Mật khẩu mới phải có ít nhất 6 ký tự",
        "error"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      this.adminPanel.showNotification("Mật khẩu xác nhận không khớp", "error");
      return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    try {
      // Hiển thị trạng thái loading
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

      // Xác thực lại người dùng trước khi đổi mật khẩu
      const credential = EmailAuthProvider.credential(
        this.currentUser.email,
        currentPassword
      );

      await reauthenticateWithCredential(this.currentUser, credential);

      // Đổi mật khẩu
      await updatePassword(this.currentUser, newPassword);

      // Reset form
      event.target.reset();

      this.adminPanel.showNotification("Đổi mật khẩu thành công", "success");
    } catch (error) {
      console.error("Error changing password:", error);

      // Hiển thị thông báo lỗi phù hợp
      if (error.code === "auth/wrong-password") {
        this.adminPanel.showNotification(
          "Mật khẩu hiện tại không đúng",
          "error"
        );
      } else {
        this.adminPanel.showNotification(
          "Không thể đổi mật khẩu. Vui lòng thử lại sau.",
          "error"
        );
      }
    } finally {
      // Khôi phục nút submit
      const submitBtn = event.target.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
  // Xử lý submit form tùy chọn ứng dụng
  async handleAppSettingsSubmit(event) {
    event.preventDefault();

    const autoRedirect = document.getElementById("adminAutoRedirect").checked;
    const notificationSetting = document.getElementById(
      "notification-setting"
    ).value;

    try {
      // Lưu cài đặt vào localStorage
      localStorage.setItem("adminAutoRedirect", autoRedirect);
      localStorage.setItem("notificationSetting", notificationSetting);

      // Lưu cài đặt vào database (để đồng bộ giữa các thiết bị)
      const settingsRef = ref(database, `settings/${this.currentUser.uid}`);
      await update(settingsRef, {
        username: this.userDetails.username,
        role: this.userDetails.role,
        autoRedirect: autoRedirect,
        notificationSetting: notificationSetting,
        updatedAt: Date.now(),
      });

      this.adminPanel.showNotification("Đã lưu cài đặt", "success");
    } catch (error) {
      console.error("Error saving settings:", error);
      this.adminPanel.showNotification("Không thể lưu cài đặt", "error");
    }
  }
}
