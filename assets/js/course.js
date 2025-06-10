import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Các phần tử DOM cho trang khóa học
document.addEventListener("DOMContentLoaded", function () {
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

  // Sự kiện click nút bắt đầu học
  if (startCourseBtn) {
    startCourseBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Tải bài học đầu tiên nếu có
      if (lessonLinks.length > 0) {
        const firstLesson = lessonLinks[0];
        activateLesson(firstLesson.getAttribute("data-lesson"));

        // Đánh dấu bài học đầu tiên là active
        firstLesson.classList.add("active");
      }
    });
  }

  // Sự kiện click các liên kết bài học
  lessonLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      // Bỏ class active khỏi tất cả liên kết
      lessonLinks.forEach((l) => l.classList.remove("active"));

      // Thêm class active cho liên kết được click
      link.classList.add("active");

      // Tải nội dung bài học
      const lessonId = link.getAttribute("data-lesson");
      activateLesson(lessonId);
    });
  });
}

// Tải và hiển thị nội dung bài học
function activateLesson(lessonId) {
  // Trong thực tế, sẽ tải nội dung bài học từ server hoặc từ dữ liệu đã preload trong HTML

  // Ở đây mô phỏng việc tải nội dung
  const lessonContainer = document.querySelector(".lesson-container");

  if (lessonContainer) {
    // Hiển thị trạng thái đang tải
    lessonContainer.innerHTML =
      '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải bài học...</div>';

    // Mô phỏng độ trễ gọi API
    setTimeout(() => {
      // Lấy nội dung mẫu dựa trên ID
      const lessonContent = getSampleLessonContent(lessonId);

      // Cập nhật nội dung vào container
      lessonContainer.innerHTML = lessonContent;

      // Khởi tạo các thành phần tương tác trong nội dung mới
      initLessonInteractivity();

      // Đánh dấu bài học đã xem
      trackLessonProgress(lessonId);
    }, 500);
  }
}

// Khởi tạo các thành phần tương tác trong nội dung bài học
function initLessonInteractivity() {
  // Khởi tạo highlight cho code (nếu có)
  // Trong thực tế có thể dùng Prism.js hoặc thư viện tương tự

  // Khởi tạo quiz
  const quizOptions = document.querySelectorAll(".quiz-option");
  const checkAnswerBtns = document.querySelectorAll(".check-answer");

  quizOptions.forEach((option) => {
    option.addEventListener("click", () => {
      // Lấy tất cả option trong quiz này
      const quizQuestion = option.closest(".quiz-question");
      const options = quizQuestion.querySelectorAll(".quiz-option");

      // Bỏ class selected khỏi tất cả option
      options.forEach((opt) => opt.classList.remove("selected"));

      // Thêm class selected cho option được chọn
      option.classList.add("selected");

      // Chọn radio button
      const radio = option.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
      }
    });
  });

  checkAnswerBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const quizQuestion = btn.closest(".quiz-question");
      const selectedOption = quizQuestion.querySelector(
        ".quiz-option.selected"
      );
      const feedback = quizQuestion.querySelector(".quiz-feedback");

      if (selectedOption && feedback) {
        const isCorrect =
          selectedOption.getAttribute("data-correct") === "true";

        // Reset class
        quizQuestion.querySelectorAll(".quiz-option").forEach((opt) => {
          opt.classList.remove("correct", "incorrect");
        });

        // Thêm class phù hợp
        if (isCorrect) {
          selectedOption.classList.add("correct");
          feedback.classList.add("correct");
          feedback.classList.remove("incorrect");
          feedback.textContent = "Chính xác! Làm tốt lắm!";
        } else {
          selectedOption.classList.add("incorrect");
          feedback.classList.add("incorrect");
          feedback.classList.remove("correct");
          feedback.textContent = "Không chính xác. Hãy thử lại!";
        }
      }
    });
  });

  // Khởi tạo nộp bài tập
  const exerciseSubmitBtns = document.querySelectorAll(".submit-exercise");

  exerciseSubmitBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      // Trong thực tế sẽ xử lý gửi bài tập lên server
      // Ở đây chỉ hiển thị thông báo thành công
      alert("Bài tập đã được gửi thành công!");

      // Đánh dấu bài tập đã hoàn thành
      const exercise = btn.closest(".exercise-section");
      if (exercise) {
        exercise.classList.add("completed");
      }
    });
  });
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

    // Lưu tiến trình vào localStorage
    const courseId = getCourseIdFromUrl(); // Thực tế sẽ lấy động
    saveLessonCompletionToDB(courseId, lessonId);

    // Cập nhật tiến trình tổng thể
    // updateProgressUI(progressPercentage);
  }
}

// Lưu trạng thái hoàn thành bài học vào Firebase cho từng khóa học
async function saveLessonCompletionToDB(courseId, lessonId) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        alert("Bạn cần đăng nhập để lưu tiến trình!");
        reject("Chưa đăng nhập");
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
        console.error("Error code:", err.code);
        console.error("Error message:", err.message);

        reject(err);
      }
    });
  });
}

// Khởi tạo tiến trình học từ dữ liệu đã lưu
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
      //   cập nhật UI
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

// Nội dung bài học mẫu (trong thực tế sẽ lấy từ database hoặc API)
function getSampleLessonContent(lessonId) {
  // Phân tích lessonId để lấy chương và số bài
  const [module, lesson] = lessonId.split(".");

  // Nội dung mẫu cho một số bài học cụ thể
  if (module === "1" && lesson === "1") {
    return `
            <div class="lesson-content" id="lesson-1-1">
                <h2>HTML là gì?</h2>
                <div class="lesson-video">
                    <div class="video-placeholder">
                        <i class="fas fa-play-circle"></i>
                        <p>Bài học 1.1: HTML là gì?</p>
                    </div>
                </div>
                <div class="lesson-text">
                    <p>HTML (HyperText Markup Language) là ngôn ngữ đánh dấu tiêu chuẩn được sử dụng để tạo trang web. Nó mô tả cấu trúc của một trang web và bao gồm một loạt các phần tử giúp trình duyệt hiển thị nội dung.</p>
                    
                    <p>Các phần tử HTML được biểu diễn bằng thẻ, được viết bằng dấu ngoặc nhọn. Ví dụ:</p>
                    
                    <pre><code>&lt;h1&gt;Đây là một tiêu đề&lt;/h1&gt;
&lt;p&gt;Đây là một đoạn văn.&lt;/p&gt;</code></pre>
                    
                    <p>Các thẻ HTML thường xuất hiện theo cặp như <code>&lt;p&gt;</code> và <code>&lt;/p&gt;</code>. Thẻ đầu tiên trong một cặp là thẻ mở, thẻ thứ hai là thẻ đóng. Thẻ đóng được viết giống như thẻ mở, nhưng có dấu gạch chéo phía trước tên thẻ.</p>
                    
                    <div class="exercise-section">
                        <h3>Bài tập: Viết HTML đầu tiên của bạn</h3>
                        <p>Hãy thử viết một tài liệu HTML đơn giản với một tiêu đề và một đoạn văn.</p>
                        <textarea rows="6" class="code-editor" placeholder="Viết HTML của bạn tại đây..."></textarea>
                        <button class="btn btn-primary submit-exercise">Nộp Bài Tập</button>
                    </div>
                    
                    <div class="quiz-section">
                        <h3>Câu Hỏi Nhanh</h3>
                        <div class="quiz-question">
                            <p>HTML là viết tắt của cụm từ nào?</p>
                            <div class="quiz-options">
                                <label class="quiz-option" data-correct="true">
                                    <input type="radio" name="quiz1" value="a">
                                    <span>HyperText Markup Language</span>
                                </label>
                                <label class="quiz-option">
                                    <input type="radio" name="quiz1" value="b">
                                    <span>High-level Text Management Language</span>
                                </label>
                                <label class="quiz-option">
                                    <input type="radio" name="quiz1" value="c">
                                    <span>Hyperlink and Text Markup Language</span>
                                </label>
                                <label class="quiz-option">
                                    <input type="radio" name="quiz1" value="d">
                                    <span>Home Tool Markup Language</span>
                                </label>
                            </div>
                            <div class="quiz-feedback"></div>
                            <button class="btn btn-primary check-answer">Kiểm Tra Đáp Án</button>
                        </div>
                    </div>
                    
                    <div class="lesson-navigation">
                        <a href="#" class="btn btn-secondary prev-lesson">Bài Trước</a>
                        <a href="#" class="btn btn-primary next-lesson" data-next="1.2">Bài Tiếp Theo</a>
                    </div>
                </div>
            </div>
        `;
  } else if (module === "1" && lesson === "2") {
    return `
            <div class="lesson-content" id="lesson-1-2">
                <h2>Cấu Trúc Tài Liệu HTML</h2>
                <div class="lesson-video">
                    <div class="video-placeholder">
                        <i class="fas fa-play-circle"></i>
                        <p>Bài học 1.2: Cấu Trúc Tài Liệu HTML</p>
                    </div>
                </div>
                <div class="lesson-text">
                    <p>Mỗi tài liệu HTML đều có một cấu trúc bắt buộc bao gồm các khai báo và phần tử sau:</p>
                    
                    <pre><code>&lt;!DOCTYPE html&gt;
&lt;html&gt;
&lt;head&gt;
    &lt;title&gt;Tiêu Đề Trang&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
    &lt;h1&gt;Đây Là Một Tiêu Đề&lt;/h1&gt;
    &lt;p&gt;Đây là một đoạn văn.&lt;/p&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>
                    
                    <p>Hãy phân tích cấu trúc:</p>
                    
                    <ul>
                        <li><code>&lt;!DOCTYPE html&gt;</code>: Khai báo định nghĩa tài liệu này là HTML5</li>
                        <li><code>&lt;html&gt;</code>: Phần tử gốc của một trang HTML</li>
                        <li><code>&lt;head&gt;</code>: Chứa thông tin meta về tài liệu</li>
                        <li><code>&lt;title&gt;</code>: Chỉ định tiêu đề cho tài liệu</li>
                        <li><code>&lt;body&gt;</code>: Chứa nội dung trang hiển thị</li>
                    </ul>
                    
                    <div class="exercise-section">
                        <h3>Bài tập: Tạo một Tài Liệu HTML hoàn chỉnh</h3>
                        <p>Tạo một tài liệu HTML hoàn chỉnh với cấu trúc đúng, bao gồm tiêu đề, tiêu đề và nhiều đoạn văn.</p>
                        <textarea rows="8" class="code-editor" placeholder="Viết tài liệu HTML của bạn tại đây..."></textarea>
                        <button class="btn btn-primary submit-exercise">Nộp Bài Tập</button>
                    </div>
                    
                    <div class="lesson-navigation">
                        <a href="#" class="btn btn-secondary prev-lesson" data-prev="1.1">Bài Trước</a>
                        <a href="#" class="btn btn-primary next-lesson" data-next="1.3">Bài Tiếp Theo</a>
                    </div>
                </div>
            </div>
        `;
  } else {
    // Các bài học khác trả về template chung
    return `
            <div class="lesson-content" id="lesson-${module}-${lesson}">
                <h2>Chương ${module}, Bài ${lesson}</h2>
                <div class="lesson-video">
                    <div class="video-placeholder">
                        <i class="fas fa-play-circle"></i>
                        <p>Video Bài học ${module}.${lesson}</p>
                    </div>
                </div>
                <div class="lesson-text">
                    <p>Đây là nội dung mẫu cho Chương ${module}, Bài ${lesson}.</p>
                    <p>Trong khóa học hoàn chỉnh, phần này sẽ chứa các giải thích chi tiết, ví dụ và bài tập liên quan đến chủ đề cụ thể của bài học này.</p>
                    
                    <div class="exercise-section">
                        <h3>Bài tập</h3>
                        <p>Đây là bài tập mẫu sẽ được điều chỉnh cho phù hợp với bài học cụ thể này.</p>
                        <textarea rows="6" class="code-editor" placeholder="Viết mã của bạn tại đây..."></textarea>
                        <button class="btn btn-primary submit-exercise">Nộp Bài Tập</button>
                    </div>
                    
                    <div class="lesson-navigation">
                        <a href="#" class="btn btn-secondary prev-lesson">Bài Trước</a>
                        <a href="#" class="btn btn-primary next-lesson">Bài Tiếp Theo</a>
                    </div>
                </div>
            </div>
        `;
  }
}
