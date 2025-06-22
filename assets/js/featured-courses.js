import { database } from "./firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import progressManager from "./progress-manager.js";

document.addEventListener("DOMContentLoaded", function () {
  loadFeaturedCourses();

  // khởi tạo đồng bộ tiến trình
  progressManager.initAuth();
});

async function loadFeaturedCourses() {
  const grid = document.getElementById("featured-courses-grid");
  if (!grid) return;

  // loading skeleton cho course-card
  let skeletonHTML = "";
  for (let i = 0; i < 3; i++) {
    skeletonHTML += `
      <div class="skeleton skeleton-card">  
      </div>
    `;
  }
  grid.innerHTML = skeletonHTML;

  try {
    const coursesRef = ref(database, "courses");
    const snapshot = await get(coursesRef);

    // thông báo k có khóa học nổi bật
    if (!snapshot.exists()) {
      grid.innerHTML = `
      <div class="no-courses-message">
        <i class="fas fa-graduation-cap"></i>
        <h3>Chưa có khóa học nào nổi bật.</h3>
      </div>
      `;
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
      return;
    }

    // render
    grid.innerHTML = courses.map(createFeaturedCourseCard).join("");
    // Khởi tạo progress bar từ firebase
    progressManager.initProgressBars();
  } catch (err) {
    grid.innerHTML = `<div class="error-message">Không thể tải khóa học nổi bật.</div>`;
    console.error(err);
  }
}

function createFeaturedCourseCard(course) {
  // Map level sang tiếng Việt
  const levelMap = {
    beginner: "Người Mới",
    intermediate: "Trung Cấp",
    advanced: "Nâng Cao",
  };
  const levelText = levelMap[course.level] || course.level;

  // Badge cho khóa học nổi bật
  const featuredBadge = course.featured
    ? '<div class="featured-badge"><i class="fas fa-star"></i> Nổi bật</div>'
    : "";
  return `
    <div class="course-card">
      ${featuredBadge}
      <div class="course-image">
        <img src="${course.image}" alt="${course.title}" loading="lazy" />
      </div>
      <div class="course-info">
        <h3>${course.title}</h3>
        <div class="skill-level">
          <span class="level ${course.level}">${levelText}</span>
        </div>
        <p>${course.description}</p>
        <div class="progress-container">
          <div class="progress-bar" data-progress="0" data-course-id="${
            course.id
          }">
            <div class="progress"></div>
          </div>
          <span class="progress-text">0% Hoàn Thành</span>
        </div>
        <a href="${startCourse(
          course.id
        )}" class="btn btn-primary">Bắt Đầu Học</a>
      </div>
    </div>
  `;
}
// Khi click nút bắt đầu học
function startCourse(courseId) {
  return `course-detail.html?id=${courseId}`;
}
