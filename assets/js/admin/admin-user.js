import { database, auth, firebaseConfig } from "../firebaseConfig.js";
import {
  ref,
  get,
  set,
  update,
  remove,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";

export default class UsersManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.users = [];
  }

  async loadData() {
    // Hiển thị trạng thái đang tải
    const tbody = document.getElementById("users-table-body");
    if (tbody) {
      tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">
          <div class="loading-courses">
            <span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span>
            <span>Đang tải danh sách người dùng...</span>
          </div>
        </td>
      </tr>
    `;
    }
    try {
      const usersRef = ref(database, "users");
      const snapshot = await get(usersRef);

      if (snapshot.exists()) {
        this.users = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
      } else {
        this.users = [];
      }

      this.renderTable();
      this.setupFilters();
    } catch (error) {
      console.error("Error loading users:", error);
      this.adminPanel.showNotification("Lỗi tải dữ liệu người dùng", "error");
    }
  }

  renderTable(filteredUsers = null) {
    const tbody = document.getElementById("users-table-body");
    const users = filteredUsers || this.users;

    if (!tbody) return;

    tbody.innerHTML = "";

    users.forEach((user) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <img src="${user.avatar || "./assets/images/avatar-default.jpg"}" 
               alt="${user.username}" class="user-avatar">
        </td>
        <td>${user.username || user.email}</td>
        <td>${user.email}</td>
        <td>
          <span class="role-badge ${
            user.role === 1 ? "role-admin" : "role-user"
          }">
            ${user.role === 1 ? "Admin" : "Người dùng"}
          </span>
        </td>
        <td>
          <span class="status-badge ${
            user.status === "suspended" ? "status-suspended" : "status-active"
          }">
            ${user.status === "suspended" ? "Tạm ngừng" : "Hoạt động"}
          </span>
        </td>
        <td>${user.createAt || "N/A"}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-action btn-edit" onclick="adminPanel.users.editUser('${
              user.id
            }')" title="Chỉnh sửa">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action btn-suspend" onclick="adminPanel.users.toggleUserStatus('${
              user.id
            }')" title="Tạm ngừng/Kích hoạt">
              <i class="fas fa-${
                user.status === "suspended" ? "play" : "pause"
              }"></i>
            </button>
            <button class="btn-action btn-delete" onclick="adminPanel.users.deleteUser('${
              user.id
            }')" title="Xóa">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  setupFilters() {
    const searchInput = document.getElementById("user-search");
    const roleFilter = document.getElementById("user-role-filter");
    const statusFilter = document.getElementById("user-status-filter");

    if (!searchInput || !roleFilter || !statusFilter) return;

    const applyFilters = () => {
      let filteredUsers = [...this.users];

      // Lọc theo từ khóa tìm kiếm
      const searchTerm = searchInput.value.toLowerCase();
      if (searchTerm) {
        filteredUsers = filteredUsers.filter(
          (user) =>
            (user.username &&
              user.username.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm))
        );
      }

      // Lọc theo vai trò
      const roleValue = roleFilter.value;
      if (roleValue) {
        filteredUsers = filteredUsers.filter((user) => user.role == roleValue);
      }

      // Lọc theo trạng thái
      const statusValue = statusFilter.value;
      if (statusValue) {
        filteredUsers = filteredUsers.filter(
          (user) => (user.status || "active") === statusValue
        );
      }

      this.renderTable(filteredUsers);
    };

    searchInput.addEventListener("input", applyFilters);
    roleFilter.addEventListener("change", applyFilters);
    statusFilter.addEventListener("change", applyFilters);
  }

  async editUser(userId) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return;

    // Đổ dữ liệu user vào modal
    document.getElementById("user-id").value = userId;
    const nameInput = document.getElementById("user-name");
    nameInput.value = user.username || "";
    nameInput.setAttribute("disabled", "disabled");
    const emailInput = document.getElementById("user-email");
    emailInput.value = user.email || "";
    emailInput.setAttribute("disabled", "disabled");
    document.getElementById("user-role").value = user.role || "2";
    document.getElementById("user-status").value = user.status || "active";

    // Cập nhật tiêu đề modal
    document.getElementById("user-modal-title").textContent =
      "Chỉnh sửa người dùng";
    // Ẩn form password
    document.getElementById("user-password-group").style.display = "none";
    document.getElementById("user-password").removeAttribute("required");

    // Hiện modal
    this.adminPanel.showModal("user-modal");
  }

  async toggleUserStatus(userId) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return;

    const newStatus = user.status === "suspended" ? "active" : "suspended";

    try {
      const userRef = ref(database, `users/${userId}`);
      await update(userRef, { status: newStatus });

      // Ghi log hoạt động
      await this.adminPanel.logActivity(
        "user",
        `${newStatus === "suspended" ? "Tạm ngừng" : "Kích hoạt"} tài khoản`,
        `${newStatus === "suspended" ? "Tạm ngừng" : "Kích hoạt"} tài khoản ${
          user.username || user.email
        }`,
        `fas fa-${newStatus === "suspended" ? "pause" : "play"}`
      );

      this.adminPanel.showNotification(
        `Đã ${newStatus === "suspended" ? "tạm ngừng" : "kích hoạt"} tài khoản`,
        "success"
      );
      this.loadData();
    } catch (error) {
      console.error("Error updating user status:", error);
      this.adminPanel.showNotification(
        "Lỗi cập nhật trạng thái người dùng",
        "error"
      );
    }
  }

  async deleteUser(userId) {
    if (!confirm("Bạn có chắc chắn muốn xóa người dùng này?")) return;

    const user = this.users.find((u) => u.id === userId);

    try {
      // Xóa user trong bảng users
      await remove(ref(database, `users/${userId}`));
      // Xóa bookmarks của user
      await remove(ref(database, `bookmarks/${userId}`));
      // Xóa tiến trình học của user
      await remove(ref(database, `userProgress/${userId}`));

      // Ghi log hoạt động
      await this.adminPanel.logActivity(
        "user",
        "Xóa người dùng",
        `Đã xóa tài khoản ${user?.username || user?.email || userId}`,
        "fas fa-trash"
      );

      this.adminPanel.showNotification("Đã xóa người dùng", "success");
      this.loadData();
    } catch (error) {
      console.error("Error deleting user:", error);
      this.adminPanel.showNotification("Lỗi xóa người dùng", "error");
    }
  }

  showAddModal() {
    // Xóa dữ liệu form
    document.getElementById("user-form").reset();
    document.getElementById("user-id").value = "";
    document.getElementById("user-modal-title").textContent = "Thêm người dùng";
    document.getElementById("user-password-group").style.display = "block";
    document.getElementById("user-password").setAttribute("required", "");
    // Bỏ disable cho email và name khi thêm mới
    document.getElementById("user-email").removeAttribute("disabled");
    document.getElementById("user-name").removeAttribute("disabled");

    this.adminPanel.showModal("user-modal");
  }

  async handleFormSubmit(e) {
    e.preventDefault();

    const userId = document.getElementById("user-id").value;
    const username = document.getElementById("user-name").value.trim();
    const email = document.getElementById("user-email").value.trim();
    const role = parseInt(document.getElementById("user-role").value);
    const status = document.getElementById("user-status").value;
    const password = document.getElementById("user-password")?.value;

    // Validate dữ liệu trước khi thêm db
    const { valid, message } = await this.validateUserData({
      username,
      email,
      password,
      role,
      isNewUser: !userId,
    });
    if (!valid) {
      this.adminPanel.showNotification(message, "error");
      return;
    }

    try {
      if (userId) {
        // Cập nhật user đã có
        const userRef = ref(database, `users/${userId}`);
        await update(userRef, { username, role, status });

        // Ghi log hoạt động
        await this.adminPanel.logActivity(
          "user",
          "Cập nhật người dùng",
          `Đã cập nhật thông tin người dùng ${username}`,
          "fas fa-edit"
        );

        this.adminPanel.showNotification(
          "Cập nhật người dùng thành công",
          "success"
        );
      } else {
        // Thêm mới user
        // Khởi tạo firebase app phụ cho xác thực tạo user mới
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        // Tạo user trên firebase auth
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );
        const newUser = userCredential.user;
        // Lưu thông tin vào database
        const userData = {
          id: newUser.uid,
          username,
          email,
          role,
          status,
          avatar: "/assets/images/avatar-default.jpg",
          bio: "",
          createAt: new Date().toISOString().slice(0, 10),
        };
        await set(ref(database, `users/${newUser.uid}`), userData);

        // Ghi lại hoạt động
        await this.adminPanel.logActivity(
          "user",
          "Thêm người dùng",
          `Đã thêm người dùng mới ${username}`,
          "fas fa-user-plus"
        );

        this.adminPanel.showNotification("Thêm user thành công", "success");
        // Đăng xuất app phụ
        await secondaryAuth.signOut();
      }

      this.adminPanel.hideModal("user-modal");
      this.loadData();
    } catch (err) {
      if (err && err.code === "auth/email-already-in-use") {
        this.adminPanel.showNotification(
          "Email đã tồn tại trên hệ thống!",
          "error"
        );
      } else {
        console.error("Error saving user:", err);
        this.adminPanel.showNotification(
          "Lỗi lưu thông tin người dùng",
          "error"
        );
      }
      return;
    }
  }

  setupEventListeners() {
    // Thêm event listener cho form submit
    const userForm = document.getElementById("user-form");
    if (userForm) {
      userForm.addEventListener("submit", this.handleFormSubmit.bind(this));
    }

    // Nút thêm người dùng
    const addUserBtn = document.getElementById("add-user-btn");
    if (addUserBtn) {
      addUserBtn.addEventListener("click", this.showAddModal.bind(this));
    }
  }

  // Hàm validate dữ liệu user
  async validateUserData({ username, email, password, role, isNewUser }) {
    // Validate email định dạng
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return { valid: false, message: "Email không hợp lệ!" };
    }
    // Validate username không để trống, độ dài 3-32 ký tự
    if (!username || username.length < 3 || username.length > 32) {
      return { valid: false, message: "Tên người dùng phải từ 3-32 ký tự!" };
    }
    // Validate role chỉ nhận 1 hoặc 2
    if (![1, 2].includes(role)) {
      return { valid: false, message: "Vai trò không hợp lệ!" };
    }
    // Nếu thêm mới user thì validate password
    if (isNewUser) {
      const pw = password || "";
      const pwValid =
        pw.length >= 6 &&
        /[A-Z]/.test(pw) &&
        /[0-9]/.test(pw) &&
        /[^A-Za-z0-9]/.test(pw);
      if (!pwValid) {
        return {
          valid: false,
          message:
            "Mật khẩu tối thiểu 6 ký tự, có chữ hoa, số và ký tự đặc biệt!",
        };
      }
      // Kiểm tra trùng lặp email/username trong database
      const usersRef = ref(database, "users");
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const users = Object.values(snapshot.val());
        const emailExists = users.some(
          (u) => u.email && u.email.toLowerCase() === email.toLowerCase()
        );
        if (emailExists) {
          return { valid: false, message: "Email đã tồn tại!" };
        }
        const usernameExists = users.some(
          (u) =>
            u.username && u.username.toLowerCase() === username.toLowerCase()
        );
        if (usernameExists) {
          return { valid: false, message: "Tên người dùng đã tồn tại!" };
        }
      }
    }
    return { valid: true };
  }
}
