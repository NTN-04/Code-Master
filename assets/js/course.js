import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import CommentSystem from "./comment-system.js";
import { issueCertificate } from "./certificate-service.js";

// Các phần tử DOM cho trang khóa học
document.addEventListener("DOMContentLoaded", async function () {
  const courseId = getCourseIdFromUrl();
  const modules = await fetchCourseModules(courseId);
  renderSidebar(modules);

  updateCourseTitle();

  // Khởi tạo chức năng thu gọn/mở rộng module
  initModuleToggles();

  // Khởi tạo điều hướng bài học
  initLessonNavigation();

  // Khởi tạo theo dõi tiến trình học
  initCourseProgress();
});

// Biến lưu bộ nhớ đệm (cache)
const moduleCache = new Map();

// Lắng nghe sự kiện đăng xuất để xóa cache
onAuthStateChanged(auth, (user) => {
  if (!user) {
    moduleCache.clear();
  }
});

// Biến lưu hệ thống bình luận
let commentSystem = null;

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

  // Lưu bài học cuối cùng đã xem vào Firebase
  saveLastViewedLesson(courseId, lessonId);

  // Tìm lesson theo id
  let foundLesson = null;
  Object.values(modules).forEach((module) => {
    const lesson = (module.lessons || []).find((l) => l.id === lessonId);
    if (lesson) foundLesson = lesson;
  });

  const lessonContainer = document.querySelector(".lesson-container");
  if (lessonContainer) {
    if (foundLesson) {
      // Tìm prev/next lesson IDs
      let prevLessonId = null;
      let nextLessonId = null;
      let lessonsFlat = [];
      Object.values(modules).forEach((module) => {
        (module.lessons || []).forEach((l) => lessonsFlat.push(l));
      });
      for (let i = 0; i < lessonsFlat.length; i++) {
        if (lessonsFlat[i].id === foundLesson.id) {
          if (i > 0) prevLessonId = lessonsFlat[i - 1].id;
          if (i < lessonsFlat.length - 1) nextLessonId = lessonsFlat[i + 1].id;
          break;
        }
      }

      // Render video vào video-stage (new layout)
      renderVideoToStage(foundLesson.video);

      // Cập nhật footer navigation
      updateFooterNavigation(prevLessonId, nextLessonId);
      initFooterNavButtons();

      lessonContainer.innerHTML = renderLessonContent(foundLesson, modules);
      initQuizEvents(foundLesson);
      initLessonNavButtons();
      trackLessonProgress(lessonId);

      // Khởi tạo hệ thống bình luận cho bài học
      initCommentButton(lessonId);

      // Scroll content về đầu
      const mainScrollArea = document.querySelector(".main-scroll-area");
      if (mainScrollArea) mainScrollArea.scrollTop = 0;
    } else {
      lessonContainer.innerHTML =
        "<div class='alert alert-warning'>Không tìm thấy bài học.</div>";
    }
  }
}

// Lấy động courseID từ URL
function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
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
    const courseId = getCourseIdFromUrl();
    saveLessonCompletionToDB(courseId, lessonId);
  }
}

// Lưu trạng thái hoàn thành bài học vào Firebase cho từng khóa học
// Và tính toán để lưu tiến trình
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

      // Auto-focus vào bài học cuối cùng hoặc bài đầu tiên
      await autoFocusLesson(courseId, user.uid);
    } catch (err) {
      console.error("Lỗi khi tải tiến trình từ server:", err);
    }
  });
}

// === HÀM TỰ ĐỘNG FOCUS BÀI HỌC ===

// Lưu bài học cuối cùng đã xem vào Firebase
async function saveLastViewedLesson(courseId, lessonId) {
  const user = auth.currentUser;
  if (!user || !courseId || !lessonId) return;

  try {
    const lastViewedRef = ref(
      database,
      `userProgress/${user.uid}/courses/${courseId}/lastViewedLesson`
    );
    await set(lastViewedRef, {
      lessonId: lessonId,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Lỗi khi lưu bài học cuối cùng:", err);
  }
}

// Lấy bài học cuối cùng đã xem từ Firebase
async function getLastViewedLesson(courseId, userId) {
  try {
    const lastViewedRef = ref(
      database,
      `userProgress/${userId}/courses/${courseId}/lastViewedLesson`
    );
    const snapshot = await get(lastViewedRef);
    if (snapshot.exists()) {
      return snapshot.val().lessonId;
    }
    return null;
  } catch (err) {
    console.error("Lỗi khi lấy bài học cuối cùng:", err);
    return null;
  }
}

// Tự động focus vào bài học khi vào trang
async function autoFocusLesson(courseId, userId) {
  // Lấy bài học cuối cùng đã xem
  const lastLessonId = await getLastViewedLesson(courseId, userId);

  // Lấy danh sách tất cả bài học
  const allLessonLinks = document.querySelectorAll(".lesson-link");
  if (allLessonLinks.length === 0) return;

  let targetLessonId = null;

  if (lastLessonId) {
    // Kiểm tra bài học cuối cùng có tồn tại trong danh sách không
    const lastLessonLink = document.querySelector(
      `.lesson-link[data-lesson="${lastLessonId}"]`
    );
    if (lastLessonLink) {
      targetLessonId = lastLessonId;
    }
  }

  // Nếu không có bài học cuối hoặc không tìm thấy, focus vào bài đầu tiên
  if (!targetLessonId) {
    targetLessonId = allLessonLinks[0].getAttribute("data-lesson");
  }

  // Mở module chứa bài học target
  const targetLink = document.querySelector(
    `.lesson-link[data-lesson="${targetLessonId}"]`
  );
  if (targetLink) {
    // Tìm module chứa bài học
    const lessonList = targetLink.closest(".lesson-list");
    if (lessonList) {
      const moduleId = lessonList.id;
      const moduleHeader = document.querySelector(
        `.module-header[data-toggle="${moduleId}"]`
      );
      if (moduleHeader) {
        // Mở module này
        moduleHeader.setAttribute("aria-expanded", "true");
        lessonList.classList.add("expanded");
      }
    }

    // Đánh dấu active và kích hoạt bài học
    targetLink.classList.add("active");
    await activateLesson(targetLessonId);

    // Scroll sidebar để hiển thị bài học đang active
    setTimeout(() => {
      targetLink.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }
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

  // Cập nhật circular progress trong header
  updateHeaderProgress(progressPercentage);

  const certificateBtn = document.getElementById("certificate-button");
  if (certificateBtn) {
    if (progressPercentage === 100) {
      certificateBtn.classList.add("show");
      if (!certificateBtn.dataset.bound) {
        certificateBtn.addEventListener("click", async () => {
          const courseId = getCourseIdFromUrl();
          const titleEl = document.querySelector(
            ".course-info .course-info-title"
          );
          const courseTitle =
            titleEl?.textContent?.trim() || "Khóa học CodeMaster";
          await issueCertificate(courseId, courseTitle);
        });
        certificateBtn.dataset.bound = "true";
      }
    } else {
      certificateBtn.classList.remove("show");
    }
  }
}

// Lấy dữ liệu module cho courseId
async function fetchCourseModules(courseId) {
  // Kiểm tra cache trước
  if (moduleCache.has(courseId)) {
    return moduleCache.get(courseId);
  }

  const modulesRef = ref(database, `course_modules/${courseId}`);
  const snap = await get(modulesRef);
  const modules = snap.exists() ? snap.val() : {};

  // Lưu vào cache khi lấy từ DB
  moduleCache.set(courseId, modules);
  return modules;
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
          ${(module.lessons || [])
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

// === NEW LEARNING LAYOUT FUNCTIONS ===

// Cập nhật circular progress trong header
function updateHeaderProgress(progressPercentage) {
  const headerProgress = document.getElementById("header-progress");
  if (!headerProgress) return;

  const progressBar = headerProgress.querySelector(".progress-bar");
  const progressText = headerProgress.querySelector(".progress-text");

  if (progressBar) {
    // Tính stroke-dashoffset: 100 = 0%, 0 = 100%
    const offset = 100 - progressPercentage;
    progressBar.style.strokeDashoffset = offset;
  }

  if (progressText) {
    progressText.textContent = `${progressPercentage}%`;
  }
}

// Cập nhật footer navigation buttons
function updateFooterNavigation(prevLessonId, nextLessonId) {
  const prevBtn = document.getElementById("prev-lesson-btn");
  const nextBtn = document.getElementById("next-lesson-btn");

  if (prevBtn) {
    if (prevLessonId) {
      prevBtn.disabled = false;
      prevBtn.setAttribute("data-prev", prevLessonId);
    } else {
      prevBtn.disabled = true;
      prevBtn.removeAttribute("data-prev");
    }
  }

  if (nextBtn) {
    if (nextLessonId) {
      nextBtn.disabled = false;
      nextBtn.setAttribute("data-next", nextLessonId);
    } else {
      nextBtn.disabled = true;
      nextBtn.removeAttribute("data-next");
    }
  }
}

// Khởi tạo footer navigation button events
function initFooterNavButtons() {
  const prevBtn = document.getElementById("prev-lesson-btn");
  const nextBtn = document.getElementById("next-lesson-btn");

  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const prevId = prevBtn.getAttribute("data-prev");
      if (prevId) {
        activateLesson(prevId);
        setActiveLessonLink(prevId);
      }
    });
    prevBtn.dataset.bound = "true";
  }

  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const nextId = nextBtn.getAttribute("data-next");
      if (nextId) {
        activateLesson(nextId);
        setActiveLessonLink(nextId);
      }
    });
    nextBtn.dataset.bound = "true";
  }
}

// Render video vào video-stage
function renderVideoToStage(videoUrl) {
  const videoStage = document.getElementById("video-stage");
  if (!videoStage) return;

  if (!videoUrl) {
    videoStage.innerHTML = "";
    videoStage.style.display = "none";
    return;
  }

  videoStage.style.display = "flex";
  let videoHtml = "";

  if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
    videoHtml = `<div class="lesson-video"><iframe src="${videoUrl}" loading="lazy" frameborder="0" allowfullscreen></iframe></div>`;
  } else {
    videoHtml = `<div class="lesson-video"><video controls><source src="${videoUrl}" type="video/mp4"></video></div>`;
  }

  videoStage.innerHTML = videoHtml;
}

// Render nội dung bài học, video và quiz
function renderLessonContent(lesson, modules) {
  // Tìm vị trí bài học hiện tại trong modules
  let prevLessonId = null;
  let nextLessonId = null;
  let lessonsFlat = [];
  // modules tương ứng node courseId trong db
  Object.values(modules).forEach((module) => {
    (module.lessons || []).forEach((l) => lessonsFlat.push(l));
  });
  for (let i = 0; i < lessonsFlat.length; i++) {
    if (lessonsFlat[i].id === lesson.id) {
      if (i > 0) prevLessonId = lessonsFlat[i - 1].id;
      if (i < lessonsFlat.length - 1) nextLessonId = lessonsFlat[i + 1].id;
      break;
    }
  }

  // Video được render riêng vào video-stage, không render ở đây nữa
  return `
    <div class="lesson-content" id="lesson-${lesson.id}">
      <div class="lesson-header-actions">
        <button id="course-comment-btn" class="btn-comment-toggle">
          <i class="fas fa-comments"></i> Bình luận
        </button>
      </div>
      <div class="lesson-text">
        <p class="lesson-main-content">${escapeHtml(lesson.content)}</p>
        ${
          lesson.quiz && lesson.quiz.length
            ? renderQuiz(lesson.quiz, lesson.id)
            : ""
        }
      </div>
      <!-- Hidden navigation for backward compatibility -->
      <div class="lesson-navigation" style="display: none;">
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

function renderQuiz(quiz, lessonId) {
  if (!quiz && quiz.length === 0) {
    return "";
  }

  return `
    <div class="quiz-section" data-lesson="${lessonId}">
      <h3>Bài kiểm tra kiến thức</h3>
      <div class="quiz-questions-container">
        ${quiz
          .map(
            (q, idx) => `
          <div class="quiz-question ${
            idx === 0 ? "active" : ""
          }" data-qidx="${idx}">
            <h4>Câu ${idx + 1}: ${q.question}</h4>
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
            <div class="quiz-rationale"></div>
            <button class="btn btn-primary check-answer">Kiểm tra đáp án</button>
          </div>
        `
          )
          .join("")}
      </div>
      <div class="quiz-navigation">
        <button class="btn btn-secondary prev-question" style="display: none;">Quay lại</button>
        <button class="btn btn-primary next-question" style="display: none;">Tiếp theo</button>
      </div>
    </div>
  `;
}

// Khởi tạo xử lý tương tác quiz và phản hồi
function initQuizEvents(lesson) {
  const quizSection = document.querySelector(
    `.quiz-section[data-lesson="${lesson.id}"]`
  );
  if (!quizSection) return;

  const quizQuestions = quizSection.querySelectorAll(".quiz-question");
  const prevBtn = quizSection.querySelector(".prev-question");
  const nextBtn = quizSection.querySelector(".next-question");

  let currentQuestionIndex = 0;
  // Lưu trữ đáp án người dùng đã chọn
  let userAnswers = new Array(lesson.quiz.length).fill(null);

  function showQuestion(index) {
    quizQuestions.forEach((q, i) => {
      q.classList.remove("active");
      if (i === index) {
        q.classList.add("active");
      }
    });

    // Cập nhật trạng thái nút điều hướng
    prevBtn.style.display = index > 0 ? "inline-block" : "none";
    nextBtn.style.display =
      index < quizQuestions.length - 1 ? "inline-block" : "none";

    // Ẩn nút "Kiểm tra đáp án" nếu câu hỏi đã được trả lời và chuyển sang câu tiếp theo
    const currentQuestionEl = quizQuestions[index];
    const checkAnswerBtn = currentQuestionEl.querySelector(".check-answer");
    const feedback = currentQuestionEl.querySelector(".quiz-feedback");
    const rationaleDisplay = currentQuestionEl.querySelector(".quiz-rationale");
    const allOptions = currentQuestionEl.querySelectorAll(".quiz-option");

    // Reset feedback và rationale khi chuyển câu hỏi
    feedback.textContent = "";
    feedback.className = "quiz-feedback";
    rationaleDisplay.textContent = "";
    rationaleDisplay.className = "quiz-rationale";
    allOptions.forEach((opt) => {
      opt.classList.remove("correct", "incorrect", "selected");
    });

    // Khôi phục lựa chọn đã chọn của người dùng nếu có
    if (userAnswers[index] !== null) {
      const selectedRadio = currentQuestionEl.querySelector(
        `input[type='radio'][value="${userAnswers[index]}"]`
      );
      if (selectedRadio) {
        selectedRadio.checked = true;
        selectedRadio.closest("label.quiz-option").classList.add("selected");
      }
      // Tự động kiểm tra và hiển thị feedback nếu đã trả lời
      checkAnswer(index, true); // isFromNavigation "Tôi chỉ đang hiển thị lại kết quả cũ, đừng cho người dùng thay đổi đáp án nữa".
    }

    // Luôn hiển thị nút kiểm tra đáp án ban đầu
    checkAnswerBtn.style.display = "inline-block";
  }

  function checkAnswer(questionIndex, isFromNavigation = false) {
    const questionData = lesson.quiz[questionIndex];
    const container = quizQuestions[questionIndex];
    const selected = container.querySelector(
      `input[name="quiz-${lesson.id}-${questionIndex}"]:checked`
    );
    const feedback = container.querySelector(".quiz-feedback");
    const rationaleDisplay = container.querySelector(".quiz-rationale");
    const allOptions = container.querySelectorAll(".quiz-option");
    const checkAnswerBtn = container.querySelector(".check-answer");

    // Reset trạng thái trước khi kiểm tra lại
    feedback.textContent = "";
    feedback.className = "quiz-feedback";
    rationaleDisplay.textContent = "";
    rationaleDisplay.className = "quiz-rationale";
    allOptions.forEach((opt) => {
      opt.classList.remove("correct", "incorrect", "selected");
    });

    if (!selected) {
      if (!isFromNavigation) {
        // Chỉ hiển thị cảnh báo nếu người dùng nhấn nút kiểm tra
        feedback.textContent = "Vui lòng chọn đáp án!";
        feedback.className = "quiz-feedback alert-warning";
      }
      return;
    }

    const selectedOptionValue = parseInt(selected.value);
    const selectedOptionLabel = selected.closest("label.quiz-option");

    // Đánh dấu lựa chọn của người dùng
    selectedOptionLabel.classList.add("selected");
    userAnswers[questionIndex] = selectedOptionValue; // Lưu đáp án người dùng

    if (selectedOptionValue === questionData.answer) {
      feedback.innerHTML = `<span><i class="fa-solid fa-check" style="margin-right: 7px"></i>Câu trả lời chích xác.</span>`;
      feedback.className = "quiz-feedback correct";
      selectedOptionLabel.classList.add("correct");
    } else {
      feedback.innerHTML = `<i class="fa-solid fa-xmark" style="margin-right: 7px"></i>Chưa đúng, hãy thử lại!`;
      feedback.className = "quiz-feedback incorrect";
      selectedOptionLabel.classList.add("incorrect");
    }

    if (questionData.rationale) {
      rationaleDisplay.textContent = `Giải thích: ${escapeHtml(
        questionData.rationale
      )}`;
      rationaleDisplay.classList.add("active");
    }

    // Sau khi kiểm tra, ẩn nút "Kiểm tra đáp án"
    checkAnswerBtn.style.display = "none";
  }

  // Event Listeners cho các nút điều hướng
  prevBtn.addEventListener("click", () => {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      showQuestion(currentQuestionIndex);
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      currentQuestionIndex++;
      showQuestion(currentQuestionIndex);
    }
  });

  // Event Listeners cho nút "Kiểm tra đáp án" của từng câu hỏi
  quizQuestions.forEach((qEl, qIdx) => {
    const checkBtn = qEl.querySelector(".check-answer");
    checkBtn.addEventListener("click", () => checkAnswer(qIdx));

    // Bắt sự kiện thay đổi lựa chọn để reset feedback cũ
    const optionsContainer = qEl.querySelector(".quiz-options");
    optionsContainer.addEventListener("change", function () {
      const feedback = qEl.querySelector(".quiz-feedback");
      const rationaleDisplay = qEl.querySelector(".quiz-rationale");
      const allOptions = qEl.querySelectorAll(".quiz-option");
      const checkAnswerBtn = qEl.querySelector(".check-answer");

      feedback.textContent = "";
      feedback.className = "quiz-feedback";
      rationaleDisplay.textContent = "";
      rationaleDisplay.className = "quiz-rationale";
      allOptions.forEach((opt) => {
        opt.classList.remove("correct", "incorrect", "selected");
      });
      // Hiển thị lại nút kiểm tra đáp án khi người dùng thay đổi lựa chọn
      checkAnswerBtn.style.display = "inline-block";
    });
  });

  // Hiển thị câu hỏi đầu tiên khi khởi tạo
  showQuestion(currentQuestionIndex);
}

// Cập nhật thông tin course trên header
async function updateCourseTitle() {
  // Cập nhật thông tin khóa học
  const courseId = getCourseIdFromUrl();
  const courseRef = ref(database, `courses/${courseId}`);
  try {
    const snap = await get(courseRef);
    if (snap.exists()) {
      const course = snap.val();

      // Lưu thông tin khóa học để sử dụng trong các hàm khác
      window.currentCourse = course;

      // Cập nhật tiêu đề khóa học
      const titleEl = document.getElementById("course-title");
      if (titleEl && course.title) titleEl.textContent = course.title;
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

// Khởi tạo xử lý cho nút bình luận để hiển thị panel
function initCommentButton(lessonId) {
  // Kiểm tra xem panel comment đã được thêm vào chưa
  let commentPanel = document.getElementById("course-comments-panel");
  if (!commentPanel) {
    // Nếu chưa có, thêm vào
    commentPanel = document.createElement("div");
    commentPanel.id = "course-comments-panel";
    commentPanel.className = "comments-panel";
    document.body.appendChild(commentPanel);
  }

  // Thiết lập nút bình luận
  const commentBtn = document.getElementById("course-comment-btn");
  const commentOverlay = document.querySelector(".comments-overlay");
  if (commentBtn) {
    commentBtn.addEventListener("click", () => {
      // Hiển thị panel
      commentOverlay.classList.add("active");
      commentPanel.classList.add("active");

      // Khởi tạo hệ thống bình luận cho panel nếu chưa có
      const courseId = getCourseIdFromUrl();

      // Hủy hệ thống bình luận cũ trong panel nếu có
      if (commentSystem) {
        commentSystem.destroy();
      }

      // Tạo mới hệ thống bình luận trong panel
      commentSystem = new CommentSystem(courseId, lessonId, commentPanel, true);
      document.body.style.overflow = "hidden";
    });
  }
}
