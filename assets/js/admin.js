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
import { createNotificationManager } from "./utils/notifications.js";
import { openModal, closeModal, attachModalDismiss } from "./utils/modal.js";

// Import các module quản lý riêng biệt
import UsersManager from "./admin/admin-user.js";
import CoursesManager from "./admin/admin-courses.js";
import BlogManager from "./admin/admin-blogs.js";
import AnalyticsManager from "./admin/admin-analytics.js";
import Dashboard from "./admin/admin-dashboard.js";
import SettingsManager from "./admin/admin-setting.js";
import CommentsManager from "./admin/admin-comments.js";
import OrdersManager from "./admin/admin-orders.js";
import PaymentLogsManager from "./admin/admin-payment-logs.js";

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
    this.orders = new OrdersManager(this);
    this.paymentLogs = new PaymentLogsManager(this);

    this.notificationManager = createNotificationManager({
      containerId: "notification",
      autoHideDelay: 5000,
    });

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
    this.orders.setupEventListeners();
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
        case "orders":
          this.loadOrdersData();
          this.initOrdersSubTabs();
          break;
        case "comments":
          this.loadCommentsData();
          break;
        case "settings":
          // Được khởi tạo khi sau khi xác thực quyền thành công checkAccess()
          // khởi tạo lại khi vào tab cài đặt
          if (this.settings) this.settings.init();
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

  // Quản lý đơn hàng
  async loadOrdersData() {
    try {
      await this.orders.loadData();
    } catch (error) {
      console.error("Error loading orders data:", error);
      this.showNotification("Lỗi tải dữ liệu đơn hàng", "error");
    }
  }

  // Khởi tạo sub-tabs trong Orders section
  initOrdersSubTabs() {
    const subTabs = document.querySelectorAll(".orders-sub-tabs .sub-tab");
    const subTabContents = document.querySelectorAll(
      "#orders .sub-tab-content",
    );

    subTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.subtab;

        // Update active tab
        subTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Show target content
        subTabContents.forEach((content) => content.classList.remove("active"));

        if (targetTab === "orders-list") {
          document.getElementById("orders-list-tab")?.classList.add("active");
        } else if (targetTab === "webhook-logs") {
          document.getElementById("webhook-logs-tab")?.classList.add("active");
          // Load payment logs khi chuyển sang tab này
          this.loadPaymentLogsData();
        }
      });
    });
  }

  // Logs thanh toán tự động
  async loadPaymentLogsData() {
    try {
      await this.paymentLogs.loadData();
    } catch (error) {
      console.error("Error loading payment logs:", error);
      this.showNotification("Lỗi tải logs thanh toán", "error");
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
      sessionStorage.removeItem("adminVerified");
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
    document.querySelectorAll(".modal").forEach((modal) => {
      attachModalDismiss(modal, { closeOnBackdrop: true });
    });
  }

  showModal(modalId) {
    openModal(modalId, { lockScroll: true });
  }

  hideModal(modalId) {
    closeModal(modalId, { lockScroll: true });
  }

  // Thông báo
  initNotifications() {
    // Notification manager đã xử lý auto-hide, không cần cấu hình thêm
  }

  showNotification(message, type = "success") {
    this.notificationManager.show(message, type);
  }

  hideNotification() {
    this.notificationManager.hide();
  }
}

// Khởi tạo AdminPanel khi đã xác thực thành công và đã tải xong setting

document.addEventListener("DOMContentLoaded", () => {
  const guard = new AdminGuard();
  guard.checkAccess().then(async (isAllowed) => {
    if (isAllowed) {
      // Tải setting trước khi vào admin
      const fakePanel = { showNotification: () => {} };
      const settings = new SettingsManager(fakePanel);
      await settings.init();

      // tải dashboard trước khi vào admin

      // Khởi tạo admin panel thật sự
      window.adminPanel = new AdminPanel();
    }
    // Nếu không đủ quyền, admin-guard.js đã xử lý và chuyển hướng
  });
});

// Đóng thông báo khi click nút đóng
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("notification-close")) {
    if (window.adminPanel) {
      window.adminPanel.hideNotification();
    } else {
      document.getElementById("notification")?.classList.remove("show");
    }
  }
});
