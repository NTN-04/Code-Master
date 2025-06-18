import { database } from "./firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import progressManager from "./progress-manager.js";

// Chức năng trang khóa học
document.addEventListener("DOMContentLoaded", function () {
  // Tải khóa học từ database
  loadCoursesFromDatabase();

  // Khởi tạo bộ lọc khóa học (sẽ chạy sau khi tải xong dữ liệu)
  initCourseFiltering();
  // Khởi tạo đồng bộ tiến trình
  progressManager.initAuth();
});

// Tải khóa học từ Firebase Realtime Database
async function loadCoursesFromDatabase() {
  try {
    // Hiển thị loading
    showCoursesLoading();

    // Lấy dữ liệu khóa học từ database
    const coursesRef = ref(database, "courses");
    const snapshot = await get(coursesRef);

    if (snapshot.exists()) {
      const coursesData = snapshot.val();

      // Tải thêm dữ liệu categories để lấy thông tin màu sắc
      const categoriesRef = ref(database, "categories");
      const categoriesSnapshot = await get(categoriesRef);
      const categoriesData = categoriesSnapshot.exists()
        ? categoriesSnapshot.val()
        : {};

      // Render khóa học
      await renderCourses(coursesData, categoriesData);

      // Khởi tạo thanh tiến trình từ firebase
      progressManager.initProgressBars();
    } else {
      showNoCoursesMessage();
    }
  } catch (error) {
    console.error("Lỗi khi tải khóa học:", error);
    showErrorMessage();
  }
}

// Hiển thị loading state
function showCoursesLoading() {
  const coursesGrid = document.querySelector(".courses-grid");
  if (coursesGrid) {
    coursesGrid.innerHTML = `
      <div class="loading-courses">
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
        <p>Đang tải khóa học...</p>
      </div>
    `;
  }
}

// Lấy tổng số lessons và tổng duration từ course_modules
async function getCourseStats(courseId) {
  const modulesRef = ref(database, `course_modules/${courseId}`);
  const snap = await get(modulesRef);
  let totalLessons = 0;
  let totalMinutes = 0;
  if (snap.exists()) {
    const modules = snap.val();
    // Trả về 1 mảng chứa tất cả value của các module
    Object.values(modules).forEach((module) => {
      module.lessons.forEach((lesson) => {
        totalLessons++;
        if (lesson.duration) {
          // kiểm tra và lấy số phút và số giây từ duration bằng regex
          const match = lesson.duration.match(/(\d+)(?::(\d+))?/);
          if (match) {
            const m = parseInt(match[1]);
            const s = match[2] ? parseInt(match[2]) : 0;
            totalMinutes += m + Math.round(s / 60);
          }
        }
      });
    });
  }
  return { totalLessons, totalMinutes };
}

// Render khóa học từ dữ liệu database
async function renderCourses(coursesData, categoriesData) {
  const coursesGrid = document.querySelector(".courses-grid");
  if (!coursesGrid) return;

  // Convert object to array và sắp xếp
  const coursesArray = Object.values(coursesData).sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Tạo HTML cho tất cả khóa học (chờ stats từng khóa học)
  let coursesHTML = "";
  for (const course of coursesArray) {
    // stats lưu totalLessons và totalDuration
    const stats = await getCourseStats(course.id);
    coursesHTML += createCourseCard(course, categoriesData, stats);
  }
  coursesGrid.innerHTML = coursesHTML;
}

// Tạo HTML cho một thẻ khóa học
function createCourseCard(course, categoriesData, stats = {}) {
  const category = categoriesData[course.category] || {};
  const categoryName = category.name || course.category;
  const categoryIcon = category.icon || "📚";
  const categoryColor = category.color || "#fff";

  // Map level sang tiếng Việt
  const levelMap = {
    beginner: "Người Mới",
    intermediate: "Trung Cấp",
    advanced: "Nâng Cao",
  };
  const levelText = levelMap[course.level] || course.level;

  // Sử dụng stats động nếu có, fallback về dữ liệu tĩnh nếu chưa có
  const lessonsCount = stats.totalLessons || course.lessons || 0;
  const totalMinutes = stats.totalMinutes || 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let durationText = "";
  if (hours > 0) durationText += `${hours} giờ `;
  if (minutes > 0) durationText += `${minutes} phút`;
  if (!durationText) durationText = course.duration || "0 phút";

  return `
    <div class="course-card" data-level="${course.level}" data-category="${
    course.category
  }">
      <div class="course-image">
        <img src="${course.image}" alt="${course.title}" loading="lazy" />
        <div class="course-tag" style="color:${categoryColor}">${categoryIcon} ${categoryName}</div>
      </div>
      <div class="course-info">
        <h3>${course.title}</h3>
        <div class="skill-level">
          <span class="level ${course.level}">${levelText}</span>
        </div>
        <p class="line-clamp-2">${course.description}</p>
        <div class="course-meta">
          <span><i class="far fa-clock"></i> ${durationText.trim()}</span>
          <span><i class="far fa-file-alt"></i> ${lessonsCount} bài học</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" data-progress="0" data-course-id="${
            course.id
          }">
            <div class="progress"></div>
          </div>
          <span class="progress-text">0% Hoàn Thành</span>
        </div>
        <a href="${course.url}" class="btn btn-primary">Bắt Đầu Học</a>
      </div>
    </div>
  `;
}

// Hiển thị thông báo khi không có khóa học
function showNoCoursesMessage() {
  const coursesGrid = document.querySelector(".courses-grid");
  if (coursesGrid) {
    coursesGrid.innerHTML = `
      <div class="no-courses-message">
        <i class="fas fa-graduation-cap"></i>
        <h3>Chưa có khóa học nào</h3>
        <p>Các khóa học sẽ sớm được cập nhật. Hãy quay lại sau!</p>
      </div>
    `;
  }
}

// Hiển thị thông báo lỗi
function showErrorMessage() {
  const coursesGrid = document.querySelector(".courses-grid");
  if (coursesGrid) {
    coursesGrid.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Không thể tải khóa học</h3>
        <p>Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.</p>
        <button class="btn btn-primary" onclick="location.reload()">Thử Lại</button>
      </div>
    `;
  }
}

// Khởi tạo bộ lọc và tìm kiếm khóa học
function initCourseFiltering() {
  const searchInput = document.getElementById("course-search");
  const levelFilter = document.getElementById("filter-level");
  const categoryFilter = document.getElementById("filter-category");

  // Tải danh mục cho dropdown filter
  loadCategoriesForFilter();

  // Hàm lọc khóa học
  function filterCourses() {
    const courseCards = document.querySelectorAll(".course-card");
    const noResults = document.querySelector(".no-results");

    if (!courseCards.length) return;

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const levelValue = levelFilter ? levelFilter.value : "all";
    const categoryValue = categoryFilter ? categoryFilter.value : "all";

    let visibleCount = 0;

    courseCards.forEach((card) => {
      const title = card.querySelector("h3")?.textContent.toLowerCase() || "";
      const description =
        card.querySelector("p")?.textContent.toLowerCase() || "";
      const level = card.getAttribute("data-level");
      const category = card.getAttribute("data-category");

      // Kiểm tra điều kiện lọc
      const matchesSearch =
        title.includes(searchTerm) || description.includes(searchTerm);
      const matchesLevel = levelValue === "all" || level === levelValue;
      const matchesCategory =
        categoryValue === "all" || category === categoryValue;

      // Hiển thị hoặc ẩn thẻ
      if (matchesSearch && matchesLevel && matchesCategory) {
        card.style.display = "block";
        visibleCount++;
      } else {
        card.style.display = "none";
      }
    });

    // Hiển thị thông báo "không có kết quả"
    if (noResults) {
      if (visibleCount === 0 && courseCards.length > 0) {
        noResults.style.display = "flex";
        noResults.style.gap = "5px";
      } else {
        noResults.style.display = "none";
      }
    }
  }

  // Thêm event listeners
  if (searchInput) {
    searchInput.addEventListener("input", filterCourses);
  }
  if (levelFilter) {
    levelFilter.addEventListener("change", filterCourses);
  }
  if (categoryFilter) {
    categoryFilter.addEventListener("change", filterCourses);
  }
}

// Tải danh mục để hiển thị trong dropdown filter
async function loadCategoriesForFilter() {
  try {
    const categoriesRef = ref(database, "categories");
    const snapshot = await get(categoriesRef);

    if (snapshot.exists()) {
      const categoriesData = snapshot.val();
      updateCategoryFilter(categoriesData);
    }
  } catch (error) {
    console.error("Lỗi khi tải danh mục:", error);
  }
}

// Cập nhật dropdown filter danh mục
function updateCategoryFilter(categoriesData) {
  const categoryFilter = document.getElementById("filter-category");
  if (!categoryFilter) return;

  // Giữ lại option "Tất Cả Danh Mục"
  const defaultOption = categoryFilter.querySelector('option[value="all"]');
  categoryFilter.innerHTML = "";
  if (defaultOption) {
    categoryFilter.appendChild(defaultOption);
  }

  // Thêm các danh mục từ database
  Object.values(categoriesData).forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.icon} ${category.name}`;
    categoryFilter.appendChild(option);
  });
}
