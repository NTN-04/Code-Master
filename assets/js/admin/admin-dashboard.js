import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

export default class Dashboard {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
  }

  async loadData() {
    try {
      // Tải thống kê
      await this.loadStatistics();
      // Tải hoạt động gần đây
      await this.loadRecentActivities();
    } catch (error) {
      console.error("Error loading analytics data:", error);
      this.adminPanel.showNotification("Lỗi tải dữ liệu thống kê", "error");
    }
  }

  async loadStatistics() {
    try {
      // Lấy tổng số người dùng từ Firebase
      const usersRef = ref(database, "users");
      const usersSnapshot = await get(usersRef);
      const usersCount = usersSnapshot.exists()
        ? Object.keys(usersSnapshot.val()).length
        : 0;

      // Lấy tổng số khóa học từ Firebase
      const coursesRef = ref(database, "courses");
      const coursesSnapshot = await get(coursesRef);
      const coursesCount = coursesSnapshot.exists()
        ? Object.keys(coursesSnapshot.val()).length
        : 0;

      // Lấy tổng số tài liệu từ Firebase
      const blogsRef = ref(database, "blogs");
      const blogsSnapshot = await get(blogsRef);
      const blogsCount = blogsSnapshot.exists()
        ? Object.keys(blogsSnapshot.val()).length
        : 0;

      // Đếm số học viên đang học (user có trường courses)
      let activeLearners = 0;
      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();
        Object.values(users).forEach((user) => {
          if (user.courses && Object.keys(user.courses).length > 0) {
            activeLearners++;
          }
        });
      }

      // Cập nhật giao diện
      document.getElementById("total-users").textContent = usersCount;
      document.getElementById("total-courses").textContent = coursesCount;
      document.getElementById("active-learners").textContent = activeLearners;
      document.getElementById("total-resources").textContent = blogsCount;
    } catch (error) {
      console.error("Error loading statistics:", error);
      this.adminPanel.showNotification("Lỗi tải thống kê", "error");
    }
  }

  async loadRecentActivities() {
    const activitiesContainer = document.getElementById("recent-activities");
    if (!activitiesContainer) return;

    // Hiển thị trạng thái đang tải
    activitiesContainer.innerHTML = `
      <div class="loading-courses">
        <span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span>
        <span>Đang tải hoạt động gần đây...</span>
      </div>
    `;

    try {
      // Lấy hoạt động gần đây từ Firebase
      const activitiesRef = ref(database, "activities");
      const snapshot = await get(activitiesRef);

      activitiesContainer.innerHTML = "";

      if (snapshot.exists()) {
        const activities = Object.entries(snapshot.val())
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 10); // Lấy 10 hoạt động mới nhất

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

    // Định dạng thời gian từ timestamp nếu có
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

  setupEventListeners() {
    // Bổ sung các event listeners nếu cần
  }
}
