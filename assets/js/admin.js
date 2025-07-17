import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import AdminGuard from "./admin-guard.js";

// Import các module quản lý riêng biệt
import UsersManager from "./admin/admin-user.js";
import CoursesManager from "./admin/admin-courses.js";
import BlogManager from "./admin/admin-blogs.js";
import AnalyticsManager from "./admin/admin-analytics.js";
import Dashboard from "./admin/admin-dashboard.js";
import SettingsManager from "./admin/admin-setting.js";
import CommentsManager from "./admin/admin-comments.js";

// Bộ điều khiển chính cho trang Quản trị Admin
class AdminPanel {
  constructor() {
    this.currentUser = null;

    // Khởi tạo các module quản lý
    this.users = new UsersManager(this);
    this.courses = new CoursesManager(this);
    this.blogs = new BlogManager(this);
    this.analytics = new AnalyticsManager(this);
    this.dashboard = new Dashboard(this);
    this.settings = new SettingsManager(this);
    this.comments = new CommentsManager(this);

    this.currentManagingCourseId = null;
    this.currentManagingModuleId = null;
    this.currentManagingLessonIdx = null;

    this.init();
  }

  async init() {
    // Lấy user hiện tại từ Firebase Auth
    await new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        this.currentUser = user;
        resolve();
      });
    });
    // Khởi tạo các thành phần giao diện
    this.initNavigation();
    this.initModals();
    this.initNotifications();
    this.initMenuMobile();

    // Tải dữ liệu ban đầu
    await this.loadDashboardData();

    // Thiết lập các sự kiện lắng nghe
    this.setupEventListeners();

    // Thiết lập sự kiện cho các module
    this.users.setupEventListeners();
    this.courses.setupEventListeners();
    this.blogs.setupEventListeners();

    // Khởi tạo cài đặt khi vào trang
    await this.settings.init();
  }

  // Điều hướng
  initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const sectionName = item.querySelector("a").dataset.section;
        this.showSection(sectionName);

        // Cập nhật trạng thái active cho menu
        navItems.forEach((nav) => nav.classList.remove("active"));
        item.classList.add("active");
      });
    });
  }

  showSection(sectionName) {
    // Ẩn tất cả các section
    const sections = document.querySelectorAll(".admin-section");
    sections.forEach((section) => section.classList.remove("active"));

    // Hiện section được chọn
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
      targetSection.classList.add("active");

      // Tải dữ liệu cho từng section
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
        case "blogs":
          this.loadBlogsData();
          break;
        case "comments":
          this.loadCommentsData();
          break;
        case "settings":
          // Được khỏi tạo khi vào admin trong init
          break;
        case "analytics":
          // luôn hủy và tải lại biểu đồ khi chuyển tab
          if (this.analytics) {
            this.analytics.destroyCharts();
          }
          this.loadAnalyticsData();
          break;
      }
    }
  }

  // Dashboard
  async loadDashboardData() {
    try {
      await this.dashboard.loadData();
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      this.showNotification("Lỗi tải dữ liệu dashboard", "error");
    }
  }

  // Quản lý người dùng
  async loadUsersData() {
    try {
      await this.users.loadData();
    } catch (error) {
      console.error("Error loading users data:", error);
      this.showNotification("Lỗi tải dữ liệu người dùng", "error");
    }
  }

  // Quản lý khóa học
  async loadCoursesData() {
    try {
      await this.courses.loadData();
    } catch (error) {
      console.error("Error loading courses data:", error);
      this.showNotification("Lỗi tải dữ liệu khóa học", "error");
    }
  }

  // Quản lý bài viết blog
  async loadBlogsData() {
    try {
      await this.blogs.loadData();
    } catch (error) {
      console.error("Error loading blog data:", error);
      this.showNotification("Lỗi tải dữ liệu bài viết blog", "error");
    }
  }

  // Quản lý bình luận
  async loadCommentsData() {
    try {
      await this.comments.loadData();
    } catch (error) {
      console.error("Error loading comments data:", error);
      this.showNotification("Lỗi tải dữ liệu bình luận", "error");
    }
  }

  // Thống kê
  async loadAnalyticsData() {
    try {
      await this.analytics.loadData();
    } catch (error) {
      console.error("Error loading analytics data:", error);
      this.showNotification("Lỗi tải dữ liệu thống kê", "error");
    }
  }

  // Ghi log hoạt động
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
      blog: "fas fa-blog",
    };
    return icons[type] || "fas fa-info-circle";
  }

  // Sự kiện lắng nghe
  setupEventListeners() {
    // Nút đăng xuất
    document
      .getElementById("admin-logout")
      ?.addEventListener("click", this.handleLogout.bind(this));

    // Nút đăng xuất từ sidebar (mobile)
    document
      .getElementById("admin-logout-sidebar")
      ?.addEventListener("click", this.handleLogout.bind(this));
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

  // Khởi tạo menu tablet/mobile
  initMenuMobile() {
    const sidebar = document.querySelector(".admin-sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const toggleBtn = document.getElementById("sidebar-toggle");

    if (toggleBtn && sidebar && overlay) {
      toggleBtn.addEventListener("click", () => {
        sidebar.classList.add("open");
        overlay.classList.add("show");
      });
      overlay.addEventListener("click", () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
      });
      // Đóng sidebar khi chọn menu
      sidebar.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          sidebar.classList.remove("open");
          overlay.classList.remove("show");
        });
      });
    }
  }

  // Quản lý modal
  initModals() {
    // Đóng modal khi click ra ngoài hoặc click nút đóng
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

  // Thông báo
  initNotifications() {
    // Tự động ẩn thông báo sau 5 giây
    document.addEventListener("notification-shown", () => {
      setTimeout(() => {
        this.hideNotification();
      }, 5000);
    });
  }

  showNotification(message, type = "success") {
    const notification = document.getElementById("notification");
    if (!notification) return;

    const messageElement = notification.querySelector(".notification-message");

    messageElement.textContent = message;
    notification.className = `notification ${type} show`;

    // Dispatch custom event
    document.dispatchEvent(new CustomEvent("notification-shown"));
  }

  hideNotification() {
    const notification = document.getElementById("notification");
    if (notification) {
      notification.classList.remove("show");
    }
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

// Đóng thông báo khi click nút đóng
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("notification-close")) {
    document.getElementById("notification")?.classList.remove("show");
  }
});
