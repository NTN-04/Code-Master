import { auth, database } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import AdminGuard from "./admin-guard.js";

// Admin Panel Main Controller
class AdminPanel {
  constructor() {
    this.currentUser = null;
    this.users = [];
    this.courses = [];
    this.resources = [];
    this.activities = [];

    this.init();
  }

  async init() {
    // Initialize components
    this.initNavigation();
    this.initModals();
    this.initNotifications();

    // Load initial data
    await this.loadDashboardData();

    // Setup event listeners
    this.setupEventListeners();
  }

  // Navigation
  initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const sectionName = item.querySelector("a").dataset.section;
        this.showSection(sectionName);

        // Update active nav item
        navItems.forEach((nav) => nav.classList.remove("active"));
        item.classList.add("active");
      });
    });
  }

  showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll(".admin-section");
    sections.forEach((section) => section.classList.remove("active"));

    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
      targetSection.classList.add("active");

      // Load section-specific data
      switch (sectionName) {
        case "dashboard":
          this.loadDashboardData();
          break;
        case "users":
          this.loadUsersData();
          break;
        case "courses":
          this.loadCoursesData();
          break;
        case "resources":
          this.loadResourcesData();
          break;
        case "analytics":
          this.loadAnalyticsData();
          break;
      }
    }
  }

  // Dashboard
  async loadDashboardData() {
    try {
      // Load statistics
      await this.loadStatistics();

      // Load recent activities
      await this.loadRecentActivities();
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      this.showNotification("Lỗi tải dữ liệu dashboard", "error");
    }
  }
  async loadStatistics() {
    try {
      // Get users count from Firebase
      const usersRef = ref(database, "users");
      const usersSnapshot = await get(usersRef);
      const usersCount = usersSnapshot.exists()
        ? Object.keys(usersSnapshot.val()).length
        : 0;

      // Get courses count from Firebase
      const coursesRef = ref(database, "courses");
      const coursesSnapshot = await get(coursesRef);
      const coursesCount = coursesSnapshot.exists()
        ? Object.keys(coursesSnapshot.val()).length
        : 0;

      // Get resources count from Firebase
      const resourcesRef = ref(database, "resources");
      const resourcesSnapshot = await get(resourcesRef);
      const resourcesCount = resourcesSnapshot.exists()
        ? Object.keys(resourcesSnapshot.val()).length
        : 0;

      // Calculate active learners (users with progress > 0)
      let activeLearners = 0;
      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();
        Object.values(users).forEach((user) => {
          if (user.courses && Object.keys(user.courses).length > 0) {
            activeLearners++;
          }
        });
      }

      // Update UI
      document.getElementById("total-users").textContent = usersCount;
      document.getElementById("total-courses").textContent = coursesCount;
      document.getElementById("active-learners").textContent = activeLearners;
      document.getElementById("total-resources").textContent = resourcesCount;
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  }
  async loadRecentActivities() {
    const activitiesContainer = document.getElementById("recent-activities");
    if (!activitiesContainer) return;

    // Show loading state
    activitiesContainer.innerHTML = `
      <div class="activity-item loading">
        <i class="fas fa-spinner fa-spin"></i>
        <div class="activity-content">
          <p>Đang tải hoạt động gần đây...</p>
        </div>
      </div>
    `;

    try {
      // Load recent activities from Firebase
      const activitiesRef = ref(database, "activities");
      const snapshot = await get(activitiesRef);

      activitiesContainer.innerHTML = "";

      if (snapshot.exists()) {
        const activities = Object.entries(snapshot.val())
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 10); // Get latest 10 activities

        if (activities.length > 0) {
          activities.forEach((activity) => {
            const activityElement = this.createActivityElement(activity);
            activitiesContainer.appendChild(activityElement);
          });
        } else {
          activitiesContainer.innerHTML = `
            <div class="no-activities">
              <i class="fas fa-history"></i>
              <p>Chưa có hoạt động nào gần đây</p>
            </div>
          `;
        }
      } else {
        activitiesContainer.innerHTML = `
          <div class="no-activities">
            <i class="fas fa-history"></i>
            <p>Chưa có hoạt động nào trong hệ thống</p>
          </div>
        `;
      }
    } catch (error) {
      console.error("Error loading activities:", error);
      activitiesContainer.innerHTML = `
        <div class="activity-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Không thể tải hoạt động. Vui lòng thử lại sau.</p>
        </div>
      `;
    }
  }

  createActivityElement(activity) {
    const div = document.createElement("div");
    div.className = `activity-item activity-${activity.type}`;

    // Format time from timestamp if available
    const timeText = activity.timestamp
      ? this.formatTimeAgo(activity.timestamp)
      : activity.time || "N/A";

    div.innerHTML = `
      <div class="activity-icon">
        <i class="${activity.icon}"></i>
      </div>
      <div class="activity-content">
        <h4>${activity.title}</h4>
        <p>${activity.description}</p>
      </div>
      <div class="activity-time">${timeText}</div>
    `;

    return div;
  }

  formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return "Vừa xong";
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} giờ trước`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} ngày trước`;

    return time.toLocaleDateString("vi-VN");
  }

  // Users Management
  async loadUsersData() {
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

      this.renderUsersTable();
      this.setupUsersFilters();
    } catch (error) {
      console.error("Error loading users:", error);
      this.showNotification("Lỗi tải dữ liệu người dùng", "error");
    }
  }

  renderUsersTable(filteredUsers = null) {
    const tbody = document.getElementById("users-table-body");
    const users = filteredUsers || this.users;

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
            <button class="btn-action btn-edit" onclick="adminPanel.editUser('${
              user.id
            }')" title="Chỉnh sửa">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action btn-suspend" onclick="adminPanel.toggleUserStatus('${
              user.id
            }')" title="Tạm ngừng/Kích hoạt">
              <i class="fas fa-${
                user.status === "suspended" ? "play" : "pause"
              }"></i>
            </button>
            <button class="btn-action btn-delete" onclick="adminPanel.deleteUser('${
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

  setupUsersFilters() {
    const searchInput = document.getElementById("user-search");
    const roleFilter = document.getElementById("user-role-filter");
    const statusFilter = document.getElementById("user-status-filter");

    const applyFilters = () => {
      let filteredUsers = [...this.users];

      // Search filter
      const searchTerm = searchInput.value.toLowerCase();
      if (searchTerm) {
        filteredUsers = filteredUsers.filter(
          (user) =>
            (user.username &&
              user.username.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm))
        );
      }

      // Role filter
      const roleValue = roleFilter.value;
      if (roleValue) {
        filteredUsers = filteredUsers.filter((user) => user.role == roleValue);
      }

      // Status filter
      const statusValue = statusFilter.value;
      if (statusValue) {
        filteredUsers = filteredUsers.filter(
          (user) => (user.status || "active") === statusValue
        );
      }

      this.renderUsersTable(filteredUsers);
    };

    searchInput.addEventListener("input", applyFilters);
    roleFilter.addEventListener("change", applyFilters);
    statusFilter.addEventListener("change", applyFilters);
  }

  async editUser(userId) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return;

    // Fill modal with user data
    document.getElementById("user-id").value = userId;
    document.getElementById("user-name").value = user.username || "";
    document.getElementById("user-email").value = user.email || "";
    document.getElementById("user-role").value = user.role || "2";
    document.getElementById("user-status").value = user.status || "active";

    // Update modal title
    document.getElementById("user-modal-title").textContent =
      "Chỉnh sửa người dùng";

    // Show modal
    this.showModal("user-modal");
  }
  async toggleUserStatus(userId) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return;

    const newStatus = user.status === "suspended" ? "active" : "suspended";

    try {
      const userRef = ref(database, `users/${userId}`);
      await update(userRef, { status: newStatus });

      // Log activity
      await this.logActivity(
        "user",
        `${newStatus === "suspended" ? "Tạm ngừng" : "Kích hoạt"} tài khoản`,
        `${newStatus === "suspended" ? "Tạm ngừng" : "Kích hoạt"} tài khoản ${
          user.username || user.email
        }`,
        `fas fa-${newStatus === "suspended" ? "pause" : "play"}`
      );

      this.showNotification(
        `Đã ${newStatus === "suspended" ? "tạm ngừng" : "kích hoạt"} tài khoản`,
        "success"
      );
      this.loadUsersData();
    } catch (error) {
      console.error("Error updating user status:", error);
      this.showNotification("Lỗi cập nhật trạng thái người dùng", "error");
    }
  }

  async deleteUser(userId) {
    if (!confirm("Bạn có chắc chắn muốn xóa người dùng này?")) return;

    const user = this.users.find((u) => u.id === userId);

    try {
      const userRef = ref(database, `users/${userId}`);
      await remove(userRef);

      // Log activity
      await this.logActivity(
        "user",
        "Xóa người dùng",
        `Đã xóa tài khoản ${user?.username || user?.email || userId}`,
        "fas fa-trash"
      );

      this.showNotification("Đã xóa người dùng", "success");
      this.loadUsersData();
    } catch (error) {
      console.error("Error deleting user:", error);
      this.showNotification("Lỗi xóa người dùng", "error");
    }
  }
  // Courses Management
  async loadCoursesData() {
    try {
      // Try to load from Firebase first
      const coursesRef = ref(database, "courses");
      const snapshot = await get(coursesRef);

      if (snapshot.exists()) {
        // Load from Firebase
        this.courses = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
      } else {
        // Fallback to JSON file and import to Firebase
        await this.importCoursesToFirebase();
      }

      this.renderCoursesGrid();
    } catch (error) {
      console.error("Error loading courses:", error);
      this.showNotification("Lỗi tải dữ liệu khóa học", "error");
    }
  }

  async importCoursesToFirebase() {
    try {
      const response = await fetch("./data/db_courses.json");
      const data = await response.json();
      const courses = data.courses || [];

      // Import courses to Firebase
      const coursesRef = ref(database, "courses");
      const coursesData = {};

      courses.forEach((course) => {
        coursesData[course.id] = {
          title: course.title,
          description: course.description,
          level: course.level,
          category: course.category,
          duration: course.duration,
          lessons: course.lessons,
          progress: course.progress || 0,
          image: course.image,
          tag: course.tag,
          url: course.url,
          createdAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
          status: "active",
        };
      });

      await set(coursesRef, coursesData);
      this.courses = courses;

      this.showNotification("Đã import khóa học vào Firebase", "success");
    } catch (error) {
      console.error("Error importing courses:", error);
      this.showNotification("Lỗi import khóa học", "error");
    }
  }

  renderCoursesGrid() {
    const grid = document.getElementById("admin-courses-grid");
    grid.innerHTML = "";

    this.courses.forEach((course) => {
      const courseCard = this.createCourseCard(course);
      grid.appendChild(courseCard);
    });
  }

  createCourseCard(course) {
    const div = document.createElement("div");
    div.className = "admin-course-card";

    div.innerHTML = `
      <div class="course-card-image">
        <img src="${course.image}" alt="${
      course.title
    }" onerror="this.src='./assets/images/img-course/html-css.png'">
      </div>
      <div class="course-card-content">
        <h3 class="course-card-title">${course.title}</h3>
        <div class="course-card-meta">
          <span><i class="fas fa-signal"></i> ${this.getLevelText(
            course.level
          )}</span>
          <span><i class="fas fa-clock"></i> ${course.duration}</span>
          <span><i class="fas fa-book"></i> ${course.lessons} bài</span>
        </div>
        <p class="course-card-description">${course.description}</p>
        <div class="course-card-actions">
          <div class="action-buttons">
            <button class="btn-action btn-edit" onclick="adminPanel.editCourse('${
              course.id
            }')" title="Chỉnh sửa">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action btn-delete" onclick="adminPanel.deleteCourse('${
              course.id
            }')" title="Xóa">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    return div;
  }

  getLevelText(level) {
    const levels = {
      beginner: "Người mới",
      intermediate: "Trung cấp",
      advanced: "Nâng cao",
    };
    return levels[level] || level;
  }
  async editCourse(courseId) {
    const course = this.courses.find((c) => c.id === courseId);
    if (!course) return;

    // Fill modal with course data
    document.getElementById("course-id").value = courseId;
    document.getElementById("course-title").value = course.title || "";
    document.getElementById("course-description").value =
      course.description || "";
    document.getElementById("course-level").value = course.level || "beginner";
    document.getElementById("course-duration").value = course.duration || "";
    document.getElementById("course-lessons").value = course.lessons || "";
    document.getElementById("course-category").value = course.category || "web";
    document.getElementById("course-image").value = course.image || "";

    // Update modal title
    document.getElementById("course-modal-title").textContent =
      "Chỉnh sửa khóa học";

    // Show modal
    this.showModal("course-modal");
  }
  async deleteCourse(courseId) {
    if (!confirm("Bạn có chắc chắn muốn xóa khóa học này?")) return;

    const course = this.courses.find((c) => c.id === courseId);

    try {
      const courseRef = ref(database, `courses/${courseId}`);
      await remove(courseRef);

      // Log activity
      await this.logActivity(
        "course",
        "Xóa khóa học",
        `Đã xóa khóa học "${course?.title || courseId}"`,
        "fas fa-trash"
      );

      this.showNotification("Đã xóa khóa học", "success");
      this.loadCoursesData();
    } catch (error) {
      console.error("Error deleting course:", error);
      this.showNotification("Lỗi xóa khóa học", "error");
    }
  }
  // Resources Management
  async loadResourcesData() {
    try {
      // Try to load from Firebase first
      const resourcesRef = ref(database, "resources");
      const snapshot = await get(resourcesRef);

      if (snapshot.exists()) {
        // Load from Firebase
        this.resources = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
      } else {
        // Fallback to JSON file and import to Firebase
        await this.importResourcesToFirebase();
      }

      this.renderResourcesTable();
    } catch (error) {
      console.error("Error loading resources:", error);
      this.showNotification("Lỗi tải dữ liệu tài liệu", "error");
    }
  }

  async importResourcesToFirebase() {
    try {
      const response = await fetch("./data/db_resources.json");
      const data = await response.json();
      const resources = data.resources || [];

      // Import resources to Firebase
      const resourcesRef = ref(database, "resources");
      const resourcesData = {};

      resources.forEach((resource) => {
        resourcesData[resource.id] = {
          title: resource.title,
          type: resource.type,
          level: resource.level,
          url: resource.url,
          description: resource.description || "",
          createdAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
          status: "active",
        };
      });

      await set(resourcesRef, resourcesData);
      this.resources = resources;

      this.showNotification("Đã import tài liệu vào Firebase", "success");
    } catch (error) {
      console.error("Error importing resources:", error);
      this.showNotification("Lỗi import tài liệu", "error");
    }
  }

  renderResourcesTable() {
    const tbody = document.getElementById("resources-table-body");
    tbody.innerHTML = "";

    this.resources.forEach((resource) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${resource.title}</td>
        <td>${resource.type}</td>
        <td>${this.getLevelText(resource.level)}</td>
        <td>${resource.createdAt || "N/A"}</td>
        <td>
          <span class="status-badge status-active">Hoạt động</span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-action btn-edit" onclick="adminPanel.editResource('${
              resource.id
            }')" title="Chỉnh sửa">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action btn-delete" onclick="adminPanel.deleteResource('${
              resource.id
            }')" title="Xóa">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  async editResource(resourceId) {
    const resource = this.resources.find((r) => r.id === resourceId);
    if (!resource) return;

    // For now, show a simple prompt to edit
    const newTitle = prompt("Nhập tiêu đề mới:", resource.title);
    if (newTitle && newTitle !== resource.title) {
      try {
        const resourceRef = ref(database, `resources/${resourceId}`);
        await update(resourceRef, {
          title: newTitle,
          updatedAt: new Date().toISOString().slice(0, 10),
        });

        // Log activity
        await this.logActivity(
          "resource",
          "Cập nhật tài liệu",
          `Đã cập nhật tài liệu "${newTitle}"`,
          "fas fa-edit"
        );

        this.showNotification("Đã cập nhật tài liệu", "success");
        this.loadResourcesData();
      } catch (error) {
        console.error("Error updating resource:", error);
        this.showNotification("Lỗi cập nhật tài liệu", "error");
      }
    }
  }

  async deleteResource(resourceId) {
    if (!confirm("Bạn có chắc chắn muốn xóa tài liệu này?")) return;

    const resource = this.resources.find((r) => r.id === resourceId);

    try {
      const resourceRef = ref(database, `resources/${resourceId}`);
      await remove(resourceRef);

      // Log activity
      await this.logActivity(
        "resource",
        "Xóa tài liệu",
        `Đã xóa tài liệu "${resource?.title || resourceId}"`,
        "fas fa-trash"
      );

      this.showNotification("Đã xóa tài liệu", "success");
      this.loadResourcesData();
    } catch (error) {
      console.error("Error deleting resource:", error);
      this.showNotification("Lỗi xóa tài liệu", "error");
    }
  }

  // Analytics
  loadAnalyticsData() {
    // Mock analytics data
    this.showNotification("Chức năng thống kê đang được phát triển", "warning");
  }

  // Activity logging
  async logActivity(type, title, description, icon = null) {
    try {
      const activitiesRef = ref(database, "activities");
      const activityId = `activity_${Date.now()}`;
      const activityData = {
        type,
        title,
        description,
        timestamp: new Date().toISOString(),
        icon: icon || this.getDefaultIcon(type),
        userId: this.currentUser?.uid || "system",
      };

      await set(ref(database, `activities/${activityId}`), activityData);
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  }

  getDefaultIcon(type) {
    const icons = {
      user: "fas fa-user",
      course: "fas fa-book",
      resource: "fas fa-file-alt",
      system: "fas fa-cog",
      auth: "fas fa-sign-in-alt",
    };
    return icons[type] || "fas fa-info-circle";
  }

  // Event Listeners
  setupEventListeners() {
    // Logout button
    document
      .getElementById("admin-logout")
      .addEventListener("click", this.handleLogout.bind(this));

    // Add buttons
    document.getElementById("add-user-btn").addEventListener("click", () => {
      this.showAddUserModal();
    });

    document.getElementById("add-course-btn").addEventListener("click", () => {
      this.showAddCourseModal();
    });

    document
      .getElementById("add-resource-btn")
      .addEventListener("click", () => {
        this.showAddResourceModal();
      });

    // Form submissions
    document
      .getElementById("user-form")
      .addEventListener("submit", this.handleUserFormSubmit.bind(this));
    document
      .getElementById("course-form")
      .addEventListener("submit", this.handleCourseFormSubmit.bind(this));
  }

  async handleLogout() {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (error) {
      console.error("Error signing out:", error);
      this.showNotification("Lỗi đăng xuất", "error");
    }
  }

  showAddUserModal() {
    // Clear form
    document.getElementById("user-form").reset();
    document.getElementById("user-id").value = "";
    document.getElementById("user-modal-title").textContent = "Thêm người dùng";

    this.showModal("user-modal");
  }

  showAddCourseModal() {
    // Clear form
    document.getElementById("course-form").reset();
    document.getElementById("course-id").value = "";
    document.getElementById("course-modal-title").textContent = "Thêm khóa học";

    this.showModal("course-modal");
  }

  showAddResourceModal() {
    this.showNotification(
      "Chức năng thêm tài liệu đang được phát triển",
      "warning"
    );
  }

  async handleUserFormSubmit(e) {
    e.preventDefault();

    const userId = document.getElementById("user-id").value;
    const userData = {
      username: document.getElementById("user-name").value,
      email: document.getElementById("user-email").value,
      role: parseInt(document.getElementById("user-role").value),
      status: document.getElementById("user-status").value,
    };
    try {
      if (userId) {
        // Update existing user
        const userRef = ref(database, `users/${userId}`);
        await update(userRef, userData);

        // Log activity
        await this.logActivity(
          "user",
          "Cập nhật người dùng",
          `Đã cập nhật thông tin người dùng ${userData.username}`,
          "fas fa-edit"
        );

        this.showNotification("Cập nhật người dùng thành công", "success");
      } else {
        // Add new user (in real app, you would create auth account first)
        this.showNotification(
          "Chức năng thêm người dùng mới đang được phát triển",
          "warning"
        );
      }

      this.hideModal("user-modal");
      this.loadUsersData();
    } catch (error) {
      console.error("Error saving user:", error);
      this.showNotification("Lỗi lưu thông tin người dùng", "error");
    }
  }
  async handleCourseFormSubmit(e) {
    e.preventDefault();

    const courseId = document.getElementById("course-id").value;
    const courseData = {
      title: document.getElementById("course-title").value,
      description: document.getElementById("course-description").value,
      level: document.getElementById("course-level").value,
      duration: document.getElementById("course-duration").value,
      lessons: parseInt(document.getElementById("course-lessons").value),
      category: document.getElementById("course-category").value,
      image: document.getElementById("course-image").value,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    try {
      if (courseId) {
        // Update existing course
        const courseRef = ref(database, `courses/${courseId}`);
        await update(courseRef, courseData);
        this.showNotification("Cập nhật khóa học thành công", "success");
      } else {
        // Add new course
        const newCourseId = `course-${Date.now()}`;
        const courseRef = ref(database, `courses/${newCourseId}`);
        await set(courseRef, {
          ...courseData,
          progress: 0,
          tag: this.getCategoryText(courseData.category),
          url: `courses/${newCourseId}.html`,
          createdAt: new Date().toISOString().slice(0, 10),
          status: "active",
        });
        this.showNotification("Thêm khóa học thành công", "success");
      }

      this.hideModal("course-modal");
      this.loadCoursesData();
    } catch (error) {
      console.error("Error saving course:", error);
      this.showNotification("Lỗi lưu khóa học", "error");
    }
  }

  getCategoryText(category) {
    const categories = {
      web: "Phát Triển Web",
      mobile: "Phát Triển Mobile",
      data: "Khoa Học Dữ Liệu",
      ai: "Trí Tuệ Nhân Tạo",
    };
    return categories[category] || "Khác";
  }

  // Modal Management
  initModals() {
    // Close modal when clicking outside or on close button
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.hideModal(modal.id);
        }
      });
    });

    document.querySelectorAll(".close-modal, .cancel-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const modal = e.target.closest(".modal");
        if (modal) {
          this.hideModal(modal.id);
        }
      });
    });
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("show");
      document.body.style.overflow = "hidden";
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("show");
      document.body.style.overflow = "";
    }
  }

  // Notifications
  initNotifications() {
    // Auto-hide notifications after 5 seconds
    document.addEventListener("notification-shown", () => {
      setTimeout(() => {
        this.hideNotification();
      }, 5000);
    });
  }

  showNotification(message, type = "success") {
    const notification = document.getElementById("notification");
    const messageElement = notification.querySelector(".notification-message");

    messageElement.textContent = message;
    notification.className = `notification ${type} show`;

    // Dispatch custom event
    document.dispatchEvent(new CustomEvent("notification-shown"));
  }

  hideNotification() {
    const notification = document.getElementById("notification");
    notification.classList.remove("show");
  }
}

// Khởi tạo AdminPanel khi đã xác thực thành công
document.addEventListener("DOMContentLoaded", () => {
  const guard = new AdminGuard();
  guard.checkAccess().then((isAllowed) => {
    if (isAllowed) {
      window.adminPanel = new AdminPanel();
    }
    // Nếu không đủ quyền, admin-guard.js đã xử lý và chuyển hướng
  });
});

// Close notification when clicking close button
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("notification-close")) {
    document.getElementById("notification").classList.remove("show");
  }
});
