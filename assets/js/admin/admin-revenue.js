import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
  onValue,
  off,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { formatDateTime } from "../utils/date.js";
import { exportRevenueReport } from "../utils/export.js";

/**
 * Admin Revenue Manager
 * Quản lý và báo cáo doanh thu chi tiết
 */
export default class RevenueManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.orders = [];
    this.courses = {};
    this.users = {};

    // Listener management
    this.ordersListenerRef = null;
    this.ordersListenerCallback = null;

    // Revenue data
    this.revenueData = {
      total: 0,
      completed: 0,
      pending: 0,
      refunded: 0,
      growthPercent: 0,
      byMonth: {},
      topCourses: [],
    };

    // Current filter period
    this.currentPeriod = "30"; // Default 30 days

    // Chart instance
    this.revenueChart = null;
  }

  /**
   * Load revenue data
   */
  async loadData() {
    try {
      // Show loading state
      this.showLoadingState();

      // Destroy old chart
      this.destroyChart();

      // Load reference data (courses, users)
      await this.loadReferenceData();

      // Setup realtime listener for orders
      this.setupOrdersListener();

      // Setup event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error("Error loading revenue data:", error);
      this.adminPanel.showNotification("Lỗi tải dữ liệu doanh thu", "error");
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    const cardsContainer = document.getElementById("revenue-cards");
    if (cardsContainer) {
      cardsContainer.innerHTML = `
        <div class="loading-courses">
          <span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span>
          <span>Đang tải dữ liệu doanh thu...</span>
        </div>
      `;
    }
  }

  /**
   * Load courses and users for reference
   */
  async loadReferenceData() {
    try {
      const [coursesSnap, usersSnap] = await Promise.all([
        get(ref(database, "courses")),
        get(ref(database, "users")),
      ]);

      if (coursesSnap.exists()) {
        this.courses = coursesSnap.val();
      }
      if (usersSnap.exists()) {
        this.users = usersSnap.val();
      }
    } catch (error) {
      console.error("Error loading reference data:", error);
    }
  }

  /**
   * Setup realtime listener for orders
   */
  setupOrdersListener() {
    // Cleanup previous listener
    this.cleanupListener();

    this.ordersListenerRef = ref(database, "orders");
    this.ordersListenerCallback = (snapshot) => {
      if (snapshot.exists()) {
        this.orders = Object.entries(snapshot.val())
          .map(([id, data]) => ({
            id,
            ...data,
          }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else {
        this.orders = [];
      }

      // Calculate and render revenue data
      this.calculateRevenueData();
      this.renderRevenueCards();
      this.renderRevenueChart();
      this.renderTopCourses();
    };

    onValue(this.ordersListenerRef, this.ordersListenerCallback, (error) => {
      console.error("Error loading orders:", error);
      this.adminPanel.showNotification("Lỗi tải dữ liệu đơn hàng", "error");
    });
  }

  /**
   * Cleanup realtime listener
   */
  cleanupListener() {
    if (this.ordersListenerRef && this.ordersListenerCallback) {
      off(this.ordersListenerRef, "value", this.ordersListenerCallback);
      this.ordersListenerRef = null;
      this.ordersListenerCallback = null;
    }
  }

  /**
   * Calculate revenue data from orders
   */
  calculateRevenueData() {
    const now = new Date();
    const periodDays = parseInt(this.currentPeriod) || 30;
    const startDate = new Date();
    startDate.setDate(now.getDate() - periodDays);

    // Previous period for growth calculation
    const prevStartDate = new Date();
    prevStartDate.setDate(startDate.getDate() - periodDays);

    // Filter orders by period
    const currentPeriodOrders = this.orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= now;
    });

    const prevPeriodOrders = this.orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= prevStartDate && orderDate < startDate;
    });

    // Calculate totals for current period
    let total = 0;
    let completed = 0;
    let pending = 0;
    let refunded = 0;
    const byMonth = {};
    const courseRevenue = {};

    currentPeriodOrders.forEach((order) => {
      const amount = order.amount || 0;
      total += amount;

      switch (order.status) {
        case "completed":
          completed += amount;
          break;
        case "pending":
          pending += amount;
          break;
        case "refunded":
          refunded += amount;
          break;
      }

      // Group by date for chart
      if (order.createdAt && order.status === "completed") {
        const date = new Date(order.createdAt);
        const dateKey = date.toLocaleDateString("vi-VN");

        if (!byMonth[dateKey]) {
          byMonth[dateKey] = 0;
        }
        byMonth[dateKey] += amount;
      }

      // Group by course for top courses
      if (order.courseId && order.status === "completed") {
        if (!courseRevenue[order.courseId]) {
          courseRevenue[order.courseId] = {
            courseId: order.courseId,
            revenue: 0,
            count: 0,
          };
        }
        courseRevenue[order.courseId].revenue += amount;
        courseRevenue[order.courseId].count++;
      }
    });

    // Calculate previous period completed revenue
    const prevCompleted = prevPeriodOrders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + (o.amount || 0), 0);

    // Calculate growth percentage
    let growthPercent = 0;
    if (prevCompleted > 0) {
      growthPercent = ((completed - prevCompleted) / prevCompleted) * 100;
    } else if (completed > 0) {
      growthPercent = 100;
    }

    // Get top 5 courses by revenue
    const topCourses = Object.values(courseRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        title: this.courses[item.courseId]?.title || "Khóa học không xác định",
      }));

    // Update revenue data
    this.revenueData = {
      total,
      completed,
      pending,
      refunded,
      growthPercent,
      byMonth,
      topCourses,
    };
  }

  /**
   * Format currency VND
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Render revenue cards
   */
  renderRevenueCards() {
    const container = document.getElementById("revenue-cards");
    if (!container) return;

    const { completed, pending, refunded, growthPercent } = this.revenueData;
    const growthClass = growthPercent >= 0 ? "positive" : "negative";
    const growthIcon = growthPercent >= 0 ? "fa-arrow-up" : "fa-arrow-down";

    container.innerHTML = `
      <div class="revenue-stats-grid">
        <div class="stat-card revenue-card">
          <div class="stat-icon revenue-completed">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="stat-info">
            <h3>${this.formatCurrency(completed)}</h3>
            <p>Doanh thu hoàn thành</p>
          </div>
        </div>
        
        <div class="stat-card revenue-card">
          <div class="stat-icon revenue-pending">
            <i class="fas fa-clock"></i>
          </div>
          <div class="stat-info">
            <h3>${this.formatCurrency(pending)}</h3>
            <p>Đang chờ xử lý</p>
          </div>
        </div>
        
        <div class="stat-card revenue-card">
          <div class="stat-icon revenue-refunded">
            <i class="fas fa-undo"></i>
          </div>
          <div class="stat-info">
            <h3>${this.formatCurrency(refunded)}</h3>
            <p>Hoàn tiền</p>
          </div>
        </div>
        
        <div class="stat-card revenue-card">
          <div class="stat-icon revenue-growth ${growthClass}">
            <i class="fas ${growthIcon}"></i>
          </div>
          <div class="stat-info">
            <h3 class="${growthClass}">${growthPercent >= 0 ? "+" : ""}${growthPercent.toFixed(1)}%</h3>
            <p>Tăng trưởng</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render revenue chart
   */
  renderRevenueChart() {
    const chartCanvas = document.getElementById("revenue-detail-chart");
    if (!chartCanvas) return;

    // Destroy old chart
    this.destroyChart();

    if (!window.Chart) {
      chartCanvas.parentElement.innerHTML =
        '<div class="no-chart">Chart.js chưa được tải.</div>';
      return;
    }

    const { byMonth } = this.revenueData;

    // Sort dates chronologically
    const sortedDates = Object.keys(byMonth).sort((a, b) => {
      const dateA = this.parseVietnameseDate(a);
      const dateB = this.parseVietnameseDate(b);
      return dateA - dateB;
    });

    const labels = sortedDates;
    const data = sortedDates.map((date) => byMonth[date]);

    if (labels.length === 0) {
      chartCanvas.parentElement.innerHTML = `
        <div class="no-chart">
          <i class="fas fa-chart-line"></i>
          <p>Chưa có dữ liệu doanh thu trong khoảng thời gian này</p>
        </div>
      `;
      return;
    }

    this.revenueChart = new Chart(chartCanvas, {
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
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Doanh thu theo ngày",
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: (context) => {
                return `Doanh thu: ${this.formatCurrency(context.raw)}`;
              },
            },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => this.formatCurrency(value),
            },
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
            },
          },
        },
      },
    });
  }

  /**
   * Parse Vietnamese date format dd/mm/yyyy
   */
  parseVietnameseDate(dateStr) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
  }

  /**
   * Render top selling courses
   */
  renderTopCourses() {
    const container = document.getElementById("top-courses-revenue");
    if (!container) return;

    const { topCourses } = this.revenueData;

    if (topCourses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-chart-bar"></i>
          <p>Chưa có dữ liệu khóa học</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Khóa học</th>
            <th>Số đơn</th>
            <th>Doanh thu</th>
          </tr>
        </thead>
        <tbody>
          ${topCourses
            .map(
              (course, index) => `
            <tr>
              <td><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
              <td class="course-title">${course.title}</td>
              <td>${course.count}</td>
              <td class="revenue-amount">${this.formatCurrency(course.revenue)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  /**
   * Destroy chart instance
   */
  destroyChart() {
    if (this.revenueChart instanceof Chart) {
      this.revenueChart.destroy();
      this.revenueChart = null;
    }
  }

  /**
   * Update data by filter period
   */
  async updateByPeriod(period) {
    this.currentPeriod = period;
    this.calculateRevenueData();
    this.renderRevenueCards();
    this.renderRevenueChart();
    this.renderTopCourses();
  }

  /**
   * Export revenue report to Excel
   */
  exportToExcel() {
    try {
      const success = exportRevenueReport(
        this.revenueData,
        this.currentPeriod,
        "excel",
      );

      if (success) {
        this.adminPanel.showNotification(
          "Xuất báo cáo Excel thành công!",
          "success",
        );
      }
    } catch (error) {
      console.error("Error exporting Excel:", error);
      this.adminPanel.showNotification("Lỗi xuất báo cáo", "error");
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Period filter
    const periodFilter = document.getElementById("revenue-period");
    if (periodFilter) {
      periodFilter.addEventListener("change", (e) => {
        this.updateByPeriod(e.target.value);
      });
    }

    // Export button
    const exportBtn = document.getElementById("export-revenue-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.exportToExcel();
      });
    }
  }
}
