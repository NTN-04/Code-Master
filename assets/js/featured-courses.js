import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import progressManager from "./progress-manager.js";
import loadingSkeleton from "./utils/loading-skeleton.js";
import { getUserEnrollments } from "./utils/enrollment.js";

document.addEventListener("DOMContentLoaded", function () {
  onAuthStateChanged(auth, async (user) => {
    await loadFeaturedCourses(user);
  });

  // khởi tạo đồng bộ tiến trình
  progressManager.initAuth();
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
    // Khởi tạo progress bar từ firebase
    progressManager.initProgressBars();
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
  const buttonClass = isEnrolled ? "btn btn-primary" : "btn btn-secondary";
  const buttonText = isEnrolled ? "Tiếp tục học" : "Xem chi tiết";

  // Badge cho khóa học nổi bật
  const featuredBadge = course.featured
    ? '<div class="featured-badge"><i class="fas fa-star"></i> Nổi bật</div>'
    : "";
  return `
    <div class="course-card">
      ${featuredBadge}
      <div class="course-image">
        <a href="${introUrl}">
          <img src="${course.image}" alt="${course.title}" loading="lazy" />
        </a>
      </div>
      <div class="course-info">
        <a href="${introUrl}"><h3>${course.title}</h3></a>
        <div class="skill-level">
          <span class="level ${course.level}">${levelText}</span>
        </div>
        <p class="line-clamp-2">${course.description}</p>
        <div class="progress-container">
          <div class="progress-bar" data-progress="0" data-course-id="${course.id}">
            <div class="progress"></div>
          </div>
          <span class="progress-text">0% Hoàn Thành</span>
        </div>
        <a href="${buttonHref}" class="${buttonClass}">${buttonText}</a>
      </div>
    </div>
  `;
}
