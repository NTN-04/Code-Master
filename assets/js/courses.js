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
      renderCourses(coursesData, categoriesData);

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

// Render khóa học từ dữ liệu database
function renderCourses(coursesData, categoriesData) {
  const coursesGrid = document.querySelector(".courses-grid");
  if (!coursesGrid) return;

  // Convert object to array và sắp xếp
  const coursesArray = Object.values(coursesData).sort((a, b) => {
    // Sắp xếp theo thời gian tạo (mới nhất trước)
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Tạo HTML cho tất cả khóa học
  const coursesHTML = coursesArray
    .map((course) => createCourseCard(course, categoriesData))
    .join("");

  coursesGrid.innerHTML = coursesHTML;
}

// Tạo HTML cho một thẻ khóa học
function createCourseCard(course, categoriesData) {
  const category = categoriesData[course.category] || {};
  const categoryName = category.name || course.category;
  const categoryIcon = category.icon || "📚";

  // Map level sang tiếng Việt
  const levelMap = {
    beginner: "Người Mới",
    intermediate: "Trung Cấp",
    advanced: "Nâng Cao",
  };

  const levelText = levelMap[course.level] || course.level;

  return `
    <div class="course-card" data-level="${course.level}" data-category="${course.category}">
      <div class="course-image">
        <img src="${course.image}" alt="${course.title}" loading="lazy" />
        <div class="course-tag">${categoryIcon} ${categoryName}</div>
      </div>
      <div class="course-info">
        <h3>${course.title}</h3>
        <div class="skill-level">
          <span class="level ${course.level}">${levelText}</span>
        </div>
        <p class="line-clamp-2">${course.description}</p>
        <div class="course-meta">
          <span><i class="far fa-clock"></i> ${course.duration}</span>
          <span><i class="far fa-file-alt"></i> ${course.lessons} bài học</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" data-progress="0" data-course-id="${course.id}">
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
