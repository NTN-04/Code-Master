import { database } from "./firebaseConfig.js";
import { auth } from "./firebaseConfig.js";
import {
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  showFloatingNotification as showNotification,
  createNotification,
  NOTIFICATION_TYPES,
} from "./utils/notifications.js";
import { sanitizeText } from "./utils/sanitize.js";
import { cacheManager, CACHE_KEYS } from "./utils/cache-manager.js";
import loadingSkeleton from "./utils/loading-skeleton.js";
// Payment imports
import { isPaidCourse, checkPurchaseStatus } from "./pay/payment-service.js";

// State Management
let currentCourseId = null;
let currentCourse = null; // Lưu thông tin khóa học để kiểm tra thanh toán
let currentUser = null;
let previousUserId = null; // Track user changes for security
let isEnrolled = false;
let isLoading = false; // Prevent multiple loads
let isDOMReady = false; // Track DOM ready state
let isSkeletonActive = false; // Ensure skeleton render trước nội dung

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  isDOMReady = true;

  // Get courseId from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentCourseId = urlParams.get("id");

  if (!currentCourseId) {
    showNotification("Không tìm thấy khóa học. Vui lòng thử lại.", "error");
    return;
  }

  // Hiển thị skeleton ngay khi DOM sẵn sàng để tránh flash nội dung thật
  showLoading();

  // Listen to auth state changes
  onAuthStateChanged(auth, async (user) => {
    if (previousUserId && user?.uid && user.uid !== previousUserId) {
      cacheManager.clearUserCache(previousUserId);
    }

    // Update tracking
    previousUserId = user?.uid || null;
    currentUser = user;

    // Only load data if DOM is ready
    if (isDOMReady) {
      await loadCourseData();
    }
  });
});

// Load course data from Firebase (with caching)
async function loadCourseData() {
  // Prevent multiple simultaneous loads
  if (isLoading) return;
  isLoading = true;

  try {
    // Check cache first
    const cachedCourse = cacheManager.get(
      CACHE_KEYS.COURSE_DATA(currentCourseId),
    );
    const cachedModules = cacheManager.get(
      CACHE_KEYS.COURSE_MODULES(currentCourseId),
    );

    // If cache exists, render immediately (fast)
    if (cachedCourse && cachedModules) {
      // Set currentCourse để kiểm tra thanh toán
      currentCourse = cachedCourse;

      // Render from cache first for instant display (no loading needed)
      if (currentUser) {
        await checkEnrollmentStatus();
      }
      renderCourseIntro(cachedCourse, cachedModules);
      hideLoading();
      isLoading = false;

      // Refresh data in background (optional)
      refreshDataInBackground();
      return;
    }

    // Show skeleton loading ONLY when fetching fresh data
    showLoading();

    // Fetch fresh data - Load song song để nhanh hơn
    const [courseSnapshot, modulesSnapshot] = await Promise.all([
      get(ref(database, `courses/${currentCourseId}`)),
      get(ref(database, `course_modules/${currentCourseId}`)),
    ]);

    if (!courseSnapshot.exists()) {
      showNotification("Khóa học không tồn tại.", "error");
      hideLoading();
      isLoading = false;
      return;
    }

    const courseData = courseSnapshot.val();
    const modulesData = modulesSnapshot.exists() ? modulesSnapshot.val() : {};

    // Lưu course data để kiểm tra thanh toán
    currentCourse = courseData;

    // Cache data for next visit
    cacheManager.set(CACHE_KEYS.COURSE_DATA(currentCourseId), courseData);
    cacheManager.set(CACHE_KEYS.COURSE_MODULES(currentCourseId), modulesData);

    // Check enrollment status
    if (currentUser) {
      await checkEnrollmentStatus();
    }

    // Render course intro
    renderCourseIntro(courseData, modulesData);

    // Hide loading, show content
    hideLoading();
  } catch (error) {
    console.error("❌ Error loading course data:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      courseId: currentCourseId,
      hasUser: !!currentUser,
    });

    showNotification(
      "Không thể tải dữ liệu khóa học. Vui lòng thử lại.",
      "error",
    );
    hideLoading();
  } finally {
    isLoading = false;
  }
}

// Refresh data in background (silent update)
async function refreshDataInBackground() {
  try {
    const [courseSnapshot, modulesSnapshot] = await Promise.all([
      get(ref(database, `courses/${currentCourseId}`)),
      get(ref(database, `course_modules/${currentCourseId}`)),
    ]);

    if (courseSnapshot.exists()) {
      const courseData = courseSnapshot.val();
      const modulesData = modulesSnapshot.exists() ? modulesSnapshot.val() : {};

      // Update cache silently
      cacheManager.set(CACHE_KEYS.COURSE_DATA(currentCourseId), courseData);
      cacheManager.set(CACHE_KEYS.COURSE_MODULES(currentCourseId), modulesData);
    }
  } catch (error) {
    console.warn("Background refresh failed:", error);
    // Không hiển thị lỗi cho user vì đây là background operation
  }
}

// Check if user is enrolled (with caching)
async function checkEnrollmentStatus() {
  try {
    // Check cache first
    const cacheKey = CACHE_KEYS.ENROLLMENT_STATUS(
      currentUser.uid,
      currentCourseId,
    );
    const cachedStatus = cacheManager.get(cacheKey);

    if (cachedStatus !== null) {
      isEnrolled = cachedStatus;
      return;
    }

    // Fetch from database
    const enrollmentRef = ref(
      database,
      `enrollments/${currentUser.uid}/${currentCourseId}`,
    );
    const snapshot = await get(enrollmentRef);
    isEnrolled = snapshot.exists();

    // Cache result
    cacheManager.set(cacheKey, isEnrolled);
  } catch (error) {
    console.error("Error checking enrollment:", error);
    isEnrolled = false;
  }
}

// Render course introduction
function renderCourseIntro(course, modules) {
  // Update page title
  document.title = `${course.title} | CodeMaster`;

  // === MAIN CONTENT ===
  document.getElementById("course-title").textContent = course.title;

  const levelMap = {
    beginner: "Người mới",
    intermediate: "Trung cấp",
    advanced: "Nâng cao",
  };
  const levelBadge = document.getElementById("course-level");
  levelBadge.textContent = levelMap[course.level] || course.level;
  levelBadge.className = `course-level-badge ${course.level}`;

  // Meta (duration, lessons)
  document.getElementById("course-duration").textContent =
    course.duration || "N/A";
  document.getElementById("course-lessons").textContent = `${
    course.lessons || 0
  } bài học`;

  // Short description
  document.getElementById("course-description-text").textContent =
    course.description || "";

  // Detailed description (Markdown)
  const detailedDescEl = document.getElementById("detailed-description");
  if (course.detailedDescription && typeof marked !== "undefined") {
    detailedDescEl.innerHTML = marked.parse(course.detailedDescription);
    detailedDescEl.style.display = "block";
  } else {
    detailedDescEl.style.display = "none";
  }

  // Learning outcomes
  renderLearningOutcomes(course.learningOutcomes || []);

  // Course modules
  renderCourseModules(modules);

  // Requirements
  renderRequirements(course.requirements || []);

  // === SIDEBAR ===
  // Thumbnail or Video
  const thumbnailWrapper = document.querySelector(".course-thumbnail-wrapper");
  thumbnailWrapper.innerHTML = "";

  if (course.videoIntro) {
    // Render video player with lazy loading
    const video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata"; // Chỉ tải metadata, không tải video đầy đủ
    video.poster = course.image;
    video.setAttribute("data-src", course.videoIntro); // Lazy load

    // Load video khi user click vào
    video.addEventListener(
      "click",
      function loadVideo() {
        if (!video.src) {
          video.src = video.getAttribute("data-src");
          video.load();
          video.play();
        }
      },
      { once: true },
    );

    thumbnailWrapper.appendChild(video);
  } else {
    // Render thumbnail image with lazy loading
    const img = document.createElement("img");
    img.alt = course.title;
    img.loading = "lazy"; // Native lazy loading
    img.src = course.image || "./assets/images/img-course/html-css.png";

    // Thêm placeholder khi đang load
    img.style.minHeight = "200px";
    img.style.backgroundColor = "#f0f0f0";

    thumbnailWrapper.appendChild(img);
  }

  // Price - hỗ trợ originalPrice và giảm giá
  const priceTag = document.getElementById("course-price");
  const originalPriceEl = document.getElementById("course-original-price");
  const discountBadge = document.getElementById("course-discount-badge");

  const price = Number(course.price) || 0;
  const originalPrice = Number(course.originalPrice) || 0;
  const hasDiscount = originalPrice > price && price > 0;

  if (price > 0) {
    priceTag.textContent = `${price.toLocaleString("vi-VN")} VNĐ`;
    priceTag.className = "price-tag";

    // Hiển thị giá gốc và badge giảm giá nếu có khuyến mãi
    if (hasDiscount && originalPriceEl && discountBadge) {
      const discountPercent = Math.round(
        ((originalPrice - price) / originalPrice) * 100,
      );
      originalPriceEl.textContent = `${originalPrice.toLocaleString("vi-VN")} VNĐ`;
      originalPriceEl.style.display = "inline";
      discountBadge.textContent = `-${discountPercent}%`;
      discountBadge.style.display = "inline";
    } else if (originalPriceEl && discountBadge) {
      originalPriceEl.style.display = "none";
      discountBadge.style.display = "none";
    }
  } else {
    priceTag.textContent = "Miễn phí";
    priceTag.className = "price-tag free";
    if (originalPriceEl) originalPriceEl.style.display = "none";
    if (discountBadge) discountBadge.style.display = "none";
  }

  // Sidebar info
  document.getElementById("sidebar-level").textContent =
    levelMap[course.level] || course.level;
  document.getElementById("sidebar-lessons").textContent = `${
    course.lessons || 0
  } bài`;
  document.getElementById("sidebar-duration").textContent =
    course.duration || "N/A";

  // Action button
  updateEnrollmentButton();
}

// Render learning outcomes
function renderLearningOutcomes(outcomes) {
  const outcomesList = document.getElementById("outcomes-list");
  const outcomesBox = document.querySelector(".learning-outcomes-box");
  outcomesList.innerHTML = "";

  if (!outcomes || outcomes.length === 0) {
    outcomesBox.style.display = "none";
    return;
  }

  outcomesBox.style.display = "block";

  outcomes.forEach((outcome) => {
    const div = document.createElement("div");
    div.className = "outcome-item";
    div.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span>${sanitizeText(outcome)}</span>
    `;
    outcomesList.appendChild(div);
  });
}

// Render course modules (chỉ xem, không click)
function renderCourseModules(modules) {
  const modulesList = document.getElementById("course-modules-list");
  const modulesBox = document.querySelector(".course-content-box");
  modulesList.innerHTML = "";

  if (!modules || Object.keys(modules).length === 0) {
    modulesBox.style.display = "none";
    return;
  }

  modulesBox.style.display = "block";

  // Sort modules by key (module1, module2, ...)
  const sortedModules = Object.entries(modules).sort(([keyA], [keyB]) => {
    const numA = parseInt(keyA.replace(/\D/g, ""), 10);
    const numB = parseInt(keyB.replace(/\D/g, ""), 10);
    return numA - numB;
  });

  sortedModules.forEach(([moduleId, moduleData]) => {
    const li = document.createElement("li");
    li.className = "module-item";

    const moduleNumber = moduleId.replace(/\D/g, "");
    const lessons = moduleData.lessons || [];
    const lessonCount = Array.isArray(lessons) ? lessons.length : 0;

    li.innerHTML = `
      <div class="module-header">
        <div class="module-title">
          <i class="fas fa-chevron-down module-toggle-icon"></i>
          <span>Chương ${moduleNumber}: ${sanitizeText(
            moduleData.title || "Chưa có tiêu đề",
          )}</span>
        </div>
        <div class="module-meta">${lessonCount} bài học</div>
      </div>
    `;

    // Preview lessons (chỉ tên, không link)
    if (lessonCount > 0) {
      const lessonsPreview = document.createElement("div");
      lessonsPreview.className = "lessons-preview";
      lessonsPreview.style.display = "none"; // Mặc định ẩn

      lessons.forEach((lesson, idx) => {
        const lessonItem = document.createElement("div");
        lessonItem.className = "lesson-preview-item";
        lessonItem.innerHTML = `
          <i class="fas fa-play-circle"></i>
          <span>${idx + 1}. ${sanitizeText(lesson.title || "Bài học")}</span>
        `;
        lessonsPreview.appendChild(lessonItem);
      });

      li.appendChild(lessonsPreview);

      // Add toggle functionality
      const moduleHeader = li.querySelector(".module-header");
      const toggleIcon = li.querySelector(".module-toggle-icon");

      moduleHeader.style.cursor = "pointer";
      moduleHeader.addEventListener("click", () => {
        const isExpanded = lessonsPreview.style.display === "block";

        if (isExpanded) {
          lessonsPreview.style.display = "none";
          toggleIcon.style.transform = "rotate(0deg)";
          li.classList.remove("expanded");
        } else {
          lessonsPreview.style.display = "block";
          toggleIcon.style.transform = "rotate(180deg)";
          li.classList.add("expanded");
        }
      });
    }

    modulesList.appendChild(li);
  });
}

// Render requirements
function renderRequirements(requirements) {
  const requirementsList = document.getElementById("requirements-list");
  const requirementsBox = document.querySelector(".requirements-box");
  requirementsList.innerHTML = "";

  if (!requirements || requirements.length === 0) {
    requirementsBox.style.display = "none";
    return;
  }

  requirementsBox.style.display = "block";

  requirements.forEach((req) => {
    const div = document.createElement("div");
    div.className = "requirement-item";
    div.innerHTML = `
      <i class="fas fa-arrow-right"></i>
      <span>${sanitizeText(req)}</span>
    `;
    requirementsList.appendChild(div);
  });
}

// Update enrollment button based on auth and enrollment status
function updateEnrollmentButton() {
  const button = document.getElementById("enrollment-button");

  if (!currentUser) {
    // Not logged in -> Redirect to login
    button.textContent = "Đăng nhập để học";
    button.className = "enrollment-button primary";
    button.href = "login.html";
    button.onclick = null;
  } else if (isEnrolled) {
    // Already enrolled -> Go to course detail
    button.textContent = "Vào học ngay";
    button.className = "enrollment-button enrolled";
    button.href = `course-detail.html?id=${currentCourseId}`;
    button.onclick = null;
  } else {
    // Not enrolled -> Check if paid course
    const isPaid = currentCourse && isPaidCourse(currentCourse);

    if (isPaid) {
      // Paid course -> Show "Mua ngay" with price
      const priceText = Number(currentCourse.price).toLocaleString("vi-VN");
      button.innerHTML = `<i class="fas fa-shopping-cart"></i> Mua ngay - ${priceText} VNĐ`;
      button.className = "enrollment-button primary paid";
    } else {
      // Free course -> Show "Đăng ký ngay"
      button.innerHTML = `<i class="fas fa-user-plus"></i> Đăng ký ngay`;
      button.className = "enrollment-button primary";
    }

    button.href = "#";
    button.onclick = (e) => {
      e.preventDefault();
      handleEnrollment();
    };
  }
}

// Handle enrollment
async function handleEnrollment() {
  if (!currentUser) {
    showNotification("Vui lòng đăng nhập để đăng ký khóa học.", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
    return;
  }

  if (isEnrolled) {
    // Already enrolled
    window.location.href = `course-detail.html?id=${currentCourseId}`;
    return;
  }

  try {
    // Show loading state on button
    const button = document.getElementById("enrollment-button");
    const originalText = button.textContent;
    button.textContent = "Đang xử lý...";
    button.disabled = true;

    // ============ KIỂM TRA KHÓA HỌC TRẢ PHÍ ============
    if (isPaidCourse(currentCourse)) {
      // Kiểm tra xem đã mua chưa
      const hasPurchased = await checkPurchaseStatus(
        currentUser.uid,
        currentCourseId,
      );

      if (!hasPurchased) {
        // Chưa mua -> Redirect đến trang thanh toán
        showNotification("Đang chuyển đến trang thanh toán...", "info");
        setTimeout(() => {
          window.location.href = `checkout.html?courseId=${currentCourseId}`;
        }, 1000);
        return;
      }
      // Đã mua -> Tiếp tục enroll như bình thường
    }
    // ============ END KIỂM TRA THANH TOÁN ============

    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error("User not authenticated");
    }

    // Get ID token to verify authentication
    await auth.currentUser.getIdToken(true);

    // Create enrollment record
    const enrollmentRef = ref(
      database,
      `enrollments/${currentUser.uid}/${currentCourseId}`,
    );

    const enrollmentData = {
      enrolledAt: new Date().toISOString(),
      status: "active",
      userId: currentUser.uid,
      courseId: currentCourseId,
      progress: 0,
      lastAccessed: new Date().toISOString(),
    };

    await set(enrollmentRef, enrollmentData);

    // Update state
    isEnrolled = true;

    // Clear enrollment cache to force refresh
    const cacheKey = CACHE_KEYS.ENROLLMENT_STATUS(
      currentUser.uid,
      currentCourseId,
    );
    cacheManager.remove(cacheKey);

    // Tạo thông báo đăng ký khóa học thành công
    try {
      await createNotification(currentUser.uid, {
        type: NOTIFICATION_TYPES.COURSE_ENROLLED,
        title: "Đăng ký khóa học thành công",
        message: `Bạn đã đăng ký thành công khóa học "${currentCourse?.title || "Khóa học mới"}". Bắt đầu học ngay nhé!`,
        link: `course-detail.html?id=${currentCourseId}`,
        data: {
          courseId: currentCourseId,
          courseName: currentCourse?.title,
        },
      });
    } catch (notifError) {
      console.warn("Không thể tạo thông báo:", notifError);
    }

    // Show success message
    showNotification("Đăng ký thành công! Chuyển hướng...", "success");

    // Redirect to course detail page
    setTimeout(() => {
      window.location.href = `course-detail.html?id=${currentCourseId}`;
    }, 1000);
  } catch (error) {
    console.error("Error enrolling:", error);

    // Specific error handling
    let errorMessage = "Lỗi khi đăng ký khóa học. Vui lòng thử lại.";

    if (
      error.code === "PERMISSION_DENIED" ||
      error.message.includes("PERMISSION_DENIED")
    ) {
      errorMessage =
        "Không có quyền truy cập. Vui lòng kiểm tra cấu hình Firebase hoặc đăng nhập lại.";
    } else if (error.message === "User not authenticated") {
      errorMessage = "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
    }

    showNotification(errorMessage, "error");

    // Restore button
    const button = document.getElementById("enrollment-button");
    button.textContent = "Đăng ký ngay";
    button.disabled = false;
  }
}

// Utility: Show loading state với skeleton
function showLoading() {
  const mainContent = document.getElementById("course-intro-main");
  const sidebarContent = document.getElementById("course-intro-sidebar");

  // Tránh render skeleton trùng lặp
  if (isSkeletonActive) return;

  // Hiển thị skeleton trong main và sidebar
  loadingSkeleton.showMainSidebar(mainContent, sidebarContent);
  isSkeletonActive = true;
}

// Utility: Hide loading state và show content
function hideLoading() {
  const mainContent = document.getElementById("course-intro-main");
  const sidebarContent = document.getElementById("course-intro-sidebar");

  // Xóa skeleton và hiển thị content
  loadingSkeleton.hide(mainContent);
  loadingSkeleton.hide(sidebarContent);

  if (mainContent) mainContent.style.display = "block";
  if (sidebarContent) sidebarContent.style.display = "block";

  isSkeletonActive = false;
}
