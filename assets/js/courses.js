// Chức năng trang khóa học
document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo thanh tiến trình
  initProgressBars();

  // Khởi tạo bộ lọc khóa học
  initCourseFiltering();
});

// Khởi tạo thanh tiến trình với giá trị đã lưu
function initProgressBars() {
  const progressBars = document.querySelectorAll(".progress-bar");

  progressBars.forEach((bar) => {
    const courseLink = bar
      .closest(".course-card")
      .querySelector('a[href^="courses/"]');
    if (courseLink) {
      const href = courseLink.getAttribute("href");
      const courseId = href.split("/").pop().replace(".html", "");

      const storedProgress =
        localStorage.getItem(`course-progress-${courseId}`) || 0;
      const progressValue = parseInt(storedProgress);

      const progressElement = bar.querySelector(".progress");
      const progressText = bar.nextElementSibling;

      if (progressElement && progressText) {
        progressElement.style.width = `${progressValue}%`;
        progressText.textContent = `${progressValue}% Hoàn Thành`;
      }

      bar.setAttribute("data-progress", progressValue);
    }
  });
}

// Khởi tạo bộ lọc và tìm kiếm khóa học
function initCourseFiltering() {
  const searchInput = document.getElementById("course-search");
  const levelFilter = document.getElementById("filter-level");
  const categoryFilter = document.getElementById("filter-category");
  const courseCards = document.querySelectorAll(".course-card");
  const noResults = document.querySelector(".no-results");

  // Hàm lọc khóa học dựa trên tiêu chí tìm kiếm và bộ lọc
  function filterCourses() {
    const searchTerm = searchInput.value.toLowerCase();
    const levelValue = levelFilter.value;
    const categoryValue = categoryFilter.value;

    let visibleCount = 0;

    courseCards.forEach((card) => {
      const title = card.querySelector("h3").textContent.toLowerCase();
      const description = card.querySelector("p").textContent.toLowerCase();
      const level = card.getAttribute("data-level");
      const category = card.getAttribute("data-category");

      // Kiểm tra xem thẻ có khớp với tất cả tiêu chí hay không
      const matchesSearch =
        title.includes(searchTerm) || description.includes(searchTerm);
      const matchesLevel = levelValue === "all" || level === levelValue;
      const matchesCategory =
        categoryValue === "all" || category === categoryValue;

      // Hiển thị hoặc ẩn thẻ dựa trên tiêu chí khớp
      if (matchesSearch && matchesLevel && matchesCategory) {
        card.style.display = "block";
        visibleCount++;
      } else {
        card.style.display = "none";
      }
    });

    // Hiển thị hoặc ẩn thông báo "không có kết quả"
    if (visibleCount === 0) {
      noResults.style.display = "flex";
      noResults.style.gap = "5px";
    } else {
      noResults.style.display = "none";
    }
  }

  // Thêm sự kiện lắng nghe cho các input và select
  searchInput.addEventListener("input", filterCourses);
  levelFilter.addEventListener("change", filterCourses);
  categoryFilter.addEventListener("change", filterCourses);

  // Áp dụng hiệu ứng cho các thẻ
  courseCards.forEach((card) => {
    card.classList.add("animated");
  });
}

// Tính toán và cập nhật mức độ hoàn thành khóa học dựa trên các bài học đã hoàn thành
function updateCourseCompletion(courseId) {
  // Lấy các bài học đã hoàn thành cho khóa học này
  const completedLessons = JSON.parse(
    localStorage.getItem(`${courseId}-completed-lessons`) || "[]"
  );

  // Trong ứng dụng thực tế, chúng ta sẽ biết tổng số bài học cho mỗi khóa học
  // Hiện tại, chúng ta sẽ sử dụng một mapping cứng
  const totalLessonsMap = {
    "html-css": 15,
    javascript: 18,
    react: 20,
    "react-native": 22,
    flutter: 25,
    sql: 14,
    mongodb: 16,
    python: 18,
    "machine-learning": 30,
  };

  const totalLessons = totalLessonsMap[courseId] || 15; // Mặc định là 15 nếu không tìm thấy

  // Tính toán phần trăm tiến trình
  const progressPercentage =
    totalLessons > 0
      ? Math.round((completedLessons.length / totalLessons) * 100)
      : 0;

  // Cập nhật tiến trình trong localStorage
  localStorage.setItem(`course-progress-${courseId}`, progressPercentage);

  // Cập nhật giao diện nếu đang ở trang khóa học
  const courseCard = document.querySelector(
    `.course-card a[href="courses/${courseId}.html"]`
  );
  if (courseCard) {
    const progressBar = courseCard
      .closest(".course-card")
      .querySelector(".progress-bar");
    if (progressBar) {
      const progressElement = progressBar.querySelector(".progress");
      const progressText = progressBar.nextElementSibling;

      if (progressElement && progressText) {
        progressElement.style.width = `${progressPercentage}%`;
        progressText.textContent = `${progressPercentage}% Hoàn Thành`;
      }
    }
  }

  return progressPercentage;
}

// Thêm hệ thống gợi ý khóa học (phiên bản đơn giản)
function recommendCourses() {
  // Lấy tất cả các khóa học mà người dùng đã bắt đầu
  const allCourses = [
    "html-css",
    "javascript",
    "react",
    "react-native",
    "flutter",
    "sql",
    "mongodb",
    "python",
    "machine-learning",
  ];
  const startedCourses = [];

  allCourses.forEach((courseId) => {
    const progress = parseInt(
      localStorage.getItem(`course-progress-${courseId}`) || "0"
    );
    if (progress > 0) {
      startedCourses.push({
        id: courseId,
        progress: progress,
      });
    }
  });

  // Sắp xếp theo tiến trình
  startedCourses.sort((a, b) => b.progress - a.progress);

  // Lấy các khóa học liên quan để gợi ý dựa trên khóa học tiến bộ nhất
  if (startedCourses.length > 0) {
    const topCourse = startedCourses[0].id;

    // Định nghĩa các khóa học liên quan (trong ứng dụng thực tế, điều này sẽ đến từ một engine gợi ý)
    const relatedCoursesMap = {
      "html-css": ["javascript", "react"],
      javascript: ["react", "nodejs"],
      react: ["react-native", "redux"],
      "react-native": ["flutter", "mobile-design"],
      flutter: ["mobile-design", "dart"],
      sql: ["mongodb", "database-design"],
      mongodb: ["nodejs", "database-design"],
      python: ["machine-learning", "data-science"],
      "machine-learning": ["deep-learning", "ai-ethics"],
    };

    return relatedCoursesMap[topCourse] || [];
  }

  return [];
}
