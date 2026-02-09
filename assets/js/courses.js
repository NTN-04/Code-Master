import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
// import progressManager from "./progress-manager.js"; // Đã loại bỏ thanh tiến trình khỏi card
import { cacheManager, CACHE_KEYS } from "./utils/cache-manager.js";
import loadingSkeleton from "./utils/loading-skeleton.js";
import { getUserEnrollments } from "./utils/enrollment.js";

// Chức năng trang khóa học
document.addEventListener("DOMContentLoaded", function () {
  // Theo dõi trạng thái đăng nhập để đồng bộ CTA thông minh
  onAuthStateChanged(auth, async (user) => {
    await loadCoursesFromDatabase(user);
  });

  // Khởi tạo bộ lọc khóa học (sẽ chạy sau khi tải xong dữ liệu)
  initCourseFiltering();
});

// Tải khóa học từ Firebase Realtime Database
async function loadCoursesFromDatabase(user) {
  const coursesGrid = document.querySelector(".courses-grid");
  if (!coursesGrid) return;

  try {
    // Hiển thị loading
    showCoursesLoading();

    // Lấy dữ liệu khóa học, danh mục và trạng thái ghi danh song song
    const [enrolledCourses, coursesSnapshot, categoriesSnapshot] =
      await Promise.all([
        getUserEnrollments(user?.uid),
        get(ref(database, "courses")),
        get(ref(database, "categories")),
      ]);

    if (coursesSnapshot.exists()) {
      const coursesData = coursesSnapshot.val();
      const categoriesData = categoriesSnapshot.exists()
        ? categoriesSnapshot.val()
        : {};

      // Render khóa học
      await renderCourses(coursesData, categoriesData, enrolledCourses);
    } else {
      showNoCoursesMessage();
      loadingSkeleton.hide(coursesGrid);
    }
  } catch (error) {
    console.error("Lỗi khi tải khóa học:", error);
    showErrorMessage();
    loadingSkeleton.hide(coursesGrid);
  }
}

// Hiển thị skeleton loading cho khóa học
function showCoursesLoading() {
  const coursesGrid = document.querySelector(".courses-grid");
  if (coursesGrid) {
    loadingSkeleton.showCourses(coursesGrid, 6);
  }
}

// Render khóa học từ dữ liệu database
async function renderCourses(
  coursesData,
  categoriesData,
  enrolledCourses = new Set()
) {
  const coursesGrid = document.querySelector(".courses-grid");
  if (!coursesGrid) return;

  // Convert object to array và sắp xếp
  const coursesArray = Object.values(coursesData).sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  coursesGrid.innerHTML = coursesArray
    .map((course) => createCourseCard(course, categoriesData, enrolledCourses))
    .join("");

  // Remove loading state để enable interaction
  loadingSkeleton.hide(coursesGrid);
}

// Tạo HTML cho một thẻ khóa học - Modern E-commerce Style
function createCourseCard(course, categoriesData, enrolledCourses) {
  const category = categoriesData[course.category] || {};
  const categoryName = category.name || course.category;
  const categoryIcon = category.icon || "📚";
  const introUrl = `course-intro.html?id=${course.id}`;
  const isEnrolled = enrolledCourses.has(course.id);
  const buttonHref = isEnrolled
    ? `course-detail.html?id=${course.id}`
    : introUrl;
  const buttonClass = isEnrolled ? "btn-cta enrolled" : "btn-cta";
  const buttonText = isEnrolled ? "Tiếp tục học" : "Xem chi tiết";
  const buttonIcon = isEnrolled ? "fa-play-circle" : "fa-arrow-right";
  const prefetchAttr = isEnrolled
    ? ""
    : ` onmouseenter="prefetchCourseData('${course.id}')"`;

  // Map level sang tiếng Việt
  const levelMap = {
    beginner: "Người Mới",
    intermediate: "Trung Cấp",
    advanced: "Nâng Cao",
  };
  const levelText = levelMap[course.level] || course.level;

  // Tính toán giá và giảm giá
  const price = Number(course.price) || 0;
  const originalPrice = Number(course.originalPrice) || 0;
  const hasDiscount = originalPrice > price && price > 0;
  const discountPercent = hasDiscount
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  // Format giá tiền
  const formatPrice = (value) => value.toLocaleString("vi-VN");

  // Render phần giá
  let priceHTML = "";
  if (price === 0) {
    priceHTML = `
      <div class="course-pricing">
        <span class="price-free">Miễn phí</span>
      </div>
    `;
  } else if (hasDiscount) {
    priceHTML = `
      <div class="course-pricing has-discount">
        <div class="price-wrapper">
          <span class="price-original">${formatPrice(originalPrice)}đ</span>
          <span class="price-current">${formatPrice(price)}đ</span>
        </div>
        <span class="discount-badge">-${discountPercent}%</span>
      </div>
    `;
  } else {
    priceHTML = `
      <div class="course-pricing">
        <span class="price-current">${formatPrice(price)}đ</span>
      </div>
    `;
  }

  // Thêm data attributes cho filtering
  const isFree = price === 0;
  const hasSale = hasDiscount;
  const isFeatured = !!course.featured;

  return `
    <div class="course-card" data-level="${course.level}" data-category="${course.category}" data-featured="${isFeatured}" data-free="${isFree}" data-sale="${hasSale}">
      <div class="course-image">
        <a href="${introUrl}">
          <img src="${course.image}" alt="${course.title}" loading="lazy" />
        </a>
        <div class="course-category">${categoryIcon} ${categoryName}</div>
        ${course.featured ? `<div class="course-featured"><i class="fa-solid fa-fire"></i></div>` : ""}
      </div>
      <div class="course-content">
        <a href="${introUrl}" class="course-title-link"><h3 class="course-title">${course.title}</h3></a>
        <div class="course-meta">
          <span class="level-badge ${course.level}">${levelText}</span>
          <div class="meta-info">
            <span><i class="far fa-clock"></i> ${course.duration}</span>
            <span><i class="far fa-file-alt"></i> ${course.lessons} bài</span>
          </div>
        </div>
        ${priceHTML}
        <a href="${buttonHref}" class="${buttonClass}"${prefetchAttr}>
          <i class="fas ${buttonIcon}"></i>
          ${buttonText}
        </a>
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
  const typeFilter = document.getElementById("filter-type");

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
    const typeValue = typeFilter ? typeFilter.value : "all";

    let visibleCount = 0;

    courseCards.forEach((card) => {
      const title = card.querySelector("h3")?.textContent.toLowerCase() || "";
      const level = card.getAttribute("data-level");
      const category = card.getAttribute("data-category");
      const isFeatured = card.getAttribute("data-featured") === "true";
      const isFree = card.getAttribute("data-free") === "true";
      const hasSale = card.getAttribute("data-sale") === "true";

      // Kiểm tra điều kiện lọc
      const matchesSearch = title.includes(searchTerm);
      const matchesLevel = levelValue === "all" || level === levelValue;
      const matchesCategory = categoryValue === "all" || category === categoryValue;
      
      // Kiểm tra loại khóa học
      let matchesType = true;
      if (typeValue === "featured") matchesType = isFeatured;
      else if (typeValue === "sale") matchesType = hasSale;
      else if (typeValue === "free") matchesType = isFree;
      else if (typeValue === "paid") matchesType = !isFree;

      // Hiển thị hoặc ẩn thẻ
      if (matchesSearch && matchesLevel && matchesCategory && matchesType) {
        card.style.display = "flex";
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
  if (typeFilter) {
    typeFilter.addEventListener("change", filterCourses);
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

// Prefetch course data khi hover vào nút
window.prefetchCourseData = async function (courseId) {
  // Chỉ prefetch nếu chưa có cache
  if (!cacheManager.has(CACHE_KEYS.COURSE_DATA(courseId))) {
    try {
      console.log("Prefetching course:", courseId);

      // Load song song để nhanh
      const [courseSnapshot, modulesSnapshot] = await Promise.all([
        get(ref(database, `courses/${courseId}`)),
        get(ref(database, `course_modules/${courseId}`)),
      ]);

      if (courseSnapshot.exists()) {
        const courseData = courseSnapshot.val();
        const modulesData = modulesSnapshot.exists()
          ? modulesSnapshot.val()
          : {};

        // Cache data
        cacheManager.set(CACHE_KEYS.COURSE_DATA(courseId), courseData);
        cacheManager.set(CACHE_KEYS.COURSE_MODULES(courseId), modulesData);

        console.log("Prefetch complete for:", courseId);
      }
    } catch (error) {
      console.warn("Prefetch failed:", error);
      // Không hiển thị lỗi cho user
    }
  }
};
