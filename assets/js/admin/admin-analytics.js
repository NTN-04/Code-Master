import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
  query,
  orderByChild,
  limitToLast,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

export default class AnalyticsManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.stats = {
      usersByMonth: {},
      popularCourses: [],
    };
    this.charts = {};
    this.rawUserData = [];
  }

  async loadData() {
    try {
      // Hủy các chart cũ trước
      this.destroyCharts();

      // Tải dữ liệu
      await this.loadUsersByMonth();
      await this.loadPopularCourse();

      // Sự kiện Lọc
      this.setupEventListeners();

      // khởi tạo biểu đồ
      this.initCharts();

      return this.stats;
    } catch (error) {
      console.error("Error loading analytics data: ", error);
      this.adminPanel.showNotification("Lỗi khi tải dữ liệu", "error");
      throw error;
    }
  }

  // Tải user theo tháng
  async loadUsersByMonth() {
    const usersRef = ref(database, "users");
    const usersSnapshot = await get(usersRef);
    const users = usersSnapshot.exists() ? usersSnapshot.val() : {};

    // Nhóm người dùng theo tháng
    const usersByMonth = {};

    Object.values(users).forEach((user) => {
      if (user.createAt) {
        const date = new Date(user.createAt);
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;

        // Lưu thông tin chi tiết về thời điểm đăng ký để sau này lọc
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

  // Tải course phổ biến
  async loadPopularCourse() {
    // Lấy data course
    const coursesRef = ref(database, "courses");
    const coursesSnapshot = await get(coursesRef);
    const courses = coursesSnapshot.exists() ? coursesSnapshot.val() : {};

    // Lấy data userProgress
    const progressRef = ref(database, "userProgress");
    const progressSnapshot = await get(progressRef);
    const progress = progressSnapshot.exists() ? progressSnapshot.val() : {};

    // Đếm sl người học mỗi khóa
    const coursesEnrollment = {};
    let totalProgress = 0;
    let progressCount = 0;

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

          if (data.progress) {
            totalProgress += data.progress;
            progressCount++;
          }
        });
      }
    });

    // Chuyển thành mảng và sắp xếp theo số lượng người học giảm dần
    this.stats.popularCourses = Object.entries(coursesEnrollment)
      .map(([id, data]) => ({
        id,
        title: data.courseInfo.title,
        enrollments: data.enrollments,
      }))
      .sort((a, b) => b.enrollments - a.enrollments)
      .slice(0, 5); // top 5 course phổ biến
  }
  // Khởi tạo biểu đồ
  initCharts() {
    // Hủy Chart cũ nếu tồn tại
    this.destroyCharts();
    // Biểu đồ user theo tháng
    this.initUsersChart();
    // Biểu đồ course phổ biến
    this.initCoursesChart();
  }

  initUsersChart() {
    const usersChartCtx = document.getElementById("users-chart");
    if (!usersChartCtx) return;

    // sắp xếp nhãn t/g tăng dần (01/2024...)
    const labels = Object.keys(this.stats.usersByMonth).sort((a, b) => {
      const [aMonth, aYear] = a.split("/");
      const [bMonth, bYear] = b.split("/");
      return new Date(aYear, aMonth - 1) - new Date(bYear, bMonth - 1);
    });

    const data = labels.map((label) => this.stats.usersByMonth[label]);

    // thư viện Chart.js
    if (window.Chart) {
      this.charts.usersChart = new Chart(usersChartCtx, {
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
              tension: 0.3, // Độ công của line
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
          // cấu hình plugin của chart
          plugins: {
            title: {
              display: true,
              text: "Người dùng mới theo tháng",
            },
            tooltip: {
              mode: "index",
              intersect: false,
            },
          },
          // cấu hình trục y
          scales: {
            y: {
              beginAtZero: true, // bắt đầu từ 0
              ticks: {
                precision: 0, // nhãn là số nguyên
              },
            },
          },
        },
      });
    } else {
      usersChartCtx.innerHTML =
        '<div class="no-chart">Chart.js chưa được tải.</div>';
    }
  }

  initCoursesChart() {
    const coursesChartCtx = document.getElementById("courses-chart");
    if (!coursesChartCtx) return;

    if (this.stats.popularCourses.length === 0) {
      coursesChartCtx.innerHTML =
        '<div class="no-chart">Không có dữ liệu khóa học.</div>';
      return;
    }

    // lấy title làm nhãn
    const labels = this.stats.popularCourses.map((course) => course.title);
    // lấy số lượng học viên làm data
    const data = this.stats.popularCourses.map((course) => course.enrollments);

    if (window.Chart) {
      this.charts.coursesChart = new Chart(coursesChartCtx, {
        type: "bar", // biểu đồ cột
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
            title: {
              display: true,
              text: "Top khóa học phổ biến",
            },
            // tắt hiển thị chú giải
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
              },
            },
          },
        },
      });
    } else {
      coursesChartCtx.innerHTML =
        '<div class="no-chart">Chart.js chưa được tải.</div>';
    }
  }

  // Hủy biểu đồ cũ
  destroyCharts() {
    // hủy biểu đồ người dùng
    if (this.charts.usersChart instanceof Chart) {
      this.charts.usersChart.destroy();
      this.charts.usersChart = null;
    }
    // hủy biểu đồ khóa học
    if (this.charts.coursesChart instanceof Chart) {
      this.charts.coursesChart.destroy();
      this.charts.coursesChart = null;
    }
  }

  // Hàm cập nhật biểu bồ theo bộ lọc
  async updateChartByFilter(period = "all") {
    try {
      this.destroyCharts();

      // Lọc data theo time đã chọn
      await this.filterDataByTime(period);

      // Khởi tạo lại biểu đồ
      this.initCharts();

      this.adminPanel.showNotification(
        "Cập nhật biểu đồ thành công",
        "success"
      );
    } catch (error) {
      console.error("Error updating charts:", error);
      this.adminPanel.showNotification("Lỗi khi cập nhật biểu đồ", "error");
    }
  }
  // Lọc dữ liệu theo thời gian
  async filterDataByTime(period) {
    // lấy data đầy đủ
    await this.loadUsersByMonth();
    await this.loadPopularCourse();

    if (period === "all") return;

    // Tính ngày bắt đầu dựa trên thời gian (period)
    const today = new Date();
    const startDate = new Date();

    switch (period) {
      case "week":
        startDate.setDate(today.getDate() - 7); // 7 ngày trước
        break;
      case "month":
        startDate.setMonth(today.getMonth() - 1); // 1 tháng trước
        break;
      case "year":
        startDate.setFullYear(today.getFullYear() - 1); // 1 năm trước
        break;
      default:
        return;
    }

    // Lọc dữ liệu người dùng theo tháng
    const filteredUsersByMonth = {};
    Object.keys(this.stats.usersByMonth).forEach((monthYear) => {
      const [month, year] = monthYear.split("/");
      const monthDate = new Date(parseInt(year), parseInt(month) - 1);

      if (monthDate >= startDate) {
        filteredUsersByMonth[monthYear] = this.stats.usersByMonth[monthYear];
      }
    });
    this.stats.usersByMonth = filteredUsersByMonth;
  }

  // Hàm chi tiết hơn cho việc lọc dữ liệu người dùng
  filterUserDataByDate(startDate) {
    // Nếu không có dữ liệu thô, không làm gì cả
    if (!this.rawUserData) return {};

    // Lọc dữ liệu người dùng đăng ký sau startDate
    const filteredData = this.rawUserData.filter(
      (item) => item.date >= startDate
    );

    // Nhóm lại theo tháng
    const usersByMonth = {};
    filteredData.forEach((item) => {
      if (!usersByMonth[item.monthYear]) {
        usersByMonth[item.monthYear] = 0;
      }
      usersByMonth[item.monthYear]++;
    });

    return usersByMonth;
  }

  // Lắng nghe sự kiện lọc
  setupEventListeners() {
    // Sự kiện cho bộ lọc thời gian thống kê
    const periodFilter = document.getElementById("analytics-period");
    if (periodFilter) {
      periodFilter.addEventListener("change", () => {
        this.updateChartByFilter(periodFilter.value);
      });
    }
  }
}
