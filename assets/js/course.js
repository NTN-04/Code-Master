import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Các phần tử DOM cho trang khóa học
document.addEventListener("DOMContentLoaded", async function () {
  const courseId = getCourseIdFromUrl();
  const modules = await fetchCourseModules(courseId);
  renderSidebar(modules);

  updateCourseMeta(modules);

  // Khởi tạo chức năng thu gọn/mở rộng module
  initModuleToggles();

  // Khởi tạo điều hướng bài học
  initLessonNavigation();

  // Khởi tạo theo dõi tiến trình học
  initCourseProgress();
});

// Khởi tạo chức năng thu gọn/mở rộng danh sách bài học trong module
function initModuleToggles() {
  const moduleHeaders = document.querySelectorAll(".module-header");

  moduleHeaders.forEach((header) => {
    const moduleId = header.getAttribute("data-toggle");
    const lessonList = document.getElementById(moduleId);

    // Kiểm tra lessonList tồn tại
    if (!lessonList) return;

    // Thiết lập trạng thái ban đầu
    header.setAttribute("aria-expanded", "false");
    lessonList.classList.remove("expanded");

    // Thêm sự kiện click
    header.addEventListener("click", () => {
      const expanded = header.getAttribute("aria-expanded") === "true";

      // Đảo trạng thái
      header.setAttribute("aria-expanded", !expanded);

      if (expanded) {
        lessonList.classList.remove("expanded");
      } else {
        lessonList.classList.add("expanded");
      }
    });
  });

  // Mở module đầu tiên mặc định
  if (moduleHeaders.length > 0) {
    const firstHeader = moduleHeaders[0];
    const firstModuleId = firstHeader.getAttribute("data-toggle");
    const firstLessonList = document.getElementById(firstModuleId);

    // Kiểm tra firstLessonList tồn tại
    if (firstLessonList) {
      firstHeader.setAttribute("aria-expanded", "true");
      firstLessonList.classList.add("expanded");
    }
  }
}

// Khởi tạo điều hướng bài học
function initLessonNavigation() {
  const lessonLinks = document.querySelectorAll(".lesson-link");
  const startCourseBtn = document.getElementById("start-course");

  if (startCourseBtn) {
    startCourseBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // xác thực
      if (!auth.currentUser) {
        window.location.href = "/login.html";
        return;
      }

      if (lessonLinks.length > 0) {
        const firstLesson = lessonLinks[0];
        activateLesson(firstLesson.getAttribute("data-lesson"));
        firstLesson.classList.add("active");
      }
    });
  }

  lessonLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      // kiểm tra xác thực
      if (!auth.currentUser) {
        window.location.href = "/login.html";
        return;
      }
      lessonLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      activateLesson(link.getAttribute("data-lesson"));
    });
  });
}

// Hàm xử lý sự kiện next/prev
function initLessonNavButtons() {
  const prevBtn = document.querySelector(".prev-lesson");
  const nextBtn = document.querySelector(".next-lesson");

  if (prevBtn) {
    prevBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const prevId = prevBtn.getAttribute("data-prev");
      if (prevId) activateLesson(prevId);
      // Cập nhật trạng thái active cho sidebar
      setActiveLessonLink(prevId);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const nextId = nextBtn.getAttribute("data-next");
      if (nextId) activateLesson(nextId);
      setActiveLessonLink(nextId);
    });
  }
}

function setActiveLessonLink(lessonId) {
  const lessonLinks = document.querySelectorAll(".lesson-link");
  lessonLinks.forEach((l) => l.classList.remove("active"));
  const activeLink = document.querySelector(
    `.lesson-link[data-lesson="${lessonId}"]`
  );
  if (activeLink) activeLink.classList.add("active");
}

// Tải và hiển thị nội dung bài học
async function activateLesson(lessonId) {
  // Kiểm tra đăng nhập trước khi cho học
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  const courseId = getCourseIdFromUrl();
  const modules = await fetchCourseModules(courseId);

  // Tìm lesson theo id
  let foundLesson = null;
  Object.values(modules).forEach((module) => {
    const lesson = module.lessons.find((l) => l.id === lessonId);
    if (lesson) foundLesson = lesson;
  });

  const lessonContainer = document.querySelector(".lesson-container");
  if (lessonContainer) {
    if (foundLesson) {
      lessonContainer.innerHTML = renderLessonContent(foundLesson, modules);
      initQuizEvents(foundLesson);
      initLessonNavButtons();
      trackLessonProgress(lessonId);
    } else {
      lessonContainer.innerHTML =
        "<div class='alert alert-warning'>Không tìm thấy bài học.</div>";
    }
  }
}

// Lấy động courseID từ URL
function getCourseIdFromUrl() {
  // Lấy tên file, ví dụ: html-css.html
  const path = window.location.pathname;
  const fileName = path.substring(path.lastIndexOf("/") + 1);
  // Lấy phần trước .html
  return fileName.replace(".html", "");
}

// Đánh dấu tiến trình học bài
function trackLessonProgress(lessonId) {
  // Lấy liên kết bài học để đánh dấu đã hoàn thành
  const lessonLink = document.querySelector(
    `.lesson-link[data-lesson="${lessonId}"]`
  );

  if (lessonLink) {
    // Đánh dấu đã hoàn thành trên UI
    lessonLink.classList.add("completed");

    // Đổi icon check
    const checkIcon = lessonLink.querySelector(".lesson-check i");
    if (checkIcon) {
      checkIcon.classList.remove("fa-circle");
      checkIcon.classList.add("fa-check-circle");
    }

    // Lưu tiến trình
    const courseId = getCourseIdFromUrl(); // Thực tế sẽ lấy động
    saveLessonCompletionToDB(courseId, lessonId);
  }
}

// Lưu trạng thái hoàn thành bài học vào Firebase cho từng khóa học
async function saveLessonCompletionToDB(courseId, lessonId) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login.html";
        return;
      }
      try {
        // Lấy danh sách bài học đã hoàn thành từ DB
        const progressRef = ref(
          database,
          `userProgress/${user.uid}/courses/${courseId}/completedLessons`
        );
        const snapshot = await get(progressRef);
        let completedLessons = [];

        if (snapshot.exists()) {
          completedLessons = snapshot.val();
        }
        // Thêm bài học nếu chưa có
        if (!completedLessons.includes(lessonId)) {
          completedLessons.push(lessonId);
        }

        // Cập nhật bài học đã hoàn thành lên DB
        await set(progressRef, completedLessons);

        // Tính phần trăm hoàn thành và cập nhật
        const totalLessons = document.querySelectorAll(".lesson-link").length;
        const progressPercentage =
          totalLessons > 0
            ? Math.round((completedLessons.length / totalLessons) * 100)
            : 0;

        // cập nhật progress
        const percentRef = ref(
          database,
          `userProgress/${user.uid}/courses/${courseId}/progress`
        );
        await set(percentRef, progressPercentage);

        // cập nhật thời gian truy cập lần cuối
        const lastAccessedRef = ref(
          database,
          `userProgress/${user.uid}/courses/${courseId}/lastAccessed`
        );
        await set(lastAccessedRef, new Date().toISOString());

        // Cập nhật thời gian lần đầu học
        const firstAccessedRef = ref(
          database,
          `userProgress/${user.uid}/courses/${courseId}/firstAccessed`
        );
        const firstSnap = await get(firstAccessedRef);
        if (!firstSnap.exists()) {
          await set(firstAccessedRef, new Date().toISOString());
        }
        // Cập nhật UI
        updateProgressUI(progressPercentage);

        resolve(progressPercentage);
      } catch (err) {
        console.error("Chi tiết lỗi khi lưu tiến trình:", err);
        reject(err);
      }
    });
  });
}

// Khởi tạo tiến trình học từ dữ liệu đã lưu khi load trang
async function initCourseProgress() {
  const courseId = getCourseIdFromUrl();
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const progressRef = ref(
        database,
        `userProgress/${user.uid}/courses/${courseId}/completedLessons`
      );
      const snapshot = await get(progressRef);
      let completedLessons = [];
      if (snapshot.exists()) {
        completedLessons = snapshot.val();
      }
      completedLessons.forEach((lessonId) => {
        const lessonLink = document.querySelector(
          `.lesson-link[data-lesson="${lessonId}"]`
        );
        if (lessonLink) {
          lessonLink.classList.add("completed");
          const checkIcon = lessonLink.querySelector(".lesson-check i");
          if (checkIcon) {
            checkIcon.classList.remove("fa-circle");
            checkIcon.classList.add("fa-check-circle");
          }
        }
      });
      // Lấy phần trăm hoàn thành từ DB
      const percentRef = ref(
        database,
        `userProgress/${user.uid}/courses/${courseId}/progress`
      );
      const percentSnap = await get(percentRef);
      let progressPercentage = 0;
      if (percentSnap.exists()) {
        progressPercentage = percentSnap.val();
      }
      // cập nhật UI
      updateProgressUI(progressPercentage);
    } catch (err) {
      console.error("Lỗi khi tải tiến trình từ server:", err);
    }
  });
}

// Cập nhật tiến trình tổng thể của khóa học
function updateProgressUI(progressPercentage) {
  const progressBar = document.getElementById("course-main-progress");
  if (progressBar) {
    const progressElement = progressBar.querySelector(".progress");
    const progressText = progressBar.nextElementSibling;
    if (progressElement && progressText) {
      progressElement.style.width = `${progressPercentage}%`;
      progressText.textContent = `${progressPercentage}% Hoàn Thành`;
    }
  }
}

// Lấy dữ liệu module cho courseId
async function fetchCourseModules(courseId) {
  const modulesRef = ref(database, `course_modules/${courseId}`);
  const snap = await get(modulesRef);
  return snap.exists() ? snap.val() : {};
}

// Render sidebar từ courses_module
function renderSidebar(modules) {
  const sidebar = document.querySelector(".module-list ul");
  if (!sidebar) return;
  sidebar.innerHTML = Object.entries(modules)
    .map(
      ([moduleKey, module]) => `
      <li class="module">
        <div class="module-header" data-toggle="${moduleKey}">
          <span class="module-title">${module.title}</span>
          <span class="module-toggle"><i class="fas fa-chevron-down"></i></span>
        </div>
        <ul class="lesson-list" id="${moduleKey}">
          ${module.lessons
            .map(
              (lesson) => `
            <li class="lesson">
              <a href="#" class="lesson-link" data-lesson="${lesson.id}">
                <span class="lesson-check"><i class="far fa-circle"></i></span>
                <span class="lesson-title">${lesson.title}</span>
                <span class="lesson-duration">${lesson.duration || ""}</span>
              </a>
            </li>
          `
            )
            .join("")}
        </ul>
      </li>
    `
    )
    .join("");
}

// Render nội dung bài học, video và quiz
function renderLessonContent(lesson, modules) {
  // Tìm vị trí bài học hiện tại trong modules
  let prevLessonId = null;
  let nextLessonId = null;
  let lessonsFlat = [];
  Object.values(modules).forEach((module) => {
    module.lessons.forEach((l) => lessonsFlat.push(l));
  });
  for (let i = 0; i < lessonsFlat.length; i++) {
    if (lessonsFlat[i].id === lesson.id) {
      if (i > 0) prevLessonId = lessonsFlat[i - 1].id;
      if (i < lessonsFlat.length - 1) nextLessonId = lessonsFlat[i + 1].id;
      break;
    }
  }

  return `
    <div class="lesson-content" id="lesson-${lesson.id}">
      <h2>${lesson.title}</h2>
      <div class="lesson-video">
        ${lesson.video ? renderVideo(lesson.video) : ""}
      </div>
      <div class="lesson-text">
        <p>${escapeHtml(lesson.content)}</p>
        ${
          lesson.quiz && lesson.quiz.length
            ? renderQuiz(lesson.quiz, lesson.id)
            : ""
        }
      </div>
       <div class="lesson-navigation">
        ${
          prevLessonId
            ? `<a href="#" class="btn btn-secondary prev-lesson" data-prev="${prevLessonId}">Bài Trước</a>`
            : ""
        }
        ${
          nextLessonId
            ? `<a href="#" class="btn btn-primary next-lesson" data-next="${nextLessonId}">Bài Tiếp Theo</a>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderVideo(videoUrl) {
  if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
    return `<iframe width="853" height="480" src="${videoUrl}" frameborder="0" allowfullscreen></iframe>`;
  }
  return `<video controls width="853"><source src="${videoUrl}" type="video/mp4"></video>`;
}

function renderQuiz(quiz, lessonId) {
  return `
    <div class="quiz-section" data-lesson="${lessonId}">
      <h3>Câu hỏi trắc nghiệm</h3>
      ${quiz
        .map(
          (q, idx) => `
        <div class="quiz-question" data-qidx="${idx}">
          <h4>${q.question}</h4>
          <div class="quiz-options">
            ${q.options
              .map(
                (opt, oidx) => `
              <label class="quiz-option">
                <input type="radio" name="quiz-${lessonId}-${idx}" value="${oidx}">
                <span>${escapeHtml(opt)}</span>
              </label>
            `
              )
              .join("")}
          </div>
          <div class="quiz-feedback"></div>
          <button class="btn btn-primary check-answer">Kiểm tra đáp án</button>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// Khởi tạo xử lý tương tác quiz và phản hồi
function initQuizEvents(lesson) {
  document
    .querySelectorAll(`.quiz-section[data-lesson="${lesson.id}"] .check-answer`)
    .forEach((btn, idx) => {
      btn.addEventListener("click", function () {
        const question = lesson.quiz[idx];
        const container = btn.closest(".quiz-question");
        const selected = container.querySelector("input[type='radio']:checked");
        const feedback = container.querySelector(".quiz-feedback");
        if (!selected) {
          feedback.textContent = "Vui lòng chọn đáp án!";
          feedback.className = "quiz-feedback";
          return;
        }
        if (parseInt(selected.value) === question.answer) {
          feedback.textContent = "Chính xác!";
          feedback.className = "quiz-feedback correct";
        } else {
          feedback.textContent = "Chưa đúng, hãy thử lại!";
          feedback.className = "quiz-feedback incorrect";
        }
      });
    });
}

// Cập nhật thông tin meta
async function updateCourseMeta(modules) {
  // Tính tổng số bài học và tổng thời lượng
  let totalLessons = 0;
  let totalMinutes = 0;
  Object.values(modules).forEach((module) => {
    module.lessons.forEach((lesson) => {
      totalLessons++;
      // kiểm tra và lấy số phút và số giây từ duration bằng regex
      if (lesson.duration) {
        const match = lesson.duration.match(/(\d+)(?::(\d+))?/);
        if (match) {
          const m = parseInt(match[1]);
          const s = match[2] ? parseInt(match[2]) : 0;
          totalMinutes += m + Math.round(s / 60);
        }
      }
    });
  });

  // Chuyển phút thành giờ và phút
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let durationText = "";
  if (hours > 0) durationText += `${hours} giờ `;
  if (minutes > 0) durationText += `${minutes} `;
  if (!durationText) durationText = "0"; // 0 phút

  // Cập nhật số bài học
  const lessonsSpan = document.querySelector(".course-meta .lessons");
  if (lessonsSpan) {
    lessonsSpan.innerHTML = `<i class="far fa-file-alt"></i> ${totalLessons} bài học`;
  }

  // Cập nhật tổng thời lượng
  const durationSpan = document.querySelector(".course-meta .duration");
  if (durationSpan) {
    durationSpan.innerHTML = `<i class="far fa-clock"></i> ${durationText} phút`;
  }

  // Cập nhật title, description, level
  const courseId = getCourseIdFromUrl();
  const courseRef = ref(database, `courses/${courseId}`);
  try {
    const snap = await get(courseRef);
    if (snap.exists()) {
      const course = snap.val();
      // Cập nhật title
      const titleEl = document.querySelector(".course-info .course-info-title");
      if (titleEl && course.title) titleEl.textContent = course.title;
      // Cập nhật description
      const descEl = document.querySelector(".course-info p");
      if (descEl && course.description) descEl.textContent = course.description;
      // Cập nhật level
      const levelEl = document.querySelector(".course-meta .level");
      if (levelEl && course.level) {
        levelEl.textContent =
          course.level === "beginner"
            ? "Người Mới"
            : course.level === "intermediate"
            ? "Trung Cấp"
            : course.level === "advanced"
            ? "Nâng Cao"
            : course.level;
        levelEl.className = `level ${course.level}`;
      }
    }
  } catch (err) {
    console.error("Lỗi khi lấy thông tin course:", err);
  }
}

// biến đổi ký tự html
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
