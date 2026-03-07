import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

/**
 * Smart Dashboard - Merged Dashboard + Analytics
 * Bao gồm: Stats Cards, Tabbed Charts, Recent Activities
 */
export default class Dashboard {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;

    // Chart data
    this.stats = {
      usersByMonth: {},
      popularCourses: [],
      revenueByMonth: {},
    };
    this.charts = {};
    this.rawUserData = [];
    this.ordersData = [];

    // Current active tab
    this.activeChartTab = "users";
    this.currentPeriod = "all";
  }

  async loadData() {
    try {
      // Hủy charts cũ trước
      this.destroyCharts();

      // Tải thống kê cards
      await this.loadStatistics();

      // Tải dữ liệu cho charts
      await this.loadUsersByMonth();
      await this.loadPopularCourses();
      await this.loadRevenueData();

      // Khởi tạo tabbed charts
      this.initTabbedCharts();

      // Setup event listeners
      this.setupEventListeners();

      // Tải hoạt động gần đây
      await this.loadRecentActivities();
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      this.adminPanel.showNotification("Lỗi tải dữ liệu Dashboard", "error");
    }
  }

  async loadStatistics() {
    try {
      // Tải song song tất cả data
      const [
        usersSnapshot,
        coursesSnapshot,
        blogsSnapshot,
        learnerSnapshot,
        ordersSnapshot,
      ] = await Promise.all([
        get(ref(database, "users")),
        get(ref(database, "courses")),
        get(ref(database, "blogs")),
        get(ref(database, "userProgress")),
        get(ref(database, "orders")),
      ]);

      const usersCount = usersSnapshot.exists()
        ? Object.keys(usersSnapshot.val()).length
        : 0;
      const coursesCount = coursesSnapshot.exists()
        ? Object.keys(coursesSnapshot.val()).length
        : 0;
      const blogsCount = blogsSnapshot.exists()
        ? Object.keys(blogsSnapshot.val()).length
        : 0;
      const learnerCount = learnerSnapshot.exists()
        ? Object.keys(learnerSnapshot.val()).length
        : 0;

      // Tính tổng doanh thu từ orders completed
      let totalRevenue = 0;
      if (ordersSnapshot.exists()) {
        const orders = ordersSnapshot.val();
        this.ordersData = Object.values(orders);
        totalRevenue = this.ordersData
          .filter((order) => order.status === "completed")
          .reduce((sum, order) => sum + (order.amount || 0), 0);
      }

      // Cập nhật giao diện
      document.getElementById("total-users").textContent = usersCount;
      document.getElementById("total-courses").textContent = coursesCount;
      document.getElementById("active-learners").textContent = learnerCount;
      document.getElementById("total-resources").textContent = blogsCount;

      // Revenue card
      const revenueEl = document.getElementById("total-revenue");
      if (revenueEl) {
        revenueEl.textContent = this.formatCurrency(totalRevenue);
      }
    } catch (error) {
      console.error("Error loading statistics:", error);
      this.adminPanel.showNotification("Lỗi tải thống kê", "error");
    }
  }

  // Format tiền VND
  formatCurrency(amount) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // ============ CHART DATA LOADING ============

  async loadUsersByMonth() {
    const usersRef = ref(database, "users");
    const usersSnapshot = await get(usersRef);
    const users = usersSnapshot.exists() ? usersSnapshot.val() : {};

    this.rawUserData = [];
    const usersByMonth = {};

    Object.values(users).forEach((user) => {
      if (user.createAt) {
        const date = new Date(user.createAt);
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;

        this.rawUserData.push({
          date: date,
          monthYear: monthYear,
        });

        if (!usersByMonth[monthYear]) {
          usersByMonth[monthYear] = 0;
        }
        usersByMonth[monthYear]++;
      }
    });

    this.stats.usersByMonth = usersByMonth;
  }

  async loadPopularCourses() {
    const [coursesSnapshot, progressSnapshot] = await Promise.all([
      get(ref(database, "courses")),
      get(ref(database, "userProgress")),
    ]);

    const courses = coursesSnapshot.exists() ? coursesSnapshot.val() : {};
    const progress = progressSnapshot.exists() ? progressSnapshot.val() : {};

    const coursesEnrollment = {};

    Object.values(progress).forEach((userProgress) => {
      if (userProgress.courses) {
        Object.entries(userProgress.courses).forEach(([courseId, data]) => {
          if (!coursesEnrollment[courseId]) {
            coursesEnrollment[courseId] = {
              enrollments: 0,
              courseInfo: courses[courseId] || {
                title: "Khóa học không xác định",
              },
            };
          }
          coursesEnrollment[courseId].enrollments++;
        });
      }
    });

    this.stats.popularCourses = Object.entries(coursesEnrollment)
      .map(([id, data]) => ({
        id,
        title: data.courseInfo.title,
        enrollments: data.enrollments,
      }))
      .sort((a, b) => b.enrollments - a.enrollments)
      .slice(0, 5);
  }

  async loadRevenueData() {
    const ordersRef = ref(database, "orders");
    const ordersSnapshot = await get(ordersRef);
    const orders = ordersSnapshot.exists() ? ordersSnapshot.val() : {};

    const revenueByMonth = {};

    Object.values(orders).forEach((order) => {
      if (order.status === "completed" && order.createdAt) {
        const date = new Date(order.createdAt);
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;

        if (!revenueByMonth[monthYear]) {
          revenueByMonth[monthYear] = 0;
        }
        revenueByMonth[monthYear] += order.amount || 0;
      }
    });

    this.stats.revenueByMonth = revenueByMonth;
  }

  // ============ TABBED CHARTS ============

  initTabbedCharts() {
    // Render chart cho tab đang active
    this.renderActiveChart();
  }

  renderActiveChart() {
    const chartCanvas = document.getElementById("dashboard-chart");
    if (!chartCanvas) return;

    // Destroy chart cũ
    if (this.charts.mainChart instanceof Chart) {
      this.charts.mainChart.destroy();
      this.charts.mainChart = null;
    }

    switch (this.activeChartTab) {
      case "users":
        this.renderUsersChart(chartCanvas);
        break;
      case "revenue":
        this.renderRevenueChart(chartCanvas);
        break;
      case "courses":
        this.renderCoursesChart(chartCanvas);
        break;
    }
  }

  renderUsersChart(ctx) {
    if (!window.Chart) {
      ctx.parentElement.innerHTML =
        '<div class="no-chart">Chart.js chưa được tải.</div>';
      return;
    }

    const labels = Object.keys(this.stats.usersByMonth).sort((a, b) => {
      const [aMonth, aYear] = a.split("/");
      const [bMonth, bYear] = b.split("/");
      return new Date(aYear, aMonth - 1) - new Date(bYear, bMonth - 1);
    });
    const data = labels.map((label) => this.stats.usersByMonth[label]);

    this.charts.mainChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Người dùng mới",
            data: data,
            borderColor: "#4361ee",
            backgroundColor: "rgba(67, 97, 238, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: "#fff",
            pointBorderColor: "#4361ee",
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "Người dùng mới theo tháng" },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  renderRevenueChart(ctx) {
    if (!window.Chart) {
      ctx.parentElement.innerHTML =
        '<div class="no-chart">Chart.js chưa được tải.</div>';
      return;
    }

    const labels = Object.keys(this.stats.revenueByMonth).sort((a, b) => {
      const [aMonth, aYear] = a.split("/");
      const [bMonth, bYear] = b.split("/");
      return new Date(aYear, aMonth - 1) - new Date(bYear, bMonth - 1);
    });
    const data = labels.map((label) => this.stats.revenueByMonth[label]);

    this.charts.mainChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Doanh thu",
            data: data,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: "#fff",
            pointBorderColor: "#10b981",
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "Doanh thu theo tháng" },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: (context) => {
                return `Doanh thu: ${this.formatCurrency(context.raw)}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => this.formatCurrency(value),
            },
          },
        },
      },
    });
  }

  renderCoursesChart(ctx) {
    if (!window.Chart) {
      ctx.parentElement.innerHTML =
        '<div class="no-chart">Chart.js chưa được tải.</div>';
      return;
    }

    if (this.stats.popularCourses.length === 0) {
      ctx.parentElement.innerHTML =
        '<div class="no-chart">Không có dữ liệu khóa học.</div>';
      return;
    }

    const labels = this.stats.popularCourses.map((c) => c.title);
    const data = this.stats.popularCourses.map((c) => c.enrollments);

    this.charts.mainChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Số học viên",
            data: data,
            backgroundColor: [
              "rgba(255, 99, 132, 0.7)",
              "rgba(54, 162, 235, 0.7)",
              "rgba(255, 206, 86, 0.7)",
              "rgba(75, 192, 192, 0.7)",
              "rgba(153, 102, 255, 0.7)",
            ],
            borderColor: [
              "rgba(255, 99, 132, 1)",
              "rgba(54, 162, 235, 1)",
              "rgba(255, 206, 86, 1)",
              "rgba(75, 192, 192, 1)",
              "rgba(153, 102, 255, 1)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "Top khóa học phổ biến" },
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  // Hủy tất cả charts
  destroyCharts() {
    if (this.charts.mainChart instanceof Chart) {
      this.charts.mainChart.destroy();
      this.charts.mainChart = null;
    }
  }

  // ============ TIME FILTER ============

  async updateChartByFilter(period) {
    this.currentPeriod = period;

    try {
      // Reload data
      await this.loadUsersByMonth();
      await this.loadRevenueData();

      if (period !== "all") {
        const startDate = this.getStartDate(period);
        this.filterDataByDate(startDate);
      }

      // Re-render chart
      this.renderActiveChart();
    } catch (error) {
      console.error("Error updating chart:", error);
    }
  }

  getStartDate(period) {
    const today = new Date();
    const startDate = new Date();

    switch (period) {
      case "week":
        startDate.setDate(today.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(today.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(today.getFullYear() - 1);
        break;
    }
    return startDate;
  }

  filterDataByDate(startDate) {
    // Filter users by month
    const filteredUsers = {};
    Object.keys(this.stats.usersByMonth).forEach((monthYear) => {
      const [month, year] = monthYear.split("/");
      const monthDate = new Date(parseInt(year), parseInt(month) - 1);
      if (monthDate >= startDate) {
        filteredUsers[monthYear] = this.stats.usersByMonth[monthYear];
      }
    });
    this.stats.usersByMonth = filteredUsers;

    // Filter revenue by month
    const filteredRevenue = {};
    Object.keys(this.stats.revenueByMonth).forEach((monthYear) => {
      const [month, year] = monthYear.split("/");
      const monthDate = new Date(parseInt(year), parseInt(month) - 1);
      if (monthDate >= startDate) {
        filteredRevenue[monthYear] = this.stats.revenueByMonth[monthYear];
      }
    });
    this.stats.revenueByMonth = filteredRevenue;
  }

  // ============ EVENT LISTENERS ============

  setupEventListeners() {
    // Tab buttons
    const tabButtons = document.querySelectorAll(".chart-tab-btn");
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // Remove active from all
        tabButtons.forEach((b) => b.classList.remove("active"));
        // Add active to clicked
        e.target.classList.add("active");
        // Update active tab and render
        this.activeChartTab = e.target.dataset.chart;
        this.renderActiveChart();
      });
    });

    // Period filter
    const periodFilter = document.getElementById("dashboard-period");
    if (periodFilter) {
      periodFilter.addEventListener("change", (e) => {
        this.updateChartByFilter(e.target.value);
      });
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
          .slice(0, 30); // Lấy 30 hoạt động mới nhất

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
}
