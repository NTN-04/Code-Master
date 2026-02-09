import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
// import progressManager from "./progress-manager.js"; // Đã loại bỏ thanh tiến trình khỏi card
import loadingSkeleton from "./utils/loading-skeleton.js";
import { getUserEnrollments } from "./utils/enrollment.js";

document.addEventListener("DOMContentLoaded", function () {
  onAuthStateChanged(auth, async (user) => {
    await loadFeaturedCourses(user);
  });
});

async function loadFeaturedCourses(user) {
  const grid = document.getElementById("featured-courses-grid");
  if (!grid) return;

  // Hiển thị skeleton loading
  loadingSkeleton.showCourses(grid, 3);

  try {
    const [enrolledCourses, snapshot] = await Promise.all([
      getUserEnrollments(user?.uid),
      get(ref(database, "courses")),
    ]);

    // thông báo k có khóa học nổi bật
    if (!snapshot.exists()) {
      grid.innerHTML = `
      <div class="no-courses-message">
        <i class="fas fa-graduation-cap"></i>
        <h3>Chưa có khóa học nào nổi bật.</h3>
      </div>
      `;
      loadingSkeleton.hide(grid);
      return;
    }

    // Lọc và sắp xếp các course có thuộc tính feature trong db
    const courses = Object.values(snapshot.val())
      .filter((c) => c.featured)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3); // Hiển thị tối đa 3 khóa học nổi bật

    if (courses.length === 0) {
      grid.innerHTML = `
      <div class="no-courses-message">
        <i class="fas fa-graduation-cap"></i>
        <h3>Chưa có khóa học nào nổi bật.</h3>
      </div>
      `;
      loadingSkeleton.hide(grid);
      return;
    }

    // render
    grid.innerHTML = courses
      .map((course) => createFeaturedCourseCard(course, enrolledCourses))
      .join("");
    // Remove loading state để enable interaction
    loadingSkeleton.hide(grid);
  } catch (err) {
    grid.innerHTML = `<div class="error-message">Không thể tải khóa học nổi bật.</div>`;
    loadingSkeleton.hide(grid);
    console.error(err);
  }
}

function createFeaturedCourseCard(course, enrolledCourses) {
  // Map level sang tiếng Việt
  const levelMap = {
    beginner: "Người Mới",
    intermediate: "Trung Cấp",
    advanced: "Nâng Cao",
  };
  const levelText = levelMap[course.level] || course.level;
  const introUrl = `course-intro.html?id=${course.id}`;
  const isEnrolled = enrolledCourses.has(course.id);
  const buttonHref = isEnrolled
    ? `course-detail.html?id=${course.id}`
    : introUrl;
  const buttonClass = isEnrolled ? "btn-cta enrolled" : "btn-cta";
  const buttonText = isEnrolled ? "Tiếp tục học" : "Xem chi tiết";
  const buttonIcon = isEnrolled ? "fa-play-circle" : "fa-arrow-right";

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

  return `
    <div class="course-card">
      <div class="course-image">
        <a href="${introUrl}">
          <img src="${course.image}" alt="${course.title}" loading="lazy" />
        </a>
        <div class="course-featured"><i class="fa-solid fa-fire"></i></div>
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
        <a href="${buttonHref}" class="${buttonClass}">
          <i class="fas ${buttonIcon}"></i>
          ${buttonText}
        </a>
      </div>
    </div>
  `;
}
